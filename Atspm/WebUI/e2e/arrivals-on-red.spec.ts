// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - e2e/arrivals-on-red.spec.ts
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
import { arrivalsOnRedMeasure } from './support/measureFixtures'
import {
  binSizePicker,
  END,
  generateCharts,
  LOCATION_IDENTIFIER,
  measurePageUrl,
  START,
  stubMeasurePage,
} from './support/measurePage'
import { arrivalsOnRedResult } from './support/reportFixtures'

// Arrivals on Red: one chart per approach, a plan strip with per-plan
// statistics, and a bin size option. The report path is ArrivalOnRed
// (singular) while the chart type is ArrivalsOnRed.

const chartUrl = () => measurePageUrl('ArrivalsOnRed')

const twoApproaches = [
  arrivalsOnRedResult(START, END, {
    id: 1,
    description: 'NB Main St',
    phaseNumber: 2,
  }),
  arrivalsOnRedResult(START, END, {
    id: 2,
    description: 'SB Main St',
    phaseNumber: 6,
  }),
]

const stubBackend = (page: Page, report: unknown = twoApproaches) =>
  stubMeasurePage(page, {
    measure: arrivalsOnRedMeasure,
    reportPath: '/ArrivalOnRed/getReportData',
    report,
  })

test('renders one chart per approach and posts the seeded defaults', async ({
  page,
}) => {
  const { reports } = await stubBackend(page)

  await page.goto(chartUrl())
  await expect(binSizePicker(page)).toHaveText('15')

  await generateCharts(page)

  await expect(page.locator('#chart-0 canvas')).toBeVisible()
  await expect(page.locator('#chart-1 canvas')).toBeVisible()
  await expect(page.locator('#chart-2')).toHaveCount(0)

  expect(reports).toHaveLength(1)
  const options = reports[0].postDataJSON()
  expect(options).toMatchObject({
    locationIdentifier: LOCATION_IDENTIFIER,
    start: START,
    end: END,
    showPlanStatistics: true,
    getPermissivePhase: true,
  })
  expect(Number(options.binSize)).toBe(15)
})

test('a bin size picked in the panel goes out in the request', async ({
  page,
}) => {
  const { reports } = await stubBackend(page)

  await page.goto(chartUrl())
  await binSizePicker(page).click()
  await page.getByRole('option', { name: '5', exact: true }).click()
  await expect(binSizePicker(page)).toHaveText('5')

  await generateCharts(page)

  await expect(page.locator('#chart-0 canvas')).toBeVisible()
  expect(reports).toHaveLength(1)
  expect(reports[0].postDataJSON().binSize).toBe(5)
})

test('an approach with no plans or series still renders', async ({ page }) => {
  await stubBackend(page, [
    {
      ...twoApproaches[0],
      plans: null,
      percentArrivalsOnRed: null,
      totalVehicles: null,
      arrivalsOnRed: null,
    },
  ])

  await page.goto(chartUrl())
  await generateCharts(page)

  await expect(page.locator('#chart-0 canvas')).toBeVisible()
  await expect(page.getByText('Something went wrong')).toHaveCount(0)
})
