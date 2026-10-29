# left-turn-gap-report-testing

Base: `time-of-day-testing` (48760b91). This branch contains 7 feature tests, plus the inherited Time-of-Day suite and shared authentication setup.

## Run

Follow [the shared setup guide](../../FEATURE-TESTING.md) to start and seed the dedicated stack. From `Atspm/WebUI`:

```powershell
npm run test:e2e:seed
npx playwright test e2e/specs/left-turn-gap-report
npm run test:e2e:typecheck:features
```

Use `npm run test:e2e:seeded` to run all tests present on this branch. Chromium, HTTPS URL, worker limits, retries, and diagnostic artifacts retain the Time-of-Day configuration.

## Coverage

- requires eligible approaches and a completed data check
- selects only approaches with left-turn detectors
- submits default thresholds and displays real aggregation gaps
- rechecks with edited data-quality thresholds
- changing the location invalidates the completed data check
- removing all approaches blocks both actions
- requires at least one selected analysis after the data check

## Scope and validation

Checks real eligibility responses and missing-aggregation flags, edited quality thresholds, and report gating. This branch also declares the three threshold inputs as numeric so valid edits no longer serialize as null. Complete study-result arithmetic needs additional phase/gap aggregation fixtures.

The combined original and feature suites passed 135/135 checks locally on October 29, 2026, including all 71 new feature checks. New feature tests also passed their isolated TypeScript check and ESLint. Repository-wide TypeScript errors are documented in the shared guide. GitHub Actions execution has not been observed in this session.
