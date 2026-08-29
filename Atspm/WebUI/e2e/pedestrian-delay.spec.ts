// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - e2e/pedestrian-delay.spec.ts
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
import { pedestrianDelayMeasure } from './support/measureFixtures'
import {
  END,
  LOCATION_IDENTIFIER,
  START,
  generateCharts,
  measurePageUrl,
  stubMeasurePage,
} from './support/measurePage'
import { pedestrianDelayResult } from './support/reportFixtures'

// Pedestrian Delay: one chart per pedestrian phase with a plan strip of
// per-plan statistics. The panel edits the time buffer and ped recall
// threshold; the four show* toggles have no control and travel as the
// seeded defaults.

const chartUrl = () => measurePageUrl('PedestrianDelay')

const twoPhases = [
  pedestrianDelayResult(START, END, {
    number: 2,
    approachId: 1,
    description: 'NB Main St',
  }),
  pedestrianDelayResult(START, END, {
    number: 4,
    approachId: 2,
    description: 'EB 400 S',
  }),
]

const stubBackend = (page: Page, report: unknown = twoPhases) =>
  stubMeasurePage(page, {
    measure: pedestrianDelayMeasure,
    reportPath: '/PedDelay/getReportData',
    report,
  })

const timeBuffer = (page: Page) => page.getByLabel('Time Buffer')
const pedRecallThreshold = (page: Page) =>
  page.getByLabel('Ped Recall Threshold')

test('renders one chart per phase and posts the seeded defaults', async ({
  page,
}) => {
  const { reports } = await stubBackend(page)

  await page.goto(chartUrl())
  await expect(timeBuffer(page)).toHaveValue('15')
  await expect(pedRecallThreshold(page)).toHaveValue('75')

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
    showCycleLength: true,
    showPedBeginWalk: true,
    showPedRecall: false,
    showPercentDelay: true,
  })
  expect(Number(options.timeBuffer)).toBe(15)
  expect(Number(options.pedRecallThreshold)).toBe(75)
})

test('an edited buffer and threshold go out in the request', async ({
  page,
}) => {
  const { reports } = await stubBackend(page)

  await page.goto(chartUrl())
  await timeBuffer(page).fill('30')
  await pedRecallThreshold(page).fill('90')

  await generateCharts(page)

  await expect(page.locator('#chart-0 canvas')).toBeVisible()
  expect(reports).toHaveLength(1)
  const options = reports[0].postDataJSON()
  expect(Number(options.timeBuffer)).toBe(30)
  expect(Number(options.pedRecallThreshold)).toBe(90)
})

test('a phase with no plans or series still renders', async ({ page }) => {
  await stubBackend(page, [
    {
      ...twoPhases[0],
      plans: null,
      cycleLengths: null,
      pedestrianDelay: null,
      startOfWalk: null,
      percentDelayByCycleLength: null,
    },
  ])

  await page.goto(chartUrl())
  await generateCharts(page)

  await expect(page.locator('#chart-0 canvas')).toBeVisible()
  await expect(page.getByText('Something went wrong')).toHaveCount(0)
})
