// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - e2e/priority-summary.spec.ts
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
import { clickSeriesPoint } from './support/echarts'
import { prioritySummaryMeasure } from './support/measureFixtures'
import {
  binSizePicker,
  END,
  generateCharts,
  LOCATION_IDENTIFIER,
  measurePageUrl,
  START,
  stubMeasurePage,
} from './support/measurePage'
import {
  priorityDetailsResult,
  prioritySummaryResult,
  wallClockLiteral,
} from './support/reportFixtures'

// Transit Signal Priority Summary is its own chart family: one combined
// chart plus one per TSP number, drawn by PrioritySummaryDetailsChart,
// whose click on a request or service bar fetches PriorityDetails for that
// cycle's window and swaps the chart for the details until Back. That
// drill-down is the only route to the details fetcher.

const chartUrl = () => measurePageUrl('PrioritySummary')

const stubBackend = async (
  page: Page,
  report: unknown = prioritySummaryResult(START, END)
) => {
  const { hosts, reports } = await stubMeasurePage(page, {
    measure: prioritySummaryMeasure,
    reportPath: '/PrioritySummary/getReportData',
    report,
  })
  const details = await stubEndpoint(page, {
    host: hosts.reports,
    path: '/PriorityDetails/getReportData',
    method: 'POST',
    body: priorityDetailsResult(START, END),
  })

  return { reports, details }
}

// The window the drill-down asks for: the cycle's check-in less 125
// seconds to its check-out plus 125, sent as wall-clock literals.
const drillDownWindow = (checkIn: string, checkOut: string) => ({
  start: wallClockLiteral(new Date(new Date(checkIn).getTime() - 125_000)),
  end: wallClockLiteral(new Date(new Date(checkOut).getTime() + 125_000)),
})

test('renders the combined chart and one per TSP number, posting the defaults', async ({
  page,
}) => {
  const { reports, details } = await stubBackend(page)

  await page.goto(chartUrl())
  await expect(binSizePicker(page)).toHaveText('15')

  await generateCharts(page)

  // Combined, TSP 1, TSP 2.
  await expect(page.locator('#chart-0 canvas').first()).toBeVisible()
  await expect(page.locator('#chart-1 canvas').first()).toBeVisible()
  await expect(page.locator('#chart-2 canvas').first()).toBeVisible()
  await expect(page.locator('#chart-3')).toHaveCount(0)

  expect(reports).toHaveLength(1)
  const options = reports[0].postDataJSON()
  expect(options).toMatchObject({
    locationIdentifier: LOCATION_IDENTIFIER,
    start: START,
    end: END,
  })
  expect(Number(options.binSize)).toBe(15)
  expect(details).toHaveLength(0)
})

test('clicking a request bar drills into that cycle and Back returns', async ({
  page,
}) => {
  const { details } = await stubBackend(page)
  const [firstCycle] = prioritySummaryResult(START, END).cycles ?? []
  if (!firstCycle?.checkIn || !firstCycle.checkOut) {
    throw new Error('the summary fixture needs a first cycle with a window')
  }

  await page.goto(chartUrl())
  await generateCharts(page)
  await expect(page.locator('#chart-0 canvas').first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Back' })).toHaveCount(0)

  await clickSeriesPoint(page, '#chart-0', {
    seriesName: 'TSP Request (112→115)',
    dataIndex: 0,
  })

  await expect(page.getByRole('button', { name: 'Back' })).toBeVisible()
  expect(details).toHaveLength(1)
  expect(details[0].postDataJSON()).toEqual({
    locationIdentifier: LOCATION_IDENTIFIER,
    ...drillDownWindow(firstCycle.checkIn, firstCycle.checkOut),
  })

  await page.getByRole('button', { name: 'Back' }).click()
  await expect(page.getByRole('button', { name: 'Back' })).toHaveCount(0)
  await expect(page.locator('#chart-0 canvas').first()).toBeVisible()
})

test('a window with no cycles still renders the combined chart', async ({
  page,
}) => {
  await stubBackend(page, {
    ...prioritySummaryResult(START, END),
    cycles: null,
    unassigned: null,
    events: null,
  })

  await page.goto(chartUrl())
  await generateCharts(page)

  await expect(page.locator('#chart-0 canvas').first()).toBeVisible()
  await expect(page.locator('#chart-1')).toHaveCount(0)
  await expect(page.getByText('Something went wrong')).toHaveCount(0)
})
