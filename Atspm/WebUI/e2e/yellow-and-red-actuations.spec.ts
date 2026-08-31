// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - e2e/yellow-and-red-actuations.spec.ts
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
import { yellowAndRedActuationsMeasure } from './support/measureFixtures'
import {
  END,
  generateCharts,
  LOCATION_IDENTIFIER,
  measurePageUrl,
  START,
  stubMeasurePage,
} from './support/measurePage'
import { yellowAndRedActuationsResult } from './support/reportFixtures'

// Yellow and Red Actuations: one chart per approach, permissive phases
// included, with a severe-violation threshold typed into the panel. The
// report path is YellowRedActivations while the chart type is
// YellowAndRedActuations.

const chartUrl = () => measurePageUrl('YellowAndRedActuations')

const twoApproaches = [
  yellowAndRedActuationsResult(START, END, {
    id: 1,
    description: 'NB Main St',
    phaseNumber: 2,
  }),
  yellowAndRedActuationsResult(START, END, {
    id: 2,
    description: 'SB Main St Left',
    phaseNumber: 1,
    isPermissivePhase: true,
  }),
]

const stubBackend = (page: Page, report: unknown = twoApproaches) =>
  stubMeasurePage(page, {
    measure: yellowAndRedActuationsMeasure,
    reportPath: '/YellowRedActivations/getReportData',
    report,
  })

const severeLevel = (page: Page) => page.getByLabel('Severe Level')

test('renders one chart per approach and posts the seeded threshold', async ({
  page,
}) => {
  const { reports } = await stubBackend(page)

  await page.goto(chartUrl())
  await expect(severeLevel(page)).toHaveValue('5')

  await generateCharts(page)

  await expect(page.locator('#chart-0 canvas').first()).toBeVisible()
  await expect(page.locator('#chart-1 canvas').first()).toBeVisible()
  await expect(page.locator('#chart-2')).toHaveCount(0)

  expect(reports).toHaveLength(1)
  const options = reports[0].postDataJSON()
  expect(options).toMatchObject({
    locationIdentifier: LOCATION_IDENTIFIER,
    start: START,
    end: END,
  })
  expect(Number(options.severeLevelSeconds)).toBe(5)
})

test('an edited severe level goes out in the request', async ({ page }) => {
  const { reports } = await stubBackend(page)

  await page.goto(chartUrl())
  await severeLevel(page).fill('8')

  await generateCharts(page)

  await expect(page.locator('#chart-0 canvas').first()).toBeVisible()
  expect(reports).toHaveLength(1)
  expect(Number(reports[0].postDataJSON().severeLevelSeconds)).toBe(8)
})

test('an approach with no plans or events still renders', async ({ page }) => {
  await stubBackend(page, [
    {
      ...twoApproaches[0],
      plans: null,
      yellowEvents: null,
      redEvents: null,
      redClearanceEvents: null,
      detectorEvents: null,
    },
  ])

  await page.goto(chartUrl())
  await generateCharts(page)

  await expect(page.locator('#chart-0 canvas').first()).toBeVisible()
  await expect(page.getByText('Something went wrong')).toHaveCount(0)
})

test('an empty result shows the no-data warning', async ({ page }) => {
  await stubBackend(page, [])

  await page.goto(chartUrl())
  await generateCharts(page)

  await expect(page.getByText('No Data Avaliable')).toBeVisible()
  await expect(page.locator('#chart-0')).toHaveCount(0)
})
