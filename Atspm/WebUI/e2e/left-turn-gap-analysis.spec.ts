// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - e2e/left-turn-gap-analysis.spec.ts
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
import { leftTurnGapAnalysisMeasure } from './support/measureFixtures'
import {
  binSizePicker,
  END,
  generateCharts,
  LOCATION_IDENTIFIER,
  measurePageUrl,
  START,
  stubMeasurePage,
} from './support/measurePage'
import { leftTurnGapAnalysisResult } from './support/reportFixtures'

// Left Turn Gap Analysis has the widest option panel so far: a bin size,
// three closed gap bands, one open-ended band and a trend-line threshold,
// every one of which lands in the request body. The gap fields share the
// hidden labels "Gap Start"/"Gap End", so they are addressed by id.

const chartUrl = () => measurePageUrl('LeftTurnGapAnalysis')

const twoApproaches = [
  leftTurnGapAnalysisResult(START, END, {
    id: 1,
    description: 'NB Main St Left',
    phaseNumber: 5,
  }),
  leftTurnGapAnalysisResult(START, END, {
    id: 2,
    description: 'SB Main St Left',
    phaseNumber: 1,
  }),
]

const stubBackend = (page: Page, report: unknown = twoApproaches) =>
  stubMeasurePage(page, {
    measure: leftTurnGapAnalysisMeasure,
    reportPath: '/LeftTurnGapAnalysis/getReportData',
    report,
  })

const gapField = (page: Page, name: string) => page.locator(`#${name}`)

const numeric = (options: Record<string, unknown>, keys: string[]) =>
  Object.fromEntries(keys.map((key) => [key, Number(options[key])]))

const GAP_KEYS = [
  'gap1Min',
  'gap1Max',
  'gap2Min',
  'gap2Max',
  'gap3Min',
  'gap3Max',
  'gap4Min',
  'trendLineGapThreshold',
]

test('renders one chart per approach and posts every seeded gap band', async ({
  page,
}) => {
  const { reports } = await stubBackend(page)

  await page.goto(chartUrl())
  await expect(binSizePicker(page)).toHaveText('15')
  await expect(gapField(page, 'gap1Min')).toHaveValue('1')
  await expect(gapField(page, 'gap3Max')).toHaveValue('7.4')
  await expect(gapField(page, 'gap4Min')).toHaveValue('7.4')
  await expect(page.getByLabel('Trend Line Gap Threshold')).toHaveValue('7.4')

  await generateCharts(page)

  await expect(page.locator('#chart-0 canvas')).toBeVisible()
  await expect(page.locator('#chart-1 canvas')).toBeVisible()
  await expect(page.locator('#chart-2')).toHaveCount(0)

  expect(reports).toHaveLength(1)
  const options = reports[0].postDataJSON()
  expect(options).toMatchObject({
    locationIdentifier: LOCATION_IDENTIFIER,
    start: START,
    end: END,
  })
  expect(Number(options.binSize)).toBe(15)
  expect(numeric(options, GAP_KEYS)).toEqual({
    gap1Min: 1,
    gap1Max: 3.3,
    gap2Min: 3.3,
    gap2Max: 3.7,
    gap3Min: 3.7,
    gap3Max: 7.4,
    gap4Min: 7.4,
    trendLineGapThreshold: 7.4,
  })
})

test('edited gap bands and threshold go out in the request', async ({
  page,
}) => {
  const { reports } = await stubBackend(page)

  await page.goto(chartUrl())
  await gapField(page, 'gap2Max').fill('4.5')
  await gapField(page, 'gap3Min').fill('4.5')
  await gapField(page, 'gap4Min').fill('9')
  await page.getByLabel('Trend Line Gap Threshold').fill('6')
  await binSizePicker(page).click()
  await page.getByRole('option', { name: '60' }).click()

  await generateCharts(page)

  await expect(page.locator('#chart-0 canvas')).toBeVisible()
  expect(reports).toHaveLength(1)
  const options = reports[0].postDataJSON()
  expect(options.binSize).toBe(60)
  expect(numeric(options, GAP_KEYS)).toEqual({
    gap1Min: 1,
    gap1Max: 3.3,
    gap2Min: 3.3,
    gap2Max: 4.5,
    gap3Min: 4.5,
    gap3Max: 7.4,
    gap4Min: 9,
    trendLineGapThreshold: 6,
  })
})

test('an approach with no counts or trend still renders', async ({ page }) => {
  await stubBackend(page, [
    {
      ...twoApproaches[0],
      gap1Count: null,
      gap2Count: null,
      gap3Count: null,
      gap4Count: null,
      percentTurnableSeries: null,
    },
  ])

  await page.goto(chartUrl())
  await generateCharts(page)

  await expect(page.locator('#chart-0 canvas')).toBeVisible()
  await expect(page.getByText('Something went wrong')).toHaveCount(0)
})
