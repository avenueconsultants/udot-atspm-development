# time-space-link-pivot-testing

Base: `time-of-day-testing` (48760b91). This branch contains 10 feature tests, plus the inherited Time-of-Day suite and shared authentication setup.

## Run

Follow [the shared setup guide](../../FEATURE-TESTING.md) to start and seed the dedicated stack. From `Atspm/WebUI`:

```powershell
npm run test:e2e:seed
npx playwright test e2e/specs/time-space-link-pivot
npm run test:e2e:typecheck:features
```

Use `npm run test:e2e:seeded` to run all tests present on this branch. Chromium, HTTPS URL, worker limits, retries, and diagnostic artifacts retain the Time-of-Day configuration.

## Coverage

- Historic requires a route without submitting analysis
- 50th Percentile also requires a route
- hydrates the seeded corridor and shows its configured location order
- generates real Historic data for the selected corridor and writes URL state
- preserves the selected route after URL reload
- generates 50th Percentile data with explicit dates, times, and coordinated phases
- Link Pivot blocks analysis without a route
- Link Pivot exposes editable cycle length, bias, and direction
- Link Pivot selects the same seeded corridor used by Time-Space
- Link Pivot analyzes known arrivals and preserves the edited cycle length

## Scope and validation

Includes successful Historic, 50th Percentile, and Link Pivot API analyses, configured phase sequences, corridor ordering, URL restoration, and known 50% arrivals on green. GPX/SRM uploads and canvas pixel comparisons are outside this suite.

The combined original and feature suites passed 135/135 checks locally on October 29, 2026, including all 71 new feature checks. New feature tests also passed their isolated TypeScript check and ESLint. Repository-wide TypeScript errors are documented in the shared guide. GitHub Actions execution has not been observed in this session.
