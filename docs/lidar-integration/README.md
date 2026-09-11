# LiDAR Integration — Ouster BlueCity (Edge API)

Design documentation for adding Ouster BlueCity lidar traffic data to UDOT ATSPM on the
`feature/lidar-integration` branch.

**Status:** architecture spec — ready for implementation. The Edge API contract
([`07`](07-edge-api-reference.md)) is **verified against a live box** (`10.235.13.48`,
2026-09-10). A **code-level review** ([`10-architecture-review.md`](10-architecture-review.md))
confirms the design fits ATSPM's extension points; its findings (B1 local time base,
H1 archive-merge check, H2/M1/M4…) are folded into docs 02–09. Build sequence:
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

## Reference

- Vendor manual: `Ouster BlueCity Traffic Data API Manual (1).pdf` (not in repo). Category 2
  is outdated in places — [`07`](07-edge-api-reference.md) is authoritative.
- **UDOT *"Ouster LiDAR Setup Guidance"* v1.10, 2026-01-11** (owner: Mark Taylor) — zone
  naming convention, intersection naming, ATSPM setup procedure. Not in repo.
- Upstream field definitions: <https://docs.ouster.com/ouster-detect/connecting_to_output/connecting-to-output.html>
- ATSPM as-is architecture: [`01-architecture-overview.md`](01-architecture-overview.md) § "ATSPM today"
