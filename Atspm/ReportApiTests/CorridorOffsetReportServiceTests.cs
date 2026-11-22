using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Utah.Udot.Atspm.Business.CorridorOffsets;
using Utah.Udot.Atspm.Data;
using Utah.Udot.Atspm.Data.Enums;
using Utah.Udot.Atspm.Data.Models;
using Utah.Udot.Atspm.Data.Models.EventLogModels;
using Utah.Udot.Atspm.Infrastructure.Repositories.ConfigurationRepositories;
using Utah.Udot.Atspm.ReportApi.Controllers;
using Utah.Udot.Atspm.ReportApi.ReportServices;
using Utah.Udot.Atspm.Repositories.ConfigurationRepositories;
using Utah.Udot.Atspm.Repositories.EventLogRepositories;

namespace ReportApiTests;

public sealed class CorridorOffsetReportServiceTests
{
    private static readonly DateTime Start = new(2026, 11, 20, 16, 0, 0);

    [Fact]
    public async Task ReportSeedsOnlyAtEntrancesAndLocksObservedDepartures()
    {
        await using var db = await CreateRoute();
        var controller = CreateController(db, (_, second) => BuildEvents(60, second));
        var response = await controller.GetReportData(Options(), default);

        var result = Assert.IsType<CorridorResult>(Assert.IsType<OkObjectResult>(response.Result).Value);
        Assert.Equal(2, result.Existing.Directions.Count);
        Assert.Equal(2, result.Existing.Directions[0].Vehicles);
        Assert.Equal(1, result.Existing.Directions[1].Vehicles);
        Assert.False(result.Signals[0].Locked);
        Assert.True(result.Signals[1].Locked);
        Assert.Equal(0, result.Proposed.Shifts[1]);
        Assert.Contains(result.Notes, note => note.Contains("35 mph fallback"));
    }

    [Fact]
    public async Task ReportRejectsMixedCyclesAndIdentifiesTheObservedCycleLengths()
    {
        await using var db = await CreateRoute();
        var controller = CreateController(db, (_, second) => BuildEvents(second ? 90 : 60, second));
        var response = await controller.GetReportData(Options(), default);

        var problem = Assert.IsType<BadRequestObjectResult>(response.Result);
        Assert.Contains("different cycle lengths (60, 90 seconds)", Assert.IsType<string>(problem.Value));
    }

    [Fact]
    public async Task ReportRejectsMissingControllerLogsBeforeRecommendingOffsets()
    {
        await using var db = await CreateRoute();
        var controller = CreateController(db, (_, second) => second ? [] : BuildEvents(60, false));
        var response = await controller.GetReportData(Options(), default);

        var problem = Assert.IsType<BadRequestObjectResult>(response.Result);
        Assert.Contains("Signal B has no controller events", Assert.IsType<string>(problem.Value));
    }

    [Fact]
    public async Task ReportRejectsAChangeInPlanInsideTheScoredWindow()
    {
        await using var db = await CreateRoute();
        var controller = CreateController(db, (_, second) => second
            ? [.. BuildEvents(60, true), Event(35, IndianaEnumerations.CoordPatternChange, 8)]
            : BuildEvents(60, false));
        var response = await controller.GetReportData(Options(), default);

        var problem = Assert.IsType<BadRequestObjectResult>(response.Result);
        Assert.Contains("Signal B changes CoordPatternChange", Assert.IsType<string>(problem.Value));
    }

    [Fact]
    public async Task ReportDoesNotClearQueuedVehiclesUnderTheNextTimingPlan()
    {
        await using var db = await CreateRoute();
        var controller = CreateController(db, (_, second) => second
            ? BuildEvents(60, true)
            : [.. BuildEvents(60, false), Event(110, IndianaEnumerations.VehicleDetectorOn, 30),
                Event(120, IndianaEnumerations.CoordPatternChange, 8)]);
        var response = await controller.GetReportData(Options(), default);

        var problem = Assert.IsType<BadRequestObjectResult>(response.Result);
        Assert.Contains("do not cover the time needed to clear existing traffic", Assert.IsType<string>(problem.Value));
    }

    private static CorridorOffsetOptions Options() => new()
    {
        RouteId = 220, Start = Start, End = Start.AddMinutes(2), MaxShift = 10,
        CompareLinkPivot = false, SpeedLimit = 35
    };

    private static async Task<ConfigContext> CreateRoute()
    {
        var options = new DbContextOptionsBuilder<ConfigContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options;
        var db = new ConfigContext(options);
        var a = new RouteLocation
        {
            Id = 1, RouteId = 220, LocationIdentifier = "A", Order = 1,
            PrimaryPhase = 2, OpposingPhase = 6, PrimaryDirectionId = DirectionTypes.EB,
            OpposingDirectionId = DirectionTypes.WB,
            NextLocationDistance = new RouteDistance { LocationIdentifierA = "A", LocationIdentifierB = "B", Distance = 500 }
        };
        var b = new RouteLocation
        {
            Id = 2, RouteId = 220, LocationIdentifier = "B", Order = 2, PrimaryPhase = 2,
            OpposingPhase = 6, PrimaryDirectionId = DirectionTypes.EB, OpposingDirectionId = DirectionTypes.WB
        };
        db.Set<RouteLocation>().AddRange(a, b);
        await db.SaveChangesAsync();
        return db;
    }

    private static CorridorOffsetsController CreateController(ConfigContext db,
        Func<string, bool, IReadOnlyList<IndianaEvent>> logs)
    {
        var locations = new Mock<ILocationRepository>();
        locations.Setup(repo => repo.GetLatestVersionOfLocation(It.IsAny<string>(), Start))
            .Returns((string id, DateTime _) => new Location
            {
                LocationIdentifier = id, PrimaryName = id, SecondaryName = "Corridor",
                Approaches =
                [
                    ApproachWithDetector(2, DirectionTypes.EB, id == "A" ? 25 : null, 30, true),
                    ApproachWithDetector(6, DirectionTypes.WB, 30, 60, id == "A")
                ]
            });
        var events = new Mock<IIndianaEventLogRepository>();
        events.Setup(repo => repo.GetEventsBetweenDates(It.IsAny<string>(), It.IsAny<DateTime>(), It.IsAny<DateTime>()))
            .Returns((string id, DateTime _, DateTime _) => logs(id, id == "B"));
        var routeLocations = new RouteLocationEFRepository(db, NullLogger<RouteLocationEFRepository>.Instance);
        var service = new CorridorOffsetReportService(routeLocations, locations.Object, events.Object,
            null!, NullLogger<CorridorOffsetReportService>.Instance);
        return new CorridorOffsetsController(service);
    }

    private static Approach ApproachWithDetector(int phase, DirectionTypes direction, int? speed, int channel, bool advance)
        => new()
        {
            ProtectedPhaseNumber = phase, DirectionTypeId = direction, Mph = speed,
            DirectionType = new DirectionType { Abbreviation = direction.ToString() },
            Detectors = [new Detector
            {
                DetectorChannel = channel, LaneNumber = 1, MovementType = MovementTypes.T,
                DistanceFromStopBar = advance ? 100 : 0, DateAdded = Start.AddYears(-1),
                DetectionTypes = [new DetectionType { Id = advance ? DetectionTypes.AC : DetectionTypes.LLC }]
            }]
        };

    private static IReadOnlyList<IndianaEvent> BuildEvents(int cycle, bool second)
    {
        var events = new List<IndianaEvent>
        {
            Event(-500, IndianaEnumerations.CoordPatternChange, 2),
            Event(-500, IndianaEnumerations.CycleLengthChange, cycle),
            Event(-500, IndianaEnumerations.OffsetLengthChange, 0)
        };
        for (var time = -4 * cycle; time < 600; time += cycle)
        {
            foreach (var phase in new[] { 2, 6 })
            {
                events.Add(Event(time, IndianaEnumerations.PhaseBeginGreen, phase));
                events.Add(Event(time + 40, IndianaEnumerations.PhaseBeginYellowChange, phase));
            }
        }
        events.Add(Event(1, IndianaEnumerations.VehicleDetectorOn, 30));
        events.Add(Event(4, IndianaEnumerations.VehicleDetectorOn, 30));
        events.Add(Event(5, IndianaEnumerations.VehicleDetectorOn, 60));
        if (second)
            events.Add(Event(45, IndianaEnumerations.VehicleDetectorOn, 60));
        return events;
    }

    private static IndianaEvent Event(int seconds, IndianaEnumerations code, int parameter)
        => new() { Timestamp = Start.AddSeconds(seconds), EventCode = (short)code, EventParam = (short)parameter };
}
