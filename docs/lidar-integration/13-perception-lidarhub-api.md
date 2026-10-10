# 13 — Perception & LidarHub APIs (Ouster Detect native layer)

**Status: documented from Ouster's published reference, NOT yet verified against a live
box** (the pilot box was unreachable — VPN down — when this was written). Everything below
is sourced from <https://docs.ouster.com/ouster-detect/perception_api/perception-api.html>.
Treat it the way doc 05 treats an unresolved `X` item until it's confirmed on a box the way
doc 07 was: **do not build against this until it's verified.**

## What this is, and why it's a separate doc from `07`

The vendor manual's §2.7 ("Upstream Data Source — Ouster Gemini Detect") says BlueCity
consumes JSON streams from Detect's perception pipeline via its **LidarHub** component, and
points to Ouster's own docs for "complete field definitions." This is that documentation.

It describes **two REST APIs native to the edge box**, both distinct from — and upstream
of — the BlueCity **Analytics Server API** that docs 02–07 are built on:

| API | Base path | Role |
| --- | --- | --- |
| **Perception API** | `/perception/api/v1/` | Configures the lidar sensors themselves: sensor registration, calibration (extrinsics), zone *definitions*, stream execution control, PCAP capture, alerts/telemetry. |
| **LidarHub API** | `/lidar-hub/api/v1/` | The layer above Perception: application settings, geo-coordinates (`world`), cloud connectivity/streaming config, and **event zones** — occupancy/classification/dwell-time data, which is what BlueCity's Analytics Server re-publishes as `object_events` / `turning_movements` / etc. |

So the data flow is roughly: **lidar sensors → Perception (per-sensor tracking, zone
evaluation) → LidarHub (`event_zones`, fused across sensors, cloud/app config) → BlueCity
Analytics Server (`/analytics/api/v1/object_events`, the API docs 02–07 ingest from)**.

This is still **edge**-hosted (same box, different path), so it doesn't reopen the
Cloud/real-time scope decision (doc 09 §3). It's a *lower-level* surface with a materially
different risk profile — see §"Do not call" below — which is why it gets its own doc rather
than being folded into `07`.

## Why it's interesting for this project

| Open item | How this API might help | Confidence |
| --- | --- | --- |
| **Q11 — box → ATSPM `Location`** (doc 05): the Analytics Server exposes no intersection identity | `GET /lidar-hub/api/v1/world` returns **geo-coordinates** for the box. If it's lat/long for the intersection, that's a direct, automatic link to `Location.Latitude`/`Longitude` — stronger than the site-name parsing doc 04 fell back to. | Endpoint confirmed to exist; response schema and whether it carries anything beyond the box's own GPS fix (vs. the intersection's) — **unverified**. |
| **X9/X11 — zone geometry** (doc 05, resolved *"no metadata field"* using the Analytics Server alone): auto-config (doc 06) currently derives geometry purely by parsing `zone_name` | `GET /perception/api/v1/point_zones` returns the **zone definitions** at the source — this is plausibly real geometry (coordinates/shape), not just a name string. Would let auto-config validate or enrich what the name-parser infers, rather than relying on naming discipline alone. | Endpoint confirmed to exist; **field schema not published** by Ouster and not yet pulled from a box — genuinely unknown until verified. |
| **WP8 — observability** (doc 08): "device N days behind" | `GET /lidar-hub/api/v1/telemetry`, `/system_health`, `/diagnostics`, and `/perception/api/v1/alerts*` could feed richer health signals than inferring lag from `object_events` timestamps alone. | Endpoints confirmed to exist; payloads unverified. |
| Sensor/box identity | `GET /perception/api/v1/about`, `GET /lidar-hub/api/v1/about`, `GET /perception/api/v1/sensor` might carry a UDID-equivalent the Analytics Server's `/about` doesn't. | Unverified. |

**None of this changes the Phase-1 plan** (docs 02–09 still stand as spec'd — ingest via the
Analytics Server, auto-config via `/snmp/zone_mappings` + name parsing). It's upside to
evaluate once verified: a stronger auto-config geometry source and a real box→`Location`
link, not a prerequisite.

## Full endpoint reference (as published; unverified)

### Perception API (`/perception/api/v1/`)

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/` | root |
| GET | `/sensor` | list sensors |
| DELETE | `/sensor` | **clear all sensors** |
| GET | `/sensor/{status}` | filter active/inactive |
| PUT | `/sensor/{hostname}` | **add a sensor** |
| DELETE | `/sensor/{sensor_id}` | **remove a sensor** |
| PUT | `/pcap` | **add PCAP replay data** |
| GET | `/settings` | read config |
| POST | `/settings` | **replace all settings** |
| PUT | `/set_profile/{profile}` | **activate a profile** |
| GET | `/profile/{profile}` | read one profile |
| PUT | `/profile/{profile}` | **add/update a profile** |
| DELETE | `/profile/{profile}` | **remove a profile** |
| GET | `/profiles` | list profiles |
| PUT | `/restore_profile/{profile}` | **reset a profile to defaults** |
| GET | `/extrinsics` | read calibration |
| PUT | `/extrinsics` | **upload calibration** |
| DELETE | `/extrinsics` | **clear all calibration** |
| GET / PUT / DELETE | `/extrinsics/{sensor_id}` | per-sensor calibration |
| POST | `/extrinsics/icp` | **run ICP alignment** (compute-heavy) |
| PUT | `/execution/reset` | **restart the perception application** |
| POST | `/execution/play` \| `/pause` \| `/step` | **stream control** |
| PUT | `/execution/start_recording/{filename}` | **start PCAP capture** |
| GET | `/execution/stop_recording` | stop PCAP capture |
| DELETE | `/execution/delete_recording/{filename}` | **delete a capture** |
| GET | `/execution/list_recordings` | list captures |
| GET | `/point_zones` | **zone definitions — read** |
| PUT | `/point_zones` | **replace all zones** |
| PUT | `/point_zones/{point_zone_id}` | **add/update one zone** |
| DELETE | `/point_zones/{point_zone_id}` | **remove a zone** |
| PUT | `/password` | **set the `ouster` user's login password** |
| GET | `/alerts`, `/alerts/active`, `/alerts/logged` | diagnostics |
| GET | `/telemetry` | telemetry |
| GET | `/configuration` | config files |
| GET | `/about` | system info |

### LidarHub API (`/lidar-hub/api/v1/`)

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/about` | static system info |
| GET | `/diagnostics`, `/system_health`, `/telemetry` | health |
| GET / PUT | `/cloud_streaming` | stream rates (`cloudviewer_data_hertz`, `portal2d_data_hertz`) |
| GET | `/default_settings` | read defaults |
| PUT | `/default_settings` | **restore defaults** |
| GET | `/settings` | read app config |
| POST | `/settings` | **replace app config** |
| GET | `/world` | **geo-coordinates — read** |
| PUT | `/world` | **set geo-coordinates** |
| GET | `/cloud_storage`, `/cloud_connectivity`, `/streaming_connectivity` | read profiles |
| POST | same three | **add/update a profile** |
| PUT | same three (`profile` query param) | **activate a profile** |
| POST | `/certificate` | **upload a certificate** |
| GET | `/background_cloud`, `/background_cloud/{sensor_id}` | point-cloud snapshot (`downsample_factor`) |
| GET | `/event_zones` | zone list |
| GET | `/event_zones/active` | query params `ids`, `classifications`, `min_dwell_secs` — **current occupancy** |
| GET | `/event_zones/alerts` | zone alerts |
| GET | `/event_zones/realtime` | live occupancy |
| GET | `/event_zones/timeseries` | historical occupancy |
| GET / DELETE | `/event_recording/{name}` | recordings |
| PUT | `/ota/force_software_check` | **trigger an OTA update check** |
| GET | `/pcap_recording/active`, `/buffer_active` | recording state |
| POST | `/pcap_recording/start` | **start capture** |
| POST | `/pcap_recording/start_buffer` | **start ring buffer** (`buffer_length_s`) |
| GET | `/pcap_recording/stop` | stop capture (`id`, `stop_trail_seconds`) |
| PUT | `/pcap_recording/stop_buffer` | **stop ring buffer** |
| PUT | `/reset` | **restart LidarHub** |
| GET | `/user_recording/active` | recording state |
| POST | `/user_recording/start` | **start user recording** |
| GET | `/user_recording/stop` | stop (`id`, `stop_trail_seconds`) |

Field-level schemas (what a `point_zone` or `event_zone` object actually contains,
`world`'s coordinate format, etc.) are **not published** on the page fetched — must be
pulled from a live box (its own OpenAPI/Swagger, if served, or by inspection) before any of
this is used.

## Do not call — ever, from ATSPM

Everything **not** a plain `GET` above is a live control or write operation on the box's
perception pipeline, and several are destructive or disruptive to traffic monitoring:

- `PUT /perception/api/v1/execution/reset`, `PUT /lidar-hub/api/v1/reset` — **restarts the
  pipeline**, exactly like the Analytics Server's `/reset` that doc 07 already denylists.
- `POST .../execution/play|pause|step` — **stops/steps live detection.**
- `PUT /perception/api/v1/password` — **changes the box's login password.**
- `DELETE /sensor`, `PUT /sensor/{hostname}`, `DELETE /sensor/{sensor_id}` — **adds/removes
  physical sensors from the config.**
- `PUT/DELETE /extrinsics*`, `POST /extrinsics/icp` — **overwrites sensor calibration**,
  which is what keeps zone geometry accurate; corrupting this silently breaks every zone.
- `PUT/DELETE /point_zones*` — **overwrites zone definitions** — would corrupt the very
  channel-match auto-config (doc 06) this integration relies on.
- `POST/PUT /settings`, `/profile*`, `/default_settings`, `/cloud_storage`,
  `/cloud_connectivity`, `/streaming_connectivity`, `/certificate`, `/cloud_streaming` —
  **reconfigures the box**, potentially including its cloud/BlueCity connectivity.
- `PUT /ota/force_software_check` — **triggers a firmware/software update cycle.**
- `PUT/POST` on any `*_recording*` — starts/stops PCAP or user recordings (storage and
  bandwidth impact, and `DELETE /execution/delete_recording/{filename}` destroys data).

**ATSPM's use of this API family, if adopted at all, must be GET-only**, exactly mirroring
the `/reset` and `/batch` denylist already established for the Analytics Server (doc 07).
If a future engineer is tempted to use `/point_zones` PUT/DELETE to *push* ATSPM-side zone
edits back to the box — don't; that inverts the system-of-record direction this whole
integration is built on (BlueCity/Detect owns zone config; ATSPM only reads and mirrors it
into `Detector` records, per doc 06).

## Auth — unverified

Ouster's published page does not document the authentication scheme for either API. Given
they're served from the same box as the Analytics Server, plausible options: the same
Keycloak `detect` realm/token, a different realm, HTTP Basic with the Detect GUI's own user
credentials, or (least likely, but not ruled out) unauthenticated on the box's LAN. **Must be
tested on a live box before use** — this is now the first item on the re-verification list
(doc 05).

## Recommendation

Do **not** fold this into Phase 1 (docs 02–09) — it doesn't change what's already spec'd and
verified. Treat it as a **fast-follow research spike**, once VPN access to a box is
available again:

1. Verify auth (try the existing `analytics-client` Keycloak token first; fall back to
   Basic/other).
2. Pull `GET /lidar-hub/api/v1/world` and `GET /perception/api/v1/point_zones` and read
   their actual schemas.
3. If `world` carries usable intersection coordinates → feeds doc 04's box→`Location`
   mapping (fast-follow already listed there) with a concrete implementation.
4. If `point_zones` carries real geometry → feeds doc 06's auto-config as a
   confidence-boosting cross-check alongside (not instead of) the zone-name parser.
5. Only then decide whether either is worth a WP addition to doc 08 — this doc doesn't
   commit to that yet.
