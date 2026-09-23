// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - e2e/aggregate-charts.spec.ts
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
  AggregationCalculationType,
  AggregationType,
  SeriesType,
  XAxisType,
  type AggregationResult,
} from '../src/api/reports/report-api.schemas'
import { odataCollection } from '../src/test/fixtures/api'
import { blockMapTiles, stubEndpoint } from './support/api'
import { mockAppShell } from './support/mockAppShell'
import {
  ROUTE_ID,
  ROUTE_NAME,
  routeEntities,
  routeSearchLocations,
  routeViewWithDetail,
} from './support/routeFixtures'
import { chooseRoute, routePicker } from './support/routeSelect'
import { stubApiHosts } from './support/stubApiHosts'

// Aggregate charts builds the largest request body in the app: the chosen
// route's locations, approaches and detectors (from GetRouteView with
// location detail) become the AggregationOptions filter tree, alongside the
// enum-valued axis, series and calculation choices. The response is a plain
// series list the transformer turns into one chart per result.

const aggregationResults = [
  {
    identifier: '1001',
    series: [
      {
        identifier: 'Detector Activation Count',
        dataPoints: [
          { identifier: '1001', start: '2026-03-14T00:00:00', value: 120 },
          { identifier: '1001', start: '2026-03-14T00:15:00', value: 98 },
          { identifier: '1001', start: '2026-03-14T00:30:00', value: 134 },
        ],
      },
    ],
  },
] satisfies AggregationResult[]

const stubBackend = async (page: Page) => {
  const hosts = await stubApiHosts(page)
  await mockAppShell(page)
  await blockMapTiles(page)

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
  await stubEndpoint(page, {
    host: hosts.config,
    path: '/Location/GetLocationsForSearch',
    body: odataCollection('SearchLocations', routeSearchLocations),
  })
  const reports = await stubEndpoint(page, {
    host: hosts.reports,
    path: '/Aggregation/getReportData',
    method: 'POST',
    body: aggregationResults,
  })

  return { hosts, reports }
}

const runButton = (page: Page) =>
  page.getByRole('button', { name: 'Run Analysis' })

const chooseCorridor = async (page: Page) => {
  await chooseRoute(page, ROUTE_NAME)
  // The route's locations land in the selection table once GetRouteView
  // answers; that is also what enables the run.
  await expect(page.getByText('1001 - Main St 400 S')).toBeVisible()
  await expect(page.getByText('1002 - Main St 500 S')).toBeVisible()
}

test('a route fills the location filter and the run posts the aggregation options', async ({
  page,
}) => {
  const { reports } = await stubBackend(page)

  await page.goto('/aggregate-charts')
  await expect(routePicker(page)).toBeVisible()
  await expect(runButton(page)).toBeDisabled()

  await chooseCorridor(page)
  await runButton(page).click()

  const chart = page.locator('#chart-0')
  await expect(chart).toBeVisible()
  await expect(chart.locator('canvas')).toBeVisible()

  expect(reports).toHaveLength(1)
  const payload = reports[0].postDataJSON()
  expect(payload).toMatchObject({
    locationIdentifiers: ['1001', '1002'],
    // The metric select defaults to the first group and option.
    aggregationType: AggregationType.DetectorEventCount,
    dataType: 0,
    selectedAggregationType: AggregationCalculationType.Sum,
    selectedXAxisType: XAxisType.Time,
    selectedSeries: SeriesType.Signal,
  })
  expect(payload.start).toMatch(/^\d{4}-\d{2}-\d{2}T00:00:00$/)
  expect(payload.timeOptions).toMatchObject({
    daysOfWeek: [1, 2, 3, 4, 5],
    timeOption: 0,
    selectedBinSize: 0,
  })
  expect(payload.filterDirections).toHaveLength(8)
  expect(payload.filterDirections[0]).toMatchObject({
    directionTypeId: 0,
    include: true,
  })
  expect(payload.filterMovements).toHaveLength(8)

  // The filter tree mirrors the route detail: every location, approach and
  // detector, none excluded.
  expect(payload.locations).toHaveLength(2)
  expect(payload.locations[0]).toMatchObject({
    locationIdentifier: '1001',
    exclude: false,
    approaches: [
      {
        approachId: 1,
        exclude: false,
        detectors: [{ id: 11, exclude: false }],
      },
      {
        approachId: 2,
        exclude: false,
        detectors: [{ id: 21, exclude: false }],
      },
    ],
  })
})

test('excluding an approach is carried in the filter tree', async ({
  page,
}) => {
  const { reports } = await stubBackend(page)

  await page.goto('/aggregate-charts')
  await chooseCorridor(page)

  // Expand 1001 and exclude its Northbound approach.
  const location1001 = page.getByRole('row', { name: /1001 - Main St 400 S/ })
  await location1001.getByRole('button', { name: 'collapse-button' }).click()
  await page
    .getByRole('row', { name: /Northbound/ })
    .first()
    .getByRole('checkbox')
    .check()

  await runButton(page).click()
  await expect(page.locator('#chart-0')).toBeVisible()

  expect(reports).toHaveLength(1)
  const [first] = reports[0].postDataJSON().locations
  expect(first.approaches).toEqual([
    expect.objectContaining({ approachId: 1, exclude: true }),
    expect.objectContaining({ approachId: 2, exclude: false }),
  ])
})
