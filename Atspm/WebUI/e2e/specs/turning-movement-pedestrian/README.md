# turning-movement-pedestrian-testing

Base: `time-of-day-testing` (48760b91). This branch contains 5 feature tests, plus the inherited Time-of-Day suite and shared authentication setup.

## Run

Follow [the shared setup guide](../../FEATURE-TESTING.md) to start and seed the dedicated stack. From `Atspm/WebUI`:

```powershell
npm run test:e2e:seed
npx playwright test e2e/specs/turning-movement-pedestrian
npm run test:e2e:typecheck:features
```

Use `npm run test:e2e:seeded` to run all tests present on this branch. Chromium, HTTPS URL, worker limits, retries, and diagnostic artifacts retain the Time-of-Day configuration.

## Coverage

- turning counts preserve three movements and the independent hourly total
- five-minute and fifteen-minute bins preserve total counts and peak-hour factor
- downloads actual CSV results containing the known volume
- pedestrian delay reflects sixty calls five seconds before walk
- pedestrian options are submitted independently of turning counts

## Scope and validation

Checks independent 360-vehicle totals, bin-size invariance, actual CSV contents, and five-second pedestrian delay. The seed separates through and left movements rather than deriving expectations from returned chart data.

The combined original and feature suites passed 135/135 checks locally on October 29, 2026, including all 71 new feature checks. New feature tests also passed their isolated TypeScript check and ESLint. Repository-wide TypeScript errors are documented in the shared guide. GitHub Actions execution has not been observed in this session.
