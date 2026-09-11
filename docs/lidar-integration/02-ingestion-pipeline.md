# 02 — Ingestion Pipeline

Implements **pattern A**: a new `IDownloaderClient` plus a new `IEventLogDecoder`, plugged
into the existing `DeviceEventLogWorkflow`. **No new hosted service** — cadence comes from
scheduling the existing `EventLogUtility log` command filtered to LiDAR devices (see
§ Adjustable pull timing). Both new components are **auto-registered** in DI
(`AddDownloaderClients()` / `AddEventLogDecoders()` scan the Infrastructure assembly for
every `IDownloaderClient` / `IEventLogDecoder`).

> **Time base (review finding B1):** ATSPM's event-log pipeline stores and queries **naive
> intersection-local `DateTime`** — `EventLogFileImporter` compares against `DateTime.Now`
> (server-local), no report/aggregation code does UTC conversion, and `Location` has no
> timezone field. Therefore this integration requests `object_events` with
> `timezone = <the box's own config.timezone>` and stores the returned local time as a
> naive `DateTime`. **Do not request or store UTC.**

## The `IDownloaderClient` contract (existing)

`DeviceDownloader` drives every client through the same lifecycle:

| Call | Existing meaning | Edge REST meaning |
| --- | --- | --- |
| `ConnectAsync(IPEndPoint, NetworkCredential, connTimeout, opTimeout, connProps, ct)` | open FTP/SFTP/HTTP session | resolve base URL, fetch a Keycloak access token, hold it for the run |
| `ListResourcesAsync(path, ct, query[])` → `IEnumerable<Uri>` | list remote files | expand the configured query window into one `Uri` per **window chunk** (each already carrying `page=1` and all query params) |
| `DownloadResourceAsync(local, remote, ct)` → `FileInfo` | download one file | GET the chunk, follow pagination to the end, write all rows for that chunk to one temp file |
| `DeleteResourceAsync(remote, ct)` | delete remote file | **no-op** (a query API has nothing to delete) |
| `DisconnectAsync(ct)` | close session | dispose the `HttpClient`, drop the token |

`DeviceDownloader` selects the client with `_clients.FirstOrDefault(w => device.DeviceConfiguration.Protocol == w.Protocol)`.

## New component: `OusterBlueCityEdgeDownloaderClient`

Location: `Infrastructure/Services/DownloaderClients/OusterBlueCityEdgeDownloaderClient.cs`,
`: DownloaderClientBase`.

### Protocol value

`DeviceDownloader` matches clients by `TransportProtocols`. `HttpDownloaderClient` already
claims `TransportProtocols.Http`, so **add a new `TransportProtocols.OusterBlueCityEdge` value**
(decided — keeps the generic HTTP client untouched). `OusterBlueCityEdgeDownloaderClient.Protocol`
returns `OusterBlueCityEdge`.

### Connect — authentication

Auth is OAuth2 **client-credentials** against the box's embedded Keycloak (vendor manual
Scheme B). Inputs, all from config (see [`04-configuration-and-mapping.md`](04-configuration-and-mapping.md)):

| Value | Source |
| --- | --- |
| Base URL, e.g. `https://10.x.x.x/analytics/api/v1/` | `Device.Ipaddress` + `DeviceConfiguration.Port`, or `ConnectionProperties["BaseUrl"]` for a full URL / hostname |
| Token URL: `https://<box>/auth/realms/detect/protocol/openid-connect/token` | confirmed on box `10.235.13.48` (realm **`detect`**); store in `ConnectionProperties["TokenUrl"]` |
| `client_id` | `DeviceConfiguration.UserName` — a confidential Keycloak client with the `client_credentials` grant. On box `10.235.13.48` the client **`analytics-client`** already exists and works |
| `client_secret` | `DeviceConfiguration.Password` |

> **Field note (2026-09-10, box `10.235.13.48`) — verified working.** Realm `detect`; token
> endpoint `https://<box>/auth/realms/detect/protocol/openid-connect/token`. Client
> `analytics-client` (confidential, `client_credentials`) returns a token that the
> Analytics API accepts — its service account has only `default-roles-detect`, so **no
> special analytics role is required**, just a valid realm token from a confidential
> client. The GUI's own `detect-client` is public/PKCE/no-direct-grant (unusable
> server-side); a GUI *user* token via the built-in `admin-cli` is role-less and makes
> every `/analytics/**` route return HTTP 500 (that was the earlier "service looks down"
> symptom — the Analytics Server is in fact running). Full details in
> [`07-edge-api-reference.md`](07-edge-api-reference.md).

Behaviour:

1. POST `grant_type=client_credentials` to the token URL, read `access_token` + `expires_in`.
2. Cache the token in the client instance; refresh when within ~60 s of expiry or on a 401.
3. Every data request sends `Authorization: Bearer <token>`.

`ConnectAsync` currently takes an `IPEndPoint`; the box must therefore be reachable by IP
(same limitation as `HttpDownloaderClient`). Hostname support = a small change to
`DownloaderClientBase` / `DeviceDownloader`; noted as a follow-up, not required for phase 1.

### List — window chunking

`object_events` parameters (vendor manual §4.3.1): `start_time`, `end_time`, `timezone`,
`imperial_measuring_unit`, `deduplicate_objects`, `page` (1-based), `per_page` (default
1000, max 5000).

`ListResourcesAsync`:

1. Compute the run window `[windowStart, windowEnd]` (all in the box's local time):
   - `windowEnd   = now − EndLagMinutes`  (small lag so the box has settled data)
   - `windowStart = now − LoggingOffset − OverlapMinutes`
     (`LoggingOffset` is the existing `DeviceConfiguration` field, in minutes; it is the
     primary "how far back do we pull" knob)
   - On the first ever run for a device, clamp `windowStart` to `BackfillStart` (config) or
     to `windowEnd − FirstRunWindowMinutes` — and never earlier than
     `EventLogImporterConfiguration…EarliestAcceptableDate`, which otherwise **silently
     drops** older rows in the decoder (review finding H2).
2. Split `[windowStart, windowEnd]` into chunks of at most `MaxWindowMinutes` (guards
   against a huge catch-up after downtime).
3. Emit one `Uri` per chunk: `…/object_events?start_time=…&end_time=…&per_page=<PageSize>&page=1&timezone=<tz>&imperial_measuring_unit=<bool>&deduplicate_objects=<bool>`.

`DeviceConfiguration.Path` / `Query[]` may hold the URL template; `ObjectPropertyParser`
already substitutes `[DateTime{…}]` and `[LogStartTime{…}]`
(`= localTime.AddMinutes(-LoggingOffset)`), so a fully declarative template is possible.
The window/overlap/chunk maths above is the fallback when tokens aren't expressive enough.

### Download — pagination (verified contract)

Response envelope (from the live box — the vendor manual's `buckets[]` shape is wrong):

```jsonc
{
  "returned_count": 50,
  "query_start_time": "…Z", "query_end_time": "…Z",
  "timezone": "US/Mountain", "units": "imperial",
  "pagination": { "current_page": 1, "per_page": 50,
                  "total_count": 386, "total_pages": 8, "next_page": 2 },
  "events": [ /* TransformedZoneMetadata records */ ]
}
```

For each chunk `Uri`:

1. GET `page=1`. Read `pagination.total_count` / `total_pages` for sizing.
2. Append `events[]`; if `pagination.next_page` is non-null, GET that page; repeat until
   `next_page == null`.
3. Concatenate all `events` into a single JSON array and write to the temp file
   `DeviceDownloader.GenerateLocalFilePath(...)` produced (`.json`). Prepend/keep the
   envelope's `timezone` + `units` — the decoder needs `units`.
4. Return the `FileInfo`. `DeviceDownloader` yields `Tuple<Device, FileInfo>` downstream;
   the "delete source" step is the no-op above.

See [`07-edge-api-reference.md`](07-edge-api-reference.md) for the full parameter and field
list.

Idempotency: overlapping windows re-fetch rows. Dedupe on the BlueCity server row `id`
(int64):

- the decoder emits a `HashSet<LidarZoneEvent>` with equality on
  `(LocationIdentifier, Timestamp, ZoneId, ObjectId, ServerId)` (mirrors `AscToIndianaDecoder`), and
- `ArchiveEventLogsWorkflow` merges into the hourly `CompressedEventLogs` row; the archive
  step must union-by-key rather than blind-append when a row for that
  `(LocationIdentifier, DeviceId, DataType, hour)` already exists.
  > **Confirm** the archive workflow's existing merge behaviour on re-run — see doc 05.

## New component: `OusterBlueCityObjectEventsDecoder`

Location: `Infrastructure/Services/EventLogDecoders/OusterBlueCityObjectEventsDecoder.cs`,
`: EventLogDecoderBase<LidarZoneEvent>`.

- `IsCompressed` / `IsEncoded` — inherited; the temp file is plain UTF-8 JSON.
- `Decode(Device device, Stream stream, ct)`:
  1. Deserialize the JSON array (System.Text.Json).
  2. For each record, build a `LidarZoneEvent` (field map in doc 03), setting
     `LocationIdentifier = device.Location.LocationIdentifier` and `Timestamp` from the
     record's `timestamp` — strip the offset, store **naive intersection-local** (review B1).
  3. Return the de-duplicated set.
- Registered by name so `DeviceConfiguration.Decoders = ["OusterBlueCityObjectEventsDecoder"]`
  routes to it (`EventLogFileImporter` resolves decoders by name, same as today).

## Workflow wiring

`DeviceEventLogWorkflow` is reused **as-is**. For lidar devices the
`TransformToIndianaEvent → SignalTimingPlansWorkflow` branch produces nothing (the
transform is `OfType<IndianaEvent>()`), so no phase/timing output — expected.
`ArchiveEventLogsWorkflow` stores `CompressedEventLogs<LidarZoneEvent>` exactly as it does
for other event types (`ArchiveDataEvents` is fully generic over the event type — verified).

DI: **nothing to wire.** `AddDownloaderClients()` and `AddEventLogDecoders()` in
`Infrastructure/Extensions/ServiceExtensions.cs` use `RegisterServicesByInterface<T>()`,
which registers every implementation in the assembly. `EventLogFileImporter` then selects
the decoder by `w.GetType().Name` against `DeviceConfiguration.Decoders[]`.

## Adjustable pull timing

Requirement: the polling schedule and window must be tunable per deployment / per device
without a code change.

### Cadence (how often) — external scheduling, no timer in code

`HostedServiceBase` runs its `Process(...)` **once** and exits; there is no internal loop.
Cadence = how often `EventLogUtility log` is invoked (cron / k8s CronJob / Task Scheduler).
`LogConsoleCommand` **already** exposes `--device-type` and `--transport-protocol` filters
(`DeviceEventLoggingQueryOptions`), so LiDAR runs on its own schedule with **no new code**:

```
EventLogUtility log --device-type LidarSensor   [--processing-batch-size N ...]
```

scheduled separately from the signal-controller `log` run. (An optional thin `lidar-log`
command can be added later only if batch-size tuning needs to diverge — it is **not** in
Phase 1, and there is no `Interval` config because there is no timer.)

### Window (how much, how far back, overlap) — per device

Carried on `DeviceConfiguration` so each box can differ:

| Setting | Field | Default |
| --- | --- | --- |
| Look-back start | `LoggingOffset` (existing, minutes) | `20` |
| Overlap added before `windowStart` | `ConnectionProperties["OverlapMinutes"]` | `5` |
| End lag before `now` | `ConnectionProperties["EndLagMinutes"]` | `2` |
| Max minutes per request chunk | `ConnectionProperties["MaxWindowMinutes"]` | `60` |
| Page size | `ConnectionProperties["PageSize"]` | `5000` |
| First-run / backfill window | `ConnectionProperties["FirstRunWindowMinutes"]` or `["BackfillStart"]` | `10080` (7 days — safely inside the ~9–12 day box retention) |
| Timezone param | `ConnectionProperties["Timezone"]` | **read from the box `/config.timezone`** (e.g. `US/Mountain`); store naive local (review B1) |
| Unit system | `ConnectionProperties["Imperial"]` | `true` (imperial — matches box default; doc 05 Q2) |
| `deduplicate_objects` param | `ConnectionProperties["DeduplicateObjects"]` | `true` |
| TLS to a self-signed box cert | `ConnectionProperties["PinnedCertThumbprint"]` (preferred) or `["AllowUntrustedCertificate"]` | box cert is self-signed (X7); allow-untrusted is an explicit per-device opt-in, never the default |

`DeviceDownloader` passes `ConnectionProperties` to the client as
`Dictionary<string,string>` (it calls `.ToString()` on every value), so the client parses
its knobs with `int.Parse` / `bool.Parse` and every value **must be a flat scalar** — no
nested objects. The whole `ConnectionProperties` JSON is capped at **1024 chars** (review
M2): keep it lean; derive `BaseUrl` / `TokenUrl` from `Ipaddress` + `Realm` in the client
rather than storing full URLs where possible.

All are plain config; changing the cadence (the schedule) or any window value is an
`appsettings` / device edit, no code redeploy.

## Failure modes to handle

| Situation | Handling |
| --- | --- |
| Token expired mid-run | refresh on 401, retry the request once |
| Box unreachable / TLS failure | log via `DeviceDownloaderLogMessages`, skip the device this cycle (existing behaviour) |
| Downtime longer than the box retains data | measured box retention ≈ **9–12 days** of raw `object_events` (box `10.235.13.48`, 2026-09-10). Beyond that the data is gone. → ATSPM is the system of record; run the poll well inside that window; alert if a device's last-ingested timestamp falls > N days behind |
| Clock skew box vs ATSPM | both the box `object_events` timestamps and the window request are in the box's local time, so skew is box-vs-real-time only; `EndLagMinutes` absorbs it. Watch `created_at − timestamp` in the pilot. |
| Partial / malformed page | `EventLogDecoderException` per file (existing importer behaviour); the chunk is retried next cycle via overlap |
| Duplicate rows from overlapping windows | dedupe on server `id` at decode + union-merge at archive (see above) |
