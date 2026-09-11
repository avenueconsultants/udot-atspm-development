# 05 — Open Questions

Status after: the live-box investigation (box `10.235.13.48`, 2026-09-10), the UDOT *Ouster
LiDAR Setup Guidance* v1.10, the "what's best" decisions in the README, and the code-level
review in [`10-architecture-review.md`](10-architecture-review.md).

**No item below blocks implementation.** What remains is a UDOT/Ouster prerequisite
([`08`](08-integration-plan.md) WP0), a code-level check the implementer performs (review
H1/H2/M-series), or a deferred later-phase question.

## Still open — UDOT / Ouster input needed (not design blockers)

| # | Question | Impact | Default if unanswered |
| --- | --- | --- | --- |
| Q6 | **Backfill depth at go-live** — how far back to pull on first connect? | First-run window. Bounded by ~9–12 day retention. | `FirstRunWindowMinutes = 10080` (7 days). No `DatabaseInstaller` backfill tool in Phase 1. |
| Q7 | **Reporting scope** — what should users see from LiDAR data? | Drives aggregation types + `reportapi` (later phases). | Deferred — not Phase 1. |
| Q8 | **Credentials at rest** — keep the existing `DeviceConfiguration` plaintext/DB pattern, or introduce a secret store (cross-cutting for all device creds)? | Security. The current `analytics-client` secret must be rotated regardless. | Match existing pattern; flag secret-store as a separate cross-cutting effort. |
| Q12 | **`TYPE → DetectionTypes` mapping** — confirm `PR`→stop-bar vs advanced presence, `CO`→`LLC`, `QU`→`IQ`/`EQ`, `YR`→out. | `lidar-autoconfig` `Detector.DetectionTypes` (WP6). | Table in [`06`](06-auto-config-feasibility.md) §"The join"; refine during build. |
| X1 | **Is ~9–12 day raw-event retention representative** across the fleet / firmware versions? | Cadence + backfill safety margin; whether ATSPM must alert aggressively on lag. | Assume ~9–12 days; 5-min poll, 7-day backfill, "device N days behind" alert (WP8). |
| X4 | **`deduplicate_objects` semantics** and whether server `id` is stable for the same detection across overlapping queries. | Dedupe-key correctness. | Dedupe on `(LocationIdentifier, Timestamp, ZoneId, ObjectId, ServerId)`; verify in WP3/WP7 with an overlapping-window fixture. |
| X6 | **Box clock discipline (NTP?)** vs ATSPM host skew. | `EndLagMinutes` default. | `EndLagMinutes = 2`; observe `created_at` − `timestamp` in the pilot. |
| X7 | **TLS** — box cert is self-signed. Install each box's CA on the ATSPM host, per-device pinned thumbprint, or allow-untrusted flag? | `OusterBlueCityEdgeDownloaderClient` handler config. | `ConnectionProperties["AllowUntrustedCertificate"]` / `["PinnedCertThumbprint"]`. |
| X8 | **Hostname vs IP** — are boxes addressable by DNS, or IP only? | Possible small `DownloaderClientBase` change. | Support `ConnectionProperties["BaseUrl"]` (hostname ok). |

## Decided (by the project / by best-judgement)

| # | Item | Decision | Date |
| --- | --- | --- | --- |
| R1 | Cloud vs Edge API | Edge only | 2026-09-10 |
| R2 | Real-time gRPC | Out | 2026-09-10 |
| R3 | Primary source | Raw `object_events`, high-resolution | 2026-09-10 |
| R4 | Ingestion pattern | Pattern A — new `IDownloaderClient` + `IEventLogDecoder`, reuse `DeviceEventLogWorkflow` | 2026-09-10 |
| R5 | Box ↔ Location | One box = one `Location` (one `Device`) | 2026-09-10 |
| R6 | Pull timing | Adjustable per device via config | 2026-09-10 |
| R7 | Zone → ATSPM mapping | One `Detector` per zone, joined by **channel** to the existing ATSPM detector | 2026-09-10 |
| Q2 | Units | **Request `imperial`** fleet-wide (matches box default); store raw value + `Units` | 2026-09-10 |
| Q3 | `DeviceType` | `LidarSensor` | 2026-09-10 |
| Q4 | Protocol value | Add `TransportProtocols.OusterBlueCityEdge` (leave `HttpDownloaderClient` alone) | 2026-09-10 |
| Q5 | Cadence mechanism | **No hosted service / timer** (review M4 — `HostedServiceBase` runs once). Schedule `EventLogUtility log --device-type LidarSensor` separately; cadence = the schedule + per-device window knobs | 2026-09-10 |
| B1 | Event time base | **Naive intersection-local**, not UTC (review). Request `object_events` with `timezone` = box `config.timezone`; store local with offset stripped | 2026-09-10 |
| Q9 | Auto-config in Phase 1? | **Yes** — the channel-match *draft* generator (WP6). Full generate/merge/reconcile + scheduled re-sync is a fast-follow | 2026-09-10 |
| Q10 | Phase-number source | Channel match to the existing ATSPM `Detector`/`Approach`; no phase guessing | 2026-09-10 |
| Q11 | Box → `Location` | Intersection id is **not** exposed by the analytics API (`/about`, `/config` checked). `LocationIdentifier` is operator-entered on the `Device`. Reading it from the Detect core API is a possible fast-follow. | 2026-09-10 |
| X2 | Keycloak realm / token URL | realm `detect`; `https://<box>/auth/realms/detect/protocol/openid-connect/token`; `client_credentials` | 2026-09-10 |
| X2a | API client + role | `analytics-client` (confidential, client-credentials) exists; no special service-account role needed | 2026-09-10 |
| X2b | Analytics Server running? | Yes — earlier 500s were a role-less GUI-user token | 2026-09-10 |
| X3 | `object_events` pagination | `pagination.next_page` until `null`; `total_count`/`total_pages` on page 1 | 2026-09-10 |
| X5 | Query time zone | `timezone` query param accepted. **Pass `timezone` = the box's `config.timezone`; store naive intersection-local** (review B1) — *not* UTC | 2026-09-10 |
| X9 | Zone enumeration | `GET /snmp/zone_mappings` = full inventory (`zone_id` int64, stable `zone_number`, `zone_name`); no geometry endpoint | 2026-09-10 |
| X10 | Zone → phase | Not in the API; inherited via channel match (see Q10). Only auto-created new approaches need operator phase entry | 2026-09-10 |
| X11 | Zone direction/lane | Encoded in `zone_name` per the UDOT standard, not a metadata field | 2026-09-10 |
| X12 | Fleet naming discipline | Documented UDOT standard: `CLASSES-APPROACH-DIRECTION+LANE-TYPE-CHANNEL#` (parsers tolerate minor variants) | 2026-09-10 |
