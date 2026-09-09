// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - e2e/chart-toolbox.spec.ts
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
  greenTimeUtilizationMeasure,
  purduePhaseTerminationMeasure,
  waitTimeMeasure,
} from './support/measureFixtures'
import {
  END,
  generateCharts,
  measurePageUrl,
  START,
  stubMeasurePage,
} from './support/measurePage'
import {
  greenTimeUtilizationResult,
  purduePhaseTerminationResult,
  waitTimeResult,
} from './support/reportFixtures'

// The toolbox above the charts is shared by every measure that renders
// more than one chart, or one chart that supports bin step lines. It
// carries the zoom and bin-step toggles, the switch to the location's
// configuration, and a dropdown listing each chart by name.

const twoApproaches = [
  waitTimeResult(START, END, {
    id: 1,
    description: 'NB Main St',
    phaseNumber: 2,
  }),
  waitTimeResult(START, END, {
    id: 2,
    description: 'SB Main St',
    phaseNumber: 6,
  }),
]

const stubWaitTime = (page: Page) =>
  stubMeasurePage(page, {
    measure: waitTimeMeasure,
    reportPath: '/WaitTime/getReportData',
    report: twoApproaches,
  })

const runWaitTime = async (page: Page) => {
  await stubWaitTime(page)
  await page.goto(measurePageUrl('WaitTime'))
  await generateCharts(page)
  await expect(page.locator('#chart-0 canvas').first()).toBeVisible()
}

const chartsDropdown = (page: Page) =>
  page.getByRole('button', { name: 'Charts', exact: true })

test('the toolbox carries the zoom and bin step toggles', async ({ page }) => {
  await runWaitTime(page)

  await expect(page.getByRole('checkbox', { name: 'Sync Zoom' })).toBeVisible()
  const binStepLines = page.getByRole('checkbox', { name: 'Bin Step Lines' })
  await expect(binStepLines).toBeVisible()
  await expect(binStepLines).not.toBeChecked()

  await binStepLines.check()
  await expect(binStepLines).toBeChecked()

  // The charts survive the redraw the toggle triggers.
  await expect(page.locator('#chart-0 canvas').first()).toBeVisible()
})

test('bin step lines are withheld from a measure that does not support them', async ({
  page,
}) => {
  await stubMeasurePage(page, {
    measure: greenTimeUtilizationMeasure,
    reportPath: '/GreenTimeUtilization/getReportData',
    report: [
      greenTimeUtilizationResult(START, END, {
        id: 1,
        description: 'NB Main St',
        phaseNumber: 2,
      }),
      greenTimeUtilizationResult(START, END, {
        id: 2,
        description: 'SB Main St',
        phaseNumber: 6,
      }),
    ],
  })

  await page.goto(measurePageUrl('GreenTimeUtilization'))
  await generateCharts(page)
  await expect(page.locator('#chart-0 canvas').first()).toBeVisible()

  // Two charts, so the toolbox is there - but without the toggle.
  await expect(page.getByRole('checkbox', { name: 'Sync Zoom' })).toBeVisible()
  await expect(
    page.getByRole('checkbox', { name: 'Bin Step Lines' })
  ).toHaveCount(0)
})

test('a lone chart without bin step support gets no toolbox', async ({
  page,
}) => {
  await stubMeasurePage(page, {
    measure: purduePhaseTerminationMeasure,
    reportPath: '/PurduePhaseTermination/getReportData',
    report: purduePhaseTerminationResult(START, END),
  })

  await page.goto(measurePageUrl('PurduePhaseTermination'))
  await generateCharts(page)
  await expect(page.locator('#chart-0 canvas').first()).toBeVisible()

  await expect(page.getByRole('checkbox', { name: 'Sync Zoom' })).toHaveCount(0)
  await expect(chartsDropdown(page)).toHaveCount(0)
})

test('the chart dropdown lists each chart and hides the one it is asked to', async ({
  page,
}) => {
  await runWaitTime(page)

  await chartsDropdown(page).click()
  // Exactly, because "Hide NB Main St" sits beside it in the same row.
  await expect(
    page.getByRole('button', { name: 'NB Main St', exact: true })
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'SB Main St', exact: true })
  ).toBeVisible()

  // Hiding collapses that chart's container, leaving the other alone.
  // The container is the box the results component holds a ref to, three
  // levels above the chart's own node: box > paper > echarts wrapper.
  const firstStrip = page.locator('#chart-0').locator('xpath=../../..')
  await expect(firstStrip).toHaveCSS('max-height', '1000px')

  await page.getByRole('button', { name: 'Hide NB Main St' }).click()
  await expect(firstStrip).toHaveCSS('max-height', '0px')
  await expect(page.locator('#chart-1 canvas').first()).toBeVisible()

  await page.getByRole('button', { name: 'Show NB Main St' }).click()
  await expect(firstStrip).toHaveCSS('max-height', '1000px')
})

test('View Config swaps the charts for the location configuration', async ({
  page,
}) => {
  await runWaitTime(page)

  await page.getByRole('button', { name: 'View Config' }).click()
  await expect(page.getByRole('button', { name: 'View Charts' })).toBeVisible()

  await page.getByRole('button', { name: 'View Charts' }).click()
  await expect(page.getByRole('button', { name: 'View Config' })).toBeVisible()
  await expect(page.locator('#chart-0 canvas').first()).toBeVisible()
})
