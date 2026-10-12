// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - chartOption.ts
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
import { createDataZoom } from '@/features/charts/common/transformers'
import { CycleColor } from '@/features/charts/timingAndActuation/timingAndActuation.transformer'
import type {
  CustomSeriesOption,
  CustomSeriesRenderItem,
  EChartsOption,
  GraphicComponentOption,
} from 'echarts'
import { graphic } from 'echarts'
import {
  ADJUSTMENT_NOTE_TOP,
  BADGE_SIZE,
  BAND_HEIGHT,
  CALLOUT_LINE_HEIGHT,
  CALLOUT_TEXT_GAP,
  CHART_FONTS,
  CalloutBox,
  CalloutLayout,
  CalloutPosition,
  CalloutPositions,
  ChartGeometry,
  GRID_LEFT,
  GRID_RIGHT,
  MeasureText,
  ROW_HEIGHT,
  ZOOM_SLIDER_BOTTOM,
  ZOOM_SLIDER_HEIGHT,
  Zoom,
  axisTicks,
  clampCallout,
  leaderPoints,
  placeCallout,
  textOnLeft,
  zoomedWindow,
} from './chartLayout'
import { EventRow, recordedEvent } from './eventRows'
import { adjustmentNote, toAdjusted, toController } from './latencyAdjustment'
import { displayName } from './signalNames'
import { INDICATION_LABELS, UNKNOWN_LABEL, signalSegments } from './signalState'
import { LOCATION_BAND_KEY, SignalIndication, TimelineBand } from './types'
import { SignalNames } from './urlCodecs'
import { formatClock, formatClockSeconds, formatDuration } from './wallClock'

// The ECharts option for the incident chart: a title, one row per signal
// drawn as coloured segments, and a numbered callout for each labeled event.
// Other events are drawn only while Pick on chart is on.

const trimColor = (color: string) => color.trim()

/** Timing and Actuation's signal colours, with softer green, yellow and red. */
export const INDICATION_COLORS: Record<SignalIndication, string> = {
  Green: '#2D9470',
  Yellow: '#E8B339',
  RedClearance: trimColor(CycleColor.DarkRed),
  Red: '#D64B4B',
  Walk: trimColor(CycleColor.LightBlue),
  FlashingDontWalk: trimColor(CycleColor.Blue),
  DontWalk: trimColor(CycleColor.DarkGrey),
}

export const UNKNOWN_COLOR = '#d9d9d9'
export const BADGE_COLOR = '#13294B'
const TEXT_COLOR = '#212121'
const MUTED_COLOR = '#5f6368'
const LOCATION_BACKGROUND = '#eeeeee'
const NOTE_BACKGROUND = '#fff4d6'
const CANDIDATE_COLOR = 'rgba(33, 33, 33, 0.45)'
const MARKER_RADIUS = 4

const SHORT_LABELS: Record<SignalIndication, string> = {
  Green: 'G',
  Yellow: 'Y',
  RedClearance: 'RC',
  Red: 'R',
  Walk: 'W',
  FlashingDontWalk: 'FDW',
  DontWalk: 'DW',
}

const DARK_TEXT = new Set<SignalIndication>(['Yellow', 'Walk'])

const indicationOrder = Object.keys(INDICATION_LABELS) as SignalIndication[]

function indicationFill(indication: SignalIndication | null): string {
  return indication ? INDICATION_COLORS[indication] : UNKNOWN_COLOR
}

/** ECharts' own save-as-image icon. */
const SAVE_ICON =
  'path://M4.7,22.9L29.3,45.5L54.7,23.4M4.6,43.6L4.6,58L53.8,58L53.8,43.6M29.2,45.1L29.2,0'

export interface ChartInput {
  title: string
  subtitle: string
  /** The signals on the chart, in order. */
  bands: TimelineBand[]
  names: SignalNames
  /** Numbered rows, one marker and callout each. */
  labeled: EventRow[]
  /** Events that can be picked. Empty unless Pick on chart is on. */
  candidates: EventRow[]
  /** The typed window, in adjusted time. */
  start: number
  end: number
  adjustmentSeconds: number
  zoom: Zoom
  /** Callouts for labeled events in view. */
  layout: CalloutLayout
  /** Callouts the user dragged, by event key. */
  calloutPositions: CalloutPositions
  /** A callout dropped somewhere new, or null when put back over its event. */
  onCalloutMove(key: string, position: CalloutPosition | null): void
  /** The toolbox's save button. */
  onSaveImage(): void
  geometry: ChartGeometry
  chartWidth: number
  measure: MeasureText
}

type SegmentDatum = [number, number, number]
/** Time, band row, and index into the rows list. */
type EventDatum = [number, number, number]

export const CANDIDATE_SERIES_ID = 'candidates'
export const LABELED_SERIES_ID = 'labeled'

interface Segment {
  start: number
  end: number
  indication: SignalIndication | null
}

/** A band's segments in adjusted time between two adjusted times. */
function bandSegments(
  band: TimelineBand,
  from: number,
  to: number,
  adjustmentSeconds: number
): Segment[] {
  return signalSegments(
    band.changes,
    toController(from, adjustmentSeconds),
    toController(to, adjustmentSeconds)
  ).map((segment) => ({
    ...segment,
    start: toAdjusted(segment.start, adjustmentSeconds),
    end: toAdjusted(segment.end, adjustmentSeconds),
  }))
}

export function buildChartOption(input: ChartInput): EChartsOption {
  const { bands, names, start, end, adjustmentSeconds, zoom, geometry } = input
  const rowIndex = new Map(bands.map((band, index) => [band.key, index]))
  const visible = zoomedWindow(start, end, zoom)
  const ticks = axisTicks(visible.end - visible.start)

  const segmentsByIndication = new Map<
    SignalIndication | null,
    SegmentDatum[]
  >()
  const locationBackground: SegmentDatum[] = []
  bands.forEach((band, index) => {
    if (band.key === LOCATION_BAND_KEY) {
      locationBackground.push([start, end, index])
      return
    }
    for (const segment of bandSegments(band, start, end, adjustmentSeconds)) {
      const list = segmentsByIndication.get(segment.indication) ?? []
      list.push([segment.start, segment.end, index])
      segmentsByIndication.set(segment.indication, list)
    }
  })

  const signalSeries = [...indicationOrder, null]
    .filter((indication) => segmentsByIndication.has(indication))
    .map((indication) =>
      segmentSeries(
        indication,
        segmentsByIndication.get(indication) ?? [],
        bands,
        names
      )
    )
  const backgroundSeries = locationBackground.length
    ? [backgroundBandSeries(locationBackground)]
    : []

  const eventData = (rows: EventRow[]): EventDatum[] =>
    rows.flatMap((row, index) => {
      const bandIndex = rowIndex.get(row.event.bandKey)
      return bandIndex === undefined ? [] : [[row.time, bandIndex, index]]
    })

  return {
    animation: false,
    textStyle: { fontFamily: 'Roboto, sans-serif' },
    title: {
      text: input.title,
      subtext: input.subtitle,
      left: 0,
      top: 0,
      padding: 0,
      itemGap: 10,
      textStyle: { fontSize: 18, fontWeight: 'normal', color: TEXT_COLOR },
      subtextStyle: { fontSize: 13, color: MUTED_COLOR },
    },
    // The same save button as the other charts. It saves through the page, so
    // the picture leaves out the zoom slider.
    toolbox: {
      feature: {
        mySaveImage: {
          show: true,
          title: 'Save as Image',
          icon: SAVE_ICON,
          onclick: input.onSaveImage,
        },
      },
    },
    grid: {
      top: geometry.gridTop,
      left: GRID_LEFT,
      right: GRID_RIGHT,
      height: Math.max(1, bands.length) * ROW_HEIGHT,
    },
    tooltip: { trigger: 'item', confine: true },
    xAxis: {
      type: 'value',
      position: 'top',
      min: start,
      max: end,
      interval: ticks.interval,
      minorTick: {
        show: true,
        splitNumber: ticks.minorSplit,
        lineStyle: { color: '#9e9e9e' },
      },
      axisLine: { show: true, lineStyle: { color: '#757575' } },
      axisTick: { length: 6, lineStyle: { color: '#757575' } },
      axisLabel: {
        hideOverlap: true,
        fontSize: 11,
        color: '#424242',
        formatter: (value: number) => formatClockSeconds(value),
      },
      splitLine: { show: false },
      axisPointer: {
        show: true,
        snap: false,
        triggerTooltip: false,
        lineStyle: { color: '#555', type: 'dashed' },
        label: {
          show: true,
          formatter: (params: { value: unknown }) =>
            formatClock(Number(params.value)),
        },
      },
    },
    yAxis: {
      type: 'category',
      inverse: true,
      data: bands.map((band) => band.key),
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: {
        width: GRID_LEFT - 16,
        overflow: 'truncate',
        fontSize: 13,
        color: TEXT_COLOR,
        formatter: (key: string) => {
          const band = bands[rowIndex.get(key) ?? -1]
          return band ? displayName(band, names) : key
        },
      },
    },
    dataZoom: createDataZoom([
      {
        type: 'slider',
        start: zoom.from,
        end: zoom.to,
        left: GRID_LEFT,
        right: GRID_RIGHT,
        bottom: ZOOM_SLIDER_BOTTOM,
        height: ZOOM_SLIDER_HEIGHT,
        showDetail: false,
        showDataShadow: false,
        moveHandleSize: 0,
        brushSelect: false,
        backgroundColor: 'rgba(0, 0, 0, 0)',
        borderColor: '#c8ccd2',
        fillerColor: 'rgba(25, 118, 210, 0.12)',
        handleStyle: { color: '#fff', borderColor: '#1976d2' },
        dataBackground: {
          lineStyle: { opacity: 0 },
          areaStyle: { opacity: 0 },
        },
        selectedDataBackground: {
          lineStyle: { opacity: 0 },
          areaStyle: { opacity: 0 },
        },
      },
      { type: 'inside', start: zoom.from, end: zoom.to },
    ]),
    series: [
      ...backgroundSeries,
      ...signalSeries,
      ...(input.candidates.length
        ? [candidateSeries(eventData(input.candidates), input.candidates)]
        : []),
      ...(input.labeled.length
        ? [labeledSeries(eventData(input.labeled), input.labeled)]
        : []),
    ],
    graphic: [
      ...adjustmentGraphics(input),
      ...calloutGraphics(input, rowIndex),
      ...zoomPreviewGraphics(input, visible),
    ],
  }
}

function segmentSeries(
  indication: SignalIndication | null,
  data: SegmentDatum[],
  bands: TimelineBand[],
  names: SignalNames
): CustomSeriesOption {
  const label = indication ? INDICATION_LABELS[indication] : UNKNOWN_LABEL
  const short = indication ? SHORT_LABELS[indication] : '?'
  const textColor =
    indication && !DARK_TEXT.has(indication) ? '#fff' : TEXT_COLOR
  const fill = indicationFill(indication)

  const renderItem: CustomSeriesRenderItem = (params, api) => {
    const row = api.value(2) as number
    const from = api.coord([api.value(0), row])
    const to = api.coord([api.value(1), row])
    const coordSys = params.coordSys as unknown as {
      x: number
      y: number
      width: number
      height: number
    }
    const shape = graphic.clipRectByRect(
      {
        x: from[0],
        y: from[1] - BAND_HEIGHT / 2,
        width: to[0] - from[0],
        height: BAND_HEIGHT,
      },
      coordSys
    )
    if (!shape) return null

    const text =
      shape.width > label.length * 6.5 + 10
        ? label
        : shape.width > short.length * 7 + 6
          ? short
          : ''

    return {
      type: 'rect',
      shape,
      style: { fill },
      textContent: text
        ? {
            type: 'text',
            style: { text, fill: textColor, fontSize: 11 },
          }
        : undefined,
      textConfig: { position: 'inside' },
    }
  }

  return {
    type: 'custom',
    renderItem,
    encode: { x: [0, 1], y: 2 },
    data,
    z: 1,
    tooltip: {
      formatter: (params) => {
        const datum = (params as unknown as { data: SegmentDatum }).data
        const band = bands[datum[2]]
        return `${escapeHtml(
          band ? displayName(band, names) : ''
        )}<br/><b>${label}</b> ${formatClock(datum[0])} – ${formatClock(
          datum[1]
        )} (${formatDuration(datum[1] - datum[0])} in the window)`
      },
    },
  }
}

function backgroundBandSeries(data: SegmentDatum[]): CustomSeriesOption {
  const renderItem: CustomSeriesRenderItem = (params, api) => {
    const row = api.value(2) as number
    const from = api.coord([api.value(0), row])
    const to = api.coord([api.value(1), row])
    const coordSys = params.coordSys as unknown as {
      x: number
      y: number
      width: number
      height: number
    }
    const shape = graphic.clipRectByRect(
      {
        x: from[0],
        y: from[1] - BAND_HEIGHT / 2,
        width: to[0] - from[0],
        height: BAND_HEIGHT,
      },
      coordSys
    )
    return shape
      ? { type: 'rect', shape, style: { fill: LOCATION_BACKGROUND } }
      : null
  }

  return {
    type: 'custom',
    silent: true,
    renderItem,
    encode: { x: [0, 1], y: 2 },
    data,
    z: 1,
  }
}

function eventTooltip(rows: EventRow[]) {
  return (params: unknown) => {
    const row = rows[(params as { data: EventDatum }).data[2]]
    if (!row) return ''
    const heading = row.number
      ? `${row.number}. ${formatClock(row.time)}`
      : formatClock(row.time)
    const lines = [
      recordedEvent(row),
      row.signal !== '—' ? `Signal: ${row.signal}` : '',
      row.label ? `Label: ${row.label}` : '',
    ]
    return [
      `<b>${escapeHtml(heading)}</b>`,
      ...lines.filter(Boolean).map(escapeHtml),
    ].join('<br/>')
  }
}

function candidateSeries(
  data: EventDatum[],
  rows: EventRow[]
): CustomSeriesOption {
  const renderItem: CustomSeriesRenderItem = (_params, api) => {
    const point = api.coord([api.value(0), api.value(1)])
    const height = BAND_HEIGHT + 6
    return {
      type: 'rect',
      shape: { x: point[0] - 1.5, y: point[1] - height / 2, width: 3, height },
      style: { fill: CANDIDATE_COLOR },
      emphasis: { style: { fill: BADGE_COLOR } },
    }
  }

  return {
    type: 'custom',
    id: CANDIDATE_SERIES_ID,
    cursor: 'pointer',
    renderItem,
    encode: { x: 0, y: 1 },
    data,
    z: 4,
    clip: true,
    tooltip: { formatter: eventTooltip(rows) },
  }
}

function labeledSeries(
  data: EventDatum[],
  rows: EventRow[]
): CustomSeriesOption {
  const renderItem: CustomSeriesRenderItem = (_params, api) => {
    const point = api.coord([api.value(0), api.value(1)])
    return {
      type: 'circle',
      shape: { cx: point[0], cy: point[1], r: MARKER_RADIUS },
      style: { fill: BADGE_COLOR, stroke: '#fff', lineWidth: 1 },
    }
  }

  return {
    type: 'custom',
    id: LABELED_SERIES_ID,
    renderItem,
    encode: { x: 0, y: 1 },
    data,
    z: 5,
    clip: true,
    tooltip: { formatter: eventTooltip(rows) },
  }
}

// Tooltips are HTML, and signal names, event names and labels are all text
// from people, so every line is escaped.
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function badge(
  x: number,
  y: number,
  number: number | null,
  z: number
): GraphicComponentOption[] {
  return [
    {
      type: 'rect',
      silent: true,
      z,
      shape: { x, y, width: BADGE_SIZE, height: BADGE_SIZE, r: 2 },
      style: { fill: BADGE_COLOR },
    },
    {
      type: 'text',
      silent: true,
      z,
      x: x + BADGE_SIZE / 2,
      y: y + BADGE_SIZE / 2,
      style: {
        text: String(number ?? ''),
        font: CHART_FONTS.badge,
        fill: '#fff',
        align: 'center',
        verticalAlign: 'middle',
      },
    },
  ]
}

const LEADER_NAME = 'leader'
/** The time and the text beside a callout's number. */
const CALLOUT_TEXT_NAMES = ['time', 'text']

/** Badge and text parts take the pointer, so the callout can be dragged by either. */
const movable = (element: GraphicComponentOption) =>
  ({ ...element, silent: false, cursor: 'move' }) as GraphicComponentOption

function calloutGraphics(
  input: ChartInput,
  rowIndex: Map<string, number>
): GraphicComponentOption[] {
  const { layout, geometry, chartWidth, calloutPositions, onCalloutMove } =
    input
  const half = BADGE_SIZE / 2
  return layout.boxes.flatMap((box) => {
    if (!rowIndex.has(box.row.event.bandKey)) return []
    const key = box.row.event.key
    const place = placeCallout(box, calloutPositions[key], chartWidth, geometry)
    let dragged = false

    // While dragging, the leader and the side the text sits on follow the
    // pointer without rebuilding the chart.
    const follow = (callout: unknown) => {
      if (!(callout instanceof graphic.Group)) return null
      const next = clampCallout(
        { x: callout.x + half, top: callout.y },
        chartWidth,
        geometry
      )
      callout.x = next.x - half
      callout.y = next.top
      callout.updateTransform()
      callout.markRedraw()
      const leader = callout.parent?.childOfName(LEADER_NAME)
      if (leader instanceof graphic.Polyline) {
        leader.setShape({ points: leaderPoints(next, box.eventX, geometry) })
      }
      const left = textOnLeft(box, next.x, chartWidth)
      for (const name of CALLOUT_TEXT_NAMES) {
        const text = callout.childOfName(name)
        if (text instanceof graphic.Text) {
          text.x = calloutTextX(left)
          text.setStyle({ align: left ? 'right' : 'left' })
        }
      }
      return next
    }

    return [
      {
        type: 'group',
        children: [
          {
            type: 'polyline',
            name: LEADER_NAME,
            silent: true,
            z: 3,
            shape: { points: leaderPoints(place, box.eventX, geometry) },
            style: { stroke: TEXT_COLOR, lineWidth: 1, fill: 'none' },
          },
          {
            type: 'group',
            x: place.x - half,
            y: place.top,
            draggable: true,
            children: [
              ...badge(0, 0, box.row.number, 6),
              ...calloutText(box, textOnLeft(box, place.x, chartWidth)),
            ].map(movable),
            ondragstart: () => {
              dragged = false
            },
            ondrag: (event) => {
              dragged = true
              follow(event.target)
            },
            ondragend: (event) => {
              const next = dragged ? follow(event.target) : null
              if (next) {
                onCalloutMove(key, {
                  dx: next.x - box.eventX,
                  rise: geometry.gridTop - next.top,
                })
              }
            },
            // Double-click puts a dragged callout back over its event.
            ondblclick: () => {
              if (calloutPositions[key]) onCalloutMove(key, null)
            },
          },
        ],
      },
    ] as GraphicComponentOption[]
  })
}

/** The text's x from the number's left edge. */
function calloutTextX(left: boolean): number {
  return left ? -CALLOUT_TEXT_GAP : BADGE_SIZE + CALLOUT_TEXT_GAP
}

/** The callout's time beside the number and its text under the time, placed from the number's top left. */
function calloutText(box: CalloutBox, left: boolean): GraphicComponentOption[] {
  const line = (
    name: string,
    text: string,
    font: string,
    fill: string,
    row: number,
    lines: number
  ): GraphicComponentOption => ({
    type: 'text',
    name,
    silent: true,
    z: 6,
    x: calloutTextX(left),
    y: (BADGE_SIZE - CALLOUT_LINE_HEIGHT) / 2 + row * CALLOUT_LINE_HEIGHT,
    style: {
      text,
      font,
      fill,
      align: left ? 'right' : 'left',
      width: box.textWidth + 1,
      height: CALLOUT_LINE_HEIGHT * lines,
      lineHeight: CALLOUT_LINE_HEIGHT,
      backgroundColor: 'rgba(255, 255, 255, 0.85)',
    },
  })
  const [timeName, textName] = CALLOUT_TEXT_NAMES
  return [
    line(timeName, box.time, CHART_FONTS.time, MUTED_COLOR, 0, 1),
    ...(box.textLines.length
      ? [
          line(
            textName,
            box.textLines.join('\n'),
            CHART_FONTS.label,
            TEXT_COLOR,
            1,
            box.textLines.length
          ),
        ]
      : []),
  ]
}

/** A tinted line under the subtitle, so a shifted chart says so. */
function adjustmentGraphics(input: ChartInput): GraphicComponentOption[] {
  const note = adjustmentNote(input.adjustmentSeconds)
  if (!note) return []
  return [
    {
      type: 'text',
      silent: true,
      x: 0,
      y: ADJUSTMENT_NOTE_TOP,
      style: {
        text: note,
        font: CHART_FONTS.note,
        fill: TEXT_COLOR,
        verticalAlign: 'top',
        backgroundColor: NOTE_BACKGROUND,
        padding: [2, 6],
        borderRadius: 3,
      },
    },
  ]
}

/** The bands in miniature under the zoom slider, faded outside the part in view. */
function zoomPreviewGraphics(
  input: ChartInput,
  visible: { start: number; end: number }
): GraphicComponentOption[] {
  const { bands, start, end, adjustmentSeconds, geometry, chartWidth } = input
  const left = GRID_LEFT
  const right = chartWidth - GRID_RIGHT
  const width = Math.max(1, right - left)
  const top = geometry.sliderTop
  const toX = (time: number) => left + ((time - start) / (end - start)) * width
  const signals = bands.filter((band) => band.key !== LOCATION_BAND_KEY)
  const gap = 1
  const stripHeight = Math.max(
    1,
    Math.min(6, (ZOOM_SLIDER_HEIGHT - 8) / Math.max(1, signals.length) - gap)
  )
  const stack = signals.length * (stripHeight + gap) - gap
  const firstTop = top + (ZOOM_SLIDER_HEIGHT - stack) / 2

  const elements: GraphicComponentOption[] = []
  signals.forEach((band, index) => {
    const y = firstTop + index * (stripHeight + gap)
    for (const segment of bandSegments(band, start, end, adjustmentSeconds)) {
      elements.push({
        type: 'rect',
        silent: true,
        z: 1,
        shape: {
          x: toX(segment.start),
          y,
          width: Math.max(0.5, toX(segment.end) - toX(segment.start)),
          height: stripHeight,
        },
        style: {
          fill: segment.indication
            ? INDICATION_COLORS[segment.indication]
            : UNKNOWN_COLOR,
        },
      })
    }
  })

  const fromX = toX(visible.start)
  const toXEnd = toX(visible.end)
  const fade = 'rgba(255, 255, 255, 0.6)'
  elements.push(
    {
      type: 'rect',
      silent: true,
      z: 2,
      shape: {
        x: left,
        y: top,
        width: fromX - left,
        height: ZOOM_SLIDER_HEIGHT,
      },
      style: { fill: fade },
    },
    {
      type: 'rect',
      silent: true,
      z: 2,
      shape: {
        x: toXEnd,
        y: top,
        width: right - toXEnd,
        height: ZOOM_SLIDER_HEIGHT,
      },
      style: { fill: fade },
    }
  )

  const labelY = top + ZOOM_SLIDER_HEIGHT + 4
  for (const [x, time] of [
    [fromX, visible.start],
    [toXEnd, visible.end],
  ]) {
    const text = formatClock(time)
    // Kept inside the chart when a handle sits at the right edge.
    const half = input.measure(text, CHART_FONTS.small) / 2
    elements.push({
      type: 'text',
      silent: true,
      z: 2,
      x: Math.min(x, chartWidth - 2 - half),
      y: labelY,
      style: {
        text,
        font: CHART_FONTS.small,
        fill: MUTED_COLOR,
        align: 'center',
      },
    })
  }
  return elements
}
