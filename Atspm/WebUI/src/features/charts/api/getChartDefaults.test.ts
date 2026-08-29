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

import { getMeasureType } from '@/api/config'
import { ChartType } from '@/features/charts/common/types'
import type { Default } from '@/features/charts/types'
import { getChartDefaults } from './getChartDefaults'

// The adapter between GET /MeasureType?expand=measureOptions and what the
// option panels and the report request read: options keyed by name, with
// stored values the report API no longer accepts mapped to ones it does.

const measure = (options: { id: number; option: string; value: string }[]) => ({
  id: 2,
  name: 'Split Monitor',
  abbreviation: 'SM',
  showOnWebsite: true,
  measureOptions: options,
})

// ChartDefaults still types measureOptions as the array the API serves,
// though the adapter keys it by option name; read it as what it is.
const defaultsFor = async (
  options: { id: number; option: string; value: string }[]
) => {
  ;(getMeasureType as jest.Mock).mockResolvedValue([measure(options)])
  const [chart] = await getChartDefaults()
  return {
    ...chart,
    measureOptions: chart.measureOptions as unknown as Record<string, Default>,
  }
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

  it('maps a percentile split stored as the word "None" to 0', async () => {
    const chart = await defaultsFor([
      { id: 1, option: 'percentileSplit', value: 'None' },
    ])

    expect(chart.measureOptions.percentileSplit.value).toBe('0')
  })

  it('leaves every other value alone', async () => {
    const chart = await defaultsFor([
      { id: 1, option: 'percentileSplit', value: '0' },
      { id: 2, option: 'binSize', value: 'None' },
    ])

    expect(chart.measureOptions.percentileSplit.value).toBe('0')
    expect(chart.measureOptions.binSize.value).toBe('None')
  })
})
