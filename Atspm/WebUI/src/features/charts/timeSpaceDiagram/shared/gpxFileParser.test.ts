// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - gpxFileParser.test.ts
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
import { type GpxPoint, parseGpxFile } from './gpxFileParser'

const asFile = (contents: string) =>
  ({ text: async () => contents }) as unknown as File

const gpx = (trkpts: string) => `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="test">
  <trk><trkseg>${trkpts}</trkseg></trk>
</gpx>`

const trkpt = (lat: number, lon: number, time?: string) =>
  `<trkpt lat="${lat}" lon="${lon}">${time ? `<time>${time}</time>` : ''}</trkpt>`

// The chart reads the signals' clock as if it were the viewer's.
const onChartClock = (point: GpxPoint) => {
  const at = new Date(point.timestampMs)
  return `${at.getMonth() + 1}/${at.getDate()} ${at.getHours()}:${String(at.getMinutes()).padStart(2, '0')}`
}

// A file needs two points; the second is the same as the first.
const firstPoint = async (lat: number, lon: number, time: string) =>
  (await parseGpxFile(asFile(gpx(trkpt(lat, lon, time).repeat(2)))))[0]

describe('parseGpxFile', () => {
  // These hold in whatever time zone the tests run, as they must for a viewer
  // away from the signals' time zone.
  it('puts a universal time on the clock where the drive was recorded', async () => {
    const point = await firstPoint(40.76, -111.891, '2026-10-20T22:40:00Z')

    // 22:40 universal time is 4:40 PM in Utah.
    expect(onChartClock(point)).toBe('10/20 16:40')
    expect(point).toMatchObject({ latitude: 40.76, longitude: -111.891 })
  })

  it('finds the time zone from where the drive was recorded', async () => {
    const point = await firstPoint(40.71, -74.0, '2026-10-20T20:40:00Z')

    expect(onChartClock(point)).toBe('10/20 16:40')
  })

  it('honors an offset the file states', async () => {
    const point = await firstPoint(40.76, -111.891, '2026-10-20T15:40:00-07:00')

    expect(onChartClock(point)).toBe('10/20 16:40')
  })

  it('reads a time without a zone as the clock where the drive was recorded', async () => {
    const point = await firstPoint(40.76, -111.891, '2026-10-20T16:40:00')

    expect(onChartClock(point)).toBe('10/20 16:40')
  })

  it('finds the time zone past a 0, 0 point written before the satellites were found', async () => {
    const points = await parseGpxFile(
      asFile(
        gpx(
          trkpt(0, 0, '2026-10-20T22:39:00Z') +
            trkpt(40.76, -111.891, '2026-10-20T22:40:00Z') +
            trkpt(40.77, -111.891, '2026-10-20T22:41:00Z')
        )
      )
    )

    expect(points.map((p) => p.latitude)).toEqual([40.76, 40.77])
    expect(onChartClock(points[0])).toBe('10/20 16:40')
  })

  it('keeps the hour that repeats when daylight saving ends in order', async () => {
    // Utah's clocks go back from 2:00 to 1:00 at 08:00 universal time.
    const points = await parseGpxFile(
      asFile(
        gpx(
          trkpt(40.761, -111.891, '2026-11-01T07:30:00Z') +
            trkpt(40.763, -111.891, '2026-11-01T08:15:00Z') +
            trkpt(40.762, -111.891, '2026-11-01T07:45:00Z')
        )
      )
    )

    expect(points.map((p) => p.latitude)).toEqual([40.761, 40.762, 40.763])
    expect(points.map(onChartClock)).toEqual([
      '11/1 1:30',
      '11/1 1:45',
      '11/1 1:15',
    ])
  })

  it('keeps every point of a long drive', async () => {
    const many = Array.from({ length: 1200 }, (_, i) =>
      trkpt(
        40.76 + i / 10000,
        -111.891,
        new Date(Date.UTC(2026, 9, 20, 22, 40, i)).toISOString()
      )
    ).join('')

    await expect(parseGpxFile(asFile(gpx(many)))).resolves.toHaveLength(1200)
  })

  it('skips a track point without a time or a real position', async () => {
    const points = await parseGpxFile(
      asFile(
        gpx(
          trkpt(40.76, -111.891, '2026-10-20T22:40:00Z') +
            trkpt(40.77, -111.891) +
            '<trkpt lon="-111.891"><time>2026-10-20T22:40:30Z</time></trkpt>' +
            trkpt(95, -111.891, '2026-10-20T22:40:45Z') +
            trkpt(40.78, -111.891, '2026-10-20T22:41:00Z')
        )
      )
    )

    expect(points.map((p) => p.latitude)).toEqual([40.76, 40.78])
  })

  it('orders points by time', async () => {
    const points = await parseGpxFile(
      asFile(
        gpx(
          trkpt(40.78, -111.891, '2026-10-20T22:41:00Z') +
            trkpt(40.76, -111.891, '2026-10-20T22:40:00Z')
        )
      )
    )

    expect(points.map((p) => p.latitude)).toEqual([40.76, 40.78])
  })

  it('keeps the points read before a file was cut off', async () => {
    // What Chrome hands back for a recording cut off mid-write: the points it
    // read before the break, plus an error element.
    const cutOff = `<gpx version="1.1" creator="test">
  <parsererror>XML Parsing Error: no root element found</parsererror>
  <trk><trkseg>${trkpt(40.76, -111.891, '2026-10-20T22:40:00Z')}${trkpt(40.77, -111.891, '2026-10-20T22:41:00Z')}</trkseg></trk>
</gpx>`

    await expect(parseGpxFile(asFile(cutOff))).resolves.toHaveLength(2)
  })

  it('rejects a file with only one track point', async () => {
    await expect(
      parseGpxFile(asFile(gpx(trkpt(40.76, -111.891, '2026-10-20T22:40:00Z'))))
    ).rejects.toThrow('This GPX file needs at least two track points')
  })

  it('rejects a file that is not XML at all', async () => {
    // DOMParser does not throw here - it hands back a <parsererror> document.
    await expect(parseGpxFile(asFile('not a gpx file'))).rejects.toThrow(
      'Invalid GPX file'
    )
  })

  it('rejects well-formed XML that carries no usable track points', async () => {
    await expect(parseGpxFile(asFile(gpx('')))).rejects.toThrow(
      'No track points found in this GPX file'
    )
    await expect(
      parseGpxFile(asFile(gpx(trkpt(40.76, -111.891))))
    ).rejects.toThrow('No track points found in this GPX file')
  })
})
