using System.Text.Json;

namespace Utah.Udot.Atspm.ConfigApi.Services.ConfigReview;

public sealed record Source(string Kind, string Name, string Sha256, string Decoder, string[] Groups);
public sealed record Firmware(string Text, string? Version);
public sealed record PhaseRecord(int Phase, bool? InUse, int? Ring, string? Barrier, int[]? Concurrent,
    decimal? MinGreen, decimal? Passage, decimal? MaxGreen1, decimal? MaxGreen2,
    decimal? YellowChange, decimal? RedClear, decimal? Walk, decimal? PedClear, int? Options, string? Source);
public sealed record ExcludedPhase(int Phase, string Reason);
public sealed record Overlap(int OverlapNumber, int Type, int[] IncludedPhases, int[] ModifierPhases,
    decimal? TrailGreen, decimal? TrailYellow, decimal? TrailRed, string? Source)
{
    [System.Text.Json.Serialization.JsonPropertyName("overlap")]
    public int OverlapNumber { get; init; } = OverlapNumber;
}
public sealed record Pattern(int PatternNumber, int Cycle, int Offset, int? SplitNumber, int? SequenceNumber, string? Source)
{
    [System.Text.Json.Serialization.JsonPropertyName("pattern")]
    public int PatternNumber { get; init; } = PatternNumber;
}
public sealed record SplitTable(int SplitNumber, Dictionary<int, decimal[]> RingSplits, string? Source);
public sealed record Sequence(int SequenceNumber, Dictionary<int, int[]> RingPhases, string? Source);
public sealed record DetectorRecord(int Channel, int? CallPhase, int? SwitchPhase, decimal? Delay, decimal? Extend,
    int? Options, string? Source);
public sealed record ControllerStatus(int? RunningPattern, int? CoordCycleTime);
public sealed record SnapshotConflict(string Group, string Field, JsonElement FirstValue, string FirstSource,
    JsonElement SecondValue, string SecondSource);

public sealed class ControllerSnapshot
{
    public required int SchemaVersion { get; init; }
    public required string LocationIdentifier { get; init; }
    public required string Make { get; init; }
    public required string Model { get; init; }
    public Firmware? Firmware { get; init; }
    public required DateTimeOffset CollectedAt { get; init; }
    public DateTimeOffset? ConfigWrittenAt { get; init; }
    public required Source[] Sources { get; init; }
    public PhaseRecord[] Phases { get; init; } = [];
    public ExcludedPhase[] PhasesNotInUse { get; init; } = [];
    public Overlap[] Overlaps { get; init; } = [];
    public Pattern[] Patterns { get; init; } = [];
    public SplitTable[] SplitTables { get; init; } = [];
    public Sequence[] Sequences { get; init; } = [];
    public DetectorRecord[] Detectors { get; init; } = [];
    public ControllerStatus? Status { get; init; }
    public required string[] Unavailable { get; init; }
    public SnapshotConflict[] Conflicts { get; init; } = [];
    public string[] Notes { get; init; } = [];
    public Dictionary<string, Source[]> FieldSources { get; set; } = [];
}
