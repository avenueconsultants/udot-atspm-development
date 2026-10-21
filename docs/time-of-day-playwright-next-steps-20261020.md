# Time of Day Playwright Suite — Next Steps for Codex

## Checklist

- [x] **1. Seed harness** (blocks everything below)
  - [x] Choose mechanism: SQL script vs. seeding utility; make it idempotent
  - [x] Seed `Location`/`Approach`/`Detector` rows for all scenario identifiers in `e2e/fixtures/seedData.ts`
  - [x] Seed the commute volume curve (450-500 vph 06:00-08:30, 650-700 vph 15:00-18:00, 100 vph otherwise)
  - [x] Seed the FREE-fallback curve (evening volume never drops below FREE threshold)
  - [x] Seed split pressure (dominant primary axis + cross-axis crossing 35%/45% thresholds + a low-volume suppression-floor bin)
  - [x] Seed multi-location median (Eastbound 25/75/225 vph same bin → median 75)
  - [x] Seed `CoordPatternChange` events: one clean common-schedule location, one divergent/exception location, one with zero plan events
  - [x] Add a seed variant for 5.10 (lane config changes mid-range)
  - [x] Decide invocation: separate pre-test npm script
  - [x] Write `Atspm/WebUI/e2e/README.md` documenting the seed command
- [x] **2. Calculation-heavy result/warning specs** (needs step 1)
  - [x] `results-chart.spec.ts`: 8.1, 8.2, 8.5, 8.6, 8.7, 8.8
  - [x] `results-schedules.spec.ts`: 9.1-9.6
  - [x] `results-location-data.spec.ts`: 10.1-10.3, 10.5
  - [x] `warnings.spec.ts`: all 12 warning codes, each backed by its real trigger condition (some assertions live in the focused chart/data-source/location-data specs)
- [x] **3. Remaining options coverage**
  - [x] `options-corridor.spec.ts`: 2.1-2.6
  - [x] `options-dates.spec.ts`: 3.1-3.7
  - [x] `options-advanced-thresholds.spec.ts`: 5.1-5.10
  - [x] `options-presets.spec.ts`: 6.1-6.3
- [x] **4. Data-source toggle completion**
  - [x] Extend `data-source-toggle.spec.ts` with 7.2 and 7.3 (Aggregated with zero rows → NoLocationVolumeData)
- [x] **5. CI wiring**
  - [x] Add seed step to CI workflow in order: stack up → admin seed → TOD fixture seed → `npm run test:e2e`
  - [x] Confirm `PLAYWRIGHT_BASE_URL`/`PLAYWRIGHT_ADMIN_EMAIL`/`PLAYWRIGHT_ADMIN_PASSWORD` set for CI vs. local `.env` fallback

Implementation note: scenarios that the UI intentionally prevents constructing (such as
literal duplicate dates) are exercised through the authenticated browser request context.
Canvas-marker selection and URL/default race resolution remain covered by their deterministic
component/reducer tests; the real-stack suite covers chart rendering, mode/detail synchronization,
layer toggling, and URL hydration/write-back without relying on ECharts canvas coordinates.

## Details

Prioritized follow-up to `docs/time-of-day-playwright-test-plan-20261020.md`, based on
review of the `time-of-day-testing` branch as of 2026-10-20. Ordered by dependency —
each later step assumes the seed harness from step 1 exists, since nearly every
remaining scenario in the plan needs real seeded volume/event data rather than an
unresolvable location identifier.

## 1. Deterministic PostgreSQL seed harness (blocks everything else below)

This is the critical path. Build it before any more spec files, since steps 2-6 all
consume it.

- Pick the mechanism: raw SQL script vs. a small seeding console utility. Recommend a
  script invoked once per test run (not per-spec) that is idempotent (safe to re-run
  against an already-seeded DB — upsert or delete-then-insert by the fixed scenario
  location identifiers).
- Seed rows needed per scenario in `e2e/fixtures/seedData.ts`:
  - `Location`/`Approach`/`Detector` rows in the config DB for each of
    `E2E-COMMUTE-01`, `E2E-FREE-FALLBACK-01`, `E2E-SPLIT-PRESSURE-01`, and the three
    `E2E-MULTI-LOCATION-MEDIAN-01-{A,B,C}` locations.
  - `IndianaEvent` rows (vehicle-detector-on events) and/or `DetectorEventCountAggregation`
    rows (for the Aggregated-source scenarios) matching the exact volume curves already
    proven in the xUnit suite — reuse these numbers verbatim so expected values in specs
    can cite the source test by name:
    - `E2E-COMMUTE-01`: 450-500 vph 06:00-08:30, 650-700 vph 15:00-18:00, 100 vph
      otherwise (from `TimeOfDayRecommendationServiceTests`) → expect plan "1"
      06:00-08:45, plan "13" 15:00-18:15 at default thresholds.
    - `E2E-FREE-FALLBACK-01`: evening volume that never drops below the FREE threshold
      → expect FREE start = 23:30 fallback.
    - `E2E-SPLIT-PRESSURE-01`: needs both a dominant primary-axis volume and a
      cross-axis volume that crosses the 35%/45% review thresholds at a known bin, plus
      at least one very-low-volume bin to verify the suppression floor
      (`max(300, dayMaxTotal*0.15)`) does NOT report a spurious high percentage.
    - `E2E-MULTI-LOCATION-MEDIAN-01-{A,B,C}`: Eastbound counts 25/75/225 vph at the same
      bin across the three locations (from `TimeOfDayServiceProfileTests`) → expect
      corridor profile = median = 75, not mean (200).
  - `CoordPatternChange` controller events for current-schedule scenarios (§9 in the
    plan): at least one location with a clean consistent plan signature, one with a
    divergent signature (exception), and one with zero plan events (unavailable, not a
    false exception).
- Decide how this runs: a `globalSetup` in `playwright.config.ts` (simplest, but couples
  Playwright to DB access) vs. a separate `npm run` script that CI/dev runs before
  `test:e2e`. Recommend the latter — keep Playwright itself DB-agnostic and just assert
  against a stack that's already seeded, matching how `docker-compose` already seeds the
  admin user.
- Document the exact command in `Atspm/WebUI/e2e/README.md` (new file) so a human or CI
  job can reproduce it without re-deriving this plan.

## 2. Calculation-heavy result/warning scenarios (plan §8-11)

Once step 1 exists, convert these plan rows directly into specs — they were explicitly
written to cite real backend logic, so no new design work should be needed:

- `results-chart.spec.ts`: 8.1, 8.2, 8.5 (no-usable-volume), 8.6 (lunch-spike peak
  immunity), 8.7 (cross-traffic suppression floor), 8.8 (missing/partial plan banner).
- `results-schedules.spec.ts`: 9.1-9.5 (common schedule / exception / unavailable
  grouping), 9.6 (regex-special-character location identifier regression).
- `results-location-data.spec.ts`: 10.1-10.3 (data quality flags), 10.5 (occupancy %
  arithmetic check against the seeded capacity/volume numbers).
- `warnings.spec.ts`: one assertion per warning code, each backed by the specific seeded
  condition that triggers it (not just string presence) — `MissingLocationConfiguration`,
  `DuplicateSelectedDates`, `PartialPlanData`, `MissingPlanData`, `NoVehicleDetectors`,
  `NoTurningMovementDetectors`, `AggregatedMovementDetailLimited`, `NoLocationVolumeData`,
  `PartialLocationData`, `CapacityVariesByDate`, `PrimaryDirectionDataUnavailable`,
  `NoUsableVolumeData`.

## 3. Remaining options coverage (plan §2, §3, §5, §6)

Lower priority than §2 above since these are more UI-mechanics than math-correctness,
but still use the seeded multi-location/commute scenarios:

- `options-corridor.spec.ts`: 2.1-2.5 (pure UI, no seed needed) and 2.6 (median
  assertion, needs the multi-location seed from step 1).
- `options-dates.spec.ts`: 3.1-3.6 (pure UI/calendar shading) and 3.7 (duplicate-dates
  warning, needs seed).
- `options-advanced-thresholds.spec.ts`: 5.1-5.6 and 5.8 need the commute/split-pressure
  seeds to observe monotonic threshold effects; 5.7, 5.9, 5.10 need capacity/lane-count
  seed variants (5.10 specifically needs a location whose lane config changes between
  two seeded dates — flag this as a seed-harness addition, not yet listed in step 1).
- `options-presets.spec.ts`: 6.1-6.3, pure UI, no seed dependency — can be done any time.

## 4. Data-source toggle completion (plan §7.2-7.3)

Extend the existing `data-source-toggle.spec.ts` (currently only covers 7.1) once
`E2E-COMMUTE-01`-equivalent Aggregated-source rows exist, plus a location with zero
aggregation rows to confirm the `NoLocationVolumeData`/`NoData` fallback.

## 5. CI wiring

- Add the seed step and the docker-compose stack startup to whatever CI workflow will
  run `test:e2e`, in the correct order: stack up → migrations/admin seed (already
  exists) → TOD fixture seed (new, step 1) → `npm run test:e2e`.
- Confirm `PLAYWRIGHT_BASE_URL`/`PLAYWRIGHT_ADMIN_EMAIL`/`PLAYWRIGHT_ADMIN_PASSWORD` are
  set appropriately for the CI environment vs. local `.env` fallback already coded in
  `auth.setup.ts`.

## Explicitly not next

- Visual/pixel regression of the ECharts canvas — out of scope per the original plan.
- Re-deriving TOD math independently of the xUnit suite's proven numbers — reuse them.
