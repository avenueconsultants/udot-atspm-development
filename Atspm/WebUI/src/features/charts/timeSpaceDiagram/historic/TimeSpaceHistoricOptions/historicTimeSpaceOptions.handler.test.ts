// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - historicTimeSpaceOptions.handler.test.ts
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
import type { Route } from '@/features/routes/types'
import { act, renderHook } from '@testing-library/react'
import type { ReadonlyURLSearchParams } from 'next/navigation'
import {
  inferHistoricLocationIdentifier,
  useHistoricOptionsHandler,
} from './historicTimeSpaceOptions.handler'

function buildRoute(
  id: number,
  routeLocations: Route['routeLocations']
): Route {
  return {
    id,
    name: `Route ${id}`,
    routeLocations,
  }
}

describe('inferHistoricLocationIdentifier', () => {
  const routes: Route[] = [
    buildRoute(17, [
      {
        approaches: [],
        locationIdentifier: '3003',
        order: 3,
        primaryPhase: '2',
        opposingPhase: '6',
        primaryDirectionId: '1',
        opposingDirectionId: '2',
        primaryDirectionDescription: 'Eastbound',
        opposingDirectionDescription: 'Westbound',
        isPrimaryOverlap: false,
        isOpposingOverlap: false,
        previousLocationDistanceId: null,
        nextLocationDistanceId: null,
        routeId: 17,
      },
      {
        approaches: [],
        locationIdentifier: '1001',
        order: 1,
        primaryPhase: '2',
        opposingPhase: '6',
        primaryDirectionId: '1',
        opposingDirectionId: '2',
        primaryDirectionDescription: 'Eastbound',
        opposingDirectionDescription: 'Westbound',
        isPrimaryOverlap: false,
        isOpposingOverlap: false,
        previousLocationDistanceId: null,
        nextLocationDistanceId: null,
        routeId: 17,
      },
      {
        approaches: [],
        locationIdentifier: '2002',
        order: 2,
        primaryPhase: '2',
        opposingPhase: '6',
        primaryDirectionId: '1',
        opposingDirectionId: '2',
        primaryDirectionDescription: 'Eastbound',
        opposingDirectionDescription: 'Westbound',
        isPrimaryOverlap: false,
        isOpposingOverlap: false,
        previousLocationDistanceId: null,
        nextLocationDistanceId: null,
        routeId: 17,
      },
    ]),
  ]

  it('falls back to the first route location by order', () => {
    expect(inferHistoricLocationIdentifier(routes, '17', '')).toBe('1001')
  })

  it('preserves an explicit location when it belongs to the route', () => {
    expect(inferHistoricLocationIdentifier(routes, '17', '2002')).toBe('2002')
  })

  it('replaces stale explicit locations with the selected route default', () => {
    expect(inferHistoricLocationIdentifier(routes, '17', '9999')).toBe('1001')
  })
})

describe('useHistoricOptionsHandler shared links', () => {
  const applyLink = (query: string) => {
    const { result } = renderHook(() =>
      useHistoricOptionsHandler({ routes: [] })
    )
    act(() => {
      result.current.applyFromSearchParams(
        new URLSearchParams(query) as unknown as ReadonlyURLSearchParams
      )
    })
    return result
  }

  it('writes signal clock times with no time zone', () => {
    const { result } = renderHook(() =>
      useHistoricOptionsHandler({ routes: [] })
    )
    act(() => {
      result.current.changeStartDate(new Date(2026, 3, 15, 16, 0, 0))
      result.current.changeEndDate(new Date(2026, 3, 15, 16, 20, 0))
    })

    const params = result.current.toSearchParams()

    expect(params.get('start')).toBe('2026-04-15T16:00:00')
    expect(params.get('end')).toBe('2026-04-15T16:20:00')
  })

  it('opens a link on the clock times it names', () => {
    const result = applyLink(
      'toolType=TimeSpaceHistoric&routeId=98&start=2026-04-15T16:00:00&end=2026-04-15T16:20:00'
    )

    expect(result.current.startDateTime).toEqual(
      new Date(2026, 3, 15, 16, 0, 0)
    )
    expect(result.current.endDateTime).toEqual(new Date(2026, 3, 15, 16, 20, 0))
  })

  it('still reads older links that end in Z as that moment', () => {
    const result = applyLink(
      'toolType=TimeSpaceHistoric&routeId=98&start=2026-04-15T22:00:00.000Z&end=2026-04-15T22:20:00.000Z'
    )

    expect(result.current.startDateTime.toISOString()).toBe(
      '2026-04-15T22:00:00.000Z'
    )
    expect(result.current.endDateTime.toISOString()).toBe(
      '2026-04-15T22:20:00.000Z'
    )
  })
})
