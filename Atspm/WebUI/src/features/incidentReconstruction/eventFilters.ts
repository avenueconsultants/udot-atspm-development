// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - eventFilters.ts
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
import { IncidentBandKind, TimelineBand, TimelineEvent } from './types'
import { formatClock } from './wallClock'

/**
 * Selected by default when present: begin green, yellow and red clearance for
 * phases and overlaps; walk, flashing don't walk and don't walk; gap out, max
 * out, force off; phase and pedestrian calls; detector and push button on;
 * preemption; transit priority check in and out; coordination pattern
 * change; flash, stop time, clock updated and power failure.
 */
export const DEFAULT_EVENT_CODES = [
  1, 4, 5, 6, 8, 10, 21, 22, 23, 43, 45, 61, 63, 64, 82, 90, 102, 105, 111, 112,
  115, 131, 173, 180, 181, 182,
]

/** Codes that make the chart warn that times around them may not line up. */
export const CLOCK_WARNING_CODES = [173, 180, 181, 182]

export interface CodeCount {
  code: number
  name: string
  count: number
}

/** Every vehicle phase and overlap, in report order: the chart before the user picks. */
export function defaultChartKeys(bands: TimelineBand[]): string[] {
  return bands
    .filter((band) => band.kind === IncidentBandKind.Vehicle)
    .map((band) => band.key)
}

/** The bands on the chart, in the order picked. Keys not in the report are skipped. */
export function chartBands(
  bands: TimelineBand[],
  keys: string[]
): TimelineBand[] {
  const byKey = new Map(bands.map((band) => [band.key, band]))
  return [...new Set(keys)]
    .map((key) => byKey.get(key))
    .filter((band): band is TimelineBand => band !== undefined)
}

/** Events between two controller times, both ends included. */
export function eventsInWindow(
  events: TimelineEvent[],
  start: number,
  end: number
): TimelineEvent[] {
  return events.filter((event) => event.time >= start && event.time <= end)
}

/** Codes recorded on the given bands, with counts, by code. */
export function codeCounts(
  events: TimelineEvent[],
  bandKeys: Set<string>
): CodeCount[] {
  const counts = new Map<number, CodeCount>()
  for (const event of events) {
    if (!bandKeys.has(event.bandKey)) continue
    const entry = counts.get(event.eventCode)
    if (entry) {
      entry.count += 1
    } else {
      counts.set(event.eventCode, {
        code: event.eventCode,
        name: event.eventName,
        count: 1,
      })
    }
  }
  return [...counts.values()].sort((a, b) => a.code - b.code)
}

export function defaultCodes(counts: CodeCount[]): number[] {
  const present = new Set(counts.map((count) => count.code))
  return DEFAULT_EVENT_CODES.filter((code) => present.has(code))
}

export function filterEvents(
  events: TimelineEvent[],
  bandKeys: Set<string>,
  codes: Set<number>
): TimelineEvent[] {
  return events.filter(
    (event) => bandKeys.has(event.bandKey) && codes.has(event.eventCode)
  )
}

/** The clock and flash events in the window, whatever the filters say. */
export function clockWarningEvents(events: TimelineEvent[]): TimelineEvent[] {
  return events.filter((event) => CLOCK_WARNING_CODES.includes(event.eventCode))
}

const CLOCK_WARNING_MESSAGES: Record<number, (time: string) => string> = {
  173: (time) =>
    `Controller flash status changed at ${time}. The signal bands do not draw flash.`,
  180: (time) =>
    `Stop time input changed at ${time}. The controller may have held its timing.`,
  181: (time) =>
    `Controller clock updated at ${time}. Times before and after it may not line up.`,
  182: (time) =>
    `Power failure detected at ${time}. Events around it may be missing.`,
}

/** One sentence per clock or flash event in the window, with the time as the page shows it. */
export function clockWarningMessages(
  events: TimelineEvent[],
  adjustmentSeconds: number
): string[] {
  const messages = clockWarningEvents(events).map((event) =>
    CLOCK_WARNING_MESSAGES[event.eventCode](
      formatClock(toAdjusted(event.time, adjustmentSeconds))
    )
  )
  return [...new Set(messages)]
}
