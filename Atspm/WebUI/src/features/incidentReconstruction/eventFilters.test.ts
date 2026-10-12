// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - eventFilters.test.ts
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
import {
  chartBands,
  clockWarningMessages,
  codeCounts,
  defaultChartKeys,
  defaultCodes,
  filterEvents,
} from './eventFilters'
import { IncidentBandKind, TimelineBand, TimelineEvent } from './types'

const band = (
  key: string,
  kind: IncidentBandKind,
  vehicleBandKey: string | null = null
): TimelineBand => ({
  key,
  kind,
  phaseNumber: null,
  isOverlap: false,
  label: key,
  isConfigured: true,
  vehicleBandKey,
  changes: [],
})

const bands = [
  band('phase-2', 'Vehicle'),
  band('ped-2', 'Pedestrian', 'phase-2'),
  band('phase-4', 'Vehicle'),
  band('ped-9', 'Pedestrian'),
  band('location', 'LocationWide'),
]

let sequence = 0
const event = (eventCode: number, bandKey: string): TimelineEvent => ({
  key: `key-${sequence++}`,
  time: sequence,
  eventCode,
  eventName: `Event ${eventCode}`,
  eventParam: 0,
  bandKey,
  permissiveBandKey: null,
  parameterDescription: '—',
})

describe('chart bands', () => {
  it('starts with every vehicle phase', () => {
    expect(defaultChartKeys(bands)).toEqual(['phase-2', 'phase-4'])
  })

  it('keeps the picked order and skips keys not in the report', () => {
    expect(
      chartBands(bands, ['ped-9', 'phase-2', 'phase-7', 'ped-9']).map(
        (b) => b.key
      )
    ).toEqual(['ped-9', 'phase-2'])
  })
})

describe('codes', () => {
  const events = [
    event(1, 'phase-2'),
    event(82, 'phase-2'),
    event(82, 'phase-4'),
    event(82, 'phase-4'),
    event(81, 'phase-4'),
    event(45, 'ped-2'),
    event(181, 'location'),
  ]

  it('counts codes on the selected bands only', () => {
    expect(codeCounts(events, new Set(['phase-4', 'location']))).toEqual([
      { code: 81, name: 'Event 81', count: 1 },
      { code: 82, name: 'Event 82', count: 2 },
      { code: 181, name: 'Event 181', count: 1 },
    ])
  })

  it('selects the default codes that are present, leaving detector off', () => {
    const counts = codeCounts(events, new Set(bands.map((b) => b.key)))
    expect(defaultCodes(counts)).toEqual([1, 45, 82, 181])
  })

  it('filters by band and code', () => {
    const filtered = filterEvents(events, new Set(['phase-4']), new Set([82]))
    expect(filtered).toHaveLength(2)
    expect(
      filtered.every((e) => e.bandKey === 'phase-4' && e.eventCode === 82)
    ).toBe(true)
  })
})

describe('clockWarningMessages', () => {
  const at = (eventCode: number, time: number): TimelineEvent => ({
    ...event(eventCode, 'location'),
    time,
  })
  const clockUpdate = at(181, Date.UTC(2026, 3, 14, 17, 42, 31))

  it('names the time as the page shows it, with the adjustment', () => {
    expect(clockWarningMessages([at(82, 0), clockUpdate], 1.5)).toEqual([
      'Controller clock updated at 17:42:32.5. Times before and after it may not line up.',
    ])
  })

  it('says each sentence once', () => {
    expect(
      clockWarningMessages([clockUpdate, { ...clockUpdate }], 0)
    ).toHaveLength(1)
  })
})
