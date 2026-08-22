// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - getCharts.ts
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
  getApproachDelayReportData,
  getApproachSpeedReportData,
  getApproachVolumeReportData,
  getArrivalOnRedReportData,
  getGreenTimeUtilizationReportData,
  getLeftTurnGapAnalysisReportData,
  getPedDelayReportData,
  getPreemptDetailReportData,
  getPurdueCoordinationDiagramReportData,
  getPurduePhaseTerminationReportData,
  getRampMeteringReportData,
  getSplitFailReportData,
  getSplitMonitorReportData,
  getTurningMovementCountsReportData,
  getWaitTimeReportData,
  getYellowRedActivationsReportData,
} from '@/api/reports'
import {
  ChartOptions,
  ChartType,
  RawChartResponse,
} from '@/features/charts/common/types'
import { TransformedChartResponse } from '@/features/charts/types'
import { reportsAxios } from '@/lib/axios'
import { ExtractFnReturnType, QueryConfig } from '@/lib/react-query'
import { dateToTimestamp } from '@/utils/dateTime'
import { useQuery } from 'react-query'
import { transformChartData } from './transformData'

export const TypeApiMap: Record<ChartType, string> = {
  [ChartType.ApproachDelay]: '/api/v1/ApproachDelay/GetReportData',
  [ChartType.ApproachSpeed]: '/api/v1/ApproachSpeed/GetReportData',
  [ChartType.ApproachVolume]: '/api/v1/ApproachVolume/GetReportData',
  [ChartType.ArrivalsOnRed]: '/api/v1/ArrivalOnRed/GetReportData',
  [ChartType.PurdueCoordinationDiagram]:
    '/api/v1/PurdueCoordinationDiagram/GetReportData',
  [ChartType.GreenTimeUtilization]:
    '/api/v1/GreenTimeUtilization/GetReportData',
  [ChartType.LeftTurnGapAnalysis]: '/api/v1/LeftTurnGapAnalysis/GetReportData',
  [ChartType.PedestrianDelay]: '/api/v1/PedDelay/GetReportData',
  [ChartType.PurduePhaseTermination]:
    '/api/v1/PurduePhaseTermination/GetReportData',
  [ChartType.PreemptionDetails]: '/api/v1/PreemptDetail/GetReportData',
  [ChartType.PrioritySummary]: '/api/v1/PrioritySummary/GetReportData',
  [ChartType.PurdueSplitFailure]: '/api/v1/SplitFail/GetReportData',
  [ChartType.SplitMonitor]: '/api/v1/SplitMonitor/GetReportData',
  [ChartType.TimingAndActuation]: '/api/v1/TimingAndActuation/GetReportData',
  // PriorityDetails is never selectable as a top-level chart (no entry in
  // SelectChart's abbreviationToChartType) - PrioritySummaryChart calls
  // getPriorityDetailsReportData directly as a click-driven drill-down,
  // bypassing this dispatcher entirely. This URL is also stale (singular
  // "PriorityDetail" vs the real "/api/v1/PriorityDetails/getReportData"),
  // which confirms it's unreachable here. Left only so TypeApiMap stays a
  // total Record<ChartType, string>.
  [ChartType.PriorityDetails]: '/api/v1/PriorityDetail/GetReportData',
  [ChartType.TurningMovementCounts]:
    '/api/v1/TurningMovementCounts/GetReportData',
  [ChartType.WaitTime]: '/api/v1/WaitTime/GetReportData',
  [ChartType.YellowAndRedActuations]:
    '/api/v1/YellowRedActivations/GetReportData', // Todo: Fix spelling
  [ChartType.RampMetering]: '/api/v1/RampMetering/GetReportData',
}

type StringBooleanMap = Record<string, boolean | string | Date>

const mapStringBooleansToBoolean = (obj: ChartOptions) => {
  return Object.entries(obj).reduce<StringBooleanMap>((acc, [key, value]) => {
    // Check if the value is exactly "true" or "false" (case-insensitive)
    if (typeof value === 'string') {
      if (value.toLowerCase() === 'true') {
        acc[key] = true
      } else if (value.toLowerCase() === 'false') {
        acc[key] = false
      } else {
        // If it's a string but not "true" or "false", keep it unchanged
        acc[key] = value
      }
    } else {
      // If the value is not a string, keep it unchanged
      acc[key] = value
    }
    return acc
  }, {})
}

// Chart types whose generated report-data fetcher (src/api/reports) has been
// verified to accept/return the same shape this dispatcher already sends/
// expects, so they can call the generated client directly instead of the
// hardcoded URL below. Chart types not listed here still go through the
// legacy reportsAxios.post(TypeApiMap[type], ...) path until their options/
// response shapes are reconciled.
const GeneratedChartFetchers: Partial<
  Record<ChartType, (options: StringBooleanMap) => Promise<unknown>>
> = {
  [ChartType.ApproachDelay]: getApproachDelayReportData,
  [ChartType.ApproachSpeed]: getApproachSpeedReportData,
  [ChartType.ApproachVolume]: getApproachVolumeReportData,
  [ChartType.ArrivalsOnRed]: getArrivalOnRedReportData,
  [ChartType.GreenTimeUtilization]: getGreenTimeUtilizationReportData,
  [ChartType.LeftTurnGapAnalysis]: getLeftTurnGapAnalysisReportData,
  [ChartType.PedestrianDelay]: getPedDelayReportData,
  [ChartType.PurdueCoordinationDiagram]: getPurdueCoordinationDiagramReportData,
  [ChartType.PreemptionDetails]: getPreemptDetailReportData,
  [ChartType.PurduePhaseTermination]: getPurduePhaseTerminationReportData,
  [ChartType.PurdueSplitFailure]: getSplitFailReportData,
  [ChartType.RampMetering]: getRampMeteringReportData,
  [ChartType.SplitMonitor]: getSplitMonitorReportData,
  [ChartType.TurningMovementCounts]: getTurningMovementCountsReportData,
  [ChartType.WaitTime]: getWaitTimeReportData,
  [ChartType.YellowAndRedActuations]: getYellowRedActivationsReportData,
}

export const getCharts = async (
  type: ChartType,
  options: ChartOptions
): Promise<TransformedChartResponse> => {
  const transformedOptions = mapStringBooleansToBoolean(options)
  transformedOptions.start = dateToTimestamp(transformedOptions.start as Date)
  transformedOptions.end = dateToTimestamp(transformedOptions.end as Date)

  const generatedFetcher = GeneratedChartFetchers[type]
  const response = generatedFetcher
    ? await generatedFetcher(transformedOptions)
    : await reportsAxios.post(TypeApiMap[type], transformedOptions)

  return transformChartData({
    type,
    data: response,
  } as unknown as RawChartResponse)
}

type QueryFnType = typeof getCharts

type UseChartsOptions = BaseOptions & {
  chartType: ChartType
  chartOptions: ChartOptions
}

type BaseOptions = {
  config?: QueryConfig<QueryFnType>
}

export const useCharts = ({
  chartType,
  chartOptions,
  config,
}: UseChartsOptions) => {
  return useQuery<ExtractFnReturnType<QueryFnType>>({
    ...config,
    enabled: false,
    queryKey: ['charts', chartType, chartOptions],
    queryFn: () => getCharts(chartType, chartOptions),
  })
}
