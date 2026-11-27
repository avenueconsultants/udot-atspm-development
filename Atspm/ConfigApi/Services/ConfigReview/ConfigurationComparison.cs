using System.Text.Json;
using System.Text.Json.Nodes;
using Utah.Udot.Atspm.Data.Models;
using Utah.Udot.Atspm.Data.Models.ConfigReviewModels;

namespace Utah.Udot.Atspm.ConfigApi.Services.ConfigReview;

public sealed record BaselineDetector(int Id, int Channel, int? Lane, int Movement, DateTime DateAdded, DateTime? DateDisabled);
public sealed record BaselineApproach(int Id, int Phase, bool Overlap, int Direction, string? Description,
    int? PermissivePhase, bool PermissiveOverlap, int? PedestrianPhase, bool PedestrianOverlap,
    BaselineDetector[] Detectors);
public sealed record ReviewBaseline(int LocationId, DateTime Start, BaselineApproach[] Approaches, Dictionary<string, string> Fields);
public sealed record ReviewAnnotation(string Basis, string Reason, decimal? Confidence, int? Direction, int? Movement, int? Lane);
public sealed record ReviewItemUpdate(string Disposition, ReviewAnnotation? Annotation);
public sealed record RouteReviewLocation(Utah.Udot.Atspm.Data.Models.ConfigReviewModels.ConfigReview Review,
    bool BaselineCaptured, string? Firmware, int UndeclaredPedestrianPhases, int UnresolvedConflicts, int Findings);
public sealed record CreateReview(string? LocationIdentifier, int? RouteId, DateOnly AsOfDate);
public sealed record PromoteReview(string Reason, DateOnly? EffectiveDate);
public sealed record SnapshotReceipt(Guid? SnapshotId, ControllerSnapshot? Snapshot, IReadOnlyList<ConfigSnapshotFile> Files);
public sealed record ReviewReport(Utah.Udot.Atspm.Data.Models.ConfigReviewModels.ConfigReview Review, ReviewBaseline? Baseline,
    SnapshotReceipt Snapshot, IReadOnlyList<ConfigReviewItem> Items, IReadOnlyList<ConfigPromotionField> Promotions);

internal static class ConfigurationComparison
{
    internal static ReviewBaseline Capture(Location location, IEnumerable<LocationControllerField> fields, DateTime end)
    {
        var approaches = location.Approaches.OrderBy(ap => ap.Id).Select(ap => new BaselineApproach(
            ap.Id, ap.ProtectedPhaseNumber, ap.IsProtectedPhaseOverlap, (int)ap.DirectionTypeId, ap.Description,
            ap.PermissivePhaseNumber, ap.IsPermissivePhaseOverlap, ap.PedestrianPhaseNumber, ap.IsPedestrianPhaseOverlap,
            ap.Detectors.Where(detector => detector.DateAdded < end &&
                (!detector.DateDisabled.HasValue || detector.DateDisabled.Value >= end.AddDays(-1)))
                .OrderBy(detector => detector.Id)
                .Select(detector => new BaselineDetector(detector.Id, detector.DetectorChannel, detector.LaneNumber,
                    (int)detector.MovementType, detector.DateAdded, detector.DateDisabled)).ToArray())).ToArray();
        return new(location.Id, location.Start, approaches, fields.OrderBy(field => field.Field)
            .ToDictionary(field => field.Field, field => field.Value));
    }

    internal static List<ConfigReviewItem> Compare(Guid reviewId, ReviewBaseline baseline, ControllerSnapshot snapshot)
    {
        var result = new List<ConfigReviewItem>();
        var payload = JsonSerializer.SerializeToNode(snapshot, SnapshotContract.Json)!.AsObject();
        var unavailable = snapshot.Unavailable.ToHashSet();
        var excluded = snapshot.PhasesNotInUse.Select(phase => phase.Phase).ToHashSet();
        foreach (var (collection, key) in SnapshotContract.Collections)
        {
            if (collection == "phasesNotInUse" || unavailable.Contains(collection))
                continue;
            foreach (var record in payload[collection]!.AsArray())
            {
                var data = record!.AsObject();
                var number = data[key]!.GetValue<int>();
                if (collection == "phases" && (excluded.Contains(number) || data["inUse"]?.GetValue<bool>() == false))
                    continue;
                if (collection == "overlaps" && data["type"]!.GetValue<int>() <= 1)
                    continue;
                foreach (var (property, proposed) in data)
                {
                    if (property == key || property == "source" || proposed == null ||
                        (collection == "detectors" && property == "callPhase"))
                        continue;
                    var group = SnapshotContract.GroupFor(collection, property);
                    if (!unavailable.Contains(group))
                        AddField($"{collection}.{number}.{property}", group, proposed.ToJsonString(),
                            data["source"]?.GetValue<string>());
                }
            }
        }
        if (snapshot.Firmware != null && !unavailable.Contains("firmware"))
            AddField("firmware", "firmware", SnapshotContract.Serialize(snapshot.Firmware), null);
        if (snapshot.ConfigWrittenAt.HasValue && !unavailable.Contains("configWrittenAt"))
            AddField("configWrittenAt", "configWrittenAt", SnapshotContract.Serialize(snapshot.ConfigWrittenAt), null);

        if (!unavailable.Contains("phases") && !unavailable.Contains("phaseStructure"))
        {
            foreach (var phase in snapshot.Phases.Where(p => p.InUse == true))
            {
                var isDeclared = baseline.Approaches.Any(ap => (!ap.Overlap && ap.Phase == phase.Phase) ||
                    (!ap.PermissiveOverlap && ap.PermissivePhase == phase.Phase));
                if (!isDeclared)
                    Add($"approaches.{phase.Phase}", "phaseStructure", "NeedsDirection",
                        $"Phase {phase.Phase} is in use and has no ATSPM approach.", "null",
                        SnapshotContract.Serialize(phase.Phase), phase.Source);
                // NeedsDirection, not Held: the controller settles that a pedestrian movement is
                // programmed here, and the only thing missing is which approach carries it. Held
                // would make this unpromotable, and it is the most common finding on a corridor -
                // 71 of them across 19 locations on R2:192, where no approach anywhere records a
                // pedestrianPhaseNumber. Until it is declared the crossing is served on the street
                // and absent from pedestrian delay, pedestrian actuations and the StuckPed watchdog,
                // all of which select their phases from the configuration.
                if (phase.Walk > 0 && phase.PedClear > 0 &&
                    !baseline.Approaches.Any(ap => !ap.PedestrianOverlap && ap.PedestrianPhase == phase.Phase))
                    Add($"pedestrian.{phase.Phase}", "phaseStructure", "NeedsDirection",
                        $"Phase {phase.Phase} is programmed for pedestrians - walk {phase.Walk}s, clearance " +
                        $"{phase.PedClear}s - and no ATSPM approach declares a pedestrian phase for it. " +
                        $"Walk plus clearance also sets a floor under the phase, so a cycle shortened " +
                        $"without it is shortened below what the crossing needs.",
                        "null", SnapshotContract.Serialize(phase.Phase), phase.Source);
            }
        }

        if (!unavailable.Contains("detectors"))
        {
            foreach (var detector in snapshot.Detectors)
            {
                var matches = baseline.Approaches.Where(ap => ap.Detectors.Any(d => d.Channel == detector.Channel)).ToArray();
                var field = $"detectors.{detector.Channel}.callPhase";
                if (detector.CallPhase is null or 0)
                {
                    if (matches.Length == 0)
                        Add(field, "detectors", "NotComparable", $"Channel {detector.Channel} is not assigned to a call phase.",
                            "null", "null", detector.Source);
                    continue;
                }

                if (matches.Any(ap => ap.Overlap || ap.Phase == detector.CallPhase ||
                    (!ap.PermissiveOverlap && ap.PermissivePhase == detector.CallPhase)))
                    continue;
                // A channel ATSPM already places on a different phase is not the same finding as one
                // it has never heard of, and the difference matters: at 7423 channels 18 and 20 are
                // each on the other's phase, which makes every measure drawn from them read the
                // wrong approach. The cabinet settles which phase the channel calls; which of
                // ATSPM's fields is wrong - the phase, the direction, or the field wiring - needs a
                // look at the intersection, so it stays a finding rather than a correction.
                var summary = matches.Length == 0
                    ? $"Channel {detector.Channel} calls phase {detector.CallPhase} and needs an approach assignment."
                    : $"Channel {detector.Channel} calls phase {detector.CallPhase} in the controller, and ATSPM has " +
                      $"it on {string.Join(", ", matches.Select(ap => $"phase {ap.Phase}"))}. One of the two is wrong " +
                      $"about this approach, and every measure drawn from the channel follows ATSPM.";
                Add(field, "detectors", "NeedsDirection", summary,
                    SnapshotContract.Serialize(matches.Select(ap => ap.Phase)),
                    SnapshotContract.Serialize(detector.CallPhase), detector.Source);
            }
        }
        foreach (var conflict in snapshot.Conflicts)
            Add($"!{conflict.Field}", conflict.Group, "Held", "Snapshot sources disagree on this field.",
                conflict.FirstValue.GetRawText(), conflict.SecondValue.GetRawText(), null,
                SnapshotContract.Serialize(new { conflict.FirstSource, conflict.SecondSource }));
        return result;

        void AddField(string field, string group, string proposed, string? source)
        {
            var existing = baseline.Fields.GetValueOrDefault(field, "null");
            if (JsonNode.DeepEquals(JsonNode.Parse(existing), JsonNode.Parse(proposed)))
                return;
            // Most of what a controller holds has nowhere to live in ATSPM, so the common case here
            // is not a disagreement but a field ATSPM has never stored. Saying "differs from the
            // stored ATSPM value" about an empty field reads as a discrepancy to chase and buries
            // the handful of real ones: at 7423 it would have produced 121 of them against 13
            // findings an engineer would act on. Name it for what it is, and drop the ones that
            // carry nothing - a controller zero against nothing stored says only that the
            // parameter is unused.
            if (existing == "null")
            {
                if (proposed is "0" or "0.0" or "false" or "null" or "[]" or "\"\"")
                    return;
                Add(field, group, "Certain",
                    $"{field}: the controller reports {proposed}. ATSPM stores nothing for this field.",
                    existing, proposed, source);
                return;
            }
            Add(field, group, "Certain", $"{field}: controller value differs from the stored ATSPM value.",
                existing, proposed, source);
        }

        void Add(string field, string group, string classification, string summary, string oldValue, string value,
            string? reportedSource, string? explicitSources = null)
        {
            result.Add(new ConfigReviewItem
            {
                Id = Guid.NewGuid(), ReviewId = reviewId, Field = field, Group = group, Classification = classification,
                Disposition = "Pending", Summary = summary, BaselineValue = oldValue, ControllerValue = value,
                Sources = explicitSources ?? SnapshotContract.Serialize(new
                {
                    reportedSource, sources = SnapshotContract.Sources(snapshot, group, field).ToArray()
                })
            });
        }
    }
}
