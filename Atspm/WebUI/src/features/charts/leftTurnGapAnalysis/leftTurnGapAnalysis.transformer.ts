// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - leftTurnGapAnalysis.transformer.ts
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
  createDataZoom,
  createDisplayProps,
  createGrid,
  createInfoString,
  createLegend,
  createSeries,
  createTitle,
  createToolbox,
  createTooltip,
  createXAxis,
  createYAxis,
  formatExportFileName,
  toDataPoints,
  transformSeriesData,
} from '@/features/charts/common/transformers'
import { ChartType } from '@/features/charts/common/types'
import { TransformedChartResponse } from '@/features/charts/types'
import {
  Color,
  DashedLineSeriesSymbol,
  formatChartDateTimeRange,
} from '@/features/charts/utils'
import { EChartsOption, TooltipComponentOption } from 'echarts'
import { RawLeftTurnGapAnalysisResponse, RawLeftTurnGapData } from './types'

export default function transformLeftTurnGapAnalysisData(
  response: RawLeftTurnGapAnalysisResponse
): TransformedChartResponse {
  const charts = response.data.map((data) => {
    const chartOptions = transformData(data)
    return {
      chart: chartOptions,
    }
  })

  return {
    type: ChartType.LeftTurnGapAnalysis,
    data: {
      charts,
    },
  }
}

function transformData(data: RawLeftTurnGapData) {
  const gap1Count = toDataPoints(data.gap1Count)
  const gap2Count = toDataPoints(data.gap2Count)
  const gap3Count = toDataPoints(data.gap3Count)
  const gap4Count = toDataPoints(data.gap4Count)
  const percentTurnableSeries = toDataPoints(data.percentTurnableSeries)
  const gap1Min = data.gap1Min ?? 0
  const gap1Max = data.gap1Max ?? 0
  const gap2Min = data.gap2Min ?? 0
  const gap2Max = data.gap2Max ?? 0
  const gap3Min = data.gap3Min ?? 0
  const gap3Max = data.gap3Max ?? 0
  const gap4Min = data.gap4Min ?? 0
  const trendLineGapThreshold = data.trendLineGapThreshold ?? 0
  const start = data.start ?? ''
  const end = data.end ?? ''
  const locationDescription = data.locationDescription ?? ''
  const phaseDescription = data.phaseDescription ?? ''

  const info = createInfoString([
    `Detector Type: `,
    data.detectionTypeDescription ?? '',
  ])

  const titleHeader = `Left Turn Gap Analysis\n${locationDescription} - ${phaseDescription}`
  const dateRange = formatChartDateTimeRange(start, end)

  const title = createTitle({
    title: ['Left Turn Gap Analysis', phaseDescription],
    location: locationDescription,
    dateRange,
    info,
  })

  const xAxis = createXAxis(start, end)

  const yAxis = createYAxis(
    false,
    { name: 'Gaps', nameGap: 40 },
    {
      name: `% of Green Time Where Gaps ≥ ${trendLineGapThreshold}s`,
      max: 100,
      nameGap: 40,
      position: 'right',
      axisLine: { show: false },
    }
  )

  const grid = createGrid({
    top: 150,
    left: 65,
    right: 250,
  })

  const gapNames = [
    `${gap1Min}-${gap1Max}s`,
    `${gap2Min}-${gap2Max}s`,
    `${gap3Min}-${gap3Max}s`,
    `${gap4Min}s+`,
  ]

  const percentofGreenText = '% of Green Time\nWhere Gaps ≥'

  const legend = createLegend({
    top: grid.top,
    data: [
      { name: gapNames[0] },
      { name: gapNames[1] },
      { name: gapNames[2] },
      { name: gapNames[3] },
      {
        name: `${percentofGreenText} ${trendLineGapThreshold}s`,
        icon: DashedLineSeriesSymbol,
      },
    ],
  })

  const dataZoom = createDataZoom()

  const toolbox = createToolbox(
    {
      title: formatExportFileName(titleHeader, start, end),
      dateRange,
    },
    data.locationIdentifier ?? '',
    ChartType.LeftTurnGapAnalysis
  )

  const tooltip = createTooltip()

  const formattedTooltip = {
    trigger: 'item',
    valueFormatter: (value: number) =>
      `${Math.round(value).toLocaleString()} gaps`,
  }

  const series = createSeries(
    {
      name: gapNames[0],
      data: transformSeriesData(gap1Count),
      type: 'bar',
      color: Color.Red,
      stack: 'gaps',
      tooltip: formattedTooltip as TooltipComponentOption,
    },
    {
      name: gapNames[1],
      data: transformSeriesData(gap2Count),
      type: 'bar',
      color: Color.Yellow,
      stack: 'gaps',
      tooltip: formattedTooltip as TooltipComponentOption,
    },
    {
      name: gapNames[2],
      data: transformSeriesData(gap3Count),
      type: 'bar',
      color: Color.Blue,
      stack: 'gaps',
      tooltip: formattedTooltip as TooltipComponentOption,
    },
    {
      name: gapNames[3],
      data: transformSeriesData(gap4Count),
      type: 'bar',
      color: Color.LightBlue,
      stack: 'gaps',
      tooltip: formattedTooltip as TooltipComponentOption,
    },
    {
      name: `${percentofGreenText} ${trendLineGapThreshold}s`,
      data: transformSeriesData(percentTurnableSeries),
      yAxisIndex: 1,
      type: 'line',
      binStepLineToggle: true,
      color: Color.Black,
      lineStyle: { type: 'dashed' },
      tooltip: {
        valueFormatter: (value) =>
          `${Math.round(value as number).toLocaleString()}%`,
      },
    }
  )

  const displayProps = createDisplayProps({
    description: data.approachDescription ?? '',
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
