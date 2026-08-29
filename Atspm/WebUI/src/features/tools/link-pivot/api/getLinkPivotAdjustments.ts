// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - getLinkPivotAdjustments.ts
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
  LinkPivotAdjustment,
  LinkPivotApproachLink,
  LinkPivotResult,
  getLinkPivotReportData,
} from '@/api/reports'
import {
  mapStringBooleansToBoolean,
  toRouteId,
} from '@/features/charts/api/getTools'
import { ToolOptions, ToolType } from '@/features/charts/common/types'
import { ExtractFnReturnType, QueryConfig } from '@/lib/react-query'
import { useQuery } from '@tanstack/react-query'
import { AdjustmentDto, ApproachLinksDto, RawLinkPivotData } from '../types'

type QueryFnType = typeof getLinkPivotAdjustment

type BaseOptions = {
  config?: QueryConfig<QueryFnType>
}

type UseToolsOptions = BaseOptions & {
  toolType: ToolType
  toolOptions: ToolOptions
}

function toAdjustment(a: LinkPivotAdjustment): AdjustmentDto {
  return {
    linkNumber: a.linkNumber ?? 0,
    locationIdentifier: a.locationIdentifier ?? '',
    location: a.location ?? '',
    delta: a.delta ?? 0,
    existingOffset: a.existingOffset ?? 0,
    adjustment: a.adjustment ?? 0,
  }
}

function toApproachLink(a: LinkPivotApproachLink): ApproachLinksDto {
  return {
    locationIdentifier: a.locationIdentifier ?? '',
    location: a.location ?? '',
    upstreamApproachDirection: a.upstreamApproachDirection ?? '',
    downstreamLocationIdentifier: a.downstreamLocationIdentifier ?? '',
    downstreamLocation: a.downstreamLocation ?? '',
    downstreamApproachDirection: a.downstreamApproachDirection ?? '',
    paogUpstreamBefore: a.paogUpstreamBefore ?? 0,
    paogUpstreamPredicted: a.paogUpstreamPredicted ?? 0,
    paogDownstreamBefore: a.paogDownstreamBefore ?? 0,
    paogDownstreamPredicted: a.paogDownstreamPredicted ?? 0,
    aogUpstreamBefore: a.aogUpstreamBefore ?? 0,
    aogUpstreamPredicted: a.aogUpstreamPredicted ?? 0,
    aogDownstreamBefore: a.aogDownstreamBefore ?? 0,
    aogDownstreamPredicted: a.aogDownstreamPredicted ?? 0,
    delta: a.delta ?? 0,
    resultChartLocation: null,
    upstreamCombinedLocation: a.upstreamCombinedLocation ?? '',
    downstreamCombinedLocation: a.downstreamCombinedLocation ?? '',
    aogTotalBefore: a.aogTotalBefore ?? 0,
    pAogTotalBefore: a.pAogTotalBefore ?? 0,
    aogTotalPredicted: a.aogTotalPredicted ?? 0,
    pAogTotalPredicted: a.pAogTotalPredicted ?? 0,
    totalChartExisting: a.totalChartExisting ?? 0,
    totalChartPositiveChange: a.totalChartPositiveChange ?? 0,
    totalChartNegativeChange: a.totalChartNegativeChange ?? 0,
    totalChartRemaining: a.totalChartRemaining ?? 0,
    upstreamChartExisting: a.upstreamChartExisting ?? 0,
    upstreamChartPositiveChange: a.upstreamChartPositiveChange ?? 0,
    upstreamChartNegativeChange: a.upstreamChartNegativeChange ?? 0,
    upstreamChartRemaining: a.upstreamChartRemaining ?? 0,
    downstreamChartExisting: a.downstreamChartExisting ?? 0,
    downstreamChartPositiveChange: a.downstreamChartPositiveChange ?? 0,
    downstreamChartNegativeChange: a.downstreamChartNegativeChange ?? 0,
    downstreamChartRemaining: a.downstreamChartRemaining ?? 0,
    totalChartName: a.totalChartName ?? '',
    upstreamChartName: a.upstreamChartName ?? '',
    downstreamChartName: a.downstreamChartName ?? '',
    linkNumber: a.linkNumber ?? 0,
  }
}

export function toRawLinkPivotData(result: LinkPivotResult): RawLinkPivotData {
  return {
    totalAogDownstreamBefore: result.totalAogDownstreamBefore ?? 0,
    totalPaogDownstreamBefore: result.totalPaogDownstreamBefore ?? 0,
    totalAogDownstreamPredicted: result.totalAogDownstreamPredicted ?? 0,
    totalPaogDownstreamPredicted: result.totalPaogDownstreamPredicted ?? 0,
    totalAogUpstreamBefore: result.totalAogUpstreamBefore ?? 0,
    totalPaogUpstreamBefore: result.totalPaogUpstreamBefore ?? 0,
    totalAogUpstreamPredicted: result.totalAogUpstreamPredicted ?? 0,
    totalPaogUpstreamPredicted: result.totalPaogUpstreamPredicted ?? 0,
    totalAogBefore: result.totalAogBefore ?? 0,
    totalPaogBefore: result.totalPaogBefore ?? 0,
    totalAogPredicted: result.totalAogPredicted ?? 0,
    totalPaogPredicted: result.totalPaogPredicted ?? 0,
    totalChartExisting: result.totalChartExisting ?? 0,
    totalChartPositiveChange: result.totalChartPositiveChange ?? 0,
    totalChartNegativeChange: result.totalChartNegativeChange ?? 0,
    totalChartRemaining: result.totalChartRemaining ?? 0,
    totalUpstreamChartExisting: result.totalUpstreamChartExisting ?? 0,
    totalUpstreamChartPositiveChange:
      result.totalUpstreamChartPositiveChange ?? 0,
    totalUpstreamChartNegativeChange:
      result.totalUpstreamChartNegativeChange ?? 0,
    totalUpstreamChartRemaining: result.totalUpstreamChartRemaining ?? 0,
    totalDownstreamChartExisting: result.totalDownstreamChartExisting ?? 0,
    totalDownstreamChartPositiveChange:
      result.totalDownstreamChartPositiveChange ?? 0,
    totalDownstreamChartNegativeChange:
      result.totalDownstreamChartNegativeChange ?? 0,
    totalDownstreamChartRemaining: result.totalDownstreamChartRemaining ?? 0,
    adjustments: (result.adjustments ?? []).map(toAdjustment),
    approachLinks: (result.approachLinks ?? []).map(toApproachLink),
  }
}

export const getLinkPivotAdjustment = async (
  type: ToolType,
  options: ToolOptions
): Promise<RawLinkPivotData> => {
  const transformedOptions = mapStringBooleansToBoolean(options)
  const result = await getLinkPivotReportData({
    ...transformedOptions,
    routeId: toRouteId(transformedOptions.routeId),
  })

  return toRawLinkPivotData(result)
}

export const useLinkPivotAdjustment = ({
  toolType,
  toolOptions,
  config,
}: UseToolsOptions) => {
  return useQuery<ExtractFnReturnType<QueryFnType>>({
    ...config,
    enabled: false,
    queryKey: [ToolType.LinkPivot, toolOptions],
    queryFn: () => getLinkPivotAdjustment(toolType, toolOptions),
    // The page shows the failure beside its Run Analysis button; the
    // app-wide policy would rethrow to the _app.tsx boundary instead.
    throwOnError: false,
  })
}
