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
import { RampMeteringResult } from '@/api/reports'
import { ChartType, DataPoint } from '../common/types'

export interface RampMeteringChartOptionsDefaults {
  combineLanes: { id: number; value: string; option: string }
}

export interface NormalizedDescriptionWithDataPoints {
  description: string
  value: DataPoint[]
}

export interface TimeSpaceDetectorEvent {
  initialX: string
  finalX: string
  isDetectorOn: boolean
}

export interface QueueDetectorEvent {
  detectorOn: string | null
  detectorOff: string | null
  value: number
}

export type RampMeteringData = RampMeteringResult

export interface RawRampMeteringResponse {
  type: ChartType.RampMetering
  data: RampMeteringData
}
