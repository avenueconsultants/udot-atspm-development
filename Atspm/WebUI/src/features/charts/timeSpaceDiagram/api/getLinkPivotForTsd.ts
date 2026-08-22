// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - getLinkPivotForTsd.ts
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
import { getLinkPivotLinkPivotForTSD } from '@/api/reports'
import { toRawLinkPivotData } from '@/features/tools/link-pivot/api/getLinkPivotAdjustments'
import { RawLinkPivotForTsdData } from '@/features/tools/link-pivot/types'
import { ExtractFnReturnType, QueryConfig } from '@/lib/react-query'
import { dateToTimestamp } from '@/utils/dateTime'
import { useQuery } from 'react-query'
import { mapStringBooleansToBoolean } from '../../api/getTools'
import { ToolOptions, ToolType } from '../../common/types'

type QueryFnType = typeof getLinkPivotForTsd

type BaseOptions = {
  config?: QueryConfig<QueryFnType>
}

type UseLinkPivotForTsdOptions = BaseOptions & {
  toolType: ToolType
  toolOptions: ToolOptions
}

export const getLinkPivotForTsd = async (
  type: ToolType,
  options: ToolOptions
): Promise<RawLinkPivotForTsdData[]> => {
  const transformedOptions = mapStringBooleansToBoolean(options)

  transformedOptions.start = dateToTimestamp(transformedOptions.start as Date)
  transformedOptions.end = dateToTimestamp(transformedOptions.end as Date)

  const results = await getLinkPivotLinkPivotForTSD({
    ...transformedOptions,
    routeId:
      typeof transformedOptions.routeId === 'string' &&
      transformedOptions.routeId !== ''
        ? Number(transformedOptions.routeId)
        : undefined,
  })

  const withData: RawLinkPivotForTsdData[] = []
  for (const r of results) {
    if (!r.data) continue
    withData.push({
      direction: (r.direction ?? '') as 'Primary' | 'Opposing',
      data: toRawLinkPivotData(r.data),
    })
  }
  return withData
}

export const useLinkPivotForTsd = ({
  toolType,
  toolOptions,
  config,
}: UseLinkPivotForTsdOptions) => {
  return useQuery<ExtractFnReturnType<QueryFnType>>({
    ...config,
    enabled: false,
    queryKey: ['tools', toolType, toolOptions],
    queryFn: () => getLinkPivotForTsd(toolType, toolOptions),
  })
}
