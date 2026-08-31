// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - transformData.test.ts
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
import { ChartType, ToolType } from '@/features/charts/common/types'

// Every transformer is stubbed with a value that names it, so a case label
// pointing at the wrong transformer - which the type checker cannot catch,
// since they all take a RawChartResponse - surfaces as the wrong tag coming
// back out. Stubbing also keeps this suite about routing rather than
// dragging echarts and every chart's option-building into the run.
//
// This is a function declaration, not a const: jest.mock calls are hoisted
// above the rest of the module, so an arrow assigned to a const would still
// be in its temporal dead zone when the factories run.
function mockStub(name: string) {
  return {
    __esModule: true,
    default: jest.fn(() => ({ transformedBy: name })),
  }
}

jest.mock('@/features/charts/approachDelay/approachDelay.transformer', () =>
  mockStub('approachDelay')
)
jest.mock('@/features/charts/approachSpeed/approachSpeed.transformer', () =>
  mockStub('approachSpeed')
)
jest.mock('@/features/charts/approachVolume/approachVolume.transformer', () =>
  mockStub('approachVolume')
)
jest.mock('@/features/charts/arrivalsOnRed/arrivalsOnRed.transformer', () =>
  mockStub('arrivalsOnRed')
)
jest.mock(
  '@/features/charts/greenTimeUtilization/greenTimeUtilization.transformer',
  () => mockStub('greenTimeUtilization')
)
jest.mock(
  '@/features/charts/leftTurnGapAnalysis/leftTurnGapAnalysis.transformer',
  () => mockStub('leftTurnGapAnalysis')
)
jest.mock('@/features/charts/pedestrianDelay/pedestrianDelay.transformer', () =>
  mockStub('pedestrianDelay')
)
jest.mock(
  '@/features/charts/preemptionDetails/preemptionDetails.transformer',
  () => mockStub('preemptionDetails')
)
jest.mock('@/features/charts/prioritySummary/prioritySummary.transformer', () =>
  mockStub('prioritySummary')
)
jest.mock(
  '@/features/charts/purdueCoordinationDiagram/purdueCoordinationDiagram.transformer',
  () => mockStub('purdueCoordinationDiagram')
)
jest.mock(
  '@/features/charts/purduePhaseTermination/purduePhaseTermination.transformer',
  () => mockStub('purduePhaseTermination')
)
jest.mock(
  '@/features/charts/purdueSplitFailure/purdueSplitFailure.transformer',
  () => mockStub('purdueSplitFailure')
)
jest.mock('@/features/charts/rampMetering/rampMetering.transformer', () =>
  mockStub('rampMetering')
)
jest.mock('@/features/charts/splitMonitor/splitMonitor.tranformer', () =>
  mockStub('splitMonitor')
)
jest.mock(
  '@/features/charts/timingAndActuation/timingAndActuation.transformer',
  () => mockStub('timingAndActuation')
)
jest.mock(
  '@/features/charts/turningMovementCounts/turningMovementCounts.transformer',
  () => mockStub('turningMovementCounts')
)
jest.mock('@/features/charts/waitTime/waitTime.transformer', () =>
  mockStub('waitTime')
)
jest.mock(
  '@/features/charts/yellowAndRedActuations/yellowAndRedActuations.transformer',
  () => mockStub('yellowAndRedActuations')
)
jest.mock(
  '@/features/charts/timeSpaceDiagram/average/timeSpaceAverage.transformer',
  () => mockStub('timeSpaceAverage')
)
jest.mock(
  '@/features/charts/timeSpaceDiagram/historic/timeSpaceHistoric.transformer',
  () => mockStub('timeSpaceHistoric')
)

import type { RawChartResponse } from '@/features/charts/common/types'
import transformRampMeteringData from '@/features/charts/rampMetering/rampMetering.transformer'
import transformTimeSpaceAverageData from '@/features/charts/timeSpaceDiagram/average/timeSpaceAverage.transformer'
import transformTimeSpaceHistoricData from '@/features/charts/timeSpaceDiagram/historic/timeSpaceHistoric.transformer'
import type { RawTimeSpaceDiagramResponse } from '@/features/charts/timeSpaceDiagram/shared/types'
import { transformChartData, transformTimeSpaceData } from './transformData'

const EXPECTED_TRANSFORMER: Record<
  Exclude<ChartType, ChartType.PriorityDetails>,
  string
> = {
  [ChartType.ApproachDelay]: 'approachDelay',
  [ChartType.ApproachSpeed]: 'approachSpeed',
  [ChartType.ApproachVolume]: 'approachVolume',
  [ChartType.ArrivalsOnRed]: 'arrivalsOnRed',
  [ChartType.GreenTimeUtilization]: 'greenTimeUtilization',
  [ChartType.LeftTurnGapAnalysis]: 'leftTurnGapAnalysis',
  [ChartType.PedestrianDelay]: 'pedestrianDelay',
  [ChartType.PreemptionDetails]: 'preemptionDetails',
  [ChartType.PrioritySummary]: 'prioritySummary',
  [ChartType.PurdueCoordinationDiagram]: 'purdueCoordinationDiagram',
  [ChartType.PurduePhaseTermination]: 'purduePhaseTermination',
  [ChartType.PurdueSplitFailure]: 'purdueSplitFailure',
  [ChartType.RampMetering]: 'rampMetering',
  [ChartType.SplitMonitor]: 'splitMonitor',
  [ChartType.TimingAndActuation]: 'timingAndActuation',
  [ChartType.TurningMovementCounts]: 'turningMovementCounts',
  [ChartType.WaitTime]: 'waitTime',
  [ChartType.YellowAndRedActuations]: 'yellowAndRedActuations',
}

describe('transformChartData', () => {
  beforeEach(() => jest.clearAllMocks())

  it.each(Object.entries(EXPECTED_TRANSFORMER) as [ChartType, string][])(
    'routes %s to its own transformer',
    (type, expected) => {
      const response = { type, data: {} } as unknown as RawChartResponse

      expect(transformChartData(response)).toEqual({ transformedBy: expected })
    }
  )

  it('gives every routed chart type a distinct transformer', () => {
    const used = Object.values(EXPECTED_TRANSFORMER)
    expect(new Set(used).size).toBe(used.length)
  })

  it('forwards the raw response to the transformer untouched', () => {
    const response = {
      type: ChartType.RampMetering,
      data: { meteredLanes: [] },
    } as unknown as RawChartResponse

    transformChartData(response)

    expect(transformRampMeteringData).toHaveBeenCalledWith(response)
  })

  // PriorityDetails is a click-driven drill-down that PrioritySummaryChart
  // fetches and transforms itself; it is not a chart this dispatcher builds.
  // If something ever arrives with this type, throwing beats silently
  // rendering the wrong chart.
  it('rejects PriorityDetails, which is a drill-down the summary chart renders itself', () => {
    expect(() =>
      transformChartData({
        type: ChartType.PriorityDetails,
        data: {},
      } as unknown as RawChartResponse)
    ).toThrow('Unknown chart type')
  })

  it('throws for an unrecognized chart type', () => {
    expect(() =>
      transformChartData({
        type: 'NotAChart',
        data: {},
      } as unknown as RawChartResponse)
    ).toThrow('Unknown chart type')
  })
})

describe('transformTimeSpaceData', () => {
  beforeEach(() => jest.clearAllMocks())

  it('routes TimeSpaceHistoric to the historic transformer', () => {
    const response = {
      type: ToolType.TimeSpaceHistoric,
    } as unknown as RawTimeSpaceDiagramResponse

    expect(transformTimeSpaceData(response)).toEqual({
      transformedBy: 'timeSpaceHistoric',
    })
    expect(transformTimeSpaceAverageData).not.toHaveBeenCalled()
  })

  it('routes TimeSpaceAverage to the average transformer', () => {
    const response = {
      type: ToolType.TimeSpaceAverage,
    } as unknown as RawTimeSpaceDiagramResponse

    expect(transformTimeSpaceData(response)).toEqual({
      transformedBy: 'timeSpaceAverage',
    })
    expect(transformTimeSpaceHistoricData).not.toHaveBeenCalled()
  })

  it('passes transform options through to the transformer', () => {
    const response = {
      type: ToolType.TimeSpaceHistoric,
    } as unknown as RawTimeSpaceDiagramResponse
    const options = { speedLimit: 35 }

    transformTimeSpaceData(response, options as never)

    expect(transformTimeSpaceHistoricData).toHaveBeenCalledWith(
      response,
      options
    )
  })

  // LinkPivot/LpPcd/LpTsd are ToolTypes that this dispatcher deliberately
  // does not handle - they have their own transform paths.
  it.each([ToolType.LinkPivot, ToolType.LpPcd, ToolType.LpTsd])(
    'throws for the unhandled tool type %s',
    (type) => {
      expect(() =>
        transformTimeSpaceData({
          type,
        } as unknown as RawTimeSpaceDiagramResponse)
      ).toThrow('Unknown chart type')
    }
  )
})
