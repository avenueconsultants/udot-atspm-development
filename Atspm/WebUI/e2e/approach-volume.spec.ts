// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - e2e/approach-volume.spec.ts
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
import { approachVolumeMeasure } from './support/measureFixtures'
import {
  binSizePicker,
  END,
  generateCharts,
  LOCATION_IDENTIFIER,
  measurePageUrl,
  START,
  stubMeasurePage,
} from './support/measurePage'
import { approachVolumeResult } from './support/reportFixtures'

// Approach Volume pairs opposing directions: one result per pair, each
// rendering a chart with the peak-hour summary table beneath it. The
// summary is nullable on the contract, which the last test pins down.

const chartUrl = () => measurePageUrl('ApproachVolume')

const twoPairs = [
  approachVolumeResult(START, END, {
    primary: 'Northbound',
    opposing: 'Southbound',
    detectorType: 'Advanced Count',
  }),
  approachVolumeResult(START, END, {
    primary: 'Eastbound',
    opposing: 'Westbound',
    detectorType: 'Lane By Lane Count',
  }),
]

const stubBackend = (page: Page, report: unknown = twoPairs) =>
  stubMeasurePage(page, {
    measure: approachVolumeMeasure,
    reportPath: '/ApproachVolume/getReportData',
    report,
  })

const peakHourTables = (page: Page) =>
  page.getByRole('table').filter({ hasText: 'Peak Hour K Factor' })

test('renders a chart and peak hour table per direction pair, posting the defaults', async ({
  page,
}) => {
  const { reports } = await stubBackend(page)

  await page.goto(chartUrl())
  await expect(binSizePicker(page)).toHaveText('15')

  await generateCharts(page)

  await expect(page.locator('#chart-0 canvas')).toBeVisible()
  await expect(page.locator('#chart-1 canvas')).toBeVisible()
  await expect(page.locator('#chart-2')).toHaveCount(0)

  // Each pair's summary sits in its own accordion, collapsed by default.
  const summaries = page.getByRole('button', { name: 'Peak Hour Data' })
  await expect(summaries).toHaveCount(2)
  await summaries.first().click()

  const table = peakHourTables(page).first()
  await expect(
    table.getByRole('row').first().getByRole('columnheader')
  ).toHaveText(['', 'Total', 'Northbound', 'Southbound'])
  // Factors are fixed to three decimals, volumes are localised.
  await expect(
    table
      .getByRole('row')
      .filter({ hasText: 'Peak Hour K Factor' })
      .getByRole('cell')
  ).toHaveText(['Peak Hour K Factor', '0.092', '0.094', '0.091'])
  await expect(
    table
      .getByRole('row')
      .filter({ hasText: 'Peak Hour D Factor' })
      .getByRole('cell')
  ).toHaveText(['Peak Hour D Factor', '-', '0.560', '0.440'])
  await expect(
    table.getByRole('row').filter({ hasText: 'Total Volume' }).getByRole('cell')
  ).toHaveText(['Total Volume', '3,000', '1,680', '1,320'])

  expect(reports).toHaveLength(1)
  const options = reports[0].postDataJSON()
  expect(options).toMatchObject({
    locationIdentifier: LOCATION_IDENTIFIER,
    start: START,
    end: END,
    showAdvanceDetection: true,
    showDirectionalSplits: true,
    showNbEbVolume: true,
    showSbWbVolume: true,
    showTMCDetection: true,
    showTotalVolume: false,
  })
  expect(Number(options.binSize)).toBe(15)
})

test('a bin size picked in the panel goes out in the request', async ({
  page,
}) => {
  const { reports } = await stubBackend(page)

  await page.goto(chartUrl())
  await binSizePicker(page).click()
  await page.getByRole('option', { name: '60' }).click()

  await generateCharts(page)

  await expect(page.locator('#chart-0 canvas')).toBeVisible()
  expect(reports).toHaveLength(1)
  expect(reports[0].postDataJSON().binSize).toBe(60)
})

test('a pair with no summary data still renders its chart and table', async ({
  page,
}) => {
  await stubBackend(page, [{ ...twoPairs[0], summaryData: null }])

  await page.goto(chartUrl())
  await generateCharts(page)

  await expect(page.locator('#chart-0 canvas')).toBeVisible()
  await expect(page.getByText('Something went wrong')).toHaveCount(0)

  await page.getByRole('button', { name: 'Peak Hour Data' }).click()
  const table = peakHourTables(page).first()
  await expect(
    table
      .getByRole('row')
      .filter({ hasText: 'Peak Hour K Factor' })
      .getByRole('cell')
  ).toHaveText(['Peak Hour K Factor', 'N/A', 'N/A', 'N/A'])
  await expect(
    table.getByRole('row').filter({ hasText: 'Total Volume' }).getByRole('cell')
  ).toHaveText(['Total Volume', 'N/A', 'N/A', 'N/A'])
})
