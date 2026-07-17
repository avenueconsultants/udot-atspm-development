#region license
// Copyright 2026 Utah Departement of Transportation
// for ApplicationTests - Utah.Udot.ATSPM.ApplicationTests.Business.TimeOfDay/TimeOfDayPlanScheduleServiceTests.cs
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
using Utah.Udot.Atspm.Data.Models.MeasureOptions;
using Xunit;

namespace Utah.Udot.ATSPM.ApplicationTests.Business.TimeOfDay
{
    public class TimeOfDayPlanScheduleServiceTests
    {
        [Fact]
        public void BuildCurrentSchedules_UsesAggregatedSignalTimingPlans()
        {
            var service = new TimeOfDayPlanScheduleService();
            var selectedDate = new DateOnly(2026, 1, 1);
            var dayStart = selectedDate.ToDateTime(TimeOnly.MinValue);
            var reportData = new TimeOfDayLocationReportData
            {
                Location = new Location { LocationIdentifier = "1001" }
            };
            reportData.SignalTimingPlans.AddRange(new[]
            {
                new SignalTimingPlan
                {
                    LocationIdentifier = "1001",
                    PlanNumber = 3,
                    Start = dayStart.AddHours(-1),
                    End = dayStart.AddHours(7)
                },
                new SignalTimingPlan
                {
                    LocationIdentifier = "1001",
                    PlanNumber = 7,
                    Start = dayStart.AddHours(7),
                    End = DateTime.MinValue
                }
            });

            var result = service.BuildCurrentSchedules(
                TimeOfDayDataSource.Aggregated,
                new List<TimeOfDayLocationReportData> { reportData },
                new List<DateOnly> { selectedDate },
                15);

            var schedule = result.LocationSchedules["1001"];

            Assert.True(result.HasPlanDataByLocation["1001"]);
            Assert.Equal(2, schedule.Count);
            Assert.Equal("3", schedule[0].PlanNumber);
            Assert.Equal(dayStart, schedule[0].Start);
            Assert.Equal(dayStart.AddHours(7), schedule[0].End);
            Assert.Equal("7", schedule[1].PlanNumber);
            Assert.Equal(dayStart.AddHours(7), schedule[1].Start);
            Assert.Equal(dayStart.AddDays(1), schedule[1].End);
            Assert.Empty(result.Comparison.ExceptionLocationIdentifiers);
        }
    }
}
