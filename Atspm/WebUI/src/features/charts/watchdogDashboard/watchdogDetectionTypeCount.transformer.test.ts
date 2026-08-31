// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - watchdogDetectionTypeCount.transformer.test.ts
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
import type { DetectionTypeGroup } from '@/api/config'
import type { EChartsOption, PieSeriesOption } from 'echarts'
import transformDetectionTypeCountData from './watchdogDetectionTypeCount.transformer'

// The detection-type sibling of deviceCount.transformer: same pie shape, same
// percentage label built against a running total.

const pie = (chart: EChartsOption) =>
  (chart.series as PieSeriesOption[])[0] as PieSeriesOption

const slices = (chart: EChartsOption) =>
  pie(chart).data as { value: number; name: string }[]

type LabelFormatter = (params: { value: number; name: string }) => string

const labelFor = (chart: EChartsOption, name: string, value: number) => {
  const formatter = (pie(chart).label as { formatter: LabelFormatter })
    .formatter
  return formatter({ name, value })
}

const groups = (
  ...items: Partial<DetectionTypeGroup>[]
): DetectionTypeGroup[] => items as DetectionTypeGroup[]

describe('transformDetectionTypeCountData', () => {
  it('builds one slice per detection type', () => {
    const chart = transformDetectionTypeCountData(
      groups(
        { id: 'Lane By Lane Count', count: 12 },
        { id: 'Advance Count', count: 4 }
      )
    )

    expect(slices(chart)).toEqual([
      { value: 12, name: 'Lane By Lane Count' },
      { value: 4, name: 'Advance Count' },
    ])
  })

  it('names an unidentified detection type rather than rendering null', () => {
    const chart = transformDetectionTypeCountData(
      groups({ id: null, count: 3 })
    )

    expect(slices(chart)[0].name).toBe('Unknown')
  })

  it('treats a null count as zero', () => {
    const chart = transformDetectionTypeCountData(
      groups({ id: 'Advance Count', count: null as unknown as number })
    )

    expect(slices(chart)[0].value).toBe(0)
  })

  it('computes the label percentage against the total', () => {
    const chart = transformDetectionTypeCountData(
      groups({ id: 'A', count: 12 }, { id: 'B', count: 4 })
    )

    expect(labelFor(chart, 'A', 12)).toBe('A\n12 (75.0%)')
  })

  it('does not render a NaN percentage when nothing has been counted', () => {
    const chart = transformDetectionTypeCountData(groups({ id: 'A', count: 0 }))

    expect(labelFor(chart, 'A', 0)).not.toContain('NaN')
  })

  it('handles an empty group list', () => {
    expect(slices(transformDetectionTypeCountData([]))).toEqual([])
  })
})
