#region license
// Copyright 2026 Utah Departement of Transportation
// for ApplicationTests - Utah.Udot.ATSPM.ApplicationTests.Business.TimeOfDay/TimeOfDayServiceProfileTests.cs
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

using System;
using System.Collections.Generic;
using System.Linq;
using Utah.Udot.Atspm.Business.TimeOfDay;
using Utah.Udot.Atspm.Data.Models;
using Utah.Udot.Atspm.Data.Models.EventLogModels;
using Utah.Udot.Atspm.Data.Models.MeasureOptions;
using Xunit;

namespace Utah.Udot.ATSPM.ApplicationTests.Business.TimeOfDay
{
    public class TimeOfDayServiceProfileTests
    {
        private static readonly DateOnly TestDate = new(2026, 1, 1);

        [Fact]
        public void GetChartData_UsesMedianRepresentativeProfilesAcrossLocations()
        {
            var profileService = new TimeOfDayProfileService();
            var observationsByLocation = new Dictionary<string, List<TimeOfDayVolumeObservation>>
            {
                ["1001"] = new() { BuildObservation("1001", "Eastbound", 25) },
                ["1002"] = new() { BuildObservation("1002", "Eastbound", 75) },
                ["1003"] = new() { BuildObservation("1003", "Eastbound", 225) }
            };
            var service = new TimeOfDayService(
                new StubObservationService(observationsByLocation),
                profileService,
                new StubRecommendationService(),
                new TimeOfDayPlanScheduleService(),
                new TimeOfDayPlanProfileService(),
                new StubSplitPressureService());

            var result = service.GetChartData(
                new TimeOfDayOptions(),
                observationsByLocation.Keys.ToList(),
                new List<DateOnly> { TestDate },
                observationsByLocation.Keys
                    .Select(id => new TimeOfDayLocationReportData
                    {
                        Location = new Location { LocationIdentifier = id },
                        LocationDescription = id
                    })
                    .ToList(),
                new List<TimeOfDayWarningDto>());

            var corridorPoint = result.PlanProfile.CorridorProfile.Points.Single(p => p.Minutes == 480);
            var eastboundProfile = Assert.Single(result.PlanProfile.DirectionalProfiles);
            var eastboundPoint = eastboundProfile.Points.Single(p => p.Minutes == 480);

            Assert.Equal(300, corridorPoint.AverageVolume);
            Assert.Equal(300, eastboundPoint.AverageVolume);
        }

        private static TimeOfDayVolumeObservation BuildObservation(
            string locationIdentifier,
            string direction,
            double count)
        {
            return new TimeOfDayVolumeObservation(
                locationIdentifier,
                locationIdentifier,
                TestDate,
                480,
                direction,
                "Thru",
                "Thru",
                count);
        }

        private class StubObservationService : ITimeOfDayObservationService
        {
            private readonly IReadOnlyDictionary<string, List<TimeOfDayVolumeObservation>> observationsByLocation;

            public StubObservationService(
                IReadOnlyDictionary<string, List<TimeOfDayVolumeObservation>> observationsByLocation)
            {
                this.observationsByLocation = observationsByLocation;
            }

            public TimeOfDayObservationBuildResult BuildIndianaEventObservations(
                Location location,
                string locationDescription,
                IReadOnlyList<DateOnly> selectedDates,
                int binSizeMinutes,
                IReadOnlyList<IndianaEvent> indianaEvents)
            {
                return new TimeOfDayObservationBuildResult(
                    observationsByLocation[location.LocationIdentifier],
                    true);
            }

            public TimeOfDayObservationBuildResult BuildAggregatedObservations(
                Location location,
                string locationDescription,
                IReadOnlyList<DateOnly> selectedDates,
                int binSizeMinutes,
                IReadOnlyList<DetectorEventCountAggregation> aggregations)
            {
                return BuildIndianaEventObservations(
                    location,
                    locationDescription,
                    selectedDates,
                    binSizeMinutes,
                    new List<IndianaEvent>());
            }
        }

        private class StubRecommendationService : ITimeOfDayRecommendationService
        {
            public TimeOfDayRecommendationDto BuildRecommendation(
                TimeOfDayOptions options,
                TimeOfDayProfileDto corridorProfile,
                IReadOnlyList<TimeOfDayProfileDto> directionalProfiles,
                DateOnly representativeDate)
            {
                return new TimeOfDayRecommendationDto();
            }
        }

        private class StubSplitPressureService : ITimeOfDaySplitPressureService
        {
            public TimeOfDaySplitPressureDto BuildSplitPressure(
                TimeOfDayOptions options,
                IReadOnlyList<TimeOfDayProfileDto> directionalProfiles,
                IReadOnlyList<TimeOfDayLocationAnalysisData> locationData,
                IReadOnlyList<DateOnly> selectedDates,
                int binSizeMinutes)
            {
                return new TimeOfDaySplitPressureDto();
            }
        }
    }
}
