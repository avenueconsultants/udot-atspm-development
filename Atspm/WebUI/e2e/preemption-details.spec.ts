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
import { odataCollection } from '../src/test/fixtures/api'
import { stubEndpoint } from './support/api'
import {
  preemptionDetailsMeasure,
  searchLocationWithMeasures,
} from './support/measureFixtures'
import { mockAppShell } from './support/mockAppShell'
import { preemptionDetailsResult } from './support/reportFixtures'
import { stubApiHosts } from './support/stubApiHosts'

// Preemption Details has no options and a response that is an object, not
// an array: a summary of request/service pairs that becomes the first
// chart, then one detail chart per preempt number. The measure has no
// seeded options either, so the request is just the location and window.

const LOCATION_IDENTIFIER = '1001'
const START = '2026-04-01T08:00:00'
const END = '2026-04-01T09:00:00'

const chartUrl = () =>
  `/performance-measures?${new URLSearchParams({
    location: LOCATION_IDENTIFIER,
    chartType: 'PreemptionDetails',
    start: START,
    end: END,
  }).toString()}`

const stubBackend = async (
  page: Page,
  report: unknown = preemptionDetailsResult(START, END)
) => {
  const hosts = await stubApiHosts(page)
  await mockAppShell(page)

  await stubEndpoint(page, {
    host: hosts.config,
    path: '/MeasureType',
    method: 'GET',
    body: odataCollection('MeasureType', [preemptionDetailsMeasure]),
  })
  await stubEndpoint(page, {
    host: hosts.config,
    path: '/Location/GetLocationsForSearch',
    body: odataCollection('SearchLocations', [
      searchLocationWithMeasures([preemptionDetailsMeasure]),
    ]),
  })
  const reports = await stubEndpoint(page, {
    host: hosts.reports,
    path: '/PreemptDetail/getReportData',
    method: 'POST',
    body: report,
  })

  return { hosts, reports }
}

const generateCharts = (page: Page) =>
  page.getByRole('button', { name: 'Generate Charts' }).click()

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
