// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - deviceCount.transformer.test.ts
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
import type { DeviceGroup } from '@/api/config'
import type { EChartsOption, PieSeriesOption } from 'echarts'
import transformDeviceCountData from './deviceCount.transformer'

// DeviceGroup is a generated config type, so manufacturer/model/firmware and
// the count are all nullable. The transformer builds a pie slice per group
// and a percentage label against the running total.

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

const groups = (...items: Partial<DeviceGroup>[]): DeviceGroup[] =>
  items as DeviceGroup[]

describe('transformDeviceCountData', () => {
  it('builds one slice per device group', () => {
    const chart = transformDeviceCountData(
      groups(
        {
          manufacturer: 'Econolite',
          model: 'Cobalt',
          firmware: '4.2',
          count: 30,
        },
        { manufacturer: 'Siemens', model: 'M60', firmware: '2.1', count: 10 }
      )
    )

    expect(slices(chart)).toEqual([
      { value: 30, name: 'Econolite: \nCobalt - 4.2' },
      { value: 10, name: 'Siemens: \nM60 - 2.1' },
    ])
  })

  it('labels each unknown part of the name rather than rendering null', () => {
    const chart = transformDeviceCountData(
      groups({ manufacturer: null, model: null, firmware: null, count: 5 })
    )

    expect(slices(chart)[0].name).toBe('Unknown: \nUnknown - Unknown')
    expect(slices(chart)[0].value).toBe(5)
  })

  it('treats a null count as zero', () => {
    const chart = transformDeviceCountData(
      groups({ manufacturer: 'Econolite', count: null as unknown as number })
    )

    expect(slices(chart)[0].value).toBe(0)
  })

  it('computes the label percentage against the total', () => {
    const chart = transformDeviceCountData(groups({ count: 30 }, { count: 10 }))

    expect(labelFor(chart, 'Econolite', 30)).toBe('Econolite\n30 (75.0%)')
  })

  // An empty dashboard is a normal state before any device reports in. The
  // label formatter divides by the running total, so a zero total must not
  // put "NaN%" in front of the user.
  it('does not render a NaN percentage when nothing has been counted', () => {
    const chart = transformDeviceCountData(groups({ count: 0 }))

    expect(slices(chart)).toEqual([
      { value: 0, name: 'Unknown: \nUnknown - Unknown' },
    ])
    expect(labelFor(chart, 'Unknown', 0)).not.toContain('NaN')
  })

  it('handles an empty group list', () => {
    const chart = transformDeviceCountData([])

    expect(slices(chart)).toEqual([])
  })
})
