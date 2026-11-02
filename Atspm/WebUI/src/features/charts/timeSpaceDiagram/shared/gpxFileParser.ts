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
  // On the chart's clock: local time where the drive starts, read as if it
  // were the viewer's, the same way the chart reads its signals' times.
  timestampMs: number
  latitude: number
  longitude: number
}

type RecordedPoint = {
  time: string
  // The exact moment for a time that states its zone, otherwise the clock
  // time read as the viewer's.
  moment: number
  latitude: number
  longitude: number
}

// A trailing Z or offset (-06:00) marks an exact moment rather than a clock time.
const STATES_TIME_ZONE = /(?:Z|[+-]\d{2}:?\d{2})$/i

/**
 * Reads every timed track point. Placing the points on the route happens
 * later, against the chart's signals.
 *
 * Rejects rather than resolving empty, so the row that called it can tell the
 * user why nothing was drawn. DOMParser never throws on a broken file: Chrome
 * hands back what it read before the break plus a <parsererror> element, so a
 * recording cut off mid-write still draws; Firefox hands back only the error.
 */
export const parseGpxFile = async (file: File): Promise<GpxPoint[]> => {
  const text = await file.text()
  const xml = new DOMParser().parseFromString(text, 'application/xml')

  const recorded: RecordedPoint[] = []
  for (const trkpt of Array.from(xml.getElementsByTagName('trkpt'))) {
    const latitude = parseFloat(trkpt.getAttribute('lat') ?? '')
    const longitude = parseFloat(trkpt.getAttribute('lon') ?? '')
    const time = trkpt.getElementsByTagName('time')[0]?.textContent?.trim()
    const moment = time ? Date.parse(time) : NaN

    if (
      !time ||
      !Number.isFinite(moment) ||
      !(Math.abs(latitude) <= 90) ||
      !(Math.abs(longitude) <= 180) ||
      // Some recorders write 0, 0 until they find satellites.
      (latitude === 0 && longitude === 0)
    ) {
      continue
    }

    recorded.push({ time, moment, latitude, longitude })
  }

  if (recorded.length === 0) {
    throw new Error(
      xml.getElementsByTagName('parsererror').length > 0
        ? 'Invalid GPX file'
        : 'No track points found in this GPX file'
    )
  }
  if (recorded.length === 1) {
    throw new Error('This GPX file needs at least two track points')
  }

  // Ordered by the moment each point was recorded: when daylight saving ends
  // the clock repeats an hour, and ordering by the clock would interleave it.
  recorded.sort((a, b) => a.moment - b.moment)
  const toChartClock = await createChartClock(recorded[0])
  return recorded.map((point) => ({
    timestampMs: toChartClock(point),
    latitude: point.latitude,
    longitude: point.longitude,
  }))
}

/**
 * GPX times are usually universal time (a trailing Z). Those are moved onto
 * the clock of the place the drive starts, so someone viewing the chart from
 * another time zone sees the drive where the signals saw it. A time without a
 * zone is already that clock.
 */
const createChartClock = async ({ latitude, longitude }: RecordedPoint) => {
  const { default: findTimeZone } = await import('@photostructure/tz-lookup')
  const localClock = new Intl.DateTimeFormat('en-US', {
    timeZone: findTimeZone(latitude, longitude),
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  })

  return ({ time, moment }: RecordedPoint) => {
    if (!STATES_TIME_ZONE.test(time)) return moment

    const part = Object.fromEntries(
      localClock
        .formatToParts(moment)
        .map(({ type, value }) => [type, Number(value)])
    )
    return new Date(
      part.year,
      part.month - 1,
      part.day,
      part.hour,
      part.minute,
      part.second,
      new Date(moment).getUTCMilliseconds()
    ).getTime()
  }
}
