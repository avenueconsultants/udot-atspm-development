# 07 — Edge API Reference (verified against a live box)

Captured 2026-09-10 from box **`10.235.13.48`** ("US-89 / Wash Blvd / 12th St / SR-39"),
Ouster Detect **`2.11.0-beta.1-0-gd92e3d3`**, GUI mode `blue-city`. This supersedes the
vendor manual where they disagree (the manual's Category 2 section is out of date in
several places).

## Authentication (verified)

| Item | Value |
| --- | --- |
| Keycloak realm | `detect` |
| Token endpoint | `https://<box>/auth/realms/detect/protocol/openid-connect/token` |
| Grant | `client_credentials` |
| Client | `analytics-client` (confidential, already provisioned on this box) — service account has only `default-roles-detect`, and analytics calls still succeed, so **no special role is required**, just a valid realm token from a confidential client |
| Token lifetime | `expires_in` 3600 s |
| Request | `POST` form-encoded: `grant_type=client_credentials&client_id=analytics-client&client_secret=<secret>` |
| Use | `Authorization: Bearer <access_token>` on every call |

The Detect GUI's own browser client `detect-client` is public / PKCE / no direct grant — not
usable server-side. A GUI *user* token minted via Keycloak's built-in `admin-cli` has no
roles and every `/analytics/**` route then returns **HTTP 500** (not 401/403) — that was the
earlier "server looks down" symptom; it wasn't.

> The `analytics-client` secret is a live credential. Treat it as a secret, rotate it, and
> store it the way ATSPM stores other device credentials (see doc 04). Not committed here.

## Endpoints — full list (`GET https://<box>/analytics/api/v1/...`)

| Path | Tag | Purpose | In our scope |
| --- | --- | --- | --- |
| `/about` | Diagnostics | `{ name, software_version }` only — **no UDID / sensor id** | health check only |
| `/config` | Settings | `AppConfig` (units, timezone, aggregation defaults, SNMP flags) | read at setup |
| `/snmp/zone_mappings` | Settings | **zone inventory** + NTCIP zone numbers | **yes — auto-config** |
| `/object_events` | Query Analytics | raw per-object zone records | **yes — primary ingestion** |
| `/turning_movements` | Query Analytics | aggregated `entry--exit` counts | later phase |
| `/zone_metadata` | Query Analytics | aggregated per-zone counts/speeds | later phase |
| `/zone_occupancy` | Query Analytics | aggregated occupancy ratio | later phase |
| `/zone_queue_length` | Query Analytics | aggregated queue length | later phase |
| `POST /{turning_movements,zone_metadata,zone_occupancy,zone_queue_length}/batch` | Ingest | write endpoints (Ouster's own ingest) | **no — never call** |
| `PUT /reset` | Execution | **terminates the analytics server process** | **no — never call** |

There is **no zone-geometry / zone-configuration endpoint** beyond `/snmp/zone_mappings`,
and **no endpoint exposes the site name / UDOT intersection id** (`/about` = name + version
only; `/config` = `AppConfig`, no identity). Backend is TimescaleDB hypertables.

## Verified behaviours

| Item | Finding (box `10.235.13.48`, 2026-09-10) |
| --- | --- |
| **Raw `object_events` retention** | Data present at ~9 days back, **absent at ~12 days back** — retention ≈ **9–12 days**. `/snmp/zone_mappings` keeps *zone names* 30 days; that is not raw-event history. → ATSPM is the system of record. |
| **`timezone` param** | Honoured. `timezone=UTC` → `…Z`; any IANA zone → local time with offset; no param → `config.timezone`. **ATSPM ingests with `timezone = config.timezone` and stores naive local** (review B1) — not UTC. |
| **`units` / `imperial_measuring_unit`** | This box `config.imperial_measuring_unit = true` → speeds mph, dimensions feet, envelope `units: "imperial"`. Overridable per request. |
| **Volume** | ~364–386 records per default 5-minute window ≈ **~110k/day** at this intersection. |
| **TLS** | Self-signed cert (`curl -k` required). |
| **`total_count` on old/empty windows** | Returns `0` / empty `events` cleanly, `next_page: null`. |

## `GET /object_events` — verified contract

Supersedes vendor manual §4.3.1 (which shows a `buckets[]` envelope — wrong).

### Query parameters (all optional)

| Param | Type | Notes |
| --- | --- | --- |
| `start_time` | ISO 8601 | default = `end_time − 5 min` |
| `end_time` | ISO 8601 | default = now |
| `timezone` | IANA name (`Timezone` enum) | overrides `config.timezone`; governs the offset on returned timestamps |
| `imperial_measuring_unit` | bool | overrides `config.imperial_measuring_unit` |
| `deduplicate_objects` | bool | overrides `config.deduplicate_objects` |
| `page` | int ≥ 1 | default 1 |
| `per_page` | int | default 1000, **hard max 5000** (rejects above) |

### Response — `ObjectEventsResponse`

```jsonc
{
  "returned_count": 50,
  "query_start_time": "2026-09-10T19:12:24.475157688Z",
  "query_end_time":   "2026-09-10T19:17:24.475157688Z",
  "timezone": "US/Mountain",
  "units": "imperial",                     // "metric" | "imperial"
  "pagination": {
    "current_page": 1,
    "per_page": 50,
    "total_count": 386,                    // known up front
    "total_pages": 8,
    "next_page": 2                         // null on the last page  ← loop termination
  },
  "events": [ /* TransformedZoneMetadata */ ]
}
```

**Pagination:** start at `page=1`, follow `pagination.next_page` until it is `null`.
`total_count` / `total_pages` are available on page 1 for sizing.

### `events[]` element — `TransformedZoneMetadata`

| Field | Type | Notes |
| --- | --- | --- |
| `id` | **int64** | server row id — stable, use for dedupe |
| `perception_id` | int32 | |
| `timestamp` | date-time | **in the response `timezone`, with offset** e.g. `2026-09-10T13:12:25.116278-06:00`. ATSPM requests `timezone = config.timezone` and stores the local time with the offset stripped (review B1). |
| `object_id` | uuid string | persists per tracked object |
| `zone_name` | string | **may contain trailing spaces** in real data (`"VC-SB-T1-CO-5 "`) — trim |
| `zone_id` | **int64** | real values ≈ 1.7×10¹² (`1785960513198`) — **not** the small ints in the manual |
| `dwell_time_ms` | int64 | |
| `num_samples` | int32 | |
| `avg_speed`, `p50_speed`, `p85_speed` | float | km/h or **mph** per `units` |
| `avg_height`, `avg_length`, `avg_width` | float | metres or **feet** per `units` |
| `classification` | enum | `PROSPECT` `UNKNOWN` `PERSON` `BICYCLE` `VEHICLE` `LARGE_VEHICLE` |
| `sub_classification` | enum | `none` `pedestrian` `car` `truck` `bicycle` `bus` `trailer` `tram` |
| `user_classification` | string \| null | operator-defined (seen: `"car"`) |
| `speed_bin` | string | `"Other"` when no `speed_bins` configured (this box: none) |
| `created_at` | date-time | response timezone |

No `sensor` / `udid`, no `trajectory`, no `entry_point`, no `bucket_*` fields.

### Observed volume

386 records in the default 5-minute window at this intersection ≈ **4–5k/hour ≈ ~110k/day**.
One `per_page=5000` page ≈ every ~65 min of data at this rate.

## `GET /config` — `AppConfig` (this box)

```json
{
  "default_aggregation_interval_seconds": 900,
  "min_aggregation_interval_seconds": 10,
  "deduplicate_objects": true,
  "imperial_measuring_unit": true,
  "timezone": "US/Mountain",
  "snmp": { "enabled": false, "timezone": "UTC", "sample_period_seconds": 60 },
  "speed_bins": [],
  "speed_bins_unit": "imperial",
  "speed_bin_names": [],
  "aggregation_interval_thresholds": [
    { "interval_seconds_max": 60,      "date_range_seconds_max": 3600 },
    { "interval_seconds_max": 900,     "date_range_seconds_max": 86400 },
    { "interval_seconds_max": 3600,    "date_range_seconds_max": 604800 },
    { "interval_seconds_max": 2678400, "date_range_seconds_max": 2678400 }
  ]
}
```

Notes: this box serves **imperial** (mph, feet). `snmp.enabled=false` but
`/snmp/zone_mappings` still returns assignments. `aggregation_interval_thresholds` constrain
interval vs. date-range on the *aggregated* endpoints, not `object_events`.

## `GET /snmp/zone_mappings` — `SnmpZoneMappingsResponse`

**This is the zone inventory** used for auto-config (doc 06).

```jsonc
{
  "max_zones": 255,                       // NTCIP 1209 maxSensorZones
  "mappings": [
    { "zone_number": 1,  "zone_id": 1785958805368, "zone_name": "VC-NB-L1-CO-22", "created_at": "2026-09-10T19:17:24Z" },
    { "zone_number": 3,  "zone_id": 1785958937906, "zone_name": "VC-NB-T1-CO-1",  "created_at": "..." },
    { "zone_number": 6,  "zone_id": 1785959540825, "zone_name": "VC-NB-R1-CO-4",  "created_at": "..." },
    { "zone_number": 27, "zone_id": 1788145474840, "zone_name": "SB-Q-L1",        "created_at": "..." }
    // ... 40 zones on this box
  ]
}
```

- `zone_number` — NTCIP 1209 `sensorZoneNumber`, 1–255, **stable once assigned, never renumbered**.
- `zone_id` — the analytics zone id (int64), the join key to `object_events.zone_id`.
- `zone_name` — most-recently-seen name.
- **Side effect:** this `GET` *assigns* numbers to any newly-seen zones (idempotent). Not purely read-only — safe, but note it.
- Covers zones seen in analytics data in the last 30 days.

### Zone naming convention — UDOT STANDARD

This is a **documented UDOT standard**: *"Ouster LiDAR Setup Guidance"* v1.10, 2026-01-11
(owner: Mark Taylor), §"Detection Zone Naming Convention" (`SETUP - BC - ZONE INFORMATION`).
Not committed here; referenced like the vendor manual.

**Grammar:** `CLASSES - APPROACH - DIRECTION+LANE - TYPE - CHANNEL#`

| Segment | Values |
| --- | --- |
| **Classes** (1+ letters) | `V` Vehicle · `C` Cyclist · `P` Pedestrian · `T` Train · `B` Bus · `E` Exit detector · `H` HOV |
| **Approach** | `NB` `SB` `EB` `WB` · `N` `S` `E` `W` = that-leg crosswalk |
| **Direction** (movement) | `T` Through · `R` Right · `L` Left · `TL` · `TR` · `TLR` · `XW` crosswalk · `N`/`F` = near/far (crosswalks only) |
| **Lane #** | always present, follows Direction; `1` = inside lane. Crosswalks use `N`/`F` instead |
| **Type** | `PR` Presence · `QU` Queue · `CO` **Count** · `PU` Pulse · `YR` Yellow-Red actuations · `SI` Sign |
| **Channel #** | 1–64 NEMA / 1–128 ATC cabinets. On existing-intersection upgrades, **the LiDAR reuses the channel numbers the previous detection already used**, so ATSPM needs no channel change |

Examples (from the guidance + the live box):

| Zone name | Meaning |
| --- | --- |
| `VC-NB-T1-PR-17` | Vehicle+Cyclist · Northbound · Through lane 1 · Presence · channel 17 |
| `VC-NB-L1-CO-22` | Vehicle+Cyclist · Northbound · Left lane 1 · **Count** · channel 22 |
| `PC-S-XWF-PR-04` | Pedestrian+Cyclist · South-leg crosswalk · far side · Presence · channel 4 |
| `VC-EB-T2-COYR-1723` | one zone, **two services**: Count on ch 17 **and** Yellow-Red actuations on ch 23 |
| `V-WB-T1-COYR-55-57` | Count ch 55, Yellow-Red ch 57 |

Notes:
- **`CO` = Count** (not "controller output"). Count zones should be pulse detectors.
- **A zone can carry multiple `TYPE`+`CHANNEL` pairs** (`COYR-1723`, `…-55-57`) → one
  `object_events.zone_id` maps to **more than one ATSPM `Detector` / channel**.
- Exclusion zones: `SW Corner` / `SE Corner` / `NE Corner` / `NW Corner`.
- Real data has minor variants: the live box has `VC-WB-LT1-…` (vs. standard `TL`) and
  queue zones named `SB-Q-L3` / `NB-Q-L1` (no class prefix, no channel — likely
  ATSPM-only queue zones not wired to the controller). Parsers must tolerate this.
- **YR (yellow-red / red-light-running) actuations are explicitly *not* currently added to
  UDOT ATSPM** per the guidance — so RLR-from-LiDAR is out of scope regardless of the
  Edge API.

The channel number is the join key to the pre-existing ATSPM `Detector` — see
[`06-auto-config-feasibility.md`](06-auto-config-feasibility.md).

## `Timezone` enum

Standard IANA tz database names (full set). Relevant here: `US/Mountain`, `America/Denver`,
`UTC`. **Ingest with `timezone` = the box's `config.timezone`** and store naive local
(review B1) — not UTC.
