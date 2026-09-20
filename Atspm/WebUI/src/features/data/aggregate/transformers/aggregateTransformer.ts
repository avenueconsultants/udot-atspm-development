// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - aggregateTransformer.ts
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
import { AggregationDataPoint, AggregationResult } from '@/api/reports'
import {
  createDataZoom,
  createGrid,
  createLegend,
  createTitle,
  createXAxis,
} from '@/features/charts/common/transformers'
import {
  Color,
  SolidLineSeriesSymbol,
  formatChartDateTimeRange,
} from '@/features/charts/utils'
import { dateToTimestamp } from '@/utils/dateTime'
import { EChartsOption, SeriesOption } from 'echarts'
import { GroupedListDataItems } from '../components/aggregateTypeSelect'
import { AggregateOptionsHandler } from '../handlers/aggregateDataHandler'
import { TransformedAggregateData } from '../types/aggregateData'
import {
  MetricTypeOptionsList,
  YAxisOptions,
  chartTypeOptions,
} from '../types/aggregateOptionsData'

export default function transformAggregateData(
  handler: AggregateOptionsHandler
): TransformedAggregateData {
  const charts = handler.aggregatedData.map((data) => {
    return {
      chart: transformData(handler, data),
    }
  })
  return {
    data: {
      charts,
    },
  }
}

const getAggregationType = (
  aggregateId: string
): GroupedListDataItems | null => {
  return MetricTypeOptionsList.find((item) => item.id === aggregateId) || null
}

const getAggregateMetricType = (
  aggregateType: GroupedListDataItems,
  metricId: string
) => {
  return aggregateType.options.find((item) => item.id === metricId)
}

export const transformData = (
  handler: AggregateOptionsHandler,
  data: AggregationResult
): EChartsOption => {
  const sourceSeries = data.series ?? []
  const points = sourceSeries[0]?.dataPoints ?? []
  const start = points[0]?.start ?? dateToTimestamp(handler.startDateTime)
  const end =
    points[points.length - 1]?.start ?? dateToTimestamp(handler.endDateTime)
  const locationIdentifier =
    handler.updatedLocations[0]?.locationIdentifier ?? data.identifier ?? ''

  const metric = handler.metricType.split('-')
  const aggregationType = getAggregationType(metric[0]) as GroupedListDataItems
  const aggregateMetricType = getAggregateMetricType(aggregationType, metric[1])

  const titleHeader = `${handler.averageOrSum === 0 ? 'Sum:' : 'Average:'} ${
    aggregationType.id
  } - ${aggregateMetricType?.label}\n${locationIdentifier}`
  const dateRange = formatChartDateTimeRange(start, end)

  const title = createTitle({
    title: titleHeader,
    dateRange,
  })

  const xAxis = createXAxis(start, end)

  const yAxis = [
    {
      name: YAxisOptions.find((option) => option.id === handler.yAxisType)
        ?.label,
      min: 0,
    },
  ]

  // const metric = handler.metricType.split('-')
  const dataName = metric[1]

  const legendData =
    sourceSeries.length === 1
      ? [{ name: dataName, icon: SolidLineSeriesSymbol }]
      : sourceSeries.map((arr) => {
          return { name: arr.identifier ?? '', icon: SolidLineSeriesSymbol }
        })

  const legend = createLegend({
    data: legendData,
  })

  const grid = createGrid({
    top: 200,
    left: 60,
    right: 430,
  })

  const dataZoom = createDataZoom()

  const seriesType = chartTypeOptions.find(
    (c) => c.id === handler.visualChartType
  )?.id

  const series: SeriesOption[] = sourceSeries.map((item) => {
    const data = transformSeriesData(item.dataPoints ?? [])
    const common = {
      name: sourceSeries.length === 1 ? dataName : (item.identifier ?? ''),
      ...(sourceSeries.length === 1 ? { color: Color.Green } : {}),
    }
    if (seriesType === 'pie') {
      return {
        ...common,
        type: 'pie',
        data: data.map(([name, value]) => ({ name, value: Number(value) })),
      }
    }
    return { ...common, type: seriesType ?? 'line', data, symbolSize: 5 }
  })

  const chartOptions: EChartsOption = {
    title: title,
    xAxis: xAxis,
    yAxis: yAxis,
    grid: grid,
    legend: legend,
    dataZoom: dataZoom,
    series: series,
  }

  return chartOptions
}

const transformSeriesData = (
  dataPoints: AggregationDataPoint[]
): [string, string][] =>
  dataPoints.flatMap(({ start, value }) =>
    start && typeof value === 'number' && Number.isFinite(value)
      ? [[start, value.toFixed(2)]]
      : []
  )
