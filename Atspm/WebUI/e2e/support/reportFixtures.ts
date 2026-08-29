// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - e2e/support/reportFixtures.ts
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
import type { LinkPivotResult } from '../../src/api/reports/report-api.schemas'

// A link pivot analysis of the routeFixtures corridor (1001 -> 1002), in the
// shape LinkPivot/getReportData and LinkPivot/getLinkPivotForTsd return it.
// Link 1 recommends +12 seconds on an existing offset of 30; link 2, -5 on
// 60.
export const linkPivotResult = {
  adjustments: [
    {
      linkNumber: 1,
      locationIdentifier: '1001',
      location: 'Main St & 400 S',
      delta: 12,
      existingOffset: 30,
      adjustment: 42,
    },
    {
      linkNumber: 2,
      locationIdentifier: '1002',
      location: 'Main St & 500 S',
      delta: -5,
      existingOffset: 60,
      adjustment: 55,
    },
  ],
  approachLinks: [
    {
      locationIdentifier: '1001',
      location: 'Main St & 400 S',
      upstreamApproachDirection: 'Northbound',
      downstreamLocationIdentifier: '1002',
      downstreamLocation: 'Main St & 500 S',
      downstreamApproachDirection: 'Southbound',
      paogUpstreamBefore: 62,
      paogUpstreamPredicted: 71,
      paogDownstreamBefore: 58,
      paogDownstreamPredicted: 66,
      aogUpstreamBefore: 620,
      aogUpstreamPredicted: 710,
      aogDownstreamBefore: 580,
      aogDownstreamPredicted: 660,
      delta: 12,
      resultChartLocation: null,
      upstreamCombinedLocation: '1001 - Main St & 400 S',
      downstreamCombinedLocation: '1002 - Main St & 500 S',
      aogTotalBefore: 1200,
      pAogTotalBefore: 60,
      aogTotalPredicted: 1370,
      pAogTotalPredicted: 68,
      totalChartExisting: 60,
      totalChartPositiveChange: 8,
      totalChartNegativeChange: 0,
      totalChartRemaining: 32,
      upstreamChartExisting: 62,
      upstreamChartPositiveChange: 9,
      upstreamChartNegativeChange: 0,
      upstreamChartRemaining: 29,
      downstreamChartExisting: 58,
      downstreamChartPositiveChange: 8,
      downstreamChartNegativeChange: 0,
      downstreamChartRemaining: 34,
      totalChartName: 'Total',
      upstreamChartName: 'Upstream',
      downstreamChartName: 'Downstream',
      linkNumber: 1,
    },
  ],
  totalAogDownstreamBefore: 580,
  totalPaogDownstreamBefore: 58,
  totalAogDownstreamPredicted: 660,
  totalPaogDownstreamPredicted: 66,
  totalAogUpstreamBefore: 620,
  totalPaogUpstreamBefore: 62,
  totalAogUpstreamPredicted: 710,
  totalPaogUpstreamPredicted: 71,
  totalAogBefore: 1200,
  totalPaogBefore: 60,
  totalAogPredicted: 1370,
  totalPaogPredicted: 68,
  totalChartExisting: 60,
  totalChartPositiveChange: 8,
  totalChartNegativeChange: 0,
  totalChartRemaining: 32,
  totalUpstreamChartExisting: 62,
  totalUpstreamChartPositiveChange: 9,
  totalUpstreamChartNegativeChange: 0,
  totalUpstreamChartRemaining: 29,
  totalDownstreamChartExisting: 58,
  totalDownstreamChartPositiveChange: 8,
  totalDownstreamChartNegativeChange: 0,
  totalDownstreamChartRemaining: 34,
} satisfies LinkPivotResult
