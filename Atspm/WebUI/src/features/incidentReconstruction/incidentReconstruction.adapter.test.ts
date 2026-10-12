// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - incidentReconstruction.adapter.test.ts
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
import type { IncidentReconstructionResult } from '@/api/reports'
import { eventKey, toIncidentReport } from './incidentReconstruction.adapter'
import { formatClock, parseControllerTime } from './wallClock'

const response: IncidentReconstructionResult = {
  locationIdentifier: '7115',
  locationDescription: '#7115 - Redwood Road & 7000 South',
  start: '2026-04-14T17:41:00',
  end: '2026-04-14T17:43:00',
  lookbackStart: '2026-04-14T17:26:00',
  bands: [
    {
      key: 'phase-2',
      kind: 'Vehicle',
      phaseNumber: 2,
      isOverlap: false,
      label: 'Phase 2 – NB Thru',
      isConfigured: true,
      changes: [
        {
          timestamp: '2026-04-14T17:41:20.5',
          indication: 'Yellow',
          eventCode: 8,
        },
        {
          timestamp: '2026-04-14T17:40:31.2',
          indication: 'Green',
          eventCode: 1,
        },
      ],
    },
    { key: null, label: 'dropped' },
    {
      key: 'ped-2',
      kind: 'Pedestrian',
      phaseNumber: 2,
      vehicleBandKey: 'phase-2',
      changes: null,
    },
  ],
  events: [
    {
      timestamp: '2026-04-14T17:42:30.9',
      eventCode: 82,
      eventName: 'Detector On',
      eventParam: 13,
      bandKey: 'phase-2',
      parameterDescription: 'Detector 13',
    },
    {
      timestamp: '2026-04-14T17:41:10',
      eventCode: 182,
      eventParam: 0,
      bandKey: null,
    },
    {
      timestamp: '2026-04-14T17:42:30.9',
      eventCode: 82,
      eventName: 'Detector On',
      eventParam: 13,
      bandKey: 'phase-2',
    },
    { timestamp: 'not a time', eventCode: 1 },
    {
      timestamp: '2026-04-14T17:42:00',
      eventCode: 43,
      eventParam: 6,
      bandKey: 'phase-6',
      permissiveBandKey: 'phase-9',
    },
  ],
}

describe('toIncidentReport', () => {
  const report = toIncidentReport(response)

  it('reads the window as controller time', () => {
    expect(report.start).toBe(parseControllerTime('2026-04-14T17:41:00'))
    expect(report.end).toBe(parseControllerTime('2026-04-14T17:43:00'))
  })

  it('drops bands without a key, defaults the rest and adds Location-wide', () => {
    expect(report.bands.map((band) => band.key)).toEqual([
      'phase-2',
      'ped-2',
      'location',
    ])
    expect(report.bands[1]).toMatchObject({
      label: 'ped-2',
      vehicleBandKey: 'phase-2',
      changes: [],
    })
    expect(report.bands[2]).toMatchObject({
      kind: 'LocationWide',
      label: 'Location-wide',
    })
  })

  it('lets a pedestrian band stand alone when its vehicle band is missing', () => {
    const orphan = toIncidentReport({
      ...response,
      bands: [{ key: 'ped-4', kind: 'Pedestrian', vehicleBandKey: 'phase-4' }],
    })
    expect(orphan.bands[0]).toMatchObject({
      key: 'ped-4',
      vehicleBandKey: null,
    })
  })

  it('sorts signal changes by time', () => {
    expect(report.bands[0].changes.map((change) => change.indication)).toEqual([
      'Green',
      'Yellow',
    ])
  })

  it('shows red clearance as red, so red counts from the end of yellow', () => {
    const folded = toIncidentReport({
      ...response,
      bands: [
        {
          key: 'phase-4',
          changes: [
            {
              timestamp: '2026-04-14T17:41:00',
              indication: 'Yellow',
              eventCode: 8,
            },
            {
              timestamp: '2026-04-14T17:41:03.5',
              indication: 'RedClearance',
              eventCode: 10,
            },
            {
              timestamp: '2026-04-14T17:41:05.5',
              indication: 'Red',
              eventCode: 11,
            },
          ],
        },
      ],
    })
    expect(
      folded.bands[0].changes.map((change) => [
        formatClock(change.time),
        change.indication,
      ])
    ).toEqual([
      ['17:41:00.0', 'Yellow'],
      ['17:41:03.5', 'Red'],
    ])
  })

  it('sorts events by time and drops unreadable times', () => {
    expect(report.events.map((event) => formatClock(event.time))).toEqual([
      '17:41:10.0',
      '17:42:00.0',
      '17:42:30.9',
      '17:42:30.9',
    ])
  })

  it('keeps log order for events at the same time', () => {
    const tied = toIncidentReport({
      ...response,
      events: [
        { timestamp: '2026-04-14T17:42:00', eventCode: 82, eventParam: 13 },
        { timestamp: '2026-04-14T17:41:00', eventCode: 1, eventParam: 2 },
        { timestamp: '2026-04-14T17:42:00', eventCode: 81, eventParam: 13 },
      ],
    })
    expect(tied.events.map((event) => event.eventCode)).toEqual([1, 82, 81])
  })

  it('gives repeated events their own keys', () => {
    expect(report.events[2].key).toBe('174230.9-82-13')
    expect(report.events[3].key).toBe('174230.9-82-13-2')
  })

  it('sends events on missing or unknown bands to Location-wide and fills names', () => {
    expect(report.events[0]).toMatchObject({
      bandKey: 'location',
      eventName: 'Event 182',
      parameterDescription: '—',
    })
    expect(report.events[1]).toMatchObject({
      bandKey: 'location',
      permissiveBandKey: null,
    })
  })

  it('refuses a response without a window', () => {
    expect(() => toIncidentReport({ ...response, start: undefined })).toThrow()
  })
})

describe('eventKey', () => {
  it('uses controller time to the tenth, code and parameter', () => {
    const time = parseControllerTime('2026-04-14T09:05:03.25') as number
    expect(eventKey(time, 1, 2)).toBe('090503.3-1-2')
  })
})
