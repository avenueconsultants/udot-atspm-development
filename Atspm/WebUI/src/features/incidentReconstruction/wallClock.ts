// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - wallClock.ts
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

// Controller clock times are held as milliseconds, reading the controller's
// wall clock as if it were UTC. Nothing here converts between time zones, so
// a time always prints exactly as the controller logged it.

const literalPattern =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?$/

const monthNames = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

const pad2 = (n: number) => String(n).padStart(2, '0')

export const SECOND = 1000
export const MINUTE = 60 * SECOND
export const DAY = 24 * 60 * MINUTE

export function parseControllerTime(
  value: string | null | undefined
): number | null {
  if (!value) return null

  const match = literalPattern.exec(value.trim())
  if (!match) return null

  const fraction = match[7] ? Number(match[7]) : 0
  return (
    Date.UTC(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      Number(match[4]),
      Number(match[5]),
      Number(match[6] ?? 0)
    ) + Math.round(fraction * SECOND)
  )
}

export const roundToTenth = (ms: number) => Math.round(ms / 100) * 100

export const floorToSecond = (ms: number) => Math.floor(ms / SECOND) * SECOND

/** "17:42:30.9" */
export function formatClock(ms: number): string {
  const date = new Date(roundToTenth(ms))
  return `${formatClockSeconds(date.getTime())}.${Math.floor(
    date.getUTCMilliseconds() / 100
  )}`
}

/** "17:42:30", dropping any fraction. */
export function formatClockSeconds(ms: number): string {
  const date = new Date(floorToSecond(ms))
  return `${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())}:${pad2(
    date.getUTCSeconds()
  )}`
}

/** "2026-04-14" */
export function formatDate(ms: number): string {
  const date = new Date(ms)
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(
    date.getUTCDate()
  )}`
}

const longMonthNames = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const dayNames = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
]

/** "Tuesday, April 14, 2026" */
export function formatLongDate(ms: number): string {
  const date = new Date(ms)
  return `${dayNames[date.getUTCDay()]}, ${
    longMonthNames[date.getUTCMonth()]
  } ${date.getUTCDate()}, ${date.getUTCFullYear()}`
}

/** "Apr 14, 2026" */
export function formatDisplayDate(ms: number): string {
  const date = new Date(ms)
  return `${monthNames[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`
}

/** "2026-04-14T17:42:30", the whole-second literal the report API takes. */
export function toRequestLiteral(ms: number): string {
  return `${formatDate(ms)}T${formatClockSeconds(ms)}`
}

export function startOfControllerDay(ms: number): number {
  const date = new Date(ms)
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
}

/** Reads a date picker's local Date as controller time. */
export function controllerTimeFromPicker(date: Date): number {
  return Date.UTC(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
    date.getSeconds()
  )
}

/** Gives a date picker the local Date that shows this controller time. */
export function pickerValueFromControllerTime(ms: number): Date {
  const date = new Date(ms)
  return new Date(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds()
  )
}

/** "2.1 s", or "1 min 15.3 s" from a minute up. */
export function formatDuration(ms: number): string {
  const tenths = Math.max(0, Math.round(ms / 100))
  const minutes = Math.floor(tenths / 600)
  const seconds = ((tenths % 600) / 10).toFixed(1)
  return minutes > 0 ? `${minutes} min ${seconds} s` : `${seconds} s`
}
