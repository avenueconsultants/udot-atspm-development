# performance-measures-testing

Base: `time-of-day-testing` (48760b91). This branch contains 7 feature tests, plus the inherited Time-of-Day suite and shared authentication setup.

## Run

Follow [the shared setup guide](../../FEATURE-TESTING.md) to start and seed the dedicated stack. From `Atspm/WebUI`:

```powershell
npm run test:e2e:seed
npx playwright test e2e/specs/performance-measures
npm run test:e2e:typecheck:features
```

Use `npm run test:e2e:seeded` to run all tests present on this branch. Chromium, HTTPS URL, worker limits, retries, and diagnostic artifacts retain the Time-of-Day configuration.

## Coverage

- requires a location without calling a report endpoint
- selects a seeded location and loads eligible measures
- hydrates URL inputs without automatically generating a report
- sends the selected location, time range, and edited options
- writes generated state to the URL and restores it on reload
- loads location configuration through the Configuration tab
- reports an API failure and allows a successful retry

## Scope and validation

Includes deliberate HTTP 503 injection to exercise error display and retry. All successful reports use the real report API.

The combined original and feature suites passed 135/135 checks locally on October 29, 2026, including all 71 new feature checks. New feature tests also passed their isolated TypeScript check and ESLint. Repository-wide TypeScript errors are documented in the shared guide. GitHub Actions execution has not been observed in this session.
