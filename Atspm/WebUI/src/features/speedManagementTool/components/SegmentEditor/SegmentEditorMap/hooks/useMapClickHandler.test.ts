// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - useMapClickHandler.test.ts
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
import { useSegmentEditorStore } from '@/features/speedManagementTool/components/SegmentEditor/segmentEditorStore'
import { act, renderHook } from '@testing-library/react'
import type { Feature } from './useMapClickHandler'
import { useMapClickHandler } from './useMapClickHandler'

// A straight vertical line lets nearestPointOnLine/lineSlice behave
// predictably: clicking at [0, y] snaps to (approximately) that same point.
const buildFeature = (routeDirection: 'P' | 'N'): Feature => ({
  geometry: {
    coordinates: [
      [0, 0],
      [0, 10],
    ],
  },
  properties: {
    BEG_MILEAGE: 0,
    END_MILEAGE: 100,
    ROUTE_ID: 'R1',
    ROUTE_DIRECTION: routeDirection,
    ROUTE_DESC: 'Test Route',
    ROUTE_ALIAS_COMMON: 'TR-1',
  },
})

// mapRef=null short-circuits the hook's map-event-wiring effect, so these
// tests can exercise handleRouteClick's branching without a real Leaflet map
// or a ResizeObserver polyfill.
const setupHandler = (calculateMilePoint: jest.Mock) => {
  const setSegmentRouteId = jest.fn()
  const { result } = renderHook(() =>
    useMapClickHandler(
      null,
      null,
      setSegmentRouteId,
      jest.fn(),
      jest.fn(),
      jest.fn(),
      calculateMilePoint,
      jest.fn(),
      false
    )
  )
  return { result, setSegmentRouteId }
}

describe('useMapClickHandler handleRouteClick', () => {
  beforeEach(() => {
    act(() => {
      useSegmentEditorStore.getState().reset()
    })
  })

  it('starts a new segment on the first click, recording start mile point and polarity', async () => {
    const calculateMilePoint = jest.fn().mockResolvedValue(25)
    const { result, setSegmentRouteId } = setupHandler(calculateMilePoint)

    await act(async () => {
      await result.current.handleRouteClick(buildFeature('P'), [0, 2.5])
    })

    expect(setSegmentRouteId).toHaveBeenCalledWith('R1')
    const state = useSegmentEditorStore.getState()
    expect(state.polylineCoordinates).toHaveLength(1)
    expect(state.segmentProperties.startMilePoint).toBe(25)
    expect(state.segmentProperties.polarity).toBe('PM')
  })

  it('sets an "NM" polarity when starting a segment on an "N" direction route', async () => {
    const calculateMilePoint = jest.fn().mockResolvedValue(25)
    const { result } = setupHandler(calculateMilePoint)

    await act(async () => {
      await result.current.handleRouteClick(buildFeature('N'), [0, 2.5])
    })

    expect(useSegmentEditorStore.getState().segmentProperties.polarity).toBe(
      'NM'
    )
  })

  it('appends to the line and sets the end mile point on a "P" route when mileage increases', async () => {
    act(() => {
      useSegmentEditorStore.getState().setPolylineCoordinates([[0, 2]])
      useSegmentEditorStore.getState().updateSegmentProperties({
        startMilePoint: 20,
      })
    })
    const calculateMilePoint = jest.fn().mockResolvedValue(60)
    const { result } = setupHandler(calculateMilePoint)

    await act(async () => {
      await result.current.handleRouteClick(buildFeature('P'), [0, 6])
    })

    const state = useSegmentEditorStore.getState()
    expect(state.polylineCoordinates.length).toBeGreaterThan(1)
    expect(state.polylineCoordinates.at(-1)?.[1]).toBeCloseTo(6, 1)
    expect(state.segmentProperties.endMilePoint).toBe(60)
    expect(state.segmentProperties.startMilePoint).toBe(20)
  })

  it('prepends to the line and moves the start mile point on a "P" route when mileage decreases', async () => {
    act(() => {
      useSegmentEditorStore.getState().setPolylineCoordinates([[0, 6]])
      useSegmentEditorStore.getState().updateSegmentProperties({
        startMilePoint: 60,
      })
    })
    const calculateMilePoint = jest.fn().mockResolvedValue(20)
    const { result } = setupHandler(calculateMilePoint)

    await act(async () => {
      await result.current.handleRouteClick(buildFeature('P'), [0, 2])
    })

    const state = useSegmentEditorStore.getState()
    expect(state.polylineCoordinates.length).toBeGreaterThan(1)
    expect(state.polylineCoordinates[0][1]).toBeCloseTo(2, 1)
    expect(state.segmentProperties.startMilePoint).toBe(20)
    // Second click on a 2-point segment: the mile point being replaced as
    // "start" becomes the new "end".
    expect(state.segmentProperties.endMilePoint).toBe(60)
  })

  it('does nothing when the click lands exactly on the current start mile point', async () => {
    act(() => {
      useSegmentEditorStore.getState().setPolylineCoordinates([[0, 5]])
      useSegmentEditorStore.getState().updateSegmentProperties({
        startMilePoint: 50,
      })
    })
    const calculateMilePoint = jest.fn().mockResolvedValue(50)
    const { result } = setupHandler(calculateMilePoint)

    await act(async () => {
      await result.current.handleRouteClick(buildFeature('P'), [0, 5])
    })

    const state = useSegmentEditorStore.getState()
    expect(state.polylineCoordinates).toHaveLength(1)
    expect(state.segmentProperties.endMilePoint).toBeNull()
  })

  it('appends to the line and sets the end mile point on an "N" route when mileage decreases', async () => {
    act(() => {
      useSegmentEditorStore.getState().setPolylineCoordinates([[0, 6]])
      useSegmentEditorStore.getState().updateSegmentProperties({
        startMilePoint: 60,
      })
    })
    const calculateMilePoint = jest.fn().mockResolvedValue(20)
    const { result } = setupHandler(calculateMilePoint)

    await act(async () => {
      await result.current.handleRouteClick(buildFeature('N'), [0, 2])
    })

    const state = useSegmentEditorStore.getState()
    expect(state.polylineCoordinates.length).toBeGreaterThan(1)
    expect(state.segmentProperties.endMilePoint).toBe(20)
    expect(state.segmentProperties.startMilePoint).toBe(60)
  })

  it('prepends to the line and moves the start mile point on an "N" route when mileage increases', async () => {
    act(() => {
      useSegmentEditorStore.getState().setPolylineCoordinates([[0, 2]])
      useSegmentEditorStore.getState().updateSegmentProperties({
        startMilePoint: 20,
      })
    })
    const calculateMilePoint = jest.fn().mockResolvedValue(60)
    const { result } = setupHandler(calculateMilePoint)

    await act(async () => {
      await result.current.handleRouteClick(buildFeature('N'), [0, 6])
    })

    const state = useSegmentEditorStore.getState()
    expect(state.polylineCoordinates.length).toBeGreaterThan(1)
    expect(state.segmentProperties.startMilePoint).toBe(60)
    expect(state.segmentProperties.endMilePoint).toBe(20)
  })

  it('does not update the segment when the mile point cannot be calculated', async () => {
    const calculateMilePoint = jest.fn().mockResolvedValue(null)
    const { result, setSegmentRouteId } = setupHandler(calculateMilePoint)

    await act(async () => {
      await result.current.handleRouteClick(buildFeature('P'), [0, 2.5])
    })

    expect(setSegmentRouteId).not.toHaveBeenCalled()
    expect(useSegmentEditorStore.getState().polylineCoordinates).toHaveLength(
      0
    )
  })
})
