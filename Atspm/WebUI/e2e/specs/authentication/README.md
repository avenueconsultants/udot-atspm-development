# authentication-permissions-testing

Base: `time-of-day-testing` (48760b91). This branch contains 14 feature tests, plus the inherited Time-of-Day suite and shared authentication setup.

## Run

Follow [the shared setup guide](../../FEATURE-TESTING.md) to start and seed the dedicated stack. From `Atspm/WebUI`:

```powershell
npm run test:e2e:seed
npx playwright test e2e/specs/authentication
npm run test:e2e:typecheck:features
```

Use `npm run test:e2e:seeded` to run all tests present on this branch. Chromium, HTTPS URL, worker limits, retries, and diagnostic artifacts retain the Time-of-Day configuration.

## Coverage

- validates empty credentials before contacting IdentityApi
- rejects invalid email formatting
- redirects anonymous navigation from /admin/locations to login
- redirects anonymous navigation from /watchdog to login
- redirects anonymous navigation from /left-turn-gap-report to login
- rejects an unauthenticated profile API request
- rejects a malformed bearer token at the API
- authenticates the seeded account and retrieves its own profile
- denies unprivileged navigation to /admin/locations
- denies unprivileged navigation to /watchdog
- denies unprivileged navigation to /left-turn-gap-report
- denies privileged API access even when the UI claims cookie says Admin
- logout clears browser credentials and closes privileged navigation
- allows the authenticated administrator to read roles and location administration

## Scope and validation

Uses the original administrator setup and a separate real unprivileged identity. Also verifies server-side role protection after changing the browser claims cookie; this is not a complete authorization audit of every endpoint.

The combined original and feature suites passed 135/135 checks locally on October 29, 2026, including all 71 new feature checks. New feature tests also passed their isolated TypeScript check and ESLint. Repository-wide TypeScript errors are documented in the shared guide. GitHub Actions execution has not been observed in this session.
