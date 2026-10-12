// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - reportText.ts
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
  SECOND,
  formatClock,
  formatClockSeconds,
  formatDisplayDate,
  formatDuration,
  formatLongDate,
  startOfControllerDay,
} from './wallClock'

// The sentences around the chart: its title, subtitle and window.

/** "Redwood Road & 7000 South", from "#7115 - Redwood Road & 7000 South". */
export function streetNames(
  locationIdentifier: string,
  locationDescription: string
): string {
  const streets = locationDescription.replace(/^#?\S+\s+[-–]\s+/, '').trim()
  return streets || `Location ${locationIdentifier}`
}

/** "Traffic Signal Timeline – Redwood Road & 7000 South" */
export function chartTitle(
  locationIdentifier: string,
  locationDescription: string
): string {
  return `Traffic Signal Timeline – ${streetNames(
    locationIdentifier,
    locationDescription
  )}`
}

/** "#7115 – Redwood Road & 7000 South · Tuesday, April 14, 2026 · 17:41:00.0 – 17:43:00.0" */
export function chartSubtitle(
  locationIdentifier: string,
  locationDescription: string,
  start: number,
  end: number
): string {
  const sameDay = startOfControllerDay(start) === startOfControllerDay(end)
  const endText = sameDay
    ? formatClock(end)
    : `${formatDisplayDate(end)} ${formatClock(end)}`
  return [
    `#${locationIdentifier} – ${streetNames(
      locationIdentifier,
      locationDescription
    )}`,
    formatLongDate(start),
    `${formatClock(start)} – ${endText}`,
  ].join(' · ')
}

/** "40 s", "1 min 12.5 s": a span to the tenth, without a trailing ".0". */
export function formatSpan(ms: number): string {
  const tenths = Math.max(0, Math.round(ms / 100))
  const minutes = Math.floor(tenths / 600)
  const seconds = (tenths % 600) / 10
  const secondsText = Number.isInteger(seconds)
    ? String(seconds)
    : seconds.toFixed(1)
  if (minutes === 0) return `${secondsText} s`
  return seconds === 0 ? `${minutes} min` : `${minutes} min ${secondsText} s`
}

/** "Showing 17:41:55 – 17:42:35 (40 s)" */
export function showingText(start: number, end: number): string {
  const round = (time: number) => Math.round(time / SECOND) * SECOND
  return `Showing ${formatClockSeconds(round(start))} – ${formatClockSeconds(
    round(end)
  )} (${formatSpan(end - start)})`
}

/** "+4.8 s" */
export function formatSincePrevious(ms: number | null): string {
  return ms === null ? '–' : `+${formatDuration(ms)}`
}
