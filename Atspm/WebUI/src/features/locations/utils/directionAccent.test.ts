// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - directionAccent.test.ts
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
import { Color } from '@/features/charts/utils'
import {
  getDirectionAccentBorder,
  getDirectionAccentColor,
} from './directionAccent'

describe('getDirectionAccentColor', () => {
  it.each([
    ['North', Color.Blue],
    ['NB', Color.Blue],
    ['Northeast', Color.Blue],
    ['NW', Color.Blue],
    ['N', Color.Blue],
    ['South', Color.BrightRed],
    ['SB', Color.BrightRed],
    ['Southwest', Color.BrightRed],
    ['S', Color.BrightRed],
    ['East', Color.Yellow],
    ['EB', Color.Yellow],
    ['E', Color.Yellow],
    ['West', Color.Orange],
    ['WB', Color.Orange],
    ['W', Color.Orange],
  ])('maps "%s" to the correct accent color', (label, expected) => {
    expect(getDirectionAccentColor(label)).toBe(expected)
  })

  it('is case-insensitive and ignores surrounding whitespace or punctuation', () => {
    expect(getDirectionAccentColor('  northbound ')).toBe(Color.Blue)
    expect(getDirectionAccentColor('south-bound')).toBe(Color.BrightRed)
  })

  it('only considers the first word of a multi-word label', () => {
    expect(getDirectionAccentColor('North Approach')).toBe(Color.Blue)
  })

  it('falls back to the unknown accent for null, empty, or unrecognized labels', () => {
    const unknown = getDirectionAccentColor(null)
    expect(getDirectionAccentColor(undefined)).toBe(unknown)
    expect(getDirectionAccentColor('')).toBe(unknown)
    expect(getDirectionAccentColor('NA')).toBe(unknown)
    expect(getDirectionAccentColor('Diagonal')).toBe(unknown)
  })
})

describe('getDirectionAccentBorder', () => {
  it('draws no border for an unrecognized direction', () => {
    expect(getDirectionAccentBorder('Diagonal')).toBe('none')
  })
})
