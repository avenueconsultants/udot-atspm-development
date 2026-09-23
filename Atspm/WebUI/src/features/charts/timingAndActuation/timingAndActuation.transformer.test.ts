// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - timingAndActuation.transformer.test.ts
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
import { ChartType } from '@/features/charts/common/types'
import type { TransformedTimingAndActuationResponse } from '@/features/charts/types'
import type { EChartsOption, SeriesOption } from 'echarts'
import transformTimingAndActuationData from './timingAndActuation.transformer'
import type { RawTimingAndActuationResponse } from './types'

// This transformer wraps the generated TimingAndActuationsForPhaseResult in
// two private adapters (toCycles, toBasicDetectors) that flatten nullable
// event collections. It also builds a shared title chart from the first
// result, which is the part that is sensitive to an empty response.

const seriesOf = (chart: EChartsOption) =>
  (chart.series ?? []) as SeriesOption[]

const detector = (name: string) => ({
  name,
  events: [
    { detectorOn: '2026-04-01T08:00:05', detectorOff: '2026-04-01T08:00:07' },
  ],
})

const populated = (): RawTimingAndActuationResponse =>
  ({
    type: ChartType.TimingAndActuation,
    data: [
      {
        locationIdentifier: '1001',
        locationDescription: '1001 - Main St & 400 S',
        approachDescription: 'SB Main St',
        phaseType: 'Phase',
        phaseNumber: 2,
        start: '2026-04-01T08:00:00',
        end: '2026-04-01T09:00:00',
        pedestrianIntervals: [{ start: '2026-04-01T08:00:00', value: 1 }],
        pedestrianEvents: [detector('Ped Detector 1')],
        cycleAllEvents: [{ start: '2026-04-01T08:00:00', value: 1 }],
        advanceCountDetectors: [detector('Advance Count 1')],
        advancePresenceDetectors: [detector('Advance Presence 1')],
        stopBarDetectors: [detector('Stop Bar 1')],
        laneByLanesDetectors: [detector('Lane By Lane 1')],
      },
    ],
  }) as unknown as RawTimingAndActuationResponse

const allNull = (): RawTimingAndActuationResponse =>
  ({
    type: ChartType.TimingAndActuation,
    data: [
      {
        locationIdentifier: null,
        locationDescription: null,
        approachDescription: null,
        phaseType: null,
        phaseNumber: null,
        start: null,
        end: null,
        pedestrianIntervals: null,
        pedestrianEvents: null,
        cycleAllEvents: null,
        advanceCountDetectors: null,
        advancePresenceDetectors: null,
        stopBarDetectors: null,
        laneByLanesDetectors: null,
      },
    ],
  }) as unknown as RawTimingAndActuationResponse

describe('transformTimingAndActuationData', () => {
  it('builds one chart per phase result plus the shared title and legend', () => {
    const result = transformTimingAndActuationData(
      populated()
    ) as TransformedTimingAndActuationResponse

    expect(result.type).toBe(ChartType.TimingAndActuation)
    expect(result.data.charts).toHaveLength(1)
    expect(result.data.title).toBeDefined()
    expect(result.data.legends).toBeDefined()
  })

  it('flattens detector events into series', () => {
    const chart = transformTimingAndActuationData(populated()).data.charts[0]
      .chart as EChartsOption

    expect(seriesOf(chart).length).toBeGreaterThan(0)
    expect(JSON.stringify(chart)).toContain('2026-04-01T08:00:05')
  })

  it('renders a result whose every optional field is null', () => {
    expect(() => transformTimingAndActuationData(allNull())).not.toThrow()
    expect(transformTimingAndActuationData(allNull()).data.charts).toHaveLength(
      1
    )
  })

  it('treats a null detector collection as no detectors rather than throwing', () => {
    const chart = transformTimingAndActuationData(allNull()).data.charts[0]
      .chart as EChartsOption

    expect(chart).toBeDefined()
    expect(JSON.stringify(chart)).not.toContain('undefined')
  })

  // An empty result set is a normal answer from the report API for a window
  // with no data. The shared title chart is built from response.data[0], so
  // this is the case that used to throw before that lookup was guarded.
  it('handles a response carrying no results at all', () => {
    const empty = {
      type: ChartType.TimingAndActuation,
      data: [],
    } as unknown as RawTimingAndActuationResponse

    expect(() => transformTimingAndActuationData(empty)).not.toThrow()

    const result = transformTimingAndActuationData(
      empty
    ) as TransformedTimingAndActuationResponse
    expect(result.data.charts).toEqual([])
    expect(result.data.title).toBeDefined()
  })
})
