# core-performance-measures-testing

Base: `time-of-day-testing` (48760b91). This branch contains 6 feature tests, plus the inherited Time-of-Day suite and shared authentication setup.

## Run

Follow [the shared setup guide](../../FEATURE-TESTING.md) to start and seed the dedicated stack. From `Atspm/WebUI`:

```powershell
npm run test:e2e:seed
npx playwright test e2e/specs/core-measures
npm run test:e2e:typecheck:features
```

Use `npm run test:e2e:seeded` to run all tests present on this branch. Chromium, HTTPS URL, worker limits, retries, and diagnostic artifacts retain the Time-of-Day configuration.

## Coverage

- Purdue Coordination counts one green and one red arrival per cycle
- Phase Termination preserves sixty gap outs for both phases
- Split Failures reports no failure for brief detector occupancy
- Split Monitor distinguishes gap outs from max outs and force offs
- Approach Volume preserves lane count totals and directional sums
- changing coordination bin size preserves total detector hits

## Scope and validation

Coordination assertions use 59 complete red-to-red cycles within the fixed hour (118 detector hits and 59 green arrivals). Raw detector and turning totals are 120 per detector; boundary arrivals intentionally fall outside complete coordination cycles.

The combined original and feature suites passed 135/135 checks locally on October 29, 2026, including all 71 new feature checks. New feature tests also passed their isolated TypeScript check and ESLint. Repository-wide TypeScript errors are documented in the shared guide. GitHub Actions execution has not been observed in this session.
