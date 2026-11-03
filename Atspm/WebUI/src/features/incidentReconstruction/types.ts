// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - types.ts
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
import type { IncidentBandKind, SignalIndication } from '@/api/reports'

export { IncidentBandKind, SignalIndication } from '@/api/reports'

export const LOCATION_BAND_KEY = 'location'

// Every time below is controller clock time in milliseconds (see wallClock.ts).

export interface SignalChange {
  time: number
  indication: SignalIndication
  eventCode: number
}

export interface TimelineBand {
  key: string
  kind: IncidentBandKind
  phaseNumber: number | null
  isOverlap: boolean
  label: string
  isConfigured: boolean
  /** For pedestrian bands, the vehicle band they sit under. */
  vehicleBandKey: string | null
  /** Sorted by time. The first may be before the window start. */
  changes: SignalChange[]
}

export interface TimelineEvent {
  /** Stable across reloads: controller time, code and parameter. Used by the share link. */
  key: string
  time: number
  eventCode: number
  eventName: string
  eventParam: number
  bandKey: string
  permissiveBandKey: string | null
  parameterDescription: string
}

/** Direction of travel. */
export type Direction = 'NB' | 'SB' | 'EB' | 'WB' | 'NE' | 'NW' | 'SE' | 'SW'

export type Movement = 'L' | 'TL' | 'LTR' | 'T' | 'TR' | 'R'

export interface ApproachDetector {
  channel: number
  laneNumber: number | null
  /** Null when the configuration doesn't say. */
  movement: Movement | null
  /** "V", "Bike", "Ped", "E" (exit) and so on. */
  laneType: string
  /** Feet. Null when the configuration doesn't say. */
  distanceFromStopBar: number | null
  /** "SBP" (stop bar presence), "AC" (advanced count) and so on. */
  detectionTypes: string[]
  /** Seconds the controller logs this detector's changes late. */
  latencyCorrection: number
}

/** How the approach's signal head shows a permissive movement. */
export type SignalHeadType =
  | 'ProtectedOnly'
  | 'PermissiveOnly'
  | 'FiveHead'
  | 'FYA'

export interface ReportApproach {
  description: string
  /** Null when the configuration doesn't say. */
  direction: Direction | null
  protectedBandKey: string | null
  permissiveBandKey: string | null
  pedestrianBandKey: string | null
  /** Null when the report doesn't say. */
  signalHeadType: SignalHeadType | null
  detectors: ApproachDetector[]
}

export interface IncidentReport {
  locationIdentifier: string
  locationDescription: string
  /** The window the report API was asked for. */
  start: number
  end: number
  bands: TimelineBand[]
  /** Sorted by time; events at the same time keep the controller's log order. */
  events: TimelineEvent[]
  approaches: ReportApproach[]
}

/** What one Generate produced: the report plus the inputs it was drawn with. */
export interface GeneratedView {
  report: IncidentReport
  /** The window the user typed, controller clock. */
  start: number
  end: number
  /** Increments on every Generate, so dragged callouts go back to the stack. */
  generation: number
}
