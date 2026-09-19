# 14 — Local Prototype Verification (Live Box)

Purpose: with a live BlueCity edge box on hand, resolve the open items that need **empirical**
evidence rather than more design — before WP2/WP3 are built out fully. This is a checklist,
not new architecture; it turns doc 05's still-open X-items into concrete steps and the
evidence to capture. All steps are **read-only** against the box (`GET`/token only — never
`POST /batch` or `PUT reset`, and never any `perception`/`lidar-hub` write endpoint — see
doc 13's do-not-call list).

Run against the same box used for doc 07 (`10.235.13.48`) or whichever unit is on hand.
Capture raw responses (headers + body, secrets redacted) into
`docs/lidar-integration/fixtures/` (create if absent) — WP3/WP9 unit tests are built from
these fixtures.

## What this resolves

| Step | Doc 05 item | Question | Evidence to capture |
| --- | --- | --- | --- |
| P1 | X6 | Box clock discipline vs host — is `EndLagMinutes = 2` enough? | For ~10 fresh events: `created_at − timestamp` delta (seconds). Note NTP status if visible in the GUI. |
| P2 | X4 | Is `object_events.id` stable across overlapping queries? Does `deduplicate_objects=true` actually dedupe? | Query the same 10-minute window twice with a 5-minute overlap, `deduplicate_objects=true` once and `false` once. Diff `id`/`(zone_id, object_id, timestamp)` across the two calls. |
| P3 | H1 | Does `ArchiveDataEvents`'s `Timeline<StartEndRange>` snap to the hour, or does an overlapping poll create a second `CompressedEventLogs` row for the same hour? | This one is a **code** check, not a box check — see "H1 code check" below. Needs the repo, not the box. |
| P4 | X13 | Do `/lidar-hub/api/v1/world` and `/perception/api/v1/point_zones` return usable data, and what do they auth as? | Response bodies (redacted) + which token worked (`analytics-client` vs GUI token vs none). |
| P5 | — (smoke test) | Does the planned WP2/WP3 shape actually decode a real payload end-to-end? | A throwaway script (not the real client) that: gets a token, pulls one page of `object_events`, deserializes into a POCO shaped like doc 03's `LidarZoneEvent`, prints a row count. |
| P6 | Q6/X1 | Sanity-check retention is still ~9–12 days on this box (or the new one, if different hardware/firmware). | Try `start_time` = now−9d, now−11d, now−13d; note where results go empty. |

---

## P1 — Clock skew (`EndLagMinutes`)

```
GET /analytics/api/v1/object_events?start_time=<now-10m>&end_time=<now>&timezone=UTC&per_page=50
```

For each returned event, compute `created_at - timestamp`. Record min/median/max across at
least 10 events spanning a few minutes of wall-clock time (re-run once a minute or two apart
to get fresh events, since events are created near-real-time as objects clear a zone).

- If max delta ≤ ~90s: keep the doc 05 default `EndLagMinutes = 2`.
- If it's routinely higher: bump the default and note the box/firmware it was observed on
  (X1 asks whether 9–12 day retention and clock behavior generalize across the fleet).

## P2 — Dedupe key stability

1. Pick a 10-minute window with the box currently returning >0 events.
2. Call it once with `deduplicate_objects=true`, once with `false`, same window both times.
3. Call the **same window again** 5 minutes later (so it now overlaps the tail of the next
   window you'll pull for WP7 testing).
4. Compare `id` values across calls 1 and 3 for events that appear in both (same
   `object_id`+`zone_id`+`timestamp`). If `id` is stable, doc 03's dedupe key
   (`LocationIdentifier, Timestamp, ZoneId, ObjectId, ServerId`) is confirmed safe to use as
   the primary equality key; if `id` changes between calls, dedupe must rely on the
   `(zone_id, object_id, timestamp)` tuple instead — flag this back into doc 03 §equality and
   doc 05 X4 as resolved either way.

## P3 — H1 code check (not a box call)

This is a five-minute repo check, not a live-box step — do it in parallel with P1/P2/P4:

1. Find the `Timeline<StartEndRange>` type used by `ArchiveDataEvents` (external toolkit
   package — check the referenced NuGet package's source or decompile it).
2. Confirm whether constructing it with a 1-hour span snaps `Start`/`End` to the hour
   boundary, or preserves the exact min/max timestamps of the input list.
3. Record the answer directly in doc 05 (replace the H1 row) and doc 08 WP7 (resolve the
   "verify empirically, then branch" note) — this determines whether WP7 needs the hour-snap
   fix or just the `Equals`/`GetHashCode` tests.

## P4 — Perception/LidarHub probe (doc 13, X13)

Only if VPN/network access to the box's other ports is available (doc 13 notes these may be
served differently than `/analytics/api/v1/`):

```
GET /lidar-hub/api/v1/world
GET /perception/api/v1/point_zones
```

Try with the existing `analytics-client` token first. If that 401/403s, note it — these APIs
may need a different Keycloak client or no auth (check the Detect GUI's network tab while
browsing to the equivalent GUI page, if one exists, to see what token/cookie it sends).

**Do not call** any endpoint from doc 13's write list (`execution/*`, sensor add/remove,
password change, extrinsics/calibration, `point_zones` PUT/POST, OTA) — GET only.

Record: auth outcome, response shape, and whether `world` contains anything resembling
GPS/lat-lon (→ would resolve Q11 box→`Location` mapping) and whether `point_zones` contains
real geometry (→ would strengthen doc 06 auto-config beyond name-parsing alone).

## P5 — End-to-end decode smoke test

A **throwaway** script (Python, `curl`+`jq`, or a scratch .NET console app — whatever's
fastest; this is not the WP2/WP3 deliverable and doesn't need to live in the repo) that:

1. POSTs `client_credentials` to the token URL, gets a bearer token.
2. GETs one `object_events` page for a small window.
3. Parses the JSON into a struct/record matching doc 03's `LidarZoneEvent` field list
   (`id`, `perception_id`, `timestamp`, `object_id`, `zone_name` (trim), `zone_id` as
   `int64`, `dwell_time_ms`, speeds, dimensions, `classification`, `sub_classification`,
   `user_classification`, `speed_bin`, `created_at`).
4. Prints the row count and a couple of sample rows.

This validates the field map in doc 03 against a *current* payload before WP1/WP3 are built
— cheap insurance against the manual/doc 07 having drifted from a firmware update. Save one
real (redacted) response as a fixture file for WP3/WP9's unit tests.

## P6 — Retention sanity check

```
GET /analytics/api/v1/object_events?start_time=<now-9d>&end_time=<now-9d+1h>&per_page=1
GET /analytics/api/v1/object_events?start_time=<now-11d>&end_time=<now-11d+1h>&per_page=1
GET /analytics/api/v1/object_events?start_time=<now-13d>&end_time=<now-13d+1h>&per_page=1
```

Confirm where `returned_count` goes to 0. If this box's retention differs materially from
the ~9–12 days measured 2026-09-10, update doc 05 X1 and doc 08 WP4's backfill default.

---

## Explicitly out of scope for this prototype pass

- Building the real `OusterBlueCityEdgeDownloaderClient`/`OusterBlueCityObjectEventsDecoder`
  (WP2/WP3) — that's Codex's implementation work from docs 02/03/08, not this doc.
- Anything in doc 13's write surface.
- Multi-box testing — one live unit is enough to resolve P1/P2/P4/P5/P6; P3 is box-independent.
- Auto-config (WP6) — needs `/snmp/zone_mappings` plus an existing ATSPM `Location`/`Detector`
  set to match against; do only if that's already configured for this box.

## Feeding results back

After running P1–P6, update:

- Doc 05: resolve X1, X4, X6, X13 rows (move to "Decided" with the observed value + date);
  record the H1 answer from P3.
- Doc 03: correct the field map if P5 found drift from the live payload.
- Doc 08: WP7's "verify empirically, then branch" note → pick the branch; WP4's
  `EndLagMinutes` default if P1 warrants a change.
- This doc: leave the checklist in place (useful for onboarding each new box in WP10), but
  add a dated results log entry at the bottom, e.g.:

  | Date | Box | P1 | P2 | P3 | P4 | P5 | P6 |
  | --- | --- | --- | --- | --- | --- | --- | --- |
  | | | | | | | | |
