// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - getChartDefaults.test.ts
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
jest.mock('@/api/config', () => ({ getMeasureType: jest.fn() }))

import { getMeasureType, MeasureOption, MeasureType } from '@/api/config'
import { ChartType } from '@/features/charts/common/types'
import { getChartDefaults } from './getChartDefaults'

// The adapter between GET /MeasureType?expand=measureOptions and what the
// option panels and the report request read: options keyed by name, with
// stored values the report API no longer accepts mapped to ones it does.

const measure = (options: MeasureOption[]): MeasureType => ({
  id: 2,
  name: 'Split Monitor',
  abbreviation: 'SM',
  showOnWebsite: true,
  measureOptions: options,
})

const defaultsFor = async (options: MeasureOption[]) => {
  ;(getMeasureType as jest.Mock).mockResolvedValue([measure(options)])
  const [chart] = await getChartDefaults()
  return chart
}

describe('getChartDefaults', () => {
  it('keys the options by name and resolves the chart type', async () => {
    const chart = await defaultsFor([
      { id: 1, option: 'percentileSplit', value: '85' },
      { id: 2, option: 'yAxisDefault', value: '100' },
    ])

    expect(chart.chartType).toBe(ChartType.SplitMonitor)
    expect(chart.measureOptions.percentileSplit).toEqual({
      id: 1,
      option: 'percentileSplit',
      value: '85',
    })
    expect(chart.measureOptions.yAxisDefault.value).toBe('100')
  })

  // The panel offered "None" until the report API's int field made it
  // unsendable; both the word and the 0 it was briefly sent as fall back
  // to the seeded percentile, so a stored default still names a choice
  // the panel offers.
  it.each(['None', '0'])(
    'maps a percentile split stored as %p to the seeded 85th',
    async (stored) => {
      const chart = await defaultsFor([
        { id: 1, option: 'percentileSplit', value: stored },
      ])

      expect(chart.measureOptions.percentileSplit.value).toBe('85')
    }
  )

  it('leaves every other value alone', async () => {
    const chart = await defaultsFor([
      { id: 1, option: 'percentileSplit', value: '50' },
      { id: 2, option: 'binSize', value: 'None' },
    ])

    expect(chart.measureOptions.percentileSplit.value).toBe('50')
    expect(chart.measureOptions.binSize.value).toBe('None')
  })
})

it('handles a measure with no expanded options', async () => {
  jest
    .mocked(getMeasureType)
    .mockResolvedValue([{ id: 1, measureOptions: null }])
  expect(await getChartDefaults()).toEqual([
    { id: 1, chartType: 'Unknown', measureOptions: {} },
  ])
})

it('omits incomplete defaults and keeps valid zero and empty-string values', async () => {
  const chart = await defaultsFor([
    { option: 'missingId', value: '15' },
    { id: 2, option: null, value: '15' },
    { id: 3, option: 'missingValue', value: null },
    { id: 4, option: 'zero', value: '0' },
    { id: 5, option: 'empty', value: '' },
  ])
  expect(Object.keys(chart.measureOptions)).toEqual(['zero', 'empty'])
  expect(chart.measureOptions.zero.value).toBe('0')
  expect(chart.measureOptions.empty.value).toBe('')
})
