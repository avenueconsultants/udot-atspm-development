// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - getLinkPivotPcdCharts.ts
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
  DataPointForDouble,
  LinkPivotPcdResult,
  PurdueCoordinationDiagramResult,
  getLinkPivotPcdData,
} from '@/api/reports'
import { mapStringBooleansToBoolean } from '@/features/charts/api/getTools'
import { ToolOptions, ToolType } from '@/features/charts/common/types'
import {
  RawPurdueCoordinationDiagramData,
  purdueCoordinationDiagramPlan,
} from '@/features/charts/purdueCoordinationDiagram/types'
import { ExtractFnReturnType, QueryConfig } from '@/lib/react-query'
import { useQuery } from 'react-query'
import { RawLinkPivotPcdData, RawLinkPivotPcdResponse } from '../types'

type QueryFnType = typeof getLinkPivotPcdCharts

type BaseOptions = {
  config?: QueryConfig<QueryFnType>
}

type UseToolsOptions = BaseOptions & {
  toolType: ToolType.LpPcd
  toolOptions: ToolOptions
}

function toDataPoints(
  points: DataPointForDouble[] | null | undefined
): { timestamp: string; value: number }[] {
  return (points ?? []).map((p) => ({
    timestamp: p.timestamp ?? '',
    value: p.value ?? 0,
  }))
}

function toPcdData(
  r: PurdueCoordinationDiagramResult
): RawPurdueCoordinationDiagramData {
  return {
    locationIdentifier: r.locationIdentifier ?? '',
    locationDescription: r.locationDescription ?? '',
    start: r.start ?? '',
    end: r.end ?? '',
    approachId: r.approachId ?? 0,
    approachDescription: r.approachDescription ?? '',
    phaseNumber: r.phaseNumber ?? 0,
    phaseDescription: r.phaseDescription ?? '',
    totalOnGreenEvents: r.totalOnGreenEvents ?? 0,
    totalDetectorHits: r.totalDetectorHits ?? 0,
    percentArrivalOnGreen: r.percentArrivalOnGreen ?? 0,
    plans: (r.plans ?? []).map(
      (p): purdueCoordinationDiagramPlan => ({
        planNumber: p.planNumber ?? '',
        start: p.start ?? '',
        end: p.end ?? '',
        planDescription: p.planDescription ?? '',
        percentGreenTime: p.percentGreenTime ?? 0,
        percentArrivalOnGreen: p.percentArrivalOnGreen ?? 0,
        platoonRatio: p.platoonRatio ?? 0,
      })
    ),
    volumePerHour: toDataPoints(r.volumePerHour),
    redSeries: toDataPoints(r.redSeries),
    yellowSeries: toDataPoints(r.yellowSeries),
    greenSeries: toDataPoints(r.greenSeries),
    detectorEvents: toDataPoints(r.detectorEvents),
  }
}

function toRawLinkPivotPcdData(result: LinkPivotPcdResult): RawLinkPivotPcdData {
  return {
    existingTotalAOG: result.existingTotalAOG ?? 0,
    existingTotalPAOG: result.existingTotalPAOG ?? 0,
    existingVolume: result.existingVolume ?? 0,
    pcdExisting: (result.pcdExisting ?? []).map(toPcdData),
    predictedTotalAOG: result.predictedTotalAOG ?? 0,
    predictedTotalPAOG: result.predictedTotalPAOG ?? 0,
    predictedVolume: result.predictedVolume ?? 0,
    pcdPredicted: (result.pcdPredicted ?? []).map(toPcdData),
  }
}

export const getLinkPivotPcdCharts = async (
  type: ToolType.LpPcd,
  options: ToolOptions
): Promise<RawLinkPivotPcdResponse> => {
  const transformedOptions = mapStringBooleansToBoolean(options)
  const result = await getLinkPivotPcdData(transformedOptions)

  return { type, data: toRawLinkPivotPcdData(result) }
}

export const useLinkPivotPcdCharts = ({
  toolType,
  toolOptions,
  config,
}: UseToolsOptions) => {
  return useQuery<ExtractFnReturnType<QueryFnType>>({
    ...config,
    enabled: false,
    queryKey: [toolType, toolOptions],
    queryFn: () => getLinkPivotPcdCharts(toolType, toolOptions),
  })
}
