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
import type {
  DataPointForDouble,
  LinkPivotResult,
  PurdueCoordinationDiagramResult,
  SplitMonitorResult,
} from '../../src/api/reports/report-api.schemas'

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

// One hour of 15-minute points between the given wall-clock times.
const quarterHourPoints = (
  start: string,
  values: number[]
): DataPointForDouble[] =>
  values.map((value, index) => {
    const timestamp = new Date(start)
    timestamp.setMinutes(timestamp.getMinutes() + index * 15)
    const pad = (n: number) => String(n).padStart(2, '0')
    return {
      timestamp:
        `${timestamp.getFullYear()}-${pad(timestamp.getMonth() + 1)}-${pad(timestamp.getDate())}` +
        `T${pad(timestamp.getHours())}:${pad(timestamp.getMinutes())}:00`,
      value,
    }
  })

// PurdueCoordinationDiagram/getReportData for location 1001, 08:00-09:00:
// one result per coordinated phase, each with a plan strip, the
// red/yellow/green cycle series and detector arrivals.
export const purdueCoordinationDiagramResult = (
  start: string,
  end: string,
  phase: { number: number; description: string; approachId: number }
): PurdueCoordinationDiagramResult => ({
  start,
  end,
  locationIdentifier: '1001',
  locationDescription: '1001 - Main St & 400 S',
  approachId: phase.approachId,
  approachDescription: phase.description,
  phaseNumber: phase.number,
  phaseDescription: `Phase ${phase.number}`,
  totalOnGreenEvents: 620,
  totalDetectorHits: 1000,
  percentArrivalOnGreen: 62,
  plans: [
    {
      planNumber: '1',
      start,
      end,
      planDescription: 'Plan 1',
      percentGreenTime: 45,
      percentArrivalOnGreen: 62,
      platoonRatio: 1.38,
    },
  ],
  volumePerHour: quarterHourPoints(start, [820, 910, 880, 760]),
  redSeries: quarterHourPoints(start, [0, 0, 0, 0]),
  yellowSeries: quarterHourPoints(start, [52, 52, 52, 52]),
  greenSeries: quarterHourPoints(start, [56, 56, 56, 56]),
  detectorEvents: quarterHourPoints(start, [12, 48, 71, 30]),
})

// SplitMonitor/getReportData for location 1001, 08:00-09:00: one result per
// phase, with a coordinated plan for the first half hour and a free (254)
// plan for the second, the programmed split line and each termination
// cause's points. The plan numbers matter to PhaseTable: 254 is headed
// "Free" and its termination cell reports max-outs instead of force-offs.
export const splitMonitorResult = (
  start: string,
  end: string,
  phase: { number: number; description: string }
): SplitMonitorResult => {
  const halfHourIn = quarterHourPoints(start, [0, 0, 0])[2].timestamp
  return {
    start,
    end,
    locationIdentifier: '1001',
    locationDescription: '1001 - Main St & 400 S',
    phaseNumber: phase.number,
    percentileSplit: 85,
    phaseDescription: `Phase ${phase.number} - ${phase.description}`,
    plans: [
      {
        planNumber: '1',
        planDescription: 'Plan 1',
        start,
        end: halfHourIn,
        percentSkips: 4.25,
        percentGapOuts: 61,
        percentMaxOuts: 0,
        percentForceOffs: 35,
        averageSplit: 27.4,
        percentileSplit: 31,
        minTime: 7,
        programmedSplit: 30,
        percentileSplit85th: 31,
        percentileSplit50th: 26.5,
      },
      {
        planNumber: '254',
        planDescription: 'Free',
        start: halfHourIn,
        end,
        percentSkips: 10,
        percentGapOuts: 80,
        percentMaxOuts: 10,
        percentForceOffs: 0,
        averageSplit: 18,
        percentileSplit: 24,
        minTime: 7,
        programmedSplit: 0,
        percentileSplit85th: 24,
        percentileSplit50th: 17,
      },
    ],
    programmedSplits: quarterHourPoints(start, [30, 30, 0, 0]),
    gapOuts: quarterHourPoints(start, [18, 22, 15, 12]),
    maxOuts: quarterHourPoints(start, [30, 30, 30, 30]),
    forceOffs: quarterHourPoints(start, [30, 29, 30, 30]),
    unknowns: [],
    peds: quarterHourPoints(start, [12, 14, 10, 11]),
  }
}
