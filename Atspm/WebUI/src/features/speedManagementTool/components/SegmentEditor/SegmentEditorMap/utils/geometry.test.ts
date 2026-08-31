// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - geometry.test.ts
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
import type { Feature } from '@/features/speedManagementTool/components/SegmentEditor/SegmentEditorMap/hooks/useMapClickHandler'
import { getPolylineCoordinates, snapToRoute } from './geometry'

describe('getPolylineCoordinates', () => {
  it('returns the coordinates of a LineString as-is', () => {
    const geometry: GeoJSON.LineString = {
      type: 'LineString',
      coordinates: [
        [0, 0],
        [1, 1],
      ],
    }

    expect(getPolylineCoordinates(geometry)).toEqual([
      [0, 0],
      [1, 1],
    ])
  })

  it('flattens a MultiLineString into a single coordinate list', () => {
    const geometry: GeoJSON.MultiLineString = {
      type: 'MultiLineString',
      coordinates: [
        [
          [0, 0],
          [0, 1],
        ],
        [
          [0, 1],
          [0, 2],
        ],
      ],
    }

    expect(getPolylineCoordinates(geometry)).toEqual([
      [0, 0],
      [0, 1],
      [0, 1],
      [0, 2],
    ])
  })
})

describe('snapToRoute', () => {
  const feature = {
    geometry: {
      coordinates: [
        [0, 0],
        [0, 10],
      ],
    },
  } as unknown as Feature

  it('returns the same point when clicking exactly on the route', () => {
    const [lng, lat] = snapToRoute(feature, [0, 5])
    expect(lng).toBeCloseTo(0, 5)
    expect(lat).toBeCloseTo(5, 5)
  })

  it('snaps a point off the route to the nearest point on the line', () => {
    const [lng, lat] = snapToRoute(feature, [1, 5])
    expect(lng).toBeCloseTo(0, 2)
    expect(lat).toBeCloseTo(5, 1)
  })
})
