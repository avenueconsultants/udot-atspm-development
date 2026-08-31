// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - RampMeteringChartOptions.test.tsx
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
import type { RampMeteringChartOptionsDefaults } from '../types'
import { RampMeteringChartOptions } from './RampMeteringChartOptions'

// The seed carries no options for this measure, so the absent default is
// the normal case rather than the edge one.
describe('RampMeteringChartOptions', () => {
  it('reports a missing default instead of throwing', () => {
    render(
      <RampMeteringChartOptions
        chartDefaults={{} as RampMeteringChartOptionsDefaults}
        handleChartOptionsUpdate={jest.fn()}
      />
    )

    expect(
      screen.getByText('Combine Lanes default value not found.')
    ).toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })

  it('starts from the seeded default and reports a toggle', async () => {
    const user = userEvent.setup()
    const handleChartOptionsUpdate = jest.fn()

    render(
      <RampMeteringChartOptions
        chartDefaults={{
          combineLanes: { id: 200, value: 'FALSE', option: 'combineLanes' },
        }}
        handleChartOptionsUpdate={handleChartOptionsUpdate}
      />
    )

    const checkbox = screen.getByRole('checkbox', { name: 'Combine Lanes' })
    expect(checkbox).not.toBeChecked()

    await user.click(checkbox)

    expect(handleChartOptionsUpdate).toHaveBeenCalledWith({
      id: 200,
      option: 'combineLanes',
      value: 'TRUE',
    })
  })
})
