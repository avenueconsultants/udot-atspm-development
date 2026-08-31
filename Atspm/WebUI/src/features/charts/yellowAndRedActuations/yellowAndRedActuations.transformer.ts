// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - yellowAndRedActuations.transformer.ts
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
  createPlans,
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
import { ChartType, PlanOptions } from '@/features/charts/common/types'
import { TransformedChartResponse } from '@/features/charts/types'
import {
  Color,
  SolidLineSeriesSymbol,
  formatChartDateTimeRange,
} from '@/features/charts/utils'
import { EChartsOption } from 'echarts'
import {
  RawYellowAndRedActuationsData,
  RawYellowAndRedActuationsResponse,
  YellowAndRedActuationsPlan,
} from './types'

export default function transformYellowAndRedActuationsData(
  response: RawYellowAndRedActuationsResponse
): TransformedChartResponse {
  const charts = response.data.map((data) => {
    const chartOptions = transformData(data)
    return {
      chart: chartOptions,
    }
  })

  return {
    type: ChartType.YellowAndRedActuations,
    data: {
      charts,
    },
  }
}

function transformData(data: RawYellowAndRedActuationsData) {
  const plans = data.plans ?? []
  const yellowEvents = toDataPoints(data.yellowEvents)
  const redClearanceEvents = toDataPoints(data.redClearanceEvents)
  const detectorEvents = toDataPoints(data.detectorEvents)
  const start = data.start ?? ''
  const end = data.end ?? ''
  const locationDescription = data.locationDescription ?? ''
  const approachDescription = data.approachDescription ?? ''

  const info = createInfoString(
    ['Total Violations: ', (data.totalViolations ?? 0).toLocaleString()],
    ['Severe Violations (SV): ', (data.severeViolations ?? 0).toLocaleString()],
    [
      'Yellow Light Occurrences (YLO): ',
      (data.yellowLightOccurences ?? 0).toLocaleString(),
    ]
  )

  const titleHeader = `Yellow And Red Actuations \n${locationDescription} - ${approachDescription}`
  const dateRange = formatChartDateTimeRange(start, end)

  const title = createTitle({
    title: ['Yellow And Red Actuations', approachDescription],
    location: locationDescription,
    dateRange,
    info,
    invertColors: data.isPermissivePhase,
  })

  const yAxis = createYAxis(true, {
    name: 'Yellow/Red Time (Seconds)',
    min: 0,
    axisLabel: {
      formatter(value: string) {
        return Math.round(parseInt(value)).toFixed(0)
      },
    },
  })

  const xAxis = createXAxis(start, end)

  const grid = createGrid({
    top: 200,
    left: 60,
    right: 220,
    backgroundColor: '#FF000050',
  })

  const detectorEventsText = 'Detector Events'
  const yellowChangeText = 'Yellow Change'
  const redClearanceText = 'Red Clearance'

  const legend = createLegend({
    top: grid.top,
    data: [
      { name: detectorEventsText },
      { name: yellowChangeText, icon: SolidLineSeriesSymbol },
      { name: redClearanceText, icon: SolidLineSeriesSymbol },
    ],
  })

  if (data.isPermissivePhase) {
    legend.backgroundColor = Color.White
  }

  const dataZoom = createDataZoom([
    {
      type: 'slider',
      orient: 'vertical',
      filterMode: 'none',
      right: grid.right - 40,
      yAxisIndex: 0,
    },
  ])

  const toolbox = createToolbox(
    {
      title: formatExportFileName(titleHeader, start, end),
      dateRange,
    },
    data.locationIdentifier ?? '',
    ChartType.YellowAndRedActuations
  )

  const tooltip = createTooltip()

  const series = createSeries(
    {
      name: detectorEventsText,
      data: transformSeriesData(detectorEvents),
      type: 'scatter',
      symbolSize: 5,
      color: Color.Black,
      zlevel: 1,
      tooltip: {
        valueFormatter: (value) =>
          `${Math.round(value as number).toLocaleString()}s`,
      },
    },
    {
      name: yellowChangeText,
      data: transformSeriesData(yellowEvents),
      type: 'line',
      color: Color.Yellow,
      stack: 'locationCycle',
      tooltip: {
        show: false,
      },
      areaStyle: {},
    },
    {
      name: redClearanceText,
      data: transformSeriesData(redClearanceEvents),
      type: 'line',
      color: '#FF0000',
      stack: 'locationCycle',
      tooltip: {
        show: false,
      },
      areaStyle: {},
    }
    // {
    //   name: 'Red',
    //   data: transformSeriesData(redEvents),
    //   type: 'line',
    //   color: '#FF000050',
    //   stack: 'locationCycle',
    //   areaStyle: {},
    // },
  )

  const planOptions: PlanOptions<YellowAndRedActuationsPlan> = {
    totalViolations: (value: number | undefined) => `TV: ${value ?? 0}`,
    severeViolations: (value: number | undefined) => `SV: ${value ?? 0}`,
    percentSevereViolations: (value: number | undefined) =>
      `% SV: ${Math.round(value ?? 0)}%`,
    percentViolations: (value: number | undefined) =>
      `% V: ${Math.round(value ?? 0)}%`,
    averageTimeViolations: (value: number | undefined) =>
      `Avg V: ${Math.round(value ?? 0)}s`,
  }

  const planSeries = createPlans(
    plans,
    yAxis.length,
    planOptions,
    grid.top - 80,
    undefined,
    data.isPermissivePhase ? Color.White : undefined
  )

  const displayProps = createDisplayProps({
    description: approachDescription,
    isPermissivePhase: data.isPermissivePhase,
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
    series: [...series, planSeries],
    displayProps,
  }

  return chartOptions
}
