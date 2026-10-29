// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - gpxRoutePlacement.ts
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
import { getDistanceAtDisplayCoordinate } from '@/features/charts/timeSpaceDiagram/core/math/timeSpaceLayout'
import { formatChartDateTimeRange } from '@/features/charts/utils'
import { addDays, differenceInCalendarDays } from 'date-fns'
import type { GpxPoint } from './gpxFileParser'
import type { GpxUploadOptions } from './types'

interface GpxRouteSignal {
  locationIdentifier: string
  latitude: number | null
  longitude: number | null
  // Feet along the route from the first signal.
  routeFeet: number
  // The signal's y value on the chart, in whatever spacing mode is showing.
  chartPosition: number
}

// What the chart tells a GPX track about where it can be drawn. Signals are
// in route order, the same order as the chart's y axis.
export interface GpxRoute {
  startMs: number
  endMs: number
  signals: GpxRouteSignal[]
  // The 50th percentile chart stands for a typical day, so a drive from any
  // date is matched by its time of day.
  matchTimeOfDay: boolean
}

// null leaves a gap: the drive is off the route at that moment.
export type GpxChartPoint = [timestampMs: number, chartPosition: number | null]

export interface GpxChartTrack {
  id: string
  data: GpxChartPoint[]
  // Why nothing was drawn; null when the track is on the chart.
  message: string | null
}

type StartEndPicks = Pick<GpxUploadOptions, 'startLocation' | 'endLocation'>
type MappedSignal = GpxRouteSignal & { latitude: number; longitude: number }
type PlanePoint = { x: number; y: number }

const FEET_PER_DEGREE_LATITUDE = 364_000
// The drive passes a signal at its closest approach while inside this radius.
const SIGNAL_PASS_RADIUS_FEET = 150
// Farther than this from the straight line between signals is off the route.
const OFF_ROUTE_FEET = 200
// How far past the first and last signal the drive is still drawn.
const ROUTE_END_ALLOWANCE_FEET = 150
// A phone's position wanders while stopped; moving less than this from the
// last counted point is that wander, not driving.
const STOPPED_DRIFT_FEET = 25
// Between two signal passes, driving farther than this is a detour, not the
// road between them.
const DETOUR_FACTOR = 1.5
const DETOUR_ALLOWANCE_FEET = 300

export function buildGpxRoute({
  locations,
  routeFeet,
  chartPositions,
  startMs,
  endMs,
  matchTimeOfDay = false,
}: {
  locations: {
    locationIdentifier: string
    latitude?: number | null
    longitude?: number | null
  }[]
  routeFeet: number[]
  chartPositions: number[]
  startMs: number
  endMs: number
  matchTimeOfDay?: boolean
}): GpxRoute {
  return {
    startMs,
    endMs,
    matchTimeOfDay,
    signals: locations.map((location, index) => ({
      locationIdentifier: location.locationIdentifier,
      latitude: location.latitude ?? null,
      longitude: location.longitude ?? null,
      routeFeet: routeFeet[index],
      chartPosition: chartPositions[index],
    })),
  }
}

/**
 * The signals a GPX row offers as "Start" and "End". Empty while the signals'
 * map positions are enough to place a drive, so the row hides the pickers.
 */
export function getStartEndLocations(route: GpxRoute | undefined): string[] {
  if (!route || route.signals.length < 2 || canPlaceByMap(route)) return []
  return route.signals.map((signal) => signal.locationIdentifier)
}

// A row starts at the first signal and ends at the last until the user picks
// others, and goes back to them when a new route doesn't have its pick.
export function resolveStartEnd(locations: string[], picks: StartEndPicks) {
  const isOnRoute = (location?: string): location is string =>
    !!location && locations.includes(location)

  return {
    start: isOnRoute(picks.startLocation) ? picks.startLocation : locations[0],
    end: isOnRoute(picks.endLocation)
      ? picks.endLocation
      : locations[locations.length - 1],
  }
}

export function placeGpxTracks(
  entries: GpxUploadOptions[],
  route: GpxRoute | undefined
): GpxChartTrack[] {
  if (!route) return []

  return entries
    .filter((entry) => !entry.error && entry.parsedData?.length)
    .map((entry) => ({
      id: entry.id,
      ...placeGpxTrack(entry.parsedData as GpxPoint[], route, entry),
    }))
}

/**
 * Places each GPS point at its position along the route, by map position when
 * the route's first and last signals have one, otherwise by distance driven
 * from the row's Start signal.
 */
export function placeGpxTrack(
  recorded: GpxPoint[],
  route: GpxRoute,
  picks: StartEndPicks = {}
): Omit<GpxChartTrack, 'id'> {
  if (route.signals.length < 2) {
    return {
      data: [],
      message: 'This route needs at least two signals to place a drive.',
    }
  }

  const points = route.matchTimeOfDay
    ? moveOntoChartDay(recorded, route)
    : recorded
  if (!overlapsChartTime(points, route)) {
    const drive = formatRange(
      recorded[0].timestampMs,
      recorded[recorded.length - 1].timestampMs
    )
    return {
      data: [],
      message: route.matchTimeOfDay
        ? `This drive was recorded ${drive}, outside the chart's time of day.`
        : `This drive was recorded ${drive}, outside the chart's time (${formatRange(route.startMs, route.endMs)}).`,
    }
  }

  const byMap = canPlaceByMap(route)
  const positions = byMap
    ? placeByMap(points, route)
    : placeFromStart(points, route, picks)
  if (!positions) {
    return {
      data: [],
      message:
        'Choose "Start" and "End" signals at different points on the route.',
    }
  }

  const data = clipToChartTime(points, positions, route)
  if (!hasVisibleSegment(data, route)) {
    return {
      data: [],
      message: byMap
        ? "No part of this drive during the chart's time follows this route."
        : "This drive passes the End signal before the chart's time starts.",
    }
  }

  return { data, message: null }
}

/**
 * Where the drive passes one signal and then another, positions between the
 * two passes follow the distance driven, so curves and stops land where they
 * happened. Anywhere else (before the first pass, after the last, or a
 * turnaround) the point is projected onto the straight line between the
 * nearest two signals.
 */
function placeByMap(points: GpxPoint[], route: GpxRoute) {
  const signals = route.signals.filter(hasMapPosition)
  const toPlane = createPlaneProjection(signals)
  const signalPoints = signals.map((signal) =>
    toPlane(signal.latitude, signal.longitude)
  )
  const track = points.map((point) => toPlane(point.latitude, point.longitude))
  const routeFeet = track.map((point) =>
    projectOntoRoute(point, signals, signalPoints)
  )
  const driven = getDrivenFeet(track)
  const passes = findSignalPasses(track, signalPoints)

  for (let i = 1; i < passes.length; i++) {
    const from = passes[i - 1]
    const to = passes[i]
    if (from.signal === to.signal) continue

    const drivenBetween = driven[to.index] - driven[from.index]
    const straightLine = getDistance(
      signalPoints[from.signal],
      signalPoints[to.signal]
    )
    if (drivenBetween > straightLine * DETOUR_FACTOR + DETOUR_ALLOWANCE_FEET) {
      continue
    }

    const fromFeet = signals[from.signal].routeFeet
    const toFeet = signals[to.signal].routeFeet
    for (let j = from.index; j <= to.index; j++) {
      const fraction =
        drivenBetween > 0 ? (driven[j] - driven[from.index]) / drivenBetween : 0
      routeFeet[j] = fromFeet + fraction * (toFeet - fromFeet)
    }
  }

  const toChartPosition = createChartPositioner(route)
  return routeFeet.map((feet) => (feet == null ? null : toChartPosition(feet)))
}

/**
 * Without map positions for the signals, the drive is taken to begin at the
 * Start signal and head toward End, and each point is placed by the distance
 * driven since the file's first point. null when Start and End don't give the
 * drive anywhere to go.
 */
function placeFromStart(
  points: GpxPoint[],
  route: GpxRoute,
  picks: StartEndPicks
): (number | null)[] | null {
  const locations = route.signals.map((signal) => signal.locationIdentifier)
  const { start, end } = resolveStartEnd(locations, picks)
  const startFeet = route.signals[locations.indexOf(start)].routeFeet
  const endFeet = route.signals[locations.indexOf(end)].routeFeet
  const routeLength = Math.abs(endFeet - startFeet)
  if (!(routeLength > 0)) return null

  const direction = Math.sign(endFeet - startFeet)
  const toPlane = createPlaneProjection(points)
  const track = points.map((point) => toPlane(point.latitude, point.longitude))
  const toChartPosition = createChartPositioner(route)

  return getDrivenFeet(track).map((driven) =>
    driven > routeLength + ROUTE_END_ALLOWANCE_FEET
      ? null
      : toChartPosition(startFeet + direction * driven)
  )
}

// Converts feet along the route to the chart's y value through every signal on
// the chart, mapped or not, so the drive crosses each signal's row as it
// reaches that signal in any spacing mode.
function createChartPositioner(route: GpxRoute) {
  const routeFeet = route.signals.map((signal) => signal.routeFeet)
  const chartPositions = route.signals.map((signal) => signal.chartPosition)

  return (feet: number) =>
    getDistanceAtDisplayCoordinate(routeFeet, chartPositions, feet)
}

// Moves the drive onto the chart's date, keeping its time of day. A drive or
// chart that crosses midnight may need the day before or after instead.
// Unmoved when no day lines the two up.
function moveOntoChartDay(points: GpxPoint[], route: GpxRoute) {
  const days = differenceInCalendarDays(route.startMs, points[0].timestampMs)

  for (const shift of [days, days - 1, days + 1]) {
    const moved = points.map((point) => ({
      ...point,
      timestampMs: addDays(point.timestampMs, shift).getTime(),
    }))
    if (overlapsChartTime(moved, route)) return moved
  }

  return points
}

function overlapsChartTime(points: GpxPoint[], route: GpxRoute) {
  return (
    points[points.length - 1].timestampMs >= route.startMs &&
    points[0].timestampMs <= route.endMs
  )
}

// The route's ends need map positions; signals in between that lack one are
// placed by their distance along the route.
function canPlaceByMap(route: GpxRoute) {
  const { signals } = route
  return (
    signals.length >= 2 &&
    hasMapPosition(signals[0]) &&
    hasMapPosition(signals[signals.length - 1])
  )
}

function hasMapPosition(signal: GpxRouteSignal): signal is MappedSignal {
  return (
    Number.isFinite(signal.latitude) &&
    Number.isFinite(signal.longitude) &&
    // An unset map position is stored as 0, 0.
    !(signal.latitude === 0 && signal.longitude === 0)
  )
}

function formatRange(startMs: number, endMs: number) {
  return formatChartDateTimeRange(
    new Date(startMs).toISOString(),
    new Date(endMs).toISOString()
  )
}

// Flat map in feet around the places' middle; fine over a corridor's length.
function createPlaneProjection(
  places: { latitude: number; longitude: number }[]
) {
  const originLatitude =
    places.reduce((sum, place) => sum + place.latitude, 0) / places.length
  const originLongitude =
    places.reduce((sum, place) => sum + place.longitude, 0) / places.length
  const feetPerDegreeLongitude =
    FEET_PER_DEGREE_LATITUDE * Math.cos((originLatitude * Math.PI) / 180)

  return (latitude: number, longitude: number): PlanePoint => ({
    x: (longitude - originLongitude) * feetPerDegreeLongitude,
    y: (latitude - originLatitude) * FEET_PER_DEGREE_LATITUDE,
  })
}

function getDistance(a: PlanePoint, b: PlanePoint) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

// Feet along the route of the nearest point on the straight lines between the
// mapped signals; null when the drive is off the route.
function projectOntoRoute(
  point: PlanePoint,
  signals: GpxRouteSignal[],
  signalPoints: PlanePoint[]
): number | null {
  let best: { offRouteFeet: number; routeFeet: number } | null = null
  const lastSegment = signalPoints.length - 2

  for (let i = 0; i <= lastSegment; i++) {
    const a = signalPoints[i]
    const b = signalPoints[i + 1]
    const length = getDistance(a, b)
    if (length === 0) continue

    const along =
      ((point.x - a.x) * (b.x - a.x) + (point.y - a.y) * (b.y - a.y)) / length
    // Past either end of the route is off the chart.
    if (i === 0 && along < -ROUTE_END_ALLOWANCE_FEET) continue
    if (i === lastSegment && along > length + ROUTE_END_ALLOWANCE_FEET) continue

    const min = i === 0 ? -ROUTE_END_ALLOWANCE_FEET : 0
    const max = i === lastSegment ? length + ROUTE_END_ALLOWANCE_FEET : length
    const fraction = Math.min(Math.max(along, min), max) / length
    const offRouteFeet = getDistance(point, {
      x: a.x + fraction * (b.x - a.x),
      y: a.y + fraction * (b.y - a.y),
    })

    if (!best || offRouteFeet < best.offRouteFeet) {
      const fromFeet = signals[i].routeFeet
      const toFeet = signals[i + 1].routeFeet
      best = {
        offRouteFeet,
        routeFeet: fromFeet + fraction * (toFeet - fromFeet),
      }
    }
  }

  return best && best.offRouteFeet <= OFF_ROUTE_FEET ? best.routeFeet : null
}

// Feet driven to each point, counted from the last point that moved far
// enough, so a stop at a red light adds nothing however long it lasts.
function getDrivenFeet(track: PlanePoint[]) {
  const driven = [0]
  let counted = track[0]
  for (let i = 1; i < track.length; i++) {
    const step = getDistance(counted, track[i])
    const isMoving = step >= STOPPED_DRIFT_FEET
    driven.push(driven[i - 1] + (isMoving ? step : 0))
    if (isMoving) counted = track[i]
  }
  return driven
}

// Each time the drive comes within the pass radius of a signal, its closest
// point to that signal. Sorted in the order they were driven.
function findSignalPasses(track: PlanePoint[], signalPoints: PlanePoint[]) {
  const passes: { index: number; signal: number }[] = []

  signalPoints.forEach((signalPoint, signal) => {
    let closest: { index: number; feet: number } | null = null

    for (let index = 0; index < track.length; index++) {
      const feet = getDistance(track[index], signalPoint)
      if (feet <= SIGNAL_PASS_RADIUS_FEET) {
        if (!closest || feet < closest.feet) closest = { index, feet }
      } else if (closest) {
        passes.push({ index: closest.index, signal })
        closest = null
      }
    }

    if (closest) passes.push({ index: closest.index, signal })
  })

  return passes.sort((a, b) => a.index - b.index)
}

// Keeps the points inside the chart's time plus one on either side, so the
// line runs to the chart's edges instead of stopping short of them.
function clipToChartTime(
  points: GpxPoint[],
  positions: (number | null)[],
  route: GpxRoute
): GpxChartPoint[] {
  let first = 0
  while (
    first < points.length - 1 &&
    points[first + 1].timestampMs <= route.startMs
  ) {
    first++
  }

  let last = points.length - 1
  while (last > first && points[last - 1].timestampMs >= route.endMs) {
    last--
  }

  return points
    .slice(first, last + 1)
    .map((point, i) => [point.timestampMs, positions[first + i]])
}

function hasVisibleSegment(data: GpxChartPoint[], route: GpxRoute) {
  return data.some(
    ([timestampMs, position], i) =>
      i > 0 &&
      position != null &&
      data[i - 1][1] != null &&
      timestampMs >= route.startMs &&
      data[i - 1][0] <= route.endMs
  )
}
