#region license
// Copyright 2026 Utah Departement of Transportation
// for ReportApiTests - ReportApiTests/TimeSpaceDiagramAverageReportServiceTests.cs
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

using System.Linq.Expressions;
using Moq;
using Utah.Udot.Atspm.Business.Common;
using Utah.Udot.Atspm.Business.TimeSpaceDiagram;
using Utah.Udot.Atspm.Data.Enums;
using Utah.Udot.Atspm.Data.Models;
using Utah.Udot.Atspm.Data.Models.EventLogModels;
using Utah.Udot.Atspm.Data.Models.MeasureOptions;
using Utah.Udot.Atspm.Repositories.AggregationRepositories;
using Utah.Udot.Atspm.Repositories.ConfigurationRepositories;
using Utah.Udot.Atspm.Repositories.EventLogRepositories;
using Utah.Udot.Atspm.ReportApi.ReportServices;

namespace ReportApiTests;

public class TimeSpaceDiagramAverageReportServiceTests
{
    private static readonly DateTime Start = new(2026, 4, 15, 16, 0, 0);

    [Fact]
    public async Task ExecuteAsync_FindsEarlierPhase5SplitWhenOtherPhasesHaveSplitsAtStart()
    {
        var splits = ValidSplits();
        splits.Single(e => e.EventCode == 138).Timestamp = Start.AddMinutes(-5);

        var results = await RunReport(splits);

        AssertSuccessfulBars(results);
    }

    [Theory]
    [InlineData(2, false, 44)]
    [InlineData(2, true, 50)]
    [InlineData(6, false, 44)]
    [InlineData(6, true, 50)]
    public async Task ExecuteAsync_SelectsLatestSplitAtOrBeforeStartForEachPhase(
        int phase,
        bool hasSplitAtStart,
        int expectedSplit)
    {
        var code = (short)(133 + phase);
        var splits = ValidSplits().Where(e => e.EventCode != code).ToList();
        splits.Add(Event(Start.AddMinutes(1), code, 99));
        splits.Add(Event(Start.AddMinutes(-10), code, 20));
        if (hasSplitAtStart)
        {
            splits.Add(Event(Start, code, 50));
        }
        splits.Add(Event(Start.AddMinutes(-5), code, 44));

        var results = await RunReport(splits);

        AssertSuccessfulBars(results);
        Assert.Equal(expectedSplit, results.Single(r => r.Result.PhaseNumber == phase).Result.ProgrammedSplit);
    }

    [Fact]
    public async Task ExecuteAsync_FindsEachPhasesEarlierSplitWithinTwelveHourLookback()
    {
        var splits = new List<IndianaEvent>
        {
            Event(Start.AddHours(-12), 134, 15),
            Event(Start.AddMinutes(-1), 135, 44),
            Event(Start.AddMinutes(-5), 138, 15),
            Event(Start.AddHours(-12), 139, 44)
        };

        var results = await RunReport(splits);

        AssertSuccessfulBars(results);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task ExecuteAsync_StillReportsMissingPhase5WhenNoEligibleSplitExists(bool hasFutureSplit)
    {
        var splits = ValidSplits().Where(e => e.EventCode != 138).ToList();
        if (hasFutureSplit)
        {
            splits.Add(Event(Start.AddMinutes(1), 138, 15));
        }

        var results = await RunReport(splits);

        Assert.Equal(2, results.Count);
        Assert.All(results, result =>
        {
            Assert.False(result.IsSuccess);
            Assert.Contains("Error grabbing program split for phase 5", result.Error);
        });
    }

    [Fact]
    public async Task ExecuteAsync_StillRequiresCoordinatedPhasesOwnSplit()
    {
        var splits = ValidSplits().Where(e => e.EventCode != 139).ToList();

        var results = await RunReport(splits);

        var primary = Assert.Single(results.Where(r => r.IsSuccess));
        Assert.Equal(2, primary.Result.PhaseNumber);
        var opposing = Assert.Single(results.Where(r => !r.IsSuccess));
        Assert.Contains("Error grabbing program split for phase 6", opposing.Error);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task ExecuteAsync_StillReportsMissingProgramSplitsWhenNoneExistAtOrBeforeStart(bool hasFutureSplits)
    {
        var splits = hasFutureSplits ? ValidSplits() : new List<IndianaEvent>();
        foreach (var split in splits)
        {
            split.Timestamp = Start.AddMinutes(1);
        }

        var exception = await Assert.ThrowsAsync<NullReferenceException>(() => RunReport(splits));

        Assert.Equal("Error grabbing Program Splits", exception.Message);
    }

    private static void AssertSuccessfulBars(List<TimeSpaceDiagramAveragePhaseResult> results)
    {
        Assert.Equal(2, results.Count);
        Assert.All(results, result =>
        {
            Assert.True(result.IsSuccess, result.Error);
            Assert.NotEmpty(result.Result.CycleAllEvents);
            Assert.Equal(90, result.Result.CycleLength);
            Assert.Equal(0, result.Result.Offset);
        });
    }

    private static List<IndianaEvent> ValidSplits() => new()
    {
        Event(Start, 134, 15), Event(Start, 135, 44),
        Event(Start, 138, 15), Event(Start, 139, 44)
    };

    private static async Task<List<TimeSpaceDiagramAveragePhaseResult>> RunReport(List<IndianaEvent> splits)
    {
        var location = new Location { LocationIdentifier = "1001" };
        var north = new DirectionType { Id = DirectionTypes.NB, Abbreviation = "NB" };
        var south = new DirectionType { Id = DirectionTypes.SB, Abbreviation = "SB" };
        location.Approaches.Add(new Approach
        {
            Id = 1, ProtectedPhaseNumber = 2, DirectionType = north, Location = location, Mph = 35
        });
        location.Approaches.Add(new Approach
        {
            Id = 2, ProtectedPhaseNumber = 6, DirectionType = south, Location = location, Mph = 35
        });
        var routeLocation = new RouteLocation
        {
            RouteId = 1,
            LocationIdentifier = location.LocationIdentifier,
            PrimaryPhase = 2,
            OpposingPhase = 6,
            PrimaryDirection = north,
            OpposingDirection = south,
            NextLocationDistance = new RouteDistance { Distance = 100 }
        };
        var routeLocations = new Mock<IRouteLocationsRepository>();
        routeLocations.Setup(r => r.GetList()).Returns(new[] { routeLocation }.AsQueryable());
        var routes = new Mock<IRouteRepository>();
        routes.Setup(r => r.GetList()).Returns(new[] { new Route { Id = 1, Name = "Test route" } }.AsQueryable());
        var locations = new Mock<ILocationRepository>();
        locations.Setup(r => r.GetLatestVersionOfLocation("1001")).Returns(location);
        var plans = new Mock<ISignalTimingPlanRepository>();
        plans.Setup(r => r.GetListAsync(It.IsAny<Expression<Func<SignalTimingPlan, bool>>>()))
            .ReturnsAsync(new List<SignalTimingPlan>());
        var events = new List<IndianaEvent>(splits)
        {
            Event(Start, 131, 1),
            Event(Start.AddMinutes(-10), 132, 90),
            Event(Start.AddMinutes(-10), 133, 0)
        };
        foreach (short phase in new short[] { 2, 6 })
        {
            events.AddRange(new[]
            {
                Event(Start, 1, phase),
                Event(Start.AddSeconds(40), 8, phase),
                Event(Start.AddSeconds(44), 9, phase),
                Event(Start.AddSeconds(47), 11, phase),
                Event(Start.AddSeconds(90), 1, phase)
            });
        }
        var eventRepository = new Mock<IIndianaEventLogRepository>();
        eventRepository.Setup(r => r.GetEventsBetweenDates("1001", It.IsAny<DateTime>(), It.IsAny<DateTime>()))
            .Returns((string id, DateTime start, DateTime end) => events
                .Where(e => e.Timestamp >= start && e.Timestamp < end)
                .OrderBy(e => e.Timestamp)
                .ToList());
        var service = new TimeSpaceDiagramAverageReportService(
            eventRepository.Object,
            locations.Object,
            new PhaseService(),
            routeLocations.Object,
            new PlanService(plans.Object),
            new TimeSpaceAverageService(new CycleService()),
            routes.Object);
        var options = new TimeSpaceDiagramAverageOptions
        {
            RouteId = 1,
            StartDate = DateOnly.FromDateTime(Start),
            EndDate = DateOnly.FromDateTime(Start),
            StartTime = TimeOnly.FromDateTime(Start),
            EndTime = TimeOnly.FromDateTime(Start.AddMinutes(20)),
            DaysOfWeek = new[] { (int)Start.DayOfWeek },
            Sequence = new List<LocationWithSequence>
            {
                new()
                {
                    LocationIdentifier = "1001",
                    Sequence = new[] { new[] { 1, 2, 3, 4 }, new[] { 5, 6, 7, 8 } }
                }
            },
            CoordinatedPhases = new List<LocationWithCoordPhases>
            {
                new() { LocationIdentifier = "1001", CoordinatedPhases = new[] { 2, 6 } }
            }
        };

        return (await service.ExecuteAsync(options, null, default)).ToList();
    }

    private static IndianaEvent Event(DateTime timestamp, short code, short value) => new()
    {
        LocationIdentifier = "1001", Timestamp = timestamp, EventCode = code, EventParam = value
    };
}
