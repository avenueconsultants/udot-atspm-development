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
| Q6 | **Backfill depth at go-live** — how far back to pull on first connect? | First-run window. Bounded by ~9–12 day retention. | Prototype: temporarily raise `LoggingOffset` for one run, bounded by `MaxTotalWindowMinutes = 10080`. Before fleet rollout, derive a per-device watermark from stored LiDAR events. |
| Q7 | **Reporting scope** — what should users see from LiDAR data? | Drives aggregation types + `reportapi` (later phases). | Deferred — not Phase 1. |
| Q8 | **Credentials at rest** — keep the existing `DeviceConfiguration` plaintext/DB pattern, or introduce a secret store (cross-cutting for all device creds)? **Sharpened 2026-09-17 (doc 17 §5):** this is no longer just "storage pattern" — the *read path* is confirmed exposed regardless of which field holds the secret (`Password` and `ConnectionProperties` are both readable by any `Device:View`-authorized caller, unredacted). | Security. The current `analytics-client` secret must be rotated regardless. A credential-free read projection is now a concrete, scoped requirement, not a deferred cross-cutting idea. | Minimum bar for WP5: a `DeviceConfiguration` read DTO/EDM projection that omits `Password`/secret-valued `ConnectionProperties` keys, with a write path that preserves omitted secrets on update. Full secret-store remains a separate, larger cross-cutting effort. |
| Q12 | **`TYPE → DetectionTypes` mapping** — confirm `PR`→stop-bar vs advanced presence, `CO`→`LLC`, `QU`→`IQ`/`EQ`, `YR`→out. | `lidar-autoconfig` `Detector.DetectionTypes` (WP6). | Table in [`06`](06-auto-config-feasibility.md) §"The join"; refine during build. |
| X1 | **Is ~9–12 day raw-event retention representative** across the fleet / firmware versions? | Cadence + backfill safety margin; whether ATSPM must alert aggressively on lag. | Assume ~9–12 days; 5-min poll, 7-day backfill, "device N days behind" alert (WP8). |
| X4 | **`deduplicate_objects` semantics** and whether server `id` is stable for the same detection across overlapping queries. | Dedupe-key correctness. | Dedupe on `(LocationIdentifier, Timestamp, ZoneId, ObjectId, ServerId)`; verify in WP3/WP7 with an overlapping-window fixture. |
| X6 | **Box clock discipline (NTP?)** vs ATSPM host skew. | `EndLagMinutes` default. | `EndLagMinutes = 2`; observe `created_at` − `timestamp` in the pilot. |
| X7 | **TLS** — box cert is self-signed. Install each box's CA on the ATSPM host, per-device pinned thumbprint, or allow-untrusted flag? | `OusterBlueCityEdgeDownloaderClient` handler config. | `ConnectionProperties["AllowUntrustedCertificate"]` / `["PinnedCertThumbprint"]`. |
| X8 | **Hostname vs IP** — are boxes addressable by DNS, or IP only? | Possible small `DownloaderClientBase` change. | Support `ConnectionProperties["BaseUrl"]` (hostname ok). |
| X13 | **Perception/LidarHub API auth + schema** (doc 13) — documented by Ouster but not yet pulled from a live box (VPN was down when checked, 2026-09-16). Does `GET /lidar-hub/api/v1/world` carry usable intersection coordinates? Does `GET /perception/api/v1/point_zones` carry real zone geometry? What auth does either require? | Would strengthen Q11 (box→`Location`) and doc 06 auto-config, but is **not required** for the Phase-1 spec as written. | Treat as unverified; do not build against it yet (doc 13). Re-run the doc 07-style live-box check next time VPN access is available. |

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
| Q11 | Box → `Location` | Intersection id is **not** exposed by the analytics API (`/about`, `/config` checked). `LocationIdentifier` is operator-entered on the `Device`. `GET /lidar-hub/api/v1/world` (doc 13) may be a stronger fast-follow path if it carries usable coordinates — **unverified**, see X13. | 2026-09-10 |
| X2 | Keycloak realm / token URL | realm `detect`; `https://<box>/auth/realms/detect/protocol/openid-connect/token`; `client_credentials` | 2026-09-10 |
| X2a | API client + role | `analytics-client` (confidential, client-credentials) exists; no special service-account role needed | 2026-09-10 |
| X2b | Analytics Server running? | Yes — earlier 500s were a role-less GUI-user token | 2026-09-10 |
| X3 | `object_events` pagination | `pagination.next_page` until `null`; `total_count`/`total_pages` on page 1 | 2026-09-10 |
| X5 | Query time zone | `timezone` query param accepted. **Pass `timezone` = the box's `config.timezone`; store naive intersection-local** (review B1) — *not* UTC | 2026-09-10 |
| X9 | Zone enumeration | `GET /snmp/zone_mappings` = full inventory (`zone_id` int64, stable `zone_number`, `zone_name`); no geometry endpoint | 2026-09-10 |
| X10 | Zone → phase | Not in the API; inherited via channel match (see Q10). Only auto-created new approaches need operator phase entry | 2026-09-10 |
| X11 | Zone direction/lane | Encoded in `zone_name` per the UDOT standard, not a metadata field | 2026-09-10 |
| X12 | Fleet naming discipline | Documented UDOT standard: `CLASSES-APPROACH-DIRECTION+LANE-TYPE-CHANNEL#` (parsers tolerate minor variants) | 2026-09-10 |
| Q13 | `LidarZoneEvent` storage wire format | **Protobuf** (protobuf-net), delivered as a **write-time runtime-type dispatcher inside the one shared `EventLogCompressedListConverter`** plus a type identifier added to the compression envelope — not a per-type EF converter (X14 proved that fails) and not `[ProtoInclude]` polymorphism on `EventLogModelBase` (avoidable per doc 17 §3). Flat protobuf contracts must explicitly re-declare inherited fields (`Timestamp`, `LocationIdentifier`) — spike found silent data loss otherwise. See doc 03 §"`Data` payload format" (rewritten), doc 10 P7. | 2026-09-17, finalized 2026-09-17 after spike (doc 17) |
| X14 | Per-type `Data` converter override under TPH | **Fails** — `InvalidOperationException` at model-build time; the property is owned by the base type, and targeting the inherited property directly reconfigures the converter for the whole hierarchy. Confirmed by spike, [`17-preflight-findings.md`](17-preflight-findings.md) §2. Design moved to the dispatcher approach (Q13, doc 03). | 2026-09-17 |
| — | H1 archive-merge hour snap | **Nuanced, not a clean yes/no.** Toolkit 1.6.0's `Timeline<StartEndRange>` floors `Start`/ceilings `End` to the hour in the general case — **but** a batch containing only events exactly on an hour boundary (e.g. only `10:00:00`) produces `Start == End == 10:00`, not `[10:00, 11:00)`. A later poll with events later in that hour then computes the normal `[10:00, 11:00)` range — **different PK, same hour, two rows** — the exact double-count scenario doc 08 WP7 was checking for, just triggered by an edge case rather than the general case. **Fix:** the LiDAR archive path must compute a canonical `Start`/`End = Start + 1 hour` itself rather than trusting `Timeline`'s raw output as the PK. See doc 08 WP7 (rewritten) for the corrected acceptance criteria. Confirmed by spike against the real installed assembly, doc 17 §4. | 2026-09-17 |
| — | Credential exposure — field choice doesn't matter | **Doc 04 currently stores the Keycloak secret in `Password` (§Credentials handling), not `ConnectionProperties`** — BlueBand (doc 15) put its bearer token in `ConnectionProperties` for a different reason (its 1024-char budget vs. `Password`'s 50-char limit, not for exposure reasons). Spike confirms **neither field is safe from read exposure**: `Password` is in the ConfigApi OData EDM and readable by any `Device:View`-authorized caller (not just admins/device-edit — e.g. `LocationConfigurationAdmin` has `Device:View` without device-edit), with no redaction in `ConfigControllerBase`; `ConnectionProperties` has no `[IgnoreDataMember]` either and is equally exposed. So switching fields (for either the 50-char limit or exposure reasons) doesn't help either problem — a real fix needs a credential-free read projection **and** a write path that preserves omitted secrets on update. Raises doc 10 S2 from "verify" to "confirmed, needs a fix before WP5." See doc 17 §5. | 2026-09-17 |
| X15–X17 | BlueBand-raised items (phase data in scope for BlueBand, reuse the file-size guard for BlueCity, mixed-`DateTimeKind` downstream check) | See doc 15 §"Open items this raises" for the full table. | 2026-09-17 |
