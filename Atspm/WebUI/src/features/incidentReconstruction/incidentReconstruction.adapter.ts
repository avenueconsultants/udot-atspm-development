// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - incidentReconstruction.adapter.ts
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
import type {
  IncidentBand,
  IncidentEvent,
  IncidentReconstructionResult,
  IncidentSignalChange,
} from '@/api/reports'
import {
  IncidentBandKind,
  IncidentReport,
  LOCATION_BAND_KEY,
  SignalChange,
  SignalIndication,
  TimelineBand,
  TimelineEvent,
} from './types'
import { formatClock, parseControllerTime } from './wallClock'

// The one place that reads the report API's response. Every field in the
// generated types is optional, so defaults are decided here and nowhere else.

const bandKinds = new Set<string>(Object.values(IncidentBandKind))
const indications = new Set<string>(Object.values(SignalIndication))

export function toIncidentReport(
  result: IncidentReconstructionResult
): IncidentReport {
  const start = parseControllerTime(result.start)
  const end = parseControllerTime(result.end)
  if (start === null || end === null) {
    throw new Error('The report came back without a time window.')
  }

  const parsedBands = (result.bands ?? [])
    .map(toTimelineBand)
    .filter((band): band is TimelineBand => band !== null)
  if (!parsedBands.some((band) => band.key === LOCATION_BAND_KEY)) {
    parsedBands.push(locationBand())
  }

  const bandKeys = new Set(parsedBands.map((band) => band.key))
  // A pedestrian band pointing at a band that isn't in the report would never
  // show, so it stands alone instead.
  const bands = parsedBands.map((band) =>
    band.vehicleBandKey && !bandKeys.has(band.vehicleBandKey)
      ? { ...band, vehicleBandKey: null }
      : band
  )
  const occurrences = new Map<string, number>()
  const events = (result.events ?? [])
    .map((event, index) => ({
      event,
      index,
      time: parseControllerTime(event.timestamp),
    }))
    .filter(
      (item): item is { event: IncidentEvent; index: number; time: number } =>
        item.time !== null
    )
    .sort((a, b) => a.time - b.time || a.index - b.index)
    .map(({ event, time }) =>
      toTimelineEvent(event, time, bandKeys, occurrences)
    )

  return {
    locationIdentifier: result.locationIdentifier ?? '',
    locationDescription: result.locationDescription ?? '',
    start,
    end,
    bands,
    events,
  }
}

/**
 * "174230.9-82-13", with "-2", "-3" added when the same time, code and parameter repeat.
 * Built from controller time so a label keeps its event when the adjustment changes.
 */
export function eventKey(
  time: number,
  eventCode: number,
  eventParam: number,
  occurrence = 1
): string {
  const base = `${formatClock(time).replace(/:/g, '')}-${eventCode}-${eventParam}`
  return occurrence > 1 ? `${base}-${occurrence}` : base
}

function toTimelineBand(band: IncidentBand): TimelineBand | null {
  if (!band.key) return null

  return {
    key: band.key,
    kind:
      band.kind && bandKinds.has(band.kind)
        ? band.kind
        : IncidentBandKind.Vehicle,
    phaseNumber: band.phaseNumber ?? null,
    isOverlap: band.isOverlap ?? false,
    label: band.label || band.key,
    isConfigured: band.isConfigured ?? true,
    vehicleBandKey: band.vehicleBandKey ?? null,
    changes: withoutRepeats(
      (band.changes ?? [])
        .map(toSignalChange)
        .filter((change): change is SignalChange => change !== null)
        .sort((a, b) => a.time - b.time)
    ),
  }
}

/**
 * Drops a change that repeats the one before it, so red counts from when red
 * clearance began.
 */
function withoutRepeats(changes: SignalChange[]): SignalChange[] {
  return changes.filter(
    (change, index) =>
      index === 0 || change.indication !== changes[index - 1].indication
  )
}

function toSignalChange(change: IncidentSignalChange): SignalChange | null {
  const time = parseControllerTime(change.timestamp)
  if (
    time === null ||
    !change.indication ||
    !indications.has(change.indication)
  ) {
    return null
  }

  // The report shows red clearance as red.
  return {
    time,
    indication:
      change.indication === SignalIndication.RedClearance
        ? SignalIndication.Red
        : change.indication,
    eventCode: change.eventCode ?? 0,
  }
}

function toTimelineEvent(
  event: IncidentEvent,
  time: number,
  bandKeys: Set<string>,
  occurrences: Map<string, number>
): TimelineEvent {
  const eventCode = event.eventCode ?? 0
  const eventParam = event.eventParam ?? 0
  const base = eventKey(time, eventCode, eventParam)
  const occurrence = (occurrences.get(base) ?? 0) + 1
  occurrences.set(base, occurrence)

  const permissiveBandKey =
    event.permissiveBandKey && bandKeys.has(event.permissiveBandKey)
      ? event.permissiveBandKey
      : null

  return {
    key: eventKey(time, eventCode, eventParam, occurrence),
    time,
    eventCode,
    eventName: event.eventName || `Event ${eventCode}`,
    eventParam,
    bandKey:
      event.bandKey && bandKeys.has(event.bandKey)
        ? event.bandKey
        : LOCATION_BAND_KEY,
    permissiveBandKey,
    parameterDescription: event.parameterDescription || '—',
  }
}

function locationBand(): TimelineBand {
  return {
    key: LOCATION_BAND_KEY,
    kind: IncidentBandKind.LocationWide,
    phaseNumber: null,
    isOverlap: false,
    label: 'Location-wide',
    isConfigured: true,
    vehicleBandKey: null,
    changes: [],
  }
}
