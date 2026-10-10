# 01 — Architecture Overview

## Goal

Ingest raw, high-resolution lidar detections from Ouster BlueCity edge boxes and store them
in ATSPM's event-log database so they can be aggregated and reported alongside existing
signal data — using the existing ingestion pipeline wherever possible.

## ATSPM today (as-is)

No architecture document exists in the repo; this is traced from the code on `main`.

### Runtime services (docker-compose, ASP.NET on Kestrel behind nginx TLS)

| Service | Port | Responsibility |
| --- | --- | --- |
| `configapi` | 44400 | `Location` / `Device` / `DeviceConfiguration` / `Approach` / `Detector` / `DetectionType` config CRUD |
| `dataapi` | 44401 | Event-log + aggregation data access |
| `reportapi` | 44402 | Computes chart measures on demand (Purdue Coordination Diagram, Split Monitor, Turning Movement Counts, Pedestrian Delay, TSP, …) |
| `identityapi` | 44403 | ASP.NET Identity, JWT, email |
| `webui` | 3000 | Next.js frontend |
| `database-installer` | — | Runs EF migrations for all contexts at startup, seeds admin |
| `watchdog` | — | Scheduled scan CLI → watchdog events + emails |
| `eventlogutility` | — | The ingestion runner CLI (downloader + importer + decoders + workflow) |

### Databases (four EF Core contexts; provider-agnostic: Postgres / SQL Server / MySQL / Oracle / SQLite)

| Context | Contents |
| --- | --- |
| `ConfigContext` | Locations, devices, approaches, detectors, areas / regions / jurisdictions, measure config |
| `EventLogContext` | One `CompressedEvents` table, table-per-hierarchy discriminated by `DataType`, holding `CompressedEventLogs<IndianaEvent \| SpeedEvent \| PedestrianCounter>`. PK `(LocationIdentifier, DeviceId, DataType, Start, End)`. `Data` column is a compressed serialized list. Rows are **hourly**. |
| `AggregationContext` | Pre-rolled aggregates + `SignalTimingPlan` |
| `IdentityContext` | Users / roles / claims |

### Ingestion pipeline

```
DeviceEventLogHostedService
  └── DeviceEventLogWorkflow  (per batch of devices)
        ├── ImportEventLogsWorkflow
        │     ├── DownloadDeviceData ── DeviceDownloader
        │     │     └── picks IDownloaderClient by DeviceConfiguration.Protocol
        │     │        (Ftp / Sftp / Snmp / Http / Mqtt)
        │     │        lists + downloads remote files to a temp BasePath
        │     └── DecodeDeviceData ── EventLogFileImporter
        │           └── picks IEventLogDecoder by DeviceConfiguration.Decoders[]
        │              (AscToIndianaDecoder / MaxtimeToIndianaDecoder / Siemens …)
        │              file stream → IEnumerable<EventLogModelBase>   (mostly IndianaEvent)
        ├── BroadcastEvents
        │     ├──▶ ArchiveEventLogsWorkflow ── compress to hourly CompressedEventLogs<T>,
        │     │                                 save to EventLogContext
        │     └──▶ TransformToIndianaEvent ──▶ SignalTimingPlansWorkflow ──▶ AggregationContext
        └── (Output)

EventAggregationHostedService
  └── AggregationWorkflow ── rolls compressed events into AggregationContext

reportapi ── reads EventLogContext (+ config + aggregation), computes measures per request
```

### Model facts that constrain the design

- Every time-series row keys on `LocationIdentifier` (string, max length 10) + `Timestamp`.
- A `Device` belongs to exactly one `Location`. `Detector` → `Approach` → `Location`.
- `Detector` carries `DetectionHardware` (enum already has `LiDar`), `MovementType`,
  `DetectionTypes`, `DetectorChannel`, `DectectorIdentifier`.
- `Device.DeviceProperties` and `DeviceConfiguration.ConnectionProperties` are
  `Dictionary<string, object>` — free-form extension slots, no schema change needed to use them.
- Enums already present on `main`: `DeviceTypes.LidarSensor`, `DeviceTypes.EdgeProcessor`,
  `DetectionHardwareTypes.LiDar`, `TransportProtocols.Http`, `TransportProtocols.Mqtt`.
- `EventLogContext` registers TPH discriminators by **auto-discovering every
  `EventLogModelBase` subclass in the `Data` assembly**
  (`AddCompressedTableDiscriminators`). A new model in
  `Utah.Udot.Atspm.Data.Models.EventLogModels` auto-registers its
  `CompressedEventLogs<T>` mapping.
- The existing `HttpDownloaderClient` is IP-address / file-directory oriented: it forces the
  host to parse as an `IPAddress`, lists "resources" as a set of file `Uri`s, and downloads
  each to a `FileInfo`. It has no token auth, pagination, or query-window logic.

## Target design (to-be)

A BlueCity edge box is modeled as a **`Device` of type `LidarSensor` on its own
`Location`**, with a `DeviceConfiguration` whose `Protocol` (`TransportProtocols.OusterBlueCityEdge`,
new value) selects a new edge REST downloader client. The existing `EventLogUtility log`
command, filtered with `--device-type LidarSensor`, runs the existing
`DeviceEventLogWorkflow` for lidar devices on its own schedule — **no new hosted service**
(`HostedServiceBase` has no timer; see [`10-architecture-review.md`](10-architecture-review.md) M4).

```
                        UDOT local network
   ┌───────────────────────────────────────────────────────┐
   │  BlueCity edge box                                     │
   │   https://<edge-box-address>/analytics/api/v1/         │
   │     • Keycloak  (client-credentials token)             │
   │     • GET /object_events  (windowed, paginated JSON)   │
   └───────────────────────────┬───────────────────────────┘
                               │  HTTPS + Bearer token
                               ▼
   DeviceEventLogWorkflow  (unchanged shape — pattern A)
     DownloadDeviceData ── DeviceDownloader
        └── OusterBlueCityEdgeDownloaderClient        ← NEW  (IDownloaderClient)
              Connect  → fetch Keycloak token
              List     → build one Uri per (time-window × page)
              Download → write each JSON page to a temp file
     DecodeDeviceData ── EventLogFileImporter
        └── OusterBlueCityObjectEventsDecoder     ← NEW  (IEventLogDecoder<LidarZoneEvent>)
              JSON page → IEnumerable<LidarZoneEvent>
     BroadcastEvents
        └──▶ ArchiveEventLogsWorkflow ──▶ EventLogContext
             new: CompressedEventLogs<LidarZoneEvent>   ← NEW hourly rows
        (TransformToIndianaEvent / SignalTimingPlans branch is skipped:
         object_events carries no phase data)

   AggregationWorkflow ── new lidar aggregate types roll up LidarZoneEvent   (later phase)
   reportapi           ── new lidar measures / charts                        (later phase)
```

### What is new vs. reused

| Reused unchanged | New |
| --- | --- |
| `DeviceEventLogWorkflow`, `ImportEventLogsWorkflow`, `DownloadDeviceData`, `DecodeDeviceData`, `EventLogFileImporter`, `ArchiveEventLogsWorkflow`, `DeviceEventLogHostedService` | `OusterBlueCityEdgeDownloaderClient : IDownloaderClient` (auto-registered) |
| `DeviceDownloader` (selects client by `Protocol`) | `OusterBlueCityObjectEventsDecoder : IEventLogDecoder<LidarZoneEvent>` (auto-registered) |
| `EventLogContext` mechanics, `CompressedEventLogs<T>`, compression, hourly bucketing, `ArchiveDataEvents` (generic) | `LidarZoneEvent : EventLogModelBase` + `DbSet<CompressedEventLogs<LidarZoneEvent>>` + per-provider EF migration |
| `EventLogUtility log` command + its `--device-type` / `--transport-protocol` filters | *(scheduling only — a separate cron entry; no code)* |
| `Device` / `DeviceConfiguration` / `Location` / `Approach` / `Detector` schema | `TransportProtocols.OusterBlueCityEdge` enum value; optional nullable "BlueCity zone id" on `Detector`; possibly widen `DeviceConfiguration.Password` (review M1) |
| Config CRUD in `configapi` | per-device pull-timing config (doc 02 §"Adjustable pull timing"); `lidar-autoconfig` channel-match action (doc 06) |

### Phasing

**Phase 1** (this spec drives): ingestion of `object_events` → `CompressedEventLogs<LidarZoneEvent>`
— the new client, decoder, model, ×5 migration, scheduled `log --device-type LidarSensor`
run; a minimal channel-match `lidar-autoconfig` producing a reviewable draft `Location`
version.

**Deferred (fast-follow / later phases):**

- Full generate/merge/reconcile auto-config with versioned re-sync (doc 06).
- **New measures on LiDAR data** — analysis pipelines, aggregations, `reportapi` endpoints,
  `webui` charts. Planned in [`11-measures-plan.md`](11-measures-plan.md).
- Secondary endpoints: `turning_movements`, `zone_metadata`, `zone_occupancy`,
  `zone_queue_length`.
- Backfill tooling in `DatabaseInstaller` (bounded anyway by ~9–12 day box retention).
- Reading the UDOT intersection id from the Detect core API (phase 1 = operator-entered).

See [`08-integration-plan.md`](08-integration-plan.md) (work packages),
[`09-scope-of-work.md`](09-scope-of-work.md) (formal scope),
[`10-architecture-review.md`](10-architecture-review.md) (code-level fit / compatibility /
security), [`11-measures-plan.md`](11-measures-plan.md) (new measures), and
[`05-open-questions.md`](05-open-questions.md) (remaining prerequisites).
