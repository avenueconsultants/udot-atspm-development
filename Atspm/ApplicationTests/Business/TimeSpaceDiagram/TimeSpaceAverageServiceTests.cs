#region license
// Copyright 2026 Utah Departement of Transportation
// for ApplicationTests - Utah.Udot.ATSPM.ApplicationTests.Business.TimeSpaceDiagram/TimeSpaceAverageServiceTests.cs
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
using Utah.Udot.Atspm.Business.Common;
using Utah.Udot.Atspm.Business.TimeSpaceDiagram;
using Utah.Udot.Atspm.Data.Models;
using Utah.Udot.Atspm.Data.Models.EventLogModels;
using Utah.Udot.Atspm.Data.Models.MeasureOptions;
using Xunit;

namespace Utah.Udot.ATSPM.ApplicationTests.Business.TimeSpaceDiagram
{
    public class TimeSpaceAverageServiceTests
    {
        private static readonly DateTime Start = new(2026, 4, 15, 16, 0, 0);

        [Fact]
        public void GetChartData_RepeatsRedClearanceFromMedianGreenCycle()
        {
            var events = BuildEvents((20, 1), (40, 3), (60, 2));
            events.Add(Event(135, 11, phase: 6));
            events = events.OrderBy(e => e.Timestamp).ToList();
            var originalEvents = events.ToArray();

            var result = GetChartData(events);

            Assert.NotEmpty(result.CycleAllEvents);
            foreach (var cycle in result.CycleAllEvents.Chunk(4))
            {
                Assert.Equal(new[] { 1, 8, 9, 11 }, cycle.Select(e => e.Value));
                Assert.Equal(40, (cycle[1].Start - cycle[0].Start).TotalSeconds);
                Assert.Equal(4, (cycle[2].Start - cycle[1].Start).TotalSeconds);
                Assert.Equal(3, (cycle[3].Start - cycle[2].Start).TotalSeconds);
            }

            var greens = result.CycleAllEvents.Where(e => e.Value == 1).ToList();
            Assert.True(greens.Count > 1);
            for (var i = 1; i < greens.Count; i++)
            {
                Assert.Equal(90, (greens[i].Start - greens[i - 1].Start).TotalSeconds);
            }
            Assert.Equal(originalEvents, events);
        }

        [Fact]
        public void GetChartData_KeepsBarsWhenMedianCycleHasNoRedClearanceEvent()
        {
            var result = GetChartData(BuildEvents((20, 1), (40, null), (60, 2)));

            AssertBarsWithoutRedClearance(result);
            var firstGreen = result.CycleAllEvents.First(e => e.Value == 1);
            var firstYellow = result.CycleAllEvents.First(e => e.Value == 8);
            Assert.Equal(40, (firstYellow.Start - firstGreen.Start).TotalSeconds);
        }

        [Fact]
        public void GetChartData_DoesNotUseAnotherPhasesRedClearanceEvent()
        {
            var events = BuildEvents((40, null));
            events.Add(Event(47, 11, phase: 6));

            AssertBarsWithoutRedClearance(GetChartData(events.OrderBy(e => e.Timestamp).ToList()));
        }

        [Theory]
        [InlineData(-1)]
        [InlineData(46)]
        [InlineData(47)]
        public void GetChartData_IgnoresRedClearanceEventsOutsideSelectedCyclesRedInterval(
            double redClearanceSeconds)
        {
            var result = GetChartData(BuildEvents((40, redClearanceSeconds)));

            AssertBarsWithoutRedClearance(result);
        }

        [Theory]
        [InlineData(46, false)]
        [InlineData(47, false)]
        [InlineData(48, true)]
        public void GetChartData_OnlyEmitsRedClearanceBeforeGeneratedCyclesNextGreen(
            int cycleLength,
            bool expectRedClearance)
        {
            var result = GetChartData(BuildEvents((40, 3)), cycleLength);

            Assert.NotEmpty(result.CycleAllEvents);
            Assert.Equal(expectRedClearance, result.CycleAllEvents.Any(e => e.Value == 11));
            var eventsPerCycle = expectRedClearance ? 4 : 3;
            foreach (var cycle in result.CycleAllEvents.Chunk(eventsPerCycle))
            {
                if (expectRedClearance)
                {
                    Assert.Equal(3, (cycle[3].Start - cycle[2].Start).TotalSeconds);
                    Assert.True(cycle[3].Start < cycle[0].Start.AddSeconds(cycleLength));
                }
            }
        }

        [Fact]
        public void GetChartData_KeepsEmptyBarsWhenNoCompleteCycleExists()
        {
            var events = new List<IndianaEvent>
            {
                Event(0, 1), Event(44, 9), Event(47, 11), Event(90, 1)
            };

            var result = GetChartData(events);

            Assert.Empty(result.CycleAllEvents);
            Assert.Empty(result.GreenTimeEvents);
        }

        [Fact]
        public void GetChartData_DoesNotUsePhaseEvent11ForAnOverlapWithTheSameNumber()
        {
            var events = new List<IndianaEvent>
            {
                Event(0, 61), Event(40, 63), Event(44, 64), Event(47, 11), Event(90, 61)
            };

            AssertBarsWithoutRedClearance(GetChartData(events, useOverlap: true));
        }

        private static void AssertBarsWithoutRedClearance(TimeSpaceDiagramAverageResult result)
        {
            Assert.NotEmpty(result.CycleAllEvents);
            foreach (var cycle in result.CycleAllEvents.Chunk(3))
            {
                Assert.Equal(new[] { 1, 8, 9 }, cycle.Select(e => e.Value));
            }
        }

        private static TimeSpaceDiagramAverageResult GetChartData(
            List<IndianaEvent> events,
            int cycleLength = 90,
            bool useOverlap = false)
        {
            var options = new TimeSpaceDiagramAverageOptions
            {
                StartDate = DateOnly.FromDateTime(Start),
                EndDate = DateOnly.FromDateTime(Start),
                StartTime = TimeOnly.FromDateTime(Start),
                EndTime = TimeOnly.FromDateTime(Start.AddMinutes(5))
            };
            var phase = new PhaseDetail
            {
                PhaseNumber = 2,
                UseOverlap = useOverlap,
                Approach = new Approach
                {
                    Id = 1,
                    ProtectedPhaseNumber = 2,
                    IsProtectedPhaseOverlap = useOverlap,
                    Mph = 35,
                    Location = new Location { LocationIdentifier = "1001" },
                    DirectionType = new DirectionType { Abbreviation = "NB" }
                }
            };
            var programSplits = new List<IndianaEvent>
            {
                Event(0, 134, 15), Event(0, 135, 44),
                Event(0, 138, 15), Event(0, 139, 44)
            };

            return new TimeSpaceAverageService(new CycleService()).GetChartData(
                options,
                phase,
                events,
                new[] { new[] { 1, 2, 3, 4 }, new[] { 5, 6, 7, 8 } },
                new[] { 2, 6 },
                programSplits,
                offset: 0,
                cycleLength: cycleLength,
                distanceToNextLocation: 100,
                distanceToPreviousLocation: 100,
                isLastElement: false,
                isCoordPhasesMatchRoutePhases: true);
        }

        private static List<IndianaEvent> BuildEvents(
            params (double GreenSeconds, double? RedClearanceSeconds)[] cycles)
        {
            var events = new List<IndianaEvent>();
            for (var i = 0; i < cycles.Length; i++)
            {
                var startSeconds = i * 90;
                var redSeconds = startSeconds + cycles[i].GreenSeconds + 4;
                events.Add(Event(startSeconds, 1));
                events.Add(Event(startSeconds + cycles[i].GreenSeconds, 8));
                events.Add(Event(redSeconds, 9));
                if (cycles[i].RedClearanceSeconds.HasValue)
                {
                    events.Add(Event(redSeconds + cycles[i].RedClearanceSeconds.Value, 11));
                }
            }
            events.Add(Event(cycles.Length * 90, 1));
            return events.OrderBy(e => e.Timestamp).ToList();
        }

        private static IndianaEvent Event(double seconds, short code, short phase = 2)
        {
            return new IndianaEvent
            {
                LocationIdentifier = "1001",
                Timestamp = Start.AddSeconds(seconds),
                EventCode = code,
                EventParam = phase
            };
        }
    }
}
