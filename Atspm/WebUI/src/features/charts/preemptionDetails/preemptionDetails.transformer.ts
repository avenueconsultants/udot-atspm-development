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
import { Color, formatChartDateTimeRange } from '@/features/charts/utils'
import { EChartsOption } from 'echarts'

/**
 * Priority Summary (Indiana Hi-Res TSP):
 * Build "cycle" bars with a common baseline at 112 (Check In).
 *
 * Each bar is plotted at x = 112 timestamp, y = seconds since 112.
 * Bars are stacked to show segment lengths:
 *  - Time To Service: 112 -> 118 (if present)
 *  - Service Duration: 118 -> 119 (or 118 -> 115 fallback)
 *  - Tail: 119 -> 115 (usually 0, but handled)
 * If no 118, we show Request Duration (No Service): 112 -> 115
 *
 * Markers:
 *  - Early Green (113): scatter at y = (113 - 112)
 *  - Extend Green (114): scatter at y = (114 - 112)
 *
 * Note: 116 is preemption-related and is ignored here.
 */
export default function transformPrioritySummaryData(
  response: RawPrioritySummaryResponse | PrioritySummaryLocationDetail
): TransformedPrioritySummaryResponse {
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

  const yAxis = createYAxis(true, { name: 'Seconds Since Request (112)' })

  const grid = createGrid({
    top: 100,
    left: 70,
    right: 170,
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

  const tooltip = createTooltip()

  const cycles = rollEventsIntoCycles(data.events, data.start, data.end)

  // bars (stacked)
  const timeToService = getDurationSeries('timeToServiceSeconds', cycles)
  const serviceDuration = getDurationSeries('serviceDurationSeconds', cycles)
  const tailDuration = getDurationSeries('tailSeconds', cycles)
  const requestNoService = getDurationSeries('requestNoServiceSeconds', cycles)

  // markers
  const earlyGreen = getMarkerSeries('earlyGreenOffsets', cycles)
  const extendGreen = getMarkerSeries('extendGreenOffsets', cycles)

  const series = createSeries()

  const barWidth = 5

  if (requestNoService.length > 0) {
    series.push({
      name: 'Request Duration (No Service)',
      type: 'bar',
      data: requestNoService,
      color: Color.Red,
      stack: 'cycle',
      barWidth,
    })
  }

  if (timeToService.length > 0) {
    series.push({
      name: 'Time To Service (112→118)',
      type: 'bar',
      data: timeToService,
      color: Color.Blue,
      stack: 'cycle',
      barWidth,
    })
  }

  if (serviceDuration.length > 0) {
    series.push({
      name: 'Service Duration (118→119)',
      type: 'bar',
      data: serviceDuration,
      color: Color.Green,
      stack: 'cycle',
      barWidth,
    })
  }

  if (tailDuration.length > 0) {
    series.push({
      name: 'Tail (119→115)',
      type: 'bar',
      data: tailDuration,
      color: Color.Orange,
      stack: 'cycle',
      barWidth,
    })
  }

  if (earlyGreen.length > 0) {
    series.push({
      name: 'Early Green (113)',
      type: 'scatter',
      data: earlyGreen,
      color: Color.Black,
      symbolSize: 8,
    })
  }

  if (extendGreen.length > 0) {
    series.push({
      name: 'Extend Green (114)',
      type: 'scatter',
      data: extendGreen,
      color: Color.Orange,
      symbolSize: 8,
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

  return chartOptions
}

/* ---------------------------------------------
 * Cycle rolling
 * --------------------------------------------- */

type EventCode = 112 | 113 | 114 | 115 | 116 | 118 | 119

interface TspCycle {
  locationIdentifier: string
  tspNumber: number
  checkIn: string // 112
  checkOut: string // 115 (or closed at reportEnd)
  serviceStart?: string // 118
  serviceEnd?: string // 119 (or fallback to 115)
  earlyGreens: string[] // 113 timestamps
  extendGreens: string[] // 114 timestamps

  // derived (seconds since 112)
  timeToServiceSeconds: number | null
  serviceDurationSeconds: number | null
  tailSeconds: number | null
  requestNoServiceSeconds: number | null
  earlyGreenOffsets: number[]
  extendGreenOffsets: number[]

  forcedClosed: boolean
  incomplete: boolean
}

function rollEventsIntoCycles(
  events: PrioritySummaryEvent[],
  reportStartIso: string,
  reportEndIso: string
): TspCycle[] {
  const sorted = [...events].sort(
    (a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp)
  )

  // key by TSP number (eventParam) per location
  const open = new Map<
    string,
    Omit<
      TspCycle,
      | 'timeToServiceSeconds'
      | 'serviceDurationSeconds'
      | 'tailSeconds'
      | 'requestNoServiceSeconds'
      | 'earlyGreenOffsets'
      | 'extendGreenOffsets'
    >
  >()
  const outRaw: Array<
    Omit<
      TspCycle,
      | 'timeToServiceSeconds'
      | 'serviceDurationSeconds'
      | 'tailSeconds'
      | 'requestNoServiceSeconds'
      | 'earlyGreenOffsets'
      | 'extendGreenOffsets'
    >
  > = []

  const keyOf = (e: PrioritySummaryEvent) =>
    `${e.locationIdentifier}:${e.eventParam}`

  for (const e of sorted) {
    // Ignore preemption (not TSP cycle chart)
    if (e.eventCode === 116) continue

    const key = keyOf(e)
    const curr = open.get(key)

    if (e.eventCode === 112) {
      // Start new request cycle
      if (curr) {
        // Overlap: force-close previous at this new 112.
        outRaw.push({
          ...curr,
          checkOut: e.timestamp,
          forcedClosed: true,
          incomplete: false,
        })
      }

      open.set(key, {
        locationIdentifier: e.locationIdentifier,
        tspNumber: e.eventParam,
        checkIn: e.timestamp,
        checkOut: e.timestamp, // placeholder
        serviceStart: undefined,
        serviceEnd: undefined,
        earlyGreens: [],
        extendGreens: [],
        forcedClosed: false,
        incomplete: false,
      })
      continue
    }

    if (!curr) continue

    if (e.eventCode === 113) {
      curr.earlyGreens.push(e.timestamp)
    } else if (e.eventCode === 114) {
      curr.extendGreens.push(e.timestamp)
    } else if (e.eventCode === 118) {
      if (!curr.serviceStart) curr.serviceStart = e.timestamp
    } else if (e.eventCode === 119) {
      if (!curr.serviceEnd) curr.serviceEnd = e.timestamp
    } else if (e.eventCode === 115) {
      outRaw.push({
        ...curr,
        checkOut: e.timestamp,
      })
      open.delete(key)
    }
  }

  // Close any remaining open cycles at report end
  for (const curr of open.values()) {
    outRaw.push({
      ...curr,
      checkOut: reportEndIso,
      incomplete: true,
    })
  }

  // Build derived durations and offsets
  const reportStartMs = Date.parse(reportStartIso)
  const reportEndMs = Date.parse(reportEndIso)

  return outRaw
    .map((c) => finalizeCycle(c))
    .filter((c) => {
      const s = Date.parse(c.checkIn)
      const e = Date.parse(c.checkOut)
      return e >= reportStartMs && s <= reportEndMs
    })
}

function finalizeCycle(
  c: Omit<
    TspCycle,
    | 'timeToServiceSeconds'
    | 'serviceDurationSeconds'
    | 'tailSeconds'
    | 'requestNoServiceSeconds'
    | 'earlyGreenOffsets'
    | 'extendGreenOffsets'
  >
): TspCycle {
  const checkInMs = Date.parse(c.checkIn)
  const checkOutMs = Date.parse(c.checkOut)

  // Service end fallback:
  // - if we have serviceStart but no serviceEnd, use checkout as the end.
  // - if we have serviceEnd but no serviceStart (weird), treat as no service.
  let serviceStartMs: number | null = c.serviceStart
    ? Date.parse(c.serviceStart)
    : null
  let serviceEndMs: number | null = c.serviceEnd
    ? Date.parse(c.serviceEnd)
    : null

  if (
    serviceStartMs != null &&
    (serviceEndMs == null || !Number.isFinite(serviceEndMs))
  ) {
    serviceEndMs = checkOutMs
  }

  const hasService =
    serviceStartMs != null &&
    serviceEndMs != null &&
    Number.isFinite(serviceStartMs) &&
    Number.isFinite(serviceEndMs) &&
    serviceEndMs >= serviceStartMs

  const requestDurationSeconds =
    Number.isFinite(checkInMs) &&
    Number.isFinite(checkOutMs) &&
    checkOutMs >= checkInMs
      ? (checkOutMs - checkInMs) / 1000
      : null

  const timeToServiceSeconds =
    hasService && serviceStartMs != null
      ? (serviceStartMs - checkInMs) / 1000
      : null

  const serviceDurationSeconds =
    hasService && serviceStartMs != null && serviceEndMs != null
      ? (serviceEndMs - serviceStartMs) / 1000
      : null

  const tailSeconds =
    hasService && serviceEndMs != null
      ? Math.max(0, (checkOutMs - serviceEndMs) / 1000)
      : null

  const requestNoServiceSeconds = !hasService ? requestDurationSeconds : null

  const earlyGreenOffsets = c.earlyGreens
    .map((ts) => (Date.parse(ts) - checkInMs) / 1000)
    .filter((v) => Number.isFinite(v) && v >= 0)

  const extendGreenOffsets = c.extendGreens
    .map((ts) => (Date.parse(ts) - checkInMs) / 1000)
    .filter((v) => Number.isFinite(v) && v >= 0)

  return {
    ...c,
    // keep original strings, but ensure serviceEnd fallback is reflected
    serviceEnd: hasService
      ? new Date(serviceEndMs as number).toISOString()
      : c.serviceEnd,
    timeToServiceSeconds,
    serviceDurationSeconds,
    tailSeconds,
    requestNoServiceSeconds,
    earlyGreenOffsets,
    extendGreenOffsets,
  }
}

/* ---------------------------------------------
 * Chart series helpers (like Preempt Details)
 * --------------------------------------------- */

interface ChartDataEntry {
  0: string // x = 112 timestamp
  1: number | null // y = seconds since 112 (or duration segment in seconds)
}

type ChartData = ChartDataEntry[]

function getDurationSeries(
  key: keyof Pick<
    TspCycle,
    | 'timeToServiceSeconds'
    | 'serviceDurationSeconds'
    | 'tailSeconds'
    | 'requestNoServiceSeconds'
  >,
  cycles: TspCycle[]
): ChartData {
  return cycles
    .map((c) => {
      const v = c[key]
      if (v == null) return
      if (!Number.isFinite(Number(v))) return
      return [c.checkIn, Number(v)]
    })
    .filter(Boolean) as ChartData
}

function getMarkerSeries(
  key: keyof Pick<TspCycle, 'earlyGreenOffsets' | 'extendGreenOffsets'>,
  cycles: TspCycle[]
): ChartData {
  const out: ChartData = []

  for (const c of cycles) {
    const offsets = c[key]
    for (const off of offsets) {
      if (!Number.isFinite(off)) continue
      out.push([c.checkIn, off])
    }
  }

  return out
}

/* ---------------------------------------------
 * Types (wire these to your generated API types)
 * --------------------------------------------- */

export interface RawPrioritySummaryResponse {
  data: PrioritySummaryLocationDetail
}

export interface TransformedPrioritySummaryResponse {
  type: ChartType
  data: {
    charts: Array<{ chart: EChartsOption }>
  }
}

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

export interface PrioritySummaryEvent {
  eventCode: EventCode
  eventParam: number
  locationIdentifier: string
  timestamp: string
}
