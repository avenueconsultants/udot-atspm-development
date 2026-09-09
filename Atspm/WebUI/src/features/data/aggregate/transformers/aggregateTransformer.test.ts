// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - aggregateTransformer.test.ts
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
import { Color, SolidLineSeriesSymbol } from '@/features/charts/utils'
import type { EChartsOption, SeriesOption } from 'echarts'
import type { AggregateOptionsHandler } from '../handlers/aggregateDataHandler'
import { transformData } from './aggregateTransformer'
import type { AggregateData } from '../types/aggregateData'

type LegendWithData = { data?: { name?: string; icon?: string }[] }

// transformData only reads a handful of fields off the handler; the rest of
// AggregateOptionsHandler is UI-state plumbing that this transformer never
// touches, so a partial cast keeps the fixture focused on what's relevant.
const buildHandler = (
  overrides: Partial<AggregateOptionsHandler> = {}
): AggregateOptionsHandler =>
  ({
    updatedLocations: [{ locationIdentifier: '1001' }],
    metricType: 'Detector Activation Count-detectorActivationCount',
    averageOrSum: 0,
    yAxisType: 0,
    visualChartType: 'line',
    ...overrides,
  }) as unknown as AggregateOptionsHandler

const buildData = (series: AggregateData['series']): AggregateData => ({
  identifier: '1001',
  series,
})

describe('transformData (aggregate charts)', () => {
  it('builds a single-series chart with the fixed Color.Green line and a single legend entry', () => {
    const data = buildData([
      {
        identifier: '1001',
        dataPoints: [
          { identifier: '1001', start: '2026-04-01T08:00:00', value: 1.234 },
          { identifier: '1001', start: '2026-04-01T09:00:00', value: 2.5 },
        ],
      },
    ])

    const result = transformData(buildHandler(), data)

    expect((result.legend as LegendWithData).data).toEqual([
      { name: 'detectorActivationCount', icon: SolidLineSeriesSymbol },
    ])

    const series = result.series as SeriesOption[]
    expect(series).toHaveLength(1)
    expect(series[0]).toMatchObject({
      name: 'detectorActivationCount',
      type: 'line',
      color: Color.Green,
    })
    expect(series[0].data).toEqual([
      ['2026-04-01T08:00:00', '1.23'],
      ['2026-04-01T09:00:00', '2.50'],
    ])
  })

  it('builds one series per location for multi-series data, named by identifier with no fixed color', () => {
    const data = buildData([
      {
        identifier: 'loc-A',
        dataPoints: [
          { identifier: 'loc-A', start: '2026-04-01T08:00:00', value: 1 },
        ],
      },
      {
        identifier: 'loc-B',
        dataPoints: [
          { identifier: 'loc-B', start: '2026-04-01T08:00:00', value: 2 },
        ],
      },
    ])

    const result = transformData(buildHandler(), data)

    expect((result.legend as LegendWithData).data).toEqual([
      { name: 'loc-A', icon: SolidLineSeriesSymbol },
      { name: 'loc-B', icon: SolidLineSeriesSymbol },
    ])

    const series = result.series as SeriesOption[]
    expect(series.map((s) => s.name)).toEqual(['loc-A', 'loc-B'])
    expect(series.every((s) => s.color === undefined)).toBe(true)
  })

  it('falls back to a line chart when the handler chart type is unrecognized', () => {
    const data = buildData([
      {
        identifier: '1001',
        dataPoints: [
          { identifier: '1001', start: '2026-04-01T08:00:00', value: 1 },
        ],
      },
    ])

    const result = transformData(
      buildHandler({ visualChartType: 'not-a-real-type' }),
      data
    ) as EChartsOption

    expect((result.series as SeriesOption[])[0].type).toBe('line')
  })
})
