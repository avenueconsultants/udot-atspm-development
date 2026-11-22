using System;
using System.Collections.Generic;
using System.Linq;
using Utah.Udot.Atspm.Business.CorridorOffsets;
using Xunit;

namespace Utah.Udot.Atspm.ApplicationTests.Business.CorridorOffsets;

public class CorridorReplayTests
{
    [Fact]
    public void QueueAtMiddleSignalChangesDownstreamArrival()
    {
        var input = CreateInput();
        var existing = CorridorReplay.Evaluate("Existing", [0, 0, 0], input, true);
        var changed = CorridorReplay.Evaluate("Changed", [0, -12, 0], input, true);

        Assert.Equal(22, existing.Directions[0].DelaySeconds);
        Assert.Equal(2, existing.Directions[0].Stops);
        Assert.Equal(0, changed.Directions[0].DelaySeconds);
        Assert.Equal(1, changed.Directions[0].NonstopVehicles);
        Assert.Contains(existing.Plot.Trajectories[0].Points, point => point == new CorridorPoint(32, 500));
        Assert.Contains(changed.Plot.Trajectories[0].Points, point => point == new CorridorPoint(20, 500));
    }

    [Fact]
    public void OptimizationScoresBothDirectionsAndRespectsDirectionalLimit()
    {
        var input = CreateInput() with { MaxDirectionalIncrease = 0 };
        var result = CorridorReplay.Optimize(input, [], []);

        Assert.Equal(0, result.Proposed.Shifts[0]);
        Assert.Equal(0, result.Proposed.Shifts[2]);
        Assert.Equal(1, result.Proposed.Directions[0].Vehicles);
        Assert.Equal(1, result.Proposed.Directions[1].Vehicles);
        Assert.True(result.Proposed.Directions[0].DelaySeconds < result.Existing.Directions[0].DelaySeconds);
        Assert.True(result.Proposed.Directions[1].DelaySeconds <= result.Existing.Directions[1].DelaySeconds);
    }

    [Fact]
    public void QueueDischargesInOrderAcrossCyclesAndWarmupTrafficIsUnscored()
    {
        var input = CreateInput();
        var day = input.Days[0];
        var west = day.Opposing;
        var east = new CorridorDirection("EB", [
            new(10, 2, [new(5, 8), new(25, 45)]),
            new(10, 2, [new(0, 120)]),
            new(0, 2, [new(0, 120)])
        ], [new(-1, 0, 0, false), new(0, 0, 0, true), new(1, 0, 0, true)], false);
        var result = CorridorReplay.Evaluate("Existing", [0, 0, 0],
            input with { Days = [day with { Primary = east, Opposing = west }] }, true);

        Assert.Equal(2, result.Directions[0].Vehicles);
        Assert.Equal(55, result.Directions[0].DelaySeconds);
        Assert.Contains(result.Plot.Trajectories[0].Points, point => point == new CorridorPoint(27, 0));
        Assert.Contains(result.Plot.Trajectories[1].Points, point => point == new CorridorPoint(29, 0));
    }

    [Fact]
    public void APlanWithoutEnoughGreenCoverageCannotWinByDroppingVehicles()
    {
        var input = CreateInput();
        var day = input.Days[0];
        var primary = day.Primary with { Approaches = [new(10, 2, []), .. day.Primary.Approaches.Skip(1)] };
        Assert.Null(CorridorReplay.Evaluate("Incomplete", [0, 0, 0], input with { Days = [day with { Primary = primary }] }));
    }

    [Fact]
    public void LinkPivotPlanCanBeComparedWithoutSeedingAnOutOfBoundsSearch()
    {
        var input = CreateInput() with { MaxShift = 0 };
        var result = CorridorReplay.Optimize(input, [("Link Pivot", [0, -12, 0])], []);

        Assert.Single(result.LinkPivot);
        Assert.Equal(0, result.LinkPivot[0].Directions[0].DelaySeconds);
        Assert.Equal(new int[3], result.Proposed.Shifts);
    }

    private static CorridorInput CreateInput()
    {
        IReadOnlyList<CorridorGreen> open = [new(-60, 120)];
        var primary = new CorridorDirection("EB", [
            new(10, 2, open),
            new(10, 2, [new(20, 45), new(60, 90)]),
            new(0, 2, [new(15, 23), new(40, 90)])
        ], [new(0, 0, 0, true)], false);
        var opposing = new CorridorDirection("WB", [
            new(0, 2, open),
            new(10, 2, [new(20, 45), new(60, 90)]),
            new(10, 2, open)
        ], [new(22, 0, 500, true)], false);

        return new CorridorInput(60, [new("A", "A", 0, 0, true), new("B", "B", 250, 15, false),
            new("C", "C", 500, 30, true)], [new(new DateTime(2026, 11, 20, 16, 0, 0), 60, primary, opposing)], 20, null);
    }
}
