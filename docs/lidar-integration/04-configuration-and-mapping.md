# 04 — Configuration & Mapping

## One edge box = one `Location`

Each BlueCity edge box sits at one intersection and is modeled as **one `Device` on one
`Location`**. Multi-sensor fusion ("virtual UDID") is not in scope.

**Which `Location`:** UDOT names each BlueCity site
`IntersectionID_Major St / Minor St_City` (e.g. `5000_Riverdale Rd (SR-26) / 700 W_Riverdale`)
per the *Ouster LiDAR Setup Guidance* §"Intersection Naming Convention". The leading
`IntersectionID` is the UDOT signal id = the ATSPM `LocationIdentifier`. If the site name is
readable via the API (not in `/about` or `/config` — check site-settings; doc 05 Q11), the
box→`Location` link can be derived; otherwise it's one operator entry on the `Device`.

### `Device` row

| Field | Value |
| --- | --- |
| `LocationId` | the intersection's `Location` |
| `DeviceType` | `LidarSensor` (decided — doc 05 Q3) |
| `DeviceIdentifier` | BlueCity **UDID** — **operator-entered**; the box's `GET /about` returns only `{ name, software_version }`, no UDID |
| `Ipaddress` | edge box IP on the UDOT network (e.g. `10.235.13.48`) |
| `LoggingEnabled` | `true` to include in the lidar polling cycle |
| `DeviceProperties` | `{ "Udid": "…" }` and any box metadata |
| `DeviceConfigurationId` | → the shared "BlueCity Edge" `DeviceConfiguration` (or a per-box one) |

`DeviceDownloader.CanExecute` requires `LoggingEnabled == true` and
`DeviceConfiguration.Protocol != Unknown`.

### `DeviceConfiguration`

| Field | Value | Notes |
| --- | --- | --- |
| `Protocol` | `OusterBlueCityEdge` | new `TransportProtocols` value (doc 02) |
| `Port` | `443` | |
| `Path` | URL template for `object_events`, or blank if the client builds it | `ObjectPropertyParser` tokens `[LogStartTime{…}]`, `[DateTime{…}]` available |
| `Query` | extra query-string fragments if using templating | |
| `Decoders` | `["OusterBlueCityObjectEventsDecoder"]` | resolved by name in `EventLogFileImporter` |
| `UserName` | Keycloak **client_id** | verified value on box `10.235.13.48`: `analytics-client` |
| `Password` | Keycloak **client_secret** | stored like controller passwords today — see § Credentials. Rotate the current `analytics-client` secret before production use |
| `LoggingOffset` | minutes of look-back for the pull window | primary pull-timing knob (doc 02) |
| `ConnectionProperties` | see below | `Dictionary<string,object>` |
| `ConnectionTimeout` / `OperationTimeout` | ms | |

`ConnectionProperties` keys (all optional, defaults in doc 02):

```jsonc
{
  "BaseUrl":  "https://10.20.30.40/analytics/api/v1/",  // overrides Ipaddress+Port if set
  "TokenUrl": "https://10.20.30.40/auth/realms/detect/protocol/openid-connect/token", // confirmed path
  "Realm":    "detect",
  "OverlapMinutes": 5,
  "EndLagMinutes": 2,
  "MaxWindowMinutes": 60,
  "PageSize": 5000,
  "FirstRunWindowMinutes": 10080,   // 7 days — inside the ~9–12 day box retention;
                                    // also keep >= EventLogImporter EarliestAcceptableDate (review H2)
  "Timezone": "US/Mountain",        // = the box's config.timezone; store naive local (review B1)
  "Imperial": true,                 // matches box default; doc 05 Q2
  "DeduplicateObjects": true,
  "AllowUntrustedCertificate": true // box cert is self-signed (X7); or use "PinnedCertThumbprint"
}
```

### Example (single shared config, two boxes)

```jsonc
// DeviceConfiguration
{
  "Description": "BlueCity Edge events",  // <= 24 chars (DB limit; review M3)
  "Protocol": "OusterBlueCityEdge",
  "Port": 443,
  "Decoders": ["OusterBlueCityObjectEventsDecoder"],
  "UserName": "atspm-analytics-client",
  "Password": "<client_secret>",
  "LoggingOffset": 20,
  "ConnectionTimeout": 5000,
  "OperationTimeout": 30000,
  "ConnectionProperties": {
    "Realm": "detect",
    "OverlapMinutes": 5,
    "MaxWindowMinutes": 60,
    "PageSize": 5000,
    "Timezone": "US/Mountain",
    "Imperial": true,
    "PinnedCertThumbprint": "<box cert sha1>"
  }
}

// Device A
{ "DeviceType": "LidarSensor", "DeviceIdentifier": "obc-ag-sa-b100001",
  "Ipaddress": "10.20.30.40", "LoggingEnabled": true,
  "DeviceProperties": { "Udid": "obc-ag-sa-b100001" },
  "ConnectionProperties_override": { "TokenUrl": "https://10.20.30.40/auth/realms/detect/protocol/openid-connect/token" } }

// Device B — different box, same credentials/realm
{ "DeviceType": "LidarSensor", "DeviceIdentifier": "obc-ag-sa-b100002",
  "Ipaddress": "10.20.30.41", "LoggingEnabled": true,
  "DeviceProperties": { "Udid": "obc-ag-sa-b100002" } }
```

Per-box values that vary (IP, UDID, token URL) live on the `Device`; shared values (realm,
credentials, window policy) live on the `DeviceConfiguration`. If credentials differ per
box, give each box its own `DeviceConfiguration`.

## Zone → ATSPM mapping — match by channel to the existing `Detector`

`object_events` records key on `zone_id` (int64) / `zone_name`. The full zone set for a box
comes from `GET /analytics/api/v1/snmp/zone_mappings`. Raw events store `zone_id` +
`zone_name` verbatim (doc 03), so the mapping can change later without re-ingesting.

The zone name follows the **UDOT standard** `CLASSES-APPROACH-DIRECTION+LANE-TYPE-CHANNEL#`
(full grammar + `TYPE→DetectionTypes` table in [`07`](07-edge-api-reference.md) /
[`06`](06-auto-config-feasibility.md)). The **`CHANNEL#` is the controller detector
channel**, and on upgrades UDOT reuses the channel numbers the prior detection used — so it
is the join key to the `Detector` that **already exists** in ATSPM for that signal:

| Case | Action |
| --- | --- |
| A `Detector` with `DetectorChannel == <channel>` exists at this `Location` | Set `DetectionHardware = LiDar`, `LatencyCorrection = 0`; record the BlueCity `zone_id` on it (new nullable field or `DeviceProperties`). Approach + **phase are inherited unchanged**. |
| No matching channel (new detection: passive ped, count-only) | Create a `Detector` on the `Approach` for `<APPROACH>`/`<DIRECTION>`: `DetectionHardware = LiDar`, `MovementType` from `<DIRECTION>`, `LaneNumber` from `<LANE>`, `DetectionTypes` from `<TYPE>`, `DetectorChannel = <channel>`. |
| One zone, multiple `TYPE`+`CHANNEL` pairs (`…-COYR-1723`) | Repeat per pair — **one `zone_id` → several `Detector`s / channels**. |
| Name doesn't parse, or `-Q-` / crosswalk zone with no channel | Create `Detector` **disabled**, flag "needs review". |

This is the automated form of the *Ouster LiDAR Setup Guidance* §"Setup and Adjustments in
ATSPM": add a **"LiDAR" `Location` version** → set each approach's Hardware to LiDAR →
Latency Correction 0 → **verify channels match**. See [`06`](06-auto-config-feasibility.md).

`turning_movements` (later phase) uses `entry_zone--exit_zone` pairs → `Approach` +
`MovementType` directly.

## Credentials handling

`DeviceConfiguration.UserName` / `Password` currently hold controller credentials in
plaintext (or DB-level encryption, per deployment). The Keycloak `client_secret` follows
the same path for consistency. If a stronger story is wanted (env vars / secret manager /
column encryption), it should apply to all device credentials, not just lidar — call it out
as a cross-cutting item rather than a lidar-only mechanism.

## Timezone  *(corrected per review B1)*

ATSPM's event-log pipeline is **naive intersection-local**, not UTC (`EventLogFileImporter`
compares to `DateTime.Now`; no report/aggregation code converts; `Location` has no tz
field). So:

- Read `GET /analytics/api/v1/config` at connect and use its `timezone` (e.g. `US/Mountain`)
  as the `object_events` `timezone` param.
- Store `Timestamp` / `CreatedAt` as the returned local time with the offset **stripped**
  (`DateTimeKind.Unspecified`), exactly like `IndianaEvent` / `SpeedEvent`.
- Do **not** store UTC — it would shift every LiDAR measure off the signal data and risk
  silent "future event" drops when the host runs UTC.

## Provisioning path

- Manual: `configapi` CRUD (WebUI admin or API).
- Bulk: extend `DatabaseInstaller setup-test` `devices.json` seeding and/or
  `transfer-config` to carry `OusterBlueCityEdge` devices (later; not required for phase 1).
