# LiDAR Integration — Ouster BlueCity (Edge API) + BlueBand

Design documentation for adding Ouster BlueCity lidar traffic data to UDOT ATSPM on the
`feature/lidar-integration` branch. **BlueBand is a second LiDAR vendor, already implemented**
on a separate branch (`codex/blueband-lidar-event-import`) — see
[`15-blueband-integration.md`](15-blueband-integration.md). Together these are the two real
LiDAR data sources for the local prototype; docs 01–14 are the BlueCity design, doc 15 is the
BlueBand record, and doc 03's storage design now spans both (coordination required, see doc 15).

**Status:** architecture spec — ready for implementation. The storage-format spike (X14,
doc 05) is **done** ([`17-preflight-findings.md`](17-preflight-findings.md)): the per-type
converter approach fails, so `LidarZoneEvent` storage is a shared runtime-type dispatcher +
protobuf, not a per-type override (doc 03, rewritten). That same preflight pass also
surfaced two must-fix items before WP1/WP5: an exact-hour-boundary edge case in the archive
idempotency check (H1, doc 08 WP7) and confirmed credential read-exposure on
`DeviceConfiguration.Password`/`ConnectionProperties` regardless of which field holds a
secret (doc 10 S2, doc 08 WP5). Both have a concrete fix documented — neither is a design
blocker, but both are required WP1/WP5 work, not optional hardening. The Edge API contract
([`07`](07-edge-api-reference.md)) is **verified against a live box** (`10.235.13.48`,
2026-09-10). A **code-level review** ([`10-architecture-review.md`](10-architecture-review.md))
confirms the design fits ATSPM's extension points; its findings (B1 local time base,
H1 archive-merge check, H2/M1/M4, **P7 protobuf-converter risk**…) are folded into docs 02–09.
Build sequence:
[`08-integration-plan.md`](08-integration-plan.md); formal scope:
[`09-scope-of-work.md`](09-scope-of-work.md); new-measures plan:
[`11-measures-plan.md`](11-measures-plan.md). Residual [`05`](05-open-questions.md) items are
UDOT/Ouster prerequisites (doc 08 WP0) or implementer checks — not design blockers.

**Effort headline (for costing):** Phase 1 — ingestion + auto-config (docs 08/09, WP1–WP10)
≈ **18–32 developer-days** (one engineer; ≈ 3–4 weeks with two working WP2/WP6 in parallel).
Phase 2 — new measures ([`11`](11-measures-plan.md), MP1–MP7, rougher sizing) ≈
**23–37 developer-days**, and is separable — MP1+MP2 alone (≈ 6–10 days) stands up the first
LiDAR measure end-to-end. Both exclude WP0 (UDOT/Ouster prerequisites — not development) and
standard PM/review/QA overhead.

## Documents

| Doc | Purpose |
| --- | --- |
| [`01-architecture-overview.md`](01-architecture-overview.md) | Where lidar fits in ATSPM, component map, data flow, phasing |
| [`02-ingestion-pipeline.md`](02-ingestion-pipeline.md) | Edge REST downloader client, auth, windowing/pagination, decoder, workflow wiring, adjustable pull timing |
| [`03-data-model.md`](03-data-model.md) | `LidarZoneEvent` model, JSON → model mapping, storage as `CompressedEventLogs<T>`, migrations |
| [`04-configuration-and-mapping.md`](04-configuration-and-mapping.md) | `Device` / `DeviceConfiguration` setup, box = `Location`, zone → `Detector` channel match, credentials, units/timezone |
| [`05-open-questions.md`](05-open-questions.md) | Open decisions + external unknowns, with the resolved log |
| [`06-auto-config-feasibility.md`](06-auto-config-feasibility.md) | Auto-generating `Detector`/`Approach` config by channel match — verdict + design |
| [`07-edge-api-reference.md`](07-edge-api-reference.md) | **Verified** Edge API contract from a live box. Supersedes the vendor manual where they differ |
| [`08-integration-plan.md`](08-integration-plan.md) | Sequenced work packages (WP0–WP10), dependencies, acceptance, rollout |
| [`09-scope-of-work.md`](09-scope-of-work.md) | Formal SOW — in/out of scope, deliverables, acceptance, assumptions, risks, effort |
| [`10-architecture-review.md`](10-architecture-review.md) | Code-level fit / compatibility / security review against `main` — ranked findings + required doc corrections |
| [`11-measures-plan.md`](11-measures-plan.md) | Plan for building new ATSPM measures/reports on `LidarZoneEvent` data (Phase 2+) |
| [`12-multi-vendor-architecture.md`](12-multi-vendor-architecture.md) | How a second LiDAR vendor gets added without touching storage/workflow/measures — the plug-in contract, canonical event model, classification normalization |
| [`13-perception-lidarhub-api.md`](13-perception-lidarhub-api.md) | The native Ouster Detect Perception & LidarHub APIs (below BlueCity) — full endpoint list, what they could add (box→`Location` GPS, real zone geometry), a hard do-not-call list. **Not yet verified against a live box; not part of the Phase-1 spec.** |
| [`14-prototype-verification.md`](14-prototype-verification.md) | Read-only checklist for a local prototype pass against a live box — resolves the empirical open items (X1, X4, X6, X13, H1) before WP2/WP3 are built out |
| [`15-blueband-integration.md`](15-blueband-integration.md) | **Record of already-implemented code** (branch `codex/blueband-lidar-event-import`) — a second LiDAR vendor, built independently of this design track. Confirms doc 05 X14, reshapes doc 03's storage design, adds a second transport pattern to doc 12, and needs merge/rebase coordination with `feature/lidar-integration` before WP1 lands |
| [`16-codex-preflight-checklist.md`](16-codex-preflight-checklist.md) | The verification checklist sent to Codex before WP1 coding — branch coordination, X14, protobuf polymorphism, H1, config-length/security, `ProtectedPhaseNumber = 0` sanity check |
| [`17-preflight-findings.md`](17-preflight-findings.md) | **Codex's answers to doc 16, spike-verified against real code.** X14 fails (confirmed); H1 snaps but has an exact-hour-boundary edge case; protobuf contracts must be flat/explicit or silently lose inherited fields; `Password`/`ConnectionProperties` are both confirmed exposed to any `Device:View` caller; BlueBand branch still unmerged; `ProtectedPhaseNumber = 0` confirmed safe at the data layer. Findings folded into docs 03/05/06/08/10 |

## Scope

**In scope — BlueCity Edge-Based API only (vendor manual Category 2).** Served from each
edge box on the local network at `https://<edge-box-address>/analytics/api/v1/`,
authenticated with a Keycloak client id / secret.

Primary ingestion target is the **raw `object_events` endpoint** — per-object zone
records, stored at full resolution.

**Out of scope:**

- **Cloud-Based API (Category 1).** This removes Post-Encroachment Time, red-light
  runners, jaywalking, average speed, and every SPM measure (occupancy ratio, split-failure
  trends, green allocation, approach delay, arrivals-on-green). Those endpoints exist only
  in the cloud API.
- **Real-time gRPC streaming API (Category 3).**
- Signal-phase / traffic-light-state **data** from BlueCity — the Edge API carries none.
  LiDAR detectors still attach to ATSPM approaches/phases, but indirectly: the LiDAR zone's
  channel number matches the intersection's existing detector, which already has an approach
  and phase (docs 04, 06).

## Decisions log

| Date | Decision |
| --- | --- |
| 2026-09-10 | Edge API only. Cloud and real-time are out. |
| 2026-09-10 | `object_events` (raw, high-resolution) is the primary source. Bucketed endpoints (`turning_movements`, `zone_*`) are secondary / later. |
| 2026-09-10 | Store raw events as a new `CompressedEventLogs<LidarZoneEvent>` type in `EventLogContext`, mirroring `IndianaEvent`; let the existing aggregation workflow roll it up. |
| 2026-09-10 | Ingestion **pattern A**: new `IDownloaderClient` (edge REST) + new `IEventLogDecoder`, reusing `DeviceEventLogWorkflow`. Not a bespoke workflow. |
| 2026-09-10 | One edge box = one ATSPM `Location` (one `Device`). |
| 2026-09-10 | Pull timing (cadence + query window + overlap) must be adjustable per device via configuration. |
| 2026-09-10 | Zone → ATSPM mapping: **one `Detector` per BlueCity zone** (Option A). |
| 2026-09-10 | Investigate **auto-config** (pull box config → auto-generate `Approach` / `Detector` / phase assignments). Feasibility in [`06-auto-config-feasibility.md`](06-auto-config-feasibility.md); phase-1 vs fast-follow is open (Q9), gated on X12 (fleet naming standard). |
| 2026-09-10 | **Live-box investigation** (`10.235.13.48`): auth, endpoint list, `object_events` schema/pagination, `/snmp/zone_mappings`, `/config` verified into [`07`](07-edge-api-reference.md). Resolved X2/X2a/X2b/X3/X5/X9/X11. |
| 2026-09-10 | **UDOT *"Ouster LiDAR Setup Guidance"* v1.10** confirms the zone naming convention is a UDOT standard (`CLASSES-APPROACH-DIRECTION+LANE-TYPE-CHANNEL#`) and that LiDAR **reuses prior detector channel numbers**. → auto-config joins zone `CHANNEL#` to the existing ATSPM `Detector` and **inherits the approach + phase** (no phase guessing). Resolved X12/Q10. |
| 2026-09-10 | Measured raw `object_events` retention on box `10.235.13.48` ≈ **9–12 days**. → ATSPM is the system of record; 5-min poll cadence; 7-day first-run/backfill window; "device N days behind" alert (WP8). |
| 2026-09-10 | **"What's best" calls:** `DeviceType = LidarSensor` · add `TransportProtocols.OusterBlueCityEdge` · units = **imperial** (matches box) · `LocationIdentifier` operator-entered (intersection id not exposed by the analytics API) · **auto-config channel-match is IN Phase 1** (draft only; full generate/merge/reconcile is fast-follow) · credentials use the existing `DeviceConfiguration` pattern, secret-store flagged cross-cutting · self-signed TLS via pinned thumbprint. *(A separate hosted service was proposed here but the review found `HostedServiceBase` has no timer — superseded by the next row.)* |
| 2026-09-10 | **Integration plan + scope of work** written ([`08`](08-integration-plan.md), [`09`](09-scope-of-work.md)). |
| 2026-09-10 | **Code-level architecture/compat/security review** ([`10`](10-architecture-review.md)). Design fits ATSPM's extension points; no rework. Corrections folded in: **B1** event time base is naive intersection-local (not UTC) — request `timezone` = box `config.timezone`, store local; **H1** verify `Timeline` hour-snap or add one (archive de-dup); **H2** set `EarliestAcceptableDate` for the backfill; **M1** `DeviceConfiguration.Password` is `HasMaxLength(50)` — may need widening; **M4** `HostedServiceBase` has no timer → no `LidarEventLogHostedService`; schedule `log --device-type LidarSensor` instead; **P1** new client/decoder auto-register in DI. Security: pin/CA the box TLS, confirm ConfigApi doesn't expose `Password`, restrict outbound host ranges, no secrets in logs. |
| 2026-09-10 | **New-measures plan** ([`11`](11-measures-plan.md)) — LiDAR as a measure source: direct-from-events, new LiDAR aggregations, and an opt-in `LidarZoneEvent → IndianaEvent` path into existing detector measures. Phase 2+ (MP1–MP7). |
| 2026-09-11 | **Multi-vendor requirement** — the collector must support additional LiDAR vendors without major development. Addressed in [`12-multi-vendor-architecture.md`](12-multi-vendor-architecture.md): `LidarZoneEvent` is ATSPM's canonical, vendor-neutral model (with a normalized `Classification` + raw `VendorClassification`); each vendor is one `IDownloaderClient` + one `IEventLogDecoder` (both auto-register) + a `Product`/`DeviceConfiguration` template — no storage/workflow/measures change per vendor. Renamed the Phase-1 components to make the vendor boundary explicit: `TransportProtocols.EdgeRest → OusterBlueCityEdge`, `EdgeRestDownloaderClient → OusterBlueCityEdgeDownloaderClient`, `BlueCityObjectEventsDecoder → OusterBlueCityObjectEventsDecoder` (applied across docs 01, 02, 04, 05, 06, 07, 08, 09, 10). |
| 2026-09-16 | **Incorporated the Ouster Detect Perception/LidarHub API reference** (<https://docs.ouster.com/ouster-detect/perception_api/perception-api.html>) — documented in [`13-perception-lidarhub-api.md`](13-perception-lidarhub-api.md). This is a *separate, lower-level* box-native API family (below BlueCity's Analytics Server), with a much larger destructive-control surface (reset, sensor/calibration/zone overwrite, password change). **Not verified against a live box** (VPN unavailable) and **not part of the Phase-1 spec** — flagged as a fast-follow research item: `GET /lidar-hub/api/v1/world` may resolve Q11 (box→`Location`), `GET /perception/api/v1/point_zones` may strengthen doc 06 auto-config geometry. Added security finding S9 (doc 10): if ever used, GET-only, never the write endpoints. |
| 2026-09-17 | **Local prototype with live-box access.** Added [`14-prototype-verification.md`](14-prototype-verification.md) — a read-only checklist (P1–P6) to resolve doc 05's empirical open items (X1 retention, X4 dedupe-key stability, X6 clock skew, X13 Perception/LidarHub probe) and one code-only check (H1 `Timeline` hour-snap), plus a throwaway end-to-end decode smoke test, before WP2/WP3 are built out. This doc stays documentation/checklist only — implementation is still Codex's from docs 02/03/08. |
| 2026-09-17 | **`LidarZoneEvent` storage: Protobuf, not JSON** (Q13) — revised twice today. First pass proposed a per-type EF converter override (X14). **Then found `origin/codex/blueband-lidar-event-import`** (doc 15): a second LiDAR vendor (BlueBand) already implemented on a separate branch, including a real storage-format change (a versioned compression envelope + a new Brotli codec) — proving the actual codebase pattern is a **shared, fleet-wide codec choice**, not per-type overrides. Design reframed around that precedent: Protobuf becomes a new codec in the *same* envelope (doc 03), Protobuf's polymorphic-serialization limits (`[ProtoInclude]` needed per event type — conflicts with doc 12's "no shared-code touch per vendor") are now the headline risk (doc 10 P7), and `feature/lidar-integration`'s storage work must coordinate/rebase with that branch rather than duplicate it. |
| 2026-09-17 | **Codex ran the preflight checklist (doc 16) and reported back in [`17-preflight-findings.md`](17-preflight-findings.md)** — a real spike against the installed toolchain, not analysis. Key results, all folded back into the design: **X14 confirmed to fail** (the per-type EF converter override throws `InvalidOperationException` — storage design is now a write-time runtime-type dispatcher inside the one shared converter, doc 03 rewritten); **H1 confirmed nuanced** (`Timeline` snaps in the general case but produces a degenerate `Start == End` for an exact-hour-boundary batch — WP7 now always computes its own canonical hour range rather than trusting `Timeline`'s output, doc 08); **protobuf contracts must be flat/explicit** (a naive subclass-only contract silently drops the inherited `Timestamp` field — `DateTime.MinValue`, no exception — doc 03/08 WP1 now require an explicit round-trip test for this); **`Password`/`ConnectionProperties` are both confirmed exposed** to any `Device:View`-authorized caller regardless of which one holds a secret (doc 10 S2 escalated from "verify" to "confirmed, fix required before WP5," doc 05 Q8 sharpened); **BlueBand branch is confirmed still unmerged** (`main` at `f630f98d` doesn't contain it — doc 15's "this settles X14"/"shipped" language corrected, since that was an inference from the branch's existence, not the spike); **`ProtectedPhaseNumber = 0` confirmed safe at the data layer** (no validator blocks it), but the needs-review/apply gate itself still needs to be built, not assumed. |
| 2026-09-17 | **Auto-config (WP6) consistency/soundness pass** — user asked to verify the plan is solid before the prototype build, with auto-config called out as high-priority. Found and fixed three real gaps: (1) `Approach.ProtectedPhaseNumber` confirmed via the actual code (`Atspm/Data/Models/ConfigurationModels/Approach.cs`) to be a non-nullable `int` — but `0` is already ATSPM's established "no protected phase" sentinel (used by `LeftTurnGapReport`/`ApproachVolumeReportService`/`PhaseService`), so staging a new `Approach` with `ProtectedPhaseNumber = 0` + `needs-review` is safe, no schema change needed — added to doc 06, and doc 08 WP6 now explicitly blocks apply on any unresolved `needs-review` new approach; (2) `Detector.LidarZoneId` was inconsistently "optional" in doc 08 WP1 while WP6/MP1/doc 09 all treated it as required — promoted to a firm WP1 deliverable, doc 04 updated to match; (3) WP9's test table had no dedicated auto-config test — added one covering channel-match, new-detector staging, the new-approach `needs-review` gate, and idempotent re-run. |
| 2026-09-17 | **BlueBand LiDAR folded in as vendor #2** — doc 15 records what's actually built on `codex/blueband-lidar-event-import`: its own `BluebandLidarEvent` model (SPM+ `detector`/`phase`/`ring` events — a different kind of data than BlueCity's zone events, so it correctly got its own model per doc 12's escape hatch, not a forced fit into `LidarZoneEvent`), a lighter "generic-downloader subclass" transport pattern added to doc 12 alongside the dedicated-client pattern, a payload-size download guard worth reusing for BlueCity, and a `DateTimeKind`-aware fix to `EventLogFileImporter.IsAcceptableDateRange` that partially resolves review finding B1. New open items X15–X17 (doc 05) track what this raises: possible phase-based scope for BlueBand specifically, reusing the size guard, and whether anything downstream still assumes one global time base. |

## Reference

- Vendor manual: `Ouster BlueCity Traffic Data API Manual (1).pdf` (not in repo). Category 2
  is outdated in places — [`07`](07-edge-api-reference.md) is authoritative.
- **UDOT *"Ouster LiDAR Setup Guidance"* v1.10, 2026-01-11** (owner: Mark Taylor) — zone
  naming convention, intersection naming, ATSPM setup procedure. Not in repo.
- Upstream field definitions: <https://docs.ouster.com/ouster-detect/connecting_to_output/connecting-to-output.html>
- **Ouster Detect Perception & LidarHub API reference:**
  <https://docs.ouster.com/ouster-detect/perception_api/perception-api.html> — see
  [`13-perception-lidarhub-api.md`](13-perception-lidarhub-api.md).
- ATSPM as-is architecture: [`01-architecture-overview.md`](01-architecture-overview.md) § "ATSPM today"
