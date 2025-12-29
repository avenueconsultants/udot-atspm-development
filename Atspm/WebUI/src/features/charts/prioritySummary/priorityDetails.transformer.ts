// #region license
// Copyright 2025 Utah Departement of Transportation
// for WebUI - priorityDetails.transformer.ts
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

import { PriorityDetailsResult } from '@/api/reports'
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
import { TransformedChartResponse } from '@/features/charts/types'
import { Color, formatChartDateTimeRange } from '@/features/charts/utils'
import { graphic, type EChartsOption, type SeriesOption } from 'echarts'

export interface RawPriorityDetailsResponse {
  data: PriorityDetailsResult[]
}

export default function transformPriorityDetailsData(
  response: RawPriorityDetailsResponse
): TransformedChartResponse {
  const rows = response.data ?? []

  const chart = transformCyclesOnly(rows)

  return {
    type: ChartType.PriorityDetails,
    data: {
      charts: [{ chart }],
    },
  }
}

function transformCyclesOnly(rows: PriorityDetailsResult[]): EChartsOption {
  const first = rows[0]
  const locationDescription = first?.locationDescription ?? ''
  const locationIdentifier = first?.locationIdentifier ?? ''

  const { chartStartMs, chartEndMs, chartStartIso, chartEndIso } =
    getChartRangeMs(rows)

  const dateRange = formatChartDateTimeRange(chartStartIso, chartEndIso)

  const title = createTitle({
    title: 'TSP Events with all Phase Indications',
    location: locationDescription,
    dateRange,
  })

  const xAxis = createXAxis(chartStartIso, chartEndIso)
  xAxis.min = chartStartMs
  xAxis.max = chartEndMs

  const allEvents = collectEvents(rows)
  const eventRows = buildTspEventCategories(allEvents) // e.g. ["TSP 4", "TSP 2"]
  const phaseRows = buildPhaseCategories(rows) // your existing phase labels
  const categories = [...eventRows, ...phaseRows]

  const yAxis = createYAxis(false, {
    type: 'category',
    name: 'Phase',
    boundaryGap: true,
    axisPointer: { show: true, type: 'shadow', triggerTooltip: false },
    splitLine: { show: true, lineStyle: { color: '#000000' } },
    data: categories,
  })

  const grid = createGrid({
    top: 95,
    left: 65,
    right: 140,
    bottom: 70,
  })

  const dataZoom = createDataZoom([
    {
      type: 'slider',
      height: 22,
      bottom: 20,
      filterMode: 'weakFilter',
      showDataShadow: false,
      labelFormatter: '',
    },
    { type: 'inside', filterMode: 'weakFilter' },
  ])

  const toolbox = createToolbox(
    {
      title: formatExportFileName(
        `Priority Details\n${locationDescription}`,
        chartStartIso,
        chartEndIso
      ),
      dateRange,
    },
    locationIdentifier,
    ChartType.PriorityDetails
  )

  const tooltip = createTooltip({ trigger: 'item', confine: true })

  const series = createSeries()

  series.push(buildCycleTimelineSeries(rows, categories))

  const { barSeries, markLineSeries } = buildEventBarSeries(
    allEvents,
    eventRows
  )
  if (markLineSeries) series.push(markLineSeries)
  series.push(...barSeries)

  const legend = createLegend({
    top: grid.top,
    data: [
      { name: 'Green', icon: 'roundRect' },
      { name: 'Light Green', icon: 'roundRect' },
      { name: 'Yellow', icon: 'roundRect' },
      { name: 'Red', icon: 'roundRect' },
      { name: 'Light Red', icon: 'roundRect' },
    ],
  })

  const displayProps = createDisplayProps({
    description: 'Priority Details',
    height: '460px',
  })

  return {
    title,
    xAxis,
    yAxis,
    grid,
    legend,
    dataZoom,
    toolbox,
    tooltip,
    animation: false,
    series,
    displayProps,
  }
}

function buildRowCategories(rows: PriorityDetailsResult[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()

  for (const r of rows) {
    const name = categoryOfRow(r)
    if (seen.has(name)) continue
    seen.add(name)
    out.push(name)
  }

  return out
}

function categoryOfRow(r: PriorityDetailsResult): string {
  // If you truly want *only* the phaseNumber string even for overlaps,
  // change this to: return `${r.phaseNumber}`
  return r.isPhaseOverLap ? `O${r.phaseNumber}` : `${r.phaseNumber}`
}

function getChartRangeMs(rows: PriorityDetailsResult[]) {
  if (!rows.length) {
    return {
      chartStartMs: 0,
      chartEndMs: 0,
      chartStartIso: '',
      chartEndIso: '',
    }
  }

  let min = Date.parse(rows[0].start)
  let max = Date.parse(rows[0].end)

  for (const r of rows) {
    const s = Date.parse(r.start)
    const e = Date.parse(r.end)
    if (!Number.isNaN(s) && s < min) min = s
    if (!Number.isNaN(e) && e > max) max = e
  }

  return {
    chartStartMs: min,
    chartEndMs: max,
    chartStartIso: new Date(min).toISOString(),
    chartEndIso: new Date(max).toISOString(),
  }
}

type IndicationName = 'Green' | 'Light Green' | 'Yellow' | 'Red' | 'Light Red'

function getIndicationDetails(
  value: number
): { name: IndicationName; color: string } | null {
  // Matches Timing & Actuation conventions:
  // 1/61 = green, 3/62 = light green, 8/63 = yellow, 9/64 = red, 11/65 = light red
  switch (value) {
    case 1:
    case 61:
      return { name: 'Green', color: Color.Green }
    case 3:
    case 62:
      return { name: 'Light Green', color: '#8ef08d' }
    case 8:
    case 63:
      return { name: 'Yellow', color: Color.Yellow }
    case 9:
    case 64:
      return { name: 'Red', color: '#FF0000' }
    case 11:
    case 65:
      return { name: 'Light Red', color: '#f0807f' }
    default:
      return null
  }
}

function buildCycleTimelineSeries(
  rows: PriorityDetailsResult[],
  categories: string[]
): SeriesOption {
  const indexByCategory = new Map<string, number>()
  categories.forEach((c, i) => indexByCategory.set(c, i))

  const data: Array<{
    name: string
    value: [number, number, number, number] // [rowIndex, startMs, endMs, durationMs]
    itemStyle: { color: string }
  }> = []

  for (const row of rows) {
    const yCat = categoryOfRow(row)
    const rowIndex = indexByCategory.get(yCat)
    if (rowIndex === undefined) continue

    const cycles = row.cycleEvents ?? []
    const rowEndMs = Date.parse(row.end)

    for (let i = 0; i < cycles.length; i++) {
      const curr = cycles[i]
      const next = i < cycles.length - 1 ? cycles[i + 1] : null

      const details = getIndicationDetails(curr.value)
      if (!details) continue

      const startMs = Date.parse(curr.start)
      const endMs = next ? Date.parse(next.start) : rowEndMs
      if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) continue
      if (endMs <= startMs) continue

      data.push({
        name: details.name,
        value: [rowIndex, startMs, endMs, endMs - startMs],
        itemStyle: { color: details.color },
      })
    }
  }

  return {
    name: 'Cycles',
    type: 'custom',
    renderItem: renderCycleRect,
    itemStyle: { opacity: 0.95 },
    encode: {
      x: [1, 2],
      y: 0,
    },
    tooltip: {
      formatter: (p: any) => {
        const v = p?.value as [number, number, number, number]
        if (!v) return ''
        const [, startMs, endMs, dur] = v
        const startIso = new Date(startMs).toISOString()
        const endIso = new Date(endMs).toISOString()
        return `${p.marker}${p.name}<br/>${startIso}<br/>${endIso}<br/>${dur} ms`
      },
    },
    data,
  } as SeriesOption
}

function renderCycleRect(params: any, api: any) {
  const categoryIndex = api.value(0)
  const start = api.coord([api.value(1), categoryIndex])
  const end = api.coord([api.value(2), categoryIndex])

  const height = api.size([0, 1])[1] * 0.6

  const rectShape = graphic.clipRectByRect(
    {
      x: start[0],
      y: start[1] - height / 2,
      width: end[0] - start[0],
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

function buildTspEventCategories(events: PriorityDetailsTspEvent[]): string[] {
  const params = Array.from(
    new Set(events.map((e) => e.eventParam).filter((x) => Number.isFinite(x)))
  )

  // keep stable ordering (descending like your screenshot) if you want:
  params.sort((a, b) => b - a)

  return params.map((p) => `TSP ${p}`)
}

function buildEventBarSeries(
  events: PriorityDetailsTspEvent[],
  eventRows: string[]
): {
  barSeries: SeriesOption[]
  markLineSeries: SeriesOption | null
  legendItems: Array<{ name: string }>
} {
  if (!events.length || !eventRows.length) {
    return { barSeries: [], markLineSeries: null, legendItems: [] }
  }

  // Dedup by timestamp+param+code (prevents double-stacking)
  const key = (e: PriorityDetailsTspEvent) =>
    `${e.timestamp}|${e.eventParam}|${e.eventCode}|${e.locationIdentifier}`
  const dedup = new Map<string, PriorityDetailsTspEvent>()
  for (const e of events) dedup.set(key(e), e)
  const list = Array.from(dedup.values()).sort(
    (a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp)
  )

  // dashed lines through chart at every event time
  const markLineSeries: SeriesOption = {
    name: '__Event Lines (hidden)',
    type: 'line',
    data: [],
    silent: true,
    symbol: 'none',
    lineStyle: { opacity: 0 },
    tooltip: { show: false },
    markLine: {
      symbol: 'none',
      silent: true,
      lineStyle: {
        type: 'dashed',
        width: 1,
        color: '#000000',
        opacity: 0.35,
      },
      data: list.map((e) => ({ xAxis: e.timestamp })),
    },
    z: 2,
  }

  // build small vertical "bars" on their TSP row
  // We'll use a CUSTOM series drawing a thin rectangle centered on the timestamp.
  const byParam = new Map<number, any[]>()
  for (const e of list) {
    if (!Number.isFinite(e.eventParam)) continue
    if (!byParam.has(e.eventParam)) byParam.set(e.eventParam, [])
    byParam.get(e.eventParam)!.push(e)
  }

  const barSeries: SeriesOption[] = []

  for (const [param, arr] of byParam.entries()) {
    const rowName = `TSP ${param}`
    if (!eventRows.includes(rowName)) continue

    const data = arr.map((e) => ({
      name: rowName,
      // [yCategoryName, timeMs]
      value: [rowName, Date.parse(e.timestamp), e.eventCode],
    }))

    barSeries.push({
      name: rowName,
      type: 'custom',
      silent: false,
      renderItem: renderEventTick,
      encode: { x: 1, y: 0 }, // x = timeMs, y = category name
      data,
      tooltip: {
        formatter: (p: any) => {
          const v = p?.data?.value
          if (!v) return ''
          const [row, timeMs, code] = v
          return `${row}<br/>${new Date(timeMs).toISOString()}<br/>Code ${code}`
        },
      },
      z: 5,
    } as any)
  }

  return {
    barSeries,
    markLineSeries,
    legendItems: eventRows.map((name) => ({ name })),
  }
}

function renderEventTick(params: any, api: any) {
  const yName = api.value(0) // category string like "TSP 4"
  const xVal = api.value(1) // timeMs

  const coord = api.coord([xVal, yName])

  // thickness + height within the row
  const barWidth = 3
  const rowHeight = api.size([0, 1])[1]
  const barHeight = rowHeight * 0.55

  const rectShape = graphic.clipRectByRect(
    {
      x: coord[0] - barWidth / 2,
      y: coord[1] - barHeight / 2,
      width: barWidth,
      height: barHeight,
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
      shape: rectShape,
      style: {
        fill: '#d47a1f', // orange-ish like your tiny bar
      },
    }
  )
}
