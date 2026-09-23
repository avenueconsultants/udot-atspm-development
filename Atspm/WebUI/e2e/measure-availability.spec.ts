// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - e2e/measure-availability.spec.ts
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
  approachSpeedMeasure,
  purduePhaseTerminationMeasure,
  searchLocationWithCharts,
  waitTimeMeasure,
} from './support/measureFixtures'
import {
  END,
  generateCharts,
  measurePageUrl,
  START,
  stubMeasurePage,
} from './support/measurePage'
import { waitTimeResult } from './support/reportFixtures'

// Which measures a location offers is the intersection of two things: the
// ids in the location's `charts`, and the measure list filtered by
// showOnWebsite. A measure outside that intersection cannot stay selected,
// however it was chosen - including from the URL.

const EVERY_MEASURE = [
  purduePhaseTerminationMeasure,
  approachSpeedMeasure,
  waitTimeMeasure,
]

const measurePicker = (page: Page) =>
  page.getByRole('combobox', {
    name: 'Measure',
  })

const stubBackend = (
  page: Page,
  {
    charts,
    measures = EVERY_MEASURE,
  }: { charts: number[]; measures?: typeof EVERY_MEASURE }
) =>
  stubMeasurePage(page, {
    measure: waitTimeMeasure,
    measures,
    location: searchLocationWithCharts(charts),
    reportPath: '/WaitTime/getReportData',
    report: [
      waitTimeResult(START, END, {
        id: 1,
        description: 'NB Main St',
        phaseNumber: 2,
      }),
    ],
  })

test('a location offers only the measures in its charts list', async ({
  page,
}) => {
  await stubBackend(page, {
    charts: [waitTimeMeasure.id ?? 0, approachSpeedMeasure.id ?? 0],
  })

  await page.goto(measurePageUrl('WaitTime'))
  await expect(measurePicker(page)).toHaveText('Wait Time')

  await measurePicker(page).click()
  await expect(page.getByRole('option')).toHaveText([
    'Approach Speed',
    'Wait Time',
  ])
})

test('a measure the location does not offer is cleared from the URL', async ({
  page,
}) => {
  // The location offers Wait Time; the URL asks for Approach Speed.
  await stubBackend(page, { charts: [waitTimeMeasure.id ?? 0] })

  await page.goto(measurePageUrl('ApproachSpeed'))

  await expect(measurePicker(page)).not.toHaveText('Approach Speed')
  await generateCharts(page)

  await expect(page.getByText('Please select a measure.')).toBeVisible()
  await expect(page.locator('#chart-0')).toHaveCount(0)
})

test('a measure hidden from the website is not offered', async ({ page }) => {
  await stubBackend(page, {
    charts: [waitTimeMeasure.id ?? 0, approachSpeedMeasure.id ?? 0],
    measures: [
      purduePhaseTerminationMeasure,
      { ...approachSpeedMeasure, showOnWebsite: false },
      waitTimeMeasure,
    ],
  })

  await page.goto(measurePageUrl('WaitTime'))
  await measurePicker(page).click()

  await expect(page.getByRole('option')).toHaveText(['Wait Time'])
})

test('Purdue Phase Termination is selected when the URL names no measure', async ({
  page,
}) => {
  await stubBackend(page, {
    charts: [waitTimeMeasure.id ?? 0, purduePhaseTerminationMeasure.id ?? 0],
  })

  // measurePageUrl always carries a chartType, so this one is built by hand.
  await page.goto('/performance-measures?location=1001')

  await expect(measurePicker(page)).toHaveText('Purdue Phase Termination')
})
