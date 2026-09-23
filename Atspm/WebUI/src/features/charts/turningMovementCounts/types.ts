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
import {
  KeyValuePairOfDateTimeInt32,
  TurningMovementCountData,
  TurningMovementCountsLanesResult,
} from '@/api/reports'
import {
  BaseChartOptions,
  ChartType,
  DataPoint,
} from '@/features/charts/common/types'

export interface TurningMovementCountsChartOptions extends BaseChartOptions {
  binSize: number
  combineThruRight?: boolean
}

export interface TurningMovementCountsChartOptionsDefaults {
  binSize: { id: number; value: string; option: string }
  yAxisDefault: { id: number; value: string; option: string }
  combineThruRight?: { id: number; value: string; option: string }
}

export type RawTurningMovementCountsData = TurningMovementCountsLanesResult

export type RawTurningMovementCountTableRow = TurningMovementCountData

export interface RawTurningMovementCountsResponse {
  type: ChartType.TurningMovementCounts
  data: {
    charts: RawTurningMovementCountsData[]
    table: RawTurningMovementCountTableRow[]
    peakHourFactor: number | null | undefined
    peakHour: KeyValuePairOfDateTimeInt32 | null | undefined
  }
}

export interface NormalizedTurningMovementCountTableRow {
  direction: string
  movementType: string
  laneType: string
  volumes: DataPoint[]
  peakHourVolume: { value: number } | null
}
