# Time-of-Day Playwright tests

The end-to-end suite expects the local Docker Compose stack to be running with the
suite-specific environment file (this avoids changing the repository's general local
configuration):

```powershell
cd Atspm
docker compose --env-file WebUI/e2e/docker.env `
  -f docker-compose.yml -f WebUI/e2e/docker-compose.local.yml up -d --build
cd WebUI
$env:TOD_E2E_POSTGRES_PORT = '5433'
npm run test:e2e:seeded
```

The local override keeps this suite on host port 5433 without changing the base Compose
file. To seed and run against an already-started stack on another port, set
`TOD_E2E_POSTGRES_PORT` to that port first:

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
Compose hostname to `localhost:5432`. CI can override the port with
`TOD_E2E_POSTGRES_PORT` and each connection with
`TOD_E2E_CONFIG_CONNECTION`, `TOD_E2E_EVENTLOG_CONNECTION`, and
`TOD_E2E_AGGREGATION_CONNECTION`.

The GitHub Actions workflow `.github/workflows/time-of-day-e2e.yml` starts the full
Compose stack with `e2e/docker.env`, generates disposable CI-only certificates, waits
for the APIs, seeds the administrator and deterministic TOD fixtures, and then runs
Playwright. Its `PLAYWRIGHT_*` values intentionally match the E2E defaults; deployments
should override them with environment secrets when those defaults differ.
