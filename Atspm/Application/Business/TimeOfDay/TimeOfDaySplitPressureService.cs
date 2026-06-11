#region license
// Copyright 2026 Utah Departement of Transportation
// for Application - Utah.Udot.Atspm.Business.TimeOfDay/TimeOfDaySplitPressureService.cs
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
using Utah.Udot.Atspm.Data.Models;
using Utah.Udot.Atspm.Data.Models.MeasureOptions;

namespace Utah.Udot.Atspm.Business.TimeOfDay
{
    public interface ITimeOfDaySplitPressureService
    {
        TimeOfDaySplitPressureDto BuildSplitPressure(
            TimeOfDayOptions options,
            IReadOnlyList<TimeOfDayProfileDto> directionalProfiles,
            IReadOnlyList<TimeOfDayLocationAnalysisData> locationData,
            IReadOnlyList<DateOnly> selectedDates,
            int binSizeMinutes);
    }

    public class TimeOfDaySplitPressureService : ITimeOfDaySplitPressureService
    {
        private readonly TimeOfDayThresholdOptions thresholds;
        private readonly ITimeOfDayProfileService profileService;

        public TimeOfDaySplitPressureService(
            IOptions<TimeOfDayThresholdOptions> thresholds,
            ITimeOfDayProfileService profileService)
        {
            this.thresholds = thresholds.Value;
            this.profileService = profileService;
        }

        public TimeOfDaySplitPressureDto BuildSplitPressure(
            TimeOfDayOptions options,
            IReadOnlyList<TimeOfDayProfileDto> directionalProfiles,
            IReadOnlyList<TimeOfDayLocationAnalysisData> locationData,
            IReadOnlyList<DateOnly> selectedDates,
            int binSizeMinutes)
        {
            var primaryDirections = ResolvePrimaryDirections(options, directionalProfiles);
            var crossDirections = directionalProfiles
                .Select(p => p.Direction)
                .Where(d => !primaryDirections.Contains(d, StringComparer.OrdinalIgnoreCase))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            var primaryProfile = profileService.SumProfiles(
                "Primary street",
                directionalProfiles.Where(p => primaryDirections.Contains(p.Direction, StringComparer.OrdinalIgnoreCase)).ToList());
            var crossProfile = profileService.SumProfiles(
                "Cross street",
                directionalProfiles.Where(p => crossDirections.Contains(p.Direction, StringComparer.OrdinalIgnoreCase)).ToList());

            var share = BuildCrossTrafficShare(primaryProfile, crossProfile);
            var periodPeaks = BuildPeriodPeaks(primaryProfile, crossProfile, share);
            var peakShare = share
                .Where(s => s.CrossTrafficPercent.HasValue)
                .OrderByDescending(s => s.CrossTrafficPercent)
                .ThenBy(s => s.Minutes)
                .FirstOrDefault();
            var primaryPeak = primaryProfile.Points.OrderByDescending(p => p.SmoothedVolume).ThenBy(p => p.Minutes).FirstOrDefault();
            var crossPeak = crossProfile.Points.OrderByDescending(p => p.SmoothedVolume).ThenBy(p => p.Minutes).FirstOrDefault();
            var crossTrafficLocations = BuildCrossTrafficLocations(
                locationData,
                crossDirections,
                selectedDates,
                binSizeMinutes,
                share);
            var movementPressures = BuildMovementPressures(
                locationData,
                selectedDates,
                binSizeMinutes);

            return new TimeOfDaySplitPressureDto
            {
                PrimaryDirections = primaryDirections,
                CrossDirections = crossDirections,
                PrimaryProfile = primaryProfile,
                CrossStreetProfile = crossProfile,
                CrossTrafficShare = share,
                ThresholdPercentByName = new Dictionary<string, double>
                {
                    ["SplitReview"] = thresholds.SplitReviewThresholdPercent,
                    ["ShoulderReview"] = thresholds.ShoulderReviewThresholdPercent
                },
                PeriodPeaks = periodPeaks,
                CrossTrafficLocations = crossTrafficLocations,
                MovementPressures = movementPressures,
                PrimaryPeakVolume = primaryPeak?.SmoothedVolume,
                PrimaryPeakTime = primaryPeak?.TimeOfDay ?? string.Empty,
                CrossStreetPeakVolume = crossPeak?.SmoothedVolume,
                CrossStreetPeakTime = crossPeak?.TimeOfDay ?? string.Empty,
                PeakCrossTrafficPercent = peakShare?.CrossTrafficPercent,
                PeakCrossTrafficPercentTime = peakShare?.TimeOfDay ?? string.Empty,
                PrimaryStreetRemainsDominant = (peakShare?.CrossTrafficPercent ?? 0) < 50,
                SummaryText = BuildSummaryText(primaryPeak, crossPeak, peakShare),
                ReviewText = BuildReviewText(peakShare?.CrossTrafficPercent)
            };
        }

        private static List<string> ResolvePrimaryDirections(
            TimeOfDayOptions options,
            IReadOnlyList<TimeOfDayProfileDto> directionalProfiles)
        {
            var requested = options.AllDayPrimaryDirections
                .Concat(options.AmPrimaryDirections)
                .Concat(options.PmPrimaryDirections)
                .Select(TimeOfDayDirectionHelper.NormalizeDirection)
                .Where(d => !string.IsNullOrWhiteSpace(d))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            if (requested.Count > 0)
            {
                return requested;
            }

            var strongestDirection = directionalProfiles
                .OrderByDescending(p => p.Points.Sum(x => x.AverageVolume))
                .Select(p => p.Direction)
                .FirstOrDefault();

            return string.IsNullOrWhiteSpace(strongestDirection)
                ? new List<string>()
                : new List<string> { strongestDirection };
        }

        private static List<TimeOfDayCrossTrafficSharePointDto> BuildCrossTrafficShare(
            TimeOfDayProfileDto primaryProfile,
            TimeOfDayProfileDto crossProfile)
        {
            var count = Math.Max(primaryProfile.Points.Count, crossProfile.Points.Count);
            var result = new List<TimeOfDayCrossTrafficSharePointDto>();

            for (var i = 0; i < count; i++)
            {
                var primary = primaryProfile.Points.ElementAtOrDefault(i);
                var cross = crossProfile.Points.ElementAtOrDefault(i);
                var minutes = primary?.Minutes ?? cross?.Minutes ?? i * 15;
                var primaryVolume = primary?.SmoothedVolume ?? 0;
                var crossVolume = cross?.SmoothedVolume ?? 0;
                var total = primaryVolume + crossVolume;

                result.Add(new TimeOfDayCrossTrafficSharePointDto
                {
                    TimeOfDay = TimeOfDayProfileService.FormatTime(minutes),
                    Minutes = minutes,
                    PrimaryVolume = TimeOfDayProfileService.Round(primaryVolume),
                    CrossStreetVolume = TimeOfDayProfileService.Round(crossVolume),
                    TotalVolume = TimeOfDayProfileService.Round(total),
                    CrossTrafficPercent = total > 0
                        ? TimeOfDayProfileService.Round(crossVolume / total * 100)
                        : null
                });
            }

            return result;
        }

        private static List<TimeOfDayPeakEventDto> BuildPeriodPeaks(
            TimeOfDayProfileDto primaryProfile,
            TimeOfDayProfileDto crossProfile,
            IReadOnlyList<TimeOfDayCrossTrafficSharePointDto> share)
        {
            var result = new List<TimeOfDayPeakEventDto>();
            foreach (var period in Periods())
            {
                AddProfilePeak(result, "Primary peak", "Primary", period.Name, primaryProfile, period.Start, period.End);
                AddProfilePeak(result, "Cross-street peak", "CrossStreet", period.Name, crossProfile, period.Start, period.End);

                var sharePeak = share
                    .Where(s => s.Minutes >= period.Start && s.Minutes < period.End && s.CrossTrafficPercent.HasValue)
                    .OrderByDescending(s => s.CrossTrafficPercent)
                    .ThenBy(s => s.Minutes)
                    .FirstOrDefault();

                if (sharePeak != null)
                {
                    result.Add(new TimeOfDayPeakEventDto
                    {
                        Label = "Cross-traffic percent peak",
                        Series = "CrossTrafficPercent",
                        Period = period.Name,
                        TimeOfDay = sharePeak.TimeOfDay,
                        Minutes = sharePeak.Minutes,
                        Value = sharePeak.CrossTrafficPercent!.Value,
                        ValueUnits = "%"
                    });
                }
            }

            return result;
        }

        private static void AddProfilePeak(
            List<TimeOfDayPeakEventDto> result,
            string label,
            string series,
            string period,
            TimeOfDayProfileDto profile,
            int start,
            int end)
        {
            var peak = profile.Points
                .Where(p => p.Minutes >= start && p.Minutes < end)
                .OrderByDescending(p => p.SmoothedVolume)
                .ThenBy(p => p.Minutes)
                .FirstOrDefault();

            if (peak == null)
            {
                return;
            }

            result.Add(new TimeOfDayPeakEventDto
            {
                Label = label,
                Series = series,
                Period = period,
                TimeOfDay = peak.TimeOfDay,
                Minutes = peak.Minutes,
                Value = peak.SmoothedVolume,
                ValueUnits = profile.Units
            });
        }

        private List<TimeOfDayCrossTrafficLocationDto> BuildCrossTrafficLocations(
            IReadOnlyList<TimeOfDayLocationAnalysisData> locationData,
            IReadOnlyList<string> crossDirections,
            IReadOnlyList<DateOnly> selectedDates,
            int binSizeMinutes,
            IReadOnlyList<TimeOfDayCrossTrafficSharePointDto> corridorShare)
        {
            var result = new List<TimeOfDayCrossTrafficLocationDto>();

            foreach (var period in Periods())
            {
                foreach (var location in locationData)
                {
                    var profile = profileService.BuildProfile(
                        $"{location.Location.LocationIdentifier} cross traffic",
                        string.Empty,
                        string.Empty,
                        string.Empty,
                        location.Observations
                            .Where(o => crossDirections.Contains(o.Direction, StringComparer.OrdinalIgnoreCase))
                            .ToList(),
                        selectedDates,
                        binSizeMinutes);
                    var peak = profile.Points
                        .Where(p => p.Minutes >= period.Start && p.Minutes < period.End)
                        .OrderByDescending(p => p.SmoothedVolume)
                        .ThenBy(p => p.Minutes)
                        .FirstOrDefault();

                    if (peak == null || peak.SmoothedVolume <= 0)
                    {
                        continue;
                    }

                    var corridorCrossVolume = corridorShare
                        .FirstOrDefault(s => s.Minutes == peak.Minutes)
                        ?.CrossStreetVolume ?? 0;

                    result.Add(new TimeOfDayCrossTrafficLocationDto
                    {
                        LocationIdentifier = location.Location.LocationIdentifier,
                        LocationDescription = location.LocationDescription,
                        Period = period.Name,
                        PeakTime = peak.TimeOfDay,
                        Minutes = peak.Minutes,
                        TotalVehiclesPerHour = peak.SmoothedVolume,
                        PercentOfCrossTraffic = corridorCrossVolume > 0
                            ? TimeOfDayProfileService.Round(peak.SmoothedVolume / corridorCrossVolume * 100)
                            : null
                    });
                }
            }

            return result
                .OrderBy(r => r.Period)
                .ThenByDescending(r => r.TotalVehiclesPerHour)
                .ToList();
        }

        private List<TimeOfDayMovementPressureDto> BuildMovementPressures(
            IReadOnlyList<TimeOfDayLocationAnalysisData> locationData,
            IReadOnlyList<DateOnly> selectedDates,
            int binSizeMinutes)
        {
            var result = new List<TimeOfDayMovementPressureDto>();
            var movementNames = new[] { "Left", "Thru", "Right" };

            foreach (var period in Periods().Where(p => p.Name is "AM" or "PM"))
            {
                foreach (var location in locationData)
                {
                    foreach (var movement in movementNames)
                    {
                        var profile = profileService.BuildProfile(
                            $"{location.Location.LocationIdentifier} {movement}",
                            string.Empty,
                            movement,
                            movement,
                            location.Observations
                                .Where(o => string.Equals(o.MovementLabel, movement, StringComparison.OrdinalIgnoreCase))
                                .ToList(),
                            selectedDates,
                            binSizeMinutes);
                        var peak = profile.Points
                            .Where(p => p.Minutes >= period.Start && p.Minutes < period.End)
                            .OrderByDescending(p => p.SmoothedVolume)
                            .ThenBy(p => p.Minutes)
                            .FirstOrDefault();

                        if (peak == null || peak.SmoothedVolume <= 0)
                        {
                            continue;
                        }

                        result.Add(new TimeOfDayMovementPressureDto
                        {
                            Period = period.Name,
                            LocationIdentifier = location.Location.LocationIdentifier,
                            Movement = movement,
                            MovementLabel = movement,
                            PeakTime = peak.TimeOfDay,
                            Volume = peak.SmoothedVolume
                        });
                    }
                }
            }

            return result
                .OrderBy(r => r.Period)
                .ThenByDescending(r => r.Volume)
                .ToList();
        }

        private string BuildReviewText(double? peakCrossTrafficPercent)
        {
            if (!peakCrossTrafficPercent.HasValue)
            {
                return "Cross-traffic review unavailable.";
            }

            if (peakCrossTrafficPercent.Value >= thresholds.ShoulderReviewThresholdPercent)
            {
                return $"Cross traffic reaches the shoulder-review threshold at {peakCrossTrafficPercent.Value:0.#}%.";
            }

            if (peakCrossTrafficPercent.Value >= thresholds.SplitReviewThresholdPercent)
            {
                return $"Cross traffic reaches the split-review threshold at {peakCrossTrafficPercent.Value:0.#}%.";
            }

            return $"Cross traffic remains below configured review thresholds at {peakCrossTrafficPercent.Value:0.#}%.";
        }

        private static string BuildSummaryText(
            TimeOfDayProfilePointDto primaryPeak,
            TimeOfDayProfilePointDto crossPeak,
            TimeOfDayCrossTrafficSharePointDto peakShare)
        {
            if (primaryPeak == null && crossPeak == null)
            {
                return "Split-pressure summary unavailable because no directional profile was found.";
            }

            return $"Primary peak {primaryPeak?.TimeOfDay ?? "unavailable"}; cross-street peak {crossPeak?.TimeOfDay ?? "unavailable"}; peak cross-traffic share {peakShare?.CrossTrafficPercent?.ToString("0.#") ?? "unavailable"}%.";
        }

        private static IReadOnlyList<(string Name, int Start, int End)> Periods()
        {
            return new List<(string Name, int Start, int End)>
            {
                ("AM", 5 * 60, 10 * 60),
                ("Midday", 10 * 60, 15 * 60),
                ("PM", 15 * 60, 19 * 60)
            };
        }
    }
}
