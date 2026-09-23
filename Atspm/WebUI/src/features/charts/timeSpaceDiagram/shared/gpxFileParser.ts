// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - gpxFileParser.ts
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
export type GpxPoint = {
  time: string
  distance: number
}

/**
 * Rejects rather than resolving empty, so the row that called it can tell the
 * user why nothing was drawn. DOMParser never throws: handed something that
 * is not XML it returns a document whose root is <parsererror>, and handed
 * XML that is not GPX it returns a perfectly good document with no track
 * points in it. Both used to come back as an empty list, which the caller
 * could not tell from a successful parse.
 */
export const parseGpxFile = async (file: File): Promise<GpxPoint[]> => {
  const text = await file.text()
  const xml = new DOMParser().parseFromString(text, 'application/xml')

  if (xml.getElementsByTagName('parsererror').length > 0) {
    throw new Error('Invalid GPX file')
  }

  const trkpts = Array.from(xml.getElementsByTagName('trkpt'))

  let lastLat: number | null = null
  let lastLon: number | null = null
  let totalDistance = 0

  const startTime = trkpts[0]?.getElementsByTagName('time')[0]?.textContent

  // A track point without a time cannot be placed on the x axis, so a file
  // whose first point has none carries nothing this chart can use.
  if (!startTime) {
    throw new Error('No track points found in this GPX file')
  }

  const points: GpxPoint[] = []
  for (const pt of trkpts) {
    const lat = Number(pt.getAttribute('lat'))
    const lon = Number(pt.getAttribute('lon'))
    const timeStr = pt.getElementsByTagName('time')[0]?.textContent
    if (!timeStr) continue

    const filtered = timeStr?.replace(/Z$/, '')
    // const t = new Date(timeStr).getTime()

    if (lastLat != null && lastLon != null) {
      totalDistance += haversine(lastLat, lastLon, lat, lon)
    }

    points.push({
      time: filtered,
      distance: totalDistance,
    })

    lastLat = lat
    lastLon = lon
  }
  return points.slice(0, 500)
}

const haversine = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180

  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2

  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
