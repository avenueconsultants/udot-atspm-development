// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - e2e/purdue-phase-termination.spec.ts
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
import { purduePhaseTerminationMeasure } from './support/measureFixtures'
import {
  END,
  LOCATION_IDENTIFIER,
  START,
  generateCharts,
  measurePageUrl,
  stubMeasurePage,
} from './support/measurePage'
import { purduePhaseTerminationResult } from './support/reportFixtures'

// Purdue Phase Termination returns one result for the whole location (a
// single chart with a row per phase and the plan strip across the top) and
// takes one option, the consecutive count, typed into a number field.

const chartUrl = () => measurePageUrl('PurduePhaseTermination')

const stubBackend = (
  page: Page,
  report: unknown = purduePhaseTerminationResult(START, END)
) =>
  stubMeasurePage(page, {
    measure: purduePhaseTerminationMeasure,
    reportPath: '/PurduePhaseTermination/getReportData',
    report,
  })

const consecutiveCount = (page: Page) =>
  page.getByLabel('Selected Consecutive Count')

test('renders the location chart and posts the default consecutive count', async ({
  page,
}) => {
  const { reports } = await stubBackend(page)

  await page.goto(chartUrl())
  await expect(consecutiveCount(page)).toHaveValue('1')

  await generateCharts(page)

  await expect(page.locator('#chart-0 canvas')).toBeVisible()
  await expect(page.locator('#chart-1')).toHaveCount(0)

  expect(reports).toHaveLength(1)
  const options = reports[0].postDataJSON()
  expect(options).toMatchObject({
    locationIdentifier: LOCATION_IDENTIFIER,
    start: START,
    end: END,
  })
  expect(Number(options.selectedConsecutiveCount)).toBe(1)
})

test('a consecutive count typed in the panel goes out in the request', async ({
  page,
}) => {
  const { reports } = await stubBackend(page)

  await page.goto(chartUrl())
  await consecutiveCount(page).fill('3')

  await generateCharts(page)

  await expect(page.locator('#chart-0 canvas')).toBeVisible()
  expect(reports).toHaveLength(1)
  expect(Number(reports[0].postDataJSON().selectedConsecutiveCount)).toBe(3)
})

test('a window with no plans or phases still renders the chart', async ({
  page,
}) => {
  await stubBackend(page, {
    ...purduePhaseTerminationResult(START, END),
    plans: null,
    phases: null,
  })

  await page.goto(chartUrl())
  await generateCharts(page)

  await expect(page.locator('#chart-0 canvas')).toBeVisible()
  await expect(page.getByText('Something went wrong')).toHaveCount(0)
})
