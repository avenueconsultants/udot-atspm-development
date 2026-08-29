// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - splitMonitor.tranformer.test.ts
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
import transformSplitMonitorData from './splitMonitor.tranformer'
import type { RawSplitMonitorResponse } from './types'

// Split monitor: programmed splits against each termination cause.
// Every field on the generated result type is optional and nullable, so the
// all-null case below is what the report API actually returns for a window
// with no data.

const seriesOf = (chart: EChartsOption) =>
  (chart.series ?? []) as SeriesOption[]

const firstChart = (response: RawSplitMonitorResponse) =>
  transformSplitMonitorData(response).data.charts[0].chart as EChartsOption

const points = (value: number) => [{ timestamp: '2026-04-01T08:00:00', value }]

const populated = (): RawSplitMonitorResponse =>
  ({
    type: ChartType.SplitMonitor,
    data: [
      {
        locationIdentifier: '1001',
        locationDescription: '1001 - Main St and 400 S',
        start: '2026-04-01T08:00:00',
        end: '2026-04-01T09:00:00',
        phaseDescription: 'Phase 2',
        phaseNumber: 2,
        plans: [
          {
            start: '2026-04-01T08:00:00',
            end: '2026-04-01T09:00:00',
            planDescription: 'Plan 1',
          },
        ],
        programmedSplits: points(12.5),
        gapOuts: points(12.5),
        maxOuts: points(12.5),
        forceOffs: points(12.5),
        unknowns: points(12.5),
        peds: points(12.5),
        percentileSplit: points(12.5),
      },
    ],
  }) as unknown as RawSplitMonitorResponse

const allNull = (): RawSplitMonitorResponse =>
  ({
    type: ChartType.SplitMonitor,
    data: [
      {
        locationIdentifier: null,
        locationDescription: null,
        start: null,
        end: null,
        phaseDescription: null,
        phaseNumber: null,
        plans: null,
        programmedSplits: null,
        gapOuts: null,
        maxOuts: null,
        forceOffs: null,
        unknowns: null,
        peds: null,
        percentileSplit: null,
      },
    ],
  }) as unknown as RawSplitMonitorResponse

const planLabelsOf = (chart: EChartsOption) => {
  const plans = seriesOf(chart).find(
    (series) => series.type === 'scatter' && series.name === 'Plans'
  )
  return ((plans?.data ?? []) as [unknown, unknown, string][]).map(
    ([, , label]) => label
  )
}

describe('transformSplitMonitorData', () => {
  it('omits the percentile line when none was requested', () => {
    const response = populated()
    const [result] = response.data
    Object.assign(result, {
      // "None" goes out and comes back as 0, the int's stand-in for null.
      percentileSplit: 0,
      plans: [{ ...(result.plans ?? [])[0], percentileSplit: 0 }],
    })

    const labels = planLabelsOf(firstChart(response))
    expect(labels).toHaveLength(1)
    expect(labels[0]).not.toMatch(/th %|\{info\|0\}/)
  })

  it('labels the percentile split when one was requested', () => {
    const response = populated()
    const [result] = response.data
    Object.assign(result, {
      percentileSplit: 85,
      plans: [{ ...(result.plans ?? [])[0], percentileSplit: 30.4 }],
    })

    expect(planLabelsOf(firstChart(response))[0]).toContain('30s (85th %)')
  })

  it('builds one chart per result', () => {
    const result = transformSplitMonitorData(populated())

    expect(result.type).toBe(ChartType.SplitMonitor)
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
    expect(() => transformSplitMonitorData(allNull())).not.toThrow()
    expect(transformSplitMonitorData(allNull()).data.charts).toHaveLength(1)
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
      type: ChartType.SplitMonitor,
      data: [],
    } as unknown as RawSplitMonitorResponse

    expect(transformSplitMonitorData(empty).data.charts).toEqual([])
  })
})
