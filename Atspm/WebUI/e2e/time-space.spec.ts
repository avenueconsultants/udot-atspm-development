// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - e2e/time-space.spec.ts
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
import type { RouteDto } from '../src/api/config'
import type {
  LinkPivotForTsd,
  TimeSpaceDiagramPhaseResult,
  TimeSpaceDiagramResultForPhase,
} from '../src/api/reports/report-api.schemas'
import { odataCollection } from '../src/test/fixtures/api'
import { stubEndpoint } from './support/api'
import { mockAppShell } from './support/mockAppShell'
import { linkPivotResult } from './support/reportFixtures'
import {
  ROUTE_ID,
  link1001,
  routeEntities,
  routeViewWithDetail,
} from './support/routeFixtures'
import { stubApiHosts } from './support/stubApiHosts'

// The time-space diagram is the deepest report flow: the route list and
// route detail come from the config API, the phase results and the link
// pivot overlay come from two report-API endpoints, and the historic
// transformer has to turn the phase results into a chart. The window is
// passed in the URL, which is also how shared links reproduce a diagram.

const START = '2026-03-14T16:00:00.000Z'
const END = '2026-03-14T16:20:00.000Z'

// The app sends the window as a wall-clock literal in the browser's zone
// (src/utils/dateTime.ts toWallClockDateTimeLiteral). The browser runs on
// this machine, so the expected literal comes from the same local clock.
const wallClock = (iso: string) => {
  const date = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  )
}

const phaseResult = (
  locationIdentifier: string,
  phaseType: 'Primary' | 'Opposing',
  order: number,
  distanceToNextLocation: number,
  distanceToPreviousLocation: number
): TimeSpaceDiagramResultForPhase => ({
  start: '2026-03-14T16:00:00',
  end: '2026-03-14T16:20:00',
  locationIdentifier,
  locationDescription: `${locationIdentifier} - Main St`,
  approachId: order,
  approachDescription: phaseType === 'Primary' ? 'Northbound' : 'Southbound',
  phaseNumber: phaseType === 'Primary' ? 2 : 6,
  speed: 35,
  phaseType,
  direction: phaseType === 'Primary' ? 'Northbound' : 'Southbound',
  distanceToNextLocation,
  distanceToPreviousLocation,
  percentArrivalOnGreen: 50,
  order,
  cycleLength: 90,
  tmcForPhase: { leftTurnEvents: [], rightTurnEvents: [] },
  cycleAllEvents: null,
  pedestrianIntervals: [],
  greenTimeEvents: [],
  laneByLaneCountDetectors: [
    {
      distanceToStopBar: 40,
      detectorOn: '2026-03-14T16:05:00',
      detectorOff: '2026-03-14T16:05:05',
    },
  ],
  advanceCountDetectors: [
    {
      distanceToStopBar: 60,
      detectorOn: '2026-03-14T16:08:00',
      detectorOff: '2026-03-14T16:08:04',
    },
  ],
  stopBarPresenceDetectors: [],
  isPhaseOverLap: false,
  tspNumberCheckins: 0,
  tspNumberCheckouts: 0,
  tspNumberEarlyGreens: 0,
  tspNumberExtendedGreens: 0,
  tspEvents: [],
  priorityAndPreemptionEvents: [],
  srmEntityTracks: [],
  offsetLengthChangeEvents: null,
})

const phaseResults = [
  {
    isSuccess: true,
    error: null,
    result: phaseResult('1001', 'Primary', 1, 1200, 0),
  },
  {
    isSuccess: true,
    error: null,
    result: phaseResult('1002', 'Primary', 2, 0, 1200),
  },
  {
    isSuccess: true,
    error: null,
    result: phaseResult('1002', 'Opposing', 3, 1200, 0),
  },
  {
    isSuccess: true,
    error: null,
    result: phaseResult('1001', 'Opposing', 4, 0, 1200),
  },
] satisfies TimeSpaceDiagramPhaseResult[]

const linkPivotForTsd = [
  { direction: 'Primary', data: linkPivotResult },
] satisfies LinkPivotForTsd[]

const stubBackend = async (
  page: Page,
  route: RouteDto = routeViewWithDetail
) => {
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
    body: route,
  })
  const diagrams = await stubEndpoint(page, {
    host: hosts.reports,
    path: '/TimeSpaceDiagram/getReportData',
    method: 'POST',
    body: phaseResults,
  })
  const pivots = await stubEndpoint(page, {
    host: hosts.reports,
    path: '/LinkPivot/getLinkPivotForTsd',
    method: 'POST',
    body: linkPivotForTsd,
  })

  return { hosts, diagrams, pivots }
}

const historicUrl = (params: Record<string, string> = {}) =>
  `/time-space-diagrams?${new URLSearchParams({
    toolType: 'TimeSpaceHistoric',
    routeId: String(ROUTE_ID),
    start: START,
    end: END,
    ...params,
  }).toString()}`

const generateCharts = (page: Page) =>
  page.getByRole('button', { name: 'Generate Charts' }).click()

test('a route and window from the URL generate the diagram and its link pivot', async ({
  page,
}) => {
  const { diagrams, pivots } = await stubBackend(page)

  await page.goto(historicUrl())
  await expect(page.getByLabel('Route Select')).toHaveValue('Main St corridor')
  await expect(page.getByText('Ready to run')).toBeVisible()

  await generateCharts(page)

  await expect(page.locator('#time-space-chart canvas').first()).toBeVisible()
  await expect(page.getByText('Some phases failed to process')).toHaveCount(0)

  expect(diagrams).toHaveLength(1)
  const options = diagrams[0].postDataJSON()
  expect(options).toMatchObject({
    routeId: ROUTE_ID,
    locationIdentifier: link1001.locationIdentifier,
    extendStartStopSearch: 2,
    showAllLanesInfo: true,
    speedLimit: null,
  })
  // The URL carries instants; the request carries wall-clock literals.
  expect(options.start).toBe(wallClock(START))
  expect(options.end).toBe(wallClock(END))

  // The historic diagram also fetches its link pivot; it lands on a tab.
  expect(pivots).toHaveLength(1)
  expect(pivots[0].postDataJSON()).toMatchObject({ routeId: ROUTE_ID })
  await page.getByRole('tab', { name: 'Link Pivot' }).click()
  await expect(
    page.getByRole('heading', { name: 'Primary Direction' })
  ).toBeVisible()
  // Link 1's adjustment row (the route checker above lists 1001 too, but
  // without the location name).
  await expect(
    page.getByRole('row').filter({ hasText: 'Main St & 400 S' }).first()
  ).toContainText('12')
})

test('a failing diagram request shows the report API message beside the button', async ({
  page,
}) => {
  const { hosts } = await stubBackend(page)
  await stubEndpoint(page, {
    host: hosts.reports,
    path: '/TimeSpaceDiagram/getReportData',
    method: 'POST',
    status: 500,
    body: { message: 'time-space diagram unavailable' },
  })

  await page.goto(historicUrl())
  await expect(page.getByText('Ready to run')).toBeVisible()

  await generateCharts(page)

  await expect(page.getByText('time-space diagram unavailable')).toBeVisible()
  await expect(page.locator('#time-space-chart')).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Generate Charts' })
  ).toBeVisible()
})

test('generating without a route asks for one and sends nothing', async ({
  page,
}) => {
  const { diagrams } = await stubBackend(page)

  await page.goto('/time-space-diagrams')
  await expect(page.getByLabel('Route Select')).toBeVisible()

  await generateCharts(page)

  await expect(page.getByText('Please Select a route')).toBeVisible()
  expect(diagrams).toHaveLength(0)
})

test('a route with a missing distance is flagged before it can run', async ({
  page,
}) => {
  await stubBackend(page, {
    ...routeViewWithDetail,
    routeLocations: [
      {
        ...routeViewWithDetail.routeLocations[0],
        nextLocationDistanceId: null,
        nextLocationDistance: null,
      },
      routeViewWithDetail.routeLocations[1],
    ],
  })

  await page.goto(historicUrl())

  await expect(
    page.getByText('Please configure distances before running.')
  ).toBeVisible()
  await expect(page.getByText('Ready to run')).toHaveCount(0)
})
