// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - types.ts
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
import { MeasureOption, MeasureType } from '@/api/config'
import { EChartsOption } from 'echarts'
import { ApproachVolumeSummaryData } from './approachVolume/types'
import { ChartType, ToolType } from './common/types'
import type { NormalizedTurningMovementCountTableRow } from './turningMovementCounts/types'

export interface ExtendedEChartsOption extends EChartsOption {
  displayProp?: {
    height: number
    description: string
  }
}

interface ApproachVolumeChart {
  chart: ExtendedEChartsOption
  table: ApproachVolumeSummaryData
}

export interface StandardChart {
  chart: ExtendedEChartsOption
}

export interface TransformedDefaultResponse {
  type: ChartType
  data: {
    charts: StandardChart[]
  }
}

export interface TransformedToolResponse {
  type: ToolType
  data: {
    charts: StandardChart[]
  }
}

export interface TransformedTimeSpaceResponse {
  type: ToolType
  data: StandardChart
}

export interface TransformedApproachVolumeResponse {
  type: ChartType.ApproachVolume
  data: {
    charts: ApproachVolumeChart[]
  }
}

export interface TransformedPreemptDetailsResponse {
  type: ChartType
  data: {
    charts: StandardChart[]
  }
}

export type TableRow = (string | number)[]
export type ColumnGroup = { title: string | null; columns: string[] }

export interface Labels {
  columnGroups: ColumnGroup[]
  flatColumns: string[]
}

export interface TurningMovementCountsTableDisplayProps {
  exportFileName?: string
  height?: number
}

export interface TransformedTurningMovementCountsResponse {
  type: ChartType
  data: {
    displayProps?: TurningMovementCountsTableDisplayProps
    labels: Labels
    table: NormalizedTurningMovementCountTableRow[]
    charts: StandardChart[]
    peakHour?: {
      peakHourFactor: number | null
      peakHourData: TableRow[]
    } | null
  }
}

export interface TransformedTimingAndActuationResponse {
  type: ChartType
  data: {
    title: EChartsOption
    charts: StandardChart[]
    legends: EChartsOption[]
  }
}

export type TransformedChartResponse =
  | TransformedDefaultResponse
  | TransformedApproachVolumeResponse
  | TransformedPreemptDetailsResponse
  | TransformedTimingAndActuationResponse
  | TransformedTurningMovementCountsResponse
  | TransformedToolResponse

// UI projection of the generated API model: options are keyed by name and
// the chart type is resolved from the measure abbreviation.
export type ChartDefaults = Omit<MeasureType, 'measureOptions'> & {
  chartType: ChartType | 'Unknown'
  measureOptions: Record<string, Default>
}

// Editable UI values can be numbers, booleans, or selections. The API stores
// them as strings; identity and option names come from the generated model.
export type Default = {
  [Key in 'id' | 'option']: NonNullable<MeasureOption[Key]>
} & {
  value: NonNullable<MeasureOption['value']> | number | boolean | number[]
}

export type ChartOptionDefaults = Record<
  string,
  Pick<Default, 'value'> & Partial<Pick<Default, 'id' | 'option'>>
>
