// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - e2e/performance-measures.spec.ts
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
import { approachDelayMeasure } from './support/measureFixtures'
import {
  END,
  generateCharts,
  LOCATION_IDENTIFIER,
  measurePageUrl,
  START,
  stubMeasurePage,
} from './support/measurePage'

// The one flow nothing else exercises end to end: pick a location and a
// measure, run the chart, and get a rendered chart back. It covers the whole
// migrated path in one go - the getCharts dispatcher choosing a generated
// fetcher, axios unwrapping the response, transformChartData routing to the
// right transformer, and the result reaching echarts.
//
// ApproachDelay is the chart under test because its response is a plain
// array, so the same endpoint can produce a populated chart or a genuinely
// empty result just by changing the fixture.

const chartUrl = (params: Record<string, string> = {}) =>
  measurePageUrl('ApproachDelay', params)

const approachDelayResult = () => [
  {
    locationIdentifier: LOCATION_IDENTIFIER,
    locationDescription: '1001 - Main St & 400 S',
    phaseDescription: 'Phase 2',
    start: START,
    end: END,
    averageDelayPerVehicle: 12.5,
    totalDelay: 3400,
    plans: [{ start: START, end: END, planDescription: 'Plan 1' }],
    approachDelayPerVehicleDataPoints: [{ timestamp: START, value: 12.5 }],
    approachDelayDataPoints: [{ timestamp: START, value: 340 }],
  },
]

const REPORT_PATH = '/ApproachDelay/getReportData'

// Stubs the page with the report answering as given; a failing report is
// re-stubbed on top so the error path can be driven from the same helper.
const stubBackend = async (
  page: Page,
  report: unknown = approachDelayResult(),
  status = 200
) => {
  const { hosts, reports } = await stubMeasurePage(page, {
    measure: approachDelayMeasure,
    reportPath: REPORT_PATH,
    report,
  })
  if (status === 200) return reports
  return stubEndpoint(page, {
    host: hosts.reports,
    path: REPORT_PATH,
    method: 'POST',
    status,
    body: report,
  })
}

test('running a measure renders a chart from the report response', async ({
  page,
}) => {
  const requests = await stubBackend(page)

  await page.goto(chartUrl())
  await generateCharts(page)

  // The chart id comes from DefaultChartResults, which renders one per
  // transformed chart - its presence means the response made it all the way
  // through the dispatcher and transformer into echarts.
  const chart = page.locator('#chart-0')
  await expect(chart).toBeVisible()
  await expect(chart.locator('canvas')).toBeVisible()

  expect(requests).toHaveLength(1)
})

test('the report request carries the selected location and window', async ({
  page,
}) => {
  const requests = await stubBackend(page)

  await page.goto(chartUrl())
  await generateCharts(page)

  await expect(page.locator('#chart-0')).toBeVisible()

  const payload = requests[0].postDataJSON()
  expect(payload.locationIdentifier).toBe(LOCATION_IDENTIFIER)
  // getCharts serializes the window as wall-clock literals - no timezone
  // shift between what the user picked and what the report API is asked for.
  expect(payload.start).toBe(START)
  expect(payload.end).toBe(END)
})

test('an empty report result reports no data instead of an empty chart', async ({
  page,
}) => {
  await stubBackend(page, [])

  await page.goto(chartUrl())
  await generateCharts(page)

  await expect(page.getByText('No Data Avaliable')).toBeVisible()
  await expect(page.locator('#chart-0')).toHaveCount(0)
})

// useCharts opts out of the app-wide throwOnError policy (src/lib/react-query.ts
// rethrows everything except 401/403 to the _app.tsx boundary), so a report
// failure lands in ChartsContainer's inline alert - with the server's own
// message - and the user keeps the page and their selections.
test('a failing report request shows the error beside the button and keeps the page', async ({
  page,
}) => {
  await stubBackend(page, { message: 'report api unavailable' }, 500)

  await page.goto(chartUrl())
  await generateCharts(page)

  await expect(page.getByText('report api unavailable')).toBeVisible()
  await expect(page.getByText('Something went wrong')).toHaveCount(0)
  await expect(page.locator('#chart-0')).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Generate Charts' })
  ).toBeVisible()
})

test('generating without a location asks for one and sends no request', async ({
  page,
}) => {
  const requests = await stubBackend(page)

  await page.goto('/performance-measures')
  await generateCharts(page)

  await expect(page.getByText('Please select a location.')).toBeVisible()
  expect(requests).toHaveLength(0)
})

// The URL is applied once, as soon as the locations arrive. If the measure
// list is still on its way at that moment, nothing is "available" yet, and
// SelectChart used to clear the deep-linked measure - permanently, since
// the URL is never re-applied. Holding the measure list back until the
// locations have been served reproduces the ordering deterministically.
test('a deep link keeps its measure when the measure list arrives after the locations', async ({
  page,
}) => {
  await stubBackend(page)
  const locationsServed = page.waitForResponse('**/GetLocationsForSearch*')
  await page.route('**/MeasureType*', async (route) => {
    await locationsServed
    await route.fallback()
  })

  await page.goto(chartUrl())

  await expect(page.getByRole('combobox', { name: 'Measure' })).toHaveText(
    'Approach Delay'
  )
  await expect(page.getByText('Please select a measure.')).toHaveCount(0)
})
