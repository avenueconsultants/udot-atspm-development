# 03 — Data Model

## New event-log model: `LidarZoneEvent`

- File: `Atspm/Data/Models/EventLogModels/LidarZoneEvent.cs`
- Namespace: `Utah.Udot.Atspm.Data.Models.EventLogModels` (**required** — the TPH
  discriminator auto-discovery in `EventLogContext` only scans `EventLogModelBase`
  subclasses in this assembly)
- Base: `EventLogModelBase` → inherits `LocationIdentifier` (string, max 10) and
  `Timestamp` (`DateTime`, **naive intersection-local** — see review finding B1; the whole
  ATSPM event-log pipeline is local-time, not UTC)
- **Short type name must be unique in the `Data` assembly and ≤ 32 chars** — the
  discriminator column is `HasMaxLength(32)` and both the TPH discriminator and the JSON
  binder resolve `"{EventLogModelBase.Namespace}.{ShortName}"`.

One instance = one BlueCity `object_events` record (`TransformedZoneMetadata`) = one road
user's pass through one zone. Field types below are the **verified** ones from the live box
(see [`07-edge-api-reference.md`](07-edge-api-reference.md)); several differ from the vendor
manual.

`LidarZoneEvent` is ATSPM's **canonical, vendor-neutral** LiDAR event model — a second
vendor's decoder maps into the same type (see
[`12-multi-vendor-architecture.md`](12-multi-vendor-architecture.md)). Which vendor produced
a record is resolved via the owning `Device.DeviceConfiguration.Product`, not a field on the
event itself — ATSPM's existing config model already separates "what kind of thing" from
"which vendor/product."

### Fields

| Property | Type | Source field | Notes |
| --- | --- | --- | --- |
| `LocationIdentifier` | `string` | — | inherited; set from `Device.Location.LocationIdentifier` |
| `Timestamp` | `DateTime` | `timestamp` | inherited. Request `object_events` with `timezone = <box config.timezone>` (e.g. `US/Mountain`); the response gives local time with an offset (`…-06:00`) — **strip the offset, store naive local** to match the rest of the pipeline (review B1) |
| `ServerId` | `long` | `id` | int64 BlueCity row id; dedupe key for overlapping re-polls |
| `PerceptionId` | `int?` | `perception_id` | int32 |
| `CreatedAt` | `DateTime?` | `created_at` | when the box wrote the record (≥ `timestamp`) |
| `ObjectId` | `string` (`Guid`) | `object_id` | UUID; stable per tracked object |
| `ZoneId` | **`long`** | `zone_id` | **int64** — real values ≈ 1.7×10¹² (`1785960513198`), *not* the small ints in the manual. Join key to `/snmp/zone_mappings` |
| `ZoneName` | `string` | `zone_name` | **trim** — real data has trailing spaces (`"VC-SB-T1-CO-5 "`) |
| `DwellTimeMs` | `long?` | `dwell_time_ms` | int64 |
| `NumSamples` | `int?` | `num_samples` | int32 |
| `AvgSpeed` | `float?` | `avg_speed` | km/h or **mph** per envelope `units` |
| `P50Speed` | `float?` | `p50_speed` | " |
| `P85Speed` | `float?` | `p85_speed` | " |
| `Units` | `string` (or enum) | envelope `units` | `"metric"` / `"imperial"` — store per record; this box = `imperial` |
| `AvgHeight` | `float?` | `avg_height` | metres / **feet** per `units` |
| `AvgLength` | `float?` | `avg_length` | " |
| `AvgWidth` | `float?` | `avg_width` | " |
| `Classification` | `string` | `classification`, mapped | **Canonical** value (`Vehicle`/`LargeVehicle`/`Pedestrian`/`Bicycle`/`Motorcycle`/`Unknown`), not the vendor's raw string — see [`12-multi-vendor-architecture.md`](12-multi-vendor-architecture.md). BlueCity's decoder maps `VEHICLE→Vehicle`, `LARGE_VEHICLE→LargeVehicle`, `PERSON→Pedestrian`, `BICYCLE→Bicycle`, `PROSPECT`/`UNKNOWN→Unknown`. |
| `VendorClassification` | `string` | `classification` (raw) | The vendor's **unmapped** class string, kept for traceability (BlueCity: `PROSPECT` `UNKNOWN` `PERSON` `BICYCLE` `VEHICLE` `LARGE_VEHICLE`) |
| `SubClassification` | `string` | `sub_classification` | vendor sub-class, stored as-is (BlueCity enum: `none` `pedestrian` `car` `truck` `bicycle` `bus` `trailer` `tram`) |
| `UserClassification` | `string` | `user_classification` | operator-defined; nullable (seen: `"car"`) |
| `SpeedBin` | `string` | `speed_bin` | `"Other"` when the box has no `speed_bins` configured (this box: none) |

The response envelope (`returned_count`, `query_*`, `timezone`, `units`, `pagination`) is
query metadata — only `units` (and the resolved `timezone`) are carried onto each record.
There are **no** `bucket_start` / `bucket_end` fields (the vendor manual is wrong here).

Store strings as-is (they are not `Unicode` per the context convention:
`configurationBuilder.Properties<string>().AreUnicode(false)`).

### Equality / hashing / ToString

Follow the existing models (`IndianaEvent`, `SpeedEvent`):

```csharp
public override bool Equals(object obj) =>
    obj is LidarZoneEvent e &&
    LocationIdentifier == e.LocationIdentifier &&
    Timestamp == e.Timestamp &&
    ZoneId == e.ZoneId &&
    ObjectId == e.ObjectId &&
    ServerId == e.ServerId;

public override int GetHashCode() =>
    HashCode.Combine(LocationIdentifier, Timestamp, ZoneId, ObjectId, ServerId);

public override string ToString() =>
    $"{LocationIdentifier}-{Timestamp:o}-{ZoneId}-{ObjectId}-{ServerId}";
```

`ServerId` in the key makes overlapping-window re-pulls converge; `ObjectId` + `Timestamp`
keep it sane if the box ever re-issues an `id`.

## JSON → model mapping

**Real** `object_events` record from box `10.235.13.48` (2026-09-10):

```json
{
  "perception_id": 29044184,
  "timestamp": "2026-09-10T13:12:25.116278-06:00",
  "object_id": "ab2abe42-cbad-48a3-b6a0-5a47d9ad7cd7",
  "zone_name": "VC-SB-T2-CO-6",
  "zone_id": 1785960513198,
  "dwell_time_ms": 699,
  "num_samples": 8,
  "avg_speed": 12.752727,
  "p50_speed": 12.640667,
  "p85_speed": 14.072102,
  "avg_height": 4.9257708,
  "avg_length": 15.150099,
  "avg_width": 6.4804792,
  "classification": "VEHICLE",
  "sub_classification": "car",
  "user_classification": "car",
  "speed_bin": "Other",
  "created_at": "2026-09-10T13:12:34.697059-06:00",
  "id": 700340
}
```

→ one `LidarZoneEvent` per the field table above. `Units` comes from the response
**envelope** (`"units": "imperial"` on this box), not the record. `zone_id` is a large
int64. `zone_name` follows the UDOT standard `CLASSES-APPROACH-DIRECTION+LANE-TYPE-CHANNEL#`
— `VC-SB-T2-CO-6` = *vehicle-count zone, Southbound, Thru, lane 2, controller channel 6*
(grammar in [`07`](07-edge-api-reference.md)). Note a single `zone_id` can correspond to
**multiple ATSPM detector channels** (multi-service zones like `…-COYR-1723`); the raw event
still stores just the one `zone_id` / `zone_name`, and the zone→`Detector` fan-out happens
at read/aggregation time via config (doc 04).

## Storage

Reuses the compressed-hourly mechanism unchanged in shape:

- New `EventLogContext` member:
  `public virtual DbSet<CompressedEventLogs<LidarZoneEvent>> LidarZoneEvents { get; set; }`
- The discriminator is auto-registered by
  `AddCompressedTableDiscriminators(typeof(EventLogModelBase), typeof(CompressedEventLogs<>))`
  in `OnModelCreating`; the discriminator value is the `LidarZoneEvent` `Type`
  (`CompressionTypeConverter` stores namespace-qualified name).
- Rows land in the existing `CompressedEvents` table (TPH), PK
  `(LocationIdentifier, DeviceId, DataType, Start, End)`, one row per
  `(location, device, LidarZoneEvent, hour)`. `Data` is the GZip-compressed serialized list.

### Migrations

`EventLogContext` migrations live in the provider projects
(`SqlDatabaseProvider`, `PostgreSQLDatabaseProvider`, `MySqlDatabaseProvider`,
`OracleDatabaseProvider`, `SqlLiteDatabaseProvider`). Codex must add an
`EventLogContext` migration in **each** provider project so
`DatabaseInstaller update` picks up the new discriminated type. No new table, no new
columns — the migration just registers the entity type / discriminator value.

### Repositories

`IndianaEventLogEFRepository` / `SpeedEventLogEFRepository` derive from
`EventLogEFRepositoryBase`. Add `LidarZoneEventLogEFRepository` (or a generic registration
if `EventLogEFRepository` already covers arbitrary `T`) so `dataapi` / aggregation can
read `LidarZoneEvent` rows. Confirm which pattern the codebase prefers when implementing.

## Units

`avg_speed` / `p50_speed` / `p85_speed` and the dimension fields come back in km/h + metres
(`units: "metric"`) or mph + feet (`units: "imperial"`), controlled by the request's
`imperial_measuring_unit` and reported in the envelope.

Box `10.235.13.48` is configured `imperial_measuring_unit: true` (serves mph + feet).
Draft approach (Q2 in doc 05):

1. **Pin the request** to one system for all boxes via config
   (`ConnectionProperties["Imperial"]`) — recommendation is **`true` (imperial)** to match
   the box default and ATSPM's US context.
2. Store the raw number **and** `Units` on the event, so a mixed fleet stays unambiguous.
3. Normalize on read in `dataapi` / `reportapi` / aggregation, not at ingest (keep raw data
   faithful). If a fixed stored unit is preferred instead, mirror `SpeedEvent`'s
   `Mph` + `Kph` dual-field pattern.

## Volume / performance notes

- Measured on box `10.235.13.48`: **386 records in the default 5-minute window** at this
  intersection ≈ **4–5k/hour ≈ ~110k/day**. A `per_page=5000` page covers ~65 min of data
  at that rate.
- Hourly compressed rows keep the row count bounded (≈ 24 rows/day/device); the `Data`
  blob grows with traffic. Matches how `IndianaEvent` already scales, but the per-hour blob
  will be larger — budget for it.
- The archive step must **merge** into an existing hour's row on re-poll, not append
  duplicates (doc 02 § Idempotency).
- No new partitioning/retention scheme — lidar rows follow whatever `CompressedEvents`
  retention the deployment already runs.
