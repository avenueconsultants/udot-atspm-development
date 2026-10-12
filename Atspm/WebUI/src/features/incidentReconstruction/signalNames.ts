// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - signalNames.ts
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
import { IncidentBandKind, TimelineBand, TimelineEvent } from './types'
import { MAX_LABEL_LENGTH, SignalNames } from './urlCodecs'

// The names the audience reads: each signal's "Display as" name, and the
// label suggestions built from those names.

const DIRECTIONS: Record<string, string> = {
  NB: 'Northbound',
  SB: 'Southbound',
  EB: 'Eastbound',
  WB: 'Westbound',
  NE: 'Northeastbound',
  NW: 'Northwestbound',
  SE: 'Southeastbound',
  SW: 'Southwestbound',
}

/** "Phase 2", "Overlap 1", "Pedestrian Phase 2", "Location-wide". */
export function bandShortName(band: TimelineBand | undefined): string {
  if (!band) return ''
  if (band.kind === IncidentBandKind.LocationWide) return 'Location-wide'
  const name = band.isOverlap ? 'Overlap' : 'Phase'
  const prefix = band.kind === IncidentBandKind.Pedestrian ? 'Pedestrian ' : ''
  return band.phaseNumber === null
    ? band.label
    : `${prefix}${name} ${band.phaseNumber}`
}

/** The name on the chart: what the user typed, or the phase name. */
export function displayName(band: TimelineBand, names: SignalNames): string {
  return names[band.key]?.trim() || band.label
}

/** "Phase 6 – SB Thru/Right" reads as Southbound and "Thru/Right". */
function approach(band: TimelineBand): {
  direction: string | null
  movement: string
} {
  const description = band.label.split(/\s[–-]\s/)[1] ?? ''
  const [first = '', ...rest] = description.trim().split(/\s+/)
  const direction = DIRECTIONS[first.toUpperCase()] ?? null
  return {
    direction,
    movement: (direction ? rest : [first, ...rest]).join(' '),
  }
}

/** "Southbound traffic light", "Southbound left-turn light", "Southbound pedestrian signal". */
function suggestedName(band: TimelineBand): string {
  if (band.kind === IncidentBandKind.LocationWide) return 'Whole intersection'

  const { direction, movement } = approach(band)
  if (band.kind === IncidentBandKind.Pedestrian) {
    return direction
      ? `${direction} pedestrian signal`
      : `${bandShortName(band)} signal`
  }

  const turns = /left/i.test(movement)
    ? 'left-turn light'
    : /right/i.test(movement) && !/thru/i.test(movement)
      ? 'right-turn light'
      : 'traffic light'
  return direction ? `${direction} ${turns}` : `${bandShortName(band)} ${turns}`
}

/** One suggested name per band. Two bands that would share a name get their phase added. */
export function suggestedNames(bands: TimelineBand[]): SignalNames {
  const suggestions = bands.map((band) => suggestedName(band))
  const names: SignalNames = {}
  bands.forEach((band, index) => {
    const name = suggestions[index]
    const shared = suggestions.filter((other) => other === name).length > 1
    names[band.key] = shared ? `${name} (${bandShortName(band)})` : name
  })
  return names
}

/** "Southbound light" from "Southbound traffic light"; the phase when the signal has no name. */
function subject(band: TimelineBand, names: SignalNames): string {
  const name = names[band.key]?.trim()
  if (!name) return bandShortName(band)
  return name.replace(/\btraffic light$/i, 'light')
}

const SIGNAL_CHANGES: Record<number, string> = {
  1: 'turns green',
  61: 'turns green',
  8: 'turns yellow',
  63: 'turns yellow',
  9: 'turns red',
  10: 'turns red',
  64: 'turns red',
  11: 'ends red clearance',
  21: 'shows Walk',
  67: 'shows Walk',
  22: "starts flashing Don't Walk",
  68: "starts flashing Don't Walk",
  23: "shows Don't Walk",
  69: "shows Don't Walk",
}

/**
 * A plain sentence for a labeled event with no label yet:
 * "Southbound light turns yellow", "Southbound vehicle crosses stop line".
 */
export function suggestedLabel(
  event: TimelineEvent,
  band: TimelineBand | undefined,
  names: SignalNames
): string {
  const text = describeEvent(event, band, names)
  return text.slice(0, MAX_LABEL_LENGTH)
}

function describeEvent(
  event: TimelineEvent,
  band: TimelineBand | undefined,
  names: SignalNames
): string {
  if (!band || band.kind === IncidentBandKind.LocationWide) {
    return event.eventName
  }

  const change = SIGNAL_CHANGES[event.eventCode]
  if (change) return `${subject(band, names)} ${change}`

  const { direction } = approach(band)
  const stopBar = /stop bar/i.test(event.parameterDescription)
  const vehicle = direction ? `${direction} vehicle` : 'Vehicle'
  switch (event.eventCode) {
    case 82:
      return stopBar
        ? `${vehicle} crosses stop line`
        : `${vehicle} passes detector ${event.eventParam}`
    case 81:
      return stopBar
        ? `${vehicle} clears stop line`
        : `${vehicle} clears detector ${event.eventParam}`
    case 90:
      return direction
        ? `Pedestrian pushes the ${direction.toLowerCase()} button`
        : 'Pedestrian pushes the button'
    default:
      return `${event.eventName}, ${bandShortName(band)}`
  }
}
