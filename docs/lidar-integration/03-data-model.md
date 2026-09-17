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

Reuses the compressed-hourly **table and row shape** unchanged, but `LidarZoneEvent`'s
`Data` payload uses a **different wire format** than the rest of the fleet — this is a
deliberate deviation, called out here because it touches shared infrastructure.

- New `EventLogContext` member:
  `public virtual DbSet<CompressedEventLogs<LidarZoneEvent>> LidarZoneEvents { get; set; }`
- The discriminator is auto-registered by
  `AddCompressedTableDiscriminators(typeof(EventLogModelBase), typeof(CompressedEventLogs<>))`
  in `OnModelCreating`; the discriminator value is the `LidarZoneEvent` `Type`
  (`CompressionTypeConverter` stores namespace-qualified name — **unaffected** by the change
  below; it only converts the `DataType` discriminator string column, not the `Data` payload).
- Rows land in the existing `CompressedEvents` table (TPH), PK
  `(LocationIdentifier, DeviceId, DataType, Start, End)`, one row per
  `(location, device, LidarZoneEvent, hour)`.

### `Data` payload format: Protobuf, via the shared compression envelope

**Verified by spike, 2026-09-17 ([`17-preflight-findings.md`](17-preflight-findings.md) §2–3) —
this section is rewritten around confirmed findings, not the design proposed earlier today.**
The per-closed-type `HasConversion` override (this doc's original "preferred path") **fails**:
`Entity<CompressedEventLogs<T>>().Property(e => e.Data).HasConversion(...)` throws
`InvalidOperationException` at model-build time ("The property 'Data' cannot be added...
because it is declared on the CLR type 'CompressedEventLogs\<IndianaEvent\>'"). Targeting the
inherited property directly by its real type (`IEnumerable<EventLogModelBase>`) *does* work,
but reconfigures the converter **for the entire hierarchy** — there is no way to scope a
converter to one closed generic type here. X14 is answered: **no per-type override exists.**

**As-is today, confirmed against real code (not just the review — see doc 15):** one shared
converter — `CompressedListConverter<EventLogModelBase>` — is registered **once**, at the
base-entity level (`CompressedEventLogBase.Data`), used by *every* `EventLogModelBase`
subclass via TPH. There is no per-derived-type hook. This is no longer a hypothesis: it's what
branch `codex/blueband-lidar-event-import` actually did when it needed a second compression
format. That branch:

- Renamed the shared converter `CompressedListConverter<T>` →
  `EventLogCompressedListConverter<T>`, still registered once for the whole hierarchy.
- Added `Atspm/Data/Utility/EventLogCompression.cs` — a **versioned envelope**:
  `ATSPMCMP` magic (8 bytes) + version byte + codec byte + declared uncompressed length
  (`ulong`) + SHA-256 hash (32 bytes) of the uncompressed payload, then the compressed bytes.
  `Decode()` auto-detects legacy raw GZip (magic bytes `0x1f 0x8b`) vs. the new envelope, so
  old rows keep reading correctly with no migration.
- Defined codec `BrotliCodec = 1` (`EncodeBrotli`) but **kept writing legacy raw GZip(JSON)
  in that release** — the new codec is dual-read-only until every reader is proven to support
  the envelope; flipping the *default write path* is an explicit, separate, later decision.
  The payload format itself (Newtonsoft JSON) did **not** change — only the compression codec
  and the envelope wrapping it.

**Decision (2026-09-17, revised after inspecting that branch, then confirmed by spike —
doc 17): extend this same envelope with a new `ProtobufCodec` value**, rather than proposing
a competing per-type converter (the original draft of this section — a per-`LidarZoneEvent`
`HasConversion` override — is now proven not to work, not just unproven: doc 17 §2 shows it
throws `InvalidOperationException`). `codex/blueband-lidar-event-import` is a real,
**unmerged** feature branch (main is at `f630f98d`, that commit isn't reachable from it, doc
17 §1) — it's evidence the shared-envelope pattern was already chosen for a different codec,
not "shipped, proven-in-production code." Recommended library: **protobuf-net** (POCO +
`[ProtoContract]`/`[ProtoMember(n)]` attributes, no `.proto` codegen). This reverses review
finding P3's "keep `LidarZoneEvent` attribute-free" guidance — that assumed the Newtonsoft
path.

**Confirmed design (2026-09-17, spike-verified — doc 17 §2–3): a dispatcher inside the one
shared converter, not a second converter.** Since there is no per-type override (above) and
`typeof(T)` is always `EventLogModelBase` at the property level — the generic parameter
cannot distinguish which concrete event type a given row holds — the shared
`EventLogCompressedListConverter<EventLogModelBase>` itself must become codec-aware:

1. **Write side:** the converter receives `IEnumerable<EventLogModelBase>` — a homogeneous
   list *by convention* (`ArchiveDataEvents.cs:57–86` always builds one concrete type per
   call) but **not enforced by the type system** (spike confirmed: assigning a `SpeedEvent`
   through the base `CompressedEventLogBase.Data` property compiles and runs; only reading it
   back as the wrong closed type throws `InvalidCastException`). The dispatcher must inspect
   the list's actual runtime element type (e.g. `list.FirstOrDefault()?.GetType()`) to decide
   which codec to use, and must explicitly **validate homogeneity** — reject or fail loudly on
   a mixed-type list, empty-list edge case handled explicitly (no element to inspect → fall
   back to the current/default codec).
2. **Read side:** protobuf-net needs to know the target concrete type to deserialize into, and
   (per point 1) has no `$type`-per-element mechanism the way Newtonsoft's
   `TypeNameHandling.Arrays` does. The envelope (`EventLogCompression.cs`) must therefore carry
   a **type identifier alongside the codec byte** — e.g. a short type-name field (mirroring
   what `CompressionTypeConverter` already does for the `DataType` discriminator column) — so
   `Decode()` knows which protobuf contract to deserialize into before returning the list.
3. **Protobuf contract must be flat and explicit — not just "attribute the concrete class."**
   Spike finding, load-bearing: annotating only `LidarZoneEvent`'s own fields with
   `[ProtoMember]` while relying on inheriting `[ProtoContract]` from `EventLogModelBase`
   **silently drops the inherited `Timestamp` field** (deserializes to `DateTime.MinValue`,
   no exception). The fix is a single flat contract that explicitly declares **every** field
   that needs to round-trip, including `LocationIdentifier` and `Timestamp` inherited from
   `EventLogModelBase`, as `LidarZoneEvent`'s own numbered `[ProtoMember]`s — do not rely on
   attribute inheritance across the `EventLogModelBase` boundary. This is a silent-data-loss
   risk if skipped, not just a build error, so it needs an explicit round-trip test asserting
   `Timestamp`/`LocationIdentifier` survive, not just the LiDAR-specific fields.
4. Concrete (non-polymorphic) protobuf contracts **can** be built without `[ProtoInclude]` —
   confirmed by spike — so the original `[ProtoInclude]`-on-`EventLogModelBase` concern (doc
   10 P7) is avoidable as long as the dispatcher (point 1–2) handles type resolution outside
   protobuf-net's own polymorphism mechanism.

**New deliverable, not previously scoped:** extend `EventLogCompression.cs`'s envelope format
with a type-identifier field (in addition to the existing magic/version/codec/length/hash),
and extend `EventLogCompressedListConverter<T>` with the write-time type-dispatch + validation
described above. This is **shared-infrastructure work benefiting every event type**, not a
LiDAR-only change — size it accordingly in WP1, and test round-trips for `IndianaEvent`/
`SpeedEvent`/`BluebandLidarEvent` alongside `LidarZoneEvent` to prove no regression.

New converter class: `EventLogCompressedProtobufListConverter` (dispatcher lives here, or in
`EventLogCompression` itself) doing `ProtoBuf.Serializer.Serialize(...)` for the resolved
concrete type → wrapped in the extended envelope — and a matching `ValueComparer` (the
existing `AbstractListComparer<T>` should still work; it compares the materialized
`IEnumerable<T>`, not the bytes).

**New dependency:** `protobuf-net` — spike validated against **3.2.56**, but that was the
spike's pinned version, not a locked production decision; confirm the version when WP1 adds
the real `Atspm/Data.csproj` reference. (`Google.Protobuf` appears only transitively via an
unrelated Google client library; not reused here.)

**Consequence for the multi-vendor design (doc 12):** the dispatcher approach above actually
**strengthens** doc 12's "zero storage change per vendor" promise versus the earlier
per-type-converter draft — a new vendor whose decoder maps into the canonical `LidarZoneEvent`
gets protobuf storage automatically (the dispatcher resolves by runtime type, already handling
`LidarZoneEvent`), no new registration needed. It does **not** extend to BlueBand (doc 15),
which is a different `EventLogModelBase` subclass entirely — BlueBand would need its own flat
protobuf contract (with the same "explicit inherited fields" rule from point 3 above) added to
the dispatcher if it also moves off JSON. Since the dispatcher is now genuinely shared
infrastructure, adding a type to it is a small, explicit, reviewable change (one contract +
one dispatcher-table entry) — not an automatic side effect the way JSON's `TypeNameHandling`
was.

**Coordination requirement:** this design must be built on top of (rebase/merge onto, or
cherry-pick from) `codex/blueband-lidar-event-import`'s `EventLogCompression.cs` /
`EventLogCompressedListConverter.cs`, not a second parallel implementation. **Confirmed still
unmerged as of 2026-09-17** (doc 17 §1): `origin/main` is at `f630f98d`, BlueBand's commit
(`1b4f5ba8`) is not reachable from it. Recommended sequence (doc 17): commit current docs →
merge current `origin/main` into `feature/lidar-integration` → merge
`origin/codex/blueband-lidar-event-import` in (not a cherry-pick of just the converter files,
which would separate the envelope from its own compatibility tests) → resolve/test the shared
ingestion/compression code together. See doc 15 §"Coordination required."

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
