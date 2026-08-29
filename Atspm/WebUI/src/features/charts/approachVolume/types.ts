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
  BaseChartData,
  BaseChartOptions,
  ChartType,
  DataPoint,
} from '@/features/charts/common/types'

export interface ApproachVolumeChartOptions extends BaseChartOptions {
  binSize: number
  getVolume: boolean
  showDirectionalSplits: boolean
  showTotalVolume: boolean
  showNbEbVolume: boolean
  showSbWbVolume: boolean
  showTMCDetection: boolean
  showAdvanceDetection: boolean
}

export interface ApproachVolumeChartOptionsDefaults {
  binSize: { id: number; value: string; option: string }
  getVolume: { id: number; value: string; option: string }
  showDirectionalSplits: { id: number; value: string; option: string }
  showTotalVolume: { id: number; value: string; option: string }
  showNbEbVolume: { id: number; value: string; option: string }
  showSbWbVolume: { id: number; value: string; option: string }
  showTMCDetection: { id: number; value: string; option: string }
  showAdvanceDetection: { id: number; value: string; option: string }
}

// The report's SummaryData is entirely optional and nullable, and the
// whole summary can be null for a window with no peak hour, so every field
// here is as weak as the contract - the table formats the gaps.
export interface ApproachVolumeSummaryData {
  primaryDirectionName?: string | null
  opposingDirectionName?: string | null
  peakHour?: string | null
  kFactor?: number | null
  peakHourVolume?: number | null
  peakHourFactor?: number | null
  totalVolume?: number | null
  primaryPeakHour?: string | null
  primaryKFactor?: number | null
  primaryPeakHourVolume?: number | null
  primaryPeakHourFactor?: number | null
  primaryTotalVolume?: number | null
  primaryDFactor?: number | null
  opposingPeakHour?: string | null
  opposingKFactor?: number | null
  opposingPeakHourVolume?: number | null
  opposingPeakHourFactor?: number | null
  opposingTotalVolume?: number | null
  opposingDFactor?: number | null
}

export interface RawApproachVolumeData extends BaseChartData {
  primaryDirectionName: string | null
  opposingDirectionName: string | null
  distanceFromStopBar: number
  detectorType: string
  primaryDirectionVolumes: DataPoint[]
  opposingDirectionVolumes: DataPoint[]
  combinedDirectionVolumes: DataPoint[]
  primaryDFactors: DataPoint[]
  opposingDFactors: DataPoint[]
  summaryData: ApproachVolumeSummaryData
}

export interface RawApproachVolumeResponse {
  type: ChartType.ApproachVolume
  data: RawApproachVolumeData[]
}
