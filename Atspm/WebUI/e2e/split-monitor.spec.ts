// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - e2e/split-monitor.spec.ts
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
import { splitMonitorMeasure } from './support/measureFixtures'
import {
  END,
  LOCATION_IDENTIFIER,
  START,
  generateCharts,
  measurePageUrl,
  stubMeasurePage,
} from './support/measurePage'
import { splitMonitorResult } from './support/reportFixtures'

// Split Monitor is the first measure that renders a table under its charts:
// PhaseTable lines every phase's plans up side by side, with plan 254
// headed "Free". The one option that feeds the request, the percentile
// split, is an int on the report API, so "None" has to leave as 0.

const chartUrl = () => measurePageUrl('SplitMonitor')

const twoPhases = [
  splitMonitorResult(START, END, { number: 2, description: 'Northbound' }),
  splitMonitorResult(START, END, { number: 6, description: 'Southbound' }),
]

const stubBackend = (page: Page, report: unknown = twoPhases) =>
  stubMeasurePage(page, {
    measure: splitMonitorMeasure,
    reportPath: '/SplitMonitor/getReportData',
    report,
  })

const percentilePicker = (page: Page) =>
  page.getByRole('combobox').filter({ hasText: /^(None|50|75|85|90|95)$/ })

const phaseTable = (page: Page) =>
  page.getByRole('table').filter({ has: page.getByText('Programmed Split') })

test('renders a chart per phase and the phase table, posting the default percentile', async ({
  page,
}) => {
  const { reports } = await stubBackend(page)

  await page.goto(chartUrl())
  await expect(percentilePicker(page)).toHaveText('85')

  await generateCharts(page)

  await expect(page.locator('#chart-0 canvas')).toBeVisible()
  await expect(page.locator('#chart-1 canvas')).toBeVisible()
  await expect(page.locator('#chart-2')).toHaveCount(0)

  // The accordion is collapsed by default; the table is still in the DOM.
  await page.getByRole('button', { name: 'Phase Details' }).click()
  const table = phaseTable(page)
  await expect(table).toBeVisible()

  const header = table.getByRole('row').first()
  await expect(header.getByRole('columnheader')).toHaveText([
    'Phase',
    'Metric',
    'Plan 1',
    'Free',
  ])

  // Nine metric rows per phase, values rounded to one decimal.
  await expect(table.getByRole('row')).toHaveCount(1 + 9 * 2)
  const phase2Skips = table
    .getByRole('row')
    .filter({ has: page.getByRole('cell', { name: 'Skips (%)' }) })
    .first()
  await expect(phase2Skips.getByRole('cell')).toHaveText([
    '2',
    'Skips (%)',
    '4.3',
    '10',
  ])
  // Plan 1 reports force-offs; the free plan reports max-outs instead.
  const phase2Terminations = table
    .getByRole('row')
    .filter({ hasText: 'Force Offs or Max Outs (%)' })
    .first()
  await expect(phase2Terminations.getByRole('cell')).toHaveText([
    '2',
    'Force Offs or Max Outs (%)',
    '35',
    '10',
  ])
  const phase2Fiftieth = table
    .getByRole('row')
    .filter({ hasText: '50th percentile split (sec)' })
    .first()
  await expect(phase2Fiftieth.getByRole('cell')).toHaveText([
    '2',
    '50th percentile split (sec)',
    '26.5',
    '17',
  ])

  expect(reports).toHaveLength(1)
  const options = reports[0].postDataJSON()
  expect(options).toMatchObject({
    locationIdentifier: LOCATION_IDENTIFIER,
    start: START,
    end: END,
  })
  // MeasureOption values are strings and go out as-is; the report API reads
  // numbers from strings.
  expect(Number(options.percentileSplit)).toBe(85)
})

test('a percentile picked in the panel goes out in the request', async ({
  page,
}) => {
  const { reports } = await stubBackend(page)

  await page.goto(chartUrl())
  await percentilePicker(page).click()
  await page.getByRole('option', { name: '50' }).click()
  await expect(percentilePicker(page)).toHaveText('50')

  await generateCharts(page)

  await expect(page.locator('#chart-0 canvas')).toBeVisible()
  expect(reports).toHaveLength(1)
  expect(Number(reports[0].postDataJSON().percentileSplit)).toBe(50)
})

test('"None" goes out as a zero percentile, not the word', async ({ page }) => {
  const { reports } = await stubBackend(page)

  await page.goto(chartUrl())
  await percentilePicker(page).click()
  await page.getByRole('option', { name: 'None' }).click()
  await expect(percentilePicker(page)).toHaveText('None')

  await generateCharts(page)

  await expect(page.locator('#chart-0 canvas')).toBeVisible()
  expect(reports).toHaveLength(1)
  // Not Number(): null would also read as 0.
  expect(String(reports[0].postDataJSON().percentileSplit)).toBe('0')
})

test('a phase with no plans or events renders an empty chart and a planless table', async ({
  page,
}) => {
  await stubBackend(page, [
    {
      ...twoPhases[0],
      plans: null,
      programmedSplits: null,
      gapOuts: null,
      maxOuts: null,
      forceOffs: null,
      unknowns: null,
      peds: null,
    },
  ])

  await page.goto(chartUrl())
  await expect(percentilePicker(page)).toHaveText('85')
  await generateCharts(page)

  await expect(page.locator('#chart-0 canvas')).toBeVisible()
  await expect(page.getByText('Something went wrong')).toHaveCount(0)
  // The phase's nine metric rows still render, with no plan columns.
  await page.getByRole('button', { name: 'Phase Details' }).click()
  const table = phaseTable(page)
  await expect(table.getByRole('row')).toHaveCount(1 + 9)
  await expect(
    table.getByRole('row').first().getByRole('columnheader')
  ).toHaveText(['Phase', 'Metric'])
})
