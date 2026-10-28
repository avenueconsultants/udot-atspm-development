// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - gpxRoutePlacement.test.ts
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
import { addDays } from 'date-fns'
import type { GpxPoint } from './gpxFileParser'
import {
  buildGpxRoute,
  getStartEndLocations,
  placeGpxTrack,
  placeGpxTracks,
  resolveStartEnd,
  type GpxChartPoint,
} from './gpxRoutePlacement'

const FEET_PER_DEGREE = 364_000
const SOUTH_LATITUDE = 40.6
const LONGITUDE = -111.87
const FEET_PER_DEGREE_LONGITUDE =
  FEET_PER_DEGREE * Math.cos(((SOUTH_LATITUDE + 0.011) * Math.PI) / 180)

// Map position a given number of feet north and east of the first signal.
const at = (northFeet: number, eastFeet = 0) => ({
  latitude: SOUTH_LATITUDE + northFeet / FEET_PER_DEGREE,
  longitude: LONGITUDE + eastFeet / FEET_PER_DEGREE_LONGITUDE,
})

const START_MS = Date.UTC(2026, 9, 20, 22, 40)
const END_MS = START_MS + 20 * 60_000

// Signals numbered from 7000; by default 4000 feet apart along the route and
// drawn a quarter of a chart unit per foot.
const routeOf = (
  mapPositions: { latitude: number | null; longitude: number | null }[],
  { routeFeet = [0, 4000, 8000], chartPositions = [0, 1000, 2000] } = {}
) =>
  buildGpxRoute({
    locations: mapPositions.map((mapPosition, i) => ({
      locationIdentifier: `${7000 + i}`,
      ...mapPosition,
    })),
    routeFeet,
    chartPositions,
    startMs: START_MS,
    endMs: END_MS,
  })

// Due north of each other.
const route = routeOf([at(0), at(4000), at(8000)])
const missingMiddle = routeOf([
  at(0),
  { latitude: null, longitude: null },
  at(8000),
])
// An unset map position comes back as 0, 0.
const unmapped = routeOf([
  at(0),
  { latitude: 0, longitude: 0 },
  { latitude: null, longitude: null },
])

// One point a second, starting a minute into the chart.
const drive = (
  path: [north: number, east?: number][],
  startMs = START_MS + 60_000
): GpxPoint[] =>
  path.map(([north, east], i) => ({
    timestampMs: startMs + i * 1000,
    ...at(north, east),
  }))

const northbound = (fromFeet: number, toFeet: number, feetPerSecond = 40) =>
  Array.from(
    { length: Math.round(Math.abs(toFeet - fromFeet) / feetPerSecond) + 1 },
    (_, i): [number] => [
      fromFeet + Math.sign(toFeet - fromFeet) * i * feetPerSecond,
    ]
  )

// A phone's position wanders about 3 feet each second while stopped.
const WANDER = [
  [3, 1],
  [-2, 3],
  [1, -3],
  [-3, -2],
]
const stoppedAt = (north: number, east: number, seconds: number) =>
  Array.from({ length: seconds }, (_, i): [number, number] => [
    north + WANDER[i % WANDER.length][0],
    east + WANDER[i % WANDER.length][1],
  ])

const positionAt = (data: GpxChartPoint[], index: number) =>
  data[index][1] as number

describe('placeGpxTrack', () => {
  it('places each point by where it is on the route, not by distance from where the file starts', () => {
    // Starts 120 feet south of the first signal, one point every 40 feet.
    const points = drive(northbound(-120, 8120))
    const { data, message } = placeGpxTrack(points, route)

    expect(message).toBeNull()
    expect(data[0][0]).toBe(START_MS + 60_000)
    expect(positionAt(data, 0)).toBeCloseTo(-30)
    expect(positionAt(data, 53)).toBeCloseTo(500) // 2000 feet north
    expect(positionAt(data, 103)).toBeCloseTo(1000) // second signal
    expect(positionAt(data, 203)).toBeCloseTo(2000) // third signal
    expect(positionAt(data, 206)).toBeCloseTo(2030) // past the last signal
  })

  it('holds still through a stop at a red light while the position wanders', () => {
    // A minute stopped 120 feet short of the second signal.
    const points = drive([
      ...northbound(0, 3880),
      ...stoppedAt(3880, 0, 60),
      ...northbound(3920, 8000),
    ])
    const { data } = placeGpxTrack(points, route)

    expect(positionAt(data, 50)).toBeCloseTo(500) // 2000 feet north

    const stopPositions = data
      .slice(98, 158)
      .map(([, position]) => position as number)
    expect(
      Math.max(...stopPositions) - Math.min(...stopPositions)
    ).toBeLessThan(0.5)
    expect(stopPositions[0]).toBeCloseTo(970, 0)
  })

  it('leaves a gap past the end of the route and picks the drive back up on the way back', () => {
    const points = drive([
      ...northbound(7000, 10000),
      ...northbound(10000, 7000).slice(1),
    ])
    const { data } = placeGpxTrack(points, route)
    const positionAtNorth = (north: number, afterIndex = 0) =>
      data[
        points.findIndex(
          (point, i) =>
            i >= afterIndex &&
            Math.abs(point.latitude - at(north).latitude) < 1e-9
        )
      ][1]

    expect(positionAtNorth(7000)).toBeCloseTo(1750)
    expect(positionAtNorth(8000)).toBeCloseTo(2000)
    expect(positionAtNorth(8120)).toBeCloseTo(2030)
    expect(positionAtNorth(9000)).toBeNull()
    expect(positionAtNorth(8000, 100)).toBeCloseTo(2000)
    expect(positionAtNorth(7000, 100)).toBeCloseTo(1750)
  })

  it('follows the road between two signals where it bends away from the straight line', () => {
    // Bows 400 feet east halfway between the first two signals.
    const bend = northbound(0, 4000).map(([north]): [number, number] => [
      north,
      400 * Math.sin((Math.PI * north) / 4000),
    ])
    const points = drive([...bend, ...northbound(4040, 4400)])
    const { data } = placeGpxTrack(points, route)

    expect(positionAt(data, 50)).toBeCloseTo(500, 0)
    expect(positionAt(data, 100)).toBeCloseTo(1000)
  })

  it('does not stretch a detour along the route', () => {
    // Leaves the first signal 1600 feet east, drives north, and comes back
    // west to the second signal.
    const points = drive([
      ...northbound(-200, 0),
      ...northbound(40, 1600).map(([east]): [number, number] => [0, east]),
      ...northbound(40, 4000).map(([north]): [number, number] => [north, 1600]),
      ...northbound(1560, 0).map(([east]): [number, number] => [4000, east]),
      ...northbound(4040, 4400),
    ])
    const { data } = placeGpxTrack(points, route)
    const detourPoint = at(2000, 1600)
    const onDetour = points.findIndex(
      (point) =>
        point.latitude === detourPoint.latitude &&
        point.longitude === detourPoint.longitude
    )

    expect(onDetour).toBeGreaterThan(0)
    expect(data[onDetour][1]).toBeNull()
  })

  it('places a drive against the signals that have map positions', () => {
    const { data } = placeGpxTrack(drive(northbound(0, 8000)), missingMiddle)

    expect(positionAt(data, 100)).toBeCloseTo(1000)
  })

  it('crosses a signal without a map position when the drive reaches it, with equal location spacing', () => {
    // The middle signal is 500 feet in but drawn halfway up the chart.
    const equalSpacing = routeOf(
      [at(0), { latitude: null, longitude: null }, at(5000)],
      { routeFeet: [0, 500, 5000], chartPositions: [0, 2000, 4000] }
    )
    const { data } = placeGpxTrack(drive(northbound(0, 5000, 50)), equalSpacing)

    expect(positionAt(data, 10)).toBeCloseTo(2000) // 500 feet driven
    expect(positionAt(data, 55)).toBeCloseTo(3000) // 2750 feet driven
    expect(positionAt(data, 100)).toBeCloseTo(4000)
  })

  it('explains a route with a single signal', () => {
    expect(placeGpxTrack(drive(northbound(0, 8000)), routeOf([at(0)]))).toEqual(
      {
        data: [],
        message: 'This route needs at least two signals to place a drive.',
      }
    )
  })

  it('keeps one point either side of the chart time so the line reaches the edges', () => {
    const shortChart = {
      ...route,
      startMs: START_MS + 10_500,
      endMs: START_MS + 20_500,
    }
    const { data } = placeGpxTrack(
      drive(northbound(0, 1200), START_MS),
      shortChart
    )

    expect(
      data.map(([timestampMs]) => (timestampMs - START_MS) / 1000)
    ).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21])
  })

  it('explains a drive recorded outside the chart time', () => {
    const { data, message } = placeGpxTrack(
      drive(northbound(0, 8000), START_MS + 6 * 60 * 60_000),
      route
    )

    expect(data).toEqual([])
    expect(message).toMatch(
      /^This drive was recorded .+, outside the chart's time \(.+\)\.$/
    )
  })

  it('matches a drive from another day by its time of day on the 50th percentile chart', () => {
    const typicalDay = { ...route, matchTimeOfDay: true }
    const monthLater = addDays(START_MS + 60_000, 30).getTime()
    const { data, message } = placeGpxTrack(
      drive(northbound(0, 8000), monthLater),
      typicalDay
    )

    expect(message).toBeNull()
    expect(data[0][0]).toBe(START_MS + 60_000)
    expect(positionAt(data, 100)).toBeCloseTo(1000)
  })

  it('explains a drive at another time of day on the 50th percentile chart', () => {
    const typicalDay = { ...route, matchTimeOfDay: true }
    const { data, message } = placeGpxTrack(
      drive(northbound(0, 8000), START_MS + 6 * 60 * 60_000),
      typicalDay
    )

    expect(data).toEqual([])
    expect(message).toMatch(
      /^This drive was recorded .+, outside the chart's time of day\.$/
    )
  })

  it('explains a drive on another road', () => {
    const { data, message } = placeGpxTrack(
      drive(northbound(0, 8000).map(([north]) => [north, 1000])),
      route
    )

    expect(data).toEqual([])
    expect(message).toBe(
      "No part of this drive during the chart's time follows this route."
    )
  })
})

describe("placing a drive from Start when the route's ends have no map positions", () => {
  it('offers Start and End only when the first or last signal has no map position', () => {
    expect(getStartEndLocations(undefined)).toEqual([])
    expect(getStartEndLocations(route)).toEqual([])
    expect(getStartEndLocations(missingMiddle)).toEqual([])
    expect(getStartEndLocations(routeOf([at(0)]))).toEqual([])
    expect(getStartEndLocations(unmapped)).toEqual(['7000', '7001', '7002'])
  })

  it('places each point by distance driven from Start, holding still through a stop', () => {
    // Drives east, so only the distance driven can place it.
    const points = drive([
      ...northbound(0, 2000).map(([east]): [number, number] => [0, east]),
      ...stoppedAt(0, 2000, 30),
      ...northbound(2040, 8400).map(([east]): [number, number] => [0, east]),
    ])
    const { data, message } = placeGpxTrack(points, unmapped)
    const stopPositions = data
      .slice(50, 81)
      .map(([, position]) => position as number)

    expect(message).toBeNull()
    expect(positionAt(data, 0)).toBe(0)
    expect(new Set(stopPositions).size).toBe(1)
    expect(stopPositions[0]).toBeCloseTo(500, 0) // 2000 feet driven
    expect(positionAt(data, 130)).toBeCloseTo(1000, 0) // 4000 feet driven
    expect(positionAt(data, 233)).toBeGreaterThan(2000) // just past End
    expect(data[240][1]).toBeNull() // too far past End
  })

  it('keeps moving at a crawl', () => {
    const crawl = northbound(0, 4000, 10).map(([east]): [number, number] => [
      0,
      east,
    ])
    const { data } = placeGpxTrack(drive(crawl), unmapped)

    // Within the 25 feet a stopped position may wander, a quarter unit a foot.
    expect(positionAt(data, 400)).toBeGreaterThan(1000 - 25 / 4)
  })

  it('runs toward End when End comes before Start on the route', () => {
    const { data } = placeGpxTrack(drive(northbound(0, 8000)), unmapped, {
      startLocation: '7002',
      endLocation: '7000',
    })

    expect(positionAt(data, 0)).toBe(2000)
    expect(positionAt(data, 100)).toBeCloseTo(1000)
    expect(positionAt(data, 200)).toBeCloseTo(0)
  })

  it('asks for different signals when Start and End are the same', () => {
    expect(
      placeGpxTrack(drive(northbound(0, 8000)), unmapped, {
        startLocation: '7001',
        endLocation: '7001',
      })
    ).toEqual({
      data: [],
      message:
        'Choose "Start" and "End" signals at different points on the route.',
    })
  })

  it('explains a drive that is past End before the chart starts', () => {
    const { message } = placeGpxTrack(
      drive(northbound(0, 12000), START_MS - 210_000),
      unmapped
    )

    expect(message).toBe(
      "This drive passes the End signal before the chart's time starts."
    )
  })

  it('uses the first and last signal until others are picked or when a pick is not on the route', () => {
    const locations = ['7000', '7001', '7002']

    expect(resolveStartEnd(locations, {})).toEqual({
      start: '7000',
      end: '7002',
    })
    expect(
      resolveStartEnd(locations, { startLocation: '7001', endLocation: '9999' })
    ).toEqual({ start: '7001', end: '7002' })
  })
})

describe('placeGpxTracks', () => {
  it('places only rows that loaded a file, and nothing before the chart is ready', () => {
    const entries = [
      { id: 'loaded', parsedData: drive(northbound(0, 8000)) },
      { id: 'empty' },
      { id: 'failed', error: 'Invalid GPX file' },
    ]

    expect(placeGpxTracks(entries, undefined)).toEqual([])
    expect(placeGpxTracks(entries, route).map((track) => track.id)).toEqual([
      'loaded',
    ])
  })

  it("passes each row's Start and End to the placement", () => {
    const [track] = placeGpxTracks(
      [
        {
          id: 'reversed',
          parsedData: drive(northbound(0, 8000)),
          startLocation: '7002',
          endLocation: '7000',
        },
      ],
      unmapped
    )

    expect(positionAt(track.data, 0)).toBe(2000)
  })
})
