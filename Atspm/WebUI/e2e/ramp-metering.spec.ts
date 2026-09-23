// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - e2e/ramp-metering.spec.ts
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
  rampMeteringMeasure,
  rampMeteringMeasureWithCombineLanes,
} from './support/measureFixtures'
import {
  END,
  generateCharts,
  LOCATION_IDENTIFIER,
  measurePageUrl,
  START,
  stubMeasurePage,
} from './support/measurePage'
import { rampMeteringResult } from './support/reportFixtures'

// Ramp Metering stands apart from the other measures: its result is one
// object for the ramp rather than a list per approach, and the seed
// carries no measure options at all - so the option panel's job here is to
// say its default is missing rather than to offer a control.

const chartUrl = () => measurePageUrl('RampMetering')

const stubBackend = (
  page: Page,
  {
    measure = rampMeteringMeasure,
    report = rampMeteringResult(START, END),
  }: { measure?: typeof rampMeteringMeasure; report?: unknown } = {}
) =>
  stubMeasurePage(page, {
    measure,
    reportPath: '/RampMetering/getReportData',
    report,
  })

const combineLanes = (page: Page) => page.getByLabel('Combine Lanes')

test('renders the ramp chart and reports the unseeded option as missing', async ({
  page,
}) => {
  const { reports } = await stubBackend(page)

  await page.goto(chartUrl())
  // The measure seeds no options, so the panel says so instead of
  // offering a checkbox - and, before the guard, threw here instead.
  await expect(
    page.getByText('Combine Lanes default value not found.')
  ).toBeVisible()
  await expect(combineLanes(page)).toHaveCount(0)
  await expect(page.getByText('Something went wrong')).toHaveCount(0)

  await generateCharts(page)

  await expect(page.locator('#chart-0 canvas').first()).toBeVisible()

  expect(reports).toHaveLength(1)
  expect(reports[0].postDataJSON()).toMatchObject({
    locationIdentifier: LOCATION_IDENTIFIER,
    start: START,
    end: END,
  })
})

test('a seeded combine-lanes default is offered and sent', async ({ page }) => {
  const { reports } = await stubBackend(page, {
    measure: rampMeteringMeasureWithCombineLanes,
  })

  await page.goto(chartUrl())
  await expect(combineLanes(page)).not.toBeChecked()

  await generateCharts(page)
  await expect(page.locator('#chart-0 canvas').first()).toBeVisible()
  expect(reports[0].postDataJSON()).toMatchObject({ combineLanes: false })

  // Ticking it re-runs with the lanes combined.
  await combineLanes(page).check()
  await generateCharts(page)

  await expect(reports).toHaveLength(2)
  expect(reports[1].postDataJSON()).toMatchObject({ combineLanes: true })
})

test('a ramp with no lanes or events still renders', async ({ page }) => {
  await stubBackend(page, {
    report: {
      ...rampMeteringResult(START, END),
      mainlineAvgFlow: null,
      mainlineAvgOcc: null,
      mainlineAvgSpeed: null,
      startUpWarning: null,
      shutdownWarning: null,
      lanesActiveRate: null,
      lanesBaseRate: null,
      lanesQueueOnAndOffEvents: null,
    },
  })

  await page.goto(chartUrl())
  await generateCharts(page)

  await expect(page.locator('#chart-0 canvas').first()).toBeVisible()
  await expect(page.getByText('Something went wrong')).toHaveCount(0)
})
