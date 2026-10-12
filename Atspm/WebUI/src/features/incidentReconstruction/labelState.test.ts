// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - labelState.test.ts
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
  clearsOnGenerate,
  toggleLabeled,
  withFilledLabels,
  withLabelText,
  withName,
} from './labelState'

describe('toggleLabeled', () => {
  it('numbers an event with no text, and taking it off drops its text', () => {
    expect(toggleLabeled({}, 'a')).toEqual({ a: '' })
    expect(toggleLabeled({ a: 'Car enters', b: '' }, 'a')).toEqual({ b: '' })
  })
})

describe('withLabelText', () => {
  it('keeps the event numbered when its text is cleared', () => {
    expect(withLabelText({ a: 'x' }, 'a', '')).toEqual({ a: '' })
  })
})

describe('withFilledLabels', () => {
  it('fills only labeled events with no text', () => {
    const suggestions = new Map([
      ['a', 'Light turns yellow'],
      ['b', 'Light turns red'],
      ['c', 'Not labeled'],
    ])
    expect(withFilledLabels({ a: ' ', b: 'Mine' }, suggestions)).toEqual({
      a: 'Light turns yellow',
      b: 'Mine',
    })
  })
})

describe('withName', () => {
  it('sets a name and removes a cleared one', () => {
    expect(withName({}, 'phase-6', 'Southbound light')).toEqual({
      'phase-6': 'Southbound light',
    })
    expect(withName({ 'phase-6': 'x' }, 'phase-6', ' ')).toEqual({})
  })
})

describe('clearsOnGenerate', () => {
  const at = (day: number, hours: number) => Date.UTC(2026, 3, day, hours)

  it('clears nothing on the first Generate or on the same day and location', () => {
    expect(
      clearsOnGenerate(
        { location: null, start: null },
        { location: '7115', start: at(14, 17) }
      )
    ).toBe('nothing')
    expect(
      clearsOnGenerate(
        { location: '7115', start: at(14, 1) },
        { location: '7115', start: at(14, 23) }
      )
    ).toBe('nothing')
  })

  it('clears the labels on another day', () => {
    expect(
      clearsOnGenerate(
        { location: '7115', start: at(14, 17) },
        { location: '7115', start: at(15, 17) }
      )
    ).toBe('labels')
  })

  it('clears everything at another location', () => {
    expect(
      clearsOnGenerate(
        { location: '7115', start: at(14, 17) },
        { location: '7116', start: at(15, 17) }
      )
    ).toBe('everything')
  })
})
