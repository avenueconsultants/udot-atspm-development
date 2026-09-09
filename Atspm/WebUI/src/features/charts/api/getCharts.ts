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
  getPriorityDetailsReportData,
  getPrioritySummaryReportData,
  getPurdueCoordinationDiagramReportData,
  getPurduePhaseTerminationReportData,
  getRampMeteringReportData,
  getSplitFailReportData,
  getSplitMonitorReportData,
  getTimingAndActuationReportData,
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
import { ExtractFnReturnType, QueryConfig } from '@/lib/react-query'
import { dateToTimestamp } from '@/utils/dateTime'
import { useQuery } from '@tanstack/react-query'
import { transformChartData } from './transformData'

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

// The generated report-data fetcher for every chart type. A total record, so
// a ChartType added without a fetcher is a compile error instead of a request
// that silently goes nowhere.
const chartFetchers: Record<
  ChartType,
  (options: StringBooleanMap) => Promise<unknown>
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
  // Not selectable as a top-level chart: PrioritySummaryChart calls this
  // fetcher itself as a click-driven drill-down. Wired here only so the
  // record stays total.
  [ChartType.PriorityDetails]: getPriorityDetailsReportData,
  [ChartType.PrioritySummary]: getPrioritySummaryReportData,
  [ChartType.PurduePhaseTermination]: getPurduePhaseTerminationReportData,
  [ChartType.PurdueSplitFailure]: getSplitFailReportData,
  [ChartType.RampMetering]: getRampMeteringReportData,
  [ChartType.SplitMonitor]: getSplitMonitorReportData,
  [ChartType.TimingAndActuation]: getTimingAndActuationReportData,
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

  const response = await chartFetchers[type](transformedOptions)

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
    // A failed report belongs in ChartsContainer's inline alert, next to the
    // button that triggered it. The app-wide policy would instead rethrow to
    // the _app.tsx boundary and replace the page - selections included.
    throwOnError: false,
  })
}
