import { PriorityDetailsResult } from '@/api/reports'
import { createGrid, createYAxis } from '@/features/charts/common/transformers'
import { Color } from '@/features/charts/utils'
import { dateToTimestamp } from '@/utils/dateTime'
import { graphic, type SeriesOption } from 'echarts'

const TSP_CODES = {
  CheckIn: 112,
  EarlyGreen: 113,
  ExtendGreen: 114,
  CheckOut: 115,
  ServiceStart: 118,
  ServiceEnd: 119,
} as const

type PriorityEvent = {
  eventCode: number
  eventParam?: number | null
  timestamp: string
}

type CycleWindow = {
  // phaseKey no longer used for y-axis, but keeping for minimal churn
  phaseKey: string
  tspNumber: number
  checkInMs: number
  checkOutMs: number
  checkIn: string
  checkOut: string
  serviceStartMs?: number
  serviceEndMs?: number
  serviceStart?: string
  serviceEnd?: string
  earlyGreenMs?: number[]
  extendGreenMs?: number[]
}

type RectDatum = {
  name: string
  value: [number, string, string, number]
  itemStyle: { color: string }
  _thickness: number
  _tspNumber: number
}

const TSP_Y_CATEGORIES = ['1', '2', '3', '4'] as const
type TspCat = (typeof TSP_Y_CATEGORIES)[number]

function tspRowIndex(eventParam: number | null | undefined): number | null {
  if (typeof eventParam !== 'number' || !Number.isFinite(eventParam))
    return null
  const s = String(eventParam) as TspCat
  const idx = TSP_Y_CATEGORIES.indexOf(s)
  return idx >= 0 ? idx : null
}

function flattenTspEvents(rows: PriorityDetailsResult[]): PriorityEvent[] {
  const out: PriorityEvent[] = []
  for (const r of rows ?? []) {
    const tspEvents = (r.tspEvents ?? []) as PriorityEvent[]
    if (!tspEvents?.length) continue
    out.push(...tspEvents)
  }
  console.log('flattened TSP events:', out)
  return out
}

export function buildPriorityOverlay(rows: PriorityDetailsResult[]) {
  const gridTop = createGrid({
    top: 95,
    left: 65,
    right: 210,
    height: 70,
  })

  // y-axis is now TSP eventParam categories (hard-coded)
  const yAxisTop = createYAxis(false, {
    type: 'category',
    name: '',
    boundaryGap: true,
    axisPointer: { show: false },
    splitLine: { show: false },
    axisTick: { show: false },
    data: [...TSP_Y_CATEGORIES],
  })

  // Build everything from the flattened events so we don’t depend on phase rows
  const allEvents = flattenTspEvents(rows)

  const { requestRects, serviceRects, intersectionLines } =
    buildRectsAndLinesFromEvents(allEvents)

  const series: SeriesOption[] = []

  // bars (thickness must be 5 and 2)
  if (requestRects.length) {
    series.push(buildRectSeries('TSP Request (112→115)', requestRects, 5, 0, 0))
  }

  if (serviceRects.length) {
    series.push(buildRectSeries('TSP Service (118→119)', serviceRects, 2, 0, 0))
  }

  // event markers (112/113/114/115/118/119)
  const checkIns: Array<[string, number]> = []
  const earlyGreens: Array<[string, number]> = []
  const extendGreens: Array<[string, number]> = []
  const checkOuts: Array<[string, number]> = []
  const serviceStarts: Array<[string, number]> = []
  const serviceEnds: Array<[string, number]> = []

  for (const e of allEvents) {
    const rowIndex = tspRowIndex(e.eventParam)
    if (rowIndex == null) continue

    const t = dateToTimestamp(e.timestamp)
    if (!t) continue

    const pt: [string, number] = [t, rowIndex]

    switch (e.eventCode) {
      case TSP_CODES.CheckIn:
        checkIns.push(pt)
        break
      case TSP_CODES.EarlyGreen:
        earlyGreens.push(pt)
        break
      case TSP_CODES.ExtendGreen:
        extendGreens.push(pt)
        break
      case TSP_CODES.CheckOut:
        checkOuts.push(pt)
        break
      case TSP_CODES.ServiceStart:
        serviceStarts.push(pt)
        break
      case TSP_CODES.ServiceEnd:
        serviceEnds.push(pt)
        break
    }
  }

  if (checkIns.length) {
    series.push({
      name: 'Check In (112)',
      type: 'scatter',
      xAxisIndex: 0,
      yAxisIndex: 0,
      data: checkIns,
      symbol: 'circle',
      symbolSize: 9,
      itemStyle: { color: Color.Black },
      z: 10,
    })
  }

  if (earlyGreens.length) {
    series.push({
      name: 'Early Green (113)',
      type: 'scatter',
      xAxisIndex: 0,
      yAxisIndex: 0,
      data: earlyGreens,
      symbol: 'diamond',
      symbolSize: 9,
      itemStyle: { color: Color.Black },
      z: 10,
    })
  }

  if (extendGreens.length) {
    series.push({
      name: 'Extend Green (114)',
      type: 'scatter',
      xAxisIndex: 0,
      yAxisIndex: 0,
      data: extendGreens,
      symbol: 'triangle',
      symbolSize: 9,
      itemStyle: { color: Color.Black },
      z: 10,
    })
  }

  if (checkOuts.length) {
    series.push({
      name: 'Check Out (115)',
      type: 'scatter',
      xAxisIndex: 0,
      yAxisIndex: 0,
      data: checkOuts,
      symbol: 'rect',
      symbolSize: 9,
      itemStyle: { color: Color.Black },
      z: 10,
    })
  }

  if (serviceStarts.length) {
    series.push({
      name: 'Service Start (118)',
      type: 'scatter',
      xAxisIndex: 0,
      yAxisIndex: 0,
      data: serviceStarts,
      symbol: 'circle',
      symbolSize: 7,
      itemStyle: { color: Color.Black },
      z: 10,
    })
  }

  if (serviceEnds.length) {
    series.push({
      name: 'Service End (119)',
      type: 'scatter',
      xAxisIndex: 0,
      yAxisIndex: 0,
      data: serviceEnds,
      symbol: 'circle',
      symbolSize: 7,
      itemStyle: { color: Color.Black },
      z: 10,
    })
  }

  // dashed intersection lines down into the phase chart
  if (intersectionLines.length) {
    series.push(buildVerticalIntersectionLinesSeries(intersectionLines))
  }

  const legendItems = [
    { name: 'TSP Request (112→115)' },
    { name: 'TSP Service (118→119)' },
    { name: 'Check In (112)', icon: 'circle' },
    { name: 'Early Green (113)', icon: 'circle' },
    { name: 'Extend Green (114)', icon: 'circle' },
    { name: 'Check Out (115)', icon: 'circle' },
    { name: 'Service Start (118)', icon: 'circle' },
    { name: 'Service End (119)', icon: 'circle' },
  ]

  return {
    gridTop,
    yAxisTop,
    series,
    legendItems,
  }
}

function buildRectsAndLinesFromEvents(allEvents: PriorityEvent[]) {
  const requestRects: RectDatum[] = []
  const serviceRects: RectDatum[] = []
  const intersectionLines: Array<{ xAxis: string }> = []

  const cycles = buildCycleWindowsFromEvents(allEvents)

  for (const c of cycles) {
    const rowIndex = tspRowIndex(c.tspNumber)
    if (rowIndex == null) continue

    if (!Number.isFinite(c.checkInMs) || !Number.isFinite(c.checkOutMs))
      continue
    if (c.checkOutMs <= c.checkInMs) continue

    requestRects.push({
      name: 'TSP Request (112→115)',
      value: [rowIndex, c.checkIn, c.checkOut, c.checkOutMs - c.checkInMs],
      itemStyle: { color: Color.Red },
      _thickness: 5,
      _tspNumber: c.tspNumber,
    })

    if (
      c.serviceStartMs != null &&
      c.serviceEndMs != null &&
      c.serviceEndMs > c.serviceStartMs &&
      c.serviceStart != null &&
      c.serviceEnd != null
    ) {
      serviceRects.push({
        name: 'TSP Service (118→119)',
        value: [
          rowIndex,
          c.serviceStart,
          c.serviceEnd,
          c.serviceEndMs - c.serviceStartMs,
        ],
        itemStyle: { color: Color.LightBlue },
        _thickness: 2,
        _tspNumber: c.tspNumber,
      })
    }

    intersectionLines.push({ xAxis: c.checkIn })
    if (c.serviceStart) intersectionLines.push({ xAxis: c.serviceStart })
    if (c.serviceEnd) intersectionLines.push({ xAxis: c.serviceEnd })
    intersectionLines.push({ xAxis: c.checkOut })
  }

  return { requestRects, serviceRects, intersectionLines }
}

function buildCycleWindowsFromEvents(
  allEvents: PriorityEvent[]
): CycleWindow[] {
  const byTsp = new Map<number, PriorityEvent[]>()

  for (const e of allEvents) {
    const tsp = typeof e.eventParam === 'number' ? e.eventParam : NaN
    if (!Number.isFinite(tsp)) continue
    // only keep the TSPs we actually chart
    if (tspRowIndex(tsp) == null) continue

    const arr = byTsp.get(tsp) ?? []
    arr.push(e)
    byTsp.set(tsp, arr)
  }

  const out: CycleWindow[] = []

  for (const [tspNumber, events] of byTsp.entries()) {
    const sorted = [...events]
      .map((e) => ({
        eventCode: e.eventCode,
        tspNumber,
        timestamp: e.timestamp,
        tMs: Date.parse(e.timestamp),
        t: dateToTimestamp(e.timestamp),
      }))
      .filter((e) => Number.isFinite(e.tMs))
      .sort((a, b) => a.tMs - b.tMs)

    let current: CycleWindow | null = null

    for (const e of sorted) {
      if (e.eventCode === TSP_CODES.CheckIn) {
        if (current && current.checkInMs && current.checkOutMs)
          out.push(current)
        current = {
          phaseKey: '', // unused now
          tspNumber,
          checkInMs: e.tMs,
          checkOutMs: NaN,
          checkIn: e.t,
          checkOut: '',
          earlyGreenMs: [],
          extendGreenMs: [],
        }
        continue
      }

      if (!current) continue

      if (e.eventCode === TSP_CODES.EarlyGreen) {
        current.earlyGreenMs?.push(e.tMs)
        continue
      }

      if (e.eventCode === TSP_CODES.ExtendGreen) {
        current.extendGreenMs?.push(e.tMs)
        continue
      }

      if (e.eventCode === TSP_CODES.ServiceStart) {
        current.serviceStartMs = e.tMs
        current.serviceStart = e.t
        continue
      }

      if (e.eventCode === TSP_CODES.ServiceEnd) {
        current.serviceEndMs = e.tMs
        current.serviceEnd = e.t
        continue
      }

      if (e.eventCode === TSP_CODES.CheckOut) {
        current.checkOutMs = e.tMs
        current.checkOut = e.t
        out.push(current)
        current = null
        continue
      }
    }
  }

  return out
}

function buildRectSeries(
  name: string,
  data: RectDatum[],
  thicknessPx: number,
  xAxisIndex: number,
  yAxisIndex: number
): SeriesOption {
  const renderItem = (params: any, api: any) =>
    renderThinRect(params, api, thicknessPx)

  return {
    name,
    type: 'custom',
    xAxisIndex,
    yAxisIndex,
    renderItem,
    encode: { x: [1, 2], y: 0 },
    data,
    itemStyle: { opacity: 0.95 },
    z: 8,
  } as SeriesOption
}

function renderThinRect(params: any, api: any, thicknessPx: number) {
  const categoryIndex = api.value(0)
  const start = api.coord([api.value(1), categoryIndex])
  const end = api.coord([api.value(2), categoryIndex])

  const band = api.size([0, 1])[1]
  const height = Math.max(1, Math.min(thicknessPx, band * 0.9))

  const rectShape = graphic.clipRectByRect(
    {
      x: start[0],
      y: start[1] - height / 2,
      width: Math.max(0, end[0] - start[0]),
      height,
      r: 1,
    },
    {
      x: params.coordSys.x,
      y: params.coordSys.y,
      width: params.coordSys.width,
      height: params.coordSys.height,
    }
  )

  return (
    rectShape && {
      type: 'rect',
      transition: ['shape'],
      shape: rectShape,
      style: api.style(),
    }
  )
}

function buildVerticalIntersectionLinesSeries(
  lines: Array<{ xAxis: string }>
): SeriesOption {
  return {
    name: 'Priority Event Intersection',
    type: 'scatter',
    xAxisIndex: 1,
    yAxisIndex: 1,
    data: [],
    symbolSize: 1,
    itemStyle: { opacity: 0 },
    markLine: {
      symbol: ['none', 'none'],
      silent: true,
      lineStyle: {
        type: 'dashed',
        width: 1,
        color: Color.Black,
      },
      data: lines,
    },
    silent: true,
    z: 9,
  } as SeriesOption
}
