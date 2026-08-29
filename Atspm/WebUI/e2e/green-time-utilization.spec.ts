// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - e2e/green-time-utilization.spec.ts
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
import {
  greenTimeUtilizationMeasure,
  searchLocationWithMeasures,
} from './support/measureFixtures'
import { mockAppShell } from './support/mockAppShell'
import { greenTimeUtilizationResult } from './support/reportFixtures'
import { stubApiHosts } from './support/stubApiHosts'

// Green Time Utilization takes two bin sizes, one per axis, typed into
// number fields rather than picked from the shared bin-size dropdown, and
// renders a heat map per approach.

const LOCATION_IDENTIFIER = '1001'
const START = '2026-04-01T08:00:00'
const END = '2026-04-01T09:00:00'

const chartUrl = () =>
  `/performance-measures?${new URLSearchParams({
    location: LOCATION_IDENTIFIER,
    chartType: 'GreenTimeUtilization',
    start: START,
    end: END,
  }).toString()}`

const twoApproaches = [
  greenTimeUtilizationResult(START, END, {
    id: 1,
    description: 'NB Main St',
    phaseNumber: 2,
  }),
  greenTimeUtilizationResult(START, END, {
    id: 2,
    description: 'SB Main St',
    phaseNumber: 6,
  }),
]

const stubBackend = async (page: Page, report: unknown = twoApproaches) => {
  const hosts = await stubApiHosts(page)
  await mockAppShell(page)

  await stubEndpoint(page, {
    host: hosts.config,
    path: '/MeasureType',
    method: 'GET',
    body: odataCollection('MeasureType', [greenTimeUtilizationMeasure]),
  })
  await stubEndpoint(page, {
    host: hosts.config,
    path: '/Location/GetLocationsForSearch',
    body: odataCollection('SearchLocations', [
      searchLocationWithMeasures([greenTimeUtilizationMeasure]),
    ]),
  })
  const reports = await stubEndpoint(page, {
    host: hosts.reports,
    path: '/GreenTimeUtilization/getReportData',
    method: 'POST',
    body: report,
  })

  return { hosts, reports }
}

const xAxisBinSize = (page: Page) => page.getByLabel('X-Axis Bin Size')
const yAxisBinSize = (page: Page) => page.getByLabel('Y-Axis Bin Size')

const generateCharts = (page: Page) =>
  page.getByRole('button', { name: 'Generate Charts' }).click()

test('renders one chart per approach and posts both default bin sizes', async ({
  page,
}) => {
  const { reports } = await stubBackend(page)

  await page.goto(chartUrl())
  await expect(xAxisBinSize(page)).toHaveValue('15')
  await expect(yAxisBinSize(page)).toHaveValue('4')

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
  })
  expect(Number(options.xAxisBinSize)).toBe(15)
  expect(Number(options.yAxisBinSize)).toBe(4)
})

test('bin sizes typed in the panel go out in the request', async ({ page }) => {
  const { reports } = await stubBackend(page)

  await page.goto(chartUrl())
  await xAxisBinSize(page).fill('30')
  await yAxisBinSize(page).fill('10')

  await generateCharts(page)

  await expect(page.locator('#chart-0 canvas')).toBeVisible()
  expect(reports).toHaveLength(1)
  const options = reports[0].postDataJSON()
  expect(Number(options.xAxisBinSize)).toBe(30)
  expect(Number(options.yAxisBinSize)).toBe(10)
})

test('an approach with no bins, splits or plans still renders', async ({
  page,
}) => {
  await stubBackend(page, [
    {
      ...twoApproaches[0],
      plans: null,
      bins: null,
      averageSplits: null,
      programmedSplits: null,
    },
  ])

  await page.goto(chartUrl())
  await generateCharts(page)

  await expect(page.locator('#chart-0 canvas')).toBeVisible()
  await expect(page.getByText('Something went wrong')).toHaveCount(0)
})
