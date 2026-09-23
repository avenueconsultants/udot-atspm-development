// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - getSMCharts.test.tsx
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

// A function declaration rather than a const: jest.mock calls are hoisted
// above the rest of the module, so an arrow assigned to a const would still
// be in its temporal dead zone when the factories run.
function mockTransformer(name: string) {
  return jest.fn(() => ({ transformedBy: name }))
}

jest.mock('@/api/speedManagement/aTSPMSpeedManagementApi', () => {
  const names = [
    'postApiV1CongestionTrackingGetReportData',
    'postApiV1DataQualityGetReportData',
    'postApiV1EffectivenessOfStrategiesGetReportData',
    'postApiV1SpeedComplianceGetReportData',
    'postApiV1SpeedFromImpactSegmentSegmentId',
    'postApiV1SpeedOverDistanceGetReportData',
    'postApiV1SpeedOverTimeGetReportData',
    'postApiV1SpeedVariabilityGetReportData',
    'postApiV1SpeedViolationsGetReportData',
  ]
  return Object.fromEntries(names.map((name) => [name, jest.fn()]))
})

// Each transformer is stubbed with a value naming it, so a case label
// pointing at the wrong transformer - which the type checker cannot catch,
// since the returns are all cast to SMChartsDataMapping[TChartType] - shows
// up as the wrong tag coming back out.
jest.mock(
  '@/features/charts/speedManagementTool/congestionTracker/congestionTracker.transformer',
  () => ({ transformCongestionTrackerData: mockTransformer('congestion') })
)
jest.mock(
  '@/features/charts/speedManagementTool/speedOverDistance/components/speedOverDistance.transformer',
  () => ({ __esModule: true, default: mockTransformer('overDistance') })
)
jest.mock(
  '@/features/charts/speedManagementTool/speedOverTime/speedOverTime.transformer',
  () => ({ __esModule: true, default: mockTransformer('overTime') })
)
jest.mock(
  '@/features/charts/speedManagementTool/dataQuality/dataQuality.transformer',
  () => ({ __esModule: true, default: mockTransformer('dataQuality') })
)
jest.mock(
  '@/features/charts/speedManagementTool/effectivenessOfStrategies/effectivenessOfStrategies.transformer',
  () => ({ __esModule: true, default: mockTransformer('effectiveness') })
)
jest.mock(
  '@/features/charts/speedManagementTool/speedCompliance/speedCompliance.transformer',
  () => ({ __esModule: true, default: mockTransformer('compliance') })
)
jest.mock(
  '@/features/charts/speedManagementTool/speedVariability/speedVariability.transformer',
  () => ({ __esModule: true, default: mockTransformer('variability') })
)
jest.mock(
  '@/features/charts/speedManagementTool/speedViolations/speedViolations.transformer',
  () => ({ __esModule: true, default: mockTransformer('violations') })
)

import * as smApi from '@/api/speedManagement/aTSPMSpeedManagementApi'
import transformSpeedComplianceData from '@/features/charts/speedManagementTool/speedCompliance/speedCompliance.transformer'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { ReactNode } from 'react'
import { SM_ChartType, useSMCharts } from './getSMCharts'

type Fetcher = keyof typeof smApi

const asMock = (name: Fetcher) => smApi[name] as unknown as jest.Mock

const allFetchers = () =>
  (Object.keys(smApi) as Fetcher[]).filter(
    (name) => typeof smApi[name] === 'function'
  )

// throwOnError is off here (the app's real policy rethrows) so a failing
// queryFn surfaces as result.current.error rather than needing a boundary.
function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, throwOnError: false, gcTime: 0 },
    },
  })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

const options = (over: Record<string, unknown> = {}) =>
  ({
    segmentId: 'seg-1',
    sourceId: [3, 9],
    start: '2026-04-01T08:00:00',
    end: '2026-04-01T09:00:00',
    ...over,
  }) as never

const run = (
  chartType: SM_ChartType | null,
  chartOptions: unknown = options()
) =>
  renderHook(
    () =>
      useSMCharts(
        chartType as SM_ChartType,
        chartOptions as never,
        { enabled: true } as never
      ),
    { wrapper }
  )

beforeEach(() => {
  jest.clearAllMocks()
  for (const name of allFetchers()) {
    asMock(name).mockResolvedValue({ ok: name })
  }
})

// chart type -> [fetcher it must call, tag its transformer returns]
const ROUTES: [SM_ChartType, Fetcher, string][] = [
  [
    SM_ChartType.CONGESTION_TRACKING,
    'postApiV1CongestionTrackingGetReportData',
    'congestion',
  ],
  [
    SM_ChartType.SPEED_OVER_TIME,
    'postApiV1SpeedOverTimeGetReportData',
    'overTime',
  ],
  [
    SM_ChartType.SPEED_OVER_DISTANCE,
    'postApiV1SpeedOverDistanceGetReportData',
    'overDistance',
  ],
  [
    SM_ChartType.SPEED_COMPLIANCE,
    'postApiV1SpeedComplianceGetReportData',
    'compliance',
  ],
  [
    SM_ChartType.DATA_QUALITY,
    'postApiV1DataQualityGetReportData',
    'dataQuality',
  ],
  [
    SM_ChartType.SPEED_VIOLATIONS,
    'postApiV1SpeedViolationsGetReportData',
    'violations',
  ],
  [
    SM_ChartType.SPEED_VARIABILITY,
    'postApiV1SpeedVariabilityGetReportData',
    'variability',
  ],
  [
    SM_ChartType.EFFECTIVENESS_OF_STRATEGIES,
    'postApiV1EffectivenessOfStrategiesGetReportData',
    'effectiveness',
  ],
]

describe('useSMCharts dispatch', () => {
  it.each(ROUTES)(
    'routes %s to its own fetcher and transformer',
    async (chartType, fetcher, tag) => {
      const { result } = run(chartType)

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(asMock(fetcher)).toHaveBeenCalledTimes(1)
      expect(result.current.data).toEqual({ transformedBy: tag })
    }
  )

  it('gives every chart type a fetcher and transformer of its own', () => {
    const fetchers = ROUTES.map(([, fetcher]) => fetcher)
    const tags = ROUTES.map(([, , tag]) => tag)

    expect(new Set(fetchers).size).toBe(fetchers.length)
    expect(new Set(tags).size).toBe(tags.length)
    // Every member of the enum must be routed.
    expect(ROUTES.map(([type]) => type).sort()).toEqual(
      Object.values(SM_ChartType).sort()
    )
  })

  it('does not fetch until the query is enabled', () => {
    renderHook(
      () => useSMCharts(SM_ChartType.DATA_QUALITY, options(), undefined),
      { wrapper }
    )

    expect(
      allFetchers().filter((name) => asMock(name).mock.calls.length)
    ).toEqual([])
  })

  it('reports an unsupported chart type as an error', async () => {
    const { result } = run('Not A Chart' as SM_ChartType)

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toBe(
      'Unsupported chart type: Not A Chart'
    )
  })

  it('reports a null chart type as an error rather than fetching', async () => {
    const { result } = run(null)

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toBe('Unsupported chart type: null')
    expect(
      allFetchers().filter((name) => asMock(name).mock.calls.length)
    ).toEqual([])
  })
})

describe('useSMCharts option handling', () => {
  // Most charts accept the multi-select sourceId array as-is, but these two
  // collapse it to a single id before posting.
  it('collapses sourceId to the first entry for speed over time', async () => {
    const { result } = run(SM_ChartType.SPEED_OVER_TIME)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const impactCall = asMock('postApiV1SpeedFromImpactSegmentSegmentId').mock
      .calls[0]
    expect(impactCall[0]).toBe('seg-1')
    expect(impactCall[1].sourceId).toBe(3)
  })

  it('collapses sourceId to the first entry for speed violations', async () => {
    const { result } = run(SM_ChartType.SPEED_VIOLATIONS)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(
      asMock('postApiV1SpeedViolationsGetReportData').mock.calls[0][0].sourceId
    ).toBe(3)
  })

  it('passes the full sourceId array through for the other charts', async () => {
    const { result } = run(SM_ChartType.DATA_QUALITY)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(
      asMock('postApiV1DataQualityGetReportData').mock.calls[0][0].sourceId
    ).toEqual([3, 9])
  })

  it('fetches both the speed and impact series for speed over time', async () => {
    const { result } = run(SM_ChartType.SPEED_OVER_TIME)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(asMock('postApiV1SpeedOverTimeGetReportData')).toHaveBeenCalledTimes(
      1
    )
    expect(
      asMock('postApiV1SpeedFromImpactSegmentSegmentId')
    ).toHaveBeenCalledTimes(1)
  })

  it('hands the custom speed limit to the compliance transformer', async () => {
    const { result } = run(
      SM_ChartType.SPEED_COMPLIANCE,
      options({ customSpeedLimit: 45 })
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(transformSpeedComplianceData).toHaveBeenCalledWith(
      { ok: 'postApiV1SpeedComplianceGetReportData' },
      45
    )
  })

  // The signature accepts a null chartOptions, and the two sourceId-collapsing
  // branches read chartOptions.sourceId[0] without guarding it. Recorded as an
  // error rather than a crash escaping the hook - react-query catches it - but
  // it is the one input shape the signature allows and the body does not.
  it.each([SM_ChartType.SPEED_OVER_TIME, SM_ChartType.SPEED_VIOLATIONS])(
    'surfaces a null chartOptions on %s as a query error',
    async (chartType) => {
      const { result } = run(chartType, null)

      await waitFor(() => expect(result.current.isError).toBe(true))
      expect(result.current.error).toBeInstanceOf(TypeError)
    }
  )

  it('surfaces a fetcher rejection as a query error', async () => {
    asMock('postApiV1DataQualityGetReportData').mockRejectedValue(
      new Error('report api unavailable')
    )

    const { result } = run(SM_ChartType.DATA_QUALITY)

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toBe('report api unavailable')
  })
})
