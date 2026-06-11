#region license
// Copyright 2026 Utah Departement of Transportation
// for Application - Utah.Udot.Atspm.Business.TimeOfDay/TimeOfDayRecommendationService.cs
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
#endregion

using Microsoft.Extensions.Options;
using Utah.Udot.Atspm.Business.Common;
using Utah.Udot.Atspm.Data.Models.MeasureOptions;

namespace Utah.Udot.Atspm.Business.TimeOfDay
{
    public interface ITimeOfDayRecommendationService
    {
        TimeOfDayRecommendationDto BuildRecommendation(
            TimeOfDayOptions options,
            TimeOfDayProfileDto corridorProfile,
            IReadOnlyList<TimeOfDayProfileDto> directionalProfiles,
            DateOnly representativeDate);
    }

    public class TimeOfDayRecommendationService : ITimeOfDayRecommendationService
    {
        private readonly TimeOfDayThresholdOptions thresholds;
        private readonly ITimeOfDayProfileService profileService;

        public TimeOfDayRecommendationService(
            IOptions<TimeOfDayThresholdOptions> thresholds,
            ITimeOfDayProfileService profileService)
        {
            this.thresholds = thresholds.Value;
            this.profileService = profileService;
        }

        public TimeOfDayRecommendationDto BuildRecommendation(
            TimeOfDayOptions options,
            TimeOfDayProfileDto corridorProfile,
            IReadOnlyList<TimeOfDayProfileDto> directionalProfiles,
            DateOnly representativeDate)
        {
            if (corridorProfile.Points.Count == 0 || corridorProfile.Points.All(p => p.SmoothedVolume <= 0))
            {
                return new TimeOfDayRecommendationDto
                {
                    AlgorithmVersion = thresholds.AlgorithmVersion,
                    ThresholdConfigurationName = thresholds.ConfigurationName,
                    SummaryText = "Recommended schedule unavailable because no usable volume profile was found."
                };
            }

            var amProfile = SelectProfile(
                options.AmPrimaryDirections.Count > 0 ? options.AmPrimaryDirections : options.AllDayPrimaryDirections,
                directionalProfiles,
                corridorProfile,
                "AM primary");
            var pmProfile = SelectProfile(
                options.PmPrimaryDirections.Count > 0 ? options.PmPrimaryDirections : options.AllDayPrimaryDirections,
                directionalProfiles,
                corridorProfile,
                "PM primary");

            var maxAmEnd = ParseTimeOrDefault(thresholds.MaxAmEndTime, 11 * 60);
            var maxPmEnd = ParseTimeOrDefault(thresholds.MaxPmEndTime, 19 * 60);
            var freeFallback = ParseTimeOrDefault(thresholds.FreeFallbackTime, 22 * 60);
            var binSize = InferBinSize(corridorProfile);

            var amPeak = FindPeak(amProfile, 4 * 60, maxAmEnd) ?? FindPeak(corridorProfile, 4 * 60, maxAmEnd);
            var pmPeak = FindPeak(pmProfile, 12 * 60, maxPmEnd) ?? FindPeak(corridorProfile, 12 * 60, maxPmEnd);
            var dailyPeak = corridorProfile.Points.Max(p => p.SmoothedVolume);
            var baseline = corridorProfile.Points
                .Where(p => p.SmoothedVolume > 0)
                .Select(p => p.SmoothedVolume)
                .DefaultIfEmpty(0)
                .Min();

            var amEntryThreshold = baseline + ((amPeak?.SmoothedVolume ?? dailyPeak) - baseline) * thresholds.AmEntryPctOfPeak;
            var amExitThreshold = baseline + ((amPeak?.SmoothedVolume ?? dailyPeak) - baseline) * thresholds.AmExitPctOfPeak;
            var pmEntryThreshold = baseline + ((pmPeak?.SmoothedVolume ?? dailyPeak) - baseline) * thresholds.PmEntryPctOfPeak;
            var pmExitThreshold = baseline + ((pmPeak?.SmoothedVolume ?? dailyPeak) - baseline) * thresholds.PmExitPctOfPeak;
            var freeThreshold = Math.Max(
                dailyPeak * thresholds.FreeEntryPctOfDailyPeak,
                baseline + (dailyPeak - baseline) * thresholds.FreeEntryPctOfDynamicRange);

            var amEntry = FindFirstSustained(
                amProfile,
                3 * 60,
                amPeak?.Minutes ?? 7 * 60,
                amEntryThreshold,
                thresholds.EntrySustainedBins,
                true) ?? 6 * 60;
            var amExit = FindFirstSustained(
                amProfile,
                (amPeak?.Minutes ?? amEntry) + binSize,
                maxAmEnd,
                amExitThreshold,
                thresholds.EntrySustainedBins,
                false) ?? maxAmEnd;
            var pmEntry = FindFirstSustained(
                pmProfile,
                Math.Max(amExit + binSize, 12 * 60),
                pmPeak?.Minutes ?? 16 * 60,
                pmEntryThreshold,
                thresholds.EntrySustainedBins,
                true) ?? Math.Max(amExit + binSize, 15 * 60);
            var pmExit = FindFirstSustained(
                pmProfile,
                (pmPeak?.Minutes ?? pmEntry) + binSize,
                maxPmEnd,
                pmExitThreshold,
                thresholds.EntrySustainedBins,
                false) ?? maxPmEnd;
            var freeStart = FindFirstSustained(
                corridorProfile,
                pmExit,
                24 * 60 - binSize,
                freeThreshold,
                thresholds.FreeSustainedBins,
                false) ?? freeFallback;

            var boundaries = NormalizeBoundaries(
                new[] { amEntry, amExit, pmEntry, freeStart },
                binSize);
            var start = representativeDate.ToDateTime(TimeOnly.MinValue);
            var end = start.AddDays(1);
            var schedule = new List<Plan>();

            AddPlan(schedule, "1", start, start.AddMinutes(boundaries[0]));
            AddPlan(schedule, "7", start.AddMinutes(boundaries[0]), start.AddMinutes(boundaries[1]));
            AddPlan(schedule, "13", start.AddMinutes(boundaries[1]), start.AddMinutes(boundaries[2]));
            AddPlan(schedule, "7", start.AddMinutes(boundaries[2]), start.AddMinutes(boundaries[3]));
            AddPlan(schedule, "254", start.AddMinutes(boundaries[3]), end);

            return new TimeOfDayRecommendationDto
            {
                RecommendedSchedule = schedule,
                AmPeakTime = amPeak?.TimeOfDay ?? string.Empty,
                MiddayValleyTime = FindValley(corridorProfile, boundaries[1], boundaries[2])?.TimeOfDay ?? string.Empty,
                PmPeakTime = pmPeak?.TimeOfDay ?? string.Empty,
                AlgorithmVersion = thresholds.AlgorithmVersion,
                ThresholdConfigurationName = thresholds.ConfigurationName,
                SummaryText = $"Recommended TOD schedule uses {thresholds.AlgorithmVersion} with AM peak {amPeak?.TimeOfDay ?? "unavailable"} and PM peak {pmPeak?.TimeOfDay ?? "unavailable"}."
            };
        }

        private TimeOfDayProfileDto SelectProfile(
            IReadOnlyList<string> requestedDirections,
            IReadOnlyList<TimeOfDayProfileDto> directionalProfiles,
            TimeOfDayProfileDto fallback,
            string label)
        {
            var normalized = requestedDirections
                .Select(TimeOfDayDirectionHelper.NormalizeDirection)
                .Where(d => !string.IsNullOrWhiteSpace(d))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            if (normalized.Count == 0)
            {
                return fallback;
            }

            var matches = directionalProfiles
                .Where(p => normalized.Contains(p.Direction, StringComparer.OrdinalIgnoreCase))
                .ToList();

            return matches.Count == 0
                ? fallback
                : profileService.SumProfiles(label, matches);
        }

        private static TimeOfDayProfilePointDto FindPeak(TimeOfDayProfileDto profile, int startMinutes, int endMinutes)
        {
            return profile.Points
                .Where(p => p.Minutes >= startMinutes && p.Minutes <= endMinutes)
                .OrderByDescending(p => p.SmoothedVolume)
                .ThenBy(p => p.Minutes)
                .FirstOrDefault();
        }

        private static TimeOfDayProfilePointDto FindValley(TimeOfDayProfileDto profile, int startMinutes, int endMinutes)
        {
            return profile.Points
                .Where(p => p.Minutes >= startMinutes && p.Minutes <= endMinutes)
                .OrderBy(p => p.SmoothedVolume)
                .ThenBy(p => p.Minutes)
                .FirstOrDefault();
        }

        private static int? FindFirstSustained(
            TimeOfDayProfileDto profile,
            int startMinutes,
            int endMinutes,
            double threshold,
            int sustainedBins,
            bool aboveThreshold)
        {
            var points = profile.Points
                .Where(p => p.Minutes >= startMinutes && p.Minutes <= endMinutes)
                .OrderBy(p => p.Minutes)
                .ToList();

            for (var i = 0; i < points.Count; i++)
            {
                if (i + sustainedBins > points.Count)
                {
                    break;
                }

                var sustained = points
                    .Skip(i)
                    .Take(sustainedBins)
                    .All(p => aboveThreshold ? p.SmoothedVolume >= threshold : p.SmoothedVolume <= threshold);

                if (sustained)
                {
                    return points[i].Minutes;
                }
            }

            return null;
        }

        private static int[] NormalizeBoundaries(IReadOnlyList<int> boundaries, int binSize)
        {
            var result = boundaries
                .Select(b => (int)Math.Round(b / (double)binSize) * binSize)
                .Select(b => Math.Clamp(b, binSize, 24 * 60 - binSize))
                .ToArray();

            for (var i = 1; i < result.Length; i++)
            {
                if (result[i] <= result[i - 1])
                {
                    result[i] = Math.Min(result[i - 1] + binSize, 24 * 60 - binSize);
                }
            }

            return result;
        }

        private static int InferBinSize(TimeOfDayProfileDto profile)
        {
            return profile.Points.Count > 1
                ? profile.Points[1].Minutes - profile.Points[0].Minutes
                : 15;
        }

        private static int ParseTimeOrDefault(string value, int defaultMinutes)
        {
            return TimeOnly.TryParse(value, out var time)
                ? time.Hour * 60 + time.Minute
                : defaultMinutes;
        }

        private static void AddPlan(List<Plan> schedule, string planNumber, DateTime start, DateTime end)
        {
            if (end > start)
            {
                schedule.Add(new Plan(planNumber, start, end));
            }
        }
    }
}
