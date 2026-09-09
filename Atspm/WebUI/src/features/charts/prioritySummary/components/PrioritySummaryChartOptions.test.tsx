// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - PrioritySummaryChartOptions.test.tsx
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
import { PrioritySummaryChartOptions } from './PrioritySummaryChartOptions'

// The panel used to start from a hard-coded 15 whatever the measure's
// default said, so an admin-set default was shown wrong until the first
// change.
describe('PrioritySummaryChartOptions', () => {
  it('starts from the measure default and reports a picked bin size', async () => {
    const user = userEvent.setup()
    const handleChartOptionsUpdate = jest.fn()

    render(
      <PrioritySummaryChartOptions
        chartDefaults={{
          binSize: { id: 122, value: '5', option: 'binSize' },
        }}
        handleChartOptionsUpdate={handleChartOptionsUpdate}
      />
    )

    expect(screen.getByRole('combobox')).toHaveTextContent('5')

    await user.click(screen.getByRole('combobox'))
    await user.click(screen.getByRole('option', { name: '60' }))

    expect(handleChartOptionsUpdate).toHaveBeenCalledWith({
      id: 122,
      option: 'binSize',
      value: 60,
    })
  })
})
