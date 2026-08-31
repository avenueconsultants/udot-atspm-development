// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - searchParams.test.ts
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
  formatUtcDateToYYYYMMDD,
  parseBool,
  parseDate,
  parseNum,
  parseTimeOfDayToDate,
  parseYYYYMMDDToUtcDate,
  safeJsonParse,
} from './searchParams'

describe('parseBool', () => {
  it('parses "true" and "false"', () => {
    expect(parseBool('true')).toBe(true)
    expect(parseBool('false')).toBe(false)
  })

  it('returns undefined for null or unrecognized values', () => {
    expect(parseBool(null)).toBeUndefined()
    expect(parseBool('yes')).toBeUndefined()
    expect(parseBool('')).toBeUndefined()
  })
})

describe('parseNum', () => {
  it('parses numeric strings, including negatives and decimals', () => {
    expect(parseNum('42')).toBe(42)
    expect(parseNum('-3.5')).toBe(-3.5)
  })

  it('returns undefined for null, empty, or non-finite input', () => {
    expect(parseNum(null)).toBeUndefined()
    expect(parseNum('')).toBeUndefined()
    expect(parseNum('not-a-number')).toBeUndefined()
    expect(parseNum('Infinity')).toBeUndefined()
  })
})

describe('parseDate', () => {
  it('parses a valid ISO date string', () => {
    const result = parseDate('2026-04-01T08:00:00Z')
    expect(result).toBeInstanceOf(Date)
    expect(result?.toISOString()).toBe('2026-04-01T08:00:00.000Z')
  })

  it('returns undefined for null, empty, or unparsable input', () => {
    expect(parseDate(null)).toBeUndefined()
    expect(parseDate('')).toBeUndefined()
    expect(parseDate('not-a-date')).toBeUndefined()
  })
})

describe('safeJsonParse', () => {
  it('parses valid JSON', () => {
    expect(safeJsonParse<{ a: number }>('{"a":1}')).toEqual({ a: 1 })
  })

  it('returns undefined for null or invalid JSON', () => {
    expect(safeJsonParse(null)).toBeUndefined()
    expect(safeJsonParse('{not json')).toBeUndefined()
  })
})

describe('parseTimeOfDayToDate', () => {
  it('parses "HH:mm" anchored to today', () => {
    const result = parseTimeOfDayToDate('14:30')
    expect(result?.getHours()).toBe(14)
    expect(result?.getMinutes()).toBe(30)
    expect(result?.getSeconds()).toBe(0)
  })

  it('parses "HH:mm:ss"', () => {
    const result = parseTimeOfDayToDate('01:02:03')
    expect(result?.getHours()).toBe(1)
    expect(result?.getMinutes()).toBe(2)
    expect(result?.getSeconds()).toBe(3)
  })

  it('returns undefined for missing, malformed, or out-of-range input', () => {
    expect(parseTimeOfDayToDate(undefined)).toBeUndefined()
    expect(parseTimeOfDayToDate(null)).toBeUndefined()
    expect(parseTimeOfDayToDate('')).toBeUndefined()
    expect(parseTimeOfDayToDate('9:30')).toBeUndefined() // hours must be zero-padded
    expect(parseTimeOfDayToDate('24:00')).toBeUndefined()
    expect(parseTimeOfDayToDate('12:60')).toBeUndefined()
    expect(parseTimeOfDayToDate('12:30:60')).toBeUndefined()
  })
})

describe('parseYYYYMMDDToUtcDate', () => {
  it('parses a valid date as UTC midnight', () => {
    const result = parseYYYYMMDDToUtcDate('2026-04-01')
    expect(result?.toISOString()).toBe('2026-04-01T00:00:00.000Z')
  })

  it('handles a leap day', () => {
    const result = parseYYYYMMDDToUtcDate('2024-02-29')
    expect(result?.toISOString()).toBe('2024-02-29T00:00:00.000Z')
  })

  it('returns undefined for missing or malformed input', () => {
    expect(parseYYYYMMDDToUtcDate(undefined)).toBeUndefined()
    expect(parseYYYYMMDDToUtcDate(null)).toBeUndefined()
    expect(parseYYYYMMDDToUtcDate('')).toBeUndefined()
    expect(parseYYYYMMDDToUtcDate('04/01/2026')).toBeUndefined()
  })

  it('returns undefined for out-of-range month or day', () => {
    expect(parseYYYYMMDDToUtcDate('2026-13-01')).toBeUndefined()
    expect(parseYYYYMMDDToUtcDate('2026-01-32')).toBeUndefined()
    expect(parseYYYYMMDDToUtcDate('2026-00-01')).toBeUndefined()
  })
})

describe('formatUtcDateToYYYYMMDD', () => {
  it('formats a UTC date as YYYY-MM-DD, padding month and day', () => {
    expect(formatUtcDateToYYYYMMDD(new Date(Date.UTC(2026, 0, 5)))).toBe(
      '2026-01-05'
    )
  })

  it('round-trips with parseYYYYMMDDToUtcDate', () => {
    const date = parseYYYYMMDDToUtcDate('2026-11-23')
    expect(date).toBeInstanceOf(Date)
    expect(formatUtcDateToYYYYMMDD(date as Date)).toBe('2026-11-23')
  })
})
