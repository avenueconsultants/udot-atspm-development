# Feature browser regression suites

The feature testing branches extend `time-of-day-testing`. They retain the same
Chromium project, administrator setup dependency, HTTPS base URL, worker limits,
CI retries, and failure screenshots/video/traces from `playwright.config.ts`.
Successful analysis tests use the actual Config, Data, Report, and Identity APIs.
Only explicit failure-injection tests intercept a response.

## Run locally

Start the Docker stack from `Atspm`:

```powershell
docker compose up -d --build postgres database-installer configapi dataapi reportapi identityapi webui nginx
```

Then, from `Atspm/WebUI`:

```powershell
npm ci
npx playwright install chromium
npm run test:e2e:seeded
npm run test:e2e:report
```

`test:e2e:seed` runs both the existing Time-of-Day seeder and the feature seeder.
Run against a dedicated test stack: the seeders replace their named fixture data.
The browser APIs and seed connection strings must refer to the same databases.
Pointing WebUI at hosted APIs does not seed their databases.

The base URL defaults to `https://localhost:3443`; override with
`PLAYWRIGHT_BASE_URL`. Administrator credentials follow the existing
`PLAYWRIGHT_ADMIN_EMAIL` / `PLAYWRIGHT_ADMIN_PASSWORD` overrides and `Atspm/.env`
fallback. Database connections use the same `TOD_E2E_CONFIG_CONNECTION`,
`TOD_E2E_EVENTLOG_CONNECTION`, and `TOD_E2E_AGGREGATION_CONNECTION` overrides,
plus `TOD_E2E_IDENTITY_CONNECTION` for the unprivileged test account. Compose
PostgreSQL is exposed on port 5433, matching the original seeder.

## Deterministic fixtures

`fixtures/featureData.ts` is the browser-side contract with
`stack-seed/Program.cs`. The locations are `E2ECORE01`, `E2ECORE02`,
`E2EEMPTY01`, and `E2EADMIN01`; each identifier is at most ten characters.
The first two form `E2E feature regression corridor`. `E2EADMIN01` is reserved
for editing tests so calculations do not depend on mutable configuration.

On January 5, 2026, from 08:00 to 09:00, the populated locations contain:

- Phase 2 and phase 6, each with sixty one-minute cycles.
- Green from second 0 to 30, yellow from 30 to 33, and red thereafter.
- Detector channels 1 (NB through), 2 (SB through), and 3 (NB left).
- Two activations per detector per minute: second 15 and second 45.
- Therefore 30 activations per quarter, 120 per detector per hour, and 360 total.
- Matching quarter-hour detector-count aggregation rows.
- Pedestrian calls five seconds before walk begins.
- A fixed Watchdog record-count log for each populated location.

`E2EEMPTY01` has configuration and no event/aggregation observations. The seeder
also creates `e2e-reader@example.invalid` with no privileged roles for permission
tests. This is an explicit test fixture, not a production account.

## Adding another tool

Use `test.describe`, separate behavior-focused `test` cases, fixed fixture values,
and page objects as in the Time-of-Day suite. Register request/response waits before
clicking Generate. Assert an independently known outcome, not merely status 200.
Keep numeric assertions on real responses; use roles/labels for controls and test
IDs only where semantic selectors are insufficient. Avoid canvas coordinates,
random production locations, fixed sleeps, and response mocks for successful paths.

Put feature specs under `e2e/specs/<feature>/` and keep feature page objects under
`e2e/page-objects/`. Every feature branch includes the common fixture commit and
can run independently. The existing workflow runs all specs present on that branch.
