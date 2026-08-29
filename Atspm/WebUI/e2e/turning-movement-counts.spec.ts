// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - e2e/turning-movement-counts.spec.ts
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
import { expect, test, type Locator, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { odataCollection } from '../src/test/fixtures/api'
import { stubEndpoint } from './support/api'
import {
  searchLocationWithMeasures,
  turningMovementCountsMeasure,
} from './support/measureFixtures'
import { mockAppShell } from './support/mockAppShell'
import { turningMovementCountsResult } from './support/reportFixtures'
import { stubApiHosts } from './support/stubApiHosts'

// Turning Movement Counts is the measure that renders a table as well as a
// chart per movement: the report's table rows are pivoted by direction and
// movement, with per-direction and per-bin totals, a peak-hour strip and
// filters that re-pivot the same rows. Times in the table are the wall
// clock of the fixture's literals, so they are stable across zones.

const LOCATION_IDENTIFIER = '1001'
const START = '2026-04-01T08:00:00'
const END = '2026-04-01T09:00:00'

const chartUrl = () =>
  `/performance-measures?${new URLSearchParams({
    location: LOCATION_IDENTIFIER,
    chartType: 'TurningMovementCounts',
    start: START,
    end: END,
  }).toString()}`

const stubBackend = async (
  page: Page,
  report: unknown = turningMovementCountsResult(START, END)
) => {
  const hosts = await stubApiHosts(page)
  await mockAppShell(page)

  await stubEndpoint(page, {
    host: hosts.config,
    path: '/MeasureType',
    method: 'GET',
    body: odataCollection('MeasureType', [turningMovementCountsMeasure]),
  })
  await stubEndpoint(page, {
    host: hosts.config,
    path: '/Location/GetLocationsForSearch',
    body: odataCollection('SearchLocations', [
      searchLocationWithMeasures([turningMovementCountsMeasure]),
    ]),
  })
  const reports = await stubEndpoint(page, {
    host: hosts.reports,
    path: '/TurningMovementCounts/getReportData',
    method: 'POST',
    body: report,
  })

  return { hosts, reports }
}

const generateCharts = (page: Page) =>
  page.getByRole('button', { name: 'Generate Charts' }).click()

const binSizePicker = (page: Page) =>
  page.getByRole('combobox').filter({ hasText: /^(5|15|60)$/ })

// Both tables end in a Bin Total column; the pivot table comes first in
// the DOM and the peak-hour table is the one captioned Peak Hour.
const pivotTable = (page: Page) =>
  page.getByRole('table').filter({ hasText: 'Bin Total' }).first()
const peakHourTable = (page: Page) =>
  page.getByRole('table').filter({ hasText: 'Peak Hour' })

// The second header row carries the column names; the first is the
// direction dividers.
const columnNames = (table: Locator) =>
  table.getByRole('row').nth(1).getByRole('columnheader')

const rowNamed = (table: Locator, first: string) =>
  table.getByRole('row').filter({
    has: table.page().getByRole('cell', { name: first, exact: true }),
  })

test('renders a chart per movement and the pivoted table with totals and peak hour', async ({
  page,
}) => {
  const { reports } = await stubBackend(page)

  await page.goto(chartUrl())
  await expect(binSizePicker(page)).toHaveText('15')
  await generateCharts(page)

  await expect(page.locator('#chart-0 canvas')).toBeVisible()
  await expect(page.locator('#chart-1 canvas')).toBeVisible()
  await expect(page.locator('#chart-2 canvas')).toBeVisible()
  await expect(page.locator('#chart-3')).toHaveCount(0)

  const table = pivotTable(page)
  await expect(columnNames(table)).toHaveText([
    'Hour',
    'Thru',
    'Right',
    'Total',
    'Thru',
    'Total',
    'Bin Total',
  ])
  await expect(rowNamed(table, '08:00').getByRole('cell')).toHaveText([
    '08:00',
    '100',
    '20',
    '120',
    '80',
    '80',
    '200',
  ])
  await expect(rowNamed(table, 'Total').getByRole('cell')).toHaveText([
    'Total',
    '420',
    '90',
    '510',
    '330',
    '330',
    '840',
  ])

  const peak = peakHourTable(page)
  await expect(peak.locator('caption')).toHaveText('Peak Hour (PHF = 0.92)')
  await expect(rowNamed(peak, '08:00 - 09:00').getByRole('cell')).toHaveText([
    '08:00 - 09:00',
    '420',
    '90',
    '510',
    '330',
    '330',
    '840',
  ])

  expect(reports).toHaveLength(1)
  const options = reports[0].postDataJSON()
  expect(options).toMatchObject({
    locationIdentifier: LOCATION_IDENTIFIER,
    start: START,
    end: END,
    combineThruRight: false,
  })
  expect(Number(options.binSize)).toBe(15)
})

test('bin size and combine thru/thru-right picked in the panel go out in the request', async ({
  page,
}) => {
  const { reports } = await stubBackend(page)

  await page.goto(chartUrl())
  await binSizePicker(page).click()
  await page.getByRole('option', { name: '60' }).click()
  await page
    .getByRole('checkbox', { name: 'Combine Thru and Thru-Right' })
    .check()

  await generateCharts(page)

  await expect(page.locator('#chart-0 canvas')).toBeVisible()
  expect(reports).toHaveLength(1)
  expect(reports[0].postDataJSON()).toMatchObject({
    binSize: 60,
    combineThruRight: true,
  })
})

test('direction filters re-pivot the table', async ({ page }) => {
  await stubBackend(page)

  await page.goto(chartUrl())
  await generateCharts(page)
  const table = pivotTable(page)
  await expect(columnNames(table)).toHaveCount(7)

  // Dropping a direction removes its columns; the bin total follows.
  await page.getByRole('button', { name: 'Southbound' }).click()
  await expect(columnNames(table)).toHaveText([
    'Hour',
    'Thru',
    'Right',
    'Total',
    'Bin Total',
  ])
  await expect(rowNamed(table, '08:00').getByRole('cell')).toHaveText([
    '08:00',
    '100',
    '20',
    '120',
    '120',
  ])
  await page.getByRole('button', { name: 'Southbound' }).click()

  // Combining directions sums the movements across both; the direction
  // row's Combine toggle comes before the movement row's.
  await page.getByRole('button', { name: 'Combine' }).first().click()
  await expect(table.getByRole('row').first()).toContainText(
    'Combined Directions'
  )
  await expect(rowNamed(table, '08:00').getByRole('cell')).toHaveText([
    '08:00',
    '180',
    '20',
    '200',
    '200',
  ])
})

test('the CSV download carries the pivoted table', async ({ page }) => {
  await stubBackend(page)

  await page.goto(chartUrl())
  await generateCharts(page)
  await expect(pivotTable(page)).toBeVisible()

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download CSV' }).click()
  const download = await downloadPromise

  expect(download.suggestedFilename()).toBe(
    'Turning_Movement_Counts_Main_St_400_S_2026-04-01_08-00_to_2026-04-01_09-00.csv'
  )
  const csv = await readFile(await download.path(), 'utf8')
  const lines = csv.split('\n')
  expect(lines[0]).toBe(
    'Hour,Northbound - Thru,Northbound - Right,Northbound - Total,Southbound - Thru,Southbound - Total,Bin Total'
  )
  expect(lines[1]).toBe('08:00,100,20,120,80,80,200')
  expect(lines.at(-1)).toBe('Total,420,90,510,330,330,840')
})

test('an empty result shows the no-data warning without a crash', async ({
  page,
}) => {
  await stubBackend(page, {
    charts: [],
    table: [],
    peakHour: null,
    peakHourFactor: null,
  })

  await page.goto(chartUrl())
  await generateCharts(page)

  await expect(page.getByText('No Data Avaliable')).toBeVisible()
  await expect(page.getByText('Something went wrong')).toHaveCount(0)
  await expect(page.locator('#chart-0')).toHaveCount(0)
})
