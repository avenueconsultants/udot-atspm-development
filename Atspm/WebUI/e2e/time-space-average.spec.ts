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
import type {
  TimeSpaceDiagramAveragePhaseResult,
  TimeSpaceDiagramAverageResult,
} from '../src/api/reports/report-api.schemas'
import { odataCollection } from '../src/test/fixtures/api'
import { stubEndpoint } from './support/api'
import { mockAppShell } from './support/mockAppShell'
import {
  ROUTE_ID,
  routeEntities,
  routeViewWithDetail,
} from './support/routeFixtures'
import { stubApiHosts } from './support/stubApiHosts'

// The 50th percentile tab shares the route picker, the results container and
// the chart shell with the historic tool covered in time-space.spec.ts, but
// nothing else: it posts to its own endpoint with a date range plus a
// time-of-day window and a per-location sequence and coordinated-phase list,
// and it has no link pivot. What this spec pins is that request body - the
// shape assembled by the sequence/coordination table is the whole point of
// the tab - and the two guards that stop it being sent.

// A month of weekdays between 16:00 and 16:20. The dates are formatted with
// UTC getters and the times with local ones (src/utils/searchParams.ts), and
// both round-trip through the URL, so nothing here depends on the runner's
// zone.
const START_DATE = '2026-03-01'
const END_DATE = '2026-03-31'
const START_TIME = '16:00:00'
const END_TIME = '16:20:00'
const WEEKDAYS = [1, 2, 3, 4, 5]

const DEFAULT_SEQUENCE = [
  [1, 2, 3, 4],
  [5, 6, 7, 8],
]
const DEFAULT_COORDINATED_PHASES = [2, 6]

const averageResult = (
  locationIdentifier: string,
  phaseType: 'Primary' | 'Opposing',
  order: number,
  distanceToNextLocation: number,
  distanceToPreviousLocation: number
): TimeSpaceDiagramAverageResult => ({
  // The average tool reports one representative cycle, so its window is the
  // time-of-day period rather than the whole date range.
  start: '2026-03-02T16:00:00',
  end: '2026-03-02T16:20:00',
  locationIdentifier,
  locationDescription: `${locationIdentifier} - Main St`,
  approachId: order,
  approachDescription: phaseType === 'Primary' ? 'Northbound' : 'Southbound',
  coordinatedPhases: true,
  phaseNumber: phaseType === 'Primary' ? 2 : 6,
  speed: 35,
  offset: 12,
  programmedSplit: 45,
  phaseType,
  cycleLength: 90,
  direction: phaseType === 'Primary' ? 'Northbound' : 'Southbound',
  distanceToNextLocation,
  distanceToPreviousLocation,
  order,
  cycleAllEvents: [
    { start: '2026-03-02T16:00:00', value: 1 },
    { start: '2026-03-02T16:00:30', value: 8 },
    { start: '2026-03-02T16:01:00', value: 11 },
  ],
  greenTimeEvents: [
    { initialX: '2026-03-02T16:00:05', isDetectorOn: true },
    { initialX: '2026-03-02T16:00:25', isDetectorOn: false },
  ],
})

const averageResults = [
  {
    isSuccess: true,
    error: null,
    result: averageResult('1001', 'Primary', 1, 1200, 0),
  },
  {
    isSuccess: true,
    error: null,
    result: averageResult('1002', 'Primary', 2, 0, 1200),
  },
  {
    isSuccess: true,
    error: null,
    result: averageResult('1002', 'Opposing', 3, 1200, 0),
  },
  {
    isSuccess: true,
    error: null,
    result: averageResult('1001', 'Opposing', 4, 0, 1200),
  },
] satisfies TimeSpaceDiagramAveragePhaseResult[]

const stubBackend = async (page: Page) => {
  const hosts = await stubApiHosts(page)
  await mockAppShell(page)

  await stubEndpoint(page, {
    host: hosts.config,
    path: '/Route',
    method: 'GET',
    body: odataCollection('Route', routeEntities),
  })
  await stubEndpoint(page, {
    host: hosts.config,
    path: `/GetRouteView/${ROUTE_ID}`,
    body: routeViewWithDetail,
  })
  const averages = await stubEndpoint(page, {
    host: hosts.reports,
    path: '/TimeSpaceDiagramAverage/getReportData',
    method: 'POST',
    body: averageResults,
  })
  // The historic endpoint shares the page but not the tab; a request here
  // would mean the wrong tool ran.
  const historics = await stubEndpoint(page, {
    host: hosts.reports,
    path: '/TimeSpaceDiagram/getReportData',
    method: 'POST',
    body: [],
  })

  return { hosts, averages, historics }
}

// Everything the handler reads back off the URL, so a run reproduces a
// shared link rather than the defaults.
const averageUrl = (params: Record<string, string> = {}) => {
  const search = new URLSearchParams({
    toolType: 'TimeSpaceAverage',
    routeId: String(ROUTE_ID),
    startDate: START_DATE,
    endDate: END_DATE,
    startTime: START_TIME,
    endTime: END_TIME,
    ...params,
  })
  WEEKDAYS.forEach((day) => search.append('daysOfWeek', String(day)))
  return `/time-space-diagrams?${search.toString()}`
}

const generateCharts = (page: Page) =>
  page.getByRole('button', { name: 'Generate Charts' }).click()

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
  const { averages, historics } = await stubBackend(page)

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
    startDate: START_DATE,
    endDate: END_DATE,
    startTime: START_TIME,
    endTime: END_TIME,
    speedLimit: null,
    daysOfWeek: WEEKDAYS,
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
  const { averages } = await stubBackend(page)

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
  const { averages } = await stubBackend(page)

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
  const { averages } = await stubBackend(page)

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
  const { averages } = await stubBackend(page)

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
  const { averages } = await stubBackend(page)

  await page.goto('/time-space-diagrams?toolType=TimeSpaceAverage')
  await expect(page.getByLabel('Route Select')).toBeVisible()

  await generateCharts(page)

  await expect(page.getByText('Please Select a route')).toBeVisible()
  expect(averages).toHaveLength(0)
})

test('a failing average request shows the report API message beside the button', async ({
  page,
}) => {
  const { hosts } = await stubBackend(page)
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
