// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - fetchRouteDistance.test.ts
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
import type { RouteLocationDto } from '@/api/config'
import axios from 'axios'
import { fetchRouteDistance } from './fetchRouteDistance'

jest.mock('axios')

const buildLocations = (): RouteLocationDto[] =>
  [
    { latitude: 40.1, longitude: -111.1 },
    { latitude: 40.2, longitude: -111.2 },
  ] as unknown as RouteLocationDto[]

describe('fetchRouteDistance', () => {
  afterEach(() => {
    jest.resetAllMocks()
    jest.spyOn(console, 'warn').mockRestore()
    jest.spyOn(console, 'error').mockRestore()
  })

  it('uses the match service result when it succeeds, converting meters to feet', async () => {
    ;(axios.get as jest.Mock).mockResolvedValue({
      data: {
        matchings: [
          {
            distance: 1000,
            geometry: {
              coordinates: [
                [-111.1, 40.1],
                [-111.2, 40.2],
              ],
            },
          },
        ],
      },
    })

    const result = await fetchRouteDistance(buildLocations())

    expect(axios.get).toHaveBeenCalledTimes(1)
    expect(axios.get).toHaveBeenCalledWith(
      expect.stringContaining('/match/v1/driving/')
    )
    expect(result.distance).toBeCloseTo(3280.84, 1)
  })

  it('flips coordinates from [lng, lat] to [lat, lng] for Leaflet', async () => {
    ;(axios.get as jest.Mock).mockResolvedValue({
      data: {
        matchings: [
          {
            distance: 100,
            geometry: { coordinates: [[-111.5, 40.5]] },
          },
        ],
      },
    })

    const result = await fetchRouteDistance(buildLocations())

    expect(result.shape).toEqual([[40.5, -111.5]])
  })

  it('falls back to the route service when the match service fails', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    ;(axios.get as jest.Mock)
      .mockRejectedValueOnce(new Error('match failed'))
      .mockResolvedValueOnce({
        data: {
          routes: [
            {
              distance: 500,
              geometry: { coordinates: [[-111.3, 40.3]] },
            },
          ],
        },
      })

    const result = await fetchRouteDistance(buildLocations())

    expect(axios.get).toHaveBeenCalledTimes(2)
    expect(axios.get).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('/route/v1/driving/')
    )
    expect(result.shape).toEqual([[40.3, -111.3]])
  })

  it('throws when both the match and route services fail', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
    const routeError = new Error('route failed')
    ;(axios.get as jest.Mock)
      .mockRejectedValueOnce(new Error('match failed'))
      .mockRejectedValueOnce(routeError)

    await expect(fetchRouteDistance(buildLocations())).rejects.toBe(
      routeError
    )
  })

  it('builds the coordinate string as "lng,lat;lng,lat" and honors the profile override', async () => {
    ;(axios.get as jest.Mock).mockResolvedValue({
      data: { matchings: [{ distance: 0, geometry: { coordinates: [] } }] },
    })

    await fetchRouteDistance(buildLocations(), 'walking')

    expect(axios.get).toHaveBeenCalledWith(
      expect.stringContaining(
        '/match/v1/walking/-111.1,40.1;-111.2,40.2?overview=full&geometries=geojson'
      )
    )
  })
})
