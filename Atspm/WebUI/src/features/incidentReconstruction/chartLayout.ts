// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - chartLayout.ts
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
import { EventRow } from './eventRows'
import { MINUTE, SECOND } from './wallClock'

// Pixel geometry for the incident chart, kept free of ECharts so it can be tested.

export const GRID_LEFT = 200
export const GRID_RIGHT = 24
/** The title and subtitle at the top of the chart. */
export const TITLE_HEIGHT = 62
/** The latency adjustment note, under the subtitle when there is one. */
export const ADJUSTMENT_NOTE_TOP = 50
export const ADJUSTMENT_NOTE_HEIGHT = 18
export const AXIS_HEIGHT = 30
export const ROW_HEIGHT = 32
export const BAND_HEIGHT = 20
/** A callout's time and up to two lines of text, with room between levels. */
export const LEVEL_HEIGHT = 54
export const CALLOUT_TOP_PADDING = 10
export const MAX_LEVELS = 10
export const BADGE_SIZE = 16
/** Between a callout's number and its text. */
export const CALLOUT_TEXT_GAP = 6
/** Callout text wraps onto a second line past this width. */
export const CALLOUT_TEXT_MAX = 150
export const CALLOUT_MAX_LINES = 2
export const CALLOUT_LINE_HEIGHT = 15
/** The zoom slider at the bottom of the chart, with its times under the handles. */
export const ZOOM_SLIDER_HEIGHT = 30
export const ZOOM_LABEL_HEIGHT = 18
export const ZOOM_SLIDER_BOTTOM = ZOOM_LABEL_HEIGHT + 4
export const ZOOM_TOP_GAP = 18
export const ZOOM_HEIGHT =
  ZOOM_TOP_GAP + ZOOM_SLIDER_HEIGHT + ZOOM_SLIDER_BOTTOM

export const CHART_FONTS = {
  label: '12px Roboto, sans-serif',
  time: 'bold 12px Roboto, sans-serif',
  badge: 'bold 10px Roboto, sans-serif',
  small: '11px Roboto, sans-serif',
  note: 'italic 12px Roboto, sans-serif',
}

export type MeasureText = (text: string, font: string) => number

/** The part of the window in view, in percent, the way the zoom slider reports it. */
export interface Zoom {
  from: number
  to: number
}

export const FULL_ZOOM: Zoom = { from: 0, to: 100 }

export function zoomedWindow(
  start: number,
  end: number,
  zoom: Zoom
): { start: number; end: number } {
  const span = end - start
  return {
    start: start + (span * zoom.from) / 100,
    end: start + (span * zoom.to) / 100,
  }
}

const FIT_STEP = 5 * SECOND
const FIT_MIN_PADDING = 10 * SECOND

/**
 * The zoom that frames the labeled events: padding on each side as wide as
 * their spread, at least 10 seconds, out to whole 5-second marks.
 */
export function fitZoom(times: number[], start: number, end: number): Zoom {
  if (times.length === 0 || end <= start) return FULL_ZOOM
  const first = Math.min(...times)
  const last = Math.max(...times)
  const padding = Math.max(FIT_MIN_PADDING, last - first)
  const from = Math.max(
    start,
    Math.floor((first - padding) / FIT_STEP) * FIT_STEP
  )
  const to = Math.min(end, Math.ceil((last + padding) / FIT_STEP) * FIT_STEP)
  const span = end - start
  return {
    from: ((from - start) / span) * 100,
    to: ((to - start) / span) * 100,
  }
}

export interface AxisTicks {
  /** Between labelled ticks. */
  interval: number
  /** Minor ticks between labelled ticks. */
  minorSplit: number
}

/** A labelled tick every 5 seconds and a minor tick every second up to 2 minutes, scaled up after. */
export function axisTicks(span: number): AxisTicks {
  if (span <= 2 * MINUTE) return { interval: 5 * SECOND, minorSplit: 5 }
  if (span <= 5 * MINUTE) return { interval: 15 * SECOND, minorSplit: 3 }
  if (span <= 10 * MINUTE) return { interval: 30 * SECOND, minorSplit: 6 }
  if (span <= 30 * MINUTE) return { interval: 2 * MINUTE, minorSplit: 4 }
  return { interval: 5 * MINUTE, minorSplit: 5 }
}

export function timeToPixel(
  time: number,
  start: number,
  end: number,
  chartWidth: number
): number {
  const plotWidth = Math.max(1, chartWidth - GRID_LEFT - GRID_RIGHT)
  return GRID_LEFT + ((time - start) / (end - start)) * plotWidth
}

export interface CalloutItem {
  row: EventRow
  /** The event's time, beside the number. */
  time: string
  /** Shown under the time. Empty for the time alone. */
  text: string
}

export interface CalloutBox extends CalloutItem {
  /** Pixel x of the event. The number sits centred on it. */
  eventX: number
  textWidth: number
  /** The text, wrapped to fit beside the number. */
  textLines: string[]
  /** 0 is the top level. Null when the user moved the callout. */
  level: number | null
  /** True when the text sits left of the number because it would run off the right edge. */
  flipped: boolean
  left: number
  right: number
}

export interface CalloutLayout {
  boxes: CalloutBox[]
  levels: number
}

const CLEARANCE = 4

/**
 * Stacks callouts in levels above the axis, earliest first from the top. A
 * callout takes the highest level where it overlaps no other callout, no
 * leader line from above runs through it, and its own leader line runs
 * through no callout below. Leader lines run from each number down to the
 * bands. Callouts the user moved, by event key, are measured but not stacked.
 */
export function layoutCallouts(
  items: CalloutItem[],
  start: number,
  end: number,
  chartWidth: number,
  measure: MeasureText,
  moved: ReadonlySet<string> = new Set()
): CalloutLayout {
  const boxes: CalloutBox[] = []
  let levels = 0
  const half = BADGE_SIZE / 2

  for (const item of [...items].sort((a, b) => a.row.time - b.row.time)) {
    const eventX = timeToPixel(item.row.time, start, end, chartWidth)
    const textLines = wrapLines(
      item.text,
      CHART_FONTS.label,
      CALLOUT_TEXT_MAX,
      CALLOUT_MAX_LINES,
      measure
    )
    const timeWidth = item.time ? measure(item.time, CHART_FONTS.time) : 0
    const textWidth = Math.ceil(
      Math.max(
        timeWidth,
        ...textLines.map((line) => measure(line, CHART_FONTS.label))
      )
    )
    const reach = textWidth ? CALLOUT_TEXT_GAP + textWidth : 0
    const flipped = eventX + half + reach > chartWidth - 2
    const left = flipped ? eventX - half - reach : eventX - half
    const right = flipped ? eventX + half : eventX + half + reach
    const box = { ...item, eventX, textWidth, textLines, flipped, left, right }
    if (moved.has(item.row.event.key)) {
      boxes.push({ ...box, level: null })
      continue
    }

    const fits = (level: number) =>
      boxes.every((box) => {
        if (box.level === null) return true
        if (box.level === level) {
          return right + CLEARANCE < box.left || left > box.right + CLEARANCE
        }
        if (box.level > level) {
          return eventX < box.left - 2 || eventX > box.right + 2
        }
        return box.eventX < left - 2 || box.eventX > right + 2
      })

    let level = -1
    for (let candidate = 0; candidate < levels; candidate++) {
      if (fits(candidate)) {
        level = candidate
        break
      }
    }
    if (level < 0) {
      level =
        levels < MAX_LEVELS
          ? levels++
          : leastCrowded(boxes, levels, left, right)
    }

    boxes.push({ ...box, level })
  }

  return { boxes, levels }
}

/**
 * Breaks text into lines no wider than maxWidth, between words where it can.
 * Text past the last line is cut and ends in an ellipsis. ECharts' own
 * wrapping guesses some character widths, so callouts wrap here instead.
 */
export function wrapLines(
  text: string,
  font: string,
  maxWidth: number,
  maxLines: number,
  measure: MeasureText
): string[] {
  const fits = (value: string) => measure(value, font) <= maxWidth
  const pieces = text
    .split(/\s+/)
    .filter(Boolean)
    .flatMap((word) => (fits(word) ? [word] : breakWord(word, fits)))
  const lines: string[] = []
  for (const piece of pieces) {
    const joined = lines.length ? `${lines[lines.length - 1]} ${piece}` : ''
    if (joined && fits(joined)) lines[lines.length - 1] = joined
    else lines.push(piece)
  }
  if (lines.length <= maxLines) return lines

  const kept = lines.slice(0, maxLines)
  let last = kept[maxLines - 1]
  while (last && !fits(`${last}…`)) last = last.slice(0, -1)
  kept[maxLines - 1] = `${last.trimEnd()}…`
  return kept
}

/** A word too wide for a line, in pieces that each fit. */
function breakWord(word: string, fits: (value: string) => boolean): string[] {
  const pieces: string[] = []
  let piece = ''
  for (const char of word) {
    if (piece && !fits(piece + char)) {
      pieces.push(piece)
      piece = char
    } else {
      piece += char
    }
  }
  if (piece) pieces.push(piece)
  return pieces
}

function leastCrowded(
  boxes: CalloutBox[],
  levels: number,
  left: number,
  right: number
): number {
  let best = levels - 1
  let bestOverlap = Number.POSITIVE_INFINITY
  for (let level = levels - 1; level >= 0; level--) {
    const overlap = boxes
      .filter((box) => box.level === level)
      .reduce(
        (total, box) =>
          total +
          Math.max(0, Math.min(right, box.right) - Math.max(left, box.left)),
        0
      )
    if (overlap < bestOverlap) {
      best = level
      bestOverlap = overlap
    }
  }
  return best
}

export interface ChartGeometry {
  /** The title, subtitle and any adjustment note. */
  titleHeight: number
  /** Top of the stacked callouts' first level. */
  stackTop: number
  gridTop: number
  gridBottom: number
  sliderTop: number
  height: number
}

/** The title and subtitle, plus the note when times are adjusted. */
export function titleHeight(adjusted: boolean): number {
  return TITLE_HEIGHT + (adjusted ? ADJUSTMENT_NOTE_HEIGHT : 0)
}

/** How far a callout can sit above the bands: the most the stack can take. */
export const MAX_RISE = MAX_LEVELS * LEVEL_HEIGHT + AXIS_HEIGHT

/**
 * Room above the bands for the stacked callouts and the highest callout the
 * user moved, so moving callouts lower shrinks the chart and moving one up
 * over the title grows it. The stack sits on the axis.
 */
export function chartGeometry(
  levels: number,
  bandCount: number,
  titleHeight: number,
  highestRise = 0
): ChartGeometry {
  const stackHeight = levels * LEVEL_HEIGHT + AXIS_HEIGHT
  const gridTop =
    titleHeight + CALLOUT_TOP_PADDING + Math.max(stackHeight, highestRise)
  const gridBottom = gridTop + Math.max(1, bandCount) * ROW_HEIGHT
  const height = gridBottom + ZOOM_HEIGHT
  return {
    titleHeight,
    stackTop: gridTop - stackHeight,
    gridTop,
    gridBottom,
    sliderTop: height - ZOOM_SLIDER_BOTTOM - ZOOM_SLIDER_HEIGHT,
    height,
  }
}

/** Where the user dropped a callout. */
export interface CalloutPosition {
  /** The number's centre less the event's x, so the callout follows its event on zoom. */
  dx: number
  /**
   * The number's top, in pixels above the bands, so the callout stays with
   * the bands as the room above them changes.
   */
  rise: number
}

/** Dragged callouts by event key. */
export type CalloutPositions = Record<string, CalloutPosition>

/** A callout's number: its centre and top. */
export interface CalloutPlace {
  x: number
  top: number
}

/**
 * Keeps a number inside the chart and above the bottom of the bands. It can
 * go up over the title, which grows the chart when dropped.
 */
export function clampCallout(
  place: CalloutPlace,
  chartWidth: number,
  geometry: ChartGeometry
): CalloutPlace {
  const half = BADGE_SIZE / 2
  const top = Math.max(0, geometry.gridTop - MAX_RISE)
  const bottom = geometry.gridBottom - BADGE_SIZE
  return {
    x: Math.min(Math.max(place.x, half), chartWidth - half),
    top: Math.min(Math.max(place.top, top), bottom),
  }
}

/** Where the user dropped the callout, or over its event at its level. */
export function placeCallout(
  box: CalloutBox,
  position: CalloutPosition | undefined,
  chartWidth: number,
  geometry: ChartGeometry
): CalloutPlace {
  if (!position) {
    const level = box.level ?? 0
    return { x: box.eventX, top: geometry.stackTop + level * LEVEL_HEIGHT }
  }
  return clampCallout(
    { x: box.eventX + position.dx, top: geometry.gridTop - position.rise },
    chartWidth,
    geometry
  )
}

/**
 * True when the text sits left of the number: when the number was dragged
 * left of its event, so the text points away from the line, or when the text
 * would run off the right edge.
 */
export function textOnLeft(
  box: CalloutBox,
  x: number,
  chartWidth: number
): boolean {
  const half = BADGE_SIZE / 2
  const reach = box.textWidth ? CALLOUT_TEXT_GAP + box.textWidth : 0
  const fitsRight = x + half + reach <= chartWidth - 2
  if (x < box.eventX - 1) return x - half - reach >= 2 || !fitsRight
  return !fitsRight
}

/**
 * The line from a callout's number to its event and down through the bands.
 * It meets the event's time at the number's height, or at the top of the
 * bands when the number sits lower.
 */
export function leaderPoints(
  place: CalloutPlace,
  eventX: number,
  geometry: ChartGeometry
): [number, number][] {
  const y = place.top + BADGE_SIZE / 2
  return [
    [place.x, y],
    [eventX, Math.min(y, geometry.gridTop)],
    [eventX, geometry.gridBottom],
  ]
}
