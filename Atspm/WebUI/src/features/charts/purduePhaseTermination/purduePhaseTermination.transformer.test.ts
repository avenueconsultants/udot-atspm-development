// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - purduePhaseTermination.transformer.test.ts
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
import transformPurduePhaseTerminationData from './purduePhaseTermination.transformer'
import type { RawPurduePhaseTerminationResponse } from './types'

// Phase termination: one chart for the whole location, a scatter series per
// termination type, each point placed on its phase's row. Every field on the
// generated result type is optional and nullable, so the all-null case below
// is what the report API actually returns for a window with no data.

const seriesOf = (chart: EChartsOption) =>
  (chart.series ?? []) as SeriesOption[]

const seriesNamed = (chart: EChartsOption, name: string) =>
  seriesOf(chart).find((series) => series.name === name)

const chartOf = (response: RawPurduePhaseTerminationResponse) =>
  transformPurduePhaseTerminationData(response).data.charts[0]
    .chart as EChartsOption

const phase = (
  phaseNumber: number,
  events: Partial<
    Record<
      | 'gapOuts'
      | 'maxOuts'
      | 'forceOffs'
      | 'pedWalkBegins'
      | 'unknownTerminations',
      string[]
    >
  > = {}
) => ({
  phaseNumber,
  gapOuts: [],
  maxOuts: [],
  forceOffs: [],
  pedWalkBegins: [],
  unknownTerminations: [],
  ...events,
})

const populated = (): RawPurduePhaseTerminationResponse =>
  ({
    type: ChartType.PurduePhaseTermination,
    data: {
      locationIdentifier: '1123',
      locationDescription: '#1123 - Wolcott St/ 1455 E & 100 South',
      start: '2026-04-08T00:00:00',
      end: '2026-04-09T00:00:00',
      consecutiveCount: 1,
      plans: [
        {
          planNumber: '1',
          planDescription: 'Plan 1',
          start: '2026-04-08T05:30:00',
          end: '2026-04-08T07:00:00',
        },
      ],
      phases: [
        phase(2, { gapOuts: ['2026-04-08T06:00:00'] }),
        phase(4, {
          forceOffs: ['2026-04-08T07:00:00'],
          unknownTerminations: ['2026-04-08T11:40:00'],
        }),
      ],
    },
  }) as unknown as RawPurduePhaseTerminationResponse

const allNull = (): RawPurduePhaseTerminationResponse =>
  ({
    type: ChartType.PurduePhaseTermination,
    data: {
      locationIdentifier: null,
      locationDescription: null,
      start: null,
      end: null,
      consecutiveCount: null,
      plans: null,
      phases: null,
    },
  }) as unknown as RawPurduePhaseTerminationResponse

const TERMINATION_SERIES = [
  'Gap Outs',
  'Force Offs',
  'Max Outs',
  'Ped Walk Begins',
  'Unknown Terminations',
]

describe('transformPurduePhaseTerminationData', () => {
  it('builds one chart with a series per termination type', () => {
    const result = transformPurduePhaseTerminationData(populated())

    expect(result.type).toBe(ChartType.PurduePhaseTermination)
    expect(result.data.charts).toHaveLength(1)

    const names = seriesOf(result.data.charts[0].chart as EChartsOption).map(
      (series) => series.name
    )
    expect(names).toEqual(expect.arrayContaining(TERMINATION_SERIES))
  })

  it('places each termination on the row of its phase', () => {
    const chart = chartOf(populated())

    expect(seriesNamed(chart, 'Gap Outs')?.data).toEqual([
      ['2026-04-08T06:00:00', 0],
    ])
    expect(seriesNamed(chart, 'Force Offs')?.data).toEqual([
      ['2026-04-08T07:00:00', 1],
    ])
    expect(seriesNamed(chart, 'Unknown Terminations')?.data).toEqual([
      ['2026-04-08T11:40:00', 1],
    ])
    expect(seriesNamed(chart, 'Max Outs')?.data).toEqual([])
  })

  it('lists the phase numbers on the category axis', () => {
    const chart = chartOf(populated())
    const yAxis = Array.isArray(chart.yAxis) ? chart.yAxis[0] : chart.yAxis

    expect((yAxis as { data?: unknown }).data).toEqual([2, 4])
  })

  it('renders a result whose every optional field is null', () => {
    expect(() => transformPurduePhaseTerminationData(allNull())).not.toThrow()
    expect(
      transformPurduePhaseTerminationData(allNull()).data.charts
    ).toHaveLength(1)
  })

  it('keeps every series present when no phase has any events', () => {
    const quiet = populated()
    quiet.data.phases = [phase(2), phase(4)]

    const names = seriesOf(chartOf(quiet)).map((series) => series.name)
    expect(names).toEqual(expect.arrayContaining(TERMINATION_SERIES))
    for (const name of TERMINATION_SERIES) {
      expect(seriesNamed(chartOf(quiet), name)?.data).toEqual([])
    }
  })

  it('does not leak null or NaN into the rendered title', () => {
    const title = JSON.stringify(chartOf(allNull()).title)

    expect(title).not.toContain('null')
    expect(title).not.toContain('NaN')
  })
})
