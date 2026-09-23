// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - e2e/link-pivot.spec.ts
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
import { odataCollection } from '../src/test/fixtures/api'
import { stubEndpoint } from './support/api'
import { mockAppShell } from './support/mockAppShell'
import { linkPivotResult } from './support/reportFixtures'
import {
  ROUTE_ID,
  ROUTE_NAME,
  routeEntities,
  routeViewWithDetail,
} from './support/routeFixtures'
import { chooseRoute, routePicker } from './support/routeSelect'
import { stubApiHosts } from './support/stubApiHosts'

// Link pivot is a report-API tool driven by config-API routes: the page
// lists routes from the OData entity set, shows the chosen route's
// locations from GetRouteView, and posts the analysis options to
// LinkPivot/getReportData. The generated LinkPivotOptions wants a numeric
// routeId while the picker works in strings, so the request is the thing to
// check.

const stubBackend = async (page: Page) => {
  const hosts = await stubApiHosts(page)
  await mockAppShell(page)

  await stubEndpoint(page, {
    host: hosts.config,
    path: '/Route',
    method: 'GET',
    body: odataCollection('Route', routeEntities),
  })
  await stubEndpoint(page, {
    host: hosts.config,
    path: `/GetRouteView/${ROUTE_ID}`,
    body: routeViewWithDetail,
  })

  return hosts
}

const runAnalysis = (page: Page) =>
  page.getByRole('button', { name: 'Run Analysis' }).click()

test('runs the analysis for the chosen route and shows its adjustments', async ({
  page,
}) => {
  const hosts = await stubBackend(page)
  const reports = await stubEndpoint(page, {
    host: hosts.reports,
    path: '/LinkPivot/getReportData',
    method: 'POST',
    body: linkPivotResult,
  })

  await page.goto('/link-pivot')
  await chooseRoute(page, ROUTE_NAME)
  // The chosen route's locations come from GetRouteView.
  await expect(page.getByText('1001 - Main St & 400 S')).toBeVisible()

  await runAnalysis(page)

  await expect(page.getByRole('heading', { name: 'Adjustments' })).toBeVisible()
  expect(reports).toHaveLength(1)
  expect(reports[0].postDataJSON()).toMatchObject({
    routeId: ROUTE_ID,
    cycleLength: 90,
    daysOfWeek: [1, 2, 3, 4, 5],
    direction: 'Downstream',
    bias: 0,
    biasDirection: 'Downstream',
  })
  const payload = reports[0].postDataJSON()
  expect(payload.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  expect(payload.startTime).toMatch(/^\d{2}:\d{2}:\d{2}$/)

  // Link 2's target offset is its existing offset plus the changes from its
  // row onward: 60 + (-5). (The options panel lists the route's locations
  // in a table of its own, hence the scope to the adjustments table.)
  const adjustments = page.getByRole('table').filter({
    has: page.getByRole('columnheader', { name: 'Target Offset' }),
  })
  const link2 = adjustments.getByRole('row').filter({ hasText: '1002' })
  await expect(link2).toContainText('Main St & 500 S')
  await expect(link2).toContainText('55')

  await expect(
    page.getByRole('heading', { name: 'Approach Link Comparison' })
  ).toBeVisible()
  // Link 1's upstream arrivals on green, existing and predicted, plus the
  // corridor summary row built from the totals.
  const link1 = page.getByRole('row', { name: /^Expand PCD Options 1 1001/ })
  await expect(link1).toContainText('620 (62%)')
  await expect(link1).toContainText('710 (71%)')
  await expect(
    page.getByRole('row', { name: /Corridor Summary/ })
  ).toContainText('1200 (60%)')
})

test('asks for a route before running and sends nothing', async ({ page }) => {
  const hosts = await stubBackend(page)
  const reports = await stubEndpoint(page, {
    host: hosts.reports,
    path: '/LinkPivot/getReportData',
    method: 'POST',
    body: linkPivotResult,
  })

  await page.goto('/link-pivot')
  await expect(routePicker(page)).toBeVisible()
  await runAnalysis(page)

  await expect(page.getByText('Please select a route')).toBeVisible()
  expect(reports).toHaveLength(0)
})

test('a failing analysis shows the report API message beside the button', async ({
  page,
}) => {
  const hosts = await stubBackend(page)
  await stubEndpoint(page, {
    host: hosts.reports,
    path: '/LinkPivot/getReportData',
    method: 'POST',
    status: 500,
    body: { message: 'link pivot unavailable' },
  })

  await page.goto('/link-pivot')
  await chooseRoute(page, ROUTE_NAME)
  await runAnalysis(page)

  await expect(page.getByText('link pivot unavailable')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Adjustments' })).toHaveCount(
    0
  )
})
