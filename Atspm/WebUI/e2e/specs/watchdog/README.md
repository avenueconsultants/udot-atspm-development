# watchdog-testing

Base: `time-of-day-testing` (48760b91). This branch contains 6 feature tests, plus the inherited Time-of-Day suite and shared authentication setup.

## Run

Follow [the shared setup guide](../../FEATURE-TESTING.md) to start and seed the dedicated stack. From `Atspm/WebUI`:

```powershell
npm run test:e2e:seed
npx playwright test e2e/specs/watchdog
npm run test:e2e:typecheck:features
```

Use `npm run test:e2e:seeded` to run all tests present on this branch. Chromium, HTTPS URL, worker limits, retries, and diagnostic artifacts retain the Time-of-Day configuration.

## Coverage

- returns the exact seeded log and renders its details
- keeps location filters isolated from other fixture logs
- displays an empty state for a configured location without logs
- filters by issue type using the actual report API
- navigates between log, summary, and ignored-event views
- persists and displays an ignored event without changing another location

## Scope and validation

Seeds deterministic log rows. Ignore persistence uses the actual ConfigApi, a dedicated editing fixture, and guaranteed cleanup. The background scanning daemon and email delivery are not started by these browser tests.

The combined original and feature suites passed 135/135 checks locally on October 29, 2026, including all 71 new feature checks. New feature tests also passed their isolated TypeScript check and ESLint. Repository-wide TypeScript errors are documented in the shared guide. GitHub Actions execution has not been observed in this session.
