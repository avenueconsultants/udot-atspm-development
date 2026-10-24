# 11 — Plan for New Measures on LiDAR Data

Phase 1 (docs 02–09) only **ingests and stores** `LidarZoneEvent`. This doc is the plan for
turning that data into ATSPM measures/reports. It is **Phase 2+**, sequenced after ingestion
is stable, but the Phase-1 data model is designed so nothing here needs a re-ingest.

## How ATSPM builds a measure (observed from the code)

A measure in ATSPM is the sum of:

| Layer | Where | For LiDAR |
| --- | --- | --- |
| **Config** | `MeasureType` row (+ `MeasureOption` defaults, `DetectionType` links) in `ConfigContext` | new `MeasureType` rows; link to the LiDAR `DetectionTypes` (`LLC`, queue, presence) |
| **Analysis pipeline** | `Application/Analysis/<Measure>/…` — TPL-Dataflow `Workflows/` + `WorkflowSteps/` + result DTOs. Existing ones start from `IndianaEvent` via `WorkflowFilters/FilterIndianaEventsByCodeAndLocationBase`, `GetDetectorEvents`, etc. | new pipeline starting from `LidarZoneEvent` via `LidarZoneEventLogEFRepository.GetEventsBetweenDates`, filtered by zone / classification |
| **Aggregation** (optional, for dashboards) | `Application/Analysis/Workflows/Aggregate*` sub-workflows fanned out by `Infrastructure/Workflows/AggregationWorkflow`; stored as `CompressedAggregations<T>` in `AggregationContext` with a per-type repository | new `CompressedAggregations<LidarZoneAggregation>` + sub-workflow + repo + ×5 migrations |
| **API** | `ReportApi` controller endpoint returning the result DTO | new controller/action |
| **UI** | `WebUI` chart component + an entry in the Reports menu | new chart |

## Three ways LiDAR data can drive measures

### A. Direct-from-events (no new storage) — *fastest path*

`reportapi` computes on demand from `LidarZoneEvent` rows for a location + date range.
Good for detail views, low query volume.

- **Volume by movement & class** — count `LidarZoneEvent` per zone → map zone → `Detector`
  → `Approach`/`MovementType` (the channel-match from doc 06); split by `Classification` /
  `SubClassification`. Gives car/truck/bus/bike/pedestrian counts per approach & movement.
- **Speed distribution / percentile speeds** — `avg_speed` / `p85_speed` per zone per bin;
  approach speed profiles, 85th-percentile speed maps.
- **Pedestrian & bicycle volumes** — filter `Classification in (PERSON, BICYCLE)` on
  crosswalk (`XW`) / bike zones; passive ped counts with no push-button dependency.
- **Zone occupancy / dwell** — from `dwell_time_ms` + arrival rate; per-lane presence
  duration, a LiDAR analogue of detector occupancy.
- **Class mix over time** — stacked composition by hour/day.

### B. New LiDAR aggregations — *for dashboards / long ranges*

Add a `LidarZoneAggregation` model (bin = 15 min, keyed by zone/approach/movement/class)
and a `LidarAggregationWorkflow` sub-workflow wired into `AggregationWorkflow` (or run as a
sibling). Persist as `CompressedAggregations<LidarZoneAggregation>`; add
`ILidarZoneAggregationRepository` in the same family as
`IDetectorEventCountAggregationRepository`. Enables the aggregate site / multi-day trend
charts without re-scanning raw events.

- Binned volume / speed / occupancy / queue per zone, per class.
- Feeds region/corridor rollups the same way existing aggregations do.

### C. Feed the **existing** detector measures — *maximum reuse*

Because auto-config maps each LiDAR count zone to an existing `Detector` **channel**, a LiDAR
count actuation is equivalent to a detector-on event. Add a
`LidarZoneEvent → IndianaEvent` transform (one `IndianaEvent` per record: detector-on
`EventCode 82`, `EventParam = DetectorChannel`, `Timestamp` = record time) at the
`DeviceEventLogWorkflow` broadcast seam (the block currently does `OfType<IndianaEvent>()`).

Then, with **no new measure code**, LiDAR data flows into:
- `AggregateDetectorEventCountWorkflow` → detector counts,
- Approach Volume, Purdue Coordination Diagram arrivals, Turning Movement Counts,
  and any other detector-channel-based measure.

Caveats: `object_events` are dwell records (enter/exit with `dwell_time_ms`), not raw
pulses — synthesize one actuation per record for count zones; this is a modelling choice to
validate against ground truth. Presence/queue semantics don't map as cleanly and are better
served by A/B. Keep C **opt-in per detector** (a flag) so operators choose which approaches
run on LiDAR-as-detector vs. native LiDAR measures.

## Recommended sequencing (Phase 2+)

Sizing uses the same scale as doc 09 §9 (`S ≈ 0.5–1 d`, `M ≈ 2–4 d`, `L ≈ 5–8 d`, one
engineer). These are **rougher** than the Phase-1 numbers — no report/UI code exists yet to
calibrate against — treat as order-of-magnitude until MP2 is actually built.

| MP | Work | Depends on | Size | Days |
| --- | --- | --- | --- | --- |
| MP1 | `LidarZoneEventLogEFRepository` read API + a zone→`Detector` resolver service (parse name / use `LidarZoneId`) | Phase 1 (S1, WP6) | S | 1–2 |
| MP2 | **Direct measure #1: Volume by movement & class** — analysis pipeline + `MeasureType` + ReportApi endpoint + WebUI chart. Proves path A end-to-end; every measure after this is cheaper. | MP1 | L | 5–8 |
| MP3 | **Direct measure #2: Speed / 85th-percentile** | MP1, MP2 | M | 2–3 |
| MP4 | **Pedestrian & bicycle volume** (crosswalk zones) | MP1, MP2 | M | 2–3 |
| MP5 | `LidarZoneAggregation` model + `LidarAggregationWorkflow` + repo + ×5 migrations; re-point MP2–MP4 dashboards at the aggregate | MP2–MP4 | L | 5–8 |
| MP6 | **Path C (opt-in): `LidarZoneEvent → IndianaEvent` transform** for count zones; validate LiDAR-fed Approach Volume / PCD / TMC against a controller-detector baseline | Phase 1, MP1 | M | 3–5 |
| MP7 | Queue-length & occupancy measures (needs the `zone_queue_length` endpoint too — a Phase-1-deferred ingestion item) | MP5, edge `zone_queue_length` ingestion | L | 5–8 |
| **Total (MP1–MP7)** | | | | **≈ 23–37 developer-days** |

**MP2 is the pivot point.** MP1 + MP2 (≈ 6–10 days) proves the whole path end-to-end —
reasonable as a standalone first Phase-2 milestone before committing to the rest. MP3/MP4
are cheap once MP2 exists (same pattern, different filter/chart). MP5–MP7 are each
independently deferrable.

## Design constraints carried from the review (doc 10)

- All measure math runs in the **naive intersection-local** time base (B1). Do not
  introduce UTC handling in a LiDAR measure pipeline.
- Zone → `Detector` resolution must tolerate multi-channel zone names
  (`…-COYR-1723` → two detectors) and the known naming variants.
- If path C is used, the synthesized `IndianaEvent`s must be de-dupable the same way
  (they enter the same `CompressedEventLogs<IndianaEvent>` store as controller data —
  keep them on the **LiDAR `Device`'s** `DeviceId` so they never collide with the
  controller's own rows).

## Not in this plan

- Safety surrogate measures (PET, red-light-running, conflict analysis) — those need the
  BlueCity **Cloud** API, which is out of scope (doc 09 §3).
- Any measure requiring signal-phase state from BlueCity — the Edge API has none.
