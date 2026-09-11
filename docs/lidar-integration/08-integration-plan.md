# 08 — Integration Plan

Sequenced work packages for **Phase 1**: pull raw `object_events` from BlueCity edge boxes
into ATSPM's event-log store, on an adjustable schedule, with a minimal channel-match
auto-config. Implementation is done by Codex from this plan + docs 02–07.

Everything here follows the decisions in [`05-open-questions.md`](05-open-questions.md)
§Resolved and the "what's best" calls recorded in the README decisions log.

## Dependency graph

```
WP1 Data model ─┬─▶ WP3 Decoder ─┬─▶ WP4 Hosted service + config ─▶ WP9 Tests ─▶ WP10 Pilot → fleet
WP2 Edge client ┘               │
WP2 Edge client ────────────────┴─▶ WP6 Auto-config (channel match)
WP7 Archive-merge check runs alongside WP3/WP4
WP8 Observability layered onto WP4
WP0 (UDOT/Ouster prerequisites) gates WP10, informs WP6
```

---

## WP0 — Prerequisites (UDOT / Ouster, not code)

| Item | Owner | Needed by |
| --- | --- | --- |
| Rotate the `analytics-client` secret on each box; hand ATSPM the new `client_id`/`client_secret` | UDOT/Ouster | WP4 config, WP10 |
| Confirm every in-scope box has the Analytics Server enabled and a working `analytics-client` (Detect GUI → Client Settings) | UDOT | WP10 |
| List of pilot + fleet boxes: IP/hostname, UDOT intersection id (→ `LocationIdentifier`), Keycloak realm if not `detect` | UDOT | WP10 |
| Confirm `TYPE → DetectionTypes` mapping (doc 06 §"The join") | UDOT signal ops | WP6 |
| Decide TLS posture: install each box's CA on the ATSPM host, or per-device pinned thumbprint / allow-untrusted flag | UDOT | WP2 |
| Confirm raw-event retention (measured ~9–12 days on box `10.235.13.48`) is representative | Ouster | WP4 defaults |
| Keycloak client-secret length policy — do any boxes issue secrets > 50 chars? (review M1) | UDOT | WP1 |
| Verify ConfigApi does not return `DeviceConfiguration.Password` to non-admins / in list responses (review S2) | dev | WP5 |
| Confirm all fleet boxes are IP-addressed, or accept `BaseUrl` hostname handling (review M5) | UDOT network | WP2 |

---

## WP1 — Data model + storage

**Deliverables**

- `Atspm/Data/Models/EventLogModels/LidarZoneEvent.cs` — `: EventLogModelBase`, fields and
  types per [`03-data-model.md`](03-data-model.md) (`zone_id` → `long`, `Equals`/`GetHashCode`
  including `ServerId`, string props non-unicode).
- `EventLogContext.LidarZoneEvents` `DbSet<CompressedEventLogs<LidarZoneEvent>>`.
- One `EventLogContext` EF migration **in each provider project**
  (`SqlDatabaseProvider`, `PostgreSQLDatabaseProvider`, `MySqlDatabaseProvider`,
  `OracleDatabaseProvider`, `SqlLiteDatabaseProvider`) — registers the discriminator; no new
  table/columns.
- `LidarZoneEventLogEFRepository : EventLogEFRepositoryBase<LidarZoneEvent>` (mirrors
  `IndianaEventLogEFRepository`; gives `GetEventsBetweenDates` for free) + `IEventLogRepository`
  DI registration line, so `dataapi` / measures can read the rows.
- Optional: nullable `long? BlueCityZoneId` (or a `DeviceProperties` convention) on
  `Detector` for the zone→detector join used by WP6 and future reporting — a `ConfigContext`
  change ⇒ ×5 migrations.
- If Keycloak secrets can exceed 50 chars for the fleet (review M1): widen
  `DeviceConfiguration.Password` / `UserName` in a `ConfigContext` migration (×5).

**Acceptance**

- `DatabaseInstaller update` applies clean on PostgreSQL, SQL Server, MySQL, Oracle, SQLite.
- A hand-built `CompressedEventLogs<LidarZoneEvent>` round-trips (write → read → equal),
  including the Newtonsoft `Data`-blob compression path.
- Discriminator value = `"LidarZoneEvent"`; the type resolves via
  `"{typeof(EventLogModelBase).Namespace}.LidarZoneEvent"` (binder + `CompressionTypeConverter`).

---

## WP2 — Edge REST downloader client

**Deliverables**

- `TransportProtocols.OusterBlueCityEdge` enum value.
- `Infrastructure/Services/DownloaderClients/OusterBlueCityEdgeDownloaderClient.cs : DownloaderClientBase`,
  `Protocol => OusterBlueCityEdge`. Behaviour per [`02-ingestion-pipeline.md`](02-ingestion-pipeline.md):
  - **Connect**: resolve base URL (`ConnectionProperties["BaseUrl"]` or `Ipaddress`+`Port`);
    `client_credentials` POST to `ConnectionProperties["TokenUrl"]` with
    `DeviceConfiguration.UserName`/`Password`; cache token, refresh on expiry/401.
  - **ListResourcesAsync**: compute `[windowStart, windowEnd]` from `LoggingOffset` +
    `ConnectionProperties` knobs; split into `MaxWindowMinutes` chunks; emit one `Uri` per
    chunk (`page=1`, all params: `timezone`, `imperial_measuring_unit`,
    `deduplicate_objects`, `per_page`).
  - **DownloadResourceAsync**: GET the chunk, follow `pagination.next_page` until null,
    concatenate `events[]` (+ the envelope `units`/`timezone`) to one temp `.json`.
  - **DeleteResourceAsync**: no-op. **DisconnectAsync**: dispose `HttpClient`.
  - TLS: honour `PinnedCertThumbprint` (preferred) / `AllowUntrustedCertificate`; do **not**
    follow cross-host redirects; validate `BaseUrl`/`TokenUrl` host is in an allowed range
    (review S1).
  - **Never log** the bearer token or `client_secret`, including on error-body dumps (S3).
- **No DI wiring** — `AddDownloaderClients()` auto-registers it (review P1).
- Hostname support: `DeviceDownloader` throws `ArgumentNullException` if `Device.Ipaddress`
  isn't a parseable IP (review M5). Consume `ConnectionProperties["BaseUrl"]` before that
  point, or confirm all fleet boxes are IP-addressed.

**Acceptance**

- Against box `10.235.13.48` on the VPN (or a recorded HTTP fixture): obtains a token,
  lists chunk URIs for a 20-minute window, downloads a temp file containing all `events`
  across every page, terminates on `next_page == null`.
- Token refresh exercised (short-TTL simulation or forced 401).
- Log output contains no token/secret material (grep the test logs).

---

## WP3 — Decoder

**Deliverables**

- `Infrastructure/Services/EventLogDecoders/OusterBlueCityObjectEventsDecoder.cs :
  EventLogDecoderBase<LidarZoneEvent>`.
  - `Decode`: `System.Text.Json` parse of the concatenated file → `LidarZoneEvent` per the
    field map; `LocationIdentifier` from `device.Location.LocationIdentifier`; `Timestamp` =
    the record's local time with the offset **stripped** (`DateTimeKind.Unspecified`) —
    request tz = box `config.timezone`, **not UTC** (review B1); `Units` from the envelope;
    **trim `zone_name`**; return a `HashSet` de-duped on the equality key.
  - Newtonsoft-serialisable POCO: the `Data` blob is written by Newtonsoft
    (`CompressedListConverter`), so keep `LidarZoneEvent` attribute-free (or Newtonsoft
    attributes only).
- Name registration so `DeviceConfiguration.Decoders = ["OusterBlueCityObjectEventsDecoder"]`
  resolves it in `EventLogFileImporter`.

**Acceptance**

- Unit test: the captured sample from box `10.235.13.48` decodes to the expected
  `LidarZoneEvent` set (counts, field values, dedupe across an overlapping fixture).
- Malformed page → `EventLogDecoderException` (matches existing importer behaviour).

---

## WP4 — Scheduling + configuration  *(no hosted service — review M4)*

`HostedServiceBase` has no timer; the `log` command already filters by `--device-type` /
`--transport-protocol`. So Phase 1 adds **no** `LidarEventLogHostedService` and **no**
`Interval` config.

**Deliverables**

- A scheduled invocation of `EventLogUtility log --device-type LidarSensor`
  (cron / k8s CronJob / Task Scheduler), separate from the signal-controller `log` run, at
  the desired cadence (≈ 5 min).
- Set the LiDAR path's `EventLogImporterConfiguration…EarliestAcceptableDate` at least as
  old as the backfill window (≈ now − 12 d) so the decoder does not silently drop rows
  (review H2). Add to `docker-compose.yml` / `appsettings` env.
- Documented per-device `DeviceConfiguration` / `ConnectionProperties` knobs
  ([`02`](02-ingestion-pipeline.md) §"Window") with the decided defaults
  (`Imperial=true`, `Timezone` = box `config.timezone`, `FirstRunWindowMinutes=10080`).
- Optional (only if batch tuning must diverge): a thin `lidar-log` command wrapping the same
  workflow with LiDAR-specific batch defaults.

**Acceptance**

- With one lidar `Device` configured for box `10.235.13.48`, a scheduled
  `log --device-type LidarSensor` run produces `CompressedEventLogs<LidarZoneEvent>` hourly
  rows in `EventLogContext`; a second run ~5 min later adds only new records (no duplicate
  rows or double-counted events — see WP7).
- Changing the cadence (the schedule) or any window value is a config edit — no rebuild.
- The signal-controller `log` run is untouched (regression check).

---

## WP5 — Provisioning

**Deliverables**

- A `Product` row for "Ouster BlueCity" (doc 12 §"Recording the vendor") and a "BlueCity
  Edge" `DeviceConfiguration` template pointing at it (protocol `OusterBlueCityEdge`,
  decoder, timeouts, shared `ConnectionProperties`).
- Operator doc: how to add a box (`Device` + link to config + `LocationIdentifier` +
  credentials), based on [`04-configuration-and-mapping.md`](04-configuration-and-mapping.md).
- Optional: extend `DatabaseInstaller setup-test` (`devices.json`) with an `OusterBlueCityEdge`
  example for local testing.

**Acceptance**

- A new box can be brought online through `configapi` (or seed) with no code change.

---

## WP6 — Auto-config (channel match)

**Deliverables**

- Zone-name parser: `CLASSES-APPROACH-DIRECTION+LANE-TYPE-CHANNEL#` →
  `{ classes[], approach, movement, lane, services:[{type, channel}] }`, tolerant of the
  known variants (`LT`/`TL`, prefix-less `…-Q-Ln`, multi-channel `COYR-1723` / `-55-57`).
- `lidar-autoconfig` capability — a `configapi` action and/or `DatabaseInstaller` command:
  1. pull `GET /snmp/zone_mappings` (+ `/config`) via the WP2 client;
  2. for each parsed `(type, channel)`: match an existing `Detector` at the `Device`'s
     `Location` by `DetectorChannel` → stage `DetectionHardware = LiDar`,
     `LatencyCorrection = 0`, set `BlueCityZoneId`; unmatched → stage a new `Detector` on
     the `Approach` for the direction (mapping tables in doc 06);
  3. emit a **draft** as a new `"LiDAR"` `Location` version (not auto-applied), each field
     tagged with its source (`matched-channel` / `new` / `needs-review`);
  4. apply on operator confirm.
- `TYPE → DetectionTypes` and `DIRECTION → MovementType` / `APPROACH → DirectionType`
  mapping tables (confirm with UDOT — WP0).

**Acceptance**

- Run against box `10.235.13.48`'s `Location`: every `VC-…-CO-…` zone matches an existing
  detector channel (or is clearly listed as unmatched); the draft is reviewable and
  applies as a new location version; re-running is idempotent.
- No existing hand-built config is modified without appearing in the draft diff.

**Scope guard:** phase 1 is the *channel-match draft* only. Full generate/merge/reconcile
with automatic periodic re-sync is a fast-follow (doc 06).

---

## WP7 — Idempotency / archive-merge  *(review H1 — gating check)*

`IEventLogRepositoryExtensions.Upsert` merges by `Enumerable.Union(...).ToHashSet()` **only
when `LookupAsync` finds the existing row by PK `(LocationIdentifier, DeviceId, DataType,
Start, End)`**. `ArchiveDataEvents` sets `Start`/`End` from
`new Timeline<StartEndRange>(list, TimeSpan.FromHours(1))` — a toolkit type whose snapping
behaviour is **not in this repo**.

**Deliverable — verify empirically, then branch:**

- **If `Timeline` snaps `Start`/`End` to the hour boundary:** no code change. Idempotency
  then rests entirely on `LidarZoneEvent.Equals`/`GetHashCode` (spec'd in doc 03) — add
  tests for it.
- **If it does not snap:** two overlapping polls of the same hour create two rows (different
  `Start`), and `GetEventsBetweenDates` (`SelectMany`, no cross-row dedupe) then
  double-counts. Add an hour-snap for the LiDAR archive path (a small `ArchiveDataEvents`
  variant, or floor `Start` / ceil `End` before `Upsert`).

**Acceptance**

- Ingesting two deliberately overlapping windows yields exactly one compressed row per
  `(location, device, LidarZoneEvent, hour)` and, on read-back, exactly one event per
  `(LocationIdentifier, Timestamp, ZoneId, ObjectId, ServerId)`.

---

## WP8 — Observability

**Deliverables**

- Structured logging through the existing `DeviceDownloaderLogMessages` /
  decoder log-message pattern (token acquisition, chunk counts, page counts, row counts,
  skips).
- A "device is N days behind" signal — a `WatchDog` component type or a simple metric —
  since box retention is ~9–12 days and a silent ingestion stall loses data permanently.

**Acceptance**

- A deliberately stopped ingestion surfaces the "behind" condition before data ages out.

---

## WP9 — Testing

| Level | What |
| --- | --- |
| Unit | Zone-name parser (WP6) across the standard + variants; `OusterBlueCityObjectEventsDecoder` against captured fixtures incl. an overlapping pair for dedupe |
| Component | `OusterBlueCityEdgeDownloaderClient` against a stubbed HTTP handler (token, multi-page, `next_page` termination, 401 refresh, TLS flag) |
| Workflow | `DeviceEventLogWorkflow` with a fake `IDownloaderClient` feeding fixture files → assert `CompressedEventLogs<LidarZoneEvent>` output |
| Integration (gated) | Against box `10.235.13.48` over the VPN — opt-in test, not in CI |
| End-to-end | Configure a box → scheduled run → rows in `EventLogContext` → read back via `dataapi` |
| Security | Logs carry no token/secret (S3); `BaseUrl`/`TokenUrl` host-range validation rejects an out-of-range host (S1); ConfigApi `Password` not exposed on read (S2) |
| Time base | Stored `Timestamp` values are naive local matching a co-located `IndianaEvent` for the same wall-clock minute (B1); a backfill spanning `EarliestAcceptableDate` is not silently clipped (H2) |

**Acceptance:** unit + component + workflow + security + time-base tests green in CI;
integration/e2e runnable on demand with documented setup.

---

## WP10 — Rollout

1. **Pilot:** one box (`10.235.13.48` / its `Location`). Run WP4 ingestion + WP6 auto-config
   draft. Validate row volumes, dedupe, channel matches, retention headroom for ~1 week.
2. **Widen:** onboard the rest of the LiDAR fleet via WP5 provisioning; monitor WP8 signals.
3. **Hand-off:** operator runbook (add a box, read the "behind" alert, re-run auto-config
   after a zone change).

---

## Phase 2+ — new measures

Planned separately in [`11-measures-plan.md`](11-measures-plan.md): analysis pipelines,
LiDAR aggregations, `reportapi` endpoints and `webui` charts, plus the optional
`LidarZoneEvent → IndianaEvent` path that feeds LiDAR into the *existing* detector measures.
Sequenced MP1–MP7; depends on Phase-1 S1 + WP6.

---

## Explicitly deferred (not Phase 1)

- Aggregation types + `AggregationWorkflow` rollups for `LidarZoneEvent`.
- `reportapi` measures + `webui` charts for lidar data.
- Secondary endpoints (`turning_movements`, `zone_metadata`, `zone_occupancy`,
  `zone_queue_length`).
- `DatabaseInstaller` backfill command (bounded by box retention anyway).
- Full generate/merge/reconcile auto-config with scheduled re-sync.
- Reading the UDOT intersection id from the Detect core API (phase 1 = operator-entered).
- Cloud API (Category 1) and real-time gRPC (Category 3) — out of scope entirely.
