// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - waitTime.transformer.test.ts
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
import type { RawWaitTimeResponse } from './types'
import transformWaitTimeData from './waitTime.transformer'

// Wait time: per-termination-cause series plus volumes and plan splits.
// Every field on the generated result type is optional and nullable, so the
// all-null case below is what the report API actually returns for a window
// with no data.

const seriesOf = (chart: EChartsOption) =>
  (chart.series ?? []) as SeriesOption[]

const firstChart = (response: RawWaitTimeResponse) =>
  transformWaitTimeData(response).data.charts[0].chart as EChartsOption

const points = (value: number) => [{ timestamp: '2026-04-01T08:00:00', value }]

const populated = (): RawWaitTimeResponse =>
  ({
    type: ChartType.WaitTime,
    data: [
      {
        locationIdentifier: '1001',
        locationDescription: '1001 - Main St and 400 S',
        start: '2026-04-01T08:00:00',
        end: '2026-04-01T09:00:00',
        approachDescription: 'SB Main St',
        detectionTypes: 'Advance Count',
        plans: [
          {
            start: '2026-04-01T08:00:00',
            end: '2026-04-01T09:00:00',
            planDescription: 'Plan 1',
          },
        ],
        gapOuts: points(12.5),
        maxOuts: points(12.5),
        forceOffs: points(12.5),
        unknowns: points(12.5),
        average: points(12.5),
        volumes: points(12.5),
        planSplits: points(12.5),
      },
    ],
  }) as unknown as RawWaitTimeResponse

const allNull = (): RawWaitTimeResponse =>
  ({
    type: ChartType.WaitTime,
    data: [
      {
        locationIdentifier: null,
        locationDescription: null,
        start: null,
        end: null,
        approachDescription: null,
        detectionTypes: null,
        plans: null,
        gapOuts: null,
        maxOuts: null,
        forceOffs: null,
        unknowns: null,
        average: null,
        volumes: null,
        planSplits: null,
      },
    ],
  }) as unknown as RawWaitTimeResponse

describe('transformWaitTimeData', () => {
  it('builds one chart per result', () => {
    const result = transformWaitTimeData(populated())

    expect(result.type).toBe(ChartType.WaitTime)
    expect(result.data.charts).toHaveLength(1)
    expect(
      seriesOf(result.data.charts[0].chart as EChartsOption).length
    ).toBeGreaterThan(0)
  })

  it('carries data point values through to the series', () => {
    expect(
      seriesOf(firstChart(populated())).map((series) => series.data)
    ).toContainEqual([['2026-04-01T08:00:00', '12.50']])
  })

  it('renders a result whose every optional field is null', () => {
    expect(() => transformWaitTimeData(allNull())).not.toThrow()
    expect(transformWaitTimeData(allNull()).data.charts).toHaveLength(1)
  })

  it('keeps every series present when the result carries no data', () => {
    const populatedCount = seriesOf(firstChart(populated())).length

    expect(seriesOf(firstChart(allNull()))).toHaveLength(populatedCount)
  })

  it('does not leak null or NaN into the rendered title', () => {
    const title = JSON.stringify(firstChart(allNull()).title)

    expect(title).not.toContain('null')
    expect(title).not.toContain('NaN')
  })

  it('handles a response carrying no results at all', () => {
    const empty = {
      type: ChartType.WaitTime,
      data: [],
    } as unknown as RawWaitTimeResponse

    expect(transformWaitTimeData(empty).data.charts).toEqual([])
  })
})
