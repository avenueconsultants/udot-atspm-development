# Time of Day — Playwright E2E Test Plan

## Purpose

This document specifies the Playwright end-to-end test suite to be implemented for the
Time of Day (TOD) tool (`/time-of-day` in `Atspm/WebUI`). It is a specification for
implementation, not implementation itself — the actual `playwright.config.ts`, spec
files, fixtures, and seed scripts are built from this document. Once implemented, this
document is also the checklist used to review that implementation for coverage and
correctness against the real business logic.

No Playwright setup currently exists in this repo (`Atspm/WebUI` only has Jest unit/RTL
tests). This is net-new.

## Why "real and accurate," not just UI smoke tests

The backend (`TimeOfDayReportService` → `TimeOfDayService` → `TimeOfDayRecommendationService`,
`TimeOfDaySplitPressureService`, `TimeOfDayPlanScheduleService`, `TimeOfDayProfileService`,
`TimeOfDayLocationService`) is already thoroughly covered by xUnit tests in
`Atspm/ApplicationTests/Business/TimeOfDay/*` and `Atspm/ReportApiTests/TimeOfDay*`. Those
tests prove the math (percentile thresholds, sustained-bin detection, median-across-locations
aggregation, cross-traffic suppression floor, etc.) against hand-built in-memory fixtures.

**This E2E suite's job is different: prove the real stack — real browser, real
ReportApi, real Postgres-backed detector/event/plan data, real UI state — produces
the same correct results end-to-end.** It is not a second attempt to re-derive the math
from scratch; it reuses the already-proven numeric scenarios from the xUnit suite as the
oracle, seeded as real rows in the database, and asserts the UI surfaces exactly those
derived numbers/times/warnings. This gets "real and accurate" without the suite becoming
a guess about what the right answer should be.

### Recommended data strategy

1. Stand up the full stack via `Atspm/docker-compose.yml` (postgres, database-installer,
   configapi, reportapi, identityapi, webui/nginx) — see `Atspm/README.md` for cert
   generation and `.env` requirements. Playwright's `webServer`/global-setup should
   assume this stack is already running (started by CI or a dev script), not launch it
   itself — spinning up 4+ services is too slow/flaky to own from `playwright.config.ts`.
2. Add a seed script (SQL or a small console/xUnit-adjacent utility) that inserts
   deterministic rows directly into the config DB (`Location`, `Approach`, `Detector`)
   and event DB (`IndianaEvent` and/or `DetectorEventCountAggregation`, `CoordPatternChange`
   controller events) for a small fixed set of synthetic locations/dates. Mirror the
   volume curves already used in `TimeOfDayRecommendationServiceTests.cs` and
   `TimeOfDaySplitPressureServiceTests.cs` (e.g. "450-500 vph 06:00-08:30, 650-700 vph
   15:00-18:00, 100 vph otherwise" → known plan "1" window 06:00-08:45, plan "13" window
   15:00-18:15) so expected values in the Playwright specs can cite those exact
   service-test names/numbers as their justification.
3. Do **not** use `GET /api/v1/TimeOfDay/test` as a data source for behavioral
   assertions — it returns `AutoFixture`-randomized data on every call
   (`ReportControllerBase.cs`), so it's only useful for a one-off "does the route exist
   and return 200 with the right JSON shape" smoke check.
4. Seed one fixed admin user via the compose stack's `SEED_ADMIN`/`ADMIN_EMAIL`/
   `ADMIN_PASSWORD` env vars and use it for Playwright login in `beforeEach`/a shared
   auth fixture (storage state). Confirm the actual login flow manually first — no
   Next.js `middleware.ts` was found, so auth gating is likely client-side
   session/context, which affects how a Playwright `page.goto('/time-of-day')` behaves
   pre-login (may redirect, may render a login wall client-side after hydration).
5. Keep the seeded dataset small and named (e.g. `E2E-COMMUTE-01`, `E2E-FREE-FALLBACK-01`,
   `E2E-SPLIT-PRESSURE-01`, `E2E-MULTI-LOCATION-MEDIAN-01`) so each spec file can select
   exactly the scenario it needs by location identifier instead of relying on whatever
   is in a shared dev database.

## Prerequisites to confirm before writing specs (flag to Codex, don't assume)

- Exact login UI flow and selectors (form fields, submit button, redirect target).
- Whether `/time-of-day` 404s, redirects, or renders an empty shell before auth resolves.
- Final seed data mechanism (raw SQL script vs. a small seeding utility) and how CI/dev
  triggers it before the Playwright run.
- Confirm `WebUI/.env.local` values needed (`CONFIG_URL`, `REPORTS_URL`, `IDENTITY_URL`,
  `DATA_URL`) for the target environment the tests run against.

## Suite structure (recommended)

```
Atspm/WebUI/e2e/
  playwright.config.ts
  fixtures/
    auth.ts                 # logged-in storage state fixture
    seedData.ts             # known location identifiers / expected values, one const per scenario
  page-objects/
    TimeOfDayPage.ts         # locations, dates, directions, advanced sidebar, generate button
    TimeOfDayResults.ts      # chart tab, schedules tab, location data tab
  specs/
    validation.spec.ts
    options-corridor.spec.ts
    options-dates.spec.ts
    options-directions.spec.ts
    options-advanced-thresholds.spec.ts
    options-presets.spec.ts
    results-chart.spec.ts
    results-schedules.spec.ts
    results-location-data.spec.ts
    warnings.spec.ts
    url-state.spec.ts
    data-source-toggle.spec.ts
```

Use Page Object Model so selectors live in one place — the UI component files referenced
below (`TimeOfDayCorridorOptions.tsx`, `TimeOfDayDirectionSelector.tsx`, etc.) currently
have no `data-testid` attributes as far as this plan's research found; **Codex should add
stable `data-testid`s to these components as part of this work** rather than relying on
text/role selectors that will be brittle against copy changes.

## Scenario matrix

Each scenario lists: setup, action, and the real/accurate expected result with its source.

### 1. Validation (`validation.spec.ts`)

| # | Scenario | Expected result |
|---|----------|------------------|
| 1.1 | Click "Generate Analysis" with zero locations selected | No API call made; inline error "Please select one or more locations." (`index.tsx` client validation) |
| 1.2 | Select a location, zero dates, click Generate | No API call made; inline error "Please select one or more dates." |
| 1.3 | Select location + dates, submit with backend-rejectable state (if reachable via UI) | 400 surfaced verbatim as plain string message, not JSON — confirms `ReportControllerBase` catch-all `BadRequest(e.Message)` passthrough works through `getErrorMessage` |
| 1.4 | Enter an out-of-range advanced numeric field (e.g. lane capacity `0`) | Field shows inline "Min 1" error; the *previous valid value* is still what's sent on Generate (draft pattern in `TimeOfDayAdvancedSidebar.tsx`) — assert request payload / resulting data reflects old value, not 0 |
| 1.5 | Clear a numeric field entirely | Field stays blank in UI (not coerced to 0); "Enter a number" inline error; previous valid value still used in request |

### 2. Corridor/location options (`options-corridor.spec.ts`)

| # | Scenario | Expected result |
|---|----------|------------------|
| 2.1 | Select a single location via map/search | Appears in ordered list with delete control |
| 2.2 | Select 3+ locations | Count chip shows correct total; first→last breadcrumb shown |
| 2.3 | Drag-reorder the location list | New order persists and is reflected in the URL `locations` param after Generate |
| 2.4 | Remove one location via its delete control | List updates immediately; count chip decrements |
| 2.5 | "Clear all" | Empty state text "No locations selected / Add a route, choose a location, or select one on the map." reappears |
| 2.6 | Seed a known 3-location corridor dataset (`E2E-MULTI-LOCATION-MEDIAN-01`), run full analysis | Corridor/direction profile values match the **median across locations**, not the mean — mirrors `TimeOfDayServiceProfileTests.GetChartData_UsesMedianRepresentativeProfilesAcrossLocations` (25/75/225 vph example → median 75) |

### 3. Date options (`options-dates.spec.ts`)

| # | Scenario | Expected result |
|---|----------|------------------|
| 3.1 | No location selected yet, open calendar | Day-availability shading does not attempt to load (per `TimeOfDayDatesOptions.tsx`, availability lookup requires ≥1 location) |
| 3.2 | Select a location, open calendar | Shading reflects actual data availability for that location |
| 3.3 | Select 3 contiguous days | One grouped chip "Mon, Jan 5 - Wed, Jan 7" (no year shown, same year) |
| 3.4 | Select days spanning two different years | Chip label includes year |
| 3.5 | Delete one range chip | Only those dates removed from selection |
| 3.6 | "Clear all" dates | Date empty state reappears |
| 3.7 | Seed a scenario whose selected dates include duplicates (if reachable via URL seeding) | Server response includes a `DuplicateSelectedDates` warning, rendered verbatim in the warnings area |

### 4. Direction selection (`options-directions.spec.ts`)

| # | Scenario | Expected result |
|---|----------|------------------|
| 4.1 | Default state on fresh load | "Separate AM/PM directions" switch default; default directions `['Northbound','Southbound']` for all three (all-day/AM/PM) per `types.ts` |
| 4.2 | Turn off "Separate AM/PM" | Single grid; collapses to `allDayPrimaryDirections` |
| 4.3 | Turn on "Separate AM/PM", set AM=Northbound, PM=Northbound (same axis, same value) | After Generate, request's derived all-day directions = `['Northbound']` (per `deriveAllDayPrimaryDirections` — AM==PM case) |
| 4.4 | Set AM=Northbound, PM=Southbound (same axis N-S, different values) | Derived all-day = union = `['Northbound','Southbound']` |
| 4.5 | Set AM=Northbound, PM=Eastbound (different axes) | Derived all-day = `[]` (backend infers strongest axis) — **this is a non-obvious, easy-to-regress behavior; assert the literal outgoing request/response reflects empty all-day directions** |
| 4.6 | Seed scenario where an explicitly requested AM direction has zero matching data at the location | UI surfaces the per-location `AmDirectionExceptionMessage` text distinct from the corridor-wide `PrimaryDirectionDataUnavailable` warning — assert both appear in their correct respective locations (Location Data row vs. top-level warnings) |
| 4.7 | Request both AM and PM primary direction with literally zero corridor-wide matching data | Recommendation and split-pressure both degrade to summary-text-only with substring "...primary direction data is unavailable for AM: X; PM: Y." (exact substring per `TimeOfDayRecommendationServiceTests`) — schedule chart area shows empty schedule, not an error |

### 5. Advanced thresholds (`options-advanced-thresholds.spec.ts`)

| # | Scenario | Expected result |
|---|----------|------------------|
| 5.1 | Open "Customize" (schedule thresholds) sidebar | All fields show current values as percents (e.g. 0.55 → "55%") |
| 5.2 | Edit `amExitPctOfPeak` lower (e.g. 0.2 vs default 0.4) on the commute-curve seeded dataset, re-run | AM plan end time extends later — monotonic relationship, mirrors `TimeOfDayRecommendationServiceTests` exit-threshold parameterized case |
| 5.3 | Edit `pmExitPctOfPeak` similarly | PM plan end time extends later, same monotonic check |
| 5.4 | Set `maxAmEndTime` to an early cap (e.g. 09:30) with sustained high volume continuing past it | AM plan ("1") end time is hard-capped at 09:30 regardless of volume — mirrors `BuildRecommendation` max-end-time test |
| 5.5 | Set `maxPmEndTime` similarly (e.g. 18:00) | PM plan end time hard-capped at 18:00 |
| 5.6 | Seed a dataset where evening volume never drops below the FREE threshold | FREE start falls back to `freeFallbackTime` (default 23:30) |
| 5.7 | Edit `laneCapacityVehiclesPerHour` | Location Data tab's occupancy % recalculates as `round(peakSmoothedVolume / (lanes * capacity) * 100)` |
| 5.8 | Open "Occupancy and Review" sidebar, edit `splitReviewThresholdPercent`/`shoulderReviewThresholdPercent` | Split-pressure review text crosses between "primary street remains dominant" / "review split allocation..." / "review shoulder timing..." exactly at the configured thresholds (35%/45% defaults) |
| 5.9 | Set a per-direction lane count override | Occupancy % uses the override instead of detected lane count or the assumed-lanes fallback |
| 5.10 | Seed a location whose lane configuration changed between two selected dates | `CapacityVariesByDate` warning appears and occupancy % is `null`/shown as `-` for that location, not a stale number |

### 6. Presets (`options-presets.spec.ts`)

| # | Scenario | Expected result |
|---|----------|------------------|
| 6.1 | Select a named roadway-type preset | All threshold fields update to match the preset's values exactly |
| 6.2 | After selecting a preset, manually edit one field | Preset dropdown flips to showing "Custom" (disabled placeholder) |
| 6.3 | Manually re-enter the exact preset values by hand | Dropdown re-matches the original preset (not stuck on "Custom") |

### 7. Data source toggle (`data-source-toggle.spec.ts`)

| # | Scenario | Expected result |
|---|----------|------------------|
| 7.1 | Default on page load | "Indiana Events" selected; caption "Volumes are counted in 15-minute bins." |
| 7.2 | Switch to "Aggregated" on a location seeded with `DetectorEventCountAggregation` rows | Result volumes come from aggregation rows, not Indiana events; `AggregatedMovementDetailLimited` informational warning present |
| 7.3 | Switch to "Aggregated" on a location with zero aggregation rows but real Indiana events | `NoLocationVolumeData` or equivalent warning; `DataQualityFlag = "NoData"` for that location in Location Data tab |

### 8. Results — Chart tab (`results-chart.spec.ts`)

| # | Scenario | Expected result |
|---|----------|------------------|
| 8.1 | Successful run with usable corridor data | Chart tab shows ECharts chart; summary header populated; "No Data Available" alert absent |
| 8.2 | Toggle analysis mode Recommendation → Split Pressure | Chart content switches; sidebar detail tabs/content switch in sync |
| 8.3 | Toggle a layer off in the Layers panel (e.g. a Schedules series) | Series disappears from chart without reloading data |
| 8.4 | Click a chart marker/peak | Opens Details panel and highlights the corresponding series (per `TimeOfDayResults.test.tsx` coverage, now verified against a real rendered chart) |
| 8.5 | Seed the "no usable volume anywhere" scenario (all locations zero observations) | `Notes` = "No volume profile could be built..."; chart tab shows "No Data Available"; recommendation/planProfile/splitPressure stay empty, not erroring |
| 8.6 | Seed a lunchtime volume spike (e.g. 5000 vph 11:00-13:00) alongside real AM/PM commute peaks | `AmPeakTime`/`PmPeakTime` markers land on the real 05:00-10:00 / 14:00-19:00 window peaks, not the lunch spike — mirrors `BuildRecommendation` lunch-surge test |
| 8.7 | Seed cross-traffic volume so low it's under the suppression floor (`max(300, dayMaxTotal*0.15)`) at a given bin | That bin's cross-traffic % series point is `null`/absent, not a misleadingly high ratio (e.g. not showing 100% off of 1 cross vehicle vs 0 primary) |
| 8.8 | Seed `MissingPlanData`/`PartialPlanData` conditions | Banner above results tabs reads "Existing plan coverage needs review." |

### 9. Results — Schedules tab (`results-schedules.spec.ts`)

| # | Scenario | Expected result |
|---|----------|------------------|
| 9.1 | Multiple locations sharing the exact same schedule signature | Grouped under one "common schedule" bucket; exception chip count = 0 |
| 9.2 | One location with a different schedule signature | Shown separately as an "exception"; exception chip count = 1 |
| 9.3 | A location with zero schedule data (seed with no `CoordPatternChange` events) | Appears under "unavailable," not counted as an exception |
| 9.4 | Seed scenario where recommendation bailed out (empty `recommendedSchedule`) | Warning Alert shows `recommendation.summaryText` as the reason, while existing/current schedules still render normally |
| 9.5 | Seed scenario with zero schedule data anywhere | "No current schedule data available." message shown |
| 9.6 | Location identifier containing regex special characters (e.g. `.` or `(` in the identifier string) | Renders correctly without breaking row matching/highlighting (regression class called out in `TimeOfDaySchedules.test.tsx`) |

### 10. Results — Location Data tab (`results-location-data.spec.ts`)

| # | Scenario | Expected result |
|---|----------|------------------|
| 10.1 | Location with full date coverage | `DataQualityFlag = "Complete"`, no dash values for computed fields |
| 10.2 | Location with partial date coverage | `DataQualityFlag = "Partial"`, `PartialLocationData` warning present |
| 10.3 | Location with zero data | `DataQualityFlag = "NoData"`, relevant numeric fields render as `-` |
| 10.4 | Null/missing boolean-ish fields | Rendered as "Yes"/"No" correctly, never raw `true`/`false` or blank |
| 10.5 | Occupancy % present | Matches `round(peakSmoothedVolume / capacity * 100)` for the seeded known volume/capacity |

### 11. Warnings (`warnings.spec.ts`)

One assertion per warning code, each backed by a seeded condition that genuinely
triggers it (don't just check string presence without the real triggering condition):
`MissingLocationConfiguration`, `DuplicateSelectedDates`, `PartialPlanData`,
`MissingPlanData`, `NoVehicleDetectors`, `NoTurningMovementDetectors`,
`AggregatedMovementDetailLimited`, `NoLocationVolumeData`, `PartialLocationData`,
`CapacityVariesByDate`, `PrimaryDirectionDataUnavailable`, `NoUsableVolumeData`.
Assert warnings render verbatim (not truncated/rewritten), and that multiple
simultaneous warnings all appear rather than only the first.

### 12. URL state (`url-state.spec.ts`)

| # | Scenario | Expected result |
|---|----------|------------------|
| 12.1 | Navigate directly to `/time-of-day?locations=...&dates=...&...` with full known-good params | Form hydrates all fields to match the URL; **no auto-fetch** — results area stays empty until "Generate Analysis" is clicked |
| 12.2 | Seed URL with an unknown/nonexistent location identifier | Chip list still shows an entry (stub object), with no resolved display name, rather than crashing |
| 12.3 | Click Generate, confirm URL updates (`history: 'replace'`) with resolved/sorted/deduped params | `dates` deduped+sorted ascending `yyyy-MM-dd`; browser back/forward works sensibly |
| 12.4 | Manually edit a field after URL hydration, then the URL changes again externally (e.g., simulate a race) | Per `TimeOfDayPage.test.tsx` coverage: user edits to touched fields are preserved; untouched fields still pick up delayed defaults; removing a URL param restores the field default |

## Out of scope for this suite

- Re-deriving the TOD math from first principles — that's the xUnit suite's job; this
  suite consumes its known-good scenarios as fixtures.
- Load/performance testing.
- The `/api/v1/TimeOfDay/test` fixture endpoint, beyond a single route-shape smoke check.
- Visual regression / pixel-diffing of the ECharts canvas (acceptable to assert on
  series/legend presence via DOM/tooltip text, not canvas pixels).

## Review checklist (for use once Codex implements this)

- [ ] Every scenario row above has a corresponding spec/test, or an explicit documented
      reason it was dropped.
- [ ] Seeded data matches the cited xUnit scenario's exact input numbers, so expected
      values in assertions can cite the same source test by name.
- [ ] No assertion relies on `GET /api/v1/TimeOfDay/test` (AutoFixture random data) for a
      behavioral/numeric check.
- [ ] Tests fail loudly (not silently skip) if the seed data/backend isn't reachable —
      no swallowed setup errors.
- [ ] `data-testid`s added are stable and don't rely on translatable/changeable copy text.
- [ ] Auth/login flow is handled via a shared fixture, not duplicated per spec file.
- [ ] CI wiring: what starts the docker-compose stack and runs the seed script before
      Playwright executes, and in what order.
