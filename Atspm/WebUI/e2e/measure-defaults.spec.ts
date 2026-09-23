// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - e2e/measure-defaults.spec.ts
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
import { stubEndpoint } from './support/api'
import {
  purduePhaseTerminationMeasure,
  searchLocationWithCharts,
  waitTimeMeasure,
} from './support/measureFixtures'
import {
  binSizePicker,
  END,
  generateCharts,
  measurePageUrl,
  START,
  stubMeasurePage,
} from './support/measurePage'
import {
  purduePhaseTerminationResult,
  waitTimeResult,
} from './support/reportFixtures'

// The option panel is built from the measure's own MeasureOptions, which
// arrive with the measure list under ?expand=measureOptions. Switching
// measure therefore swaps the whole panel, and the values it holds are
// what the next run sends - or, for a bin size wider than the window, what
// stops the run happening at all.

const CHARTS = [waitTimeMeasure.id ?? 0, purduePhaseTerminationMeasure.id ?? 0]

const measurePicker = (page: Page) =>
  page.getByRole('combobox', { name: 'Measure' })

const consecutiveCount = (page: Page) =>
  page.getByLabel('Selected Consecutive Count')

const pickMeasure = async (page: Page, name: string) => {
  await measurePicker(page).click()
  await page.getByRole('option', { name }).click()
}

const stubBackend = async (page: Page) => {
  const { hosts, reports } = await stubMeasurePage(page, {
    measure: waitTimeMeasure,
    measures: [waitTimeMeasure, purduePhaseTerminationMeasure],
    location: searchLocationWithCharts(CHARTS),
    reportPath: '/WaitTime/getReportData',
    report: [
      waitTimeResult(START, END, {
        id: 1,
        description: 'NB Main St',
        phaseNumber: 2,
      }),
    ],
  })
  const terminations = await stubEndpoint(page, {
    host: hosts.reports,
    path: '/PurduePhaseTermination/getReportData',
    method: 'POST',
    body: purduePhaseTerminationResult(START, END),
  })

  return { reports, terminations }
}

test('switching measure swaps the panel for the new measure defaults', async ({
  page,
}) => {
  const { terminations } = await stubBackend(page)

  await page.goto(measurePageUrl('WaitTime'))
  await expect(binSizePicker(page)).toHaveText('15')
  await expect(consecutiveCount(page)).toHaveCount(0)

  await pickMeasure(page, 'Purdue Phase Termination')

  // The bin size belongs to Wait Time alone, and goes with it.
  await expect(consecutiveCount(page)).toHaveValue('1')
  await expect(binSizePicker(page)).toHaveCount(0)

  await generateCharts(page)
  await expect(page.locator('#chart-0 canvas').first()).toBeVisible()

  expect(terminations).toHaveLength(1)
  const options = terminations[0].postDataJSON()
  expect(Number(options.selectedConsecutiveCount)).toBe(1)
  expect(options).not.toHaveProperty('binSize')
})

test('an edited option is discarded when the measure changes', async ({
  page,
}) => {
  const { reports } = await stubBackend(page)

  await page.goto(measurePageUrl('WaitTime'))
  await binSizePicker(page).click()
  await page.getByRole('option', { name: '5', exact: true }).click()
  await expect(binSizePicker(page)).toHaveText('5')

  await pickMeasure(page, 'Purdue Phase Termination')
  await pickMeasure(page, 'Wait Time')

  // Back on the measure's own default rather than the edit.
  await expect(binSizePicker(page)).toHaveText('15')

  await generateCharts(page)
  expect(reports).toHaveLength(1)
  expect(Number(reports[0].postDataJSON().binSize)).toBe(15)
})

test('a bin size wider than the window refuses to run', async ({ page }) => {
  const { reports } = await stubBackend(page)

  // Half an hour, so the 60 minute bin cannot fit inside it.
  await page.goto(measurePageUrl('WaitTime', { end: '2026-04-01T08:30:00' }))
  await binSizePicker(page).click()
  await page.getByRole('option', { name: '60' }).click()

  await expect(
    page.getByText(
      'The selected bin size is larger than the selected time span.'
    )
  ).toBeVisible()

  await generateCharts(page)

  await expect(
    page.getByText('Bin size cannot be greater than the selected time span.')
  ).toBeVisible()
  expect(reports).toHaveLength(0)
  await expect(page.locator('#chart-0')).toHaveCount(0)
})
