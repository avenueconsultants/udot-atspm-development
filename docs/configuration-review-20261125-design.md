# ATSPM Configuration Review — Design

Move the corridor configuration review out of an external page and into ATSPM, so ATSPM holds the
reviewed configuration and every later step reads it from there. The review answers one question
per location: does ATSPM describe the intersection the controller is actually running?

This covers the comparison tool only. Getting the snapshot — reaching field equipment, decoding
controller files, reading NTCIP — is a separate tool with its own design, and nothing here contacts
a controller.

## Purpose and scope

Configuration is the input to every ATSPM measure, so an answer about it belongs in the
configuration database rather than in a run that ends. Today the review happens outside ATSPM, in
scripts and a published page, and the answer is discarded when the run finishes.

The goal is a workflow an engineer completes in the browser: load what ATSPM has, upload what the
cabinet holds, see the difference drawn rather than described, supply by hand what no machine can
know, and promote the result — with provenance on every field, so a later reader can tell a
measurement from an inference.

In scope:

- Loading current ATSPM configuration for a location or a route.
- Accepting a normalized snapshot per location, validated against the contract below.
- Rendering ring-barrier structure, phase timing and detector assignment from controller data.
- Manual entry of what no controller holds, and of inferences produced elsewhere.
- Promoting an approved review into ATSPM configuration, with an audit trail.

Not in scope:

- Collecting from field equipment, and decoding controller files. A separate tool does both and
  hands this one a normalized snapshot. Nothing here contacts a controller.
- Inference itself. The methods that attribute detectors to phases stay outside; this accepts their
  output as annotated input.
- Writing anything to a controller, by any route.

## What each source can supply

No single source is complete, and this is measured rather than argued: location 7423 has been read
both ways and the two agree exactly where they overlap.

| Group | Econolite `ASC3.DB` | NTCIP over SNMP | MaxTime HTTP API |
| --- | --- | --- | --- |
| Phase timing | yes | yes — 56 of 56 fields identical | no |
| Phase ring, concurrency, enabled flag | sequence table located, not decoded | yes | no |
| Coordination patterns | yes — 6 of 120 slots | yes — same five patterns, same cycles and offsets | no |
| Split tables, per-phase seconds | yes, only source | pointer only | no |
| Detector call phase | absent | yes — 16 of 64 slots | no |
| Overlap definitions | not located | yes, with `type` separating configured from default | no |
| Date the cabinet wrote its database | yes, only source | no | no |
| Direction, movement, lane | no | no | no |

Three words in that table mean different things and must not be flattened. **Absent** means
searched for and not there: the detector plan was pursued six ways, ending in an enumeration of
every array the Econolite firmware indexes by a counter field — there are four, with 16, 120, 100
and 99 records, none with 64. **Not decoded** means located but unfinished. **No** means the source
has no such concept.

This matters to the comparison tool for one reason: a snapshot can arrive with a group it simply
cannot fill, and that is not the same as the controller having nothing there. Hence `unavailable` in
the contract, the source precedence in the merge rule, and the "this source cannot tell you" notices
in the UI. Which route filled which group is the collection tool's business; what arrives, and what
is missing from it, is this tool's.

## The flow

Five steps, each a distinct state on a `ConfigReview` row.

1. **Load.** Fetch the ATSPM configuration version in effect for a chosen date, for one location or
   every location on a route. The baseline is captured into the review rather than read live, so a
   later promotion can tell whether the configuration moved underneath it.
2. **Upload.** Attach a normalized snapshot, one per location, produced by the separate collection
   tool or posted by a client. The tool validates it against the schema and records where it came
   from; it does not parse controller files itself.
3. **Review.** The page draws one structure, not two: the controller's values stand in place of
   ATSPM's, each marked where it came from the controller and differs, and every difference is
   classified. Nothing is written yet.
4. **Annotate.** Supply direction, movement and lane for what the controller cannot describe, and
   record inferences with their basis and confidence.
5. **Promote.** Write the approved items into ATSPM configuration. From here the later analysis
   steps read ATSPM.

A review need not reach step 5 to be useful. A location whose detector plan is unavailable can be
promoted for its phases and timing while its channels stay open, and the review records which.

## The unified snapshot contract

Every route to controller data produces this same shape — Econolite file, NTCIP, a MaxTime file if
one is found, a central-system export, or an external client that derived structure some other way.
The page renders from it and nothing else, so a new source becomes a new producer of this contract
rather than a change to the UI, the API or the database.

```json
{
  "schemaVersion": 1,
  "locationIdentifier": "7423",
  "make": "Econolite", "model": "Cobalt",
  "firmware": { "text": "ASC3 Actuated Controller", "version": null },
  "collectedAt": "2026-11-25T10:26:00Z",
  "configWrittenAt": "2026-10-21T00:00:00Z",
  "sources": [
    { "kind": "file", "name": "ASC3.DB", "sha256": "...",
      "decoder": "Asc3ConfigDecoder", "groups": ["phases","patterns","splitTables"] }
  ],
  "phases": [
    { "phase": 2, "inUse": true, "ring": 1, "barrier": "A", "concurrent": [5,6],
      "minGreen": 15, "passage": 1.6, "maxGreen1": 40, "maxGreen2": 0,
      "yellowChange": 4.8, "redClear": 1.5, "walk": 7, "pedClear": 18,
      "options": 1127, "source": "file:ASC3.DB@0x009050+36*1" }
  ],
  "phasesNotInUse": [ { "phase": 14, "reason": "ring0" } ],
  "overlaps": [
    { "overlap": 1, "type": 1, "includedPhases": [1,2], "modifierPhases": [],
      "trailGreen": 0, "trailYellow": 0, "trailRed": 0 }
  ],
  "patterns": [
    { "pattern": 1, "cycle": 150, "offset": 140, "splitNumber": 1, "sequenceNumber": 1 }
  ],
  "splitTables": [
    { "splitNumber": 1, "ringSplits": { "1": [28,65,18,39], "2": [28,65,18,39] } }
  ],
  "sequences": [
    { "sequenceNumber": 1, "ringPhases": { "1": [1,2,3,4], "2": [5,6,7,8] } }
  ],
  "detectors": [
    { "channel": 18, "callPhase": 6, "switchPhase": null,
      "delay": 0, "extend": 0.0, "options": 144 }
  ],
  "status": { "runningPattern": 7, "coordCycleTime": 120 },
  "unavailable": ["splitTables"],
  "conflicts": [],
  "notes": ["ASC3.DT holds no populated descriptions"]
}
```

Rules that travel with it:

- **Ring and barrier are read, not assumed.** The eight-phase maps are a convention, not a fact:
  location 7521 runs no phase 3 and no phase 7 and fills those slots with 11 and 15. Ring comes from
  the controller; barrier is derived as the connected components of "may run concurrently with",
  which reproduces A = {1,2,5,6} and B = {3,4,7,8} on a standard controller and still works where
  the numbering does not.
- **`inUse` requires an enabled flag, green time and a ring.** All three failures were observed:
  7417 carries a firmware template giving green time and a ring to eight phases that are not
  enabled; 7521 enables two phases with no green time; a phase in ring 0 belongs to no ring and
  cannot be served. Phases failing the test go in `phasesNotInUse` with the reason, so a reader sees
  they were considered.
- **Phase lists are lists of phase numbers, one octet each.** `concurrent`, `includedPhases` and
  `modifierPhases` all decode this way — overlap 1 at 7423 returns the octets `01 02`, meaning
  phases 1 and 2. Read as a bitmap the same bytes give phases 1, 3, 10 and 11, which is wrong
  without looking wrong.
- **`overlaps[].type` separates a configured overlap from a firmware default.** 7423 returns four of
  type 1 holding consecutive pairs and ATSPM declares no overlap approaches there; 7077 returns
  three of type 2 holding {5,7}, {1,3,11} and {1,11}, and ATSPM declares overlap approaches 1, 2 and
  4 — the same three.
- **`status` is not configuration.** It is what the controller is doing at the moment of the read,
  useful for confirming a read landed on the right cabinet, and it must never be promoted or
  compared.
- **`detectors` carries no direction, movement or lane**, because no controller holds them. The
  schema has no field for them, so a decoder cannot invent one.
- **`callPhase` is the assignment this contract compares on.** NTCIP's `vehicleDetectorCallPhase`
  answers `noSuchName` on every firmware met so far — two MaxTime generations and Econolite ASC/3
  alike — and the value arrives in the `switchPhase` column. A producer that passes the raw column
  through leaves `callPhase` empty, and the comparison then reports no detector assignments at all:
  not an error, just silence. A snapshot carrying `switchPhase` without `callPhase` is rejected.
- **`unavailable` is mandatory** where no supplied source can fill a group. An empty `detectors`
  array with `unavailable: []` is a claim that the controller has none.

### Ring, barrier and sequence all come from the controller

None of the three is inferred from phase numbering.

| | Where it comes from | Status |
| --- | --- | --- |
| Ring | Reported per phase by the controller | Proven on both makes |
| Barrier | Derived from `concurrent` as the connected components of "may run concurrently with" | Proven; reproduces A = {1,2,5,6} and B = {3,4,7,8} on a standard controller |
| Sequence | `patterns[].sequenceNumber` names the sequence a pattern uses | The number is proven; the definition behind it is a pointer, like `splitNumber` |

A sequence number without its definition is the same situation as a split number without its split
seconds: the producing source declares the group `unavailable`, and the UI says so rather than
showing an empty one.

### Phase numbers are not limited to 8

The contract must not assume they are, and neither must anything reading it. Econolite controllers
on this corridor report 16 phase slots and MaxTime reports 40, and both are used above 8 in
practice:

- 7077 runs phase 11, in ring 1, concurrent with 5 and 6, and it drives two overlaps.
- 7521 runs phases 11 and 15 — and runs no phase 3 and no phase 7 at all, so 11 and 15 occupy those
  slots in the barrier structure.

Any phase number the controller reports is a valid key. A consumer that cannot place one has a bug,
not a missing case — the eight-phase maps are a convention, not a fact about any intersection. This
was learned the hard way: feeding 7521's phases above 8 into a renderer built on those maps produced
a phase with no ring and no barrier and took the whole page down.

## Merge rule, and what drives the screen

A snapshot may be built from more than one source, so precedence is stated rather than left to
whichever decoder ran last.

1. Per group, sources are ordered: NTCIP over file for phase structure, overlaps, detectors and
   patterns; file over NTCIP for split tables and the database write date. Phase timing may come
   from either, since they have been measured to agree.
2. Same field, same value from two sources: record once, list both in `sources[].groups`.
3. Same field, **different** values: precedence decides what displays, and the disagreement is
   appended to `conflicts` with both values and both sources. A conflict is never silently resolved
   and never dropped — two sources disagreeing about one controller is a finding, and can mean one
   is stale, which is what the write date exists to reveal.
4. A conflict in any group blocks promotion of that group until a person dispositions it.

Exercised once: at 7423 the file and NTCIP agreed on all 56 phase timing fields and on all five
programmed patterns' cycle and offset, producing no conflicts.

The page renders from the contract alone. This mapping is the acceptance criterion for the format —
an on-screen element with no row here means the contract is incomplete.

| On-screen element | Reads |
| --- | --- |
| Ring-barrier sequence diagram | `phases[].ring`, `.barrier`, `.concurrent`, `.inUse` |
| Box width when drawn to scale | `splitTables[].ringSplits` for the selected pattern |
| Phase order within a ring | `sequences[].ringPhases` |
| Phase timing table | all `phases[]` timing fields |
| Pedestrian rows | `phases[].walk`, `.pedClear` |
| Pattern selector and its caption | `patterns[]` |
| Detector-to-phase chips | `detectors[].channel`, `.callPhase` |
| Overlap annotations on phase boxes | `overlaps[].includedPhases`, `.type` |
| Firmware badge | `firmware` |
| "read on / cabinet wrote on" line | `collectedAt`, `configWrittenAt` |
| "this source cannot tell you" notices | `unavailable`, `phasesNotInUse` |
| Conflict banner | `conflicts` |
| Provenance on hover | the `source` on each record |
| Empty structure slots at load | nothing - the absence of `phases[].ring` and `.barrier` |
| Phase card order | `sequences[].ringPhases`, else ascending `phases[].phase` |
| Phase cards grouped into barriers | `phases[].concurrent` |
| Detector tray | `detectors[]` with no ATSPM detector on the same channel |
| Card correction ledger | `sources[]`, each record's `source`, and `conflicts` |
| Box widths drawn to scale, or the notice that they are not | `splitTables[].ringSplits` for the selected pattern |
| Movement arrows on a phase card | the baseline approach's direction and movement - never the phase number |
| Programmed split on a phase card | `splitTables[].ringSplits` indexed by position from `sequences[].ringPhases` |
| Remaining controller settings on a card | every other field present on the record, rendered generically |

## Data model and API

New entities in `Atspm/Data/Models/ConfigReviewModels/`, with DbSets on `ConfigContext` so a review
joins to `Location` and `Approach` without a second connection. They key on `locationIdentifier`,
not `locationId`: a review outlives any single configuration version, and a review keyed on the
integer would be orphaned the moment a new version was created.

| Entity | Holds |
| --- | --- |
| `ConfigReview` | One review per location per attempt. Status: Draft, Reviewed, Promoted, Abandoned |
| `ConfigReviewBaseline` | The ATSPM configuration as loaded — captured, not referenced |
| `ConfigSnapshotFile` | Per upload: name, sha256, size, whether stored, parse report |
| `ConfigSnapshot` | The merged normalized contract |
| `ConfigReviewItem` | One row per difference, with classification, disposition, basis and confidence |

`ConfigReviewItem.Classification` is set by the comparison, not by a person: **Certain** (the
controller settles it), **NeedsDirection** (phase known, direction not — promotable once annotated),
**Held** (cannot be decided from any data held), **NotComparable** (the two sources describe
different things). `Disposition` is the person's: Pending, Accepted, Rejected, Deferred.

Two comparison rules exist because both produced false findings before they were understood, and
both must be implemented as stated. **An overlap number is not a phase number** —
`Approach.ProtectedPhaseNumber` holds an overlap number when `IsProtectedPhaseOverlap` is set, and
comparing it against a call phase invented five conflicts at one location where there are none.
**A detector may belong to an approach and call no phase** — count and system detectors do exactly
that, 24 of 40 live channels at 7423. A controller's silence about a channel is never an ATSPM
error.

A third follows from the pedestrian findings: **a pedestrian movement the controller programs and
no approach declares is `NeedsDirection`, not `Held`.** The controller settles that the movement
exists; only the approach carrying it is missing. Classified `Held` it could never be promoted, and
it is the most common finding on a corridor — 71 across 19 locations on R2:192, where no approach
anywhere records a `pedestrianPhaseNumber`. Walk plus clearance also sets a floor under the phase,
so a cycle shortened without it is shortened below what the crossing needs.

Endpoints under `Atspm/ConfigApi`, attribute-routed rather than OData entity sets, in the manner of
`LocationController.CopyLocationToNewVersion`:

```
POST   /api/v1/ConfigReview                      create {locationIdentifier, asOfDate}
POST   /api/v1/ConfigReview/{id}/load            capture the ATSPM baseline
POST   /api/v1/ConfigReview/{id}/files           upload a snapshot
GET    /api/v1/ConfigReview/{id}/snapshot        the stored snapshot + validation report
PUT    /api/v1/ConfigReview/{id}/snapshot        accept a contract from a client
GET    /api/v1/ConfigReview/{id}/items           classified differences
PATCH  /api/v1/ConfigReview/{id}/items/{itemId}  disposition and annotation
POST   /api/v1/ConfigReview/{id}/promote         write accepted items into configuration
GET    /api/v1/ConfigReview/{id}/report          the reviewed state, for later steps
```

`PUT .../snapshot` is how an external client supplies a contract it produced itself — an agent that
parsed files, ran NTCIP, or derived structure from event logs. Validated against the schema and
recorded with `sources[].decoder = "external:<name>"`, so nothing later mistakes it for a file
parse.

## Web UI and promotion

Next.js pages router, MUI, orval-generated react-query clients from `api-specs/config-spec.json` —
matching the existing admin pages.

```
WebUI/src/pages/admin/config-review/[[...id]].tsx
WebUI/src/features/configReview/
  components/
    LoadBaselinePanel.tsx
    UploadSnapshotPanel.tsx   dropzone, schema validation report
    RingBarrierDiagram.tsx    SVG, from the contract
    BaselineView.tsx          what ATSPM holds, before any snapshot
    AssemblyBoard.tsx         one section per location, three zones
    StructureSlots.tsx        the diagram's drop targets, per plan
    PhaseCard.tsx             direction, role, pedestrian, its detectors, its ledger
    DetectorCard.tsx          channel, call phase, movement, lane, its ledger
    CardLedger.tsx            value, source, when, what it replaced
    CompletionGate.tsx        what is still missing, per location
    PhaseTimingTable.tsx
    DetectorAssignment.tsx
    DifferenceList.tsx        grouped by classification
    AnnotationDrawer.tsx      reuses features/locations/components/editApproach + editDetector
    PromoteBar.tsx            counts, and what is excluded and why
  cards.ts                    the four states, the card ledger, the save gate
  splits.ts                   split seconds by ring position, and the basis for it
  assignments.ts              the engineer's channel placements, and the drop resolution
```

`RingBarrierDiagram` takes `phases[]` with `ring`, `barrier` and `concurrent`, and lays out barriers
in service order with rings stacked. **It must not contain a phase-number-to-ring map.** Reuse
`editApproach` and `editDetector` for annotation, so the review edits through the same forms as the
existing editor and validation stays in one place.

One diagram, not two. Where the controller and ATSPM disagree, the controller's value is drawn in
place and marked as controller-sourced, with the ATSPM value and the provenance available on the
marker. Two diagrams side by side double what a reader has to hold in mind to find the one box that
disagrees, and the marking carries the same information in one view.

The diagram must place any phase number the snapshot contains, up to the controller's own maximum —
40 on MaxTime, 16 on Econolite — taking ring from the phase and barrier from `concurrent`. No
phase-number-to-ring or phase-number-to-barrier table anywhere in the component.

### The assembly board

The review surface is one scrolling page, one section per location in route order, and assembling a
configuration on it is the work rather than a side effect of reading a list. This replaces the
per-location detail page as the primary surface; the detail page stays reachable for one location's
audit trail.

The reason is measurable. At 7423 the comparison produced ninety-nine rows, of which ten were worth
an engineer's attention, and the most consequential — detector channels 18 and 20 each assigned to
the other's phase, which makes every measure drawn from them report the wrong approach — was one
sentence in a table of ninety-nine. On a board it is two cards sitting in the wrong boxes, and the
correction is dragging them across. Nineteen locations in one view also removes the click-through
that made the corridor feel like nineteen unrelated tasks.

Each location section has three zones, top to bottom:

1. **Structure.** The ring, barrier and sequence diagram for the selected plan, drawn as slots. At
   load the slots are empty, because ATSPM stores no ring, no barrier and no sequence — the empty
   diagram is an accurate statement of what is known, not a loading state.
2. **Phase cards**, in sequence order, lowest number first, each carrying the phase's direction,
   movement, protected or permissive role, pedestrian service, and the detector cards already
   assigned to it. Once concurrency is known the cards arrive grouped into their barrier, because
   `concurrent` is exactly the statement that two phases may run together.
3. **The tray** — detector cards belonging to no phase: every channel the controller reports with no
   ATSPM detector against it, which at 7423 is fourteen of sixteen.

#### What may be dragged, and what may not

A board that lets an engineer drag anything teaches them that every box is their opinion. Some boxes
are measurements, and moving one is how a correct configuration becomes wrong. Each field therefore
has one authority, and the board enforces it.

| Fact | Authority | On the board |
| --- | --- | --- |
| Ring, barrier membership, concurrency | Controller | Fills from the snapshot and locks. Draggable only while no source has reported it |
| Sequence, and phase order within a ring | Controller (`sequences[].ringPhases`) | Same |
| Overlap membership and type | Controller | Same |
| Phase timing, walk, pedestrian clearance | Controller | Never draggable; editable only as a proposed change to send to the controller, which is a later step |
| Which phase a channel calls | Controller (`detectors[].callPhase`) | Fills and locks |
| Which approach a detector belongs to | **Engineer** | Dragged. No device holds it |
| Direction, movement, lane, hardware, distance, speed | **Engineer** | Edited in place. No device holds direction in any form ATSPM can take |
| Whether a phase is protected or permissive for a movement | **Engineer**, from the controller's structure | Edited in place, with the structure shown beside it |

A drag before any source has spoken is a legitimate act: it records what the engineer knows. It is
stored as an assertion with basis `engineer`, and it ranks **below** a later measurement, so when the
controller arrives and contradicts it the measurement wins and the card logs the correction. That is
the one place where the board's precedence differs from the engineer being right: for structure the
device is the authority, and the engineer's placement is a provisional stand-in for a read that has
not happened yet. For direction and detector-to-approach the engineer is the authority permanently,
because every device on this corridor is silent about them — a radar knows lanes, not compass
bearings, and a controller knows channels, not which pavement they sit under.

#### A drop names a phase; ATSPM stores an approach

A phase card is the obvious thing to drag a channel onto, and it is not what ATSPM records. A
detector hangs off an `Approach`, and an approach carries a phase, a direction and a description —
so a drop has to be resolved from the phase the person aimed at to the approach the database needs.
Three cases, and the board distinguishes them rather than picking for the person:

- **One approach carries the phase.** The drop settles it. This is the common case and the one that
  removes the click-through.
- **Two or more carry it**, protected on one and permissive on another, or two approaches of the same
  phase in different directions. The board will not guess which pavement the loop sits under, so it
  says which approaches are candidates and the person picks from the card's menu.
- **None carries it.** There is nothing in ATSPM to attach the detector to. The board says the
  approach has to exist first rather than inventing one, because an approach invented to hold a
  channel would carry direction NA and a blank description, and both save without complaint.

Dragging a channel changes the approach it belongs to and nothing else about it: a channel ATSPM
already holds keeps its identifier, movement, lane, hardware and detection types, and only its parent
changes. A channel ATSPM has never held arrives with none of those, so the gate asks for all five on
the card rather than letting a bare detector be saved — a detector with no detection type joins to no
`MeasureType` and feeds no chart, which is worse than an unassigned channel because it looks done.

A channel appears on more than one card when the controller and ATSPM disagree about it: at 7423
channel 18 shows on the phase 6 card because the controller calls phase 6 with it, and on the phase 2
card because ATSPM has it there. That duplication is the finding, so the board shows both rather than
choosing a winner. Each card's drag handle is its own, and a drop from either resolves the same way.

The menu is not a fallback for the drag; it is the same action. It lists every approach at the
location plus "no approach", so every placement — including taking a channel off an approach — is
reachable from the keyboard, and a trackpad in a cabinet doorway is enough to do the work.

#### Correction logging

Every card carries its own ledger, not a single page-level audit: field, the value now, the source
that put it there, when, and the value it replaced. "Phase 6 — corrected from phase 2 by
`ntcip:det.18`, 26 Nov" is the card's own history, readable without leaving the board, and it is the
same provenance the contract already carries on `sources[]` and each record's `source`. A subsequent
load — controller, radar, lidar, or a second controller read after a cabinet visit — appends to the
ledger rather than overwriting it, and a disagreement between two sources is a `conflicts` entry,
which is already defined never to be resolved silently.

#### Four states, and no reliance on color

Marking is tied to the classifications the comparison already produces, so the board invents no
second vocabulary:

| State | What it means | Marking |
| --- | --- | --- |
| Agreed | ATSPM and the sources say the same thing | Plain card |
| Not held by ATSPM | No ATSPM field exists, or it is empty | Ghosted outline, "ATSPM holds nothing" |
| Disagrees | `Certain` — a source settles it and ATSPM differs | Accent border, source value shown in place, ATSPM value and provenance on the card |
| Needs a person | `NeedsDirection` or `Held` | Accent border and an explicit prompt naming what is missing |

Color alone must not carry any of these. Each state also carries a glyph and a text label, because
red against green is the most common form of color blindness and this page will be read on a laptop
in daylight in a truck.

#### Per plan

The diagram is drawn per coordination pattern, selected per location, because sequence and split
proportions are properties of the pattern and not of the intersection. Boxes are drawn to scale only
when `splitTables[].ringSplits` is present for the selected pattern, which means only where an
Econolite database file was supplied — NTCIP gives the pattern's cycle, offset, split number and
sequence number, but not the split seconds behind them. With no split table the diagram is drawn
unscaled and says so, rather than implying equal splits.

#### The arrow map, the splits, and the rest of the controller's settings

**Arrows come from ATSPM, not the controller.** A phase card's arrows are drawn from the direction
and movement on the approaches that declare the phase: direction sets the rotation, movement sets the
shape, a protected movement is filled and a permissive one outlined, and a pedestrian phase carries a
crossing glyph. A phase the controller runs and no approach declares therefore has **no arrow**, and
the gap is the point — it is the same fact as the `NeedsDirection` finding, in the form an engineer
reads fastest. Nothing infers an arrow from the phase number; phase 2 is westbound at seventeen of
nineteen locations on R2:192 and northbound at the two where the mainline runs north-south, so a
number-to-arrow map would be quietly wrong twice per corridor.

**Programmed split, and the position problem.** Split seconds live in `splitTables[].ringSplits`,
keyed by ring and ordered by the phase's **position in that ring**, not by phase number. The position
comes from `sequences[].ringPhases` for the pattern's sequence. Where the sequence definition is
missing — NTCIP gives the sequence *number* but not the sequence — the position falls back to
ascending phase order, which is the usual Econolite layout and is not proven for any particular
controller. The card states which basis it used, and the diagram draws boxes to scale only on the
sequence basis. An assumed position shown as a measurement would put a wrong split time next to the
right phase, which is worse than leaving it out.

**Average split is a measure, not a configuration.** The programmed split answers what the controller
was told; the average answers what it actually served, and it comes from ATSPM's own event data
rather than from any snapshot. The card reserves the row and labels it as not loaded until that query
is wired, because an empty cell beside a programmed split reads as zero seconds served.

**Everything else the controllers hold.** Both makes carry far more than the contract names today:
maximum 3 and dynamic max, added initial and maximum initial, time before reduction and time to
reduce, minimum gap, red revert, second walk and pedestrian clearance, the recall and dual-entry bits
inside `options`, and MaxTime's own set beyond that. These are added as **named scalar fields on
`PhaseRecord`**, one per parameter — never as a free-form settings bag. The merge engine compares,
conflicts, ranks and attributes one scalar field at a time, so a bag would conflict as a single lump
and lose which parameter the two sources disagreed about, which is the one thing a conflict exists to
say. The cards render every field present on a record generically rather than from a hand-written
list, so a parameter added to the contract appears on screen with no UI change.

#### Partial completion, and the gate on saving back

An engineer records what they know when they know it. No field is required to leave a card, nothing
is lost by closing the page, and a location may sit half-assembled indefinitely — a corridor review
runs over days, and the alternative is the engineer keeping the other half on paper.

Writing back to ATSPM is gated per location, so one unfinished location does not block the other
eighteen. The gate is the set of fields ATSPM cannot function without, taken from the model rather
than chosen:

- Per approach: `DirectionTypeId`, `ProtectedPhaseNumber`, `Description`, and
  `IsProtectedPhaseOverlap` set deliberately rather than by default.
- Per detector: `DetectorChannel`, `DectectorIdentifier`, `DateAdded`, `MovementType`, `LaneType`,
  `DetectionHardware`, and an approach to belong to.
- At least one `DetectionType` per detector. A detector saved with none feeds **no measure at all**:
  `DetectionType` joins to `MeasureType`, so the channel is stored, looks configured, and is
  invisible to every chart. This is the easiest field to leave empty and the most expensive.

`MovementTypes.NA`, `LaneTypes.NA` and `DetectionHardwareTypes.NA` are all zero and all save without
complaint, so the gate treats them as absent. A detector with `MovementType = NA` cannot be told from
a through movement by anything downstream.

The board shows the gate as a per-location count of what is still missing, naming the fields, and the
save control stays disabled with that list as its reason. Promotion itself is unchanged, including
the in-place-versus-new-version choice below, which the gate sits in front of.

#### Build notes

`@hello-pangea/dnd` is already a dependency and is used by the route editor, the pedestrian activity
page and the time-of-day corridor options, so the board uses it rather than adding a second drag
library. It supports keyboard dragging, which is required here: a drag-only interaction is unusable
with a trackpad in the field and inaccessible to anyone not using a mouse. Every drag needs an
equivalent path of selecting a card and choosing its target from a menu.

Nineteen locations each with a diagram, phase cards and a tray is a large render. Sections virtualize
or collapse, with the diagram and the counts always visible and the cards expanded on demand, so the
route view stays usable at corridor length.

This is a larger build than the comparison surface it replaces, and it is worth sequencing: the board
laid out read-only from the contract first, then detector-to-phase dragging with the card ledger,
then structure dragging for the pre-snapshot case, then the per-plan diagram with split widths, then
the save gate. Each step is useful on its own, and the first already removes the click-through. The
first two are built; the placements they record live in the page only, because nothing is written
back to ATSPM until the save step exists.

### The versioning trap

`CopyLocationToNewVersion` in `Atspm/Application/Extensions/LocationRepositoryExtensions.cs` sets
the new version's `Start` to today. A new version therefore **never corrects a past window**: an
analysis of 18 November reading a version that starts 25 November sees none of the correction.

Promotion must offer both and default correctly:

- **Correct in place** — the default when the review's as-of date falls inside the version in
  effect. The configuration was always wrong, so editing the version that was in effect makes the
  analysis window read correctly.
- **New version** — when the configuration was right and the field changed. `Start` is the date the
  change took effect, supplied by the operator.

Every promoted field records the snapshot id, the source file checksum, the approver, the time, the
reason, and whether the value was measured or inferred. A later reader must be able to ask of any
field: where did this come from, and did anyone measure it.

## Security rules

An uploaded snapshot is untrusted input: it arrives as a claim about a controller, from a tool or a
client this one does not control.

- Validate against the schema before anything is stored, and reject rather than coerce. A snapshot
  that fails validation is recorded as received and rejected, with the reason, so the operator sees
  it arrived.
- Cap payload size and reject above it.
- Never execute or interpret any part of a snapshot as code or as a path.
- A snapshot carries no credentials and no account data. If one arrives containing either, reject it
  and record that it did — the collection tool is responsible for never putting them in, and this is
  the backstop.
- Permissions: uploading and annotating require the same role as editing a location. Promotion
  requires the configuration-owner role. These are different privileges and should not be merged.

Promotion is the only operation that changes ATSPM, and it writes through the existing configuration
services rather than around them, so the usual validation and audit apply.

## Phasing, validation and open questions

Each phase is useful on its own and shippable.

1. **Read-only comparison.** Accept a snapshot, compare, classify, render. No promotion, no
   annotation. This alone replaces the external page and makes the findings durable.
2. **Annotation and promotion.** Dispositions, annotation drawer, promote with in-place versus new
   version, audit trail.
3. **Route-level review.** Nineteen locations at a time, with corridor-wide roll-ups: firmware in
   use, pedestrian phases declared nowhere, systematic patterns across locations.
4. **The assembly board.** The three-zone board per location, read-only from the contract first,
   then detector-to-phase dragging with the card ledger, then structure dragging before a snapshot
   exists, then the per-plan diagram drawn to scale, then the completion gate on saving back.

### Validation checklist

- [ ] A standard eight-phase snapshot produces barriers A = {1,2,5,6} and B = {3,4,7,8} with no
      hardcoded map, and a snapshot containing phases above 8 renders every one of them — no phase
      number the controller reports is dropped or left without a ring and a barrier.
- [ ] A snapshot for location 7521 produces ring 1 = {1,2} then {4,11}, ring 2 = {5,6} then {8,15},
      and the diagram draws all eight boxes.
- [ ] Phases marked not in use are neither reported as programmed nor as undeclared.
- [ ] An overlap approach never produces a wrong-phase difference.
- [ ] An undeclared channel the snapshot leaves unassigned is classified differently from one it
      assigns.
- [ ] A pedestrian movement the controller programs and no approach declares is promotable once
      annotated, not `Held`.
- [ ] A snapshot carrying `switchPhase` without `callPhase` is rejected rather than read as no
      detector assignments.
- [ ] A snapshot listing a group in `unavailable` renders the notice rather than an empty list.
- [ ] Two sources disagreeing on one field produce a conflict, block promotion of that group, and
      lose neither value.
- [ ] A snapshot that fails schema validation is rejected and recorded, not partially stored.
- [ ] Promoting in place leaves `Location.Start` unchanged; promoting as a new version sets it.
- [ ] A promoted inference is distinguishable from a promoted measurement in the audit record.
- [ ] Loading the ATSPM baseline alone renders the declared phases, directions, overlap flags and
      detector channels, and names ring, barrier, sequence and timing as fields ATSPM does not hold.
- [ ] A detector card dragged to another phase records the engineer as its basis, and a later
      controller snapshot that contradicts a structure placement wins and leaves the correction and
      its source on the card's ledger.
- [ ] Structure that a source has reported cannot be dragged; detector-to-approach assignment can be,
      at every stage.
- [ ] Every state a card can be in is distinguishable without color.
- [ ] A location missing required fields blocks only its own save, names the missing fields, and
      treats `MovementTypes.NA`, `LaneTypes.NA` and `DetectionHardwareTypes.NA` as missing.
- [ ] A detector with no `DetectionType` fails the gate.
- [ ] Every drag has a keyboard equivalent.
- [ ] A phase with no ATSPM approach draws no arrow and says the direction is unknown.
- [ ] A programmed split is attributed by sequence position where a sequence is defined, and labelled
      as assumed where the position came from ascending phase order.
- [ ] A phase field added to the contract appears on the card without a UI change.

### Open questions

| # | Question | Blocks |
| --- | --- | --- |
| 1 | Does the tool accept raw controller files at all, or only normalized snapshots? Only snapshots is simpler and keeps binary parsing in one place; raw files are a convenience if someone has a file and not the collector. | The upload endpoint and the security surface |
| 2 | Review entities on `ConfigContext`, or their own context? `ConfigContext` keeps joins to `Location` and `Approach` simple; a separate one keeps review history out of the configuration schema. | Data model |
| 3 | Is promotion per location only, or can it apply across a route in one action, and is a partial route promotion acceptable? | Promotion UI and API |
| 4 | Should the UI suggest a direction from the corridor convention, clearly as a suggestion, or stay silent? Phase 2 is westbound at 17 of 19 locations on R2:192 and northbound at the two where the mainline runs north-south. | Annotation design |
| 5 | When two patterns at one location use different sequences, is the engineer's pre-snapshot structure placement kept per pattern or once for the location? Once is simpler and wrong wherever sequences differ; per pattern multiplies the work on locations where they do not. | The board's structure zone |
| 6 | Does a radar or lidar source supply anything the board should treat as authoritative, beyond lane counts and geometry? Neither reports compass direction, so on present evidence they correct lanes and nothing else - worth settling before a `radar` or `lidar` source kind is defined. | Source precedence |

Collection, controller file decoding and the NTCIP reader are a separate tool with its own design.
