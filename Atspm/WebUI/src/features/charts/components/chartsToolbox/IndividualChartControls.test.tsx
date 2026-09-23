// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - IndividualChartControls.test.tsx
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
import { createRef } from 'react'
import IndividualChartControls from './IndividualChartControls'

// Every control here used to answer to the name "more": an aria-label on
// the two buttons overrode their visible text, and the visibility toggle
// had no name at all.

const charts = [
  { chart: { displayProps: { description: 'NB Main St' } } },
  { chart: { displayProps: { description: 'SB Main St' } } },
  // displayProps is optional on the chart types that do not set it.
  { chart: {} },
] as never[]

const renderControls = () => {
  const chartRefs = charts.map(() => createRef<HTMLDivElement>())
  chartRefs.forEach((ref) => {
    // The controls read and restyle the chart's container.
    ;(ref as { current: HTMLDivElement | null }).current =
      document.createElement('div')
  })

  render(
    <IndividualChartControls
      charts={charts}
      chartRefs={chartRefs as never}
      isDisabled={false}
    />
  )

  return chartRefs
}

describe('IndividualChartControls', () => {
  it('names the dropdown by its visible text', async () => {
    const user = userEvent.setup()
    renderControls()

    const toggle = screen.getByRole('button', { name: 'Charts' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')

    await user.click(toggle)

    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: 'NB Main St' })).toBeVisible()
    expect(screen.queryAllByRole('button', { name: 'more' })).toHaveLength(0)
  })

  it('names each visibility toggle for the chart it hides', async () => {
    const user = userEvent.setup()
    const chartRefs = renderControls()

    await user.click(screen.getByRole('button', { name: 'Charts' }))

    const hide = screen.getByRole('button', { name: 'Hide NB Main St' })
    await user.click(hide)

    expect(chartRefs[0].current).toHaveStyle({ maxHeight: '0px' })
    expect(
      screen.getByRole('button', { name: 'Show NB Main St' })
    ).toBeVisible()
  })
})
