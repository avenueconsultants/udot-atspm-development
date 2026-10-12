// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - signalState.ts
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
  LOCATION_BAND_KEY,
  SignalChange,
  SignalIndication,
  TimelineBand,
  TimelineEvent,
} from './types'
import { formatDuration } from './wallClock'

export const INDICATION_LABELS: Record<SignalIndication, string> = {
  Green: 'Green',
  Yellow: 'Yellow',
  RedClearance: 'Red clearance',
  Red: 'Red',
  Walk: 'Walk',
  FlashingDontWalk: "Flashing Don't Walk",
  DontWalk: "Don't Walk",
}

export const UNKNOWN_LABEL = 'Unknown'

export interface SignalState {
  /** Null when the band has no change at or before the time. */
  indication: SignalIndication | null
  /** When the indication began. */
  since: number | null
}

export interface SignalSegment {
  start: number
  end: number
  indication: SignalIndication | null
}

/** The indication showing at a time. A change at exactly that time counts. */
export function signalAt(changes: SignalChange[], time: number): SignalState {
  let low = 0
  let high = changes.length - 1
  let found = -1
  while (low <= high) {
    const mid = (low + high) >> 1
    if (changes[mid].time <= time) {
      found = mid
      low = mid + 1
    } else {
      high = mid - 1
    }
  }

  if (found < 0) return { indication: null, since: null }
  return { indication: changes[found].indication, since: changes[found].time }
}

/** "Red · 2.1 s", or "Unknown". */
export function describeSignal(state: SignalState, time: number): string {
  if (state.indication === null || state.since === null) return UNKNOWN_LABEL
  return `${INDICATION_LABELS[state.indication]} · ${formatDuration(time - state.since)}`
}

/**
 * The "Signal at event" text: the event's own band, then its permissive band when it has one.
 * "Red · 2.4 s; permissive Green · 10.1 s". Location-wide events have no signal.
 */
export function signalAtEvent(
  event: TimelineEvent,
  bandsByKey: Map<string, TimelineBand>
): string {
  const band = bandsByKey.get(event.bandKey)
  if (!band || band.key === LOCATION_BAND_KEY) return '—'

  const own = describeSignal(signalAt(band.changes, event.time), event.time)
  const permissive = event.permissiveBandKey
    ? bandsByKey.get(event.permissiveBandKey)
    : undefined
  if (!permissive) return own

  return `${own}; permissive ${describeSignal(
    signalAt(permissive.changes, event.time),
    event.time
  )}`
}

/** The band's indications between two times, with Unknown before the first known change. */
export function signalSegments(
  changes: SignalChange[],
  from: number,
  to: number
): SignalSegment[] {
  if (to <= from) return []

  const segments: SignalSegment[] = []
  let current = signalAt(changes, from).indication
  let segmentStart = from

  for (const change of changes) {
    if (change.time <= from) continue
    if (change.time >= to) break
    if (change.indication === current) continue

    segments.push({
      start: segmentStart,
      end: change.time,
      indication: current,
    })
    current = change.indication
    segmentStart = change.time
  }

  segments.push({ start: segmentStart, end: to, indication: current })
  return segments
}
