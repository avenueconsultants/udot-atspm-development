using System.Text;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.Logging.Abstractions;
using Utah.Udot.Atspm.ConfigApi.Services.ConfigReview;
using Utah.Udot.Atspm.Data;
using Utah.Udot.Atspm.Data.Enums;
using Utah.Udot.Atspm.Data.Models;
using Utah.Udot.Atspm.Infrastructure.Repositories.ConfigurationRepositories;
using Xunit;
using Assert = Xunit.Assert;

namespace ConfigApiTests;

public class ConfigurationReviewTests
{
    private static readonly DateTime OriginalStart = new(2026, 10, 1);
    private static readonly DateOnly ReviewDate = new(2026, 11, 18);

    [Fact]
    public async Task UploadCapturesAndClassifiesTheConfigurationWithoutComparingOverlapKeys()
    {
        await using var fixture = await Fixture.Create();
        var id = await fixture.Review();
        await fixture.Upload(id, Snapshot);
        var report = await fixture.Service.Report(id, default);

        Assert.Equal("Reviewed", report.Review.Status);
        Assert.Equal(OriginalStart, report.Baseline!.Start);
        Assert.Contains(report.Items, item => item.Field == "approaches.11" && item.Classification == "NeedsDirection");
        Assert.DoesNotContain(report.Items, item => item.Field == "approaches.14");
        Assert.DoesNotContain(report.Items, item => item.Field == "detectors.18.callPhase");
        Assert.Contains(report.Items, item => item.Field == "detectors.42.callPhase" && item.Classification == "NotComparable");
        Assert.Contains(report.Items, item => item.Field == "detectors.44.callPhase" && item.Classification == "NeedsDirection");
        Assert.DoesNotContain(report.Items, item => item.Field == "status");
    }

    [Fact]
    public async Task InvalidUploadIsRecordedWithoutStoringItsContents()
    {
        await using var fixture = await Fixture.Create();
        var id = await fixture.Review();
        var invalid = Snapshot.Replace("\"make\":\"Econolite\"", "\"credential\":\"bad-value\",\"make\":\"Econolite\"");
        await Assert.ThrowsAsync<InvalidDataException>(() => fixture.Upload(id, invalid));
        var report = await fixture.Service.Report(id, default);

        Assert.Null(report.Snapshot.Snapshot);
        Assert.Empty(report.Items);
        Assert.Empty(fixture.Db.ConfigSnapshots);
        Assert.Contains("credentials", Assert.Single(report.Snapshot.Files).ParseReport);
        Assert.DoesNotContain("bad-value", report.Snapshot.Files[0].ParseReport);
    }

    [Fact]
    public async Task StringNumbersAreRejectedRatherThanCoerced()
    {
        await using var fixture = await Fixture.Create();
        var id = await fixture.Review();
        await Assert.ThrowsAsync<InvalidDataException>(() => fixture.Upload(id, Snapshot.Replace("\"schemaVersion\":1", "\"schemaVersion\":\"1\"")));
        Assert.Null((await fixture.Service.GetSnapshot(id, default)).Snapshot);
    }

    [Fact]
    public async Task GroupsWithUnresolvedConflictsCannotBePromoted()
    {
        await using var fixture = await Fixture.Create();
        var id = await fixture.Review();
        await fixture.Upload(id, Snapshot);
        await fixture.Upload(id, Snapshot.Replace("\"kind\":\"file\"", "\"kind\":\"ntcip\"")
            .Replace("\"name\":\"ASC3.DB\"", "\"name\":\"controller read\"")
            .Replace("\"ring\":1", "\"ring\":2"));
        var report = await fixture.Service.Report(id, default);
        var conflict = Assert.Single(report.Snapshot.Snapshot!.Conflicts);
        Assert.Equal(1, conflict.FirstValue.GetInt32());
        Assert.Equal(2, conflict.SecondValue.GetInt32());
        Assert.Equal(2, report.Snapshot.Snapshot!.Phases.Single().Ring);

        var item = Assert.Single(report.Items.Where(item => item.Field == "phases.11.ring"));
        await fixture.Service.Annotate(id, item.Id, new("Accepted", null), default);
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            fixture.Service.Promote(id, new("Confirmed", null), "owner", default));
        var conflictItem = Assert.Single(report.Items.Where(item => item.Field.StartsWith('!')));
        await fixture.Service.Annotate(id, conflictItem.Id,
            new("Accepted", new("Measured", "Controller read was newer", null, null, null, null)), default);
        var promoted = await fixture.Service.Promote(id, new("Confirmed", null), "owner", default);
        Assert.Equal("Promoted", promoted.Review.Status);
        Assert.Equal("owner", Assert.Single(promoted.Promotions).ApprovedBy);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task PromotionUsesTheSelectedVersionAndKeepsFieldProvenance(bool newVersion)
    {
        await using var fixture = await Fixture.Create();
        var id = await fixture.Review();
        await fixture.Upload(id, Snapshot);
        var items = await fixture.Service.GetItems(id, default);
        var timing = Assert.Single(items.Where(item => item.Field == "phases.11.minGreen"));
        await fixture.Service.Annotate(id, timing.Id, new("Accepted", null), default);
        var assignment = Assert.Single(items.Where(item => item.Field == "detectors.44.callPhase"));
        await fixture.Service.Annotate(id, assignment.Id, new("Accepted", new("Inferred", "Counts and approaches",
            0.8m, 3, 1, 2)), default);
        var report = await fixture.Service.Promote(id, new("Reviewed", newVersion ? ReviewDate.AddDays(-1) : null), "approver", default);

        Assert.Equal("Promoted", report.Review.Status);
        Assert.Equal(OriginalStart, (await fixture.Db.Locations.OrderBy(location => location.Start).FirstAsync()).Start);
        var latest = await fixture.Db.Locations.OrderByDescending(location => location.Start).FirstAsync();
        Assert.Equal(newVersion ? ReviewDate.AddDays(-1).ToDateTime(TimeOnly.MinValue) : OriginalStart, latest.Start);
        Assert.Contains(report.Promotions, entry => entry.Field == timing.Field && entry.Basis == "Measured");
        Assert.Contains(report.Promotions, entry => entry.Field == assignment.Field && entry.Basis == "Inferred" &&
            entry.Sources.Contains(new string('a', 64)) && entry.Annotation!.Contains("Counts and approaches"));
        var detector = await fixture.Db.Detectors.Include(entry => entry.Approach).SingleAsync(entry => entry.DetectorChannel == 44);
        Assert.Equal(11, detector.Approach.ProtectedPhaseNumber);
        Assert.Equal(2, detector.LaneNumber);
        Assert.Equal(15, (await fixture.Service.GetConfiguration("7521", ReviewDate, default))[timing.Field].GetInt32());
        if (newVersion)
            Assert.Empty(await fixture.Service.GetConfiguration("7521", new(2026, 11, 1), default));
    }

    [Fact]
    public async Task AnUnavailableInventoryAndAnObservedEmptyInventoryHaveDifferentMeanings()
    {
        await using var fixture = await Fixture.Create();
        var id = await fixture.Review();
        await fixture.Upload(id, Snapshot);
        var noDetectors = Snapshot[..Snapshot.IndexOf("\"detectors\":[", StringComparison.Ordinal)] +
            "\"detectors\":[],\"unavailable\":[\"detectors\"]}";
        await fixture.Upload(id, noDetectors);
        Assert.Equal(3, (await fixture.Service.GetSnapshot(id, default)).Snapshot!.Detectors.Length);
        Assert.Empty((await fixture.Service.GetSnapshot(id, default)).Snapshot!.Conflicts);

        await fixture.Upload(id, noDetectors.Replace("\"unavailable\":[\"detectors\"]", "\"unavailable\":[]")
            .Replace("\"kind\":\"file\"", "\"kind\":\"ntcip\""));
        var snapshot = (await fixture.Service.GetSnapshot(id, default)).Snapshot!;
        Assert.Empty(snapshot.Detectors);
        var conflict = Assert.Single(snapshot.Conflicts);
        Assert.Equal("detectors.inventory", conflict.Field);
        Assert.Equal(3, conflict.FirstValue.GetArrayLength());
        Assert.Equal(0, conflict.SecondValue.GetArrayLength());
    }

    [Fact]
    public async Task PromotionRefusesAStaleBaseline()
    {
        await using var fixture = await Fixture.Create();
        var id = await fixture.Review();
        await fixture.Upload(id, Snapshot);
        var item = Assert.Single((await fixture.Service.GetItems(id, default)).Where(item => item.Field == "phases.11.minGreen"));
        await fixture.Service.Annotate(id, item.Id, new("Accepted", null), default);
        (await fixture.Db.Approaches.FirstAsync()).Description = "Changed after review started";
        await fixture.Db.SaveChangesAsync();
        await Assert.ThrowsAsync<InvalidOperationException>(() => fixture.Service.Promote(id, new("Reviewed", null), "owner", default));
    }

    [Fact]
    public async Task ARouteReviewCapturesAvailableBaselinesAndKeepsMissingLocationsInTheRollup()
    {
        await using var fixture = await Fixture.Create();
        var route = new Route
        {
            Name = "Review route",
            RouteLocations =
            [
                new RouteLocation { Order = 0, LocationIdentifier = "7521", PrimaryDirectionId = DirectionTypes.EB, OpposingDirectionId = DirectionTypes.EB },
                new RouteLocation { Order = 1, LocationIdentifier = "missing", PrimaryDirectionId = DirectionTypes.EB, OpposingDirectionId = DirectionTypes.EB }
            ]
        };
        fixture.Db.Routes.Add(route);
        await fixture.Db.SaveChangesAsync();
        var reviews = await fixture.Service.Create(new(null, route.Id, ReviewDate), "editor", default);
        Assert.Equal(2, reviews.Count);
        Assert.Equal(reviews[0].BatchId, reviews[1].BatchId);
        var rollup = await fixture.Service.RouteRollup(reviews[0].BatchId!.Value, default);
        Assert.Contains(rollup, row => row.Review.LocationIdentifier == "7521" && row.BaselineCaptured);
        Assert.Contains(rollup, row => row.Review.LocationIdentifier == "missing" && !row.BaselineCaptured);
    }

    [Fact]
    public async Task SqliteMigrationCreatesTheReviewTables()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        await using var db = new ConfigContext(new DbContextOptionsBuilder<ConfigContext>()
            .UseSqlite(connection, provider => provider.MigrationsAssembly("Utah.Udot.Atspm.SqlLiteDatabaseProvider")).Options);
        var migrator = db.GetService<IMigrator>();
        var migrations = db.Database.GetMigrations().ToArray();
        Assert.Equal("20261125150000_ConfigurationReview", migrations[^1]);
        var script = migrator.GenerateScript(migrations[^2], migrations[^1]);
        await using var command = connection.CreateCommand();
        command.CommandText = "CREATE TABLE \"__EFMigrationsHistory\" (\"MigrationId\" TEXT PRIMARY KEY, \"ProductVersion\" TEXT);";
        await command.ExecuteNonQueryAsync();
        command.CommandText = script;
        await command.ExecuteNonQueryAsync();
        Assert.Empty(await db.ConfigReviews.ToListAsync());
        Assert.Empty(await db.LocationControllerFields.ToListAsync());
        Assert.Empty(await db.ConfigPromotionFields.ToListAsync());
    }

    [Fact]
    public async Task PedestrianTimingWithNoDeclarationIsPromotableRatherThanHeld()
    {
        // The controller settles that a pedestrian movement is programmed; only the approach that
        // carries it is missing. Classified Held it could never be promoted, and it is the most
        // common finding on a corridor - 71 across 19 locations on R2:192.
        await using var fixture = await Fixture.Create();
        var id = await fixture.Review();
        var withPed = Snapshot.Replace("\"minGreen\":15", "\"minGreen\":15,\"walk\":7,\"pedClear\":26");
        await fixture.Upload(id, withPed);
        var report = await fixture.Service.Report(id, default);

        var item = Assert.Single(report.Items, entry => entry.Field == "pedestrian.11");
        Assert.Equal("NeedsDirection", item.Classification);
        Assert.Equal("phaseStructure", item.Group);
    }

    [Fact]
    public async Task SwitchPhaseWithoutCallPhaseIsRejectedRatherThanReadAsNoAssignment()
    {
        // NTCIP's vehicleDetectorCallPhase answers noSuchName on every firmware met so far and the
        // assignment arrives in switchPhase. Passing the raw column through would leave callPhase
        // empty and the comparison would report no detector assignments at all - silently.
        await using var fixture = await Fixture.Create();
        var id = await fixture.Review();
        var raw = Snapshot.Replace("{\"channel\":44,\"callPhase\":11}",
            "{\"channel\":44,\"switchPhase\":11}");
        await Assert.ThrowsAsync<InvalidDataException>(() => fixture.Upload(id, raw));
        var report = await fixture.Service.Report(id, default);

        Assert.Null(report.Snapshot.Snapshot);
        Assert.Contains("callPhase", Assert.Single(report.Snapshot.Files).ParseReport);
    }

    private const string Snapshot = """
    {"schemaVersion":1,"locationIdentifier":"7521","make":"Econolite","model":"Cobalt",
    "collectedAt":"2026-11-18T10:26:00Z","sources":[{"kind":"file","name":"ASC3.DB",
    "sha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","decoder":"example",
    "groups":["phases","detectors"]}],"phases":[{"phase":11,"inUse":true,"ring":1,"barrier":"B",
    "concurrent":[8,15],"minGreen":15}],"phasesNotInUse":[{"phase":14,"reason":"ring0"}],
    "overlaps":[],"patterns":[],"splitTables":[],"detectors":[{"channel":18,"callPhase":6},
    {"channel":42,"callPhase":null},{"channel":44,"callPhase":11}],"unavailable":[],"status":{"runningPattern":2}}
    """;

    private sealed class Fixture(SqliteConnection connection, ConfigContext db) : IAsyncDisposable
    {
        public ConfigContext Db => db;
        public ConfigReviewService Service { get; } = new(db,
            new LocationEFRepository(db, NullLogger<LocationEFRepository>.Instance),
            new ApproachEFRepository(db, NullLogger<ApproachEFRepository>.Instance),
            new DetectorEFRepository(db, NullLogger<DetectorEFRepository>.Instance),
            new DeviceEFRepository(db, NullLogger<DeviceEFRepository>.Instance));

        public static async Task<Fixture> Create()
        {
            var connection = new SqliteConnection("Data Source=:memory:");
            await connection.OpenAsync();
            var db = new ConfigContext(new DbContextOptionsBuilder<ConfigContext>().UseSqlite(connection).Options);
            await db.Database.EnsureCreatedAsync();
            if (!await db.LocationTypes.AnyAsync(entry => entry.Id == 1))
                db.LocationTypes.Add(new LocationType { Id = 1, Name = "Signal", Icon = "signal" });
            if (!await db.DirectionTypes.AnyAsync(entry => entry.Id == DirectionTypes.EB))
                db.DirectionTypes.Add(new DirectionType { Id = DirectionTypes.EB, Description = "Eastbound", Abbreviation = "EB" });
            db.Jurisdictions.Add(new Jurisdiction { Id = 1, Name = "Example" });
            db.Locations.Add(new Location
            {
                LocationIdentifier = "7521", PrimaryName = "Example", SecondaryName = "Road",
                Start = OriginalStart, LocationTypeId = 1, JurisdictionId = 1, VersionAction = LocationVersionActions.Initial,
                Approaches =
                [
                    new Approach
                    {
                        Description = "Protected overlap", DirectionTypeId = DirectionTypes.EB,
                        ProtectedPhaseNumber = 1, IsProtectedPhaseOverlap = true,
                        Detectors = [new Detector { DectectorIdentifier = "7521-18", DetectorChannel = 18, DateAdded = OriginalStart }]
                    }
                ]
            });
            await db.SaveChangesAsync();
            return new Fixture(connection, db);
        }

        public async Task<Guid> Review()
        {
            var entry = Assert.Single(await Service.Create(new("7521", null, ReviewDate), "editor", default));
            await Service.Load(entry.Id, default);
            return entry.Id;
        }

        public async Task Upload(Guid id, string json)
        {
            await using var stream = new MemoryStream(Encoding.UTF8.GetBytes(json));
            await Service.Upload(id, "snapshot.json", stream, false, default);
        }

        public async ValueTask DisposeAsync()
        {
            await db.DisposeAsync();
            await connection.DisposeAsync();
        }
    }
}
