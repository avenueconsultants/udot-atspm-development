// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - e2e/approach-speed.spec.ts
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
  approachSpeedMeasure,
  searchLocationWithMeasures,
} from './support/measureFixtures'
import { mockAppShell } from './support/mockAppShell'
import { approachSpeedResult } from './support/reportFixtures'
import { stubApiHosts } from './support/stubApiHosts'

// Approach Speed is a plain per-approach chart with one option, the bin
// size. It is also the measure whose abbreviation ('Speed') differs most
// from its chart type, so a broken abbreviation map would show up here as
// "Please select a measure" rather than a chart.

const LOCATION_IDENTIFIER = '1001'
const START = '2026-04-01T08:00:00'
const END = '2026-04-01T09:00:00'

const chartUrl = () =>
  `/performance-measures?${new URLSearchParams({
    location: LOCATION_IDENTIFIER,
    chartType: 'ApproachSpeed',
    start: START,
    end: END,
  }).toString()}`

const twoApproaches = [
  approachSpeedResult(START, END, {
    id: 1,
    description: 'NB Main St',
    phaseNumber: 2,
  }),
  approachSpeedResult(START, END, {
    id: 2,
    description: 'SB Main St',
    phaseNumber: 6,
  }),
]

const stubBackend = async (page: Page, report: unknown = twoApproaches) => {
  const hosts = await stubApiHosts(page)
  await mockAppShell(page)

  await stubEndpoint(page, {
    host: hosts.config,
    path: '/MeasureType',
    method: 'GET',
    body: odataCollection('MeasureType', [approachSpeedMeasure]),
  })
  await stubEndpoint(page, {
    host: hosts.config,
    path: '/Location/GetLocationsForSearch',
    body: odataCollection('SearchLocations', [
      searchLocationWithMeasures([approachSpeedMeasure]),
    ]),
  })
  const reports = await stubEndpoint(page, {
    host: hosts.reports,
    path: '/ApproachSpeed/getReportData',
    method: 'POST',
    body: report,
  })

  return { hosts, reports }
}

const binSizePicker = (page: Page) =>
  page.getByRole('combobox').filter({ hasText: /^(5|15|60)$/ })

const generateCharts = (page: Page) =>
  page.getByRole('button', { name: 'Generate Charts' }).click()

test('renders one chart per approach and posts the default bin size', async ({
  page,
}) => {
  const { reports } = await stubBackend(page)

  await page.goto(chartUrl())
  await expect(binSizePicker(page)).toHaveText('15')

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
})

test('a bin size picked in the panel goes out in the request', async ({
  page,
}) => {
  const { reports } = await stubBackend(page)

  await page.goto(chartUrl())
  await binSizePicker(page).click()
  await page.getByRole('option', { name: '60' }).click()
  await expect(binSizePicker(page)).toHaveText('60')

  await generateCharts(page)

  await expect(page.locator('#chart-0 canvas')).toBeVisible()
  expect(reports).toHaveLength(1)
  expect(reports[0].postDataJSON().binSize).toBe(60)
})

test('an approach with no plans or speeds still renders', async ({ page }) => {
  await stubBackend(page, [
    {
      ...twoApproaches[0],
      plans: null,
      averageSpeeds: null,
      eightyFifthSpeeds: null,
      fifteenthSpeeds: null,
    },
  ])

  await page.goto(chartUrl())
  await generateCharts(page)

  await expect(page.locator('#chart-0 canvas')).toBeVisible()
  await expect(page.getByText('Something went wrong')).toHaveCount(0)
})

test('an empty result shows the no-data warning', async ({ page }) => {
  await stubBackend(page, [])

  await page.goto(chartUrl())
  await generateCharts(page)

  await expect(page.getByText('No Data Avaliable')).toBeVisible()
  await expect(page.locator('#chart-0')).toHaveCount(0)
})
