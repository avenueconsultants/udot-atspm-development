// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - measureAbbreviations.test.ts
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
import { ChartType } from '@/features/charts/common/types'
import { chartTypeForMeasure } from './measureAbbreviations'

describe('chartTypeForMeasure', () => {
  // The seeded name for TSPS does not spell its chart type, so a lookup
  // by name alone left Priority Summary without measure defaults.
  it('resolves by abbreviation before anything else', () => {
    expect(
      chartTypeForMeasure({
        abbreviation: 'TSPS',
        name: 'Transit Signal Priority Summary',
      })
    ).toBe(ChartType.PrioritySummary)
  })

  it('falls back to a name that spells the chart type', () => {
    expect(
      chartTypeForMeasure({ abbreviation: 'XYZ', name: 'Purdue Split Failure' })
    ).toBe(ChartType.PurdueSplitFailure)
    expect(
      chartTypeForMeasure({ abbreviation: null, name: 'timing and actuation' })
    ).toBe(ChartType.TimingAndActuation)
  })

  it('reports a measure it cannot place as Unknown', () => {
    expect(chartTypeForMeasure({ abbreviation: 'XYZ', name: 'Mystery' })).toBe(
      'Unknown'
    )
    expect(chartTypeForMeasure({ abbreviation: null, name: null })).toBe(
      'Unknown'
    )
  })
})
