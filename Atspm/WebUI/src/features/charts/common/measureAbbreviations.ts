// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - measureAbbreviations.ts
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
import { ChartType } from '@/features/charts/common/types'

// The config API's MeasureType abbreviations, as seeded, keyed to the chart
// each one drives. This is the one place a measure is tied to a ChartType:
// the measure picker and the measure-defaults lookup both go through it.
export const abbreviationToChartType: Record<string, ChartType> = {
  AD: ChartType.ApproachDelay,
  AV: ChartType.ApproachVolume,
  AoR: ChartType.ArrivalsOnRed,
  Speed: ChartType.ApproachSpeed,
  GTU: ChartType.GreenTimeUtilization,
  LTGA: ChartType.LeftTurnGapAnalysis,
  PedD: ChartType.PedestrianDelay,
  PCD: ChartType.PurdueCoordinationDiagram,
  TSPS: ChartType.PrioritySummary,
  PD: ChartType.PreemptionDetails,
  PPT: ChartType.PurduePhaseTermination,
  SF: ChartType.PurdueSplitFailure,
  SM: ChartType.SplitMonitor,
  TAA: ChartType.TimingAndActuation,
  TMC: ChartType.TurningMovementCounts,
  WT: ChartType.WaitTime,
  YRA: ChartType.YellowAndRedActuations,
  RM: ChartType.RampMetering,
}

const normalize = (value: string) => value.replace(/\s+/g, '').toLowerCase()

/**
 * The chart a measure drives. The abbreviation is authoritative; the name
 * is only a fallback for a measure whose abbreviation is not in the map,
 * matched case- and whitespace-insensitively against the ChartType values
 * (so "Purdue Split Failure" still finds PurdueSplitFailure). Seeded names
 * do not all spell their chart type - "Transit Signal Priority Summary"
 * drives PrioritySummary - which is why the abbreviation comes first.
 */
export const chartTypeForMeasure = (measure: {
  abbreviation?: string | null
  name?: string | null
}): ChartType | 'Unknown' => {
  const byAbbreviation =
    measure.abbreviation && abbreviationToChartType[measure.abbreviation]
  if (byAbbreviation) return byAbbreviation

  const wanted = normalize(measure.name ?? '')
  const byName = Object.values(ChartType).find(
    (chartType) => normalize(chartType) === wanted
  )
  return byName ?? 'Unknown'
}
