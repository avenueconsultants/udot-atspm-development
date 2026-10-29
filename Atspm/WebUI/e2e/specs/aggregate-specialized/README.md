# aggregate-specialized-tools-testing

Base: `time-of-day-testing` (48760b91). This branch contains 10 feature tests, plus the inherited Time-of-Day suite and shared authentication setup.

## Run

Follow [the shared setup guide](../../FEATURE-TESTING.md) to start and seed the dedicated stack. From `Atspm/WebUI`:

```powershell
npm run test:e2e:seed
npx playwright test e2e/specs/aggregate-specialized
npm run test:e2e:typecheck:features
```

Use `npm run test:e2e:seeded` to run all tests present on this branch. Chromium, HTTPS URL, worker limits, retries, and diagnostic artifacts retain the Time-of-Day configuration.

## Coverage

- requires a selected location before analysis
- expands the seeded route into selected locations
- aggregates known detector counts through the actual report endpoint
- edits aggregation mode and bin size without submitting automatically
- Priority Summary counts the two seeded requests and their distinct treatments
- Preemption Details reports the single seeded request and service
- Ramp Metering maps flow, encoded occupancy, and speed units
- changes the data source and marks the request pending until Update
- edits day classification and analysis period independently
- opens Map and Reports without requiring a selected segment

## Scope and validation

Checks real aggregate totals, priority requests, preemption, ramp flow/occupancy/speed conversions, and Speed Management source/day/period controls. Speed Management result arithmetic requires its separately hosted Speed API and fixtures; these tests do not mock that service or claim numeric speed-map coverage.

The combined original and feature suites passed 135/135 checks locally on October 29, 2026, including all 71 new feature checks. New feature tests also passed their isolated TypeScript check and ESLint. Repository-wide TypeScript errors are documented in the shared guide. GitHub Actions execution has not been observed in this session.
