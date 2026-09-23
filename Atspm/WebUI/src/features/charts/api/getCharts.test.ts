// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - getCharts.test.ts
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
import { ChartOptions, ChartType } from '@/features/charts/common/types'

// The generated report-data fetchers are stubbed so each chart type's route
// through the dispatcher is observable. A duplicate or copy-pasted entry in
// the fetcher record shows up here as the wrong stub being called, which is
// invisible to the type checker because every fetcher shares the same call
// signature.
jest.mock('@/api/reports', () => {
  const names = [
    'getApproachDelayReportData',
    'getApproachSpeedReportData',
    'getApproachVolumeReportData',
    'getArrivalOnRedReportData',
    'getGreenTimeUtilizationReportData',
    'getLeftTurnGapAnalysisReportData',
    'getPedDelayReportData',
    'getPreemptDetailReportData',
    'getPriorityDetailsReportData',
    'getPrioritySummaryReportData',
    'getPurdueCoordinationDiagramReportData',
    'getPurduePhaseTerminationReportData',
    'getRampMeteringReportData',
    'getSplitFailReportData',
    'getSplitMonitorReportData',
    'getTimingAndActuationReportData',
    'getTurningMovementCountsReportData',
    'getWaitTimeReportData',
    'getYellowRedActivationsReportData',
  ]
  return Object.fromEntries(names.map((name) => [name, jest.fn()]))
})

// Kept as an identity passthrough so these tests assert what the dispatcher
// hands the transform layer, not what the transformers do with it.
jest.mock('./transformData', () => ({
  transformChartData: jest.fn((response) => response),
}))

import * as reportsApi from '@/api/reports'
import { getCharts } from './getCharts'
import { transformChartData } from './transformData'

type FetcherName = keyof typeof reportsApi

// The intended ChartType -> generated fetcher wiring, spelled out
// independently of the record under test so a mistake in one doesn't
// silently agree with the other.
const EXPECTED_FETCHER: Record<ChartType, FetcherName> = {
  [ChartType.ApproachDelay]: 'getApproachDelayReportData',
  [ChartType.ApproachSpeed]: 'getApproachSpeedReportData',
  [ChartType.ApproachVolume]: 'getApproachVolumeReportData',
  [ChartType.ArrivalsOnRed]: 'getArrivalOnRedReportData',
  [ChartType.GreenTimeUtilization]: 'getGreenTimeUtilizationReportData',
  [ChartType.LeftTurnGapAnalysis]: 'getLeftTurnGapAnalysisReportData',
  [ChartType.PedestrianDelay]: 'getPedDelayReportData',
  [ChartType.PurdueCoordinationDiagram]:
    'getPurdueCoordinationDiagramReportData',
  [ChartType.PreemptionDetails]: 'getPreemptDetailReportData',
  [ChartType.PriorityDetails]: 'getPriorityDetailsReportData',
  [ChartType.PrioritySummary]: 'getPrioritySummaryReportData',
  [ChartType.PurduePhaseTermination]: 'getPurduePhaseTerminationReportData',
  [ChartType.PurdueSplitFailure]: 'getSplitFailReportData',
  [ChartType.RampMetering]: 'getRampMeteringReportData',
  [ChartType.SplitMonitor]: 'getSplitMonitorReportData',
  [ChartType.TimingAndActuation]: 'getTimingAndActuationReportData',
  [ChartType.TurningMovementCounts]: 'getTurningMovementCountsReportData',
  [ChartType.WaitTime]: 'getWaitTimeReportData',
  [ChartType.YellowAndRedActuations]: 'getYellowRedActivationsReportData',
}

// Filters out interop keys like __esModule so only the stubbed fetchers are
// walked.
const allFetcherNames = () =>
  (Object.keys(reportsApi) as FetcherName[]).filter(
    (name) => typeof reportsApi[name] === 'function'
  )

const asMock = (name: FetcherName) => reportsApi[name] as unknown as jest.Mock

const baseOptions = (): ChartOptions =>
  ({
    locationIdentifier: '1001',
    start: new Date(2026, 3, 1, 8, 0, 0),
    end: new Date(2026, 3, 1, 9, 30, 0),
  }) as unknown as ChartOptions

describe('getCharts dispatch', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    for (const name of allFetcherNames()) {
      asMock(name).mockResolvedValue({ calledBy: name })
    }
  })

  it.each(Object.entries(EXPECTED_FETCHER) as [ChartType, FetcherName][])(
    'routes %s to its own generated fetcher',
    async (type, expectedName) => {
      await getCharts(type, baseOptions())

      expect(asMock(expectedName)).toHaveBeenCalledTimes(1)

      // No other fetcher may fire - this is what catches two chart types
      // sharing one fetcher, or a key/value mismatch in the record.
      const otherCalls = allFetcherNames()
        .filter((name) => name !== expectedName)
        .filter((name) => asMock(name).mock.calls.length > 0)
      expect(otherCalls).toEqual([])
    }
  )

  it('covers every chart type', () => {
    expect(Object.keys(EXPECTED_FETCHER).sort()).toEqual(
      Object.values(ChartType).sort()
    )
  })

  it('gives every chart type a fetcher of its own', () => {
    const used = Object.values(EXPECTED_FETCHER)
    expect(new Set(used).size).toBe(used.length)
  })

  it('hands the fetcher result to the transform layer under its chart type', async () => {
    const result = await getCharts(ChartType.RampMetering, baseOptions())

    expect(transformChartData).toHaveBeenCalledWith({
      type: ChartType.RampMetering,
      data: { calledBy: 'getRampMeteringReportData' },
    })
    expect(result).toEqual({
      type: ChartType.RampMetering,
      data: { calledBy: 'getRampMeteringReportData' },
    })
  })
})

describe('getCharts option normalization', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    for (const name of allFetcherNames()) {
      asMock(name).mockResolvedValue({})
    }
  })

  const sentOptions = async (options: Partial<ChartOptions>) => {
    await getCharts(ChartType.ApproachDelay, {
      ...baseOptions(),
      ...options,
    } as ChartOptions)
    return asMock('getApproachDelayReportData').mock.calls[0][0]
  }

  it('converts "true"/"false" strings to booleans regardless of case', async () => {
    const sent = await sentOptions({
      showPlanStripes: 'true',
      showVolumes: 'FALSE',
      showDataPoints: 'True',
      showAverageLines: 'fAlSe',
    } as unknown as Partial<ChartOptions>)

    expect(sent).toMatchObject({
      showPlanStripes: true,
      showVolumes: false,
      showDataPoints: true,
      showAverageLines: false,
    })
  })

  it('leaves strings that only look boolean-ish untouched', async () => {
    const sent = await sentOptions({
      binSize: '15',
      seriesName: 'truenorth',
      note: ' true ',
    } as unknown as Partial<ChartOptions>)

    expect(sent).toMatchObject({
      binSize: '15',
      seriesName: 'truenorth',
      note: ' true ',
    })
  })

  it('passes non-string values through unchanged', async () => {
    const sent = await sentOptions({
      binSize: 15,
      showVolumes: false,
      phases: [1, 2],
    } as unknown as Partial<ChartOptions>)

    expect(sent).toMatchObject({
      binSize: 15,
      showVolumes: false,
      phases: [1, 2],
    })
  })

  // dateToTimestamp formats wall-clock parts, so the payload must carry the
  // civil time the user picked with no timezone shift applied.
  it('serializes start/end as wall-clock literals', async () => {
    const sent = await sentOptions({})

    expect(sent.start).toBe('2026-04-01T08:00:00')
    expect(sent.end).toBe('2026-04-01T09:30:00')
  })
})
