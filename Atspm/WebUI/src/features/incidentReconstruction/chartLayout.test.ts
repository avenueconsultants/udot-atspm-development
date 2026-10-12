// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - chartLayout.test.ts
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
  ADJUSTMENT_NOTE_HEIGHT,
  CHART_FONTS,
  MAX_LEVELS,
  MAX_RISE,
  chartGeometry,
  fitZoom,
  layoutCallouts,
  leaderPoints,
  placeCallout,
  textOnLeft,
  titleHeight,
  wrapLines,
} from './chartLayout'
import { EventRow } from './eventRows'
import { SECOND } from './wallClock'

const row = (time: number): EventRow =>
  ({ time, event: { key: String(time) } }) as unknown as EventRow

// Seven pixels a character, so "x".repeat(20) is 140 pixels.
const measure = (text: string) => text.length * 7

describe('layoutCallouts', () => {
  it('steps later callouts down when their leader would cross an earlier callout', () => {
    // 1000 pixels wide: the plot runs from 200 to 976 pixels for 0 to 776 ms.
    const layout = layoutCallouts(
      [
        { row: row(100), time: '', text: 'x'.repeat(20) },
        { row: row(200), time: '', text: 'x'.repeat(20) },
        { row: row(600), time: '', text: 'x'.repeat(5) },
      ],
      0,
      776,
      1000,
      measure
    )
    expect(layout.boxes.map((box) => box.level)).toEqual([0, 1, 0])
    expect(layout.levels).toBe(2)
  })

  it('measures moved callouts but leaves them out of the stack', () => {
    const layout = layoutCallouts(
      [
        { row: row(100), time: '', text: 'x'.repeat(20) },
        { row: row(200), time: '', text: 'x'.repeat(20) },
      ],
      0,
      776,
      1000,
      measure,
      new Set(['100'])
    )
    expect(layout.boxes.map((box) => box.level)).toEqual([null, 0])
    expect(layout.boxes[0].textWidth).toBe(140)
    expect(layout.levels).toBe(1)
  })

  it('puts the text left of the number near the right edge', () => {
    const layout = layoutCallouts(
      [{ row: row(770), time: '', text: 'x'.repeat(20) }],
      0,
      776,
      1000,
      measure
    )
    expect(layout.boxes[0].flipped).toBe(true)
  })
})

describe('wrapLines', () => {
  const wrap = (text: string, maxWidth: number) =>
    wrapLines(text, CHART_FONTS.label, maxWidth, 2, measure)

  it('keeps text that fits on one line', () => {
    expect(wrap('Phase 5 goes red', 150)).toEqual(['Phase 5 goes red'])
    expect(wrap('', 150)).toEqual([])
  })

  it('breaks between words', () => {
    expect(wrap('Northbound car enters on red', 150)).toEqual([
      'Northbound car enters',
      'on red',
    ])
  })

  it('cuts text past the last line with an ellipsis', () => {
    expect(wrap('one two three four five six', 70)).toEqual([
      'one two',
      'three fou…',
    ])
  })

  it('breaks a word too wide for a line', () => {
    expect(wrap('x'.repeat(30), 70)).toEqual([
      'x'.repeat(10),
      `${'x'.repeat(9)}…`,
    ])
  })
})

describe('chartGeometry', () => {
  it('moves everything down to make room for the adjustment note', () => {
    const plain = chartGeometry(2, 3, titleHeight(false))
    const adjusted = chartGeometry(2, 3, titleHeight(true))
    expect(adjusted.titleHeight - plain.titleHeight).toBe(
      ADJUSTMENT_NOTE_HEIGHT
    )
    expect(adjusted.gridTop - plain.gridTop).toBe(ADJUSTMENT_NOTE_HEIGHT)
    expect(adjusted.height - plain.height).toBe(ADJUSTMENT_NOTE_HEIGHT)
  })

  it('makes room for the highest moved callout, and no more', () => {
    // Two levels and the axis take 138 pixels above the bands.
    expect(chartGeometry(2, 3, 62, 100).gridTop).toBe(210)
    const raised = chartGeometry(2, 3, 62, 200)
    expect(raised.gridTop).toBe(272)
    // The stack stays on the axis.
    expect(raised.gridTop - raised.stackTop).toBe(138)
    // Every callout moved below the top of the stack: just the axis.
    expect(chartGeometry(0, 3, 62, 20).gridTop).toBe(102)
  })
})

describe('dragged callouts', () => {
  // The event at 300 pixels, with 70 pixels of text: 76 pixels beside the number.
  const [box] = layoutCallouts(
    [{ row: row(100), time: '', text: 'x'.repeat(10) }],
    0,
    776,
    1000,
    measure
  ).boxes
  // Title 62, callouts from 72, bands 210 to 306, numbers no lower than 290.
  const geometry = chartGeometry(2, 3, titleHeight(false))

  it('sits over its event at its level until dragged', () => {
    expect(placeCallout(box, undefined, 1000, geometry)).toEqual({
      x: 300,
      top: 72,
    })
  })

  it('keeps its offset from the event, so it follows the event on zoom', () => {
    const position = { dx: -100, rise: 60 }
    expect(placeCallout(box, position, 1000, geometry)).toEqual({
      x: 200,
      top: 150,
    })
    expect(
      placeCallout({ ...box, eventX: 500 }, position, 1000, geometry)
    ).toEqual({ x: 400, top: 150 })
  })

  it('stays with the bands when the room above them changes', () => {
    const raised = chartGeometry(2, 3, titleHeight(false), 200)
    expect(placeCallout(box, { dx: 0, rise: 60 }, 1000, raised)).toEqual({
      x: 300,
      top: raised.gridTop - 60,
    })
  })

  it('stays inside the chart, over the title at most, above the bottom of the bands', () => {
    expect(
      placeCallout(box, { dx: -1000, rise: 1000 }, 1000, geometry)
    ).toEqual({ x: 8, top: 0 })
    expect(
      placeCallout(box, { dx: 5000, rise: -1000 }, 1000, geometry)
    ).toEqual({ x: 992, top: 290 })
  })

  it('goes no higher than a full stack above the bands', () => {
    const tall = chartGeometry(MAX_LEVELS, 3, titleHeight(false))
    expect(placeCallout(box, { dx: 0, rise: 1000 }, 1000, tall).top).toBe(
      tall.gridTop - MAX_RISE
    )
  })

  it('puts the text on the side away from the event when there is room', () => {
    expect(textOnLeft(box, 300, 1000)).toBe(false)
    expect(textOnLeft(box, 200, 1000)).toBe(true)
    // Dragged left, but no room on the left.
    expect(textOnLeft(box, 50, 1000)).toBe(false)
    // No room on the right.
    expect(textOnLeft(box, 990, 1000)).toBe(true)
  })

  it('runs its line to the event, then down through the bands', () => {
    expect(leaderPoints({ x: 200, top: 150 }, 300, geometry)).toEqual([
      [200, 158],
      [300, 158],
      [300, 306],
    ])
    // Below the top of the bands, the line meets the event at the top.
    expect(leaderPoints({ x: 200, top: 250 }, 300, geometry)).toEqual([
      [200, 258],
      [300, 210],
      [300, 306],
    ])
  })
})

describe('fitZoom', () => {
  it('pads the labeled events to whole 5-second marks', () => {
    const start = 0
    const end = 120 * SECOND
    const zoom = fitZoom([75 * SECOND, 84.9 * SECOND], start, end)
    expect(zoom.from).toBeCloseTo((65 / 120) * 100)
    expect(zoom.to).toBeCloseTo((95 / 120) * 100)
  })
})
