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
import { parseGpxFile } from './gpxFileParser'

const asFile = (contents: string) =>
  ({ text: async () => contents }) as unknown as File

const gpx = (trkpts: string) => `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="test">
  <trk><trkseg>${trkpts}</trkseg></trk>
</gpx>`

const trkpt = (lat: number, lon: number, time?: string) =>
  `<trkpt lat="${lat}" lon="${lon}">${time ? `<time>${time}</time>` : ''}</trkpt>`

describe('parseGpxFile', () => {
  it('accumulates distance along the track and drops the trailing Z', async () => {
    const points = await parseGpxFile(
      asFile(
        gpx(
          trkpt(40.76, -111.891, '2026-03-14T16:04:00Z') +
            trkpt(40.77, -111.891, '2026-03-14T16:05:00Z')
        )
      )
    )

    expect(points).toHaveLength(2)
    expect(points[0]).toEqual({ time: '2026-03-14T16:04:00', distance: 0 })
    // A hundredth of a degree of latitude is a bit over a kilometre; the
    // exact figure is the haversine, so this only pins the magnitude.
    expect(points[1].time).toBe('2026-03-14T16:05:00')
    expect(points[1].distance).toBeGreaterThan(1000)
    expect(points[1].distance).toBeLessThan(1200)
  })

  it('skips a track point that carries no time', async () => {
    const points = await parseGpxFile(
      asFile(
        gpx(
          trkpt(40.76, -111.891, '2026-03-14T16:04:00Z') +
            trkpt(40.77, -111.891) +
            trkpt(40.78, -111.891, '2026-03-14T16:06:00Z')
        )
      )
    )

    expect(points.map((p) => p.time)).toEqual([
      '2026-03-14T16:04:00',
      '2026-03-14T16:06:00',
    ])
  })

  it('rejects a file that is not XML at all', async () => {
    // DOMParser does not throw here - it hands back a <parsererror> document,
    // which used to read as a GPX with no points in it.
    await expect(parseGpxFile(asFile('not a gpx file'))).rejects.toThrow(
      'Invalid GPX file'
    )
  })

  it('rejects well-formed XML that carries no track points', async () => {
    await expect(parseGpxFile(asFile(gpx('')))).rejects.toThrow(
      'No track points found in this GPX file'
    )
  })

  it('rejects a track whose first point has no time', async () => {
    await expect(
      parseGpxFile(asFile(gpx(trkpt(40.76, -111.891))))
    ).rejects.toThrow('No track points found in this GPX file')
  })

  it('caps a very long track at 500 points', async () => {
    const many = Array.from({ length: 600 }, (_, i) =>
      trkpt(40.76 + i / 10000, -111.891, '2026-03-14T16:04:00Z')
    ).join('')

    await expect(parseGpxFile(asFile(gpx(many)))).resolves.toHaveLength(500)
  })
})
