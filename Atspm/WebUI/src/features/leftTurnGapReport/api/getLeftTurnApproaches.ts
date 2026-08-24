// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - getLeftTurnApproaches.ts
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
import { useQuery } from '@tanstack/react-query'

import { ExtractFnReturnType, QueryConfig } from '@/lib/react-query'

import { getApproach } from '@/api/config'

export const getLeftTurnApproaches = async (locationId: string) => {
  return getApproach({
    filter: `locationId eq ${locationId} and detectors/any(i:i/movementType eq 'L')`,
    select: 'id, description',
  })
}

type QueryFnType = typeof getLeftTurnApproaches

type UseLocationsOptions = {
  config?: QueryConfig<QueryFnType>
  locationId: string
}

export const useLeftTurnApproaches = ({
  config,
  locationId,
}: UseLocationsOptions) => {
  return useQuery<ExtractFnReturnType<QueryFnType>>({
    ...config,
    queryKey: ['approaches', locationId],
    enabled: false,
    queryFn: () => getLeftTurnApproaches(locationId),
  })
}
