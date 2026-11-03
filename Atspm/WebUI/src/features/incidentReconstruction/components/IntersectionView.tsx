// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - IntersectionView.tsx
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
  BADGE_COLOR,
  INDICATION_COLORS,
  UNKNOWN_COLOR,
} from '@/features/incidentReconstruction/chartOption'
import {
  DetectorChange,
  IntersectionLane,
  IntersectionLayout,
  IntersectionLeg,
  detectorOnAt,
  isSpecialLane,
} from '@/features/incidentReconstruction/intersectionLayout'
import { displayName } from '@/features/incidentReconstruction/signalNames'
import {
  describeSignal,
  signalAt,
} from '@/features/incidentReconstruction/signalState'
import {
  ApproachDetector,
  Movement,
  SignalHeadType,
  TimelineBand,
} from '@/features/incidentReconstruction/types'
import { SignalNames } from '@/features/incidentReconstruction/urlCodecs'
import { ReactNode } from 'react'

// Drawn around the middle of the picture. Each leg is drawn pointing south
// from the middle, then turned into place, so inbound traffic always travels up.

/** Half the picture's width when the legs fit in it. */
const MIN_HALF_SIZE = 200
const LANE = 12
const PAD = 6
const MIN_HALF = 20
const CROSSWALK_FROM = 3
const CROSSWALK_DEPTH = 10
const STOP_BAR = 16
const ARROW_TOP = 30
const ARROW_BOTTOM = 46
const PHASE_TEXT = 56
const LANE_MARK = 76
const DETECTOR_FROM = 19
const DETECTOR_LENGTH = 9
/** Road past the stop bar for detectors and the leg's label. */
const LEG_ROOM = 122
/** Diagonal legs stop short of the picture's corner. */
const CORNER_MARGIN = 10

const ROAD_COLOR = '#cfd3d8'
const MARKING_COLOR = '#ffffff'
const CENTER_LINE_COLOR = '#E8B339'
const TEXT_COLOR = '#424242'
const DETECTOR_OFF_COLOR = '#5f6368'

const MOVEMENT_NAMES: Record<Movement, string> = {
  L: 'Left',
  TL: 'Thru-Left',
  LTR: 'Left-Thru-Right',
  T: 'Thru',
  TR: 'Thru-Right',
  R: 'Right',
}

const HEAD_NAMES: Record<SignalHeadType, string> = {
  ProtectedOnly: 'protected only',
  PermissiveOnly: 'permissive only',
  FiveHead: 'five-section head',
  FYA: 'flashing yellow arrow',
}

/** Painted in the lane, like the pavement word. */
const LANE_MARKS: Record<string, string> = {
  Bike: 'BIKE',
  Bus: 'BUS',
  LRT: 'RAIL',
  HDV: 'HOV',
}

const LANE_TYPE_NAMES: Record<string, string> = {
  Bike: 'Bike lane',
  Bus: 'Bus lane',
  LRT: 'Light rail lane',
  HDV: 'High occupancy vehicle lane',
}

const DETECTION_TYPE_NAMES: Record<string, string> = {
  B: 'Basic',
  AC: 'Advanced Count',
  AS: 'Advanced Speed',
  LLC: 'Lane-by-lane Count',
  LLS: 'Lane-by-lane with Speed Restriction',
  SBP: 'Stop Bar Presence',
  AP: 'Advanced Presence',
  P: 'Passage',
}

/** Detectors of these types sit upstream, so one with no distance set is drawn at the far end. */
const ADVANCE_TYPES = new Set(['AC', 'AS', 'AP'])

interface LaneSignal {
  color: string
  flashing: boolean
}

/**
 * Protected green or yellow wins. Otherwise a permissive green flashes on a
 * flashing yellow arrow and shows green on a five-section or permissive-only
 * head, and a permissive yellow shows yellow on all of them.
 */
function laneSignal(
  lane: IntersectionLane,
  bandsByKey: Map<string, TimelineBand>,
  time: number
): LaneSignal {
  const at = (key: string | null) => {
    const band = key ? bandsByKey.get(key) : undefined
    return band ? signalAt(band.changes, time).indication : null
  }
  const own = at(lane.approach.protectedBandKey)
  const permissive = at(lane.approach.permissiveBandKey)

  if (own === 'Green' || own === 'Yellow') {
    return { color: INDICATION_COLORS[own], flashing: false }
  }
  if (permissive === 'Green' && lane.approach.signalHeadType === 'FYA') {
    return { color: INDICATION_COLORS.Yellow, flashing: true }
  }
  if (permissive === 'Green' || permissive === 'Yellow') {
    return { color: INDICATION_COLORS[permissive], flashing: false }
  }
  const shown = own ?? (lane.approach.protectedBandKey ? null : permissive)
  return {
    color: shown ? INDICATION_COLORS[shown] : UNKNOWN_COLOR,
    flashing: false,
  }
}

function pedestrianSignal(
  band: TimelineBand | undefined,
  time: number
): LaneSignal {
  const indication = band ? signalAt(band.changes, time).indication : null
  return {
    color: indication ? INDICATION_COLORS[indication] : UNKNOWN_COLOR,
    flashing: indication === 'FlashingDontWalk',
  }
}

const Flash = ({ on }: { on: boolean }) =>
  on ? (
    <animate
      attributeName="opacity"
      values="1;0.15;1"
      dur="1s"
      repeatCount="indefinite"
    />
  ) : null

const isDiagonal = (leg: IntersectionLeg) => leg.index % 2 === 1

/**
 * How far the leg's stop zone sits from the middle. A diagonal leg starts
 * past both the middle box and the legs beside it, so neither covers it.
 */
function legStart(
  leg: IntersectionLeg,
  halfX: number,
  halfY: number,
  width: number
) {
  if (leg.index === 0 || leg.index === 4) return halfX
  if (leg.index === 2 || leg.index === 6) return halfY
  return Math.SQRT2 * Math.max(halfX, halfY) + width
}

/** How far the leg's road runs from the middle inside the picture. */
const legReach = (leg: IntersectionLeg, halfSize: number) =>
  isDiagonal(leg) ? halfSize * Math.SQRT2 - CORNER_MARGIN : halfSize

const rotation = (leg: IntersectionLeg) => leg.index * 45 - 90

/** A point in the leg's own drawing turned into the whole picture. */
function toPicture(leg: IntersectionLeg, x: number, y: number) {
  const angle = (rotation(leg) * Math.PI) / 180
  return {
    x: x * Math.cos(angle) - y * Math.sin(angle),
    y: x * Math.sin(angle) + y * Math.cos(angle),
  }
}

/** Text along the leg, turned so it never reads upside down. */
function alongLeg(leg: IntersectionLeg): number {
  const angle = rotation(leg) + 90
  return ((((angle + 90) % 180) + 180) % 180) - 90
}

function arrow(
  movement: Movement | null,
  center: number,
  start: number,
  color: string
): ReactNode {
  if (movement === null) return null
  const top = start + ARROW_TOP
  const bottom = start + ARROW_BOTTOM
  const turnY = top + 4
  const parts: ReactNode[] = [
    <line
      key="shaft"
      x1={center}
      y1={bottom}
      x2={center}
      y2={movement === 'L' || movement === 'R' ? turnY + 3 : top + 3}
    />,
  ]
  if (movement !== 'L' && movement !== 'R') {
    parts.push(
      <polygon
        key="up"
        points={`${center},${top} ${center - 2.5},${top + 4} ${center + 2.5},${top + 4}`}
      />
    )
  }
  const turn = (side: -1 | 1) => {
    const tip = center + side * 5
    return [
      <path
        key={`turn${side}`}
        d={`M ${center} ${turnY + 6} Q ${center} ${turnY} ${center + side * 2} ${turnY}`}
        fill="none"
      />,
      <polygon
        key={`head${side}`}
        points={`${tip},${turnY} ${tip - side * 3.5},${turnY - 2.5} ${tip - side * 3.5},${turnY + 2.5}`}
      />,
    ]
  }
  if (movement === 'L' || movement === 'TL' || movement === 'LTR') {
    parts.push(...turn(-1))
  }
  if (movement === 'R' || movement === 'TR' || movement === 'LTR') {
    parts.push(...turn(1))
  }
  return (
    <g stroke={color} fill={color} strokeWidth={1.6} strokeLinecap="round">
      {parts}
    </g>
  )
}

function laneTitle(
  lane: IntersectionLane,
  direction: string,
  bandsByKey: Map<string, TimelineBand>,
  names: SignalNames,
  time: number
): string {
  const movement = lane.movement ? MOVEMENT_NAMES[lane.movement] : 'Lane'
  const number = lane.laneNumber !== null ? ` lane ${lane.laneNumber}` : ''
  const lines = [`${direction} ${movement}${number}`.trim()]
  if (isSpecialLane(lane)) {
    lines.push(LANE_TYPE_NAMES[lane.laneType] ?? `${lane.laneType} lane`)
  }
  const head = lane.approach.signalHeadType
  const permissivePrefix = head
    ? `Permissive, ${HEAD_NAMES[head]}: `
    : 'Permissive: '
  let phaseLines = 0
  for (const [key, prefix] of [
    [lane.approach.protectedBandKey, ''],
    [lane.approach.permissiveBandKey, permissivePrefix],
  ] as const) {
    const band = key ? bandsByKey.get(key) : undefined
    if (band) {
      lines.push(
        `${prefix}${displayName(band, names)}: ${describeSignal(signalAt(band.changes, time), time)}`
      )
      phaseLines += 1
    }
  }
  if (phaseLines === 0) lines.push('No phase in the report')
  return lines.join('\n')
}

/** Along the detector span: 0 at the stop bar, 1 at the far end. */
function detectorPlace(detector: ApproachDetector, maxDistance: number) {
  if (detector.distanceFromStopBar !== null) {
    return detector.distanceFromStopBar / maxDistance
  }
  return detector.detectionTypes.some((type) => ADVANCE_TYPES.has(type)) ? 1 : 0
}

function describeDetector(
  detector: ApproachDetector,
  on: boolean | null
): string {
  const types = detector.detectionTypes
    .map((type) => DETECTION_TYPE_NAMES[type] ?? type)
    .join(', ')
  const distance =
    detector.distanceFromStopBar === null
      ? 'distance not set'
      : `${detector.distanceFromStopBar} ft from the stop bar`
  const state = on === null ? 'no events in the window' : on ? 'On' : 'Off'
  return `Detector ${detector.channel}${types ? ` (${types})` : ''}, ${distance}: ${state}`
}

/** Detectors drawn at the same spot in a lane share one box, on when any of them is. */
function detectorZones(lane: IntersectionLane, maxDistance: number) {
  const zones = new Map<number, ApproachDetector[]>()
  for (const detector of lane.detectors) {
    const place = detectorPlace(detector, maxDistance)
    zones.set(place, [...(zones.get(place) ?? []), detector])
  }
  return [...zones].map(([place, detectors]) => ({ place, detectors }))
}

function phaseText(
  lane: IntersectionLane,
  bandsByKey: Map<string, TimelineBand>
): string {
  const band = lane.approach.protectedBandKey
    ? bandsByKey.get(lane.approach.protectedBandKey)
    : undefined
  if (!band || band.phaseNumber === null) return ''
  return band.isOverlap ? `O${band.phaseNumber}` : `${band.phaseNumber}`
}

/** The north arrow goes in the first corner no diagonal leg runs into. */
function compassCorner(layout: IntersectionLayout) {
  const corners = [
    { index: 7, x: 1, y: -1 },
    { index: 5, x: -1, y: -1 },
    { index: 1, x: 1, y: 1 },
    { index: 3, x: -1, y: 1 },
  ]
  const used = new Set(layout.legs.map((leg) => leg.index))
  return corners.find((corner) => !used.has(corner.index)) ?? corners[0]
}

interface IntersectionViewProps {
  layout: IntersectionLayout
  bandsByKey: Map<string, TimelineBand>
  names: SignalNames
  detectors: Map<number, DetectorChange[]>
  /** Controller time. */
  time: number
}

export default function IntersectionView({
  layout,
  bandsByKey,
  names,
  detectors,
  time,
}: IntersectionViewProps) {
  const widths = (leg: IntersectionLeg) => ({
    inbound: leg.inbound.length * LANE,
    outbound: leg.outboundCount * LANE,
  })
  const widest = (indexes: number[]) =>
    Math.max(
      0,
      ...layout.legs
        .filter((leg) => indexes.includes(leg.index))
        .map((leg) => {
          const { inbound, outbound } = widths(leg)
          return Math.max(inbound, outbound)
        })
    )
  const diagonal = widest([1, 3, 5, 7])
  const halfX = Math.max(MIN_HALF, widest([2, 6]), diagonal) + PAD
  const halfY = Math.max(MIN_HALF, widest([0, 4]), diagonal) + PAD

  const starts = new Map(
    layout.legs.map((leg) => {
      const { inbound, outbound } = widths(leg)
      return [
        leg.index,
        legStart(leg, halfX, halfY, Math.max(inbound, outbound)),
      ]
    })
  )
  // The picture grows until every leg has room past its stop bar.
  const halfSize = Math.max(
    MIN_HALF_SIZE,
    ...layout.legs.map((leg) => {
      const needed = (starts.get(leg.index) ?? 0) + LEG_ROOM
      return isDiagonal(leg) ? (needed + CORNER_MARGIN) / Math.SQRT2 : needed
    })
  )
  // One scale for every leg, so the same distance lines up across legs.
  const detectorSpan = Math.max(
    DETECTOR_LENGTH,
    Math.min(
      ...layout.legs.map(
        (leg) =>
          legReach(leg, halfSize) -
          (starts.get(leg.index) ?? 0) -
          DETECTOR_FROM -
          DETECTOR_LENGTH -
          6
      )
    )
  )

  const surfaces: ReactNode[] = []
  const labels: ReactNode[] = []

  const legs = layout.legs.map((leg) => {
    const { inbound, outbound } = widths(leg)
    const start = starts.get(leg.index) ?? 0
    const reach = legReach(leg, halfSize)
    const direction = leg.inboundDirection ?? ''
    const crosswalkBand = leg.crosswalkBandKey
      ? bandsByKey.get(leg.crosswalkBandKey)
      : undefined
    const crosswalk = pedestrianSignal(crosswalkBand, time)
    const transform = `rotate(${rotation(leg)})`

    // From the middle, so every leg joins the middle box.
    surfaces.push(
      <rect
        key={leg.index}
        transform={transform}
        x={-outbound}
        y={0}
        width={outbound + inbound}
        height={reach + CORNER_MARGIN}
        fill={ROAD_COLOR}
      />
    )

    if (direction) {
      const at = toPicture(leg, inbound / 2, reach - 12)
      labels.push(
        <text
          key={`label-${leg.index}`}
          x={at.x}
          y={at.y}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={11}
          fontWeight={500}
          fill={TEXT_COLOR}
        >
          {direction}
        </text>
      )
    }

    leg.inbound.forEach((lane, index) => {
      if (isSpecialLane(lane) && LANE_MARKS[lane.laneType]) {
        const at = toPicture(leg, (index + 0.5) * LANE, start + LANE_MARK)
        labels.push(
          <text
            key={`mark-${lane.key}`}
            transform={`translate(${at.x} ${at.y}) rotate(${alongLeg(leg)})`}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={6.5}
            fontWeight={700}
            fill={MARKING_COLOR}
          >
            {LANE_MARKS[lane.laneType]}
          </text>
        )
      }

      const text = phaseText(lane, bandsByKey)
      const previous = index > 0 ? leg.inbound[index - 1] : undefined
      // One number for a run of lanes on the same phase.
      if (!text || (previous && phaseText(previous, bandsByKey) === text)) {
        return
      }
      let last = index
      while (
        last + 1 < leg.inbound.length &&
        phaseText(leg.inbound[last + 1], bandsByKey) === text
      ) {
        last += 1
      }
      const at = toPicture(
        leg,
        ((index + last + 1) / 2) * LANE,
        start + PHASE_TEXT
      )
      labels.push(
        <text
          key={`phase-${leg.index}-${index}`}
          x={at.x}
          y={at.y}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={8}
          fill={TEXT_COLOR}
        >
          {text}
        </text>
      )
    })

    return (
      <g key={leg.index} transform={transform}>
        {/* Lane lines */}
        <g stroke={MARKING_COLOR} strokeWidth={0.8} strokeDasharray="5 4">
          {leg.inbound.slice(1).map((lane, index) => (
            <line
              key={lane.key}
              x1={(index + 1) * LANE}
              y1={start + STOP_BAR}
              x2={(index + 1) * LANE}
              y2={reach}
            />
          ))}
          {Array.from({ length: leg.outboundCount - 1 }, (_, index) => (
            <line
              key={index}
              x1={-(index + 1) * LANE}
              y1={start + CROSSWALK_FROM + CROSSWALK_DEPTH + 2}
              x2={-(index + 1) * LANE}
              y2={reach}
            />
          ))}
        </g>
        {inbound > 0 && (
          <g stroke={CENTER_LINE_COLOR} strokeWidth={0.8}>
            <line x1={-1} y1={start + STOP_BAR} x2={-1} y2={reach} />
            <line x1={1} y1={start + STOP_BAR} x2={1} y2={reach} />
          </g>
        )}
        {leg.crosswalkBandKey && (
          <g fill={crosswalk.color}>
            <title>
              {crosswalkBand
                ? `${displayName(crosswalkBand, names)}: ${describeSignal(
                    signalAt(crosswalkBand.changes, time),
                    time
                  )}\nWhich crosswalk this signal serves is a guess.`
                : ''}
            </title>
            {Array.from(
              { length: Math.floor((outbound + inbound) / 5) },
              (_, index) => (
                <rect
                  key={index}
                  x={-outbound + 1 + index * 5}
                  y={start + CROSSWALK_FROM}
                  width={2.6}
                  height={CROSSWALK_DEPTH}
                />
              )
            )}
            <Flash on={crosswalk.flashing} />
          </g>
        )}
        {leg.inbound.map((lane, index) => {
          const signal = laneSignal(lane, bandsByKey, time)
          const center = (index + 0.5) * LANE
          return (
            <g key={lane.key}>
              <title>
                {laneTitle(lane, direction, bandsByKey, names, time)}
              </title>
              {/* Hit area for the lane's tooltip */}
              <rect
                x={index * LANE}
                y={start + STOP_BAR}
                width={LANE}
                height={ARROW_BOTTOM - STOP_BAR + 4}
                fill="transparent"
              />
              <g>
                <line
                  x1={index * LANE + 1}
                  y1={start + STOP_BAR}
                  x2={(index + 1) * LANE - 1}
                  y2={start + STOP_BAR}
                  stroke={signal.color}
                  strokeWidth={3.5}
                />
                {arrow(lane.movement, center, start, signal.color)}
                <Flash on={signal.flashing} />
              </g>
              {detectorZones(lane, layout.maxDistance).map((zone) => {
                const states = zone.detectors.map((detector) =>
                  detectorOnAt(detectors.get(detector.channel), time)
                )
                const on = states.some((state) => state === true)
                const known = states.some((state) => state !== null)
                return (
                  <rect
                    key={zone.place}
                    x={index * LANE + 2}
                    y={start + DETECTOR_FROM + zone.place * detectorSpan}
                    width={LANE - 4}
                    height={DETECTOR_LENGTH}
                    rx={1}
                    fill={on ? BADGE_COLOR : 'rgba(255, 255, 255, 0.55)'}
                    stroke={on ? BADGE_COLOR : DETECTOR_OFF_COLOR}
                    strokeWidth={0.8}
                    strokeDasharray={known ? undefined : '2 1.5'}
                  >
                    <title>
                      {zone.detectors
                        .map((detector, detectorIndex) =>
                          describeDetector(detector, states[detectorIndex])
                        )
                        .join('\n')}
                    </title>
                  </rect>
                )
              })}
            </g>
          )
        })}
      </g>
    )
  })

  const compass = compassCorner(layout)

  return (
    <svg
      viewBox={`${-halfSize} ${-halfSize} ${halfSize * 2} ${halfSize * 2}`}
      width="100%"
      role="img"
      aria-label="Intersection drawing"
      style={{ display: 'block', fontFamily: 'Roboto, sans-serif' }}
    >
      <rect
        x={-halfSize}
        y={-halfSize}
        width={halfSize * 2}
        height={halfSize * 2}
        fill="#fff"
      />
      {/* Road first, so no leg's markings sit under another leg's road. */}
      <rect
        x={-halfX}
        y={-halfY}
        width={halfX * 2}
        height={halfY * 2}
        fill={ROAD_COLOR}
      />
      {surfaces}
      {legs}
      {labels}
      <g
        transform={`translate(${compass.x * (halfSize - 22)} ${compass.y * (halfSize - 24)})`}
        fill={TEXT_COLOR}
      >
        <polygon points="0,-12 -5,0 5,0" />
        <text y={12} textAnchor="middle" fontSize={11} fontWeight={500}>
          N
        </text>
      </g>
    </svg>
  )
}
