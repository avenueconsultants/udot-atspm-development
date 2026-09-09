// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - detectorsInfo.test.ts
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
import { approachNorthbound, detector10011 } from '@/test/fixtures/config'
import { toDetectorRows } from './detectorsInfo'

describe('toDetectorRows', () => {
  // Regression test: the lane type used to be looked up by indexing an
  // array of options with the API's member name ("V"), which is never a
  // valid index, so the column was always blank.
  it('labels the lane type the API sends by name', () => {
    const [row] = toDetectorRows([detector10011])

    expect(row.laneType).toBe('Vehicle')
  })

  it('reads the direction and phases from the expanded approach', () => {
    const [row] = toDetectorRows([
      { ...detector10011, approach: approachNorthbound },
    ])

    expect(row).toMatchObject({
      direction: 'Northbound',
      phase: 2,
      permPhase: null,
      overlap: false,
    })
  })

  it('orders rows by detector channel', () => {
    const rows = toDetectorRows([
      { ...detector10011, id: 2, detectorChannel: 5 },
      { ...detector10011, id: 3, detectorChannel: 1 },
    ])

    expect(rows.map((row) => row.detectorChannel)).toEqual([1, 5])
  })
})
