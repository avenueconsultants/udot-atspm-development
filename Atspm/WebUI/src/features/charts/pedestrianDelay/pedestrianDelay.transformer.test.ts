// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - pedestrianDelay.transformer.test.ts
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
import transformPedestrianDelayData from './pedestrianDelay.transformer'
import type { RawPedestrianDelayResponse } from './types'

// PedDelayResult comes from the generated OpenAPI types, where every field is
// optional and nullable. The transformer normalizes each one; these tests pin
// that a result with nothing populated still renders instead of throwing.

const seriesOf = (chart: EChartsOption) =>
  (chart.series ?? []) as SeriesOption[]

const firstChart = (response: RawPedestrianDelayResponse) =>
  transformPedestrianDelayData(response).data.charts[0].chart as EChartsOption

const populated = (): RawPedestrianDelayResponse =>
  ({
    type: ChartType.PedestrianDelay,
    data: [
      {
        locationIdentifier: '1001',
        locationDescription: '1001 - Main St & 400 S',
        phaseDescription: 'Phase 4',
        start: '2026-04-01T08:00:00',
        end: '2026-04-01T09:00:00',
        pedPresses: 143,
        cyclesWithPedRequests: 27,
        timeBuffered: 15,
        uniquePedestrianDetections: 31,
        averageDelay: 42.4,
        minDelay: 3.1,
        maxDelay: 88.9,
        plans: [
          {
            start: '2026-04-01T08:00:00',
            end: '2026-04-01T09:00:00',
            planDescription: 'Plan 1',
          },
        ],
        cycleLengths: [{ timestamp: '2026-04-01T08:00:00', value: 120 }],
        pedestrianDelay: [{ timestamp: '2026-04-01T08:00:00', value: 42.4 }],
        startOfWalk: [{ timestamp: '2026-04-01T08:00:00', value: 1 }],
        percentDelayByCycleLength: [
          { timestamp: '2026-04-01T08:00:00', value: 35.3 },
        ],
      },
    ],
  }) as unknown as RawPedestrianDelayResponse

const allNull = (): RawPedestrianDelayResponse =>
  ({
    type: ChartType.PedestrianDelay,
    data: [
      {
        locationIdentifier: null,
        locationDescription: null,
        phaseDescription: null,
        start: null,
        end: null,
        pedPresses: null,
        cyclesWithPedRequests: null,
        timeBuffered: null,
        uniquePedestrianDetections: null,
        averageDelay: null,
        minDelay: null,
        maxDelay: null,
        plans: null,
        cycleLengths: null,
        pedestrianDelay: null,
        startOfWalk: null,
        percentDelayByCycleLength: null,
      },
    ],
  }) as unknown as RawPedestrianDelayResponse

describe('transformPedestrianDelayData', () => {
  it('builds one chart per result', () => {
    const result = transformPedestrianDelayData(populated())

    expect(result.type).toBe(ChartType.PedestrianDelay)
    expect(result.data.charts).toHaveLength(1)
  })

  it('carries delay data points through to a series', () => {
    const chart = firstChart(populated())
    const withData = seriesOf(chart).filter(
      (series) => Array.isArray(series.data) && series.data.length > 0
    )

    expect(withData.length).toBeGreaterThan(0)
    expect(JSON.stringify(withData)).toContain('42.40')
  })

  it('renders a result whose every optional field is null', () => {
    expect(() => transformPedestrianDelayData(allNull())).not.toThrow()
    expect(transformPedestrianDelayData(allNull()).data.charts).toHaveLength(1)
  })

  it('keeps every series present but empty when the result carries no data', () => {
    const populatedSeriesCount = seriesOf(firstChart(populated())).length
    const nullSeries = seriesOf(firstChart(allNull()))

    // Series must not disappear - the legend and axes are built from them,
    // so dropping them changes the chart's shape rather than emptying it.
    expect(nullSeries).toHaveLength(populatedSeriesCount)
  })

  it('substitutes zero for the null summary statistics', () => {
    const chart = firstChart(allNull())

    // The info block is built from pedPresses/averageDelay/etc., all of
    // which default to 0 rather than rendering "null" at the user.
    expect(JSON.stringify(chart.title)).not.toContain('null')
    expect(JSON.stringify(chart.title)).not.toContain('NaN')
  })

  it('handles a response carrying no results at all', () => {
    const empty = {
      type: ChartType.PedestrianDelay,
      data: [],
    } as unknown as RawPedestrianDelayResponse

    expect(transformPedestrianDelayData(empty).data.charts).toEqual([])
  })
})
