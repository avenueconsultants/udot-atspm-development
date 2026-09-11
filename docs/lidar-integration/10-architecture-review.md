# 10 — Architecture / Compatibility / Security Review

A second, code-level pass verifying the plan against the actual ATSPM implementation on
`main` (not just the earlier trace). Findings are ranked; **B = blocker**, **H = high**,
**M = medium**, **P = positive / confirmed**, **S = security**.

Where a finding changes a decision, the affected doc has been updated and is noted.

---

## B1 — Event-log time base is naive **intersection-local**, not UTC  *(docs 02/03/04 corrected)*

Evidence:
- `EventLogFileImporter.IsAcceptableDateRange`: `log.Timestamp <= DateTime.Now && log.Timestamp > _options.EarliestAcceptableDate` — uses **`DateTime.Now`** (server-local), not `UtcNow`.
- No report/aggregation/analysis code applies any UTC⇄local conversion to event-log
  timestamps (`grep` of `Application/Business`, `Application/Analysis`, `ReportApi` — the
  only UTC handling is an unrelated CSV importer).
- `Location` has **no timezone field** — only `Latitude`/`Longitude`; local time is derived
  from coordinates (`ICoordinates.GetLocalTimeFromCoordinates()`).
- `DatabaseInstaller transfer-speed` doc: *"Source timestamps are used as stored; the
  command does not apply a UTC or local-time conversion."*
- `EventLogContext.ConfigureConventions`: Npgsql `DateTime` → `timestamp` (no time zone).

Impact if we stored UTC (as the earlier drafts said):
1. Every LiDAR-derived measure would be shifted from the signal data by the UTC offset
   (6–7 h in Utah) — silent, wrong comparisons.
2. If the ingestion host runs in UTC while the intersection is `US/Mountain`, UTC timestamps
   for the most recent 6–7 h are **> `DateTime.Now`** and get **silently dropped** by
   `IsAcceptableDateRange`.

**Resolution:** request `object_events` with `timezone = <the box's own `config.timezone`>`
(verified value on the pilot box: `US/Mountain`) and store the returned local time as a
**naive `DateTime`** (strip the offset). Read `/analytics/api/v1/config` at connect to get
that zone. Docs 02/03/04 updated; `ConnectionProperties["Timezone"]` default changed from
`UTC` to `"(from box /config)"`.

---

## H1 — Overlapping re-polls can create duplicate compressed rows

`ArchiveEventLogsWorkflow` path:
- `ArchiveDataEvents` groups events by `(LocationIdentifier, Y, M, D, Hour, DeviceId, Type)`
  and sets `comp.Start`/`comp.End` from `new Timeline<StartEndRange>(list, TimeSpan.FromHours(1))`.
- `SaveArchivedEventLogs` → `IEventLogRepositoryExtensions.Upsert`: `LookupAsync(input)` by
  **PK `(LocationIdentifier, DeviceId, DataType, Start, End)`**; if found, merges via
  `Enumerable.Union(existing.Data, input.Data).ToHashSet()`; else `AddAsync`.

So the merge only happens when the incoming row's `Start`/`End` **exactly equal** an
existing row's. Two overlapping polls of the same hour produce identical `Start`/`End`
**only if `Timeline` snaps them to the hour boundary.** If `Timeline` instead returns the
min/max of the batch's data, poll #2 (a 10:55–11:05 overlap) yields
`Start = 10:55:xx` for hour 10 → new PK → **second row for hour 10**.

Downstream, `EventLogEFRepositoryBase.GetEventsBetweenDates` does
`...SelectMany(m => m.Data)...` with **no de-duplication across rows** → the same event is
read twice → **measures double-count**.

`Timeline` is in the `Utah.Udot.NetStandardToolkit` NuGet (source not in this repo) so its
snapping behaviour **must be verified empirically** (WP7). Two outcomes:
- **If it snaps to the hour** — no code change; idempotency then rests entirely on
  `LidarZoneEvent.Equals`/`GetHashCode` (the `HashSet` union key). Spec'd in doc 03; keep it.
- **If it does not snap** — the LiDAR archive path needs an hour-snap before `Upsert`
  (a small `ArchiveDataEvents` variant, or floor `Start`/ceil `End` in a pre-step).

WP7 in the plan is updated to state both branches and make the empirical check a gate.

---

## H2 — `EarliestAcceptableDate` will silently truncate a backfill

`IsAcceptableDateRange` also drops anything `<= _options.EarliestAcceptableDate`
(`EventLogImporterConfiguration.EventLogFileImporter.EarliestAcceptableDate`, an env/config
value already used in `docker-compose`). A 7-day first-run/backfill window is **silently
clipped** to `EarliestAcceptableDate` if that is set more recently.

**Resolution:** the LiDAR importer config must set `EarliestAcceptableDate` to at least the
oldest backfill point (≈ now − 12 days, matching box retention). Added to plan WP4 and to
doc 04.

---

## M1 — `DeviceConfiguration.Password` / `UserName` are `HasMaxLength(50)`

`Data/Configuration/DeviceConfigConfiguration.cs`. The pilot box's `analytics-client`
secret is 32 chars → fits. A regenerated secret under a longer Keycloak policy (some issue
48–64+) would be **silently truncated on save** → auth fails with no obvious cause.
**Action:** confirm the Keycloak secret-length policy for the fleet, or widen `Password`
(and `UserName`) in a `ConfigContext` migration (×5 providers). Noted in doc 04 and plan
WP0/WP1.

## M2 — `DeviceConfiguration.ConnectionProperties` is `HasMaxLength(1024)`

The JSON-serialised dictionary is capped at 1024 chars. The proposed knob set + `BaseUrl` +
`TokenUrl` + `BackfillStart` is ~450–650 chars — fits, but thin. **Action:** keep
`ConnectionProperties` to flat scalars; derive `BaseUrl`/`TokenUrl` in the client from
`Ipaddress` + `Realm` where possible instead of storing full URLs. Doc 04 updated.

Also: `DeviceDownloader` stringifies every `ConnectionProperties` value
(`k.Value.ToString()`) before handing them to the client as `Dictionary<string,string>` —
so the client must `int.Parse` / `bool.Parse` its knobs, and values **must be flat scalars**
(a nested object would serialise oddly). Doc 02 updated.

## M3 — `DeviceConfiguration.Description` is `HasMaxLength(24)` and required

"Ouster BlueCity Edge — object_events" (34) is too long. Template description must be ≤ 24
chars (e.g. `"BlueCity Edge events"`). Doc 04 example updated.

## M4 — There is no timer; a dedicated hosted service + interval is unnecessary  *(docs 01/02/05/08 simplified)*

`HostedServiceBase.StartAsync` runs `Process(...)` **once** and exits — no loop. Cadence is
entirely "how often something invokes `EventLogUtility log`". And `LogConsoleCommand`
**already** exposes `--device-type` and `--transport-protocol` filters
(`DeviceEventLoggingQueryOptions`).

**Resolution:** Phase 1 does **not** add `LidarEventLogHostedService` or a
`…Configuration.Interval`. Instead: schedule a separate invocation of
`EventLogUtility log --device-type LidarSensor` (or `--transport-protocol OusterBlueCityEdge`) at the
desired cadence. "Adjustable pull timing" = (a) that schedule + (b) the per-device
`ConnectionProperties` window knobs. A thin dedicated command is an optional later item only
if batch-size tuning needs to diverge. Docs updated; plan WP4 rewritten.

## M5 — `DeviceDownloader` hard-fails on a non-IP `Device.Ipaddress`

In `DeviceDownloader.Execute`, when `IPAddress.TryParse(Ipaddress)` fails the `throw` is
commented out, then `new IPEndPoint(ipaddress /* null */, port)` throws
`ArgumentNullException`. So **boxes must be addressable by IP** unless `DeviceDownloader` /
`OusterBlueCityEdgeDownloaderClient` is given a hostname path (`ConnectionProperties["BaseUrl"]`
consumed before the `IPEndPoint` is built). The pilot box is an IP, so Phase-1 pilot is
unaffected; fleet rollout needs confirmation or the small accommodation. Doc 02 / plan
updated (X8).

---

## Confirmed good (no change needed)

- **P1 — DI is automatic.** `AddDownloaderClients()` → `RegisterServicesByInterface<IDownloaderClient>()`
  and `AddEventLogDecoders()` → `RegisterServicesByInterface<IEventLogDecoder>()` register
  **every** implementation in the Infrastructure assembly. `OusterBlueCityEdgeDownloaderClient` and
  `OusterBlueCityObjectEventsDecoder` need **no** explicit wiring. `EventLogFileImporter` then
  resolves the decoder by `w.GetType().Name` against `DeviceConfiguration.Decoders[]`. Doc 02
  overstated this; corrected.
- **P2 — `ArchiveDataEvents` is fully generic** — `Activator.CreateInstance(typeof(CompressedEventLogs<>).MakeGenericType(eventType))`.
  `LidarZoneEvent` archives with zero changes to the archive step.
- **P3 — Namespace requirement is double-locked.** `LidarZoneEvent` **must** be
  `Utah.Udot.Atspm.Data.Models.EventLogModels` in the `Data` assembly, with a **unique
  short name ≤ 32 chars**. Required independently by (a) `AddCompressedTableDiscriminators`
  (scans `EventLogModelBase` subclasses in that assembly) and (b)
  `CompressedSerializationBinder` / `CompressionTypeConverter`, which both resolve
  `"{EventLogModelBase.Namespace}.{ShortName}"`. Already stated in doc 03; reinforced.
- **P4 — `Upsert` de-dupes by `HashSet`** — so a correct `Equals`/`GetHashCode` on
  `LidarZoneEvent` (spec'd in doc 03) yields idempotent merges, subject to H1.
- **P5 — .NET 8** across all projects; provider-agnostic. Event fields live **inside** the
  GZip-compressed `byte[]` `Data` blob, so `long`/`float`/`string`/`DateTime` fields raise
  **no per-provider column concerns** — only the ×5 discriminator migration matters.
- **P6 — `AggregationWorkflow`** decompresses archived events and fans them to sub-workflows;
  a LiDAR aggregation is a new sub-workflow wired in (or a sibling workflow). See
  [`11-measures-plan.md`](11-measures-plan.md).

---

## Security review

| # | Area | Assessment / action |
| --- | --- | --- |
| S1 | **SSRF** — ATSPM makes outbound HTTPS to operator-set `Ipaddress` / `ConnectionProperties["BaseUrl"]` / `["TokenUrl"]` | Same trust model as the existing FTP/SFTP/HTTP downloaders (operator supplies the host). Keep `configapi` writes admin-gated (JWT). **Add config validation** restricting `BaseUrl`/`TokenUrl` hosts to UDOT private ranges; **don't follow cross-host redirects** in the client. |
| S2 | **Credential exposure** — `client_secret` in `DeviceConfiguration.Password` (plaintext / DB-native), and `Password` is in the ConfigApi OData EDM (`DeviceConfigurationOdataConfiguration`) | **Verify** the ConfigApi `DeviceConfiguration` projection does not return `Password` to non-admins or in list/`$select=*` responses; restrict or `[IgnoreDataMember]` it on read DTOs. Rotate the shared `analytics-client` secret. Medium-term: device-credential secret store (cross-cutting, not lidar-only). |
| S3 | **Secrets in logs** | New client must never log the bearer token or `client_secret` — including on 4xx/5xx response-body dumps. Explicit acceptance check in WP2/WP9. |
| S4 | **TLS to a self-signed box** | `AllowUntrustedCertificate` disables validation → MITM exposure on the ATSPM↔box path. Prefer **`PinnedCertThumbprint`** or installing the box CA on the ATSPM host. Treat allow-untrusted as an explicit, per-device opt-in, never the global default. |
| S5 | **Data sensitivity** | `object_events` carry per-track UUIDs (not plates), speeds, class — low PII. Handle like existing detector data for access/retention. |
| S6 | **Resource / DoS** | ~110k rows/day/box; a 7-day first-run ≈ ~800k rows in one invocation. Bound `MaxWindowMinutes`, `PageSize`, and devices-per-invocation; reuse existing batch sizes. |
| S7 | **Deserialization** | `TypeNameHandling.Arrays` + `CompressedSerializationBinder` only resolves short names within one namespace/assembly, and the `Data` column is ATSPM-written, not user-supplied. `LidarZoneEvent` is a primitive POCO — **no new gadget surface**. Do not add a broader `TypeNameHandling` anywhere for LiDAR. |
| S8 | **AuthZ for auto-config** | `lidar-autoconfig` mutates `ConfigContext` (new `Location` version). Gate it behind the same admin authorization as other config writes; the draft-then-apply flow keeps a human in the loop. |

---

## Net verdict

The design **fits the ATSPM architecture** and reuses the intended extension points
(`IDownloaderClient`, `IEventLogDecoder`, `CompressedEventLogs<T>`, the `log` command's
device filters, the aggregation fan-out). No architectural rework is required.

**Must fix before / during implementation:** B1 (local time base — done in docs), H1 (verify
`Timeline` hour-snap; add snap if absent), H2 (`EarliestAcceptableDate`), M1 (secret column
length), M4 (drop the phantom timer — done in docs).

**Security posture** is equivalent to the existing device-ingestion path; the additions to
make are: pin/CA the box TLS instead of allow-untrusted, confirm ConfigApi doesn't leak
`Password`, restrict outbound host ranges, and keep secrets out of logs.
