using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Utah.Udot.Atspm.Data;
using Utah.Udot.Atspm.Data.Enums;
using Utah.Udot.Atspm.Data.Models;
using Utah.Udot.Atspm.Data.Models.EventLogModels;
using Utah.Udot.Atspm.Data.Models.IdentityModels;

var envPath = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../../../../.env"));
var env = File.ReadAllLines(envPath)
    .Where(line => !string.IsNullOrWhiteSpace(line) && !line.TrimStart().StartsWith('#') && line.Contains('='))
    .Select(line => line.Split('=', 2)).GroupBy(parts => parts[0])
    .ToDictionary(group => group.Key, group => group.Last()[1].Trim().Trim('"'));
await using var config = new ConfigContext(Options<ConfigContext>("CONFIG_CONNECTION"));
await using var events = new EventLogContext(Options<EventLogContext>("EVENTLOG_CONNECTION"));
await using var aggregations = new AggregationContext(Options<AggregationContext>("AGGREGATION_CONNECTION"));
await using var identity = new IdentityContext(Options<IdentityContext>("IDENTITY_CONNECTION"));

string[] identifiers = ["E2ECORE01", "E2ECORE02", "E2EEMPTY01", "E2EADMIN01"];
const string routeName = "E2E feature regression corridor";
var date = new DateTime(2026, 1, 5);
await events.CompressedEvents.Where(row => identifiers.Contains(row.LocationIdentifier)).ExecuteDeleteAsync();
await aggregations.CompressedAggregations.Where(row => identifiers.Contains(row.LocationIdentifier)).ExecuteDeleteAsync();
await config.WatchDogLogEvents.Where(row => identifiers.Contains(row.LocationIdentifier)).ExecuteDeleteAsync();
await config.WatchDogIgnoreEvents.Where(row => identifiers.Contains(row.LocationIdentifier)).ExecuteDeleteAsync();
var oldRoutes = await config.Routes.Include(route => route.RouteLocations).Where(route => route.Name == routeName).ToListAsync();
config.Routes.RemoveRange(oldRoutes);
await config.SaveChangesAsync();
var oldLocations = await config.Locations.Include(location => location.Approaches).ThenInclude(approach => approach.Detectors)
    .Where(location => identifiers.Contains(location.LocationIdentifier)).ToListAsync();
config.Locations.RemoveRange(oldLocations);
await config.SaveChangesAsync();

var locationTypeId = await config.LocationTypes.Select(row => row.Id).FirstAsync();
var jurisdiction = await config.Jurisdictions.FirstAsync();
var detectionTypes = await config.DetectionTypes.Where(row => row.Id == DetectionTypes.AC || row.Id == DetectionTypes.LLC || row.Id == DetectionTypes.SBP).ToListAsync();
if (detectionTypes.Count != 3) throw new InvalidOperationException("Run the database installer before seeding feature fixtures.");
var locations = new List<Location>();
foreach (var (identifier, index) in identifiers.Select((value, index) => (value, index)))
{
    var location = new Location
    {
        LocationIdentifier = identifier, PrimaryName = "E2E feature regression", SecondaryName = identifier,
        Latitude = 40.75 + index * .001, Longitude = -111.89, Start = new DateTime(2020, 1, 1),
        ChartEnabled = true, LocationTypeId = locationTypeId, JurisdictionId = jurisdiction.Id,
        Note = "Deterministic browser fixture", VersionAction = LocationVersionActions.New,
    };
    foreach (var (direction, phase, channel) in new[] { (DirectionTypes.NB, 2, 1), (DirectionTypes.SB, 6, 2) })
    {
        var approach = new Approach
        {
            Description = $"E2E {direction} through", DirectionTypeId = direction, ProtectedPhaseNumber = phase,
            Mph = 35, PedestrianPhaseNumber = phase, PedestrianDetectors = phase.ToString(),
        };
        approach.Detectors.Add(new Detector
        {
            DectectorIdentifier = $"{identifier}-{channel}", DetectorChannel = channel, DateAdded = location.Start,
            LaneNumber = 1, MovementType = MovementTypes.T, LaneType = LaneTypes.V,
            DetectionHardware = DetectionHardwareTypes.NA, DistanceFromStopBar = 0,
            DetectionTypes = detectionTypes.ToList(),
        });
        location.Approaches.Add(approach);
    }
    // A left-turn detector makes the left-turn eligibility check observable.
    location.Approaches.First().Detectors.Add(new Detector
    {
        DectectorIdentifier = $"{identifier}-3", DetectorChannel = 3, DateAdded = location.Start,
        LaneNumber = 1, MovementType = MovementTypes.L, LaneType = LaneTypes.V,
        DetectionHardware = DetectionHardwareTypes.NA,
        DetectionTypes = detectionTypes.Where(row => row.Id == DetectionTypes.LLC).ToList(),
    });
    config.Locations.Add(location);
    locations.Add(location);
}
await config.SaveChangesAsync();

config.Routes.Add(new Route
{
    Name = routeName,
    RouteLocations = locations.Take(2).Select((location, index) => new RouteLocation
    {
        LocationIdentifier = location.LocationIdentifier, Order = index, PrimaryPhase = 2, OpposingPhase = 6,
        PrimaryDirectionId = DirectionTypes.NB, OpposingDirectionId = DirectionTypes.SB,
    }).ToList(),
});
foreach (var location in locations.Where(location => location.LocationIdentifier != "E2EEMPTY01"))
{
    var rows = new List<IndianaEvent>();
    void Add(int seconds, int code, int parameter) => rows.Add(new IndianaEvent
    {
        LocationIdentifier = location.LocationIdentifier, Timestamp = date.AddHours(8).AddSeconds(seconds),
        EventCode = (short)code, EventParam = (short)parameter,
    });
    Add(0, 131, 1); // Coordination pattern.
    for (var cycle = 0; cycle <= 60; cycle++)
    {
        foreach (var phase in new[] { 2, 6 })
        {
            Add(cycle * 60, 1, phase); // Green starts every minute.
            if (cycle == 60) continue;
            Add(cycle * 60 + 30, 4, phase); // Gap out.
            Add(cycle * 60 + 30, 8, phase); // Yellow.
            Add(cycle * 60 + 33, 9, phase);
            Add(cycle * 60 + 33, 10, phase); // Red clearance.
            Add(cycle * 60 + 35, 11, phase);
            Add(cycle * 60 + 5, 90, phase); // Ped detector call.
            Add(cycle * 60 + 10, 21, phase); // Walk: five seconds after call.
            Add(cycle * 60 + 17, 22, phase);
            Add(cycle * 60 + 25, 23, phase);
        }
        if (cycle == 60) continue;
        foreach (var channel in new[] { 1, 2, 3 })
        foreach (var second in new[] { 15, 45 })
        {
            Add(cycle * 60 + second, 82, channel); // One green and one red arrival per cycle.
            Add(cycle * 60 + second + 1, 81, channel);
        }
    }
    events.IndiannaEvents.Add(new CompressedEventLogs<IndianaEvent>
    {
        LocationIdentifier = location.LocationIdentifier, DeviceId = 0, DataType = typeof(IndianaEvent),
        Start = date, End = date.AddDays(1), Data = rows.OrderBy(row => row.Timestamp).ToList(),
    });
    var aggregateRows = location.Approaches.SelectMany(approach => approach.Detectors.SelectMany(detector =>
        Enumerable.Range(0, 4).Select(quarter => new DetectorEventCountAggregation
        {
            LocationIdentifier = location.LocationIdentifier, ApproachId = approach.Id, DetectorPrimaryId = detector.Id,
            Start = date.AddHours(8).AddMinutes(quarter * 15), End = date.AddHours(8).AddMinutes((quarter + 1) * 15), EventCount = 30,
        }))).ToList();
    aggregations.DetectorEventCountAggregations.Add(new CompressedAggregations<DetectorEventCountAggregation>
    {
        LocationIdentifier = location.LocationIdentifier, DataType = typeof(DetectorEventCountAggregation),
        Start = date, End = date.AddDays(1), Data = aggregateRows,
    });
    config.WatchDogLogEvents.Add(new WatchDogLogEvent(location.Id, location.LocationIdentifier, date.AddHours(8),
        WatchDogComponentTypes.Location, location.Id, WatchDogIssueTypes.RecordCount,
        "E2E deterministic record count warning", $"E2E-{location.LocationIdentifier}", null));
}
await events.SaveChangesAsync();
await aggregations.SaveChangesAsync();
await config.SaveChangesAsync();

// An authenticated user with no privileged roles tests server-side authorization.
const string email = "e2e-reader@example.invalid";
var user = await identity.Users.SingleOrDefaultAsync(row => row.NormalizedEmail == email.ToUpperInvariant());
if (user == null)
{
    user = new ApplicationUser
    {
        Id = Guid.NewGuid().ToString(), UserName = email, NormalizedUserName = email.ToUpperInvariant(),
        Email = email, NormalizedEmail = email.ToUpperInvariant(), EmailConfirmed = true,
        FirstName = "E2E", LastName = "Reader", SecurityStamp = Guid.NewGuid().ToString(),
    };
    user.PasswordHash = new PasswordHasher<ApplicationUser>().HashPassword(user, "E2e-Reader-Only-2026!");
    identity.Users.Add(user);
    await identity.SaveChangesAsync();
}
Console.WriteLine("Seeded four feature locations, one corridor, controller/aggregation data, Watchdog logs, and an unprivileged test user.");

DbContextOptions<T> Options<T>(string key) where T : DbContext
{
    var raw = Environment.GetEnvironmentVariable($"TOD_E2E_{key}") ?? env[key];
    var builder = new NpgsqlConnectionStringBuilder(raw);
    if (builder.Host is "postgres" or "localhost") { builder.Host = "localhost"; builder.Port = 5433; }
    return new DbContextOptionsBuilder<T>().UseNpgsql(builder.ConnectionString).Options;
}
