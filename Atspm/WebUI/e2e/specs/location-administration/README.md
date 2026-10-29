# location-administration-testing

Base: `time-of-day-testing` (48760b91). This branch contains 6 feature tests, plus the inherited Time-of-Day suite and shared authentication setup.

## Run

Follow [the shared setup guide](../../FEATURE-TESTING.md) to start and seed the dedicated stack. From `Atspm/WebUI`:

```powershell
npm run test:e2e:seed
npx playwright test e2e/specs/location-administration
npm run test:e2e:typecheck:features
```

Use `npm run test:e2e:seeded` to run all tests present on this branch. Chromium, HTTPS URL, worker limits, retries, and diagnostic artifacts retain the Time-of-Day configuration.

## Coverage

- loads the saved location, approaches, and detectors
- saves general information and persists it across a reload
- saves an approach with blank optional speed as null
- blocks saving an approach without a required phase number
- rejects duplicate location identifiers before creation
- requires an identifier of at most ten characters

## Scope and validation

Mutation tests run serially against E2EADMIN01 and restore edited fields after each case. This branch also normalizes blank optional approach speed to null before saving. Creation coverage checks required, duplicate, and overlength identifiers; it does not exercise the template wizard.

The combined original and feature suites passed 135/135 checks locally on October 29, 2026, including all 71 new feature checks. New feature tests also passed their isolated TypeScript check and ESLint. Repository-wide TypeScript errors are documented in the shared guide. GitHub Actions execution has not been observed in this session.
