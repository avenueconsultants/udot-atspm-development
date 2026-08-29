// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - PhaseTable.test.tsx
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
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PhaseTable from './PhaseTable'

jest.mock('@/stores/notifications', () => ({
  __esModule: true,
  useNotificationStore: () => ({ addNotification: jest.fn() }),
}))

const plan = (overrides: Record<string, unknown>) => ({
  planNumber: '1',
  planDescription: 'Plan 1',
  start: '2026-04-01T08:00:00',
  end: '2026-04-01T08:30:00',
  percentSkips: 4,
  percentGapOuts: 61,
  percentMaxOuts: 0,
  percentForceOffs: 35,
  averageSplit: 27,
  minTime: 7,
  programmedSplit: 30,
  percentileSplit85th: 31,
  percentileSplit50th: 26,
  ...overrides,
})

const phases = [
  {
    chart: {
      displayProps: {
        phaseNumber: '2',
        plans: [
          plan({}),
          plan({
            planNumber: '254',
            start: '2026-04-01T08:30:00',
            end: '2026-04-01T09:00:00',
            percentMaxOuts: 10,
            percentForceOffs: 0,
          }),
        ],
      },
    },
  },
]

describe('PhaseTable', () => {
  it('reports force-offs for a timed plan and max-outs for a free one', async () => {
    render(<PhaseTable phases={phases} />)
    await userEvent.click(screen.getByRole('button', { name: 'Phase Details' }))

    const header = screen.getAllByRole('row')[0]
    expect(
      within(header)
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent)
    ).toEqual(['Phase', 'Metric', 'Plan 1', 'Free'])

    const terminations = screen
      .getAllByRole('row')
      .find((row) => row.textContent?.includes('Force Offs or Max Outs'))
    expect(terminations).toBeDefined()
    const cells = within(terminations as HTMLElement).getAllByRole('cell')
    expect(cells.slice(2).map((cell) => cell.textContent)).toEqual(['35', '10'])
  })
})
