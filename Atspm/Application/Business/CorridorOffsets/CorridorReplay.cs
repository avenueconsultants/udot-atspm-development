namespace Utah.Udot.Atspm.Business.CorridorOffsets;

public record CorridorGreen(double Start, double End);
public record CorridorSignal(string Id, string Name, double Distance, int Offset, bool Locked);
public record CorridorApproach(double TravelSeconds, double Headway, IReadOnlyList<CorridorGreen> Greens);
public record CorridorEntry(double Time, double SecondsToStopBar, double Distance, bool Score);
public record CorridorDirection(string Name, IReadOnlyList<CorridorApproach> Approaches,
    IReadOnlyList<CorridorEntry> Entries, bool EnteringAfterSignal);
public record CorridorDay(DateTime Start, double Duration, CorridorDirection Primary, CorridorDirection Opposing);
public record CorridorInput(int Cycle, IReadOnlyList<CorridorSignal> Signals, IReadOnlyList<CorridorDay> Days,
    int MaxShift, double? MaxDirectionalIncrease);
public record CorridorPoint(double Time, double Distance);
public record CorridorTrajectory(bool Opposing, IReadOnlyList<CorridorPoint> Points);
public record CorridorMetrics(string Direction, int Vehicles, double DelaySeconds, int Stops, int NonstopVehicles)
{
    public double MeanDelay => Vehicles == 0 ? 0 : DelaySeconds / Vehicles;
}
public record CorridorPlot(DateTime Start, double Duration, IReadOnlyList<CorridorPlotSignal> Signals,
    IReadOnlyList<CorridorTrajectory> Trajectories);
public record CorridorPlotSignal(double Distance, IReadOnlyList<CorridorGreen> Primary, IReadOnlyList<CorridorGreen> Opposing);
public record CorridorPlan(string Name, IReadOnlyList<int> Shifts, IReadOnlyList<CorridorMetrics> Directions, CorridorPlot Plot);
public record CorridorResult(int Cycle, IReadOnlyList<CorridorSignal> Signals, CorridorPlan Existing,
    CorridorPlan Proposed, IReadOnlyList<CorridorPlan> LinkPivot, IReadOnlyList<string> Notes);

public static class CorridorReplay
{
    private const double StartUpSeconds = 2;
    private const double TimeTolerance = 0.0001;
    private const int PlotLinesPerDirection = 160;

    public static CorridorResult Optimize(CorridorInput input,
        IReadOnlyList<(string Name, int[] Shifts)> linkPivot,
        IReadOnlyList<string> notes, CancellationToken cancellationToken = default)
    {
        var baseline = Evaluate("Existing", new int[input.Signals.Count], input);
        if (baseline == null)
            throw new InvalidOperationException("The observed green windows do not cover the time needed to clear existing traffic.");

        var comparisons = new List<CorridorPlan>();
        var seeds = new List<CorridorPlan> { baseline };
        foreach (var (name, shifts) in linkPivot)
        {
            var comparison = Evaluate(name, shifts, input);
            if (comparison == null)
                continue;
            comparisons.Add(comparison);
            if (shifts.Select((shift, index) => Math.Abs(shift) <= input.MaxShift &&
                    (!input.Signals[index].Locked || shift == 0)).All(value => value) &&
                WithinDirectionalLimit(comparison, baseline, input.MaxDirectionalIncrease))
                seeds.Add(comparison);
        }

        var best = baseline;
        foreach (var seed in seeds)
        {
            var current = seed;
            foreach (var step in new[] { 5, 1 })
            {
                while (true)
                {
                    var before = current;
                    for (var signal = 0; signal < input.Signals.Count; signal++)
                    {
                        if (input.Signals[signal].Locked)
                            continue;
                        for (var shift = -input.MaxShift; shift <= input.MaxShift; shift++)
                        {
                            if (step > 1 && shift % step != 0)
                                continue;
                            var candidate = current.Shifts.ToArray();
                            candidate[signal] = shift;
                            current = TryCandidate(candidate, current);
                        }
                    }

                    for (var signal = 0; signal + 1 < input.Signals.Count; signal++)
                    {
                        if (input.Signals[signal].Locked || input.Signals[signal + 1].Locked)
                            continue;
                        foreach (var change in new[] { -step, step })
                        {
                            var candidate = current.Shifts.ToArray();
                            candidate[signal] += change;
                            candidate[signal + 1] += change;
                            if (Math.Abs(candidate[signal]) <= input.MaxShift &&
                                Math.Abs(candidate[signal + 1]) <= input.MaxShift)
                                current = TryCandidate(candidate, current);
                        }
                    }

                    if (ReferenceEquals(before, current))
                        break;
                }
            }
            if (IsBetter(current, best))
                best = current;
        }

        return new CorridorResult(input.Cycle, input.Signals,
            Evaluate(baseline.Name, baseline.Shifts, input, true),
            Evaluate("Corridor", best.Shifts, input, true),
            comparisons.Select(plan => Evaluate(plan.Name, plan.Shifts, input, true)).ToArray(), notes);

        CorridorPlan TryCandidate(int[] shifts, CorridorPlan current)
        {
            cancellationToken.ThrowIfCancellationRequested();
            if (shifts.SequenceEqual(current.Shifts))
                return current;
            var candidate = Evaluate("Corridor", shifts, input);
            return candidate != null && IsBetter(candidate, current) &&
                WithinDirectionalLimit(candidate, baseline, input.MaxDirectionalIncrease) ? candidate : current;
        }
    }

    public static CorridorPlan Evaluate(string name, IReadOnlyList<int> shifts, CorridorInput input, bool draw = false)
    {
        var totals = new[] { new CorridorMetrics(input.Days[0].Primary.Name, 0, 0, 0, 0),
            new CorridorMetrics(input.Days[0].Opposing.Name, 0, 0, 0, 0) };
        CorridorPlot plot = null;
        for (var dayIndex = 0; dayIndex < input.Days.Count; dayIndex++)
        {
            var day = input.Days[dayIndex];
            var trajectories = draw && dayIndex == 0 ? new List<CorridorTrajectory>() : null;
            for (var directionIndex = 0; directionIndex < totals.Length; directionIndex++)
            {
                var direction = directionIndex == 0 ? day.Primary : day.Opposing;
                var metrics = RunDirection(input.Signals, direction, shifts, directionIndex == 1, trajectories);
                if (metrics == null)
                    return null;
                var total = totals[directionIndex];
                totals[directionIndex] = total with { Vehicles = total.Vehicles + metrics.Vehicles,
                    DelaySeconds = total.DelaySeconds + metrics.DelaySeconds,
                    Stops = total.Stops + metrics.Stops, NonstopVehicles = total.NonstopVehicles + metrics.NonstopVehicles };
            }

            if (trajectories != null)
            {
                var plotDuration = trajectories.Select(trajectory => trajectory.Points[^1].Time)
                    .DefaultIfEmpty(day.Duration).Max();
                plotDuration = Math.Max(day.Duration, plotDuration);
                var displaySignals = input.Signals.Select((signal, index) => new CorridorPlotSignal(signal.Distance,
                    ShiftForPlot(day.Primary.Approaches[index].Greens, shifts[index], plotDuration),
                    ShiftForPlot(day.Opposing.Approaches[index].Greens, shifts[index], plotDuration))).ToArray();
                plot = new CorridorPlot(day.Start, plotDuration, displaySignals, trajectories);
            }
        }
        return new CorridorPlan(name, shifts, totals, plot);
    }

    private static CorridorMetrics RunDirection(IReadOnlyList<CorridorSignal> signals, CorridorDirection direction,
        IReadOnlyList<int> shifts, bool reverse, List<CorridorTrajectory> trajectories)
    {
        var lastDeparture = Enumerable.Repeat(double.NegativeInfinity, signals.Count).ToArray();
        var greenIndices = new int[signals.Count];
        var delay = 0d;
        var stops = 0;
        var nonstop = 0;
        var scored = 0;
        var stride = trajectories == null ? 1 :
            Math.Max(1, (int)Math.Ceiling(direction.Entries.Count(entry => entry.Score) / (double)PlotLinesPerDirection));

        foreach (var entry in direction.Entries)
        {
            var points = trajectories != null && entry.Score && scored % stride == 0
                ? new List<CorridorPoint> { new(entry.Time, entry.Distance) } : null;
            var arrival = entry.Time + entry.SecondsToStopBar;
            var vehicleStops = 0;
            for (var visit = 0; visit < signals.Count; visit++)
            {
                var index = reverse ? signals.Count - visit - 1 : visit;
                var approach = direction.Approaches[index];
                var departure = arrival;
                if (visit != 0 || !direction.EnteringAfterSignal)
                {
                    var earliest = Math.Max(arrival, lastDeparture[index] + approach.Headway);
                    departure = NextDeparture(approach.Greens, shifts[index], arrival, earliest, ref greenIndices[index]);
                    if (!double.IsFinite(departure))
                    {
                        if (entry.Score)
                            return null;
                        break;
                    }
                    lastDeparture[index] = departure;
                }

                points?.Add(new CorridorPoint(arrival, signals[index].Distance));
                var wait = departure - arrival;
                if (wait > TimeTolerance)
                {
                    vehicleStops++;
                    if (entry.Score)
                        delay += wait;
                    points?.Add(new CorridorPoint(departure, signals[index].Distance));
                }
                arrival = departure + approach.TravelSeconds;
            }

            if (!entry.Score)
                continue;
            scored++;
            stops += vehicleStops;
            if (vehicleStops == 0)
                nonstop++;
            if (points != null)
                trajectories.Add(new CorridorTrajectory(reverse, points));
        }
        return new CorridorMetrics(direction.Name, scored, delay, stops, nonstop);
    }

    private static double NextDeparture(IReadOnlyList<CorridorGreen> greens, int shift,
        double arrival, double earliest, ref int index)
    {
        for (; index < greens.Count; index++)
        {
            var start = greens[index].Start + shift;
            var end = greens[index].End + shift;
            var available = arrival < start ? start + StartUpSeconds : start;
            var departure = Math.Max(earliest, available);
            if (departure < end)
                return departure;
        }
        return double.PositiveInfinity;
    }

    private static CorridorGreen[] ShiftForPlot(IReadOnlyList<CorridorGreen> greens, int shift, double duration)
        => greens.Select(green => new CorridorGreen(green.Start + shift, green.End + shift))
            .Where(green => green.End >= 0 && green.Start <= duration)
            .Select(green => new CorridorGreen(Math.Max(0, green.Start), Math.Min(duration, green.End))).ToArray();

    private static bool WithinDirectionalLimit(CorridorPlan candidate, CorridorPlan baseline, double? limit)
        => !limit.HasValue || candidate.Directions.Select((direction, index) =>
            direction.MeanDelay <= baseline.Directions[index].MeanDelay + limit.Value + TimeTolerance).All(value => value);

    private static bool IsBetter(CorridorPlan candidate, CorridorPlan best)
    {
        var score = Math.Round(candidate.Directions.Sum(direction => direction.DelaySeconds), 4);
        var bestScore = Math.Round(best.Directions.Sum(direction => direction.DelaySeconds), 4);
        return score < bestScore ||
            (score == bestScore && candidate.Shifts.Sum(Math.Abs) < best.Shifts.Sum(Math.Abs));
    }
}
