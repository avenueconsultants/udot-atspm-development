// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - SplitMonitorChartOptions.test.tsx
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
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SplitMonitorChartOptions } from './SplitMonitorChartOptions'

const setYAxisMaxStore = jest.fn()

jest.mock('@/stores/charts', () => ({
  __esModule: true,
  useChartsStore: () => ({
    setYAxisMaxStore,
    yAxisMaxStore: '100',
  }),
}))

const chartDefaults = {
  percentileSplit: { id: 58, value: '85', option: 'percentileSplit' },
  yAxisDefault: { id: 116, value: '100', option: 'yAxisDefault' },
}

// Every choice the panel offers is a percentile the report API's int
// field can carry; "None" was retired because it could not be sent.
describe('SplitMonitorChartOptions', () => {
  it('sends a picked percentile through as its value', async () => {
    const user = userEvent.setup()
    const handleChartOptionsUpdate = jest.fn()

    render(
      <SplitMonitorChartOptions
        chartDefaults={chartDefaults}
        handleChartOptionsUpdate={handleChartOptionsUpdate}
      />
    )

    expect(screen.getByRole('combobox')).toHaveTextContent('85')
    await user.click(screen.getByRole('combobox'))
    await user.click(screen.getByRole('option', { name: '50' }))

    expect(handleChartOptionsUpdate).toHaveBeenCalledWith({
      id: 58,
      option: 'percentileSplit',
      value: '50',
    })
  })

  it('offers percentiles only', async () => {
    const user = userEvent.setup()

    render(
      <SplitMonitorChartOptions
        chartDefaults={chartDefaults}
        handleChartOptionsUpdate={jest.fn()}
      />
    )

    await user.click(screen.getByRole('combobox'))

    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      '50',
      '75',
      '85',
      '90',
      '95',
    ])
  })
})
