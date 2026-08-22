// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - turningMovementCounts.transformer.ts
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
  transformSeriesData,
} from '@/features/charts/common/transformers'
import { DataPointForInt } from '@/api/reports'
import {
  ChartType,
  DataPoint,
} from '@/features/charts/common/types'
import {
  ColumnGroup,
  Labels,
  TableRow,
  TransformedChartResponse,
} from '@/features/charts/types'
import {
  Color,
  SolidLineSeriesSymbol,
  formatChartDateTimeRange,
} from '@/features/charts/utils'
import { addHours, format } from 'date-fns'
import { EChartsOption, SeriesOption } from 'echarts'
import {
  compareTurningMovementDirections,
  getAvailableTurningMovementDirections,
  normalizeTurningMovementDirection,
} from './directions'
import {
  NormalizedTurningMovementCountTableRow,
  RawTurningMovementCountsData,
  RawTurningMovementCountsResponse,
  RawTurningMovementCountTableRow,
} from './types'

function toDataPoints(
  points: DataPointForInt[] | null | undefined
): DataPoint[] {
  return (points ?? []).map((p) => ({
    timestamp: p.timestamp ?? '',
    value: p.value ?? 0,
  }))
}

function normalizeTableRow(
  row: RawTurningMovementCountTableRow
): NormalizedTurningMovementCountTableRow {
  return {
    direction: row.direction ?? '',
    movementType: row.movementType ?? '',
    laneType: row.laneType ?? '',
    volumes: toDataPoints(row.volumes),
    peakHourVolume: row.peakHourVolume
      ? { value: row.peakHourVolume.value ?? 0 }
      : null,
  }
}

export default function transformTurningMovementCountsData(
  response: RawTurningMovementCountsResponse
): TransformedChartResponse {
  const charts = (response.data.charts ?? [])
    .slice()
    .sort((a, b) => {
      const directionDiff = compareTurningMovementDirections(
        a.direction ?? '',
        b.direction ?? ''
      )
      if (directionDiff !== 0) return directionDiff

      return compareMovementTypes(a.movementType ?? '', b.movementType ?? '')
    })
    .map((data) => ({
      chart: transformData(data),
    }))

  const table = (response.data.table ?? []).map(normalizeTableRow)

  const directions = getAvailableTurningMovementDirections(
    table.map((row) => row.direction)
  )
  const preferred = [
    'Left',
    'Thru-Left',
    'Thru',
    'Thru + Thru-Right',
    'Thru-Right',
    'Right',
  ]

  const movementTypes = buildMovementTypeMap(table, preferred, directions)
  const labels = buildLabels(directions, movementTypes)

  const peakHour = response.data.peakHour?.key
    ? { key: response.data.peakHour.key, value: response.data.peakHour.value ?? 0 }
    : null

  const peakRow = buildPeakHourRow(table, peakHour, directions, movementTypes)
  const displayProps = createTableDisplayProps(response.data.charts ?? [])

  return {
    type: ChartType.TurningMovementCounts,
    data: {
      displayProps,
      labels,
      table,
      charts,
      peakHour:
        peakHour && peakRow
          ? {
              peakHourFactor: response.data.peakHourFactor ?? null,
              peakHourData: [peakRow],
            }
          : null,
    },
  }
}

function createTableDisplayProps(charts: RawTurningMovementCountsData[]) {
  const firstChart = charts[0]

  if (!firstChart) {
    return createDisplayProps({ exportFileName: 'Turning_Movement_Counts' })
  }

  return createDisplayProps({
    exportFileName: formatExportFileName(
      `Turning Movement Counts ${firstChart.locationDescription ?? ''}`,
      firstChart.start ?? '',
      firstChart.end ?? ''
    ),
  })
}

function transformData(data: RawTurningMovementCountsData): EChartsOption {
  const lanes = data.lanes ?? []
  const plans = data.plans ?? []
  const peakHour = data.peakHour
  const peakHourFactor = data.peakHourFactor
  const peakHourVolume = data.peakHourVolume
  const laneUtilizationFactor = data.laneUtilizationFactor
  const totalHourlyVolumes = toDataPoints(data.totalHourlyVolumes)
  const start = data.start ?? ''
  const end = data.end ?? ''
  const locationDescription = data.locationDescription ?? ''
  const direction = data.direction ?? ''
  const movementType = data.movementType ?? ''
  const laneType = data.laneType ?? ''

  const info = createInfoString(
    ['Total Volume: ', `${(data.totalVolume ?? 0).toLocaleString()}`],
    ['Peak Hour: ', peakHour ?? 'N/A'],
    ['Peak Hour Volume: ', formatNullableNumber(peakHourVolume)],
    ['Peak Hour Factor: ', formatNullableNumber(peakHourFactor, 2)],
    ['fLU: ', formatNullableNumber(laneUtilizationFactor, 2)]
  )

  const titleHeader = `Turning Movement Counts\n${locationDescription} - ${direction} ${movementType} - ${laneType}`
  const dateRange = formatChartDateTimeRange(start, end)

  const title = createTitle({
    title: [
      'Turning Movement Counts',
      `${direction} ${movementType} - ${laneType}`,
    ],
    location: locationDescription,
    dateRange,
    info,
  })

  const xAxis = createXAxis(start, end)
  const yAxis = createYAxis(true, { name: 'Volume Per Hour' })

  const grid = createGrid({
    top: 170,
    left: 70,
    right: 190,
  })

  const legendData = [] as { name: string; icon: string }[]

  lanes.forEach((lane) => {
    legendData.push({
      name: `Lane ${lane.laneNumber}`,
      icon: SolidLineSeriesSymbol,
    })
  })

  const legend = createLegend({
    top: grid.top,
    data: [
      { name: 'Total Volume', icon: SolidLineSeriesSymbol },
      ...legendData,
    ],
  })

  const dataZoom = createDataZoom([
    {
      type: 'slider',
      orient: 'vertical',
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
    ChartType.TurningMovementCounts
  )

  const tooltip = createTooltip()

  const colorValues = Object.values(Color)

  const series: SeriesOption[] = []

  if (lanes.length > 1) {
    series.push(
      ...createSeries({
        name: `Total Volume`,
        data: transformSeriesData(totalHourlyVolumes),
        type: 'line',
        binStepLineToggle: true,
        color: Color.Red,
        tooltip: {
          valueFormatter: (val) => `${Math.round(val as number)} vph`,
        },
      })
    )
  }

  lanes.forEach((lane, i) => {
    series.push(
      ...createSeries({
        name: `Lane ${lane.laneNumber}`,
        data: transformSeriesData(toDataPoints(lane.volume)),
        type: 'line',
        binStepLineToggle: true,
        color: colorValues[i % colorValues.length],
        tooltip: {
          valueFormatter: (val) => `${Math.round(val as number)} vph`,
        },
      })
    )
  })

  const plansSeries = createPlans(
    plans as unknown as Parameters<typeof createPlans>[0],
    yAxis.length
  )

  const displayProps = createDisplayProps({
    description: `${direction}${movementType}`,
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
    series: [...series, plansSeries],
    displayProps,
  }

  return chartOptions
}

function formatNullableNumber(value: number | null | undefined, decimals?: number) {
  if (value == null) {
    return 'N/A'
  }

  return decimals == null ? value.toLocaleString() : value.toFixed(decimals)
}

function formatTime(timestamp: string | Date) {
  return format(new Date(timestamp), 'HH:mm')
}

function compareMovementTypes(a: string, b: string) {
  const movementOrder = [
    'Left',
    'Thru-Left',
    'Thru',
    'Thru + Thru-Right',
    'Thru-Right',
    'Right',
  ]
  const orderA = movementOrder.indexOf(a)
  const orderB = movementOrder.indexOf(b)

  if (orderA !== orderB) {
    if (orderA === -1) return 1
    if (orderB === -1) return -1
    return orderA - orderB
  }

  return a.localeCompare(b)
}

function buildMovementTypeMap(
  table: NormalizedTurningMovementCountTableRow[],
  preferredOrder: string[],
  directions: string[]
) {
  const map: Record<string, string[]> = {}
  directions.forEach((dir) => {
    const set = new Set(
      table
        .filter((d) => normalizeTurningMovementDirection(d.direction) === dir)
        .map((d) => d.movementType)
    )
    const arr = Array.from(set).sort((a, b) => {
      const ia = preferredOrder.indexOf(a)
      const ib = preferredOrder.indexOf(b)
      if (ia === -1 || ib === -1) return a.localeCompare(b)
      return ia - ib
    })
    map[dir] = arr
  })
  return map
}

function buildLabels(
  directions: string[],
  movementTypes: Record<string, string[]>
): Labels {
  const columnGroups: ColumnGroup[] = [{ title: null, columns: ['Hour'] }]

  directions.forEach((dir) => {
    columnGroups.push({
      title: dir,
      columns: [...movementTypes[dir], 'Total'],
    })
  })

  columnGroups.push({ title: null, columns: ['Bin Total'] })

  const flatColumns = columnGroups.flatMap((g) => g.columns)
  return { columnGroups, flatColumns }
}

function buildPeakHourRow(
  rawTable: NormalizedTurningMovementCountTableRow[],
  peakHour: { key: string; value: number } | null,
  directions: string[],
  movementTypes: Record<string, string[]>
): TableRow | null {
  if (!peakHour?.key) return null

  const valueAtPH = (dir: string, mt: string) =>
    rawTable.find(
      (r) =>
        normalizeTurningMovementDirection(r.direction) === dir &&
        r.movementType === mt
    )?.peakHourVolume?.value ?? 0

  const start = new Date(peakHour.key)
  const desc = `${formatTime(start)} - ${formatTime(addHours(start, 1))}`

  const row: TableRow = [desc]
  let binTotal = 0

  directions.forEach((dir) => {
    let dirSum = 0
    movementTypes[dir].forEach((mt) => {
      const v = valueAtPH(dir, mt)
      row.push(v)
      dirSum += v
    })
    row.push(dirSum)
    binTotal += dirSum
  })

  row.push(binTotal)
  return row
}
