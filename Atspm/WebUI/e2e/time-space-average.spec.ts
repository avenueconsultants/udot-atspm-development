// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - e2e/time-space-average.spec.ts
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
import { ROUTE_ID } from './support/routeFixtures'
import {
  AVERAGE_END_DATE,
  AVERAGE_END_TIME,
  AVERAGE_START_DATE,
  AVERAGE_START_TIME,
  AVERAGE_WEEKDAYS,
  averageUrl,
  DEFAULT_COORDINATED_PHASES,
  DEFAULT_SEQUENCE,
  generateCharts,
  stubTimeSpaceAverage,
} from './support/timeSpace'

// The 50th percentile tab shares the route picker, the results container and
// the chart shell with the historic tool covered in time-space.spec.ts, but
// nothing else: it posts to its own endpoint with a date range plus a
// time-of-day window and a per-location sequence and coordinated-phase list,
// and it has no link pivot. What this spec pins is that request body - the
// shape assembled by the sequence/coordination table is the whole point of
// the tab - and the two guards that stop it being sent. The fixtures and the
// backend stub live in e2e/support/timeSpace.ts.

const sequenceSelect = (page: Page, locationIdentifier: string) =>
  page.getByRole('combobox', {
    name: `Sequence for location ${locationIdentifier}`,
  })

const coordinatedPhasesSelect = (page: Page, locationIdentifier: string) =>
  page.getByRole('combobox', {
    name: `Coordinated phases for location ${locationIdentifier}`,
  })

test('a route and window from the URL run the 50th percentile tool', async ({
  page,
}) => {
  const { averages, historics } = await stubTimeSpaceAverage(page)

  await page.goto(averageUrl())
  await expect(
    page.getByRole('tab', { name: '50th Percentile' })
  ).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByLabel('Route Select')).toHaveValue('Main St corridor')

  await generateCharts(page)

  await expect(page.locator('#time-space-chart canvas').first()).toBeVisible()
  await expect(page.getByText('Some phases failed to process')).toHaveCount(0)

  expect(averages).toHaveLength(1)
  expect(averages[0].postDataJSON()).toEqual({
    // The picker hands the id over as a string; the generated options want
    // the number.
    routeId: ROUTE_ID,
    startDate: AVERAGE_START_DATE,
    endDate: AVERAGE_END_DATE,
    startTime: AVERAGE_START_TIME,
    endTime: AVERAGE_END_TIME,
    speedLimit: null,
    daysOfWeek: AVERAGE_WEEKDAYS,
    sequence: ['1001', '1002'].map((locationIdentifier) => ({
      locationIdentifier,
      sequence: DEFAULT_SEQUENCE,
    })),
    coordinatedPhases: ['1001', '1002'].map((locationIdentifier) => ({
      locationIdentifier,
      coordinatedPhases: DEFAULT_COORDINATED_PHASES,
    })),
  })

  // This tool has no link pivot: neither the request nor the tab exists.
  expect(historics).toHaveLength(0)
  await expect(page.getByRole('tab', { name: 'Link Pivot' })).toHaveCount(0)
})

test('a shared link runs the sequence it carries, not the route defaults', async ({
  page,
}) => {
  const { averages } = await stubTimeSpaceAverage(page)

  // The page writes these two params itself on every run, so this is the
  // link a user shares after editing the table.
  const sharedSequence = [
    {
      locationIdentifier: '1001',
      sequence: [
        [2, 1, 4, 3],
        [5, 6, 7, 8],
      ],
    },
    { locationIdentifier: '1002', sequence: DEFAULT_SEQUENCE },
  ]
  const sharedCoordinatedPhases = [
    { locationIdentifier: '1001', coordinatedPhases: [1, 5] },
    {
      locationIdentifier: '1002',
      coordinatedPhases: DEFAULT_COORDINATED_PHASES,
    },
  ]

  await page.goto(
    averageUrl({
      sequence: JSON.stringify(sharedSequence),
      coordinatedPhases: JSON.stringify(sharedCoordinatedPhases),
    })
  )
  await expect(page.getByLabel('Route Select')).toHaveValue('Main St corridor')
  // The table shows what the link asked for rather than the presets the
  // route seeding would otherwise have put back.
  await expect(sequenceSelect(page, '1001')).toHaveText('Sequence 4')
  await expect(coordinatedPhasesSelect(page, '1001')).toHaveText('1,5')

  await generateCharts(page)

  expect(averages).toHaveLength(1)
  expect(averages[0].postDataJSON()).toMatchObject({
    sequence: sharedSequence,
    coordinatedPhases: sharedCoordinatedPhases,
  })
})

test('a sequence and coordinated phases picked per location travel in the request', async ({
  page,
}) => {
  const { averages } = await stubTimeSpaceAverage(page)

  await page.goto(averageUrl())
  await expect(sequenceSelect(page, '1001')).toBeVisible()

  // Sequence 4 swaps both phase pairs of ring 1 and leaves ring 2 alone; 1002
  // is left on the default so the request has to carry the two apart.
  await sequenceSelect(page, '1001').click()
  await page.getByRole('option', { name: 'Sequence 4' }).click()
  await coordinatedPhasesSelect(page, '1001').click()
  await page.getByRole('option', { name: '1,5', exact: true }).click()

  await generateCharts(page)

  await expect(page.locator('#time-space-chart canvas').first()).toBeVisible()

  expect(averages).toHaveLength(1)
  expect(averages[0].postDataJSON()).toMatchObject({
    sequence: [
      {
        locationIdentifier: '1001',
        sequence: [
          [2, 1, 4, 3],
          [5, 6, 7, 8],
        ],
      },
      { locationIdentifier: '1002', sequence: DEFAULT_SEQUENCE },
    ],
    coordinatedPhases: [
      { locationIdentifier: '1001', coordinatedPhases: [1, 5] },
      {
        locationIdentifier: '1002',
        coordinatedPhases: DEFAULT_COORDINATED_PHASES,
      },
    ],
  })
})

test('rings typed by hand and a deselected day reach the request', async ({
  page,
}) => {
  const { averages } = await stubTimeSpaceAverage(page)

  await page.goto(averageUrl())
  await expect(sequenceSelect(page, '1002')).toBeVisible()

  await sequenceSelect(page, '1002').click()
  await page.getByRole('option', { name: 'Custom' }).click()

  // The two ring fields share their labels across every row, so they are
  // addressed inside the row for the location being edited.
  const row1002 = page
    .getByRole('row')
    .filter({ has: coordinatedPhasesSelect(page, '1002') })
  await row1002.getByLabel('Ring 1').fill('4,3,2,1')
  await row1002.getByLabel('Ring 2').fill('8,7,6,5')

  await page.getByRole('checkbox', { name: 'Wed' }).uncheck()

  await generateCharts(page)

  await expect(page.locator('#time-space-chart canvas').first()).toBeVisible()

  expect(averages).toHaveLength(1)
  const options = averages[0].postDataJSON()
  expect(options.sequence).toContainEqual({
    locationIdentifier: '1002',
    sequence: [
      [4, 3, 2, 1],
      [8, 7, 6, 5],
    ],
  })
  expect(options.daysOfWeek).toEqual([1, 2, 4, 5])
})

test('a cleared time of day blocks the run instead of crashing the page', async ({
  page,
}) => {
  const { averages } = await stubTimeSpaceAverage(page)

  await page.goto(averageUrl())
  await expect(page.getByLabel('Start Time')).toHaveValue('16:00')

  await page.getByLabel('Start Time').clear()

  // The page keeps rendering: formatTime has to survive a null Date for the
  // guard below to be reachable at all.
  await expect(page.getByText('Select start and end time ranges')).toBeVisible()
  await expect(page.getByLabel('Route Select')).toHaveValue('Main St corridor')

  await generateCharts(page)

  expect(averages).toHaveLength(0)
  await expect(page.locator('#time-space-chart')).toHaveCount(0)
})

test('generating without a route asks for one and sends nothing', async ({
  page,
}) => {
  const { averages } = await stubTimeSpaceAverage(page)

  await page.goto('/time-space-diagrams?toolType=TimeSpaceAverage')
  await expect(page.getByLabel('Route Select')).toBeVisible()

  await generateCharts(page)

  await expect(page.getByText('Please Select a route')).toBeVisible()
  expect(averages).toHaveLength(0)
})

test('a failing average request shows the report API message beside the button', async ({
  page,
}) => {
  const { hosts } = await stubTimeSpaceAverage(page)
  await stubEndpoint(page, {
    host: hosts.reports,
    path: '/TimeSpaceDiagramAverage/getReportData',
    method: 'POST',
    status: 500,
    body: { message: '50th percentile diagram unavailable' },
  })

  await page.goto(averageUrl())
  await expect(page.getByLabel('Route Select')).toHaveValue('Main St corridor')

  await generateCharts(page)

  await expect(
    page.getByText('50th percentile diagram unavailable')
  ).toBeVisible()
  await expect(page.locator('#time-space-chart')).toHaveCount(0)
})
