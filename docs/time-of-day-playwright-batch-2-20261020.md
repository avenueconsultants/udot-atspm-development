# Time of Day Playwright Suite — Batch 2 (Chart Tab + Remaining Warnings)

Follow-up to `docs/time-of-day-playwright-next-steps-20261020.md` checklist item 2.
Seed harness (item 1) is done. This batch is the highest-value remaining work: it's
where actual calculation correctness gets proven, not just options-UI mechanics.

Scope: `results-chart.spec.ts` (plan §8) and the remaining warning codes (plan §11),
reusing already-seeded fixtures wherever possible to avoid growing the seed harness
more than necessary.

## 1. Two new seed fixtures needed

Add these to `e2e/seed/Program.cs` alongside the existing scenarios, and the matching
identifiers to `e2e/fixtures/seedData.ts`:

- **`E2ETODZ01`** ("E2E zero volume") — one location, one NB approach, one V-lane
  detector, but **skip `AddAggregations`/`AddPlanEvents` for it entirely** (zero rows
  for the selected date). This is the one location in its own request, so it exercises:
  - `NoLocationVolumeData` (detectors exist, zero observations)
  - `NoUsableVolumeData` at the corridor level (it's the only location)
  - Chart tab "No Data Available" alert (plan 8.5)
- **`E2ETODL01`** ("E2E lunch spike") — reuse the commute-curve shape but add a large
  midday spike, e.g.:
  ```csharp
  static int LunchSpikeVolume(int minutes) => minutes switch
  {
      >= 6 * 60 and < 8 * 60 + 30 => 475,      // real AM commute
      >= 11 * 60 and < 13 * 60 => 5000,         // lunch spike — must not win
      >= 15 * 60 and < 18 * 60 => 675,          // real PM commute
      _ => 100,
  };
  ```
  This directly mirrors the xUnit lunch-surge test cited in the original plan (§8.6) —
  assert `amPeakTime`/`pmPeakTime` in the chart summary land on the 06:00-08:30 / 15:00-18:00
  windows, not 11:00-13:00.

Everything else below reuses scenarios that already exist: `E2ETODC01` (commute),
`E2ETODS01` (split pressure, already has a sub-floor bin at minute 720), `E2ETODM01C`
(zero plan events), `E2ETODV01` (capacity varies by date).

## 2. `results-chart.spec.ts` — new file

| Plan # | Scenario | Setup | Assertion |
|---|---|---|---|
| 8.1 | Chart renders with usable data | `E2ETODC01`, one date | Chart tab visible, no "No Data Available" alert |
| 8.2 | Analysis mode toggle | `E2ETODC01` | Switching Recommendation → Split Pressure changes chart content and the sidebar detail tab in sync |
| 8.5 | No usable volume anywhere | `E2ETODZ01` alone | Chart tab shows "No Data Available"; `recommendation`/`planProfile`/`splitPressure` stay empty in the response, not an error |
| 8.6 | Lunch-spike peak immunity | `E2ETODL01` | `AmPeakTime` falls in 06:00-08:30 and `PmPeakTime` falls in 15:00-18:00 — assert via the chart summary header or the raw response body, not the lunch window |
| 8.7 | Cross-traffic suppression floor | `E2ETODS01`, Split Pressure mode | The bin at minute 720 (12:00, where primary=1/cross=1, total=2 — far below the `max(300, dayMax*0.15)` floor) shows no cross-traffic percentage for that bin (null/absent), not a misleading ~50-100% |
| 8.8 | Missing/partial plan coverage banner | `E2ETODM01C` + `E2ETODC01` together (same two locations already used in the schedules spec) | Banner above the results tabs reads "Existing plan coverage needs review." |

Use `page.waitForResponse` + `.json()` where you need to inspect `amPeakTime`/
`pmPeakTime`/`splitPressure.crossTrafficShare` directly rather than parsing ECharts
canvas internals — the plan's "out of scope" note already rules out pixel-level
chart assertions.

## 3. `warnings.spec.ts` — new file, remaining 9 of 12 codes

Already covered elsewhere (don't duplicate, just confirm cross-reference):
`CapacityVariesByDate` (results-location-data.spec.ts), `AggregatedMovementDetailLimited`
(data-source-toggle.spec.ts), and implicitly `MissingPlanData`/exception grouping
(results-schedules.spec.ts).

Remaining, in order of how directly they reuse existing fixtures:

1. **`DuplicateSelectedDates`** — no new seed. Request `E2ETODC01` with
   `dates=2026-01-05,2026-01-05` (literal duplicate in the URL param). Assert the
   warning appears and the server only counted the date once (cross-check against a
   single-date request's peak values matching).
2. **`PrimaryDirectionDataUnavailable`** — no new seed. Request `E2ETODC01` (only has
   NB/SB approaches) with `amPrimaryDirections=Eastbound`. Assert the corridor-wide
   warning banner appears (distinct from the per-location `AmDirectionExceptionMessage`
   already implicitly exercised in `options-directions.spec.ts`, which only checks the
   outgoing request, not this response-side warning).
3. **`NoUsableVolumeData`** — covered by `E2ETODZ01` above (8.5); just add the explicit
   warning-code assertion to that same test rather than a separate one.
4. **`NoLocationVolumeData`** — covered by `E2ETODZ01` above; same note.
5. **`MissingPlanData`** — reuse `E2ETODM01C` (already has zero `CoordPatternChange`
   events). Request it alone and assert the warning code directly (the schedules spec
   only asserts the UI grouping, not the warning object itself).
6. **`PartialLocationData`** — no new seed. Request `E2ETODC01` across two dates where
   only one has seeded aggregation rows (e.g. `2026-01-05,2026-01-06` — confirm with
   the seed script whether Jan 6 rows exist for this id; if not, this already works as-is).
   Assert `DataQualityFlag = "Partial"` for that location alongside the warning.
7. **`MissingLocationConfiguration`** — needs one new, deliberately-dated request: pick
   a selected date earlier than every seeded location's `Start` (`2020-01-01` for most
   fixtures) — e.g. request `E2ETODC01` with a date in 2019. Confirm this is reachable
   through the UI calendar (it may be outside the default-rendered month range; may need
   to type the date or navigate months) before committing to this approach.
8. **`PartialPlanData`** — needs one new, small seed tweak: add a scenario (or reuse
   `E2ETODC01` with an extra variant) whose first `CoordPatternChange` event on the
   selected date is *after* midnight, with no event in the prior padding window either
   — i.e. omit the `(0, 7)` event that every current `AddPlanEvents` call includes.
   Recommend a 4th `AddPlanEvents` call for a dedicated id rather than mutating
   `E2ETODC01` (other specs depend on its current plan signature for the "exception"
   grouping in `results-schedules.spec.ts`).
9. **`NoVehicleDetectors` / `NoTurningMovementDetectors`** — lowest priority, highest
   uncertainty. These require a detector that doesn't qualify as a usable vehicle/TMC
   detector per `TimeOfDayObservationService` (`Atspm/Application/Business/TimeOfDay/`).
   **Before seeding, re-read that service's exact detector-eligibility predicate** (lane
   type / movement type / metric-type-5 support) rather than guessing — getting this
   wrong produces a seed that silently falls back to a different warning code instead of
   the one intended. Flag back to the plan author (me) if the predicate is ambiguous
   from the code alone; this is exactly the kind of thing worth a quick confirmation
   question rather than a guessed fixture.

## Suggested order

1. Add `E2ETODZ01` + `E2ETODL01` to the seed script (small, mechanical).
2. `results-chart.spec.ts` 8.1, 8.2, 8.5, 8.6, 8.8 (no new seeds beyond step 1).
3. `warnings.spec.ts` items 1-6 above (no new seeds).
4. `results-chart.spec.ts` 8.7 (reuses existing `E2ETODS01`).
5. `warnings.spec.ts` item 7 (`MissingLocationConfiguration`) and item 8
   (`PartialPlanData`) — small seed additions.
6. `NoVehicleDetectors`/`NoTurningMovementDetectors` last, after confirming the exact
   trigger predicate.

Update the checklist in `docs/time-of-day-playwright-next-steps-20261020.md` as each
item lands, same as the last two increments.
