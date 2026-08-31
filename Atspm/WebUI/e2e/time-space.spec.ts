// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - e2e/time-space.spec.ts
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
import { expect, test } from '@playwright/test'
import { stubEndpoint } from './support/api'
import {
  link1001,
  ROUTE_ID,
  routeViewWithDetail,
} from './support/routeFixtures'
import {
  generateCharts,
  HISTORIC_END,
  HISTORIC_START,
  historicUrl,
  stubTimeSpaceHistoric,
  wallClock,
} from './support/timeSpace'

// The time-space diagram is the deepest report flow: the route list and
// route detail come from the config API, the phase results and the link
// pivot overlay come from two report-API endpoints, and the historic
// transformer has to turn the phase results into a chart. The window is
// passed in the URL, which is also how shared links reproduce a diagram.
// The fixtures and the backend stub are shared with the SRM, GPX and cycle
// specs, so they live in e2e/support/timeSpace.ts.

test('a route and window from the URL generate the diagram and its link pivot', async ({
  page,
}) => {
  const { diagrams, pivots } = await stubTimeSpaceHistoric(page)

  await page.goto(historicUrl())
  await expect(page.getByLabel('Route Select')).toHaveValue('Main St corridor')
  await expect(page.getByText('Ready to run')).toBeVisible()

  await generateCharts(page)

  await expect(page.locator('#time-space-chart canvas').first()).toBeVisible()
  await expect(page.getByText('Some phases failed to process')).toHaveCount(0)

  expect(diagrams).toHaveLength(1)
  const options = diagrams[0].postDataJSON()
  expect(options).toMatchObject({
    routeId: ROUTE_ID,
    locationIdentifier: link1001.locationIdentifier,
    extendStartStopSearch: 2,
    showAllLanesInfo: true,
    speedLimit: null,
  })
  // The URL carries instants; the request carries wall-clock literals.
  expect(options.start).toBe(wallClock(HISTORIC_START))
  expect(options.end).toBe(wallClock(HISTORIC_END))

  // The historic diagram also fetches its link pivot; it lands on a tab.
  expect(pivots).toHaveLength(1)
  expect(pivots[0].postDataJSON()).toMatchObject({ routeId: ROUTE_ID })
  await page.getByRole('tab', { name: 'Link Pivot' }).click()
  await expect(
    page.getByRole('heading', { name: 'Primary Direction' })
  ).toBeVisible()
  // Link 1's adjustment row (the route checker above lists 1001 too, but
  // without the location name).
  await expect(
    page.getByRole('row').filter({ hasText: 'Main St & 400 S' }).first()
  ).toContainText('12')
})

test('a failing diagram request shows the report API message beside the button', async ({
  page,
}) => {
  const { hosts } = await stubTimeSpaceHistoric(page)
  await stubEndpoint(page, {
    host: hosts.reports,
    path: '/TimeSpaceDiagram/getReportData',
    method: 'POST',
    status: 500,
    body: { message: 'time-space diagram unavailable' },
  })

  await page.goto(historicUrl())
  await expect(page.getByText('Ready to run')).toBeVisible()

  await generateCharts(page)

  await expect(page.getByText('time-space diagram unavailable')).toBeVisible()
  await expect(page.locator('#time-space-chart')).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Generate Charts' })
  ).toBeVisible()
})

test('generating without a route asks for one and sends nothing', async ({
  page,
}) => {
  const { diagrams } = await stubTimeSpaceHistoric(page)

  await page.goto('/time-space-diagrams')
  await expect(page.getByLabel('Route Select')).toBeVisible()

  await generateCharts(page)

  await expect(page.getByText('Please Select a route')).toBeVisible()
  expect(diagrams).toHaveLength(0)
})

test('a route with a missing distance is flagged before it can run', async ({
  page,
}) => {
  await stubTimeSpaceHistoric(page, {
    route: {
      ...routeViewWithDetail,
      routeLocations: [
        {
          ...routeViewWithDetail.routeLocations[0],
          nextLocationDistanceId: null,
          nextLocationDistance: null,
        },
        routeViewWithDetail.routeLocations[1],
      ],
    },
  })

  await page.goto(historicUrl())

  await expect(
    page.getByText('Please configure distances before running.')
  ).toBeVisible()
  await expect(page.getByText('Ready to run')).toHaveCount(0)
})
