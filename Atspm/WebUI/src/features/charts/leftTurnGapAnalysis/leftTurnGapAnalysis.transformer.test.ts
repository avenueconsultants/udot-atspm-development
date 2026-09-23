// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - leftTurnGapAnalysis.transformer.test.ts
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
import transformLeftTurnGapAnalysisData from './leftTurnGapAnalysis.transformer'
import type { RawLeftTurnGapAnalysisResponse } from './types'

// The generated OpenAPI types make every field on LeftTurnGapAnalysisResult
// optional and nullable, so the transformer normalizes each one on the way
// in. These tests pin that normalization: a fully-populated response, and
// the same response with every optional field null - which is what the
// report API actually returns for a window with no data.

const seriesOf = (chart: EChartsOption) =>
  (chart.series ?? []) as SeriesOption[]

const seriesNamed = (chart: EChartsOption, name: string) =>
  seriesOf(chart).find((series) => series.name === name)

const populated = (): RawLeftTurnGapAnalysisResponse =>
  ({
    type: ChartType.LeftTurnGapAnalysis,
    data: [
      {
        locationIdentifier: '1001',
        locationDescription: '1001 - Main St & 400 S',
        approachDescription: 'SB Main St',
        phaseDescription: 'Phase 2',
        detectionTypeDescription: 'Lane By Lane Count',
        start: '2026-04-01T08:00:00',
        end: '2026-04-01T09:00:00',
        gap1Min: 1,
        gap1Max: 3,
        gap2Min: 3,
        gap2Max: 5,
        gap3Min: 5,
        gap3Max: 8,
        gap4Min: 8,
        trendLineGapThreshold: 4,
        gap1Count: [{ timestamp: '2026-04-01T08:00:00', value: 12 }],
        gap2Count: [{ timestamp: '2026-04-01T08:00:00', value: 8 }],
        gap3Count: [{ timestamp: '2026-04-01T08:00:00', value: 4 }],
        gap4Count: [{ timestamp: '2026-04-01T08:00:00', value: 2 }],
        percentTurnableSeries: [
          { timestamp: '2026-04-01T08:00:00', value: 61.5 },
        ],
      },
    ],
  }) as unknown as RawLeftTurnGapAnalysisResponse

const allNull = (): RawLeftTurnGapAnalysisResponse =>
  ({
    type: ChartType.LeftTurnGapAnalysis,
    data: [
      {
        locationIdentifier: null,
        locationDescription: null,
        approachDescription: null,
        phaseDescription: null,
        detectionTypeDescription: null,
        start: null,
        end: null,
        gap1Min: null,
        gap1Max: null,
        gap2Min: null,
        gap2Max: null,
        gap3Min: null,
        gap3Max: null,
        gap4Min: null,
        trendLineGapThreshold: null,
        gap1Count: null,
        gap2Count: null,
        gap3Count: null,
        gap4Count: null,
        percentTurnableSeries: null,
      },
    ],
  }) as unknown as RawLeftTurnGapAnalysisResponse

describe('transformLeftTurnGapAnalysisData', () => {
  it('builds one chart per result with the gap series wired up', () => {
    const result = transformLeftTurnGapAnalysisData(populated())

    expect(result.type).toBe(ChartType.LeftTurnGapAnalysis)
    expect(result.data.charts).toHaveLength(1)

    const chart = result.data.charts[0].chart as EChartsOption
    expect(seriesOf(chart).map((series) => series.name)).toEqual([
      '1-3s',
      '3-5s',
      '5-8s',
      '8s+',
      '% of Green Time\nWhere Gaps ≥ 4s',
    ])
  })

  it('carries data point values through to the series', () => {
    const chart = transformLeftTurnGapAnalysisData(populated()).data.charts[0]
      .chart as EChartsOption

    expect(seriesNamed(chart, '1-3s')?.data).toEqual([
      ['2026-04-01T08:00:00', '12.00'],
    ])
    expect(
      seriesNamed(chart, '% of Green Time\nWhere Gaps ≥ 4s')?.data
    ).toEqual([['2026-04-01T08:00:00', '61.50']])
  })

  it('renders a result whose every optional field is null', () => {
    expect(() => transformLeftTurnGapAnalysisData(allNull())).not.toThrow()

    const result = transformLeftTurnGapAnalysisData(allNull())
    expect(result.data.charts).toHaveLength(1)
  })

  it('falls back to empty series rather than dropping them when counts are null', () => {
    const chart = transformLeftTurnGapAnalysisData(allNull()).data.charts[0]
      .chart as EChartsOption

    // Every series must still exist so the legend and axes stay stable when
    // a location reports no gaps for the window.
    expect(seriesOf(chart)).toHaveLength(5)
    for (const series of seriesOf(chart)) {
      expect(series.data).toEqual([])
    }
  })

  it('substitutes zero for null gap bounds in the legend labels', () => {
    const chart = transformLeftTurnGapAnalysisData(allNull()).data.charts[0]
      .chart as EChartsOption

    expect(seriesOf(chart).map((series) => series.name)).toEqual([
      '0-0s',
      '0-0s',
      '0-0s',
      '0s+',
      '% of Green Time\nWhere Gaps ≥ 0s',
    ])
  })

  it('handles a response carrying no results at all', () => {
    const empty = {
      type: ChartType.LeftTurnGapAnalysis,
      data: [],
    } as unknown as RawLeftTurnGapAnalysisResponse

    expect(transformLeftTurnGapAnalysisData(empty).data.charts).toEqual([])
  })
})
