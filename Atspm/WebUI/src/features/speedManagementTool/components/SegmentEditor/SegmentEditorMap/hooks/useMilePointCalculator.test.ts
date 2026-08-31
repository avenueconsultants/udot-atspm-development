// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - useMilePointCalculator.test.ts
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
import { renderHook } from '@testing-library/react'
import { useMilePointCalculator } from './useMilePointCalculator'

const buildFeature = (routeDirection: 'P' | 'N') => ({
  geometry: {
    type: 'LineString' as const,
    coordinates: [
      [0, 0],
      [0, 10],
    ] as [number, number][],
  },
  properties: {
    ROUTE_DIRECTION: routeDirection,
    BEG_MILEAGE: 0,
    END_MILEAGE: 100,
  },
})

describe('useMilePointCalculator', () => {
  it('interpolates increasing mileage along a "P" direction route', () => {
    const { result } = renderHook(() => useMilePointCalculator())
    const feature = buildFeature('P')

    expect(
      result.current.calculateMilePoint(feature, 0, 5)
    ).toBeCloseTo(50, 5)
    expect(
      result.current.calculateMilePoint(feature, 0, 2)
    ).toBeCloseTo(20, 5)
  })

  it('interpolates decreasing mileage along an "N" direction route', () => {
    const { result } = renderHook(() => useMilePointCalculator())
    const feature = buildFeature('N')

    expect(
      result.current.calculateMilePoint(feature, 0, 2)
    ).toBeCloseTo(80, 5)
    expect(
      result.current.calculateMilePoint(feature, 0, 8)
    ).toBeCloseTo(20, 5)
  })

  it('snaps an off-route click to the nearest point before interpolating', () => {
    const { result } = renderHook(() => useMilePointCalculator())
    const feature = buildFeature('P')

    // Clicking well off to the side of the line should still resolve to
    // roughly the mile point of the nearest point on the line (~midpoint).
    expect(
      result.current.calculateMilePoint(feature, 5, 5)
    ).toBeCloseTo(50, 0)
  })
})
