// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - ApproachVolumeTable.test.tsx
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
import type { ApproachVolumeSummaryData } from '../types'
import { ApproachVolumeTable } from './ApproachVolumeTable'

// The report's SummaryData is optional and nullable throughout, and the
// transformer spreads it straight into this table - a null summary spreads
// to nothing, so every cell has to survive a missing value.

const summary: ApproachVolumeSummaryData = {
  primaryDirectionName: 'Northbound',
  opposingDirectionName: 'Southbound',
  peakHour: '08:00 - 09:00',
  kFactor: 0.092,
  peakHourVolume: 3000,
  peakHourFactor: 0.892,
  totalVolume: 3000,
  primaryPeakHour: '08:00 - 09:00',
  primaryKFactor: 0.094,
  primaryPeakHourVolume: 1680,
  primaryPeakHourFactor: 0.875,
  primaryTotalVolume: 1680,
  primaryDFactor: 0.56,
  opposingPeakHour: '08:00 - 09:00',
  opposingKFactor: 0.091,
  opposingPeakHourVolume: 1320,
  opposingPeakHourFactor: 0.917,
  opposingTotalVolume: 1320,
  opposingDFactor: 0.44,
}

const openTable = async (data: ApproachVolumeSummaryData) => {
  render(<ApproachVolumeTable data={data} />)
  await userEvent.click(screen.getByRole('button', { name: 'Peak Hour Data' }))
}

// Matches on the row header's exact text: several rows begin "Peak Hour".
const cellsOfRow = (label: string) => {
  const row = screen.getAllByRole('row').find((candidate) => {
    const [first] = within(candidate).queryAllByRole('cell')
    return first?.textContent === label
  })

  if (!row) throw new Error(`no row headed "${label}"`)

  return within(row)
    .getAllByRole('cell')
    .map((cell) => cell.textContent)
}

describe('ApproachVolumeTable', () => {
  it('formats factors to three decimals and localises volumes', async () => {
    await openTable(summary)

    expect(cellsOfRow('Peak Hour')).toEqual([
      'Peak Hour',
      '08:00 - 09:00',
      '08:00 - 09:00',
      '08:00 - 09:00',
    ])
    expect(cellsOfRow('Peak Hour K Factor')).toEqual([
      'Peak Hour K Factor',
      '0.092',
      '0.094',
      '0.091',
    ])
    expect(cellsOfRow('Total Volume')).toEqual([
      'Total Volume',
      '3,000',
      '1,680',
      '1,320',
    ])
  })

  it('renders N/A rather than throwing when the summary is empty', async () => {
    await openTable({} as ApproachVolumeSummaryData)

    // Every row reads N/A - including the peak hour itself, which is a
    // string on the contract and would otherwise leave blank cells.
    expect(cellsOfRow('Peak Hour')).toEqual(['Peak Hour', 'N/A', 'N/A', 'N/A'])
    expect(cellsOfRow('Peak Hour K Factor')).toEqual([
      'Peak Hour K Factor',
      'N/A',
      'N/A',
      'N/A',
    ])
    expect(cellsOfRow('Total Volume')).toEqual([
      'Total Volume',
      'N/A',
      'N/A',
      'N/A',
    ])
  })
})
