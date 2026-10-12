// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - signalState.test.ts
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
import { signalAt, signalAtEvent, signalSegments } from './signalState'
import { SignalChange, TimelineBand, TimelineEvent } from './types'
import { parseControllerTime } from './wallClock'

const at = (clock: string) =>
  parseControllerTime(`2026-04-14T${clock}`) as number

const phase2: SignalChange[] = [
  { time: at('17:42:10.0'), indication: 'Green', eventCode: 1 },
  { time: at('17:42:36.5'), indication: 'Yellow', eventCode: 8 },
  { time: at('17:42:40.5'), indication: 'RedClearance', eventCode: 9 },
  { time: at('17:42:41.5'), indication: 'Red', eventCode: 11 },
]

const band = (key: string, changes: SignalChange[]): TimelineBand => ({
  key,
  kind: key === 'location' ? 'LocationWide' : 'Vehicle',
  phaseNumber: null,
  isOverlap: false,
  label: key,
  isConfigured: true,
  vehicleBandKey: null,
  changes,
})

const event = (
  time: number,
  bandKey: string,
  permissiveBandKey: string | null = null
): TimelineEvent => ({
  key: 'k',
  time,
  eventCode: 82,
  eventName: 'Detector On',
  eventParam: 1,
  bandKey,
  permissiveBandKey,
  parameterDescription: '',
})

describe('signalAt', () => {
  it('counts a change at exactly the time as the new indication', () => {
    expect(signalAt(phase2, at('17:42:36.5'))).toEqual({
      indication: 'Yellow',
      since: at('17:42:36.5'),
    })
  })

  it('is Unknown before the first change', () => {
    expect(signalAt(phase2, at('17:42:09.9'))).toEqual({
      indication: null,
      since: null,
    })
  })

  it('keeps the last indication after the final change', () => {
    expect(signalAt(phase2, at('17:43:00.0')).indication).toBe('Red')
  })
})

describe('signalAtEvent', () => {
  const bands = new Map([
    ['phase-2', band('phase-2', phase2)],
    [
      'phase-5',
      band('phase-5', [
        { time: at('17:42:33.0'), indication: 'Green', eventCode: 1 },
      ]),
    ],
    ['phase-9', band('phase-9', [])],
    ['location', band('location', [])],
  ])

  it('gives the indication and how long it has shown', () => {
    expect(signalAtEvent(event(at('17:42:42.9'), 'phase-2'), bands)).toBe(
      'Red · 1.4 s'
    )
  })

  it('adds the permissive band when the detector has one', () => {
    expect(
      signalAtEvent(event(at('17:42:43.1'), 'phase-2', 'phase-5'), bands)
    ).toBe('Red · 1.6 s; permissive Green · 10.1 s')
  })

  it('says Unknown for a band with no known change', () => {
    expect(signalAtEvent(event(at('17:42:43.0'), 'phase-9'), bands)).toBe(
      'Unknown'
    )
  })

  it('has no signal for Location-wide events', () => {
    expect(signalAtEvent(event(at('17:42:43.0'), 'location'), bands)).toBe('—')
  })

  it('writes minutes once an indication has shown for a minute', () => {
    expect(signalAtEvent(event(at('17:43:56.8'), 'phase-2'), bands)).toBe(
      'Red · 1 min 15.3 s'
    )
  })
})

describe('signalSegments', () => {
  it('starts with Unknown when the first change is inside the window', () => {
    expect(signalSegments(phase2, at('17:42:00.0'), at('17:42:38.0'))).toEqual([
      { start: at('17:42:00.0'), end: at('17:42:10.0'), indication: null },
      { start: at('17:42:10.0'), end: at('17:42:36.5'), indication: 'Green' },
      { start: at('17:42:36.5'), end: at('17:42:38.0'), indication: 'Yellow' },
    ])
  })

  it('carries the indication from before the window', () => {
    expect(signalSegments(phase2, at('17:42:20.0'), at('17:42:30.0'))).toEqual([
      { start: at('17:42:20.0'), end: at('17:42:30.0'), indication: 'Green' },
    ])
  })
})
