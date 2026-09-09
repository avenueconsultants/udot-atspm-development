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
import { PedDelayPlan, PedDelayResult } from '@/api/reports'
import { BaseChartOptions, ChartType } from '@/features/charts/common/types'

export interface PedestrianDelayChartOptions extends BaseChartOptions {
  showPedRecall: boolean
  showCycleLength: boolean
  showPercentDelay: boolean
  showPedBeginWalk: boolean
  timeBuffer: number
  pedRecallThreshold: number
}

export interface PedestrianDelayChartOptionsDefaults {
  showPedRecall: { id: number; value: boolean; option: string }
  showCycleLength: { id: number; value: boolean; option: string }
  showPercentDelay: { id: number; value: boolean; option: string }
  showPedBeginWalk: { id: number; value: boolean; option: string }
  timeBuffer: { id: number; value: string; option: string }
  pedRecallThreshold: { id: number; value: string; option: string }
  yAxisDefault: { id: number; value: string; option: string }
}

export type pedestrianDelayPlan = PedDelayPlan

export type RawPedestrianDelayData = PedDelayResult

export interface RawPedestrianDelayResponse {
  type: ChartType.PedestrianDelay
  data: RawPedestrianDelayData[]
}
