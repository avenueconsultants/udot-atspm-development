// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - e2e/support/timeSpace.ts
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
import type { Page, Request } from '@playwright/test'
import type { RouteDto } from '../../src/api/config'
import type {
  LinkPivotForTsd,
  TimeSpaceDiagramAveragePhaseResult,
  TimeSpaceDiagramAverageResult,
  TimeSpaceDiagramPhaseResult,
  TimeSpaceDiagramResultForPhase,
} from '../../src/api/reports/report-api.schemas'
import { odataCollection } from '../../src/test/fixtures/api'
import { stubEndpoint, type ApiHosts } from './api'
import { mockAppShell } from './mockAppShell'
import { linkPivotResult } from './reportFixtures'
import { ROUTE_ID, routeEntities, routeViewWithDetail } from './routeFixtures'
import { stubApiHosts } from './stubApiHosts'

// The historic time-space diagram, as every spec that drives it needs it: the
// two-location corridor from routeFixtures, a twenty-minute window passed in
// the URL, and one phase result per direction per location. The SRM, GPX and
// cycle-dragging specs all start from this same run, so the fixtures and the
// backend stub live here rather than in whichever spec needed them first.

export const HISTORIC_START = '2026-03-14T16:00:00.000Z'
export const HISTORIC_END = '2026-03-14T16:20:00.000Z'

// The app sends the window as a wall-clock literal in the browser's zone
// (src/utils/dateTime.ts toWallClockDateTimeLiteral). The browser runs on
// this machine, so the expected literal comes from the same local clock.
export const wallClock = (iso: string) => {
  const date = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  )
}

export const historicPhaseResult = (
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
  srmEntityTracks: null,
  offsetLengthChangeEvents: null,
})

// 1001 and 1002 in both directions, ordered the way the report API returns
// them: down the primary direction, then back up the opposing one.
export const historicPhaseResults = [
  {
    isSuccess: true,
    error: null,
    result: historicPhaseResult('1001', 'Primary', 1, 1200, 0),
  },
  {
    isSuccess: true,
    error: null,
    result: historicPhaseResult('1002', 'Primary', 2, 0, 1200),
  },
  {
    isSuccess: true,
    error: null,
    result: historicPhaseResult('1002', 'Opposing', 3, 1200, 0),
  },
  {
    isSuccess: true,
    error: null,
    result: historicPhaseResult('1001', 'Opposing', 4, 0, 1200),
  },
] satisfies TimeSpaceDiagramPhaseResult[]

export const linkPivotForTsd = [
  { direction: 'Primary', data: linkPivotResult },
] satisfies LinkPivotForTsd[]

interface TimeSpaceHistoricStub {
  /** The route detail behind GetRouteView; defaults to the whole corridor. */
  route?: RouteDto
  /** What the diagram endpoint answers; defaults to all four phases. */
  report?: TimeSpaceDiagramPhaseResult[]
}

// Keeps the page off the live API hosts and answers the four requests a
// historic run makes: the route list, the route detail, the diagram and the
// link pivot overlay. Hands back the request lists so a spec can assert what
// was sent, and the hosts for any further endpoint it needs stubbed.
export const stubTimeSpaceHistoric = async (
  page: Page,
  {
    route = routeViewWithDetail,
    report = historicPhaseResults,
  }: TimeSpaceHistoricStub = {}
): Promise<{ hosts: ApiHosts; diagrams: Request[]; pivots: Request[] }> => {
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
    body: report,
  })
  const pivots = await stubEndpoint(page, {
    host: hosts.reports,
    path: '/LinkPivot/getLinkPivotForTsd',
    method: 'POST',
    body: linkPivotForTsd,
  })

  return { hosts, diagrams, pivots }
}

export const historicUrl = (params: Record<string, string> = {}) =>
  `/time-space-diagrams?${new URLSearchParams({
    toolType: 'TimeSpaceHistoric',
    routeId: String(ROUTE_ID),
    start: HISTORIC_START,
    end: HISTORIC_END,
    ...params,
  }).toString()}`

export const generateCharts = (page: Page) =>
  page.getByRole('button', { name: 'Generate Charts' }).click()

// --- 50th percentile ------------------------------------------------------
//
// The same corridor run through the average tool: a month of weekdays with a
// time-of-day window. The dates are formatted with UTC getters and the times
// with local ones (src/utils/searchParams.ts), and both round-trip through
// the URL, so nothing here depends on the runner's zone.

export const AVERAGE_START_DATE = '2026-03-01'
export const AVERAGE_END_DATE = '2026-03-31'
export const AVERAGE_START_TIME = '16:00:00'
export const AVERAGE_END_TIME = '16:20:00'
export const AVERAGE_WEEKDAYS = [1, 2, 3, 4, 5]

export const DEFAULT_SEQUENCE = [
  [1, 2, 3, 4],
  [5, 6, 7, 8],
]
export const DEFAULT_COORDINATED_PHASES = [2, 6]

export const averageResult = (
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

export const averagePhaseResults = [
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

interface TimeSpaceAverageStub {
  /** What the average endpoint answers; defaults to all four phases. */
  report?: TimeSpaceDiagramAveragePhaseResult[]
}

// The average tool's equivalent of stubTimeSpaceHistoric. The historic
// endpoint is stubbed too and handed back, because a request there would mean
// the wrong tool ran.
export const stubTimeSpaceAverage = async (
  page: Page,
  { report = averagePhaseResults }: TimeSpaceAverageStub = {}
): Promise<{ hosts: ApiHosts; averages: Request[]; historics: Request[] }> => {
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
    body: report,
  })
  const historics = await stubEndpoint(page, {
    host: hosts.reports,
    path: '/TimeSpaceDiagram/getReportData',
    method: 'POST',
    body: [],
  })

  return { hosts, averages, historics }
}

// Everything the average handler reads back off the URL, so a run reproduces
// a shared link rather than the defaults.
export const averageUrl = (params: Record<string, string> = {}) => {
  const search = new URLSearchParams({
    toolType: 'TimeSpaceAverage',
    routeId: String(ROUTE_ID),
    startDate: AVERAGE_START_DATE,
    endDate: AVERAGE_END_DATE,
    startTime: AVERAGE_START_TIME,
    endTime: AVERAGE_END_TIME,
    ...params,
  })
  AVERAGE_WEEKDAYS.forEach((day) => search.append('daysOfWeek', String(day)))
  return `/time-space-diagrams?${search.toString()}`
}
