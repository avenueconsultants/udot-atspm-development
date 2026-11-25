# ATSPM Configuration Review — Design

Nov 25, 2026 · @Derek

Move the corridor configuration review out of an external page and into ATSPM, so ATSPM holds the reviewed configuration and every later step reads it from there. The review answers one question per location: does ATSPM describe the intersection the controller is actually running?

This covers the comparison tool only. Getting the snapshot — reaching field equipment, decoding controller files, reading NTCIP — is a separate tool with its own design, and nothing here contacts a controller.

## Purpose and scope

Configuration is the input to every ATSPM measure, so an answer about it belongs in the configuration database rather than in a run that ends. Today the review happens outside ATSPM, in scripts and a published page, and the answer is discarded when the run finishes.

The goal is a workflow an engineer completes in the browser: load what ATSPM has, upload what the cabinet holds, see the difference drawn rather than described, supply by hand what no machine can know, and promote the result — with provenance on every field, so a later reader can tell a measurement from an inference.

In scope:

- Loading current ATSPM configuration for a location or a route.
- Uploading controller configuration files and normalizing each one.
- Rendering ring-barrier structure, phase timing and detector assignment from controller data.
- Manual entry of what no controller holds, and of inferences produced elsewhere.
- Promoting an approved review into ATSPM configuration, with an audit trail.

Out of scope:

- Collecting from field equipment and decoding controller files. A separate tool does both and hands this one a normalized snapshot.
- Inference itself. The methods that attribute detectors to phases stay outside. This accepts their output as annotated input.
- Writing anything to a controller, by any route.

## What each source can supply

No single source is complete. Location 7423 has been read both ways and the two agree exactly where they overlap.

| Group | Econolite ASC3.DB | NTCIP over SNMP | MaxTime HTTP API |
| --- | --- | --- | --- |
| Phase timing | Yes | Yes, 56 of 56 fields identical | No |
| Phase ring, concurrency, enabled flag | Sequence table located, not decoded | Yes | No |
| Coordination patterns | Yes, 6 of 120 slots | Yes, same five patterns, same cycles and offsets | No |
| Split tables, per-phase seconds | Yes, only source | Pointer only | No |
| Detector call phase | Absent | Yes, 16 of 64 slots | No |
| Overlap definitions | Not located | Yes, with type separating configured from default | No |
| Date the cabinet wrote its database | Yes, only source | No | No |
| Direction, movement, lane | No | No | No |

Absent means searched for and not there. The detector plan was pursued six ways, ending in an enumeration of every array the Econolite firmware indexes by a counter field. There are four, with 16, 120, 100 and 99 records, none with 64. Not decoded means located but unfinished. No means the source has no such concept.

A snapshot can arrive with a group it cannot fill. The contract records that as unavailable, the merge rule specifies source precedence, and the UI explains when a source cannot supply a group. Which route filled which group is the collection tool’s business.

## The flow

1. **Load.** Fetch the version in effect for a chosen date for a location or the locations on a route. Store the baseline so promotion can detect subsequent configuration changes.
2. **Upload.** Attach a normalized snapshot per location, produced by the collection tool or posted by a client. Validate the contract and capture provenance.
3. **Review.** Render one structure with controller values in place, mark differences with their origins, and classify them. No configuration writes occur.
4. **Annotate.** Supply direction, movement, and lane. Record external inferences with their basis and confidence.
5. **Promote.** Write the approved items into ATSPM configuration for later analysis.

A review need not reach promotion to be useful. A location whose detector plan is unavailable can be promoted for its phases and timing while its channels stay open, and the review records which.

## Unified snapshot contract

Every collection source produces the same schema. Examples include an Econolite file, NTCIP, a MaxTime file if available, a central-system export, or an external client that derives structure another way.

```json
{
  "schemaVersion": 1,
  "locationIdentifier": "7423",
  "make": "Econolite",
  "model": "Cobalt",
  "firmware": { "text": "ASC3 Actuated Controller", "version": null },
  "collectedAt": "2026-11-25T10:26:00Z",
  "configWrittenAt": "2026-10-21T00:00:00Z",
  "sources": [
    { "kind": "file", "name": "ASC3.DB", "sha256": "...",
      "decoder": "Asc3ConfigDecoder", "groups": ["phases", "patterns", "splitTables"] }
  ],
  "phases": [
    { "phase": 2, "inUse": true, "ring": 1, "barrier": "A", "concurrent": [5, 6],
      "minGreen": 15, "passage": 1.6, "maxGreen1": 40, "maxGreen2": 0,
      "yellowChange": 4.8, "redClear": 1.5, "walk": 7, "pedClear": 18,
      "options": 1127, "source": "file:ASC3.DB@0x009050+36*1" }
  ],
  "phasesNotInUse": [{ "phase": 14, "reason": "ring0" }],
  "overlaps": [
    { "overlap": 1, "type": 1, "includedPhases": [1, 2], "modifierPhases": [],
      "trailGreen": 0, "trailYellow": 0, "trailRed": 0 }
  ],
  "patterns": [
    { "pattern": 1, "cycle": 150, "offset": 140, "splitNumber": 1, "sequenceNumber": 1 }
  ],
  "splitTables": [
    { "splitNumber": 1, "ringSplits": { "1": [28, 65, 18, 39], "2": [28, 65, 18, 39] } }
  ],
  "detectors": [
    { "channel": 18, "callPhase": 6, "switchPhase": null, "delay": 0, "extend": 0.0, "options": 144 }
  ],
  "status": { "runningPattern": 7, "coordCycleTime": 120 },
  "unavailable": ["splitTables"],
  "conflicts": [],
  "notes": ["ASC3.DT holds no populated descriptions"]
}
```

The JSON above illustrates the shape. A valid submission supplies actual checksums and lists a group as unavailable only when it supplies no records for that group.

- Ring comes from the controller. Derive barrier membership from connected components of concurrent phases. A standard controller produces A = {1,2,5,6} and B = {3,4,7,8}. Location 7521 runs 11 and 15 in the slots commonly occupied by 3 and 7.
- A phase in use requires an enabled flag, green time, and a ring. Templates at 7417 gave green time and rings to disabled phases. At 7521, two enabled phases had no green time. Ring 0 is unassigned. Record excluded phases and their reasons in `phasesNotInUse`.
- Concurrency and overlap phase lists carry one phase number per octet. For overlap 1 at 7423, octets 01 02 mean phases 1 and 2. Treating these octets as a bitmap gives the wrong set.
- Overlap type distinguishes firmware defaults from configured overlaps. At 7423, type 1 appears for four consecutive pairs and ATSPM declares no overlap approaches. At 7077, type 2 defines {5,7}, {1,3,11}, and {1,11}, which correspond to ATSPM overlaps 1, 2, and 4.
- `status` describes live controller state and is excluded from comparison and promotion.
- Detector records have no direction, movement, or lane. These are annotations.
- An empty detector list with no unavailable flag claims no detectors are present. Unavailable is required for a group the supplied sources cannot fill.

### Ring, barrier and sequence

| Element | Origin | Evidence |
| --- | --- | --- |
| Ring | Reported per phase | Proven on both makes |
| Barrier | Connected components of the concurrency relationship | Reproduces standard barriers and supports nonstandard phase numbers |
| Sequence | `patterns[].sequenceNumber` | The number is proven. A definition may be unavailable, like split seconds behind a split number. |

Phase keys are unrestricted by the standard eight-phase convention. Econolite reports 16 slots and MaxTime reports 40. Location 7077 operates phase 11 in ring 1, concurrent with 5 and 6 and serving two overlaps. At 7521, 11 and 15 replace 3 and 7. A previous renderer crashed on that configuration because its fixed maps could not place those phases.

### Merge and rendering

1. Prefer NTCIP over file for phase structure, overlaps, detectors, and patterns. Prefer file over NTCIP for split tables and the database write date. Use either for phase timing.
2. Identical values appear once, with both sources represented in `sources[].groups`.
3. Where values differ, precedence determines the displayed value and `conflicts` retains both values and both sources. The database write date can help explain a stale source.
4. Block promotion of a conflicted group until a reviewer dispositions the conflict.

At 7423 the sources agreed on all 56 phase timing fields and on cycle and offset for the five programmed patterns.

| On-screen element | Reads |
| --- | --- |
| Ring-barrier diagram | Phase ring, barrier, concurrency, and in-use flag |
| Scaled box widths | Selected pattern’s split table and ring splits |
| Phase and pedestrian timing | Phase timing fields, walk, and pedestrian clearance |
| Pattern selector and caption | Patterns |
| Detector chips | Channel and call phase |
| Overlap annotations | Included phases and overlap type |
| Firmware badge | Firmware |
| Read and cabinet write times | Collection and database write timestamps |
| Coverage notices | Unavailable groups and excluded phases |
| Conflict banner | Conflicts |
| Provenance marker | Source on the corresponding record |

## Data model and API

Add entities under `Atspm/Data/Models/ConfigReviewModels/` and DbSets on `ConfigContext`. A review keys on `locationIdentifier` and outlives a configuration version.

| Entity | Holds |
| --- | --- |
| ConfigReview | One attempt per location with Draft, Reviewed, Promoted, or Abandoned status |
| ConfigReviewBaseline | Captured ATSPM configuration |
| ConfigSnapshotFile | File name, SHA-256, size, storage flag, and parse report |
| ConfigSnapshot | Merged normalized contract |
| ConfigReviewItem | Classification, disposition, basis, and confidence for a difference |

The comparison assigns Certain, NeedsDirection, Held, or NotComparable. A person assigns Pending, Accepted, Rejected, or Deferred. An overlap approach’s protected number is an overlap key. Comparing it directly with the detector call phase created five false conflicts in one earlier review. A detector can belong to an approach without calling a phase. At 7423 this applies to 24 of 40 channels, including count and system detectors.

Attribute-routed endpoints under `/api/v1/ConfigReview`:

| Method | Path | Purpose |
| --- | --- | --- |
| POST | / | Create with location identifier and as-of date |
| POST | /{id}/load | Capture the baseline |
| POST | /{id}/files | Upload |
| GET | /{id}/snapshot | Return normalized contract and parse reports |
| PUT | /{id}/snapshot | Accept a validated external contract |
| GET | /{id}/items | Return classified differences |
| PATCH | /{id}/items/{itemId} | Record disposition and annotation |
| POST | /{id}/promote | Write accepted items into configuration |
| GET | /{id}/report | Return the reviewed state |

External clients supply a contract through PUT and identify their decoder as `external:<name>`.

## Web UI and promotion

Use the Next.js pages router, MUI, and generated React Query clients from the configuration API spec. Mount under `WebUI/src/pages/admin/config-review/[[...id]].tsx`. The feature has baseline and upload panels, a ring-barrier SVG, phase timing and detector assignment tables, a grouped difference list, an annotation drawer, and a promotion bar. Reuse the approach and detector editing forms for annotation where possible so validation stays aligned.

Draw one diagram with rings stacked and barriers in service order. Mark the controller value where it differs, with the original ATSPM value and provenance on the marker. Derive ring and barrier placement from controller data regardless of phase number.

### Versioning

`CopyLocationToNewVersion` sets the new version’s `Start` to today. A review for November 18 cannot correct that window by creating a November 25 version.

- **Correct in place.** Default when the as-of date falls inside the captured version. Keep its start unchanged.
- **New version.** Use when the field configuration changed. The operator supplies the effective date.

Every promoted field records snapshot ID, source checksum, approver, time, reason, and measured or inferred basis.

### Security

- Validate and reject malformed snapshots. Record a reason for a received rejection without storing its contents.
- Limit request size. Treat all snapshot fields as data, including names and provenance strings.
- Reject snapshots carrying credentials or account data.
- Upload and annotation require location-edit permission. Promotion requires a configuration owner.
- Promotion applies normal ATSPM configuration validation and audit. Collection and controller writes stay outside this tool.

## Phasing, validation, and open questions

1. Read-only comparison that accepts, compares, classifies, and durably renders snapshots.
2. Annotation and promotion, including effective dates and field-level audit.
3. Route-level reviews, including a 19-location corridor and roll-ups such as firmware and undeclared pedestrian phases.

- [ ] Standard eight-phase barriers and phases above 8 render without a hardcoded map.
- [ ] Location 7521 shows ring 1 as {1,2} then {4,11} and ring 2 as {5,6} then {8,15}.
- [ ] Phases not in use are excluded from programmed and undeclared findings.
- [ ] Overlap approaches never generate wrong-phase findings.
- [ ] Unassigned undeclared detectors are classified differently from assigned ones.
- [ ] Unavailable groups show a notice.
- [ ] Conflicts preserve both values and block the group until disposition.
- [ ] Invalid snapshots are rejected and recorded without partial storage.
- [ ] In-place promotion preserves Location.Start and a new version sets it.
- [ ] Inferred and measured promotions are distinguishable in the audit.

| Question | Blocks |
| --- | --- |
| Should the tool accept raw files or normalized snapshots only? | Upload and security surface |
| Should reviews share ConfigContext or use their own context? | Data model |
| Can promotion apply across a route in one action, and is partial promotion acceptable? | Promotion UI and API |
| Should the UI suggest direction from the corridor convention? Phase 2 is westbound at 17 of 19 locations on R2:192 and northbound where the road changes orientation. | Annotation design |

## Decisions for this branch

- Multipart upload accepts normalized JSON. The client PUT endpoint requires an external decoder label. ATSPM stores the validated contract, and records the original artifact’s digest and validation outcome.
- Review records share ConfigContext. Approved timing and controller fields are versioned against the ATSPM location and exposed at the configuration read endpoint by location identifier and as-of date.
- A route review creates one attempt and captures one baseline for each location with a version in effect. The route rollup links to those attempts. Approval and promotion operate per location and can select a subset of fields. The closed review retains all dispositions and the fields actually promoted.
- Configuration owners receive the ConfigReview:Promote permission. The annotation drawer uses the location editor’s direction and movement enum lookups while staging its changes in the review.
- Configuration Review retains collection and approval provenance separately. The controller collection and inference tools supply their own normalized output.