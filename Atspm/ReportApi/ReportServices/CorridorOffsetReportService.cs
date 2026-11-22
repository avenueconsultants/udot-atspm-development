using Microsoft.EntityFrameworkCore;
using Utah.Udot.Atspm.Business.CorridorOffsets;
using Utah.Udot.Atspm.Business.TimeSpaceDiagram;
using Utah.Udot.Atspm.Data.Enums;
using Utah.Udot.Atspm.Data.Models.EventLogModels;

namespace Utah.Udot.Atspm.ReportApi.ReportServices;

public class CorridorOffsetOptions
{
    public int RouteId { get; set; }
    public DateTime Start { get; set; }
    public DateTime End { get; set; }
    public int? SpeedLimit { get; set; }
    public int MaxShift { get; set; } = 30;
    public double? MaxDirectionalIncrease { get; set; }
    public string[] LockedSignals { get; set; } = [];
    public bool CompareLinkPivot { get; set; } = true;
}

public class CorridorOffsetReportService(
    IRouteLocationsRepository routeRepository,
    ILocationRepository locationRepository,
    IIndianaEventLogRepository eventRepository,
    LinkPivotReportService linkPivot,
    ILogger<CorridorOffsetReportService> logger)
{
    private const double FeetPerMph = 5280d / 3600;
    private const double LaneHeadwaySeconds = 2;
    private const double MinimumAdvanceDistance = 30;

    private record Observation(RouteLocation Route, Location Location, Approach Primary, Approach Opposing,
        IReadOnlyList<IndianaEvent> Events, int Cycle, int Offset, int Pattern, double Distance);

    public async Task<CorridorResult> ExecuteAsync(CorridorOffsetOptions options, CancellationToken cancellationToken)
    {
        var (input, notes) = await BuildInputAsync(options, cancellationToken);
        var signals = input.Signals;
        var seeds = new List<(string Name, int[] Shifts)>();
        if (options.CompareLinkPivot)
        {
            try
            {
                foreach (var plan in await linkPivot.GetLinkPivotForTSD(new TimeSpaceDiagramOptions
                {
                    RouteId = options.RouteId,
                    Start = options.Start,
                    End = options.End,
                    LocationIdentifier = signals[0].Id
                }))
                {
                    var adjustments = plan.Data.Adjustments
                        .GroupBy(adjustment => adjustment.LocationIdentifier)
                        .ToDictionary(group => group.Key, group => group.Last().Adjustment);
                    if (signals.Any(signal => !adjustments.ContainsKey(signal.Id)))
                        continue;
                    var shifts = signals.Select(signal => CenterShift(adjustments[signal.Id], input.Cycle)).ToArray();
                    if (signals.Select((signal, index) => signal.Locked && shifts[index] != 0).Any(conflict => conflict))
                        continue;
                    seeds.Add(($"Link Pivot ({plan.Direction})", shifts));
                }
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                logger.LogWarning(exception, "Link Pivot comparison was unavailable for corridor route {RouteId}", options.RouteId);
            }

            if (seeds.Count == 0)
                notes.Add("Link Pivot comparison is unavailable for this period or incompatible with the locked entrance signals.");
        }
        return CorridorReplay.Optimize(input, seeds, notes, cancellationToken);
    }

    internal async Task<(CorridorInput Input, List<string> Notes)> BuildInputAsync(
        CorridorOffsetOptions options, CancellationToken cancellationToken)
    {
        if (options.RouteId <= 0 || options.Start.Date != options.End.Date ||
            options.End <= options.Start)
            throw new InvalidOperationException("Select a route and a same-day window within one coordinated plan.");
        if (options.SpeedLimit is <= 0 or > 85 || options.MaxShift is < 0 or > 120 ||
            options.MaxDirectionalIncrease is < 0)
            throw new InvalidOperationException("Enter valid fallback speed, offset search range, and directional delay limit.");

        var route = await routeRepository.GetList().Where(location => location.RouteId == options.RouteId)
            .Include(location => location.NextLocationDistance)
            .Include(location => location.PreviousLocationDistance)
            .OrderBy(location => location.Order).ToListAsync(cancellationToken);
        if (route.Count < 2 || route.Select(location => location.LocationIdentifier).Distinct().Count() != route.Count)
            throw new InvalidOperationException("Select a route with at least two distinct signals.");

        var observations = new List<Observation>();
        var timingIssues = new List<string>();
        var distance = 0d;
        for (var index = 0; index < route.Count; index++)
        {
            cancellationToken.ThrowIfCancellationRequested();
            var row = route[index];
            var id = row.LocationIdentifier;
            var location = locationRepository.GetLatestVersionOfLocation(id, options.Start)
                ?? throw new InvalidOperationException($"Location {id} has no configuration for this date.");
            var events = eventRepository.GetEventsBetweenDates(id, options.Start.AddHours(-12), options.End.AddHours(1))
                .OrderBy(entry => entry.Timestamp).ToArray();
            try
            {
                if (!events.Any(entry => entry.Timestamp >= options.Start && entry.Timestamp < options.End))
                    throw new InvalidOperationException($"Signal {id} has no controller events in the selected window.");
                var cycle = StableSetting(events, IndianaEnumerations.CycleLengthChange, options, id);
                var offset = StableSetting(events, IndianaEnumerations.OffsetLengthChange, options, id);
                var pattern = StableSetting(events, IndianaEnumerations.CoordPatternChange, options, id);
                if (cycle <= 0 || offset < 0 || offset >= cycle || pattern is <= 0 or >= 254)
                    throw new InvalidOperationException($"Signal {id} has no usable coordinated plan, cycle length, and offset in this window.");

                observations.Add(new Observation(row, location,
                    FindApproach(location, row.PrimaryPhase, row.PrimaryDirectionId, row.IsPrimaryOverlap),
                    FindApproach(location, row.OpposingPhase, row.OpposingDirectionId, row.IsOpposingOverlap),
                    events, cycle, offset, pattern, distance));
            }
            catch (InvalidOperationException exception)
            {
                timingIssues.Add(exception.Message);
            }

            if (index + 1 < route.Count)
            {
                var linkDistance = row.NextLocationDistance?.Distance ?? route[index + 1].PreviousLocationDistance?.Distance ?? 0;
                if (linkDistance <= 0)
                    throw new InvalidOperationException($"Link distance is missing after signal {id}.");
                distance += linkDistance;
            }
        }

        if (observations.Select(signal => signal.Cycle).Distinct().Count() > 1)
            timingIssues.Add($"The available signals use different cycle lengths ({string.Join(", ", observations
                .Select(signal => signal.Cycle).Distinct().Order())} seconds).");
        if (timingIssues.Count > 0)
            throw new InvalidOperationException(string.Join(" ", timingIssues));

        var cycleLength = observations[0].Cycle;

        var maxShift = Math.Min(options.MaxShift, cycleLength / 2);
        var notes = new List<string>
        {
            "Replay covers vehicles entering at the two ends. Mid-corridor traffic and spillback are outside this model.",
            "Queue discharge uses a two-second per-lane headway and a two-second startup delay."
        };
        var duration = (options.End - options.Start).TotalSeconds;
        var primary = BuildDirection(observations, options, false, notes);
        var opposing = BuildDirection(observations, options, true, notes);
        var requestedLocks = options.LockedSignals ?? [];
        if (requestedLocks.Any(id => observations.All(signal => signal.Route.LocationIdentifier != id)))
            throw new InvalidOperationException("A locked signal is outside the selected route.");
        var signals = observations.Select((signal, index) => new CorridorSignal(signal.Route.LocationIdentifier,
            $"{signal.Location.PrimaryName} @ {signal.Location.SecondaryName}", signal.Distance, signal.Offset,
            requestedLocks.Contains(signal.Route.LocationIdentifier) ||
            (index == 0 && primary.EnteringAfterSignal) ||
            (index == observations.Count - 1 && opposing.EnteringAfterSignal))).ToArray();
        var input = new CorridorInput(cycleLength, signals,
            [new CorridorDay(options.Start, duration, primary, opposing)], maxShift, options.MaxDirectionalIncrease);
        return (input, notes);
    }

    private static CorridorDirection BuildDirection(IReadOnlyList<Observation> signals, CorridorOffsetOptions options,
        bool reverse, List<string> notes)
    {
        var approaches = new CorridorApproach[signals.Count];
        var entrance = reverse ? signals.Count - 1 : 0;
        IReadOnlyList<CorridorEntry> entries = [];
        var enteringAfterSignal = false;
        for (var index = 0; index < signals.Count; index++)
        {
            var signal = signals[index];
            var approach = reverse ? signal.Opposing : signal.Primary;
            var id = signal.Route.LocationIdentifier;
            var next = index + (reverse ? -1 : 1);
            var speed = approach.Mph is > 0 ? approach.Mph.Value : options.SpeedLimit ??
                throw new InvalidOperationException($"Enter a fallback speed for signal {id}, which has no configured speed.");
            if (approach.Mph is null or <= 0)
                notes.Add($"Signal {id}, phase {approach.ProtectedPhaseNumber}, uses the {speed} mph fallback speed.");
            var feetPerSecond = FeetPerMph * speed;
            var travel = next >= 0 && next < signals.Count
                ? Math.Abs(signals[next].Distance - signal.Distance) / feetPerSecond : 0;
            var greens = GetGreens(signal, approach, options.Start, options.End);
            if (!HasGreenCoverage(greens, signal.Cycle, (options.End - options.Start).TotalSeconds))
                throw new InvalidOperationException($"Signal {id}, phase {approach.ProtectedPhaseNumber}, has incomplete green timing for this window.");
            var laneCount = approach.Detectors.Where(detector => IsThrough(detector) &&
                IsActive(detector, options) && detector.LaneNumber > 0)
                .Select(detector => detector.LaneNumber).Distinct().Count();
            approaches[index] = new CorridorApproach(travel, LaneHeadwaySeconds / Math.Max(laneCount, 1), greens);
            if (index != entrance)
                continue;

            var entranceData = GetEntries(signal, approach, greens, options, feetPerSecond, reverse, false);
            entries = entranceData.Entries;
            if (!entries.Any(entry => entry.Score))
            {
                entranceData = GetEntries(signal, approach, greens, options, feetPerSecond, reverse, true);
                entries = entranceData.Entries;
                enteringAfterSignal = true;
                if (entries.Any(entry => entry.Score))
                    notes.Add($"Signal {id} is locked because its entrance stream is seeded from stop-bar count events on green.");
            }
            if (!entries.Any(entry => entry.Score))
                throw new InvalidOperationException($"Signal {id} has no usable through-count events for the {(reverse ? "opposing" : "primary")} entrance.");

            var direction = approach.DirectionType?.Abbreviation ?? (reverse ? "opposing" : "primary");
            if (entranceData.LanesWithCounts < laneCount)
                notes.Add($"Signal {id} ({direction}) has entrance counts for {entranceData.LanesWithCounts} of {laneCount} through lanes listed in the detector configuration.");
        }

        var entranceApproach = reverse ? signals[entrance].Opposing : signals[entrance].Primary;
        var name = entranceApproach.DirectionType?.Abbreviation ?? (reverse ? "Opposing" : "Primary");
        return new CorridorDirection(name, approaches, entries, enteringAfterSignal);
    }

    private static (IReadOnlyList<CorridorEntry> Entries, int LanesWithCounts) GetEntries(Observation signal, Approach approach,
        IReadOnlyList<CorridorGreen> greens, CorridorOffsetOptions options, double feetPerSecond, bool reverse, bool stopBar)
    {
        var warmup = options.Start.AddSeconds(-2 * signal.Cycle);
        var detections = signal.Events.Where(entry => entry.EventCode == (short)IndianaEnumerations.VehicleDetectorOn &&
                entry.Timestamp >= warmup.AddSeconds(-30) && entry.Timestamp < options.End.AddSeconds(30))
            .ToLookup(entry => (int)entry.EventParam);
        var detectors = approach.Detectors.Where(detector => IsThrough(detector) && IsActive(detector, options))
            .Where(detector => stopBar
                ? detector.DistanceFromStopBar.GetValueOrDefault() < MinimumAdvanceDistance &&
                    detector.DetectionTypes.Any(type => type.Id == DetectionTypes.LLC)
                : detector.DistanceFromStopBar >= MinimumAdvanceDistance &&
                    detector.DetectionTypes.Any(type => type.Id == DetectionTypes.AC || type.Id == DetectionTypes.LLC))
            .Where(detector => detections.Contains(detector.DetectorChannel))
            .GroupBy(detector => detector.LaneNumber.GetValueOrDefault())
            .Select(group => group.OrderBy(detector => detector.DetectorChannel).First());

        var entries = detectors.SelectMany(detector =>
            {
                var distance = stopBar ? 0 : detector.DistanceFromStopBar.GetValueOrDefault();
                return detections[detector.DetectorChannel].Select(entry => entry.Timestamp).Distinct()
                    .Select(timestamp => timestamp.AddSeconds(-detector.LatencyCorrection))
                    .Where(timestamp => timestamp >= warmup && timestamp < options.End)
                    .Select(timestamp => new CorridorEntry((timestamp - options.Start).TotalSeconds,
                        distance / feetPerSecond, signal.Distance + (reverse ? distance : -distance),
                        timestamp >= options.Start))
                    .Select(entry => (Entry: entry, Lane: detector.LaneNumber.GetValueOrDefault()));
            })
            .Where(item => !stopBar || greens.Any(green => item.Entry.Time >= green.Start && item.Entry.Time < green.End))
            .ToArray();
        return (entries.Select(item => item.Entry).OrderBy(entry => entry.Time + entry.SecondsToStopBar).ToArray(),
            entries.Where(item => item.Entry.Score && item.Lane > 0).Select(item => item.Lane).Distinct().Count());
    }

    private static bool IsActive(Detector detector, CorridorOffsetOptions options) =>
        detector.DateAdded <= options.Start && (detector.DateDisabled == null || detector.DateDisabled >= options.End);

    private static bool IsThrough(Detector detector) => detector.MovementType == MovementTypes.T;

    private static IReadOnlyList<CorridorGreen> GetGreens(Observation signal, Approach approach, DateTime start, DateTime end)
    {
        var overlap = approach.IsProtectedPhaseOverlap;
        var green = (short)(overlap ? IndianaEnumerations.OverlapBeginGreen : IndianaEnumerations.PhaseBeginGreen);
        var yellow = (short)(overlap ? IndianaEnumerations.OverlapBeginYellow : IndianaEnumerations.PhaseBeginYellowChange);
        var red = (short)(overlap ? IndianaEnumerations.OverlapBeginRedClearance : IndianaEnumerations.PhaseBeginRedClearance);
        var from = start.AddSeconds(-5 * signal.Cycle);
        var until = end.AddMinutes(30);
        var nextChange = signal.Events.FirstOrDefault(entry => entry.Timestamp >= end && entry.Timestamp < until &&
            ((IndianaEnumerations)entry.EventCode switch
            {
                IndianaEnumerations.CoordPatternChange => entry.EventParam != signal.Pattern,
                IndianaEnumerations.CycleLengthChange => entry.EventParam != signal.Cycle,
                IndianaEnumerations.OffsetLengthChange => entry.EventParam != signal.Offset,
                _ => false
            }));
        if (nextChange != null)
            until = nextChange.Timestamp;
        var windows = new List<CorridorGreen>();
        DateTime? opening = null;
        foreach (var entry in signal.Events.Where(entry => entry.Timestamp >= from && entry.Timestamp <= until &&
            entry.EventParam == approach.ProtectedPhaseNumber))
        {
            if (entry.EventCode == green)
                opening = entry.Timestamp;
            else if ((entry.EventCode == yellow || entry.EventCode == red) && opening.HasValue)
            {
                if (entry.Timestamp > opening)
                    windows.Add(new CorridorGreen((opening.Value - start).TotalSeconds, (entry.Timestamp - start).TotalSeconds));
                opening = null;
            }
        }
        return windows;
    }

    private static bool HasGreenCoverage(IReadOnlyList<CorridorGreen> greens, int cycle, double duration)
    {
        var limit = 2.5 * cycle;
        var lastGreen = -limit;
        foreach (var green in greens)
        {
            if (green.End < -limit)
                continue;
            if (green.Start > duration)
                break;
            if (green.Start - Math.Max(lastGreen, -limit) > limit)
                return false;
            lastGreen = green.End;
        }
        return duration - lastGreen <= limit;
    }

    private static int StableSetting(IReadOnlyList<IndianaEvent> events, IndianaEnumerations code,
        CorridorOffsetOptions options, string id)
    {
        var matching = events.Where(entry => entry.EventCode == (short)code).ToArray();
        var initial = matching.LastOrDefault(entry => entry.Timestamp <= options.Start);
        if (initial == null)
            throw new InvalidOperationException($"Signal {id} has no logged {code} at the start of this window.");
        if (matching.Any(entry => entry.Timestamp > options.Start && entry.Timestamp < options.End &&
            entry.EventParam != initial.EventParam))
            throw new InvalidOperationException($"Signal {id} changes {code} during the selected window. Choose a stable plan period.");
        return initial.EventParam;
    }

    private static Approach FindApproach(Location location, int phase, DirectionTypes direction, bool overlap)
        => location.Approaches.FirstOrDefault(approach => approach.ProtectedPhaseNumber == phase &&
            approach.DirectionTypeId == direction && approach.IsProtectedPhaseOverlap == overlap)
            ?? throw new InvalidOperationException($"Signal {location.LocationIdentifier} has no matching approach for phase {phase}.");

    private static int CenterShift(int shift, int cycle)
        => ((shift + cycle / 2) % cycle + cycle) % cycle - cycle / 2;
}
