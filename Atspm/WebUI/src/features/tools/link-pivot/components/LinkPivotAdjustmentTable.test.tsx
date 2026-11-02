// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - LinkPivotAdjustmentTable.test.tsx
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
import { render, screen, within } from '@testing-library/react'
import type { AdjustmentDto } from '../types'
import LinkPivotAdjustmentTable from './LinkPivotAdjustmentTable'

const COLUMNS = [
  'Link',
  'Location',
  'Recommended Change',
  'Manual Adjustment',
  'Cumulative Change',
  'Existing Offset',
  'Target Offset',
]

function buildAdjustment(
  linkNumber: number,
  delta: number,
  existingOffset: number
): AdjustmentDto {
  return {
    linkNumber,
    locationIdentifier: String(7000 + linkNumber),
    location: `Signal ${linkNumber}`,
    delta,
    existingOffset,
    adjustment: 0,
  }
}

// Link 1 moves by both links' changes: 40 + 50 = 90 seconds.
const adjustments = [buildAdjustment(1, 40, 120), buildAdjustment(2, 50, 30)]

function getCell(linkNumber: number, column: string) {
  const row = screen
    .getAllByRole('row')
    .find(
      (candidate) =>
        within(candidate).queryAllByRole('cell')[0]?.textContent ===
        String(linkNumber)
    )
  if (!row) throw new Error(`No row for link ${linkNumber}`)
  return within(row).getAllByRole('cell')[COLUMNS.indexOf(column)].textContent
}

describe('LinkPivotAdjustmentTable', () => {
  it('wraps Target Offset into the cycle and keeps Cumulative Change as the full shift', () => {
    render(<LinkPivotAdjustmentTable data={adjustments} cycleLength={150} />)

    expect(getCell(1, 'Cumulative Change')).toBe('90')
    // 120 + 90 = 210, which lands 60 seconds into a 150-second cycle.
    expect(getCell(1, 'Target Offset')).toBe('60')
    expect(getCell(2, 'Cumulative Change')).toBe('50')
    expect(getCell(2, 'Target Offset')).toBe('80')
  })

  it('leaves Target Offset unwrapped when the cycle length is unknown', () => {
    render(<LinkPivotAdjustmentTable data={adjustments} cycleLength={null} />)

    expect(getCell(1, 'Target Offset')).toBe('210')
  })
})
