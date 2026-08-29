// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - e2e/timing-and-actuation.spec.ts
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
  searchLocationWithMeasures,
  timingAndActuationMeasure,
} from './support/measureFixtures'
import { mockAppShell } from './support/mockAppShell'
import { timingAndActuationResult } from './support/reportFixtures'
import { stubApiHosts } from './support/stubApiHosts'

// Timing and Actuation has its own results component (a shared title chart
// above one strip chart per phase) and its own toolbox (permissive-phase
// toggle and a legend pop-over). The option panel currently offers nothing,
// but the measure's seeded toggles still travel in the request.

const LOCATION_IDENTIFIER = '1001'
const START = '2026-04-01T08:00:00'
const END = '2026-04-01T09:00:00'

const chartUrl = () =>
  `/performance-measures?${new URLSearchParams({
    location: LOCATION_IDENTIFIER,
    chartType: 'TimingAndActuation',
    start: START,
    end: END,
  }).toString()}`

const twoPhases = [
  timingAndActuationResult(START, END, {
    number: 2,
    approachDescription: 'NB Main St',
    phaseType: 'Protected',
  }),
  timingAndActuationResult(START, END, {
    number: 5,
    approachDescription: 'SB Main St Left',
    phaseType: 'Permissive',
  }),
]

const stubBackend = async (page: Page, report: unknown = twoPhases) => {
  const hosts = await stubApiHosts(page)
  await mockAppShell(page)

  await stubEndpoint(page, {
    host: hosts.config,
    path: '/MeasureType',
    method: 'GET',
    body: odataCollection('MeasureType', [timingAndActuationMeasure]),
  })
  await stubEndpoint(page, {
    host: hosts.config,
    path: '/Location/GetLocationsForSearch',
    body: odataCollection('SearchLocations', [
      searchLocationWithMeasures([timingAndActuationMeasure]),
    ]),
  })
  const reports = await stubEndpoint(page, {
    host: hosts.reports,
    path: '/TimingAndActuation/getReportData',
    method: 'POST',
    body: report,
  })

  return { hosts, reports }
}

const generateCharts = (page: Page) =>
  page.getByRole('button', { name: 'Generate Charts' }).click()

test('renders the title chart and one strip per phase, sending the seeded toggles', async ({
  page,
}) => {
  const { reports } = await stubBackend(page)

  await page.goto(chartUrl())
  await expect(
    page.getByText('No options available for this chart.')
  ).toBeVisible()

  await generateCharts(page)

  // Strips carry two canvas layers (the large scatter series draw on their
  // own), hence first().
  await expect(page.locator('#chart-title canvas').first()).toBeVisible()
  await expect(page.locator('#chart-0 canvas').first()).toBeVisible()
  await expect(page.locator('#chart-1 canvas').first()).toBeVisible()
  await expect(page.locator('#chart-2')).toHaveCount(0)

  expect(reports).toHaveLength(1)
  const options = reports[0].postDataJSON()
  expect(options).toMatchObject({
    locationIdentifier: LOCATION_IDENTIFIER,
    start: START,
    end: END,
    // 'TRUE'/'FALSE' defaults leave as booleans; the numeric one as-is.
    showAdvancedCount: true,
    showAdvancedDilemmaZone: true,
    showAllLanesInfo: false,
    showLaneByLaneCount: true,
    showPedestrianActuation: true,
    showPedestrianIntervals: true,
    showStopBarPresence: true,
  })
  expect(Number(options.extendStartStopSearch)).toBe(2)
})

test('the toolbox hides permissive phases and opens the legend', async ({
  page,
}) => {
  await stubBackend(page)

  await page.goto(chartUrl())
  await generateCharts(page)
  await expect(page.locator('#chart-1 canvas').first()).toBeVisible()

  // Each strip sits in a max-height container the toggle collapses; the
  // permissive phase is the second result.
  const protectedStrip = page.locator('#chart-0').locator('xpath=../../..')
  const permissiveStrip = page.locator('#chart-1').locator('xpath=../../..')
  const toggle = page.getByRole('checkbox', { name: 'Show Permissive Phases' })
  await expect(toggle).toBeChecked()

  await toggle.uncheck()
  await expect(permissiveStrip).toHaveCSS('max-height', '0px')
  await expect(protectedStrip).not.toHaveCSS('max-height', '0px')

  // Re-showing hands the height back to the container's own limit rather
  // than a fixed value that would clip a tall strip.
  await toggle.check()
  await expect(permissiveStrip).toHaveCSS('max-height', '1000px')

  await page.getByRole('button', { name: 'Legend' }).click()
  await expect(
    page.getByRole('heading', { name: 'Timing and Actuation Legend' })
  ).toBeVisible()
  await expect(page.locator('[id="legend"] canvas')).toHaveCount(3)
})

test('an empty result shows the no-data warning without a crash', async ({
  page,
}) => {
  await stubBackend(page, [])

  await page.goto(chartUrl())
  await generateCharts(page)

  await expect(page.getByText('No Data Avaliable')).toBeVisible()
  await expect(page.getByText('Something went wrong')).toHaveCount(0)
  await expect(page.locator('#chart-0')).toHaveCount(0)
})
