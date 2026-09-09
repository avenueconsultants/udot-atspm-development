// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - priorityDetails.transformer.test.ts
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
import type { PriorityDetailsResult } from '@/api/reports'
import { ChartType } from '@/features/charts/common/types'
import type { EChartsOption } from 'echarts'
import transformPriorityDetailsData from './priorityDetails.transformer'

// This is the click-driven drill-down from the priority summary chart. It
// bypasses the getCharts dispatcher entirely - PrioritySummaryChart calls
// getPriorityDetailsReportData directly - so nothing else exercises it.
// The fetcher resolves to a bare PriorityDetailsResult[], which is what this
// transformer reads.

const row = (
  over: Partial<PriorityDetailsResult> = {}
): PriorityDetailsResult =>
  ({
    locationIdentifier: '1001',
    locationDescription: '1001 - Main St & 400 S',
    start: '2026-04-01T08:00:00Z',
    end: '2026-04-01T09:00:00Z',
    phaseNumber: 2,
    isPhaseOverLap: false,
    cycleEvents: [],
    tspEvents: [],
    priorityAndPreemptionEvents: [],
    ...over,
  }) as unknown as PriorityDetailsResult

const chartOf = (rows: PriorityDetailsResult[]) =>
  transformPriorityDetailsData(rows).data.charts[0].chart as EChartsOption

// The chart carries two category axes - a TSP-number axis on the top grid
// and the phase-number axis on the bottom one - so the row categories have
// to be read off the named axis rather than the first one found.
const yAxisCategories = (chart: EChartsOption): string[] => {
  const axes = Array.isArray(chart.yAxis) ? chart.yAxis : [chart.yAxis]
  const phaseAxis = axes.find(
    (axis) => (axis as { name?: string })?.name === 'Phase Number'
  )
  const data = (phaseAxis as { data?: unknown })?.data
  return Array.isArray(data) ? (data as string[]) : []
}

describe('transformPriorityDetailsData', () => {
  it('returns a single chart tagged as PriorityDetails', () => {
    const result = transformPriorityDetailsData([row()])

    expect(result.type).toBe(ChartType.PriorityDetails)
    expect(result.data.charts).toHaveLength(1)
  })

  it('titles the chart from the first row', () => {
    const chart = chartOf([row()])

    expect(JSON.stringify(chart.title)).toContain('1001 - Main St & 400 S')
  })

  it('builds one row category per phase, in first-seen order', () => {
    const chart = chartOf([
      row({ phaseNumber: 2 }),
      row({ phaseNumber: 6 }),
      row({ phaseNumber: 2 }),
    ])

    expect(yAxisCategories(chart)).toEqual(['2', '6'])
  })

  // Overlap phases share a number with their parent phase, so they are
  // prefixed to keep them on their own row rather than collapsing together.
  it('prefixes overlap phases so they get their own category', () => {
    const chart = chartOf([
      row({ phaseNumber: 2, isPhaseOverLap: false }),
      row({ phaseNumber: 2, isPhaseOverLap: true }),
    ])

    expect(yAxisCategories(chart)).toEqual(['2', 'O2'])
  })

  it('spans the chart across the widest window any row reports', () => {
    const chart = chartOf([
      row({ start: '2026-04-01T08:30:00Z', end: '2026-04-01T08:45:00Z' }),
      row({ start: '2026-04-01T08:00:00Z', end: '2026-04-01T09:00:00Z' }),
    ])

    const serialized = JSON.stringify(chart)
    expect(serialized).toContain('2026-04-01T08:00:00.000Z')
    expect(serialized).toContain('2026-04-01T09:00:00.000Z')
  })

  it('renders an empty drill-down without throwing', () => {
    expect(() => transformPriorityDetailsData([])).not.toThrow()
    expect(transformPriorityDetailsData([]).data.charts).toHaveLength(1)
  })

  // getChartRangeMs seeds its min/max from rows[0] and only replaces them
  // with values that parse. An unparseable first row therefore left them NaN,
  // and new Date(NaN).toISOString() throws RangeError - taking down the whole
  // drill-down rather than showing an empty window.
  it('survives a first row whose timestamps do not parse', () => {
    expect(() =>
      transformPriorityDetailsData([
        row({ start: 'not-a-date', end: 'also-not-a-date' }),
      ])
    ).not.toThrow()
  })

  it('survives rows with missing timestamps', () => {
    expect(() =>
      transformPriorityDetailsData([
        row({ start: undefined, end: undefined }),
        row(),
      ])
    ).not.toThrow()
  })

  it('treats null cycle and event lists as empty', () => {
    expect(() =>
      transformPriorityDetailsData([
        row({
          cycleEvents: null,
          tspEvents: null,
          priorityAndPreemptionEvents: null,
        }),
      ])
    ).not.toThrow()
  })
})
