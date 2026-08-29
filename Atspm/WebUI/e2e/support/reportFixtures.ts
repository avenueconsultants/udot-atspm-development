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
  ApproachSpeedResult,
  ApproachVolumeResult,
  ArrivalOnRedResult,
  DataPointForDouble,
  GreenTimeUtilizationResult,
  LeftTurnGapAnalysisResult,
  LinkPivotResult,
  PedDelayResult,
  PhaseTerminationResult,
  PurdueCoordinationDiagramResult,
  SplitMonitorResult,
  TimingAndActuationsForPhaseResult,
  TurningMovementCountsResult,
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

// The quarter-hour marks of the hour beginning at the given wall-clock
// time, as the literals the API serves (no zone suffix).
const quarterHourTimestamps = (start: string, count: number): string[] =>
  Array.from({ length: count }, (_, index) => {
    const timestamp = new Date(start)
    timestamp.setMinutes(timestamp.getMinutes() + index * 15)
    const pad = (n: number) => String(n).padStart(2, '0')
    return (
      `${timestamp.getFullYear()}-${pad(timestamp.getMonth() + 1)}-${pad(timestamp.getDate())}` +
      `T${pad(timestamp.getHours())}:${pad(timestamp.getMinutes())}:00`
    )
  })

// One hour of 15-minute points, one per given value.
const quarterHourPoints = (
  start: string,
  values: number[]
): Required<DataPointForDouble>[] =>
  quarterHourTimestamps(start, values.length).map((timestamp, index) => ({
    timestamp,
    value: values[index] ?? 0,
  }))

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
  const halfHourIn = quarterHourTimestamps(start, 3)[2]
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

// TimingAndActuation/getReportData for location 1001, 08:00-09:00: one
// result per phase, each a strip of detector channels (one row per named
// detector, plus pedestrian intervals) over the cycle's colour bands.
// phaseType is what the toolbox's "Show Permissive Phases" toggle keys on.
export const timingAndActuationResult = (
  start: string,
  end: string,
  phase: {
    number: number
    approachDescription: string
    phaseType: 'Protected' | 'Permissive'
  }
): TimingAndActuationsForPhaseResult => {
  // Cycle events are {start, value} with an event code, unlike data points.
  const cycleEvents = (codes: number[]) =>
    quarterHourPoints(start, codes).map(({ timestamp, value }) => ({
      start: timestamp,
      value,
    }))
  const cycle = cycleEvents([1, 8, 9, 1])
  const pedestrianIntervals = cycleEvents([21, 22, 23, 21])
  const detector = (name: string) => ({
    name,
    events: cycle.map(({ start: at }) => ({
      detectorOn: at,
      detectorOff: at.replace(/:00$/, ':05'),
    })),
  })
  return {
    start,
    end,
    locationIdentifier: '1001',
    locationDescription: '1001 - Main St & 400 S',
    approachId: phase.number,
    approachDescription: phase.approachDescription,
    phaseNumber: phase.number,
    isPhaseOverLap: false,
    phaseNumberSort: `${phase.number}`,
    phaseType: phase.phaseType,
    pedestrianIntervals,
    pedestrianEvents: [detector(`Ped Push Button ${phase.number}`)],
    cycleAllEvents: cycle,
    advanceCountDetectors: [detector(`Advance Count ${phase.number}`)],
    advancePresenceDetectors: [],
    stopBarDetectors: [detector(`Stop Bar ${phase.number}`)],
    laneByLanesDetectors: [detector(`Lane ${phase.number}`)],
    phaseCustomEvents: null,
  }
}

// TurningMovementCounts/getReportData for location 1001, 08:00-09:00: a
// chart per direction+movement (northbound thru and right, southbound
// thru), the table rows behind them and the peak hour. Each quarter hour's
// bin total is the sum of the three movements: 200, 240, 220, 180 (840).
export const turningMovementCountsResult = (
  start: string,
  end: string
): TurningMovementCountsResult => {
  const movements = [
    {
      direction: 'Northbound',
      movementType: 'Thru',
      counts: [100, 120, 110, 90],
    },
    {
      direction: 'Northbound',
      movementType: 'Right',
      counts: [20, 30, 25, 15],
    },
    { direction: 'Southbound', movementType: 'Thru', counts: [80, 90, 85, 75] },
  ]
  const total = (counts: number[]) => counts.reduce((sum, n) => sum + n, 0)
  return {
    charts: movements.map(({ direction, movementType, counts }) => ({
      locationIdentifier: '1001',
      locationDescription: 'Main St & 400 S',
      start,
      end,
      direction,
      laneType: 'Vehicle',
      movementType,
      plans: [{ planNumber: '1', start, end, planDescription: 'Plan 1' }],
      lanes: [
        {
          laneNumber: 1,
          movementType,
          volume: quarterHourPoints(start, counts),
          laneType: 1,
        },
      ],
      totalHourlyVolumes: quarterHourPoints(start, counts),
      totalVolumes: quarterHourPoints(start, counts),
      totalVolume: total(counts),
      peakHour: '08:00 - 09:00',
      peakHourVolume: total(counts),
      peakHourFactor: 0.92,
      laneUtilizationFactor: 1,
    })),
    table: movements.map(({ direction, movementType, counts }) => ({
      direction,
      movementType,
      laneType: 'Vehicle',
      volumes: quarterHourPoints(start, counts),
      peakHourVolume: { timestamp: start, value: total(counts) },
    })),
    peakHour: { key: start, value: 840 },
    peakHourFactor: 0.92,
  }
}

// PurduePhaseTermination/getReportData for location 1001, 08:00-09:00: one
// result for the whole location, a plan strip and a phase row each with a
// few terminations at quarter-hour marks.
export const purduePhaseTerminationResult = (
  start: string,
  end: string
): PhaseTerminationResult => {
  const at = quarterHourTimestamps(start, 4)
  return {
    start,
    end,
    locationIdentifier: '1001',
    locationDescription: '1001 - Main St & 400 S',
    consecutiveCount: 1,
    plans: [{ planNumber: '1', planDescription: 'Plan 1', start, end }],
    phases: [
      {
        phaseNumber: 2,
        gapOuts: [at[0], at[2]],
        maxOuts: [],
        forceOffs: [at[1], at[3]],
        pedWalkBegins: [at[1]],
        unknownTerminations: [],
      },
      {
        phaseNumber: 6,
        gapOuts: [at[1]],
        maxOuts: [at[3]],
        forceOffs: [at[0], at[2]],
        pedWalkBegins: [],
        unknownTerminations: [at[2]],
      },
    ],
  }
}

// ApproachVolume/getReportData for location 1001, 08:00-09:00: one result
// per direction pair, carrying both directions' volumes, their D factors
// and the peak-hour summary the table under the chart renders.
export const approachVolumeResult = (
  start: string,
  end: string,
  pair: { primary: string; opposing: string; detectorType: string }
): ApproachVolumeResult => ({
  start,
  end,
  locationIdentifier: '1001',
  locationDescription: '1001 - Main St & 400 S',
  primaryDirectionName: pair.primary,
  opposingDirectionName: pair.opposing,
  distanceFromStopBar: 0,
  detectorType: pair.detectorType,
  primaryDirectionVolumes: quarterHourPoints(start, [400, 480, 440, 360]),
  opposingDirectionVolumes: quarterHourPoints(start, [320, 360, 340, 300]),
  combinedDirectionVolumes: quarterHourPoints(start, [720, 840, 780, 660]),
  primaryDFactors: quarterHourPoints(start, [0.56, 0.57, 0.56, 0.55]),
  opposingDFactors: quarterHourPoints(start, [0.44, 0.43, 0.44, 0.45]),
  summaryData: {
    peakHour: '08:00 - 09:00',
    kFactor: 0.092,
    peakHourVolume: 3000,
    peakHourFactor: 0.892,
    totalVolume: 3000,
    primaryPeakHour: '08:00 - 09:00',
    primaryKFactor: 0.094,
    primaryPeakHourVolume: 1680,
    primaryPeakHourFactor: 0.875,
    primaryTotalVolume: 1680,
    primaryDFactor: 0.56,
    opposingPeakHour: '08:00 - 09:00',
    opposingKFactor: 0.091,
    opposingPeakHourVolume: 1320,
    opposingPeakHourFactor: 0.917,
    opposingTotalVolume: 1320,
    opposingDFactor: 0.44,
  },
})

// ApproachSpeed/getReportData for location 1001, 08:00-09:00: one result
// per approach, with the plan strip and the average, 85th and 15th
// percentile speed series against the posted speed.
export const approachSpeedResult = (
  start: string,
  end: string,
  approach: { id: number; description: string; phaseNumber: number }
): ApproachSpeedResult => ({
  start,
  end,
  locationIdentifier: '1001',
  locationDescription: '1001 - Main St & 400 S',
  approachId: approach.id,
  approachDescription: approach.description,
  phaseNumber: approach.phaseNumber,
  phaseDescription: `Phase ${approach.phaseNumber}`,
  detectionType: 'Advanced Speed',
  distanceFromStopBar: 340,
  postedSpeed: 35,
  plans: [{ planNumber: '1', planDescription: 'Plan 1', start, end }],
  averageSpeeds: quarterHourPoints(start, [32, 34, 33, 31]),
  eightyFifthSpeeds: quarterHourPoints(start, [40, 42, 41, 39]),
  fifteenthSpeeds: quarterHourPoints(start, [24, 26, 25, 23]),
})

// ArrivalOnRed/getReportData for location 1001, 08:00-09:00: one result
// per approach, with a plan strip and the percentage, total-vehicle and
// arrivals-on-red series.
export const arrivalsOnRedResult = (
  start: string,
  end: string,
  approach: { id: number; description: string; phaseNumber: number }
): ArrivalOnRedResult => ({
  start,
  end,
  locationIdentifier: '1001',
  locationDescription: '1001 - Main St & 400 S',
  approachId: approach.id,
  approachDescription: approach.description,
  phaseNumber: approach.phaseNumber,
  phaseDescription: `Phase ${approach.phaseNumber}`,
  totalDetectorHits: 1000,
  totalArrivalOnRed: 380,
  percentArrivalOnRed: 38,
  plans: [
    {
      planNumber: '1',
      planDescription: 'Plan 1',
      start,
      end,
      percentArrivalOnRed: 38,
      percentRedTime: 55,
    },
  ],
  percentArrivalsOnRed: quarterHourPoints(start, [35, 42, 39, 36]),
  totalVehicles: quarterHourPoints(start, [820, 910, 880, 760]),
  arrivalsOnRed: quarterHourPoints(start, [287, 382, 343, 274]),
})

// GreenTimeUtilization/getReportData for location 1001, 08:00-09:00: one
// result per approach, a heat map of bins (x = time bin, y = split bin)
// under the average and programmed split lines, with a plan strip.
export const greenTimeUtilizationResult = (
  start: string,
  end: string,
  approach: { id: number; description: string; phaseNumber: number }
): GreenTimeUtilizationResult => ({
  start,
  end,
  locationIdentifier: '1001',
  locationDescription: '1001 - Main St & 400 S',
  approachId: approach.id,
  approachDescription: approach.description,
  phaseNumber: approach.phaseNumber,
  xAxisBinSize: 15,
  yAxisBinSize: 4,
  plans: [
    {
      planNumber: '1',
      planDescription: 'Plan 1',
      start,
      end,
    },
  ],
  bins: [
    { x: 0, y: 5, value: 12 },
    { x: 0, y: 6, value: 20 },
    { x: 1, y: 5, value: 9 },
    { x: 1, y: 7, value: 18 },
    { x: 2, y: 6, value: 22 },
    { x: 3, y: 5, value: 7 },
  ],
  averageSplits: quarterHourPoints(start, [22.5, 24, 25.5, 21]),
  programmedSplits: quarterHourPoints(start, [30, 30, 30, 30]),
})

// LeftTurnGapAnalysis/getReportData for location 1001, 08:00-09:00: one
// result per left-turn approach, the four gap bands the request asked for
// (the fourth open-ended) with a count series each, and the percent
// turnable trend.
export const leftTurnGapAnalysisResult = (
  start: string,
  end: string,
  approach: { id: number; description: string; phaseNumber: number }
): LeftTurnGapAnalysisResult => ({
  start,
  end,
  locationIdentifier: '1001',
  locationDescription: '1001 - Main St & 400 S',
  approachId: approach.id,
  approachDescription: approach.description,
  phaseNumber: approach.phaseNumber,
  phaseDescription: `Phase ${approach.phaseNumber}`,
  detectionTypeDescription: 'Lane By Lane Count',
  gap1Min: 1,
  gap1Max: 3.3,
  gap1Count: quarterHourPoints(start, [120, 140, 130, 110]),
  gap2Min: 3.3,
  gap2Max: 3.7,
  gap2Count: quarterHourPoints(start, [40, 44, 42, 38]),
  gap3Min: 3.7,
  gap3Max: 7.4,
  gap3Count: quarterHourPoints(start, [60, 66, 63, 57]),
  gap4Min: 7.4,
  gap4Max: null,
  gap4Count: quarterHourPoints(start, [20, 22, 21, 19]),
  sumDuration1: 258,
  sumDuration2: 574,
  sumDuration3: 1366,
  percentTurnableSeries: quarterHourPoints(start, [61.5, 63, 62, 60.5]),
  trendLineGapThreshold: 7.4,
})

// PedDelay/getReportData for location 1001, 08:00-09:00: one result per
// pedestrian phase, with a plan strip carrying per-plan statistics, the
// delay per press, cycle lengths, start-of-walk markers and percent delay.
export const pedestrianDelayResult = (
  start: string,
  end: string,
  phase: { number: number; approachId: number; description: string }
): PedDelayResult => ({
  start,
  end,
  locationIdentifier: '1001',
  locationDescription: '1001 - Main St & 400 S',
  approachId: phase.approachId,
  approachDescription: phase.description,
  phaseNumber: phase.number,
  phaseDescription: `Phase ${phase.number}`,
  pedPresses: 143,
  cyclesWithPedRequests: 27,
  timeBuffered: 15,
  uniquePedestrianDetections: 31,
  minDelay: 3.1,
  maxDelay: 88.9,
  averageDelay: 42.4,
  plans: [
    {
      planNumber: '1',
      planDescription: 'Plan 1',
      start,
      end,
      pedRecallMessage: null,
      cyclesWithPedRequests: 27,
      uniquePedDetections: 31,
      pedPresses: 143,
      averageDelaySeconds: 42.4,
      averageCycleLengthSeconds: 120,
    },
  ],
  cycleLengths: quarterHourPoints(start, [120, 120, 120, 120]),
  pedestrianDelay: quarterHourPoints(start, [38, 51, 44, 36]),
  startOfWalk: quarterHourPoints(start, [1, 1, 1, 1]),
  percentDelayByCycleLength: quarterHourPoints(start, [32, 42, 37, 30]),
})
