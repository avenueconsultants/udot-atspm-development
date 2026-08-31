// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - dateTime.ts
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
const pad2 = (n: number) => String(n).padStart(2, '0')

type WallClockParts = {
  year: number
  month: number
  day: number
  hours: number
  minutes: number
  seconds: number
}

const wallClockPattern =
  /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/

const getWallClockParts = (value: Date | string): WallClockParts | null => {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null

    return {
      year: value.getFullYear(),
      month: value.getMonth() + 1,
      day: value.getDate(),
      hours: value.getHours(),
      minutes: value.getMinutes(),
      seconds: value.getSeconds(),
    }
  }

  const raw = value.trim()
  const match = wallClockPattern.exec(raw)
  if (match) {
    return {
      year: Number(match[1]),
      month: Number(match[2]),
      day: Number(match[3]),
      hours: Number(match[4] ?? 0),
      minutes: Number(match[5] ?? 0),
      seconds: Number(match[6] ?? 0),
    }
  }

  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return null

  return getWallClockParts(parsed)
}

/**
 * Formats traffic/config civil time without timezone conversion.
 */
export const toWallClockDateTimeLiteral = (value: Date | string): string => {
  const parts = getWallClockParts(value)
  if (!parts) return value as string

  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}T${pad2(
    parts.hours
  )}:${pad2(parts.minutes)}:${pad2(parts.seconds)}`
}

export const parseWallClockDateTimeLiteral = (
  value: Date | string | null | undefined
): Date | null => {
  if (!value) return null

  const parts = getWallClockParts(value)
  if (!parts) return null

  return new Date(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hours,
    parts.minutes,
    parts.seconds,
    0
  )
}

/**
 * Converts a Date or date string into a timezone-free timestamp string.
 * Output format: "YYYY-MM-DDTHH:mm:ss"
 * - Strips any timezone info (Z, �HH:mm) if input is a string.
 * - Uses local date/time parts if input is a Date.
 *
 * @param {Date|string} value The input date object or date string
 * @returns {string} A timezone-free timestamp string, or original string if invalid date
 */
export const dateToTimestamp = (value: Date | string): string => {
  return toWallClockDateTimeLiteral(value)
}

export const toUTCDateStamp = (date: Date | string): string => {
  if (typeof date === 'string') {
    date = new Date(date)
  }
  const year = date.getUTCFullYear()
  const month = pad2(date.getUTCMonth() + 1)
  const day = pad2(date.getUTCDate())
  return `${year}-${month}-${day}`
}

export const toUTCDateWithTimeStamp = (dateWithTime: Date): string => {
  const options: Intl.DateTimeFormatOptions = {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }

  const formattedTime = dateWithTime.toLocaleString('en-US', options)
  return formattedTime
}

export const getDateFromDateStamp = (dateStamp: string): Date => {
  return new Date(dateStamp)
}

/**
 * Parse a timestamp string into epoch milliseconds while treating timezone-less
 * inputs as UTC.
 */
export const parseUtcTimestampToMs = (value: string): number | null => {
  if (!value) return null

  const raw = value.trim()
  if (!raw) return null

  const hasTimezone = /(Z|[+-]\d{2}:?\d{2})$/i.test(raw)
  if (hasTimezone) {
    const ms = Date.parse(raw)
    return Number.isFinite(ms) ? ms : null
  }

  const isoLike = raw.includes('T') ? raw : raw.replace(' ', 'T')
  const utcCandidate = `${isoLike}Z`
  const utcMs = Date.parse(utcCandidate)
  if (Number.isFinite(utcMs)) return utcMs

  const fallbackMs = Date.parse(raw)
  return Number.isFinite(fallbackMs) ? fallbackMs : null
}

const parseUtcValueToMs = (value: Date | string): number | null => {
  if (value instanceof Date) {
    const ms = value.getTime()
    return Number.isFinite(ms) ? ms : null
  }

  return parseUtcTimestampToMs(value)
}

const localTimeZoneName = (date: Date): string => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZoneName: 'short',
  }).formatToParts(date)

  return parts.find((part) => part.type === 'timeZoneName')?.value ?? 'local'
}

export const formatInstantAsLocalDate = (
  value: Date | string | null | undefined
): string => {
  if (!value) return ''

  const ms = parseUtcValueToMs(value)
  if (ms == null) return ''

  const date = new Date(ms)
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(
    date.getDate()
  )}`
}

export const formatInstantAsLocalDateTime = (
  value: Date | string | null | undefined
): string => {
  if (!value) return ''

  const ms = parseUtcValueToMs(value)
  if (ms == null) return ''

  const date = new Date(ms)
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(
    date.getDate()
  )} ${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(
    date.getSeconds()
  )} ${localTimeZoneName(date)}`
}

const toODataUtcLiteral = (date: Date): string =>
  date.toISOString().replace(/\.\d{3}Z$/, 'Z')

export const localDateTimeToUtcODataLiteral = (
  value: Date | string
): string => {
  const localDate =
    value instanceof Date ? value : parseWallClockDateTimeLiteral(value)

  if (localDate && Number.isFinite(localDate.getTime())) {
    return toODataUtcLiteral(localDate)
  }

  const fallbackMs = parseUtcValueToMs(value)
  return fallbackMs == null ? '' : toODataUtcLiteral(new Date(fallbackMs))
}

export const parseTimeParts = (
  value: string
):
  | {
      hours: number
      minutes: number
      seconds: number
      milliseconds: number
    }
  | null => {
  const raw = (value ?? '').trim()
  if (!raw) return { hours: 0, minutes: 0, seconds: 0, milliseconds: 0 }

  const tokens = raw.split(':')
  if (tokens.length < 2 || tokens.length > 3) return null

  const last = tokens[tokens.length - 1]
  const secParts = last.split('.')
  const seconds = Number(secParts[0])
  const fractionalMs = Number(`0.${secParts[1] ?? '0'}`) * 1000

  if (!Number.isFinite(seconds) || !Number.isFinite(fractionalMs)) return null

  let hours = 0
  let minutes = 0

  if (tokens.length === 2) {
    minutes = Number(tokens[0])
  } else {
    hours = Number(tokens[0])
    minutes = Number(tokens[1])
  }

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null

  return {
    hours,
    minutes,
    seconds,
    milliseconds: Math.floor(fractionalMs),
  }
}
