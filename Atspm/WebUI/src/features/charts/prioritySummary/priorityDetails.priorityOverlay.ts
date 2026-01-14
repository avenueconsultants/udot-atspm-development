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
  return out
}

export function buildPriorityOverlay(rows: PriorityDetailsResult[]) {
  const gridTop = createGrid({
    top: 95,
    left: 65,
    right: 210,
    height: 70,
  })

  const yAxisTop = createYAxis(false, {
    type: 'category',
    name: '',
    boundaryGap: true,
    axisPointer: { show: false },
    splitLine: { show: false },
    axisTick: { show: false },
    data: [...TSP_Y_CATEGORIES],
  })

  const allEvents = flattenTspEvents(rows)

  const { requestRects, serviceRects, intersectionLines } =
    buildRectsAndLinesFromEvents(allEvents)

  const series: SeriesOption[] = []

  const REQUEST_OFFSET_PX = -3
  const SERVICE_OFFSET_PX = 3
  const SYMBOL_Y_OFFSET_PX = -6

  if (requestRects.length) {
    series.push(
      buildRectSeries(
        'TSP Request (112→115)',
        requestRects,
        5,
        0,
        0,
        Color.Red,
        REQUEST_OFFSET_PX
      )
    )
  }

  if (serviceRects.length) {
    series.push(
      buildRectSeries(
        'TSP Service (118→119)',
        serviceRects,
        3,
        0,
        0,
        Color.LightBlue,
        SERVICE_OFFSET_PX
      )
    )
  }

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
      symbolOffset: [0, SYMBOL_Y_OFFSET_PX],
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
      symbolOffset: [0, SYMBOL_Y_OFFSET_PX],
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
      symbolOffset: [0, SYMBOL_Y_OFFSET_PX],
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
      symbolOffset: [0, SYMBOL_Y_OFFSET_PX],
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
      symbolOffset: [0, SYMBOL_Y_OFFSET_PX],
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
      symbolOffset: [0, SYMBOL_Y_OFFSET_PX],
      itemStyle: { color: Color.Black },
      z: 10,
    })
  }

  if (intersectionLines.length) {
    series.push(
      buildVerticalIntersectionLinesSeries(
        intersectionLines,
        gridTop,
        SYMBOL_Y_OFFSET_PX
      )
    )
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
  const intersectionLines: string[] = []

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
        _thickness: 3,
        _tspNumber: c.tspNumber,
      })
    }

    intersectionLines.push(c.checkIn)
    if (c.serviceStart) intersectionLines.push(c.serviceStart)
    if (c.serviceEnd) intersectionLines.push(c.serviceEnd)
    intersectionLines.push(c.checkOut)
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
    if (tspRowIndex(tsp) == null) continue

    const arr = byTsp.get(tsp) ?? []
    arr.push(e)
    byTsp.set(tsp, arr)
  }

  const out: CycleWindow[] = []

  const orderAtSameTime: Record<number, number> = {
    [TSP_CODES.CheckIn]: 0,
    [TSP_CODES.EarlyGreen]: 1,
    [TSP_CODES.ExtendGreen]: 2,
    [TSP_CODES.ServiceStart]: 3,
    [TSP_CODES.ServiceEnd]: 4,
    [TSP_CODES.CheckOut]: 5,
  }

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
      .sort((a, b) => {
        const dt = a.tMs - b.tMs
        if (dt !== 0) return dt

        const oa = orderAtSameTime[a.eventCode] ?? 99
        const ob = orderAtSameTime[b.eventCode] ?? 99
        if (oa !== ob) return oa - ob

        return a.eventCode - b.eventCode
      })

    let current: CycleWindow | null = null

    for (const e of sorted) {
      if (e.eventCode === TSP_CODES.CheckIn) {
        if (
          current &&
          Number.isFinite(current.checkInMs) &&
          Number.isFinite(current.checkOutMs)
        ) {
          out.push(current)
        }
        current = {
          phaseKey: '',
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
  yAxisIndex: number,
  color: string,
  yOffsetPx = 0
): SeriesOption {
  const renderItem = (params: any, api: any) =>
    renderThinRect(params, api, thicknessPx, yOffsetPx)

  return {
    name,
    type: 'custom',
    xAxisIndex,
    yAxisIndex,
    renderItem,
    encode: { x: [1, 2], y: 0 },
    data,
    color,
    itemStyle: { opacity: 0.95 },
    z: 8,
  } as SeriesOption
}

function renderThinRect(
  params: any,
  api: any,
  thicknessPx: number,
  yOffsetPx: number
) {
  const categoryIndex = api.value(0)
  const start = api.coord([api.value(1), categoryIndex])
  const end = api.coord([api.value(2), categoryIndex])

  const band = api.size([0, 1])[1]
  const height = Math.max(1, Math.min(thicknessPx, band * 0.9))

  const rectShape = graphic.clipRectByRect(
    {
      x: start[0],
      y: start[1] - height / 2 + yOffsetPx,
      width: Math.max(0, end[0] - start[0]),
      height,
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
  timestamps: string[],
  gridTop: { top: number; height: number },
  symbolYOffsetPx: number
): SeriesOption {
  const unique = Array.from(new Set(timestamps)).filter(Boolean)

  return {
    name: 'Priority Event Intersection',
    type: 'custom',
    xAxisIndex: 1,
    yAxisIndex: 1,
    data: unique.map((t) => [t]),
    renderItem: (params: any, api: any) => {
      const t = api.value(0)
      if (!t) return null

      const x = api.coord([t, 0])[0]

      const y1 = gridTop.top + gridTop.height / 2 + symbolYOffsetPx
      const y2 = params.coordSys.y + params.coordSys.height

      return {
        type: 'line',
        shape: { x1: x, y1, x2: x, y2 },
        style: {
          stroke: Color.Black,
          lineWidth: 1,
          lineDash: [4, 4],
        },
        silent: true,
        z: 9,
      }
    },
    tooltip: { show: false },
    silent: true,
    z: 9,
  } as SeriesOption
}
