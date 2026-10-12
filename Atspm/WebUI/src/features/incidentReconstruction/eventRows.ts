// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - eventRows.ts
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
import { toAdjusted } from './latencyAdjustment'
import { displayName } from './signalNames'
import { signalAtEvent } from './signalState'
import { TimelineBand, TimelineEvent } from './types'
import { Labels, SignalNames } from './urlCodecs'

/** One event as the tables, the side panel and the callouts show it. */
export interface EventRow {
  event: TimelineEvent
  /** Controller time plus the adjustment. */
  time: number
  controllerTime: number
  /** The event's signal as the phase is named: "Phase 6 – SB Thru/Right". */
  bandLabel: string
  /** The event's signal as the chart names it. */
  signalName: string
  /** "Yellow · 0.0 s", or "—" for Location-wide events. */
  signal: string
  /** 1-based in time order among labeled events; null when not labeled. */
  number: number | null
  label: string
  /** Time since the labeled event before it; null for the first. */
  sincePrevious: number | null
}

export interface RowContext {
  bandsByKey: Map<string, TimelineBand>
  names: SignalNames
  adjustmentSeconds: number
  labels: Labels
}

function toRow(
  event: TimelineEvent,
  context: RowContext,
  number: number | null,
  sincePrevious: number | null
): EventRow {
  const band = context.bandsByKey.get(event.bandKey)
  return {
    event,
    time: toAdjusted(event.time, context.adjustmentSeconds),
    controllerTime: event.time,
    bandLabel: band?.label ?? event.bandKey,
    signalName: band ? displayName(band, context.names) : event.bandKey,
    signal: signalAtEvent(event, context.bandsByKey),
    number,
    label: context.labels[event.key] ?? '',
    sincePrevious,
  }
}

/** The labeled events, numbered in time order. */
export function buildLabeledRows(
  events: TimelineEvent[],
  context: RowContext
): EventRow[] {
  const labeled = events
    .filter((event) => event.key in context.labels)
    .sort((a, b) => a.time - b.time)
  return labeled.map((event, index) =>
    toRow(
      event,
      context,
      index + 1,
      index === 0 ? null : event.time - labeled[index - 1].time
    )
  )
}

/** Events that are not labeled, so carry no number. */
export function buildEventRows(
  events: TimelineEvent[],
  context: RowContext
): EventRow[] {
  return events.map((event) => toRow(event, context, null, null))
}

/** "8 Phase Begin Yellow Change · Phase 6 – SB Thru/Right · Detector 14" */
export function recordedEvent(row: EventRow): string {
  const parameter =
    row.event.parameterDescription !== '—' ? row.event.parameterDescription : ''
  return [
    `${row.event.eventCode} ${row.event.eventName}`,
    row.bandLabel,
    parameter,
  ]
    .filter(Boolean)
    .join(' · ')
}
