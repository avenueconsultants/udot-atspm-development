// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - yellowAndRedActuations.transformer.test.ts
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
import type { RawYellowAndRedActuationsResponse } from './types'
import transformYellowAndRedActuationsData from './yellowAndRedActuations.transformer'

// YellowRedActivationsResult is fully optional/nullable in the generated
// OpenAPI types, so the transformer normalizes each field on the way in.

const seriesOf = (chart: EChartsOption) =>
  (chart.series ?? []) as SeriesOption[]

const firstChart = (response: RawYellowAndRedActuationsResponse) =>
  transformYellowAndRedActuationsData(response).data.charts[0]
    .chart as EChartsOption

const populated = (): RawYellowAndRedActuationsResponse =>
  ({
    type: ChartType.YellowAndRedActuations,
    data: [
      {
        locationIdentifier: '1001',
        locationDescription: '1001 - Main St & 400 S',
        approachDescription: 'SB Main St',
        start: '2026-04-01T08:00:00',
        end: '2026-04-01T09:00:00',
        totalViolations: 18,
        severeViolations: 4,
        yellowLightOccurences: 96,
        isPermissivePhase: false,
        plans: [
          {
            start: '2026-04-01T08:00:00',
            end: '2026-04-01T09:00:00',
            planDescription: 'Plan 1',
          },
        ],
        yellowEvents: [{ timestamp: '2026-04-01T08:00:00', value: 1.75 }],
        redClearanceEvents: [{ timestamp: '2026-04-01T08:00:00', value: 2.25 }],
        detectorEvents: [{ timestamp: '2026-04-01T08:00:00', value: 0.5 }],
      },
    ],
  }) as unknown as RawYellowAndRedActuationsResponse

const allNull = (): RawYellowAndRedActuationsResponse =>
  ({
    type: ChartType.YellowAndRedActuations,
    data: [
      {
        locationIdentifier: null,
        locationDescription: null,
        approachDescription: null,
        start: null,
        end: null,
        totalViolations: null,
        severeViolations: null,
        yellowLightOccurences: null,
        isPermissivePhase: null,
        plans: null,
        yellowEvents: null,
        redClearanceEvents: null,
        detectorEvents: null,
      },
    ],
  }) as unknown as RawYellowAndRedActuationsResponse

describe('transformYellowAndRedActuationsData', () => {
  it('builds one chart per result', () => {
    const result = transformYellowAndRedActuationsData(populated())

    expect(result.type).toBe(ChartType.YellowAndRedActuations)
    expect(result.data.charts).toHaveLength(1)
  })

  it('carries actuation data points through to the series', () => {
    const rendered = JSON.stringify(seriesOf(firstChart(populated())))

    expect(rendered).toContain('1.75')
    expect(rendered).toContain('2.25')
  })

  it('renders a result whose every optional field is null', () => {
    expect(() => transformYellowAndRedActuationsData(allNull())).not.toThrow()
    expect(
      transformYellowAndRedActuationsData(allNull()).data.charts
    ).toHaveLength(1)
  })

  it('keeps every series present but empty when the result carries no data', () => {
    const populatedSeriesCount = seriesOf(firstChart(populated())).length

    expect(seriesOf(firstChart(allNull()))).toHaveLength(populatedSeriesCount)
  })

  it('substitutes zero for the null violation counts', () => {
    const title = JSON.stringify(firstChart(allNull()).title)

    expect(title).not.toContain('null')
    expect(title).not.toContain('NaN')
  })

  it('handles a response carrying no results at all', () => {
    const empty = {
      type: ChartType.YellowAndRedActuations,
      data: [],
    } as unknown as RawYellowAndRedActuationsResponse

    expect(transformYellowAndRedActuationsData(empty).data.charts).toEqual([])
  })
})
