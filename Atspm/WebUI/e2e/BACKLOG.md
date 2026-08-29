# End-to-end test backlog

The Playwright suite in this folder is the pre-merge gate for the WebUI: unit
tests are the fast loop, this suite proves nothing is broken across real
pages, real generated hooks and stubbed APIs. This file is the ordered list
of what it should cover next, sized so an unattended run has more than a
full token allowance of work and still leaves items behind. It is also the
ledger: every finished task is ticked here with its commit, so a compaction
or a fresh session picks up exactly where the last one stopped.

## How a cycle runs

1. **Pick** the first unticked item in priority order (A before B before C
   before D). Skip an item that needs a decision from the user, leave a note
   under it, and move on.
2. **Reconnoitre** the page: which generated hooks it calls (`src/api/**`),
   the request bodies it builds, the enum conventions on each side (config
   OData entities carry member names such as `'NB'`; DTOs and the report API
   carry the integers), and what the page renders on success, empty and
   failure.
3. **Implement**: the spec, any shared fixtures (`e2e/support/*Fixtures.ts`
   for hand-built shapes, `src/test/fixtures` for recorded ones), and any app
   fix the spec exposes. Assert on the request the generated hook actually
   sent, not only on what the page showed.
4. **Gate**, in this order: Jest for the touched area, the new spec in dev
   mode, then `npm run build` and the full suite in CI mode
   (`CI=true E2E_WEB_SERVER_COMMAND="npm start" npx playwright test`), then
   `npm run typecheck:ratchet` (lower the baseline with `--update` if the
   count fell), `npx eslint e2e <touched files>`, `npx prettier --check e2e`.
5. **Review** the full diff and fix what it turns up (vacuous assertions,
   timezone- or locale-dependent values, duplicated helpers, comments that
   overclaim, app paths the change made reachable). Re-run the gate for
   anything touched.
6. **Commit** the app fix and the spec as separate commits. Commits after
   the review step are authorised for every cycle; never commit before the
   gate is green and the diff has been reviewed.
7. **Record** the result in the cycle log at the bottom, check the remaining
   allowance, and go back to 1. Stop when the allowance is nearly spent or
   when every remaining item is blocked on the user.

### Conventions the suite relies on

- `stubApiHosts` first (answers every API host with `[]`), then
  `stubEndpoint` for what the spec cares about; the returned request list is
  what to assert on. `signIn` for a session; `blockMapTiles` on any page with
  a map; `mockAppShell` always.
- OData collections come back in the envelope (`odataCollection`); keyed
  reads are the bare entity (`odataEntity`); report and identity responses
  are plain JSON.
- Dates: the app sends wall-clock literals (`yyyy-MM-ddTHH:mm:ss`) in the
  browser's zone. Compute expected values from the instant with local
  getters; never hard-code a date that depends on the runner's zone.
- Locators: prefer roles and labels; scope `getByRole('grid'|'row'|'table')`
  to the table you mean (pages often have several); MUI `Select` is a
  `combobox` beside a hidden input; DataGrid rows are `row`, dnd rows are
  `button`.
- Never import one spec from another; shared things live in `e2e/support`.

### Sizes

S ≈ one afternoon of assertions on an existing pattern; M ≈ a new page with
its own fixtures; L ≈ a new interaction model (file upload, drag, map) or a
page that needs an app fix first. Roughly 80K / 200K / 400K tokens.

## Done

- [x] Login, register validation, unauthorized, admin access, static pages
- [x] Performance measures — Approach Delay end to end (chart, empty, error,
      request window)
- [x] Admin areas CRUD; location editor (load, approach save enum round trip,
      watchdog ignore); route editor (direction options, numeric save,
      distance guard); watchdog page (report, ignore, flagged rows, ignored
      events tab, claim redirect)
- [x] Link pivot, aggregate charts, time-space historic (diagram, link pivot
      overlay, error, guards)

## A. Report tools and measures (highest migration risk)

Each performance measure has its own generated fetcher, response shape and
transformer; only Approach Delay is covered. One spec per measure, driven
through `/performance-measures?location=…&chartType=…`, with a fixture in the
API's shape, asserting the request options the measure's panel adds and that
the chart (or table) renders. Use the existing `performance-measures.spec.ts`
as the template.

- [x] **A1. Purdue Coordination Diagram** (M) — `PurdueCoordinationDiagram/getReportData`;
      plans + arrivals; bin size option in the request.
      `purdue-coordination-diagram.spec.ts`; measure defaults come from
      `e2e/support/measureFixtures.ts`. Finding for A20: option values are
      strings from MeasureOption, so a default bin size goes out as `"15"`
      while a picked one goes out as `60` - the report API accepts both.
- [x] **A2. Split Monitor** (M) — plans, phase tables (`PhaseTable`), percentile options.
      `split-monitor.spec.ts`; fixtures in `measureFixtures.ts` /
      `reportFixtures.ts`. Note for B7: the percentile default is stored as
      a string ('85') and a "None" default is stored as '0'.
- [x] **A3. Timing and Actuation** (L) — the largest option panel (detector
      channel toggles, phase filters); toolbox legend; request carries every
      toggle. `timing-and-actuation.spec.ts`. The option panel is currently
      "No options available" (the code is commented out), so the spec
      asserts the seeded toggles travel as defaults; revisit if the panel
      comes back.
- [ ] **A4. Turning Movement Counts** (M) — renders a table, not a chart;
      filters and totals; CSV toolbar.
- [ ] **A5. Purdue Phase Termination** (M) — consecutive-count option; plan strips.
- [ ] **A6. Approach Volume** (M) — table + chart (`ApproachVolumeTable`);
      direction pairing.
- [ ] **A7. Approach Speed** (S) — speed limit / bin options.
- [ ] **A8. Arrivals on Red** (S) — plans; percentage series.
- [ ] **A9. Green Time Utilization** (S) — bin option.
- [ ] **A10. Left Turn Gap Analysis** (M) — gap bands; option ranges.
- [ ] **A11. Pedestrian Delay** (S) — plans; delay series.
- [ ] **A12. Purdue Split Failure** (M) — first-seconds-of-red option; occupancy series.
- [ ] **A13. Preemption Details** (S) — event pairs.
- [ ] **A14. Priority Details / A15. Priority Summary** (M) — summary is a
      different chart family (`PrioritySummaryChart`); check the dispatcher
      entry the migration added.
- [ ] **A16. Wait Time** (S) — plans and phase series.
- [ ] **A17. Yellow and Red Actuations** (S) — severe violation option.
- [ ] **A18. Ramp Metering** (M) — ramp locations only (`hasRampDevice`),
      different option panel.
- [ ] **A19. Measure availability by location** (S) — a location whose
      `charts` lacks a measure clears the selection ("Please select a
      measure"); measure list comes from `/MeasureType` `showOnWebsite`.
- [ ] **A20. Measure defaults and presets** (M) — `/MeasureOption` defaults
      fill the option panel; `/MeasureType/{key}/MeasureOptionPresets`
      applies a preset; the request carries the preset values.
- [ ] **A21. Chart toolbox** (M) — per-chart controls (zoom, y-axis default
      input, export) on a rendered chart; `IndividualChartControls`.
- [ ] **A22. Multi-location runs** (M) — `MultipleLocationsSelect` (uses
      `unwrapLocationFromKey`): several locations queued; one request per
      location; results in order; one failing location leaves the others.
- [ ] **A23. Time-space 50th percentile tab** (M) — `TimeSpaceDiagramAverage/getReportData`;
      start/end time validation ("Select start and end time ranges");
      sequence and coordination selector.
- [ ] **A24. Time-space SRM upload** (L) — gzip+base64 file upload to
      `TimeSpaceDiagram/getSrmData`; overlays merged; clear restores.
- [ ] **A25. Time-space GPX upload** (L) — GPX entries, animation handler,
      ignored locations toggle recomputes distances.
- [ ] **A26. Time-space cycle dragging** (L) — drag a cycle band, offsets
      update, double-click resets (`timeSpace.handler`); assert the offset
      badge text.
- [ ] **A27. Link pivot PCD expansion** (M) — expanding a link posts
      `LinkPivot/getPcdData` with the delta and window; existing vs predicted
      charts; manual adjustment edits recompute target offsets (the
      cumulative math in `LinkPivotAdjustmentTable`).
- [ ] **A28. Link pivot options → request** (S) — days of week, cycle
      length, starting point, bias, bias direction each change the body.
- [ ] **A29. Aggregate charts options → request** (M) — every metric group
      maps to its `AggregationType`; data type index; x-axis / y-axis /
      chart type / bin size / sum-vs-average; a `dataPoints` series per
      location renders one chart each; individually added location via the
      map ("Add Location") goes through `/Location/{key}` with the expanded
      detail.
- [ ] **A30. Watchdog Summary Report tab** (M) — `WatchDogDashboard`
      endpoints; issue-type, detection-type and controller-type sunburst
      charts; date range in the request.
- [ ] **A31. Watchdog optional filters** (S) — area / region / jurisdiction /
      issue type / location each land in `Watchdog/getReportData`; "no logs"
      message on an empty result.
- [ ] **A32. Transit signal priority report** (M) —
      `TransitSignalPriority/getReportData`; latest-version locations;
      measure presets.
- [ ] **A33. Pedestrian activity report** (M) — `PedestrianAggregation`
      location data + map (`PedatMap`, Stadia tiles to block); daily volume
      by month transformer.
- [ ] **A34. Left turn gap report** (M) — `LeftTurnGapReport` plus the data
      check endpoint; both `/left-turn-gap-report` and
      `/reports/left-turn-gap` routes.
- [ ] **A35. Measures page** (S) — `/measures` listing and links.
- [ ] **A36. Data export** (M) — `/data/export`: event-log export request to
      the data API (parameters, date range, location); download handling in
      the sandbox (assert the request, not the file).
- [ ] **A37. Usage analytics** (M) — `/data/usage`: `UsageEntry` OData
      `$filter` (UTC conversion of the local range, `UserId` escaping),
      `$orderby`, `$count=true`; identity users for labels. Open question to
      settle in the spec: does the `$count` survive the envelope unwrap, and
      does the page need it?
- [ ] **A38. Speed management tool — map and hotspots** (L) — the speed API
      is a manual spec snapshot (`api-specs/speed-spec.json`); segments,
      hotspots table, legend, route display toggle; violation range slider
      in the request.
- [ ] **A39. Speed management tool — charts** (L) — speed over time, over
      distance, compliance, variability, violations, congestion tracker,
      data quality, effectiveness of strategies: one item each once A38's
      fixtures exist (eight specs; treat as A39a–h).
- [ ] **A40. Speed management tool — exportable reports** (M) — monthly
      report options, report map, export request.
- [ ] **A41. Speed management tool — source version manager** (M) — PeMS /
      ATSPM / ClearGuide source panels.

## B. Admin and configuration screens

The AdminTable family shares one pattern (list, create modal, edit modal,
delete modal, claim-gated actions); `admin-areas.spec.ts` is the template.
Each still deserves its own spec because the request bodies differ (PATCH vs
PUT, nested OData, non-config APIs).

- [ ] **B1. Regions** (S) — `/Region` create/patch/delete; associated
      locations listed in the delete modal.
- [ ] **B2. Jurisdictions** (S) — `/Jurisdiction`; MPO/county fields.
- [ ] **B3. Products** (S) — `/Product`; manufacturer/model.
- [ ] **B4. Device configurations** (M) — `/DeviceConfiguration` uses **PUT**
      for edits (the others PATCH): the whole entity must go back; product
      and device lists in the modal; protocol/port fields.
- [ ] **B5. Menu items** (M) — `/MenuItems` nested children, display order,
      parent select; the Topbar reads the same entity set.
- [ ] **B6. FAQ admin + public FAQ page** (S) — `/Faq` CRUD; `/faq` renders
      the same list.
- [ ] **B7. Measure defaults** (M) — `/MeasureOption` per measure type; option
      value types (number/boolean/string) round-trip.
- [ ] **B8. Versions page** (S) — `/Version` list; about page already covers
      the version endpoints' failure state.
- [ ] **B9. Impacts / B10. Impact types** (M) — `usePostApiV1Impact`,
      `usePutApiV1ImpactId` etc. (the speed API, not config): different base
      URL, no OData envelope, PUT semantics.
- [ ] **B11. Segments list + editor** (L) — `/admin/segments/[id]`: entities
      within range (`usePostApiV1EntityGetEntitiesWithinRange`), replace
      entities, update/delete segment; map interactions (draft segment,
      nearby segments, UDOT LRS layer) — stub tiles and vector layers.
- [ ] **B12. Routes list** (S) — `/admin/routes`: create route (`POST /Route`),
      delete, navigate to the editor.
- [ ] **B13. Route editor — add location** (M) — pick a location on the map /
      autocomplete, "Add to Route" appends a link, OSRM distance fills in,
      save carries the new link with `order`.
- [ ] **B14. Route editor — reorder by drag** (L) — `@hello-pangea/dnd`
      keyboard drag (space, arrow, space); orders and distances recomputed
      around the moved link; save body reflects it.
- [ ] **B15. Route editor — delete link / recalculate distance** (S) — delete
      re-links neighbours' distances; the refresh button posts to OSRM and
      rounds feet.
- [ ] **B16. Users** (M) — identity API: list, edit roles
      (`useDeleteUsersUpdate` — a DELETE-named update), delete user; role
      options from `/Roles`.
- [ ] **B17. Roles and claims** (M) — `useGetRolesCreateRole` /
      `useGetClaimsAddClaimsToRoleFromRoleName` are GET-named mutations:
      confirm the verb and body each actually sends; claim checklist per
      role; delete role.
- [ ] **B18. Locations — New Location modal** (M) — `POST /Location` with
      `versionAction: 'Initial'` (member name), location type, coordinates
      from the map picker; redirects to `/admin/locations/{id}`.
- [ ] **B19. Locations — versions** (M) — "Add New Version"
      (`useGetLocationCopyLocationToNewVersionFromKey` with
      `newVersionLabel`), version select
      (`useGetLocationAllVersionsOfLocationFromIdentifier`), "Delete This
      Version" (`useDeleteLocationSetLocationTodFromKey`), "Delete This
      Location" (`useDeleteLocationAllVersionsFromKey`); check the verb and
      URL each generated hook really sends.
- [ ] **B20. Locations — General tab** (M) — name/coordinates/type/region/
      jurisdiction/areas edits → `PATCH /Location/{key}` body (enum and
      nullable fields); coordinate picker on the map.
- [ ] **B21. Locations — Devices tab** (L) — `/Device` per location:
      add/edit/delete device, device configuration select, `DeviceStatus`
      and `DeviceTypes` member names in the body; claim-gated.
- [ ] **B22. Locations — approaches beyond save** (M) — add approach, copy
      approach (`copyApproachInStore`), delete approach with confirmation,
      add/delete detectors, duplicate detector channel error, missing phase
      error, unsaved-changes prompt when switching tabs.
- [ ] **B23. Locations — pedestrian phases 1:1** (S) — the lock/unlock dialog
      patches the location and every approach's pedestrian fields.
- [ ] **B24. Locations — Watchdog tab remove** (S) — "Remove Ignore" deletes
      the event; edit dates patches it.
- [ ] **B25. Detector comments** (S) — `/DetectorComment` add/delete from the
      detector row.
- [ ] **B26. Admin page claim matrix** (M) — table-driven: for every admin
      route in `pagesCheck.ts`, a session with the wrong claim redirects to
      `/unauthorized` and the right claim renders the page heading; admin
      menu entries appear only for granted claims.

## C. Identity flows

- [ ] **C1. Register success** (S) — valid form posts to the identity API;
      success message / redirect; server-side error message shown.
- [ ] **C2. Verify user** (S) — `/verify-user` with a valid session and
      claims; the redirect matrix with/without cookies.
- [ ] **C3. SSO login** (M) — `/sso-login` token handling → cookies → home;
      failure message.
- [ ] **C4. Password reset request** (S) — `/password-reset` posts the email;
      confirmation state; error state.
- [ ] **C5. Change password** (S) — validation rules, request body, success
      redirect.
- [ ] **C6. Profile page** (S) — `/user/profile` loads `/Profile`, saves via
      `GetProfileUpdateProfile` (check the verb it really uses); avatar
      initials update.
- [ ] **C7. Logout** (S) — user menu "Log out" clears every cookie and
      returns home; the menu items flip to logged-out.
- [ ] **C8. Expired session** (M) — a 401 from the config API mid-session:
      chrome stays up (error boundary), page shows its state, no crash.

## D. Suite infrastructure

- [ ] **D1. Smoke project against a real environment** (M) — a Playwright
      project that runs a tagged subset with no stubs against
      `E2E_BASE_URL` (login, one measure, one admin list) for post-deploy
      checks; documented env vars.
- [ ] **D2. Recorded report-API fixtures** (L, touches backend test hosting)
      — extend the in-process recording harness used for the config API to
      the report API so A1–A18 use recorded shapes instead of hand-built
      ones. Ask before starting: it runs backend projects.
- [ ] **D3. CI server** (S) — serve the standalone build
      (`node .next/standalone/server.js` with static assets copied) instead
      of `npm start`, which Next warns about under `output: 'standalone'`.
- [ ] **D4. Flake report** (S) — run the suite five times in CI mode and
      list any test that needed a retry; fix root causes rather than
      widening timeouts.
- [ ] **D5. Locator audit** (S) — replace remaining nth/CSS locators with
      role/label ones where the markup allows; add `aria-label`s in the app
      where it does not (small app changes are in scope).
- [ ] **D6. Fixture drift check** (M) — a Jest test that `satisfies`-checks
      every e2e fixture module against the generated types so a spec change
      fails at type-check time, not at e2e time (today only some modules do).

## Cycle log

Append one line per finished item: date, item, commit, notes.

- 2026-08-28 — bootstrap: 13 specs / 37 tests green on the production build; this backlog written.
- 2026-08-28 — A1 Purdue Coordination Diagram: 3 tests (charts per phase + defaults in the request, picked bin size, empty phase); new `measureFixtures.ts`, PCD result builder in `reportFixtures.ts`. A flaky first run exposed two app bugs, both fixed with a deterministic regression test in `performance-measures.spec.ts`: SelectChart cleared a deep-linked measure whenever the measure list arrived after the locations, and getChartDefaults crashed on a measure with a null name (nullable in the contract). Gate: 41/41 CI mode, 315 chart unit tests, types at 852. App fix 8d9d2259; spec in the commit carrying this line.
- 2026-08-29 — A2 Split Monitor: 4 tests (charts per phase + phase table columns/values + default percentile in the request, picked percentile, "None" as 0, planless empty phase). Two app bugs found: "None" went out as the word to an int field (400 from the report API), and PhaseTable showed the force-off value in a free plan's max-outs cell (the export already used max-outs); both fixed with unit tests, plus missing React keys on those cells. Gate: 45/45 CI mode, 9 split-monitor unit tests, types at 852. App fix e4c4bda2; spec f131958d.
- 2026-08-29 — A3 Timing and Actuation: 3 tests (title + strip per phase with every seeded toggle in the request, permissive-phase toggle + legend pop-over, empty result). App fix: the toolbox restored a re-shown permissive strip to a fixed 300px, clipping tall strips. Fixture lesson: CycleEventsDto is {start, value}, not a data point - a '' start throws Invalid time value in the transformer. Gate: 48/48 CI mode, types at 852. App fix 4f6199d7; spec in the commit carrying this line.
