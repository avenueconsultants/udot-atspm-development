// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - purduePhaseTermination.transformer.ts
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
import type { Phase } from '@/api/reports'
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
} from '@/features/charts/common/transformers'
import { ChartType } from '@/features/charts/common/types'
import {
  RawPurduePhaseTerminationData,
  RawPurduePhaseTerminationResponse,
} from '@/features/charts/purduePhaseTermination/types'
import {
  ExtendedEChartsOption,
  TransformedChartResponse,
} from '@/features/charts/types'
import {
  Color,
  formatChartDateTimeRange,
  triangleSvgSymbol,
} from '@/features/charts/utils'
import { SeriesOption, TooltipComponentOption } from 'echarts'

export default function transformPurduePhaseTerminationData(
  response: RawPurduePhaseTerminationResponse
): TransformedChartResponse {
  const chart = transformData(response.data)

  return {
    type: ChartType.PurduePhaseTermination,
    data: {
      charts: [chart],
    },
  }
}
function transformData(data: RawPurduePhaseTerminationData) {
  const phases = data.phases ?? []
  const plans = data.plans ?? []
  const start = data.start ?? ''
  const end = data.end ?? ''
  const locationDescription = data.locationDescription ?? ''

  const info = createInfoString([
    `Currently showing Force-Offs, Max-Outs and Gap-Outs with a consecutive occurence of ${data.consecutiveCount ?? 0} or more. Pedestrian events are never filtered.`,
    '',
  ])

  const titleHeader = `Phase Termination\n${locationDescription}`
  const dateRange = formatChartDateTimeRange(start, end)

  const title = createTitle({
    title: 'Purdue Phase Termination',
    location: locationDescription,
    dateRange,
    info,
  })

  const xAxis = createXAxis(start, end)
  const yAxis = createYAxis(true, {
    name: 'Phase Number',
    type: 'category',
    boundaryGap: true,
    splitLine: { show: true },
    data: phases.map((phase) => phase.phaseNumber ?? 0),
  })

  const grid = createGrid({
    top: 160,
    left: 60,
    right: 270,
  })

  const gapOuts = 'Gap Outs'
  const forceOffs = 'Force Offs'
  const maxOuts = 'Max Outs'
  const pedWalkBeings = 'Ped Walk Begins'
  const unknownTerminations = 'Unknown Terminations'

  const legend = createLegend({
    top: grid.top,
    data: [
      { name: gapOuts },
      { name: forceOffs },
      { name: maxOuts },
      { name: pedWalkBeings, icon: triangleSvgSymbol },
      { name: unknownTerminations },
    ],
  })

  const tooltip = createTooltip()

  const dataZoom = createDataZoom([
    {
      type: 'slider',
      orient: 'vertical',
      right: grid.right - 50,
    },
  ])

  const toolbox = createToolbox(
    {
      title: formatExportFileName(titleHeader, start, end),
      dateRange,
    },
    data.locationIdentifier ?? '',
    ChartType.PurduePhaseTermination
  )

  const combinedGapOuts = combineArrays(phases, 'gapOuts')
  const combinedForceOffs = combineArrays(phases, 'forceOffs')
  const combinedMaxOuts = combineArrays(phases, 'maxOuts')
  const combinedPedWalkBegins = combineArrays(phases, 'pedWalkBegins')
  const combinedUnknownTerminations = combineArrays(
    phases,
    'unknownTerminations'
  )

  const symbolSize = 4

  const seriesTooltip = {
    trigger: 'item',
    valueFormatter: (value: string[]) =>
      new Date(value[0]).toLocaleString(undefined, { hour12: false }),
  }

  const series = createSeries(
    {
      name: gapOuts,
      data: combinedGapOuts,
      type: 'scatter',
      symbolSize,
      color: Color.Green,
      symbolOffset: [0, '-300%'],
      tooltip: seriesTooltip as TooltipComponentOption,
    },
    {
      name: forceOffs,
      data: combinedForceOffs,
      type: 'scatter',
      symbolSize,
      color: Color.Blue,
      symbolOffset: [0, '-150%'],
      tooltip: seriesTooltip as TooltipComponentOption,
    },
    {
      name: maxOuts,
      data: combinedMaxOuts,
      type: 'scatter',
      symbolSize,
      color: Color.Pink,
      tooltip: seriesTooltip as TooltipComponentOption,
    },
    {
      name: pedWalkBeings,
      data: combinedPedWalkBegins,
      type: 'scatter',
      symbolSize,
      color: Color.Red,
      symbol: triangleSvgSymbol,
      symbolOffset: [0, '150%'],
      tooltip: seriesTooltip as TooltipComponentOption,
    },
    {
      name: unknownTerminations,
      data: combinedUnknownTerminations,
      type: 'scatter',
      symbolSize,
      color: Color.Yellow,
      symbolOffset: [0, '300%'],
      tooltip: seriesTooltip as TooltipComponentOption,
    }
  )

  const planSeries: SeriesOption = {
    ...createPlans(
      plans as unknown as Parameters<typeof createPlans>[0],
      yAxis.length,
      undefined,
      125
    ),
    tooltip: { trigger: 'none' },
  }

  const displayProps = createDisplayProps({
    height: 650,
  })

  const chartOptions: ExtendedEChartsOption = {
    title,
    xAxis,
    yAxis,
    grid,
    legend,
    dataZoom,
    toolbox,
    animation: false,
    series: [...series, planSeries],
    tooltip,
    displayProps,
  }

  return { chart: chartOptions }
}

function combineArrays<T extends keyof Phase>(
  phases: Phase[],
  prop: T
): [string, number][] {
  const combinedItems: [string, number][] = []

  for (let i = phases.length - 1; i >= 0; i--) {
    const items = phases[i][prop] as string[] | null | undefined

    for (const item of items ?? []) {
      combinedItems.push([item, i])
    }
  }

  return combinedItems
}
