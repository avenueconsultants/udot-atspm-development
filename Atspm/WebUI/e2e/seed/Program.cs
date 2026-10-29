using Microsoft.EntityFrameworkCore;
using Npgsql;
using Utah.Udot.Atspm.Data;
using Utah.Udot.Atspm.Data.Enums;
using Utah.Udot.Atspm.Data.Models;
using Utah.Udot.Atspm.Data.Models.EventLogModels;

const string SeedDateText = "2026-01-05";
var seedDate = DateTime.Parse(SeedDateText);
var env = LoadEnv(Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../../../../.env")));

await using var config = new ConfigContext(Options<ConfigContext>(Connection("CONFIG_CONNECTION")));
await using var events = new EventLogContext(Options<EventLogContext>(Connection("EVENTLOG_CONNECTION")));
await using var aggregations = new AggregationContext(Options<AggregationContext>(Connection("AGGREGATION_CONNECTION")));

var definitions = new[]
{
    new Scenario("E2ETODC01", "E2E commute curve", new[] { DirectionTypes.NB, DirectionTypes.SB }),
    new Scenario("E2ETODF01", "E2E free fallback", new[] { DirectionTypes.NB, DirectionTypes.SB }),
    new Scenario("E2ETODS01", "E2E split pressure", new[] { DirectionTypes.NB, DirectionTypes.EB }),
    new Scenario("E2ETODV01", "E2E varying capacity", new[] { DirectionTypes.NB }),
    new Scenario("E2ETODN01", "E2E no aggregations", new[] { DirectionTypes.NB }),
    new Scenario("E2ETODZ01", "E2E zero volume", new[] { DirectionTypes.NB }),
    new Scenario("E2ETODL01", "E2E lunch spike", new[] { DirectionTypes.NB, DirectionTypes.SB }),
    new Scenario("E2ETODP01", "E2E partial plan", new[] { DirectionTypes.NB }),
    new Scenario("E2ETODX01", "E2E no vehicle detector", new[] { DirectionTypes.NB }),
    new Scenario("E2ETODT01", "E2E no TMC detector", new[] { DirectionTypes.NB }),
    new Scenario("E2E(TOD01", "E2E regex identifier", new[] { DirectionTypes.NB }),
    new Scenario("E2ETODM01A", "E2E median low", new[] { DirectionTypes.EB }),
    new Scenario("E2ETODM01B", "E2E median middle", new[] { DirectionTypes.EB }),
    new Scenario("E2ETODM01C", "E2E median high", new[] { DirectionTypes.EB }),
};
var ids = definitions.Select(x => x.Id).ToArray();

await events.CompressedEvents.Where(x => ids.Contains(x.LocationIdentifier)).ExecuteDeleteAsync();
await aggregations.CompressedAggregations.Where(x => ids.Contains(x.LocationIdentifier)).ExecuteDeleteAsync();

var oldLocations = await config.Locations
    .Include(x => x.Approaches).ThenInclude(x => x.Detectors)
    .Where(x => ids.Contains(x.LocationIdentifier))
    .ToListAsync();
config.Locations.RemoveRange(oldLocations);
await config.SaveChangesAsync();

var locationTypeId = await config.LocationTypes.Select(x => x.Id).FirstAsync();
var jurisdictionId = await config.Jurisdictions.Select(x => (int?)x.Id).FirstOrDefaultAsync();
if (jurisdictionId is null)
{
    var jurisdiction = new Jurisdiction { Name = "Playwright E2E" };
    config.Jurisdictions.Add(jurisdiction);
    await config.SaveChangesAsync();
    jurisdictionId = jurisdiction.Id;
}
var detectorNumber = 7000;
var seeded = new Dictionary<string, Location>();
foreach (var definition in definitions)
{
    var location = new Location
    {
        LocationIdentifier = definition.Id,
        PrimaryName = definition.Name,
        SecondaryName = "Playwright fixture",
        Latitude = 40.75,
        Longitude = -111.89,
        ChartEnabled = true,
        Note = "Deterministic Time-of-Day E2E fixture",
        Start = new DateTime(2020, 1, 1),
        LocationTypeId = locationTypeId,
        JurisdictionId = jurisdictionId.Value,
        VersionAction = LocationVersionActions.New,
    };
    foreach (var direction in definition.Directions)
    {
        var approach = new Approach
        {
            Description = $"{direction} through",
            DirectionTypeId = direction,
            ProtectedPhaseNumber = direction is DirectionTypes.NB or DirectionTypes.EB ? 2 : 6,
        };
        approach.Detectors.Add(new Detector
        {
            DectectorIdentifier = $"E2E-{detectorNumber}",
            DetectorChannel = detectorNumber,
            DateAdded = new DateTime(2020, 1, 1),
            LaneNumber = 1,
            MovementType = MovementTypes.T,
            LaneType = definition.Id == "E2ETODX01" ? LaneTypes.Bike : LaneTypes.V,
            DetectionHardware = DetectionHardwareTypes.NA,
        });
        detectorNumber++;
        location.Approaches.Add(approach);
    }
    config.Locations.Add(location);
    seeded[definition.Id] = location;
}
await config.SaveChangesAsync();

var capacityVersion = new Location
{
    LocationIdentifier = "E2ETODV01",
    PrimaryName = "E2E varying capacity",
    SecondaryName = "Playwright fixture v2",
    Latitude = 40.75,
    Longitude = -111.89,
    ChartEnabled = true,
    Note = "Two detected lanes beginning 2026-01-06",
    Start = seedDate.AddDays(1),
    LocationTypeId = locationTypeId,
    JurisdictionId = jurisdictionId.Value,
    VersionAction = LocationVersionActions.NewVersion,
};
var capacityApproach = new Approach
{
    Description = "NB through",
    DirectionTypeId = DirectionTypes.NB,
    ProtectedPhaseNumber = 2,
};
for (var lane = 1; lane <= 2; lane++)
{
    capacityApproach.Detectors.Add(new Detector
    {
        DectectorIdentifier = $"E2E-{detectorNumber}",
        DetectorChannel = detectorNumber++,
        DateAdded = seedDate.AddDays(1),
        LaneNumber = lane,
        MovementType = MovementTypes.T,
        LaneType = LaneTypes.V,
        DetectionHardware = DetectionHardwareTypes.NA,
    });
}
capacityVersion.Approaches.Add(capacityApproach);
config.Locations.Add(capacityVersion);
await config.SaveChangesAsync();

AddAggregations("E2ETODC01", CommuteVolume);
AddAggregations("E2ETODF01", minute => minute >= 18 * 60 ? 400 : CommuteVolume(minute));
AddAggregations("E2ETODS01", minute => minute == 12 * 60 ? 1 : 500, crossVolume: minute => minute switch
{
    12 * 60 => 1,
    12 * 60 + 15 => 175,
    12 * 60 + 30 => 225,
    _ => 100,
});
AddAggregations("E2ETODM01A", _ => 25);
AddAggregations("E2ETODM01B", _ => 75);
AddAggregations("E2ETODM01C", _ => 225);
AddAggregations("E2ETODV01", _ => 100);
AddAggregations("E2ETODV01", _ => 100, locationOverride: capacityVersion, dateOverride: seedDate.AddDays(1));
AddAggregations("E2ETODL01", LunchSpikeVolume);
AddAggregations("E2ETODP01", _ => 100);
AddAggregations("E2E(TOD01", _ => 100);
await aggregations.SaveChangesAsync();

AddPlanEvents("E2ETODM01A", (0, 7), (6 * 60, 1), (10 * 60, 7));
AddPlanEvents("E2ETODM01B", (0, 7), (6 * 60, 1), (10 * 60, 7));
AddPlanEvents("E2ETODC01", (0, 7), (7 * 60, 13), (9 * 60, 7));
AddPlanEvents("E2ETODP01", (6 * 60, 1), (10 * 60, 7));
AddPlanEvents("E2E(TOD01", (0, 7), (6 * 60, 1), (10 * 60, 7));
AddPlanEvents("E2ETODZ01", (0, 7), (6 * 60, 1), (10 * 60, 7));
await events.SaveChangesAsync();

Console.WriteLine($"Seeded {definitions.Length} deterministic Time-of-Day locations for {SeedDateText}.");

void AddAggregations(
    string id,
    Func<int, int> primaryVolume,
    Func<int, int>? crossVolume = null,
    Location? locationOverride = null,
    DateTime? dateOverride = null)
{
    var location = locationOverride ?? seeded[id];
    var date = dateOverride ?? seedDate;
    var rows = new List<DetectorEventCountAggregation>();
    for (var minutes = 0; minutes < 24 * 60; minutes += 15)
    {
        foreach (var (approach, index) in location.Approaches.Select((value, index) => (value, index)))
        {
            var detector = approach.Detectors.OrderBy(item => item.LaneNumber).First();
            rows.Add(new DetectorEventCountAggregation
            {
                LocationIdentifier = id,
                ApproachId = approach.Id,
                DetectorPrimaryId = detector.Id,
                Start = date.AddMinutes(minutes),
                End = date.AddMinutes(minutes + 15),
                EventCount = index == 0 ? primaryVolume(minutes) : crossVolume?.Invoke(minutes) ?? primaryVolume(minutes),
            });
        }
    }
    aggregations.DetectorEventCountAggregations.Add(new CompressedAggregations<DetectorEventCountAggregation>
    {
        LocationIdentifier = id,
        DataType = typeof(DetectorEventCountAggregation),
        Start = date,
        End = date.AddDays(1),
        Data = rows,
    });
}

void AddPlanEvents(string id, params (int Minutes, short Plan)[] changes)
{
    var rows = changes.Select(change => new IndianaEvent
    {
        LocationIdentifier = id,
        Timestamp = seedDate.AddMinutes(change.Minutes),
        EventCode = (short)IndianaEnumerations.CoordPatternChange,
        EventParam = change.Plan,
    }).ToList();

    events.IndiannaEvents.Add(new CompressedEventLogs<IndianaEvent>
    {
        LocationIdentifier = id,
        DeviceId = 0,
        DataType = typeof(IndianaEvent),
        Start = seedDate,
        End = seedDate.AddDays(1),
        Data = rows,
    });
}

static int CommuteVolume(int minutes) => minutes switch
{
    >= 6 * 60 and < 8 * 60 + 30 => 475,
    >= 15 * 60 and < 18 * 60 => 675,
    _ => 100,
};

static int LunchSpikeVolume(int minutes) => minutes switch
{
    >= 6 * 60 and < 8 * 60 + 30 => 475,
    >= 11 * 60 and < 13 * 60 => 5000,
    >= 15 * 60 and < 18 * 60 => 675,
    _ => 100,
};

DbContextOptions<T> Options<T>(string connection) where T : DbContext =>
    new DbContextOptionsBuilder<T>().UseNpgsql(connection).Options;

string Connection(string key)
{
    var raw = Environment.GetEnvironmentVariable($"TOD_E2E_{key}") ?? env[key];
    var builder = new NpgsqlConnectionStringBuilder(raw);
    if (builder.Host is "postgres" or "localhost")
    {
        builder.Host = "localhost";
        builder.Port = int.TryParse(
            Environment.GetEnvironmentVariable("TOD_E2E_POSTGRES_PORT"),
            out var port)
            ? port
            : 5432;
    }
    return builder.ConnectionString;
}

static Dictionary<string, string> LoadEnv(string path) => File.ReadAllLines(path)
    .Where(line => !string.IsNullOrWhiteSpace(line) && !line.TrimStart().StartsWith('#') && line.Contains('='))
    .Select(line => line.Split('=', 2))
    .GroupBy(parts => parts[0])
    .ToDictionary(group => group.Key, group => group.Last()[1].Trim().Trim('"'));

internal sealed record Scenario(string Id, string Name, DirectionTypes[] Directions);
