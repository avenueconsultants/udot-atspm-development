// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - formatting.test.ts
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
import { formatBytes, formatMs } from './formatting'

describe('formatBytes', () => {
  it('returns "0 B" for zero, negative, or non-finite input', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(-5)).toBe('0 B')
    expect(formatBytes(NaN)).toBe('0 B')
  })

  it('formats sub-kilobyte values in bytes', () => {
    expect(formatBytes(500)).toBe('500 B')
  })

  it('picks the right unit at each 1024 boundary', () => {
    expect(formatBytes(1024)).toBe('1.00 KB')
    expect(formatBytes(1536)).toBe('1.50 KB')
    expect(formatBytes(1024 * 1024)).toBe('1.00 MB')
  })

  it('uses fewer decimal digits as the value gets larger', () => {
    expect(formatBytes(15 * 1024 * 1024)).toBe('15.0 MB') // >= 10: 1 digit
    expect(formatBytes(150 * 1024 * 1024)).toBe('150 MB') // >= 100: 0 digits
  })

  it('clamps to TB with no larger unit, so values beyond TB read as an inflated TB figure', () => {
    // units stops at 'TB', so anything past that just divides by 1024^4
    // instead of promoting to a PB-style unit - documenting the actual
    // (not "correct") behavior here.
    expect(formatBytes(1024 ** 6)).toBe('1048576 TB')
  })
})

describe('formatMs', () => {
  it('returns an empty string for non-finite input', () => {
    expect(formatMs(NaN)).toBe('')
  })

  it('formats sub-second durations in milliseconds', () => {
    expect(formatMs(500)).toBe('500 ms')
  })

  it('formats sub-minute durations in seconds with 2 decimals', () => {
    expect(formatMs(1500)).toBe('1.50 s')
  })

  it('displays as "60.00 s" just under the minute boundary due to toFixed rounding', () => {
    // 59999ms / 1000 = 59.999s, which is < 60 and takes the seconds branch,
    // but toFixed(2) rounds the display up to "60.00 s".
    expect(formatMs(59999)).toBe('60.00 s')
  })

  it('formats minute-plus durations as "Xm Y.Zs"', () => {
    expect(formatMs(60000)).toBe('1m 0.0s')
    expect(formatMs(90500)).toBe('1m 30.5s')
  })
})
