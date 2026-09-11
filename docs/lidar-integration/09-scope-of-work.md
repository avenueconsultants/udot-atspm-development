# 09 — Scope of Work

**Project:** Ouster BlueCity LiDAR integration for UDOT ATSPM — Phase 1
**Branch:** `feature/lidar-integration`
**Basis:** docs 01–12 in this folder; API verified against live box `10.235.13.48` on
2026-09-10; UDOT *"Ouster LiDAR Setup Guidance"* v1.10.

## 1. Objective

Ingest raw, high-resolution LiDAR detections (`object_events`) from Ouster BlueCity edge
boxes into ATSPM's event-log database on a configurable schedule, store them at full
resolution alongside existing signal data, and generate a reviewable ATSPM detector
configuration for each box by matching LiDAR zone channels to the intersection's existing
detectors — **through a collector architecture that a second LiDAR vendor can join without
storage, workflow, or measures changes** (doc 12).

## 2. In scope (Phase 1)

| # | Item |
| --- | --- |
| S1 | New event-log model `LidarZoneEvent` + `CompressedEventLogs<LidarZoneEvent>` storage in `EventLogContext`, with EF migrations for all five database providers. |
| S2 | `OusterBlueCityEdgeDownloaderClient` (`TransportProtocols.OusterBlueCityEdge`) — Keycloak `client_credentials` auth, windowed + paginated `GET /analytics/api/v1/object_events`, self-signed-TLS handling, temp-file output. |
| S3 | `OusterBlueCityObjectEventsDecoder` — JSON → `LidarZoneEvent`, dedupe on BlueCity server `id`. |
| S4 | Independent LiDAR ingestion cadence via a **scheduled** `EventLogUtility log --device-type LidarSensor` (no new hosted service — review M4), plus the LiDAR `EventLogImporterConfiguration` (`EarliestAcceptableDate` set for the backfill window). |
| S5 | Per-device pull-timing configuration (window, overlap, chunk size, page size, first-run/backfill window, units, timezone, TLS) via `DeviceConfiguration` + `ConnectionProperties`. |
| S6 | Provisioning: a `Product` row for Ouster BlueCity, a "BlueCity Edge" `DeviceConfiguration` template, and an operator doc for onboarding a box. |
| S11 | **Vendor-neutral collector architecture** (doc 12): `LidarZoneEvent` carries a canonical `Classification` + raw `VendorClassification`; the Ouster BlueCity client/decoder are named and packaged as one vendor's implementation of a general `IDownloaderClient`/`IEventLogDecoder<LidarZoneEvent>` pair, not a one-off. No second vendor is built in Phase 1, but the contract for adding one is documented and does not require touching storage, workflow, or (once built) measures. |
| S7 | `lidar-autoconfig` channel-match: pull `GET /snmp/zone_mappings`, parse zone names per the UDOT standard, match `CHANNEL#` to existing `Detector`s at the box's `Location`, and produce a reviewable draft "LiDAR" `Location` version (set `DetectionHardware = LiDar`, `LatencyCorrection = 0`; stage new detectors for unmatched zones). Operator-applied, not auto-applied. |
| S8 | Idempotency: verify/enforce that re-polled overlapping windows do not create duplicate rows (archive-merge by key). |
| S9 | Observability: structured logging on the ingestion path + a "device N days behind" signal (box retention is ~9–12 days). |
| S10 | Tests: unit (parser, decoder), component (`OusterBlueCityEdgeDownloaderClient` against a stub), workflow (fake downloader → compressed rows), plus a gated live-box integration test and an end-to-end check. |

## 3. Out of scope / deferred

- **Cloud-Based API (Category 1)** and **real-time gRPC (Category 3)** — entirely out.
  This removes PET, red-light-runner, jaywalking, average speed, and all SPM measures.
- Aggregation types and `AggregationWorkflow` rollups for `LidarZoneEvent`.
- `reportapi` measures and `webui` charts for LiDAR data.
- Secondary Edge endpoints: `turning_movements`, `zone_metadata`, `zone_occupancy`,
  `zone_queue_length`.
- `DatabaseInstaller` historical-backfill command (bounded by box retention regardless).
- Full generate / merge / reconcile auto-config with scheduled re-sync (fast-follow of S7).
- **New measures / reports / charts on LiDAR data** — planned in
  [`11-measures-plan.md`](11-measures-plan.md) as Phase 2+ (MP1–MP7).
- Reading the UDOT intersection id from the Detect core API — Phase 1 has the operator enter
  `LocationIdentifier` on the `Device`.
- Yellow-Red / red-light-running detection (UDOT is not adding these to ATSPM currently).
- Any change to signal-phase modelling — LiDAR detectors attach to existing approaches/
  phases via channel; no phase data comes from BlueCity.

## 4. Deliverables

1. Source changes on `feature/lidar-integration` implementing S1–S10.
2. EF migrations (×5 providers) — the discriminator, and any `ConfigContext` change
   (`Detector.BlueCityZoneId`, `DeviceConfiguration.Password` widen).
3. `appsettings` / `docker-compose` additions (LiDAR `EventLogImporterConfiguration`
   `EarliestAcceptableDate`) and a scheduled `log --device-type LidarSensor` job.
4. `DeviceConfiguration` template + operator onboarding doc.
5. Test suite (unit/component/workflow/security/time-base in CI; integration/e2e on demand).
6. Updated `docs/lidar-integration/` reflecting decisions made during build.
7. Pilot validation report on box `10.235.13.48`.

## 5. Acceptance criteria

- `DatabaseInstaller update` applies cleanly on PostgreSQL, SQL Server, MySQL, Oracle, SQLite.
- With one configured LiDAR `Device`, a scheduled run ingests `object_events` for the
  window and writes `CompressedEventLogs<LidarZoneEvent>` hourly rows; a subsequent
  overlapping run adds only new records (no duplicates).
- Pull cadence and window parameters are changeable via configuration with no rebuild.
- `OusterBlueCityEdgeDownloaderClient` obtains a token, paginates to `next_page == null`, refreshes on
  401, and connects over the box's self-signed TLS per the configured posture.
- `lidar-autoconfig` produces a draft "LiDAR" `Location` version in which every parseable
  `…-CO-…` zone is either matched to an existing detector channel or explicitly listed as
  unmatched; applying it never silently changes hand-built config; re-runs are idempotent.
- Existing signal-controller ingestion is unaffected (regression check).
- CI unit/component/workflow tests green.
- **Vendor-neutrality check:** no BlueCity-specific type, field, or branch exists outside
  `OusterBlueCity*` classes and their `Product`/`DeviceConfiguration` rows; `LidarZoneEvent`,
  `EventLogContext`, the archive/aggregation workflow, and the (future) measures layer
  contain nothing named after Ouster or BlueCity (doc 12).

## 6. Assumptions

- Every in-scope box runs the Analytics Server with an `analytics-client` (or equivalent
  confidential client) usable for `client_credentials`; realm `detect` unless stated.
- Boxes are reachable from the ATSPM ingestion host on the UDOT network.
- Each box's intersection is already an ATSPM signal with approaches, phases, and detector
  channels defined; LiDAR zones reuse those channel numbers (per the UDOT guidance).
- Zone names follow the UDOT convention `CLASSES-APPROACH-DIRECTION+LANE-TYPE-CHANNEL#`
  (tolerating documented variants).
- Raw `object_events` retention is ~9–12 days (measured on one box); ATSPM is the system of
  record.
- `ArchiveEventLogsWorkflow` can merge into an existing hourly row (or a small addition
  makes it so).

## 7. Dependencies (UDOT / Ouster — see doc 08 WP0)

- Rotated `analytics-client` credentials per box.
- Confirmation the Analytics Server is enabled on each box.
- Box inventory: address, intersection id, realm.
- Confirmed `TYPE → DetectionTypes` mapping.
- TLS decision (install box CA vs. pinned thumbprint vs. allow-untrusted).
- Confirmation the ~9–12 day retention figure is representative.

## 8. Risks & mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Short box retention (~9–12 d) + a silent ingestion stall | Permanent data loss | WP8 "behind" alert; 5-min cadence; 7-day first-run/backfill window; ATSPM as system of record |
| `object_events` volume (~110k/day/box) | Large hourly blobs, DB growth | Hourly compression (existing); monitor blob size in pilot; revisit if needed |
| Zone names off-standard on some boxes | Auto-config can't match those zones | Parser tolerates known variants; unmatched zones surfaced in the draft, not dropped; operator finishes them |
| `ArchiveEventLogsWorkflow` blind-appends on re-run | Duplicate rows | WP7 verifies; add merge-by-key for the lidar path if needed |
| `DeviceDownloader`/`ConnectAsync` `IPEndPoint` assumption blocks hostnames | Can't address boxes by DNS | Support `ConnectionProperties["BaseUrl"]`; minimal `DownloaderClientBase` change if required |
| Self-signed box certs | TLS failures | Configurable trust: install CA, pin thumbprint, or allow-untrusted flag |
| Analytics API is beta (`2.11.0-beta.1`) — schema may shift | Decoder / client breakage | Decoder tolerant of extra/missing optional fields; fixtures from a real box; version pinned in docs |
| Secret handling (plaintext in `DeviceConfiguration`) | Credential exposure | Matches current controller-credential handling; flagged as a cross-cutting improvement, not lidar-only |

## 9. Effort (relative sizing)

| WP | Size |
| --- | --- |
| WP1 Data model + migrations | M |
| WP2 Edge REST client | L |
| WP3 Decoder | S |
| WP4 Hosted service + config | M |
| WP5 Provisioning | S |
| WP6 Auto-config channel match | L |
| WP7 Archive-merge check | S–M |
| WP8 Observability | S–M |
| WP9 Tests | M (spread across WPs) |
| WP10 Rollout | M (mostly ops) |

S ≈ ½–1 day · M ≈ 2–4 days · L ≈ 5–8 days for one engineer familiar with the codebase;
firm these up against team velocity, not as commitments.

## 10. Environments & rollout

- **Dev/CI:** unit/component/workflow tests with fixtures; no box access.
- **Integration:** opt-in tests against box `10.235.13.48` over the VPN.
- **Pilot:** box `10.235.13.48` and its `Location` — ingestion + auto-config draft, ~1 week
  soak.
- **Production:** remaining LiDAR fleet via WP5 provisioning, monitored via WP8.
