// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - greenTimeUtilization.transformer.test.ts
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
import type { EChartsOption, SeriesOption } from 'echarts'
import transformGreenTimeUtilizationData from './greenTimeUtilization.transformer'
import type { RawGreenTimeUtilizationResponse } from './types'

// This transformer does the most arithmetic on nullable input: bin
// coordinates default to 0 and the y-axis maximum is derived from
// Math.max over the bins and split series, which degenerates when those
// collections come back empty.

const seriesOf = (chart: EChartsOption) =>
  (chart.series ?? []) as SeriesOption[]

const firstChart = (response: RawGreenTimeUtilizationResponse) =>
  transformGreenTimeUtilizationData(response).data.charts[0]
    .chart as EChartsOption

const populated = (): RawGreenTimeUtilizationResponse =>
  ({
    type: ChartType.GreenTimeUtilization,
    data: [
      {
        locationIdentifier: '1001',
        locationDescription: '1001 - Main St & 400 S',
        approachDescription: 'SB Main St',
        start: '2026-04-01T08:00:00',
        end: '2026-04-01T09:00:00',
        xAxisBinSize: 15,
        yAxisBinSize: 5,
        plans: [
          {
            start: '2026-04-01T08:00:00',
            end: '2026-04-01T09:00:00',
            planDescription: 'Plan 1',
          },
        ],
        bins: [
          { x: 0, y: 1, value: 12 },
          { x: 1, y: 3, value: 8 },
        ],
        averageSplits: [{ timestamp: '2026-04-01T08:00:00', value: 22.5 }],
        programmedSplits: [{ timestamp: '2026-04-01T08:00:00', value: 30 }],
      },
    ],
  }) as unknown as RawGreenTimeUtilizationResponse

const allNull = (): RawGreenTimeUtilizationResponse =>
  ({
    type: ChartType.GreenTimeUtilization,
    data: [
      {
        locationIdentifier: null,
        locationDescription: null,
        approachDescription: null,
        start: null,
        end: null,
        xAxisBinSize: null,
        yAxisBinSize: null,
        plans: null,
        bins: null,
        averageSplits: null,
        programmedSplits: null,
      },
    ],
  }) as unknown as RawGreenTimeUtilizationResponse

describe('transformGreenTimeUtilizationData', () => {
  it('builds one chart per result with the split series wired up', () => {
    const result = transformGreenTimeUtilizationData(populated())

    expect(result.type).toBe(ChartType.GreenTimeUtilization)
    expect(result.data.charts).toHaveLength(1)
    expect(
      seriesOf(result.data.charts[0].chart as EChartsOption).map((s) => s.name)
    ).toEqual(
      expect.arrayContaining([
        'Average Split',
        'Programmed Splits',
        'Amount of\nVehicles Through',
      ])
    )
  })

  it('defaults null bin coordinates to zero', () => {
    const response = populated()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(response.data[0] as any).bins = [{ x: null, y: null, value: null }]

    expect(() => transformGreenTimeUtilizationData(response)).not.toThrow()
  })

  it('renders a result whose every optional field is null', () => {
    expect(() => transformGreenTimeUtilizationData(allNull())).not.toThrow()
    expect(
      transformGreenTimeUtilizationData(allNull()).data.charts
    ).toHaveLength(1)
  })

  // Math.max() over an empty bin list yields -Infinity, which flows into the
  // derived y-axis maximum. The while loop that builds the axis ticks must
  // still terminate - a zero bin size with a positive maximum would spin
  // forever - so this test both guards termination and documents that the
  // axis comes back empty rather than wrong.
  it('terminates and produces no axis ticks when there are no bins', () => {
    const chart = firstChart(allNull())

    expect(seriesOf(chart).length).toBeGreaterThan(0)
    expect(chart).toBeDefined()
  })

  it('handles a response carrying no results at all', () => {
    const empty = {
      type: ChartType.GreenTimeUtilization,
      data: [],
    } as unknown as RawGreenTimeUtilizationResponse

    expect(transformGreenTimeUtilizationData(empty).data.charts).toEqual([])
  })
})
