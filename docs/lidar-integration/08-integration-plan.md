# 08 — Integration Plan

Sequenced work packages for **Phase 1**: pull raw `object_events` from BlueCity edge boxes
into ATSPM's event-log store, on an adjustable schedule, with a minimal channel-match
auto-config. Implementation is done by Codex from this plan + docs 02–07.

Everything here follows the decisions in [`05-open-questions.md`](05-open-questions.md)
§Resolved and the "what's best" calls recorded in the README decisions log.

## Dependency graph

```
WP1 Data model ─┬─▶ WP3 Decoder ─┬─▶ WP4 Scheduling + config ─▶ WP9 Tests ─▶ WP10 Pilot → fleet
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
| List of pilot + fleet boxes: IP/hostname, UDOT intersection id (→ `LocationIdentifier`), Keycloak realm if not `detect` — **confirmed still genuinely open** (doc 17 §6): no fleet inventory/export exists in-repo (`DeviceEmulator/devices.json` is loopback emulator addresses; `Location7115TestData.json` is an unrelated test fixture); doc 07's `10.235.13.48` is a one-off verified pilot box, not an authoritative inventory entry. The config schema (`Device.Ipaddress`/`LocationId`/`DeviceConfigurationId` → `Location.LocationIdentifier`) can support an export once UDOT has the data — nothing to build ahead of that. | UDOT | WP10 |
| Confirm `TYPE → DetectionTypes` mapping (doc 06 §"The join") | UDOT signal ops | WP6 |
| Decide TLS posture: install each box's CA on the ATSPM host, or per-device pinned thumbprint / allow-untrusted flag | UDOT | WP2 |
| Confirm raw-event retention (measured ~9–12 days on box `10.235.13.48`) is representative | Ouster | WP4 defaults |
| Keycloak client-secret length policy — do any boxes issue secrets > 50 chars? (review M1) | UDOT | WP1 |
| ~~Verify ConfigApi does not return `DeviceConfiguration.Password`...~~ **Resolved — no longer a WP0/UDOT item.** Confirmed by spike (doc 17 §5): `Password` **is** exposed via the OData EDM to any `Device:View`-authorized caller (not just admins — e.g. `LocationConfigurationAdmin`), unredacted; `ConnectionProperties` is equally exposed. This is dev work now (a credential-free read DTO/EDM projection + a write path preserving omitted secrets), not something to wait on UDOT for. | dev | WP5 (before go-live — the BlueCity Keycloak secret is otherwise readable by any device-view role) |
| Confirm all fleet boxes are IP-addressed, or accept `BaseUrl` hostname handling (review M5) | UDOT network | WP2 |

---

## WP1 — Data model + storage

**Deliverables**

- `Atspm/Data/Models/EventLogModels/LidarZoneEvent.cs` — `: EventLogModelBase`, fields and
  types per [`03-data-model.md`](03-data-model.md) (`zone_id` → `long`, `Equals`/`GetHashCode`
  including `ServerId`, string props non-unicode), **`[ProtoContract]` + numbered
  `[ProtoMember]` attributes** (protobuf-net — see doc 03 §"`Data` payload format"; this
  supersedes the earlier "attribute-free" guidance, which assumed the shared Newtonsoft path).
- New `protobuf-net` (or `protobuf-net.Core`) package reference in `Atspm/Data.csproj`.
- **Build on top of `codex/blueband-lidar-event-import`**, not a parallel implementation —
  that branch already introduced the versioned compression envelope (`EventLogCompression.cs`,
  `EventLogCompressedListConverter<T>`) that this work extends with a new `ProtobufCodec`
  value (doc 03 §"`Data` payload format", doc 15). Merge/rebase/cherry-pick coordination with
  that branch is a prerequisite, since both touch `EventLogContext.OnModelCreating` and the
  shared converter class.
- **X14 is resolved (spike, doc 17 §2): no per-type EF converter override exists** — it
  throws `InvalidOperationException` at model-build time. Storage design is a **write-time
  runtime-type dispatcher inside the one shared converter**, not a second parallel converter:
  - Extend `EventLogCompression.cs`'s envelope with a type-identifier field (alongside its
    existing magic/version/codec/length/hash) so `Decode()` knows which concrete contract to
    deserialize a row into.
  - Extend `EventLogCompressedListConverter<EventLogModelBase>` (or a wrapping dispatcher) to
    inspect the list's runtime element type on write, validate homogeneity explicitly (the
    property is `IEnumerable<EventLogModelBase>` — nothing in the type system prevents a mixed
    or wrong-type list; spike confirmed this compiles and only fails on read as an
    `InvalidCastException`), and pick a codec/contract accordingly.
  - `LidarZoneEvent`'s protobuf contract must be **flat and explicit** — declare
    `LocationIdentifier`/`Timestamp` (inherited from `EventLogModelBase`) as its own numbered
    `[ProtoMember]`s. Spike found that relying on inherited `[ProtoContract]` alone **silently
    drops `Timestamp`** (deserializes to `DateTime.MinValue`, no exception) — this is a
    silent-data-loss risk, not a build-time catch, so WP9 needs an explicit round-trip
    assertion on `Timestamp`/`LocationIdentifier`, not just the LiDAR-specific fields.
  - This is genuinely shared-infrastructure work (the dispatcher and envelope extension serve
    every event type, not just LiDAR) — size WP1 accordingly, and prove no regression with
    round-trip tests for `IndianaEvent`/`SpeedEvent`/`BluebandLidarEvent` too.
  - **The write-format decision itself (which codec each event type writes with) is still a
    fleet-wide/coordinated choice** — see doc 03; don't assume Phase-1 LiDAR ships writing
    Protobuf by default without that conversation happening.
- `EventLogContext.LidarZoneEvents` `DbSet<CompressedEventLogs<LidarZoneEvent>>`.
- One `EventLogContext` EF migration **in each provider project**
  (`SqlDatabaseProvider`, `PostgreSQLDatabaseProvider`, `MySqlDatabaseProvider`,
  `OracleDatabaseProvider`, `SqlLiteDatabaseProvider`) — registers the discriminator; no new
  table/columns.
- `LidarZoneEventLogEFRepository : EventLogEFRepositoryBase<LidarZoneEvent>` (mirrors
  `IndianaEventLogEFRepository`; gives `GetEventsBetweenDates` for free) + `IEventLogRepository`
  DI registration line, so `dataapi` / measures can read the rows.
- **Required** (not optional, correcting an earlier draft of this doc): nullable
  `long? LidarZoneId` on `Detector` for the zone→detector join — a `ConfigContext` change
  ⇒ ×5 migrations. WP6 (auto-config), MP1 (doc 11's read API), and doc 09's deliverables list
  all depend on this field existing; it should not be treated as skippable. Without it, the
  zone→detector join would have to re-parse `zone_name` on every read instead of a stored key.
- If Keycloak secrets can exceed 50 chars for the fleet (review M1): widen
  `DeviceConfiguration.Password` / `UserName` in a `ConfigContext` migration (×5).

**Acceptance**

- `DatabaseInstaller update` applies clean on PostgreSQL, SQL Server, MySQL, Oracle, SQLite.
- A hand-built `CompressedEventLogs<LidarZoneEvent>` round-trips (write → read → equal)
  through the protobuf dispatcher path — **explicitly asserting `Timestamp` and
  `LocationIdentifier` survive** (spike found these silently zero out without an explicit flat
  contract) — and a round-trip of an existing type (e.g. `IndianaEvent`) still passes
  unchanged, proving the dispatcher didn't regress the shared JSON converter.
- Discriminator value = `"LidarZoneEvent"`; the type resolves via
  `"{typeof(EventLogModelBase).Namespace}.LidarZoneEvent"` (binder + `CompressionTypeConverter`
  — discriminator resolution is separate from, and unaffected by, the `Data` payload format).

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
  - `LidarZoneEvent` itself is decode-target only here — the decoder's own JSON parsing
    (`System.Text.Json`, above) is unrelated to how the model is later *stored*. **Storage
    format is protobuf-net now, not Newtonsoft** (WP1, doc 03) — `LidarZoneEvent` carries
    `[ProtoContract]`/numbered `[ProtoMember]` attributes for that path. This decoder doesn't
    need to know or care which storage converter runs downstream; it just builds `LidarZoneEvent`
    instances and returns them, same as any other decoder.
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
- **Credential-free `DeviceConfiguration` read projection (confirmed required, doc 17 §5, doc
  05 Q8):** the ConfigApi OData EDM currently returns `Password` and `ConnectionProperties`
  unredacted to any `Device:View`-authorized caller — that includes the Keycloak client secret
  this feature stores. A read DTO/EDM projection that omits `Password` and secret-valued
  `ConnectionProperties` keys, with a write path that preserves omitted secrets on update
  (don't null them out just because a read-sanitized payload gets echoed back on save), is
  required **before** any BlueCity box goes live with real credentials — not a nice-to-have.
- Optional: extend `DatabaseInstaller setup-test` (`devices.json`) with an `OusterBlueCityEdge`
  example for local testing.

**Acceptance**

- A new box can be brought online through `configapi` (or seed) with no code change.
- A `Device:View`-only caller reading a BlueCity `DeviceConfiguration` (default `$select`,
  `$select=*`, and the expanded-device path) never receives `Password` or the Keycloak secret
  via `ConnectionProperties`; an authorized write can still update the config without needing
  to resupply the secret it wasn't shown.

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
     `LatencyCorrection = 0`, set `LidarZoneId`; unmatched → stage a new `Detector` on
     the `Approach` for the direction (mapping tables in doc 06). If the direction has no
     existing `Approach` either, stage a new `Approach` with `ProtectedPhaseNumber = 0`
     (verified-safe sentinel, doc 06) tagged `needs-review` — never leave it unset;
  3. emit a **draft** as a new `"LiDAR"` `Location` version (not auto-applied), each field
     tagged with its source (`matched-channel` / `new` / `needs-review`);
  4. apply on operator confirm — the apply step must **block** on any `needs-review` new
     `Approach` still carrying `ProtectedPhaseNumber = 0` unless the operator explicitly
     overrides it, so a real phase number can never be silently skipped.
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

## WP7 — Idempotency / archive-merge  *(review H1 — confirmed, needs a fix)*

`IEventLogRepositoryExtensions.Upsert` merges by `Enumerable.Union(...).ToHashSet()` **only
when `LookupAsync` finds the existing row by PK `(LocationIdentifier, DeviceId, DataType,
Start, End)`**. `ArchiveDataEvents` sets `Start`/`End` from
`new Timeline<StartEndRange>(list, TimeSpan.FromHours(1))`.

**Resolved by spike, 2026-09-17 ([`17-preflight-findings.md`](17-preflight-findings.md) §4)
— against the real installed `Utah.Udot.NetStandardToolkit` 1.6.0 assembly, not a guess.**
`Timeline` floors `Start` and ceilings `End` to the hour in the general case (e.g. inputs at
`10:12` and `10:48` → `[10:00, 11:00)`) — **but a batch containing only events exactly on an
hour boundary produces a degenerate `Start == End`** (e.g. a batch of just `10:00:00` →
`Start = End = 10:00`, not `[10:00, 11:00)`). A later poll that also has events later in that
same hour then computes the normal `[10:00, 11:00)` range for the same hour — **different PK,
same hour, two rows** — exactly the double-count scenario this WP exists to prevent, just
triggered by an edge case (a poll window landing on an exact hour boundary with no other
events that hour) rather than the general "does it snap" question.

**Deliverable (revised — this is no longer conditional):**

- The LiDAR archive path must compute its own canonical `Start` (floor to the hour) and
  `End = Start + TimeSpan.FromHours(1)` **explicitly**, rather than trusting `Timeline`'s
  output as the row's PK — a small `ArchiveDataEvents` variant or a pre-step before `Upsert`.
  Applying floor/ceil *again* to `Timeline`'s already-degenerate output does not fix this case
  (`floor(10:00) == ceil(10:00) == 10:00` either way) — the fix has to construct the hour
  range directly from the batch's own timestamp, not post-process `Timeline`'s result.
- Idempotency also still rests on `LidarZoneEvent.Equals`/`GetHashCode` (spec'd in doc 03) for
  within-row de-duplication — both mechanisms are needed, not either/or.
- Add a fixture specifically for the exact-hour-boundary case (a poll containing only
  `HH:00:00` events, followed by a poll with `HH:00:00`+later-in-hour events) alongside the
  general overlapping-window fixture — the spike found this case because it was tested
  explicitly; don't rely on the general case to catch it.

**Acceptance**

- Ingesting two deliberately overlapping windows — **including the exact-hour-boundary case
  above** — yields exactly one compressed row per `(location, device, LidarZoneEvent, hour)`
  and, on read-back, exactly one event per
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
| Auto-config | `lidar-autoconfig` against a fixture `Location` with pre-existing `Detector`s: every zone with a matching channel updates in place (no new row); unmatched zones stage new `Detector`s; a zone whose direction has no existing `Approach` stages a new `Approach` with `ProtectedPhaseNumber = 0` tagged `needs-review`, and apply is blocked until the operator clears that flag; re-running against unchanged box config is a no-op diff (idempotent); no hand-built field is overwritten without appearing in the draft |
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
