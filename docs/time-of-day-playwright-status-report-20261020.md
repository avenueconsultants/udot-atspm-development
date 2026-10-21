# Time-of-Day Automated Testing — Completion Report

**Completed:** October 21, 2026

**Branch:** `time-of-day-testing`

**Status:** Complete and passing

## Executive summary

The Time-of-Day feature now has a full browser-level regression suite backed by the
real application stack and deterministic PostgreSQL fixtures. The suite verifies the
user workflow, calculation results, schedules, warnings, URL state, and supporting
location data rather than relying on mocked responses or randomized test data.

The completed suite contains 64 Playwright tests across 13 files. All tests pass
locally against the Docker-hosted APIs, web application, authentication service, and
PostgreSQL databases. A GitHub Actions workflow was also added so the same stack can
be built, seeded, tested, and diagnosed automatically in pull requests.

## Delivered coverage

- Required-field validation and authenticated navigation.
- Corridor selection, ordering, deletion, clearing, and median-across-location math.
- Date availability, range grouping, deletion, clearing, and duplicate-date handling.
- AM/PM and all-day primary-direction derivation and unavailable-direction behavior.
- Every roadway preset and advanced threshold, including AM/PM boundaries, FREE
  fallback, capacity, occupancy, lane overrides, and split-pressure review thresholds.
- Indiana Events and Aggregated data-source behavior, including no-data degradation.
- Chart rendering, mode/detail synchronization, layer controls, commute peaks,
  lunch-spike immunity, low-volume cross-traffic suppression, and plan-coverage banners.
- Common, exception, unavailable, empty-recommendation, and absent-current schedules.
- Location-data quality, capacity/occupancy arithmetic, partial/no data, and lane
  configuration changes within the requested date range.
- All 12 backend warning codes using their real trigger conditions.
- URL hydration, unresolved locations, sorted/deduplicated write-back, and replace
  semantics.

## Deterministic test infrastructure

The test harness seeds 14 purpose-built signal locations. It is idempotent and uses
the production Entity Framework models, real report services, and real PostgreSQL
databases. Seeded values are based on known-good unit-test fixtures so numeric browser
assertions remain traceable to established calculation oracles.

The workflow order is:

1. Build and start PostgreSQL and the application services.
2. Apply migrations and seed the administrator.
3. Wait for the web application and APIs to become available.
4. Seed deterministic Time-of-Day fixtures.
5. Run the Playwright suite and retain the report on failure.

## Production issues found and corrected

The work found several issues that would not have been exposed by mocked browser tests:

- Historical location lookup did not order applicable versions by start date. It could
  return an older configuration when multiple versions existed. The lookup now
  deterministically selects the newest version effective on the requested date. This
  repository method is shared by many reports, so the correction benefits more than
  Time-of-Day.
- Occupancy was displayed as zero when no observations existed. It is now represented
  as unavailable instead of implying a measured zero.
- A location with schedule data but no usable observations could render an empty chart.
  The UI now presents a clear no-data state.
- Corridor reordering is now operable from the keyboard as well as by pointer drag.
- Administrator seeding is idempotent and repairs required profile/role state for a
  pre-existing local administrator.

## Verification results

| Verification | Result |
| --- | ---: |
| Playwright real-stack suite | 64/64 passed |
| Application Time-of-Day tests | 37/37 passed |
| Report API Time-of-Day tests | 28/28 passed |
| Focused frontend unit tests | 16/16 passed |
| ESLint | Passed |
| Git whitespace validation | Passed |

The build continues to report pre-existing compiler and dependency warnings, including
the repository's existing package-audit findings. These did not cause test failures and
were outside the scope of this testing project.

## Outcome

The planned Time-of-Day automated testing work is complete. The branch is ready for
normal code review and pull-request validation. No changes have been merged into
`main` as part of this work.
