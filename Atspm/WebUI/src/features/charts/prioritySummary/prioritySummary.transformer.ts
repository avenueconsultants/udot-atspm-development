// #region license
// Copyright 2025 Utah Departement of Transportation
// for WebUI - prioritySummary.transformer.ts
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
// #endregion

import {
  createDataZoom,
  createDisplayProps,
  createGrid,
  createLegend,
  createSeries,
  createTitle,
  createToolbox,
  createTooltip,
  createXAxis,
  createYAxis,
  formatExportFileName,
} from '@/features/charts/common/transformers'
import { ChartType } from '@/features/charts/common/types'
import {
  Color,
  formatChartDateTimeRange,
  triangleSvgSymbol,
  xSvgSymbol,
} from '@/features/charts/utils'
import { EChartsOption, graphic } from 'echarts'

/**
 * PRIORITY SUMMARY (Indiana Hi-Res)
 *
 * Bars:
 *  - Request bar: 112 -> 115 (starts at y=0, height = (115-112) seconds)
 *  - Service bar: 118 -> 119 (starts at y=(118-112), height=(119-118) seconds)
 *    - shifted horizontally by +10px so it sits next to the request bar
 *
 * Icons (scatter):
 *  - 113 Early Green (offset y=(113-112))
 *  - 114 Extend Green (offset y=(114-112))
 *  - 116 Preempt Force Off (offset y=(116-112))   [if present in same cycle stream]
 *  - 117 TSP Early Force Off (offset y=(117-112)) [if present]
 *
 * Cycle definition: start at 112; end at 115 (per TSP number / eventParam).
 * Events are attributed to the open cycle for that TSP #.
 */
export default function transformPrioritySummaryData(
  response: RawPrioritySummaryResponse | PrioritySummaryLocationDetail
): TransformedPrioritySummaryResponse {
  // Your sample payload is already the detail shape; some APIs wrap in { data }.
  const data =
    (response as RawPrioritySummaryResponse)?.data ?? (response as any)

  const chart = transformLocation(data)

  return {
    type: ChartType.PrioritySummary,
    data: {
      charts: [{ chart }],
    },
  }
}

function transformLocation(data: PrioritySummaryLocationDetail) {
  const dateRange = formatChartDateTimeRange(data.start, data.end)

  const title = createTitle({
    title: 'Priority Summary',
    location: data.locationDescription,
    dateRange,
  })

  const xAxis = createXAxis(data.start, data.end)
  const yAxis = createYAxis(true, { name: 'Seconds Since 112 (Check In)' })
  yAxis[0].max = 100 // enough to show all event codes
  const grid = createGrid({
    top: 100,
    left: 70,
    right: 190,
  })

  const legend = createLegend({ top: grid.top })
  const dataZoom = createDataZoom()

  const toolbox = createToolbox(
    {
      title: formatExportFileName(
        `Priority Summary\n${data.locationDescription}`,
        data.start,
        data.end
      ),
      dateRange,
    },
    data.locationIdentifier,
    ChartType.PrioritySummary
  )

  const tooltip = createTooltip({ trigger: 'item' })

  const cycles = rollIntoCycles(data.events, data.end)

  const series = createSeries()

  const requestBarData = cycles
    .filter((c) => c.requestEndOffsetSec != null)
    .map((c) => ({
      // [xTime, yStart, yEnd]
      value: [c.checkIn, 0, c.requestEndOffsetSec],
      tsp: c.tspNumber,
      checkIn: c.checkIn,
      checkOut: c.checkOut,
      durationSec: c.requestEndOffsetSec,
    }))

  const serviceBarData = cycles
    .filter(
      (c) =>
        c.serviceStartOffsetSec != null &&
        c.serviceEndOffsetSec != null &&
        c.serviceEndOffsetSec > c.serviceStartOffsetSec
    )
    .map((c) => ({
      value: [c.checkIn, c.serviceStartOffsetSec, c.serviceEndOffsetSec],
      tsp: c.tspNumber,
      checkIn: c.checkIn,
      serviceStart: c.serviceStart,
      serviceEnd: c.serviceEnd,
      startOffsetSec: c.serviceStartOffsetSec,
      durationSec: c.serviceEndOffsetSec - c.serviceStartOffsetSec,
    }))

  const earlyGreenPts = toIconPoints(cycles, 113)
  const extendGreenPts = toIconPoints(cycles, 114)
  const preemptForceOffPts = toIconPoints(cycles, 116)
  const tspEarlyForceOffPts = toIconPoints(cycles, 117)

  console.log('requestBarData:', requestBarData)

  // Request bar (centered)
  series.push(
    makeFloatingBarSeries({
      name: 'TSP Request (112→115)',
      data: requestBarData,
      color: Color.Red,
      xShiftPx: 0,
      barWidthPx: 2,
      z: 2,
      tooltipLabel: (d) =>
        [
          `<b>TSP #${d.tsp}</b>`,
          `112: ${d.checkIn}`,
          `115: ${d.checkOut}`,
          `Duration: ${Number(d.durationSec).toFixed(1)} s`,
        ].join('<br/>'),
    })
  )

  // Service bar (shifted +10px, and starts at y=(118-112))
  series.push(
    makeFloatingBarSeries({
      name: 'TSP Service (118→119)',
      data: serviceBarData,
      color: Color.LightBlue,
      xShiftPx: 0,
      barWidthPx: 7,
      z: 3,
      tooltipLabel: (d) =>
        [
          `<b>TSP #${d.tsp}</b>`,
          `112: ${d.checkIn}`,
          `118: ${d.serviceStart ?? '—'}`,
          `119: ${d.serviceEnd ?? '—'}`,
          `Starts at: ${Number(d.startOffsetSec).toFixed(1)} s`,
          `Duration: ${Number(d.durationSec).toFixed(1)} s`,
        ].join('<br/>'),
    })
  )

  // Icons
  if (earlyGreenPts.length > 0) {
    series.push({
      name: 'Early Green (113)',
      type: 'scatter',
      data: earlyGreenPts,
      color: Color.Black,
      symbolSize: 9,
      // keep icons centered on the request bar
      symbolOffset: [0, 0],
      z: 4,
    })
  }

  if (extendGreenPts.length > 0) {
    series.push({
      name: 'Extend Green (114)',
      type: 'scatter',
      data: extendGreenPts,
      color: Color.Orange,
      symbolSize: 9,
      symbolOffset: [0, 0],
      z: 4,
    })
  }

  if (preemptForceOffPts.length > 0) {
    series.push({
      name: 'Preempt Force Off (116)',
      type: 'scatter',
      data: preemptForceOffPts,
      color: Color.Red,
      symbolSize: 10,
      symbol: xSvgSymbol,
      z: 4,
    })
  }

  if (tspEarlyForceOffPts.length > 0) {
    series.push({
      name: 'TSP Early Force Off (117)',
      type: 'scatter',
      data: tspEarlyForceOffPts,
      color: Color.Red,
      symbolSize: 10,
      symbol: triangleSvgSymbol,
      z: 4,
    })
  }

  const displayProps = createDisplayProps({
    description: 'Summary',
    height: '440px',
  })

  const chartOptions: EChartsOption = {
    title,
    xAxis,
    yAxis,
    grid,
    legend,
    dataZoom,
    toolbox,
    tooltip,
    series,
    displayProps,
  }

  console.log('Priority Summary chart options:', chartOptions)

  return chartOptions
}

/* ---------------------------------------------
 * ECharts: floating bar series (custom)
 * --------------------------------------------- */

function makeFloatingBarSeries(args: {
  name: string
  data: any[]
  color: string
  xShiftPx: number
  barWidthPx: number
  z: number
  tooltipLabel: (d: any) => string
}) {
  return {
    name: args.name,
    type: 'custom' as const,
    data: args.data,
    renderItem: (params: any, api: any) => {
      const xTime = api.value(0) // ISO string or ms
      const y0 = api.value(1) as number
      const y1 = api.value(2) as number

      const p0 = api.coord([xTime, y0])
      const p1 = api.coord([xTime, y1])

      const width = args.barWidthPx
      const x = p0[0] - width / 2 + args.xShiftPx
      const y = Math.min(p0[1], p1[1])
      const height = Math.abs(p1[1] - p0[1])

      const rect = {
        x,
        y,
        width,
        height: Math.max(1, height),
      }

      const clipped = graphic.clipRectByRect(rect, {
        x: params.coordSys.x,
        y: params.coordSys.y,
        width: params.coordSys.width,
        height: params.coordSys.height,
      })

      if (!clipped) return null

      return {
        type: 'rect',
        shape: clipped,
        style: api.style({
          fill: args.color,
          opacity: 0.9,
        }),
      }
    },
    tooltip: {
      formatter: (p: any) => args.tooltipLabel(p.data),
    },
    encode: {
      x: 0,
      y: [1, 2],
    },
    z: args.z,
  }
}

/* ---------------------------------------------
 * Cycle rolling
 * --------------------------------------------- */

type EventCode = 112 | 113 | 114 | 115 | 116 | 117 | 118 | 119

export interface PrioritySummaryEvent {
  eventCode: EventCode
  eventParam: number // TSP #
  locationIdentifier: string
  timestamp: string
}

interface TspCycle {
  locationIdentifier: string
  tspNumber: number

  checkIn: string // 112
  checkOut: string // 115 (or reportEnd fallback)

  serviceStart?: string // 118
  serviceEnd?: string // 119

  // raw event timestamps within the request window
  code113: string[]
  code114: string[]
  code116: string[]
  code117: string[]

  // derived offsets (seconds since 112)
  requestEndOffsetSec: number | null // (115-112)
  serviceStartOffsetSec: number | null // (118-112)
  serviceEndOffsetSec: number | null // (119-112)
}

function rollIntoCycles(events: PrioritySummaryEvent[], reportEndIso: string) {
  const sorted = [...events].sort((a, b) => {
    const ta = Date.parse(a.timestamp)
    const tb = Date.parse(b.timestamp)
    if (ta !== tb) return ta - tb

    const prio = (code: number) => {
      switch (code) {
        case 112:
          return 0
        case 113:
        case 114:
        case 116:
        case 117:
        case 118:
          return 1
        case 115:
          return 2
        case 119:
          return 3
        default:
          return 4
      }
    }
    return prio(a.eventCode) - prio(b.eventCode)
  })

  type CycleNoDerived = Omit<
    TspCycle,
    'requestEndOffsetSec' | 'serviceStartOffsetSec' | 'serviceEndOffsetSec'
  >

  const eventKey = (e: PrioritySummaryEvent) =>
    `${e.locationIdentifier}:${e.eventParam}`

  const cycleKey = (
    c: Pick<CycleNoDerived, 'locationIdentifier' | 'tspNumber' | 'checkIn'>
  ) => `${c.locationIdentifier}:${c.tspNumber}:${c.checkIn}`

  const open = new Map<string, CycleNoDerived>()
  const recentlyClosed = new Map<
    string,
    { cycle: CycleNoDerived; closedAtMs: number }
  >()
  const closed: CycleNoDerived[] = []

  const pruneRecentlyClosed = (nowMs: number) => {
    for (const [k, v] of recentlyClosed) {
      if (nowMs - v.closedAtMs > 1000) recentlyClosed.delete(k)
    }
  }

  for (const e of sorted) {
    const tMs = Date.parse(e.timestamp)
    pruneRecentlyClosed(tMs)

    const key = eventKey(e)
    const curr = open.get(key)

    if (e.eventCode === 112) {
      // Force-close only the cycle for THIS eventParam (key includes eventParam)
      if (curr) {
        closed.push({ ...curr, checkOut: e.timestamp })
        open.delete(key)
      }

      open.set(key, {
        locationIdentifier: e.locationIdentifier,
        tspNumber: e.eventParam,
        checkIn: e.timestamp,
        checkOut: e.timestamp,
        serviceStart: undefined,
        serviceEnd: undefined,
        code113: [],
        code114: [],
        code116: [],
        code117: [],
      })
      continue
    }

    // If no open cycle for THIS param, only allow trailing 119 attach for THIS param
    if (!curr) {
      if (e.eventCode === 119) {
        const recent = recentlyClosed.get(key)
        if (recent && tMs - recent.closedAtMs <= 1000) {
          if (!recent.cycle.serviceEnd) recent.cycle.serviceEnd = e.timestamp
          recentlyClosed.set(key, recent)
        }
      }
      continue
    }

    // HARD GUARD: even if someone changes keying later, don't mix params
    if (e.eventParam !== curr.tspNumber) continue

    if (e.eventCode === 113) curr.code113.push(e.timestamp)
    if (e.eventCode === 114) curr.code114.push(e.timestamp)
    if (e.eventCode === 116) curr.code116.push(e.timestamp)
    if (e.eventCode === 117) curr.code117.push(e.timestamp)

    if (e.eventCode === 118 && !curr.serviceStart)
      curr.serviceStart = e.timestamp
    if (e.eventCode === 119 && !curr.serviceEnd) curr.serviceEnd = e.timestamp

    if (e.eventCode === 115) {
      const finalized = { ...curr, checkOut: e.timestamp }
      closed.push(finalized)
      recentlyClosed.set(key, { cycle: finalized, closedAtMs: tMs })
      open.delete(key)
    }
  }

  for (const curr of open.values()) {
    closed.push({ ...curr, checkOut: reportEndIso })
  }

  // Patch any cycles that got a trailing 119 after we pushed them
  const patch = new Map<string, CycleNoDerived>()
  for (const { cycle } of recentlyClosed.values()) {
    patch.set(cycleKey(cycle), cycle)
  }

  const patchedClosed = closed.map((c) => patch.get(cycleKey(c)) ?? c)

  return patchedClosed.map(finalizeCycle)
}

function finalizeCycle(
  c: Omit<
    TspCycle,
    'requestEndOffsetSec' | 'serviceStartOffsetSec' | 'serviceEndOffsetSec'
  >
): TspCycle {
  const inMs = Date.parse(c.checkIn)
  const outMs = Date.parse(c.checkOut)

  const requestEndOffsetSec =
    Number.isFinite(inMs) && Number.isFinite(outMs) && outMs >= inMs
      ? (outMs - inMs) / 1000
      : null

  const sStartMs =
    c.serviceStart && Date.parse(c.serviceStart)
      ? Date.parse(c.serviceStart)
      : NaN
  const sEndMs =
    c.serviceEnd && Date.parse(c.serviceEnd) ? Date.parse(c.serviceEnd) : NaN

  const serviceStartOffsetSec =
    Number.isFinite(sStartMs) && sStartMs >= inMs
      ? (sStartMs - inMs) / 1000
      : null

  const serviceEndOffsetSec =
    Number.isFinite(sEndMs) && sEndMs >= inMs ? (sEndMs - inMs) / 1000 : null

  return {
    ...c,
    requestEndOffsetSec,
    serviceStartOffsetSec,
    serviceEndOffsetSec,
  }
}

/* ---------------------------------------------
 * Icons: build scatter points at y=(event-112)
 * --------------------------------------------- */

function toIconPoints(
  cycles: ReturnType<typeof rollIntoCycles>,
  code: 113 | 114 | 116 | 117
) {
  const out: Array<[string, number]> = []

  for (const c of cycles) {
    const inMs = Date.parse(c.checkIn)
    const outMs = Date.parse(c.checkOut)
    if (!Number.isFinite(inMs) || !Number.isFinite(outMs)) continue

    const timestamps =
      code === 113
        ? c.code113
        : code === 114
          ? c.code114
          : code === 116
            ? c.code116
            : c.code117

    for (const ts of timestamps) {
      const tMs = Date.parse(ts)
      if (!Number.isFinite(tMs)) continue
      // only within this request cycle window
      if (tMs < inMs || tMs > outMs) continue
      out.push([c.checkIn, (tMs - inMs) / 1000])
    }
  }

  return out
}

/* ---------------------------------------------
 * API/transform output types
 * --------------------------------------------- */

export interface PrioritySummaryLocationDetail {
  averageDuration?: string
  numberCheckins?: number
  numberCheckouts?: number
  numberEarlyGreens?: number
  numberExtendedGreens?: number
  events: PrioritySummaryEvent[]
  locationIdentifier: string
  locationDescription: string
  start: string
  end: string
}

export interface RawPrioritySummaryResponse {
  data: PrioritySummaryLocationDetail
}

export interface TransformedPrioritySummaryResponse {
  type: ChartType
  data: {
    charts: Array<{ chart: EChartsOption }>
  }
}
