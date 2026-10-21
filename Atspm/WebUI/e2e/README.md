# Time-of-Day Playwright tests

The end-to-end suite expects the local Docker Compose stack to be running. Seed the
deterministic PostgreSQL fixtures and run the suite with:

```powershell
cd Atspm/WebUI
npm run test:e2e:seeded
```

Run `npm run test:e2e:seed` whenever the databases are recreated. The command is
idempotent: it deletes and rebuilds only the locations whose identifiers start with
the fixed `E2ETOD` fixture names.

The production schema limits location identifiers to 10 characters. The readable
scenario keys in `fixtures/seedData.ts` therefore map to compact database IDs:

| Scenario | Database identifier |
| --- | --- |
| Commute curve | `E2ETODC01` |
| FREE fallback | `E2ETODF01` |
| Split pressure | `E2ETODS01` |
| Capacity changes | `E2ETODV01` |
| No aggregation data | `E2ETODN01` |
| Zero usable volume | `E2ETODZ01` |
| Lunch spike | `E2ETODL01` |
| Partial plan coverage | `E2ETODP01` |
| No vehicle detectors | `E2ETODX01` |
| No turning-movement detector eligibility | `E2ETODT01` |
| Regex-special-character identifier | `E2E(TOD01` |
| Multi-location median | `E2ETODM01A` through `E2ETODM01C` |

By default the seeder reads the tracked local defaults from `Atspm/.env` and maps the
Compose hostname/port to `localhost:5433`. CI can override each connection with
`TOD_E2E_CONFIG_CONNECTION`, `TOD_E2E_EVENTLOG_CONNECTION`, and
`TOD_E2E_AGGREGATION_CONNECTION`.

The GitHub Actions workflow `.github/workflows/time-of-day-e2e.yml` starts the full
Compose stack, waits for the login page, seeds the administrator and deterministic TOD
fixtures, and then runs Playwright. Its `PLAYWRIGHT_*` values intentionally match the
tracked local development defaults; deployments should override them with environment
secrets when those defaults differ.
