// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - e2e/preemption-details.spec.ts
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
import { preemptionDetailsMeasure } from './support/measureFixtures'
import {
  END,
  LOCATION_IDENTIFIER,
  START,
  generateCharts,
  measurePageUrl,
  stubMeasurePage,
} from './support/measurePage'
import { preemptionDetailsResult } from './support/reportFixtures'

// Preemption Details has no options and a response that is an object, not
// an array: a summary of request/service pairs that becomes the first
// chart, then one detail chart per preempt number. The measure has no
// seeded options either, so the request is just the location and window.

const chartUrl = () => measurePageUrl('PreemptionDetails')

const stubBackend = (
  page: Page,
  report: unknown = preemptionDetailsResult(START, END)
) =>
  stubMeasurePage(page, {
    measure: preemptionDetailsMeasure,
    reportPath: '/PreemptDetail/getReportData',
    report,
  })

test('renders the summary chart then one chart per preempt number', async ({
  page,
}) => {
  const { reports } = await stubBackend(page)

  await page.goto(chartUrl())
  await expect(
    page.getByText('No options available for this chart.')
  ).toBeVisible()

  await generateCharts(page)

  // Summary first, then preempts 1 and 2.
  await expect(page.locator('#chart-0 canvas')).toBeVisible()
  await expect(page.locator('#chart-1 canvas')).toBeVisible()
  await expect(page.locator('#chart-2 canvas')).toBeVisible()
  await expect(page.locator('#chart-3')).toHaveCount(0)

  expect(reports).toHaveLength(1)
  expect(reports[0].postDataJSON()).toEqual({
    locationIdentifier: LOCATION_IDENTIFIER,
    start: START,
    end: END,
  })
})

test('details without a summary render on their own', async ({ page }) => {
  await stubBackend(page, {
    ...preemptionDetailsResult(START, END),
    summary: null,
  })

  await page.goto(chartUrl())
  await generateCharts(page)

  await expect(page.locator('#chart-0 canvas')).toBeVisible()
  await expect(page.locator('#chart-1 canvas')).toBeVisible()
  await expect(page.locator('#chart-2')).toHaveCount(0)
  await expect(page.getByText('Something went wrong')).toHaveCount(0)
})

test('a window with no preempts shows the no-data warning', async ({
  page,
}) => {
  await stubBackend(page, { details: [], summary: null })

  await page.goto(chartUrl())
  await generateCharts(page)

  await expect(page.getByText('No Data Avaliable')).toBeVisible()
  await expect(page.locator('#chart-0')).toHaveCount(0)
  await expect(page.getByText('Something went wrong')).toHaveCount(0)
})
