// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - e2e/watchdog.spec.ts
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//http://www.apache.org/licenses/LICENSE-2.
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
// #endregion
import { expect, test, type Page } from '@playwright/test'
import {
  WatchDogComponentTypes,
  WatchDogComponentTypesName,
  WatchDogIssueTypes,
  WatchDogIssueTypesName,
} from '../src/api/config/config-api.schemas'
import type { WatchDogResult } from '../src/api/reports/report-api.schemas'
import { odataCollection } from '../src/test/fixtures/api'
import { watchDogIgnoreEvents } from '../src/test/fixtures/config'
import { stubEndpoint } from './support/api'
import { mockAppShell } from './support/mockAppShell'
import { signIn } from './support/session'
import { stubApiHosts } from './support/stubApiHosts'

// The watchdog page reads its log from the report API, where enums are
// integers, and silences rows by writing ignore events to the config API,
// where the same enums are member names. Both halves are generated clients
// now, so this spec covers the translation between them end to end.

const issueTypes = [
  { id: WatchDogIssueTypes.RecordCount, name: 'Record Count' },
  { id: WatchDogIssueTypes.LowDetectorHits, name: 'Low Detector Hits' },
]

const report = {
  start: '2026-03-14T00:00:00',
  end: '2026-03-15T00:00:00',
  logEvents: [
    {
      id: 101,
      locationId: 1,
      locationIdentifier: '1001',
      timestamp: '2026-03-14T06:00:00',
      componentType: WatchDogComponentTypes.Location,
      componentId: 1,
      issueType: WatchDogIssueTypes.RecordCount,
      details: 'Phase 2 had 12 records',
      key: '',
      phase: 2,
      regionId: null,
      regionDescription: 'Region 2',
      jurisdictionId: null,
      jurisdictionName: 'Salt Lake City',
      areas: [],
    },
    {
      id: 102,
      locationId: 2,
      locationIdentifier: '1002',
      timestamp: '2026-03-14T06:00:00',
      componentType: WatchDogComponentTypes.Detector,
      componentId: 7,
      issueType: WatchDogIssueTypes.LowDetectorHits,
      details: 'Detector 7 had 3 hits',
      key: '',
      phase: 4,
      regionId: null,
      regionDescription: 'Region 2',
      jurisdictionId: null,
      jurisdictionName: 'Salt Lake City',
      areas: [],
    },
  ],
} satisfies WatchDogResult

const stubBackend = async (page: Page) => {
  const hosts = await stubApiHosts(page)
  await mockAppShell(page)

  await stubEndpoint(page, {
    host: hosts.reports,
    path: '/Watchdog/GetIssueTypes',
    body: issueTypes,
  })
  const reportRequests = await stubEndpoint(page, {
    host: hosts.reports,
    path: '/Watchdog/getReportData',
    method: 'POST',
    body: report,
  })
  await stubEndpoint(page, {
    host: hosts.config,
    path: '/WatchDogIgnoreEvent',
    method: 'GET',
    body: odataCollection('WatchDogIgnoreEvent', watchDogIgnoreEvents),
  })

  return { hosts, reportRequests }
}

// The date panel's inline calendar is a grid too, so the log grid is the one
// with the report's column headers.
const logGrid = (page: Page) =>
  page.getByRole('grid').filter({
    has: page.getByRole('columnheader', { name: 'Issue Type' }),
  })

const generateReport = async (page: Page) => {
  await page.goto('/watchdog')
  await page.getByRole('button', { name: 'Generate Report' }).click()
  await expect(logGrid(page)).toBeVisible()
}

test.beforeEach(({ context, baseURL }) => signIn(context, baseURL))

test('generates the log and labels each row from the report API issue types', async ({
  page,
}) => {
  const { reportRequests } = await stubBackend(page)

  await generateReport(page)

  const recordCount = page.getByRole('row', { name: /1001/ })
  await expect(recordCount).toContainText('Record Count')
  await expect(recordCount).toContainText('Phase 2 had 12 records')
  await expect(page.getByRole('row', { name: /1002/ })).toContainText(
    'Low Detector Hits'
  )

  // The date filters default to yesterday..today and go out as wall-clock
  // literals, never shifted through UTC.
  expect(reportRequests).toHaveLength(1)
  const payload = reportRequests[0].postDataJSON()
  expect(payload.start).toMatch(/^\d{4}-\d{2}-\d{2}T00:00:00$/)
  expect(payload.end).toMatch(/^\d{4}-\d{2}-\d{2}T00:00:00$/)
})

test('ignoring a log row posts a config ignore event with member names', async ({
  page,
}) => {
  const { hosts } = await stubBackend(page)
  const posts = await stubEndpoint(page, {
    host: hosts.config,
    path: '/WatchDogIgnoreEvent',
    method: 'POST',
    status: 201,
    respond: (request) => ({ id: 9, ...request.postDataJSON() }),
  })

  await generateReport(page)

  // The toolbar icon reveals the checkbox column and the real button.
  await page.getByRole('button', { name: 'Ignore Events' }).click()
  const row = page.getByRole('row', { name: /1002/ })
  await row.getByRole('checkbox').check()
  await page
    .getByRole('button', { name: 'Ignore Events' })
    .filter({ hasText: 'Ignore Events' })
    .click()

  const dialog = page.getByRole('dialog', { name: 'Ignore Events' })
  await dialog.getByLabel('End Date').fill('03/31/2026')
  await dialog.getByRole('button', { name: 'Ignore Events' }).click()

  await expect(page.getByText('All events ignored successfully')).toBeVisible()
  expect(posts).toHaveLength(1)
  const event = posts[0].postDataJSON()
  expect(event).toMatchObject({
    locationId: 2,
    locationIdentifier: '1002',
    issueType: WatchDogIssueTypesName.LowDetectorHits,
    componentType: WatchDogComponentTypesName.Detector,
    componentId: 7,
    phase: 4,
  })
  expect(event.end).toMatch(/^2026-03-31/)
  // The row is marked ignored without a second report run.
  await expect(row.locator('[data-testid="CheckCircleIcon"]')).toBeVisible()
})

test('a log row already covered by an ignore event is flagged on load', async ({
  page,
}) => {
  // The recorded ignore event covers March 2026 only; widen it so it is in
  // force whenever this runs.
  const { hosts } = await stubBackend(page)
  await stubEndpoint(page, {
    host: hosts.config,
    path: '/WatchDogIgnoreEvent',
    method: 'GET',
    body: odataCollection('WatchDogIgnoreEvent', [
      {
        ...watchDogIgnoreEvents[0],
        start: '2026-01-01T00:00:00',
        end: '2099-12-31T00:00:00',
      },
    ]),
  })

  await generateReport(page)

  const covered = page.getByRole('row', { name: /1001/ })
  const uncovered = page.getByRole('row', { name: /1002/ })
  await expect(covered.locator('[data-testid="CheckCircleIcon"]')).toBeVisible()
  await expect(uncovered).toBeVisible()
  await expect(
    uncovered.locator('[data-testid="CheckCircleIcon"]')
  ).toHaveCount(0)
})

test('the ignored events tab lists the config ignore events with readable labels', async ({
  page,
}) => {
  await stubBackend(page)

  await page.goto('/watchdog')
  await page.getByRole('tab', { name: 'Ignored Events' }).click()

  const row = page.getByRole('row', { name: /1001/ })
  await expect(row).toContainText('Location (1)')
  await expect(row).toContainText('Record Count')
  await expect(row).toContainText('2026-03-01T00:00:00')
})

test('a user without the watchdog claim is sent to unauthorized', async ({
  page,
  context,
  baseURL,
}) => {
  await signIn(context, baseURL, 'LocationConfiguration:View')
  await stubBackend(page)

  await page.goto('/watchdog')

  await page.waitForURL('**/unauthorized')
  await expect(
    page.getByRole('heading', { name: 'Unauthorized Access' })
  ).toBeVisible()
})
