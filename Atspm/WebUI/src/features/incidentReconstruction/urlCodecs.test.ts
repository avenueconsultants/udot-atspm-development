// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - urlCodecs.test.ts
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
  parseAdjustmentParam,
  parseLabels,
  parseNames,
  parseTimeParam,
  serializeAdjustmentParam,
  serializeLabels,
  serializeNames,
  serializeTimeParam,
} from './urlCodecs'

describe('share link labels', () => {
  const labels = {
    '174230.9-82-13': 'Vehicle A enters, "fast"',
    '174243.0-82-13-2': 'Fußgänger überquert – 歩行者',
  }

  it('survive a round trip through the address bar', () => {
    const query = new URLSearchParams({
      labels: serializeLabels(labels),
    }).toString()
    const back = new URLSearchParams(query).get('labels') as string
    expect(parseLabels(back)).toEqual(labels)
  })

  it('keep labeled events with no text and drop keys that are not events', () => {
    expect(serializeLabels({ '174230.9-82-13': '', 'not-a-key': 'x' })).toBe(
      '{"174230.9-82-13":""}'
    )
    expect(
      parseLabels(
        '{"bad":"x","174230.9-1-2":3,"174230.9-1-3":"ok","174230.9-1-4":""}'
      )
    ).toEqual({
      '174230.9-1-3': 'ok',
      '174230.9-1-4': '',
    })
  })

  it('cut labels to 80 characters and ignore anything that is not an object', () => {
    expect(
      parseLabels(JSON.stringify({ '174230.9-1-2': 'x'.repeat(90) }))?.[
        '174230.9-1-2'
      ]
    ).toHaveLength(80)
    expect(parseLabels('[1,2]')).toBeNull()
    expect(parseLabels('{broken')).toBeNull()
  })
})

describe('share link signal names', () => {
  it('round trip, dropping blank names and keys that are not bands', () => {
    const serialized = serializeNames({
      'phase-6': 'Southbound traffic light',
      'phase-2': '  ',
      'not a key': 'x',
    })
    expect(serialized).toBe('{"phase-6":"Southbound traffic light"}')
    expect(parseNames(serialized)).toEqual({
      'phase-6': 'Southbound traffic light',
    })
  })

  it('cut names to 60 characters and ignore anything that is not an object', () => {
    expect(
      parseNames(JSON.stringify({ 'phase-6': 'x'.repeat(70) }))?.['phase-6']
    ).toHaveLength(60)
    expect(parseNames('"x"')).toBeNull()
  })
})

describe('share link times', () => {
  it('round trip the incident time in whole seconds', () => {
    const time = parseTimeParam('2026-04-14T17:42:00.7') as number
    expect(serializeTimeParam(time)).toBe('2026-04-14T17:42:00')
  })

  it('ignore a time before 1900, which the date picker cannot show', () => {
    expect(parseTimeParam('0415-02-26T17:42:00')).toBeNull()
  })

  it('read the adjustment to the tenth and ignore junk', () => {
    expect(parseAdjustmentParam('1.25')).toBe(1.3)
    expect(parseAdjustmentParam('abc')).toBeNull()
    expect(parseAdjustmentParam(' ')).toBeNull()
    expect(serializeAdjustmentParam(-0.5)).toBe('-0.5')
  })
})
