// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - intersectionLayout.ts
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
  ApproachDetector,
  Direction,
  Movement,
  ReportApproach,
  TimelineEvent,
} from './types'

// A schematic intersection built from the location's approaches and detectors.
// Legs are numbered by compass point in screen terms: 0 east, 2 south, 4 west,
// 6 north, odd numbers the diagonals. Only lanes with a detector are known.

/** The leg each direction of travel points toward. */
const TRAVEL_LEG: Record<Direction, number> = {
  EB: 0,
  SE: 1,
  SB: 2,
  SW: 3,
  WB: 4,
  NW: 5,
  NB: 6,
  NE: 7,
}

const LEG_NAMES = [
  'East',
  'Southeast',
  'South',
  'Southwest',
  'West',
  'Northwest',
  'North',
  'Northeast',
]

/** Left to right as a driver sees them at the stop bar. Unknown sits with the through lanes. */
const MOVEMENT_ORDER: (Movement | null)[] = [
  'L',
  'TL',
  'LTR',
  'T',
  null,
  'TR',
  'R',
]

const THROUGH = new Set<Movement | null>(['T', 'TL', 'TR', 'LTR', null])
const TURNS_LEFT = new Set<Movement | null>(['L', 'TL', 'LTR'])
const TURNS_RIGHT = new Set<Movement | null>(['R', 'TR', 'LTR'])

/** Detectors on these lanes don't belong to an approach lane. */
const NOT_APPROACH_LANES = new Set(['Ped', 'E'])

/** Lane types drawn as ordinary vehicle lanes. */
const VEHICLE_LANES = new Set(['V', 'NA'])

const MAX_OUTBOUND = 4

export const DETECTOR_ON_CODE = 82
export const DETECTOR_OFF_CODE = 81

export interface IntersectionLane {
  key: string
  movement: Movement | null
  laneNumber: number | null
  laneType: string
  approach: ReportApproach
  detectors: ApproachDetector[]
}

export interface IntersectionLeg {
  /** 0 east, 2 south, 4 west, 6 north. */
  index: number
  name: string
  /** The direction traffic on this leg travels toward the middle, when any does. */
  inboundDirection: Direction | null
  /** Next to the centre line first, the curb lane last. */
  inbound: IntersectionLane[]
  outboundCount: number
  /** The pedestrian signal drawn on this leg's crosswalk. */
  crosswalkBandKey: string | null
}

/** Bike, bus, rail and high occupancy lanes. */
export const isSpecialLane = (lane: IntersectionLane) =>
  !VEHICLE_LANES.has(lane.laneType)

export interface IntersectionLayout {
  legs: IntersectionLeg[]
  /** Farthest configured detector distance from its stop bar, in feet. At least 1. */
  maxDistance: number
  /** Approaches left out because the configuration gives them no direction. */
  undrawn: ReportApproach[]
  /** Pedestrian signals with no free crosswalk beside their approach. */
  unplacedCrosswalks: string[]
}

const wrap = (leg: number) => ((leg % 8) + 8) % 8

export function legName(index: number): string {
  return LEG_NAMES[wrap(index)]
}

export function buildIntersectionLayout(
  approaches: ReportApproach[]
): IntersectionLayout {
  const placed = approaches.filter(
    (approach): approach is ReportApproach & { direction: Direction } =>
      approach.direction !== null
  )
  const lanesByApproach = new Map(
    placed.map((approach, index) => [approach, approachLanes(approach, index)])
  )

  // A leg is drawn when traffic comes from it, or turns or goes straight into it.
  const legIndexes = new Set<number>()
  const outbound = new Map<number, number>()
  for (const approach of placed) {
    const toward = TRAVEL_LEG[approach.direction]
    legIndexes.add(wrap(toward + 4))
    for (const lane of lanesByApproach.get(approach) ?? []) {
      if (THROUGH.has(lane.movement)) {
        legIndexes.add(toward)
        outbound.set(toward, (outbound.get(toward) ?? 0) + 1)
      }
      if (TURNS_LEFT.has(lane.movement)) legIndexes.add(wrap(toward - 2))
      if (TURNS_RIGHT.has(lane.movement)) legIndexes.add(wrap(toward + 2))
    }
  }

  const legs: IntersectionLeg[] = [...legIndexes]
    .sort((a, b) => a - b)
    .map((index) => {
      const from = placed.filter(
        (approach) => wrap(TRAVEL_LEG[approach.direction] + 4) === index
      )
      return {
        index,
        name: legName(index),
        inboundDirection: from[0]?.direction ?? null,
        inbound: from
          .flatMap((approach) => lanesByApproach.get(approach) ?? [])
          .sort(compareLanes),
        outboundCount: Math.min(
          MAX_OUTBOUND,
          Math.max(1, outbound.get(index) ?? 0)
        ),
        crosswalkBandKey: null,
      }
    })

  const unplacedCrosswalks = placeCrosswalks(legs, placed)

  const distances = placed.flatMap((approach) =>
    approach.detectors.flatMap((detector) =>
      detector.distanceFromStopBar === null
        ? []
        : [detector.distanceFromStopBar]
    )
  )

  return {
    legs,
    maxDistance: Math.max(1, ...distances),
    undrawn: approaches.filter((approach) => approach.direction === null),
    unplacedCrosswalks,
  }
}

/**
 * One lane per lane type, movement and lane number. A detector with no lane
 * number joins the first lane with its lane type and movement.
 */
function approachLanes(
  approach: ReportApproach,
  approachIndex: number
): IntersectionLane[] {
  const detectors = approach.detectors.filter(
    (detector) => !NOT_APPROACH_LANES.has(detector.laneType)
  )
  const lanes = new Map<string, IntersectionLane>()
  const laneKey = (detector: ApproachDetector, laneNumber: number | null) =>
    `${approachIndex}-${detector.laneType}-${detector.movement ?? 'unknown'}-${laneNumber ?? 'none'}`

  for (const detector of detectors.filter((d) => d.laneNumber !== null)) {
    const key = laneKey(detector, detector.laneNumber)
    const lane = lanes.get(key) ?? {
      key,
      movement: detector.movement,
      laneNumber: detector.laneNumber,
      laneType: detector.laneType,
      approach,
      detectors: [],
    }
    lane.detectors.push(detector)
    lanes.set(key, lane)
  }

  for (const detector of detectors.filter((d) => d.laneNumber === null)) {
    const sameMovement = [...lanes.values()]
      .filter(
        (lane) =>
          lane.movement === detector.movement &&
          lane.laneType === detector.laneType
      )
      .sort(compareLanes)[0]
    if (sameMovement) {
      sameMovement.detectors.push(detector)
      continue
    }
    const key = laneKey(detector, null)
    const lane = lanes.get(key) ?? {
      key,
      movement: detector.movement,
      laneNumber: null,
      laneType: detector.laneType,
      approach,
      detectors: [],
    }
    lane.detectors.push(detector)
    lanes.set(key, lane)
  }

  // An approach with no detectors still gets a lane, so its signal shows.
  if (lanes.size === 0) {
    const key = `${approachIndex}-none`
    return [
      {
        key,
        movement: null,
        laneNumber: null,
        laneType: 'NA',
        approach,
        detectors: [],
      },
    ]
  }
  return [...lanes.values()]
}

/** By movement, vehicle lanes before special lanes, then lane number. */
function compareLanes(a: IntersectionLane, b: IntersectionLane): number {
  return (
    MOVEMENT_ORDER.indexOf(a.movement) - MOVEMENT_ORDER.indexOf(b.movement) ||
    Number(isSpecialLane(a)) - Number(isSpecialLane(b)) ||
    a.laneType.localeCompare(b.laneType) ||
    (a.laneNumber ?? Infinity) - (b.laneNumber ?? Infinity)
  )
}

/**
 * The configuration doesn't say which crosswalk a pedestrian signal serves.
 * This guesses the crosswalk to the right of the approach's traffic, then the
 * one to its left, since both run beside that traffic. Returns the signals
 * with neither free.
 */
function placeCrosswalks(
  legs: IntersectionLeg[],
  approaches: (ReportApproach & { direction: Direction })[]
): string[] {
  const byIndex = new Map(legs.map((leg) => [leg.index, leg]))
  const placedKeys = new Set<string>()
  const unplaced = new Set<string>()

  for (const approach of approaches) {
    const key = approach.pedestrianBandKey
    if (!key || placedKeys.has(key)) continue

    const toward = TRAVEL_LEG[approach.direction]
    const leg = [toward + 2, toward - 2]
      .map((index) => byIndex.get(wrap(index)))
      .find((candidate) => candidate && !candidate.crosswalkBandKey)
    if (!leg) {
      unplaced.add(key)
      continue
    }

    leg.crosswalkBandKey = key
    placedKeys.add(key)
    unplaced.delete(key)
  }
  return [...unplaced]
}

export interface DetectorChange {
  time: number
  on: boolean
}

/**
 * Each detector channel's on and off times in the window, moved earlier by
 * the detector's latency correction as other measures do. The report starts
 * at the window start, so the state before a channel's first event is the
 * opposite of that event.
 */
export function detectorTimelines(
  events: TimelineEvent[],
  windowStart: number,
  approaches: ReportApproach[]
): Map<number, DetectorChange[]> {
  const latencyMs = new Map<number, number>()
  for (const detector of approaches.flatMap((approach) => approach.detectors)) {
    if (!latencyMs.has(detector.channel)) {
      latencyMs.set(detector.channel, detector.latencyCorrection * 1000)
    }
  }

  const timelines = new Map<number, DetectorChange[]>()
  for (const event of events) {
    if (
      event.eventCode !== DETECTOR_ON_CODE &&
      event.eventCode !== DETECTOR_OFF_CODE
    ) {
      continue
    }
    const on = event.eventCode === DETECTOR_ON_CODE
    const time = event.time - (latencyMs.get(event.eventParam) ?? 0)
    const changes = timelines.get(event.eventParam) ?? []
    if (changes.length === 0) {
      changes.push({ time: Math.min(windowStart, time), on: !on })
    }
    if (changes[changes.length - 1].on !== on) {
      changes.push({ time, on })
    }
    timelines.set(event.eventParam, changes)
  }
  return timelines
}

/** Null when the channel logged nothing in the window. */
export function detectorOnAt(
  changes: DetectorChange[] | undefined,
  time: number
): boolean | null {
  if (!changes?.length) return null
  let state: boolean | null = null
  for (const change of changes) {
    if (change.time > time) break
    state = change.on
  }
  return state
}
