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
import { expect, test, type Page, type Request } from '@playwright/test'
import { mockAppShell } from './support/mockAppShell'

// The one flow nothing else exercises end to end: pick a location and a
// measure, run the chart, and get a rendered chart back. It covers the whole
// migrated path in one go - the getCharts dispatcher choosing a generated
// fetcher, axios unwrapping the response, transformChartData routing to the
// right transformer, and the result reaching echarts.
//
// ApproachDelay is the chart under test because its response is a plain
// array, so the same endpoint can produce a populated chart or a genuinely
// empty result just by changing the fixture.

const LOCATION_IDENTIFIER = '1001'
const MEASURE_TYPE_ID = 1
const START = '2026-04-01T08:00:00'
const END = '2026-04-01T09:00:00'

const chartUrl = (params: Record<string, string> = {}) => {
  const search = new URLSearchParams({
    location: LOCATION_IDENTIFIER,
    chartType: 'ApproachDelay',
    start: START,
    end: END,
    ...params,
  })
  return `/performance-measures?${search.toString()}`
}

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

// Playwright matches the most recently registered handler first, so the
// catch-all goes on before the specific routes. It keeps the page off the
// live API hosts in .env for everything this test doesn't care about
// (measure types, chart defaults, missing days), which would otherwise make
// the run slow and dependent on a remote environment.
//
// The body is a bare array rather than an OData envelope on purpose. Only
// the config API wraps collections, and axios unwraps that shape only when
// "@odata.context" is present - so an envelope returned for a report-API
// call would reach the component unwrapped and blow up on .map. A bare array
// passes through both paths untouched and satisfies every list consumer.
const stubBackend = async (page: Page) => {
  await page.route(
    /https?:\/\/(config|report|identity|data|speed)-api/,
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
  )

  await mockAppShell(page)

  // SelectChart only keeps a measure selected if it is actually available
  // for the location: the location's `charts` must contain a MeasureType id
  // that is flagged showOnWebsite and whose abbreviation maps to the chart.
  // 'AD' is Approach Delay. Without this the page clears chartType back to
  // null and the run reports "Please select a measure."
  await page.route('**/MeasureType', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        '@odata.context': 'stub',
        value: [
          { id: MEASURE_TYPE_ID, abbreviation: 'AD', showOnWebsite: true },
        ],
      }),
    })
  )

  await page.route('**/Location/GetLocationsForSearch*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        '@odata.context': 'stub',
        value: [
          {
            id: 5,
            locationIdentifier: LOCATION_IDENTIFIER,
            primaryName: 'Main St',
            secondaryName: '400 S',
            latitude: 40.758701,
            longitude: -111.876183,
            locationTypeId: 1,
            charts: [MEASURE_TYPE_ID],
          },
        ],
      }),
    })
  )
}

/** Captures every report-data POST so a test can assert what was sent. */
const stubApproachDelay = async (
  page: Page,
  body: unknown,
  status = 200
): Promise<Request[]> => {
  const requests: Request[] = []
  await page.route('**/ApproachDelay/getReportData', (route) => {
    requests.push(route.request())
    return route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(body),
    })
  })
  return requests
}

const generateCharts = (page: Page) =>
  page.getByRole('button', { name: 'Generate Charts' }).click()

test('running a measure renders a chart from the report response', async ({
  page,
}) => {
  await stubBackend(page)
  const requests = await stubApproachDelay(page, approachDelayResult())

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
  await stubBackend(page)
  const requests = await stubApproachDelay(page, approachDelayResult())

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
  await stubBackend(page)
  await stubApproachDelay(page, [])

  await page.goto(chartUrl())
  await generateCharts(page)

  await expect(page.getByText('No Data Avaliable')).toBeVisible()
  await expect(page.locator('#chart-0')).toHaveCount(0)
})

// Records what actually happens today, which is not what ChartsContainer
// was written to do. It renders an inline `isError` Alert beside the button,
// but that branch is unreachable for a report failure: the app-wide policy
// in src/lib/react-query.ts rethrows everything except 401/403, so the error
// escapes to the boundary in _app.tsx and replaces the entire page - the
// Generate Charts button with it. A transient report-API blip therefore
// costs the user their whole selection rather than showing an error next to
// the run button. Change this test if useCharts is ever given a local
// throwOnError:false to make that inline Alert reachable again.
test('a failing report request currently replaces the page with the error boundary', async ({
  page,
}) => {
  await stubBackend(page)
  await stubApproachDelay(page, { message: 'report api unavailable' }, 500)

  await page.goto(chartUrl())
  await generateCharts(page)

  await expect(page.getByText('Something went wrong').first()).toBeVisible()
  await expect(page.locator('#chart-0')).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Generate Charts' })
  ).toHaveCount(0)
})

test('generating without a location asks for one and sends no request', async ({
  page,
}) => {
  await stubBackend(page)
  const requests = await stubApproachDelay(page, approachDelayResult())

  await page.goto('/performance-measures')
  await generateCharts(page)

  await expect(page.getByText('Please select a location.')).toBeVisible()
  expect(requests).toHaveLength(0)
})
