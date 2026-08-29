// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - e2e/purdue-coordination-diagram.spec.ts
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
  purdueCoordinationDiagramMeasure,
  searchLocationWithMeasures,
} from './support/measureFixtures'
import { mockAppShell } from './support/mockAppShell'
import { purdueCoordinationDiagramResult } from './support/reportFixtures'
import { stubApiHosts } from './support/stubApiHosts'

// The Purdue Coordination Diagram is the first measure whose option panel
// feeds the request: the bin size, volume and plan-statistics defaults come
// from the measure's MeasureOptions, and the report returns one result per
// coordinated phase, each becoming its own chart.

const LOCATION_IDENTIFIER = '1001'
const START = '2026-04-01T08:00:00'
const END = '2026-04-01T09:00:00'

const chartUrl = () =>
  `/performance-measures?${new URLSearchParams({
    location: LOCATION_IDENTIFIER,
    chartType: 'PurdueCoordinationDiagram',
    start: START,
    end: END,
  }).toString()}`

const twoPhases = [
  purdueCoordinationDiagramResult(START, END, {
    number: 2,
    description: 'Northbound',
    approachId: 1,
  }),
  purdueCoordinationDiagramResult(START, END, {
    number: 6,
    description: 'Southbound',
    approachId: 2,
  }),
]

const stubBackend = async (page: Page, report: unknown = twoPhases) => {
  const hosts = await stubApiHosts(page)
  await mockAppShell(page)

  // One stub answers both the measure list and the ?expand=measureOptions
  // call the defaults come from.
  await stubEndpoint(page, {
    host: hosts.config,
    path: '/MeasureType',
    method: 'GET',
    body: odataCollection('MeasureType', [purdueCoordinationDiagramMeasure]),
  })
  await stubEndpoint(page, {
    host: hosts.config,
    path: '/Location/GetLocationsForSearch',
    body: odataCollection('SearchLocations', [
      searchLocationWithMeasures([purdueCoordinationDiagramMeasure]),
    ]),
  })
  const reports = await stubEndpoint(page, {
    host: hosts.reports,
    path: '/PurdueCoordinationDiagram/getReportData',
    method: 'POST',
    body: report,
  })

  return { hosts, reports }
}

const binSizePicker = (page: Page) =>
  page.getByRole('combobox').filter({ hasText: /^(5|15|60)$/ })

const generateCharts = (page: Page) =>
  page.getByRole('button', { name: 'Generate Charts' }).click()

test('renders one chart per phase and posts the measure defaults', async ({
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
    // Boolean defaults arrive as the strings 'true'/'false' and go out as
    // booleans; numeric ones are passed through untouched.
    getVolume: true,
    showPlanStatistics: true,
  })
  expect(Number(options.binSize)).toBe(15)
})

test('a bin size picked in the panel goes out in the request', async ({
  page,
}) => {
  const { reports } = await stubBackend(page)

  await page.goto(chartUrl())
  await binSizePicker(page).click()
  await page.getByRole('option', { name: '60' }).click()
  await expect(binSizePicker(page)).toHaveText('60')

  await generateCharts(page)

  await expect(page.locator('#chart-0 canvas')).toBeVisible()
  expect(reports).toHaveLength(1)
  expect(reports[0].postDataJSON().binSize).toBe(60)
})

test('a phase with no plans or events still renders', async ({ page }) => {
  await stubBackend(page, [
    {
      ...twoPhases[0],
      plans: null,
      volumePerHour: [],
      redSeries: [],
      yellowSeries: [],
      greenSeries: [],
      detectorEvents: [],
    },
  ])

  await page.goto(chartUrl())
  await expect(binSizePicker(page)).toHaveText('15')
  await generateCharts(page)

  await expect(page.locator('#chart-0 canvas')).toBeVisible()
  await expect(page.getByText('Something went wrong')).toHaveCount(0)
})
