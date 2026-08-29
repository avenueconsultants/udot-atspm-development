// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - e2e/purdue-split-failure.spec.ts
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
  purdueSplitFailureMeasure,
  searchLocationWithMeasures,
} from './support/measureFixtures'
import { mockAppShell } from './support/mockAppShell'
import { purdueSplitFailureResult } from './support/reportFixtures'
import { stubApiHosts } from './support/stubApiHosts'

// Purdue Split Failure: one chart per approach (permissive phases too),
// occupancy scatters and their averages, and a single typed option, the
// first seconds of red. The report path is SplitFail while the chart type
// is PurdueSplitFailure.

const LOCATION_IDENTIFIER = '1001'
const START = '2026-04-01T08:00:00'
const END = '2026-04-01T09:00:00'

const chartUrl = () =>
  `/performance-measures?${new URLSearchParams({
    location: LOCATION_IDENTIFIER,
    chartType: 'PurdueSplitFailure',
    start: START,
    end: END,
  }).toString()}`

const twoApproaches = [
  purdueSplitFailureResult(START, END, {
    id: 1,
    description: 'NB Main St',
    phaseNumber: 2,
    phaseType: 'Protected',
  }),
  purdueSplitFailureResult(START, END, {
    id: 2,
    description: 'SB Main St Left',
    phaseNumber: 1,
    phaseType: 'Permissive',
  }),
]

const stubBackend = async (page: Page, report: unknown = twoApproaches) => {
  const hosts = await stubApiHosts(page)
  await mockAppShell(page)

  await stubEndpoint(page, {
    host: hosts.config,
    path: '/MeasureType',
    method: 'GET',
    body: odataCollection('MeasureType', [purdueSplitFailureMeasure]),
  })
  await stubEndpoint(page, {
    host: hosts.config,
    path: '/Location/GetLocationsForSearch',
    body: odataCollection('SearchLocations', [
      searchLocationWithMeasures([purdueSplitFailureMeasure]),
    ]),
  })
  const reports = await stubEndpoint(page, {
    host: hosts.reports,
    path: '/SplitFail/getReportData',
    method: 'POST',
    body: report,
  })

  return { hosts, reports }
}

const firstSecondsOfRed = (page: Page) =>
  page.getByLabel('First Seconds of Red')

const generateCharts = (page: Page) =>
  page.getByRole('button', { name: 'Generate Charts' }).click()

test('renders one chart per approach and posts the seeded defaults', async ({
  page,
}) => {
  const { reports } = await stubBackend(page)

  await page.goto(chartUrl())
  await expect(firstSecondsOfRed(page)).toHaveValue('5')

  await generateCharts(page)

  // The occupancy scatters are large series, which echarts draws on a
  // second canvas layer - hence first().
  await expect(page.locator('#chart-0 canvas').first()).toBeVisible()
  await expect(page.locator('#chart-1 canvas').first()).toBeVisible()
  await expect(page.locator('#chart-2')).toHaveCount(0)

  expect(reports).toHaveLength(1)
  const options = reports[0].postDataJSON()
  expect(options).toMatchObject({
    locationIdentifier: LOCATION_IDENTIFIER,
    start: START,
    end: END,
    showAvgLines: true,
    showFailLines: true,
    showPercentFailLines: false,
  })
  expect(Number(options.firstSecondsOfRed)).toBe(5)
})

test('an edited first-seconds-of-red goes out in the request', async ({
  page,
}) => {
  const { reports } = await stubBackend(page)

  await page.goto(chartUrl())
  await firstSecondsOfRed(page).fill('8')

  await generateCharts(page)

  await expect(page.locator('#chart-0 canvas').first()).toBeVisible()
  expect(reports).toHaveLength(1)
  expect(Number(reports[0].postDataJSON().firstSecondsOfRed)).toBe(8)
})

test('an approach with no plans, fails or occupancies still renders', async ({
  page,
}) => {
  await stubBackend(page, [
    {
      ...twoApproaches[0],
      plans: null,
      failLines: null,
      gapOutGreenOccupancies: null,
      gapOutRedOccupancies: null,
      forceOffGreenOccupancies: null,
      forceOffRedOccupancies: null,
      averageGor: null,
      averageRor: null,
      percentFails: null,
    },
  ])

  await page.goto(chartUrl())
  await generateCharts(page)

  await expect(page.locator('#chart-0 canvas').first()).toBeVisible()
  await expect(page.getByText('Something went wrong')).toHaveCount(0)
})
