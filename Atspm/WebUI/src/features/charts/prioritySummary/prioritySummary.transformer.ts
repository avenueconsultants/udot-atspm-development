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

import { PrioritySummaryResult } from '@/api/reports'
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
  RawPrioritySummaryResponse,
  TransformedPrioritySummaryResponse,
  toIconPoints,
} from '@/features/charts/prioritySummary/types'
import {
  Color,
  formatChartDateTimeRange,
  triangleSvgSymbol,
  xSvgSymbol,
} from '@/features/charts/utils'
import { EChartsOption } from 'echarts'

export default function transformPrioritySummaryData(
  response: RawPrioritySummaryResponse | PrioritySummaryResult
): TransformedPrioritySummaryResponse {
  const data =
    (response as RawPrioritySummaryResponse)?.data ?? (response as any)

  const chart = transformLocation(data)

  return {
    type: ChartType.PrioritySummary,
    data: { charts: [{ chart }] },
  }
}

function transformLocation(data: PrioritySummaryResult) {
  const dateRange = formatChartDateTimeRange(data.start, data.end)

  const title = createTitle({
    title: 'Priority Summary',
    location: data.locationDescription,
    dateRange,
  })

  const xAxis = createXAxis(data.start, data.end)
  const yAxis = createYAxis(true, { name: 'Seconds Since 112 (Check In)' })

  const grid = createGrid({ top: 100, left: 70, right: 210 })

  const legend = createLegend({
    top: grid.top,
    data: [
      { name: 'TSP Request (112→115)' },
      { name: 'TSP Service (118→119)' },
      { name: 'Early Green (113)', icon: 'circle' },
      { name: 'Extend Green (114)', icon: 'circle' },
      { name: 'Preempt Force Off (116)', icon: 'circle' },
      { name: 'TSP Early Force Off (117)', icon: 'circle' },
    ],
  })

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

  const cycles = data.cycles || []

  const series = createSeries()

  const barWidthRequest = 5
  const barWidthService = 2

  const requestBar = cycles
    .filter((c) => c.requestEndOffsetSec != null && c.requestEndOffsetSec >= 0)
    .map((c) => {
      const inMs = Date.parse(c.checkIn)
      const outMs = Number.isFinite(Date.parse(c.checkOut))
        ? Date.parse(c.checkOut)
        : inMs + 30_000

      const windowStart = new Date(inMs - 120_000).toISOString()
      const windowEnd = new Date(outMs + 120_000).toISOString()

      return [
        c.checkIn,
        c.requestEndOffsetSec as number,
        c.tspNumber,
        c.checkOut,
        data.locationIdentifier,
        windowStart,
        windowEnd,
      ]
    })

  if (requestBar.length > 0) {
    series.push({
      name: 'TSP Request (112→115)',
      type: 'bar',
      data: requestBar,
      color: Color.Red,
      barWidth: barWidthRequest,
      barGap: '30%',
      encode: { x: 0, y: 1 },
      z: 2,
    })
  }

  const serviceCycles = cycles.filter(
    (c) =>
      c.serviceStartOffsetSec != null &&
      c.serviceEndOffsetSec != null &&
      c.serviceEndOffsetSec > c.serviceStartOffsetSec
  )

  const serviceOffsetData = serviceCycles.map((c) => [
    c.checkIn,
    c.serviceStartOffsetSec,
  ])

  const serviceDurationData = serviceCycles.map((c) => {
    const inMs = Date.parse(c.checkIn)
    const outMs = Number.isFinite(Date.parse(c.checkOut))
      ? Date.parse(c.checkOut)
      : inMs + 30_000

    const windowStart = new Date(inMs - 120_000).toISOString()
    const windowEnd = new Date(outMs + 120_000).toISOString()

    return [
      c.checkIn,
      c.serviceEndOffsetSec - c.serviceStartOffsetSec,
      c.tspNumber,
      c.serviceStart,
      c.serviceEnd,
      c.serviceStartOffsetSec,
      c.checkOut,
      data.locationIdentifier,
      windowStart,
      windowEnd,
    ]
  })

  if (serviceOffsetData.length > 0) {
    series.push({
      name: '__Service Offset (hidden)',
      type: 'bar',
      data: serviceOffsetData,
      stack: 'service',
      barWidth: barWidthService,
      barGap: '30%',
      itemStyle: { color: 'transparent' },
      emphasis: { itemStyle: { color: 'transparent' } },
      tooltip: { show: false },
      encode: { x: 0, y: 1 },
      z: 2,
    })
  }

  if (serviceDurationData.length > 0) {
    series.push({
      name: 'TSP Service (118→119)',
      type: 'bar',
      data: serviceDurationData,
      stack: 'service',
      color: Color.LightBlue,
      barWidth: barWidthService,
      barGap: '30%',
      encode: { x: 0, y: 1 },
      z: 3,
    })
  }

  const earlyGreenPts = toIconPoints(cycles, 113)
  const extendGreenPts = toIconPoints(cycles, 114)
  const preemptForceOffPts = toIconPoints(cycles, 116)
  const tspEarlyForceOffPts = toIconPoints(cycles, 117)

  if (earlyGreenPts.length > 0) {
    series.push({
      name: 'Early Green (113)',
      type: 'scatter',
      data: earlyGreenPts,
      color: Color.Black,
      symbolSize: 7,
      symbol: 'diamond',
      z: 4,
    })
  }

  if (extendGreenPts.length > 0) {
    series.push({
      name: 'Extend Green (114)',
      type: 'scatter',
      data: extendGreenPts,
      color: Color.Black,
      symbolSize: 7,
      symbol: 'triangle',
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
