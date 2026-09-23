// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - getLeftTurnGapReportDataCheck.ts
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
  getLeftTurnGapReportDataCheckReportData,
  LeftTurnGapDataCheckOptions,
} from '@/api/reports'
import { useQuery } from '@tanstack/react-query'

// A check is one generated request per selected approach. Include the selection
// in the cache key so a different approach set cannot reuse an earlier check.
export const getLeftTurnGapReportDataCheck = (
  approachIds: number[],
  body: LeftTurnGapDataCheckOptions,
  signal?: AbortSignal
) =>
  Promise.all(
    approachIds.map((approachId) =>
      getLeftTurnGapReportDataCheckReportData({ ...body, approachId }, signal)
    )
  )

export const useLeftTurnGapReportDataCheck = ({
  body,
  approachIds,
}: {
  body: LeftTurnGapDataCheckOptions
  approachIds: number[]
}) =>
  useQuery({
    queryKey: ['LeftTurnGapReportDataCheck', body, approachIds],
    enabled: false,
    throwOnError: false,
    queryFn: ({ signal }) =>
      getLeftTurnGapReportDataCheck(approachIds, body, signal),
  })
