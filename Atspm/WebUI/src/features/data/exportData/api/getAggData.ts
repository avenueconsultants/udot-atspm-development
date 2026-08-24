// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - getAggData.ts
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
import { getAggregationDataFromLocationIdentifierAndDataType } from '@/api/data'
import { useQuery } from '@tanstack/react-query'

// The backend's Aggregation/GetArchivedAggregations route was folded into
// the shared DataControllerBase.GetData(locationIdentifier, dataType, start,
// end) action - this now calls that instead of a route that no longer exists.
type AggregationDataType = Parameters<
  typeof getAggregationDataFromLocationIdentifierAndDataType
>[1]

export function useGetAggData(
  locationIdentifier: string,
  dataType: AggregationDataType,
  start: Date,
  end: Date
) {
  return useQuery({
    queryKey: ['aggData', locationIdentifier, dataType, start, end],
    queryFn: () =>
      getAggregationDataFromLocationIdentifierAndDataType(
        locationIdentifier,
        dataType,
        { start: start.toISOString(), end: end.toISOString() }
      ),
    enabled: false,
  })
}
