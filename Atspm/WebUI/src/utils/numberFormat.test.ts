// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - numberFormat.test.ts
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
import { formatNumber, roundTo } from './numberFormat'

describe('roundTo', () => {
  it('rounds to the given number of decimals', () => {
    expect(roundTo(1.2345, 2)).toBe(1.23)
    expect(roundTo(2.005, 2)).toBe(2.01)
  })

  it('rounds to a whole number when decimals is 0', () => {
    expect(roundTo(1.5, 0)).toBe(2)
  })

  it('returns null for null or undefined input', () => {
    expect(roundTo(null, 2)).toBeNull()
    expect(roundTo(undefined, 2)).toBeNull()
  })

  it('passes through 0 unchanged', () => {
    expect(roundTo(0, 2)).toBe(0)
  })
})

describe('formatNumber', () => {
  it('formats a number with the requested decimal places', () => {
    expect(formatNumber(1.2345, 2)).toBe('1.23')
  })

  it('rounds to a whole number string when decimals is omitted', () => {
    expect(formatNumber(1.6)).toBe('2')
  })

  it('accepts numeric strings', () => {
    expect(formatNumber('3.14159', 2)).toBe('3.14')
  })

  it('returns an empty string for null, undefined, or non-numeric input', () => {
    expect(formatNumber(null)).toBe('')
    expect(formatNumber(undefined)).toBe('')
    expect(formatNumber('not-a-number')).toBe('')
  })

  it('returns an empty string for non-finite numbers', () => {
    expect(formatNumber(Infinity)).toBe('')
    expect(formatNumber(NaN)).toBe('')
  })
})
