using System.Text;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Utah.Udot.Atspm.ConfigApi.Services.ConfigReview;
using Utah.Udot.Atspm.Data;
using Utah.Udot.Atspm.Data.Enums;
using Utah.Udot.Atspm.Data.Models;
using Utah.Udot.Atspm.Infrastructure.Repositories.ConfigurationRepositories;
using Xunit;
using Xunit.Abstractions;
using Assert = Xunit.Assert;

namespace ConfigApiTests;

/// <summary>
/// The service against one real intersection, to check it reaches the same conclusions the
/// external review scripts did.
///
/// Location 7423 on route R2:192 is the case worth pinning: ATSPM declares two through
/// approaches and two detectors, while the cabinet runs eight phases, assigns sixteen detectors,
/// programs pedestrian movements on four phases, and puts channels 18 and 20 on the opposite
/// phases from the ones ATSPM has them on. The external audit found six undeclared phases, four
/// undeclared pedestrian phases, fourteen assigned-but-undeclared channels and two on a different
/// phase; this asserts the service finds the same.
/// </summary>
public class ConfigurationReviewCorridorTests(ITestOutputHelper output)
{
    private static readonly DateTime VersionStart = new(2021, 7, 1);
    private static readonly DateOnly AnalysisDate = new(2026, 11, 18);

    [Fact]
    public async Task SevenFourTwoThreeReachesTheSameFindingsAsTheExternalAudit()
    {
        await using var fixture = await Corridor.Create();
        var entry = Assert.Single(await fixture.Service.Create(new("7423", null, AnalysisDate), "editor", default));
        var loaded = await fixture.Service.Load(entry.Id, default);

        // Load is what the page draws before any controller file arrives, so it has to carry
        // everything ATSPM knows: the phase, whether that number is a phase or an overlap, the
        // direction, and the detectors on it. Anything missing here is a blank section on screen.
        Assert.Equal(VersionStart, loaded.Start);
        Assert.Equal([(2, DirectionTypes.WB, 18), (6, DirectionTypes.EB, 20)],
            loaded.Approaches.Select(ap => (ap.Phase, (DirectionTypes)ap.Direction,
                Assert.Single(ap.Detectors).Channel)).OrderBy(ap => ap.Phase).ToArray());
        Assert.All(loaded.Approaches, ap => Assert.False(ap.Overlap));
        Assert.All(loaded.Approaches, ap => Assert.Equal((int)MovementTypes.T,
            Assert.Single(ap.Detectors).Movement));
        await using (var stream = new MemoryStream(Encoding.UTF8.GetBytes(Snapshot)))
            await fixture.Service.Upload(entry.Id, "7423-snapshot.json", stream, true, default);
        var report = await fixture.Service.Report(entry.Id, default);

        foreach (var group in report.Items.GroupBy(item => item.Field.Split('.')[0]).OrderBy(g => g.Key))
        {
            output.WriteLine($"{group.Key}: {group.Count()}");
            foreach (var item in group.OrderBy(i => i.Field))
                output.WriteLine($"    {item.Field,-34} {item.Classification,-15} {item.Summary}");
        }

        // Six phases the cabinet runs that no approach declares: everything but 2 and 6.
        var undeclared = report.Items
            .Where(item => item.Field.StartsWith("approaches.") && item.Classification == "NeedsDirection")
            .Select(item => int.Parse(item.Field.Split('.')[1])).OrderBy(phase => phase).ToArray();
        Assert.Equal([1, 3, 4, 5, 7, 8], undeclared);

        // Four pedestrian movements programmed and declared nowhere, each promotable once an
        // approach is named.
        var pedestrian = report.Items
            .Where(item => item.Field.StartsWith("pedestrian."))
            .Select(item => int.Parse(item.Field.Split('.')[1])).OrderBy(phase => phase).ToArray();
        Assert.Equal([2, 4, 6, 8], pedestrian);
        Assert.All(report.Items.Where(item => item.Field.StartsWith("pedestrian.")),
            item => Assert.Equal("NeedsDirection", item.Classification));

        // Channels the cabinet assigns a phase and ATSPM does not declare at all: sixteen
        // assigned, less channels 18 and 20, which ATSPM does declare.
        var callPhase = report.Items
            .Where(item => item.Field.StartsWith("detectors.") && item.Field.EndsWith(".callPhase"))
            .ToDictionary(item => int.Parse(item.Field.Split('.')[1]), item => item.Classification);
        Assert.Equal(16, callPhase.Count);
        Assert.Equal(14, callPhase.Count(entry => entry.Key is not (18 or 20)));

        // The two ATSPM declares, each on the other's phase. The cabinet settles the phase; which
        // ATSPM field is wrong needs the direction no controller records, so these are findings
        // rather than corrections - and the summary has to say ATSPM holds a different phase,
        // because "needs an approach assignment" would read as a channel nobody had got to yet.
        Assert.Equal("NeedsDirection", callPhase[18]);
        Assert.Equal("NeedsDirection", callPhase[20]);
        var swapped = report.Items.Single(item => item.Field == "detectors.18.callPhase");
        Assert.Contains("calls phase 6 in the controller", swapped.Summary);
        Assert.Contains("ATSPM has it on phase 2", swapped.Summary);
        Assert.Equal("[2]", swapped.BaselineValue);

        // A controller zero against a field ATSPM never stored is not a discrepancy: phases 1, 3, 5
        // and 7 are left turns with no pedestrian movement, and no maximum two is programmed
        // anywhere here.
        Assert.DoesNotContain(report.Items, item => item.Field == "phases.1.walk");
        Assert.DoesNotContain(report.Items, item => item.Field == "phases.1.maxGreen2");
        Assert.DoesNotContain(report.Items, item => item.Field == "detectors.18.delay");
        Assert.All(report.Items.Where(item => item.Classification == "Certain" && item.BaselineValue == "null"),
            item => Assert.Contains("ATSPM stores nothing for this field", item.Summary));

        // Nothing is promoted by a comparison.
        Assert.Equal("Reviewed", report.Review.Status);
        Assert.Empty(report.Promotions);
        Assert.All(report.Items, item => Assert.Equal("Pending", item.Disposition));

        // Groups no source could fill produce no findings at all, rather than empty ones.
        Assert.DoesNotContain(report.Items, item => item.Field.StartsWith("overlaps."));
        Assert.DoesNotContain(report.Items, item => item.Field.StartsWith("patterns."));
        Assert.DoesNotContain(report.Items, item => item.Field.StartsWith("splitTables."));
        Assert.DoesNotContain(report.Items, item => item.Field == "configWrittenAt");

        // Phase timing the cabinet holds and ATSPM has nowhere to store: eight phases of it.
        var timing = report.Items.Count(item => item.Field.StartsWith("phases.") && item.Group == "phaseTiming");
        output.WriteLine($"phase timing fields carried across: {timing}");
        output.WriteLine($"total findings: {report.Items.Count} " +
            $"({string.Join(", ", report.Items.GroupBy(i => i.Classification).Select(g => $"{g.Key} {g.Count()}"))})");
        Assert.True(timing >= 8 * 5, $"expected at least five timing fields for each of eight phases, got {timing}");
    }

    private sealed class Corridor(SqliteConnection connection, ConfigContext db) : IAsyncDisposable
    {
        public ConfigReviewService Service { get; } = new(db,
            new LocationEFRepository(db, NullLogger<LocationEFRepository>.Instance),
            new ApproachEFRepository(db, NullLogger<ApproachEFRepository>.Instance),
            new DetectorEFRepository(db, NullLogger<DetectorEFRepository>.Instance),
            new DeviceEFRepository(db, NullLogger<DeviceEFRepository>.Instance));

        public static async Task<Corridor> Create()
        {
            var connection = new SqliteConnection("Data Source=:memory:");
            await connection.OpenAsync();
            var db = new ConfigContext(new DbContextOptionsBuilder<ConfigContext>().UseSqlite(connection).Options);
            await db.Database.EnsureCreatedAsync();
            if (!await db.LocationTypes.AnyAsync(entry => entry.Id == 1))
                db.LocationTypes.Add(new LocationType { Id = 1, Name = "Signal", Icon = "signal" });
            if (!await db.DirectionTypes.AnyAsync(entry => entry.Id == DirectionTypes.WB))
                db.DirectionTypes.Add(new DirectionType { Id = DirectionTypes.WB, Description = "Westbound", Abbreviation = "WB" });
            if (!await db.DirectionTypes.AnyAsync(entry => entry.Id == DirectionTypes.EB))
                db.DirectionTypes.Add(new DirectionType { Id = DirectionTypes.EB, Description = "Eastbound", Abbreviation = "EB" });
            db.Jurisdictions.Add(new Jurisdiction { Id = 1, Name = "UDOT" });

            // 7423 as ATSPM has it: two through approaches, one advance detector each.
            db.Locations.Add(new Location
            {
                LocationIdentifier = "7423", PrimaryName = "9000 S (SR-209)", SecondaryName = "Bangerter",
                Start = VersionStart, LocationTypeId = 1, JurisdictionId = 1,
                VersionAction = LocationVersionActions.Initial,
                Approaches =
                [
                    new Approach
                    {
                        Description = "WBT Ph2", DirectionTypeId = DirectionTypes.WB,
                        ProtectedPhaseNumber = 2, IsProtectedPhaseOverlap = false, Mph = 40,
                        Detectors =
                        [
                            new Detector
                            {
                                DectectorIdentifier = "742318", DetectorChannel = 18, LaneNumber = 1,
                                MovementType = MovementTypes.T, LaneType = LaneTypes.V,
                                DetectionHardware = DetectionHardwareTypes.WavetronixAdvance,
                                DistanceFromStopBar = 350, DateAdded = VersionStart
                            }
                        ]
                    },
                    new Approach
                    {
                        Description = "EBT Ph6", DirectionTypeId = DirectionTypes.EB,
                        ProtectedPhaseNumber = 6, IsProtectedPhaseOverlap = false, Mph = 40,
                        Detectors =
                        [
                            new Detector
                            {
                                DectectorIdentifier = "742320", DetectorChannel = 20, LaneNumber = 1,
                                MovementType = MovementTypes.T, LaneType = LaneTypes.V,
                                DetectionHardware = DetectionHardwareTypes.WavetronixAdvance,
                                DistanceFromStopBar = 400, DateAdded = VersionStart
                            }
                        ]
                    }
                ]
            });
            await db.SaveChangesAsync();
            return new Corridor(connection, db);
        }

        public async ValueTask DisposeAsync()
        {
            await db.DisposeAsync();
            await connection.DisposeAsync();
        }
    }

    /// <summary>
    /// 7423 read over NTCIP. Overlaps, patterns, split tables and sequences are declared
    /// unavailable because that read did not carry them, which is the case `unavailable` exists
    /// for. callPhase is mapped from the column the controller answered on: NTCIP names it
    /// switchPhase, and the contract compares on callPhase.
    /// </summary>
    private const string Snapshot = """
    {"schemaVersion":1,"locationIdentifier":"7423","make":"Econolite","model":"Cobalt",
    "firmware":{"text":"ASC3 Actuated Controller","version":null},
    "collectedAt":"2026-11-26T15:30:00Z",
    "sources":[{"kind":"ntcip","name":"7423","decoder":"external:ntcip_read.py",
     "groups":["phases","phaseStructure","phaseTiming","detectors"]}],
    "phases":[
      {"phase":1,"inUse":true,"ring":1,"concurrent":[5,6],"minGreen":5,"passage":1.8,"maxGreen1":15,"maxGreen2":0,"yellowChange":3.8,"redClear":1.5,"walk":0,"pedClear":0,"source":"ntcip:phase.1"},
      {"phase":2,"inUse":true,"ring":1,"concurrent":[5,6],"minGreen":15,"passage":1.6,"maxGreen1":40,"maxGreen2":0,"yellowChange":4.8,"redClear":1.5,"walk":7,"pedClear":18,"source":"ntcip:phase.2"},
      {"phase":3,"inUse":true,"ring":1,"concurrent":[7,8],"minGreen":5,"passage":1.8,"maxGreen1":15,"maxGreen2":0,"yellowChange":3.0,"redClear":1.8,"walk":0,"pedClear":0,"source":"ntcip:phase.3"},
      {"phase":4,"inUse":true,"ring":1,"concurrent":[7,8],"minGreen":5,"passage":1.4,"maxGreen1":25,"maxGreen2":0,"yellowChange":4.3,"redClear":1.8,"walk":7,"pedClear":21,"source":"ntcip:phase.4"},
      {"phase":5,"inUse":true,"ring":2,"concurrent":[1,2],"minGreen":5,"passage":1.8,"maxGreen1":15,"maxGreen2":0,"yellowChange":3.4,"redClear":1.5,"walk":0,"pedClear":0,"source":"ntcip:phase.5"},
      {"phase":6,"inUse":true,"ring":2,"concurrent":[1,2],"minGreen":15,"passage":1.6,"maxGreen1":40,"maxGreen2":0,"yellowChange":4.8,"redClear":1.5,"walk":7,"pedClear":11,"source":"ntcip:phase.6"},
      {"phase":7,"inUse":true,"ring":2,"concurrent":[3,4],"minGreen":5,"passage":1.8,"maxGreen1":15,"maxGreen2":0,"yellowChange":3.4,"redClear":2.8,"walk":0,"pedClear":0,"source":"ntcip:phase.7"},
      {"phase":8,"inUse":true,"ring":2,"concurrent":[3,4],"minGreen":5,"passage":1.4,"maxGreen1":25,"maxGreen2":0,"yellowChange":4.3,"redClear":2.8,"walk":7,"pedClear":24,"source":"ntcip:phase.8"}
    ],"phasesNotInUse":[],"overlaps":[],"patterns":[],"splitTables":[],"sequences":[],
    "detectors":[
      {"channel":1,"callPhase":6,"switchPhase":null,"delay":0,"extend":0,"source":"ntcip:det.1"},
      {"channel":3,"callPhase":2,"switchPhase":null,"delay":0,"extend":0,"source":"ntcip:det.3"},
      {"channel":17,"callPhase":5,"switchPhase":null,"delay":0,"extend":0,"source":"ntcip:det.17"},
      {"channel":18,"callPhase":6,"switchPhase":null,"delay":0,"extend":0,"source":"ntcip:det.18"},
      {"channel":19,"callPhase":2,"switchPhase":null,"delay":0,"extend":0,"source":"ntcip:det.19"},
      {"channel":20,"callPhase":2,"switchPhase":null,"delay":0,"extend":0,"source":"ntcip:det.20"},
      {"channel":33,"callPhase":1,"switchPhase":null,"delay":0,"extend":0,"source":"ntcip:det.33"},
      {"channel":34,"callPhase":2,"switchPhase":null,"delay":0,"extend":0,"source":"ntcip:det.34"},
      {"channel":35,"callPhase":6,"switchPhase":null,"delay":0,"extend":0,"source":"ntcip:det.35"},
      {"channel":36,"callPhase":6,"switchPhase":null,"delay":0,"extend":0,"source":"ntcip:det.36"},
      {"channel":49,"callPhase":7,"switchPhase":null,"delay":0,"extend":0,"source":"ntcip:det.49"},
      {"channel":50,"callPhase":8,"switchPhase":null,"delay":0,"extend":0,"source":"ntcip:det.50"},
      {"channel":51,"callPhase":4,"switchPhase":null,"delay":0,"extend":0,"source":"ntcip:det.51"},
      {"channel":56,"callPhase":3,"switchPhase":null,"delay":0,"extend":0,"source":"ntcip:det.56"},
      {"channel":57,"callPhase":4,"switchPhase":null,"delay":0,"extend":0,"source":"ntcip:det.57"},
      {"channel":58,"callPhase":8,"switchPhase":null,"delay":0,"extend":0,"source":"ntcip:det.58"}
    ],
    "unavailable":["overlaps","patterns","splitTables","sequences","configWrittenAt"],
    "conflicts":[],"notes":[]}
    """;
}
