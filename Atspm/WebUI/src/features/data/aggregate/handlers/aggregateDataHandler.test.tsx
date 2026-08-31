// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - aggregateDataHandler.test.tsx
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

// The two generated hooks and the shared location/route handlers are stubbed
// so this suite is about how the aggregate request is assembled, not about
// fetching. useExpandLocationHandler is deliberately left real - the include
// tree it builds is part of the posted payload.
jest.mock('@/api/config', () => ({
  useGetLocationFromKey: jest.fn(() => ({
    data: undefined,
    status: 'pending',
  })),
  useGetRouteRouteViewFromId: jest.fn(() => ({
    data: undefined,
    status: 'pending',
  })),
}))
jest.mock('@/components/handlers/locationHandler', () => ({
  useLocationHandler: jest.fn(),
}))
jest.mock('@/components/handlers/routeHandler', () => ({
  useRouteHandler: jest.fn(),
}))
jest.mock('@/features/data/api/getAggregateData', () => ({
  usePostAggregateData: jest.fn(),
}))

import { useGetLocationFromKey, useGetRouteRouteViewFromId } from '@/api/config'
import { useLocationHandler } from '@/components/handlers/locationHandler'
import { useRouteHandler } from '@/components/handlers/routeHandler'
import { usePostAggregateData } from '@/features/data/api/getAggregateData'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useAggregateOptionsHandler } from './aggregateDataHandler'

const locationFromKey = useGetLocationFromKey as jest.Mock
const routeFromId = useGetRouteRouteViewFromId as jest.Mock
const locationHandler = useLocationHandler as jest.Mock
const routeHandler = useRouteHandler as jest.Mock
const postAggregate = usePostAggregateData as jest.Mock

const mutateAsync = jest.fn()
const changeLocation = jest.fn()

const approach = (id: number, description: string) => ({
  id,
  description,
  detectors: [
    {
      id: id * 10,
      dectectorIdentifier: `det-${id * 10}`,
      detectorChannel: 1,
      laneNumber: 1,
      laneType: 'Vehicle',
    },
  ],
})

// unwrapLocationFromKey is left real, so this mirrors the OData envelope the
// config API returns for a single location.
const locationEnvelope = (id: number, identifier: string) => ({
  id,
  locationIdentifier: identifier,
  primaryName: `${identifier} primary`,
  secondaryName: `${identifier} secondary`,
  latitude: 40.7,
  longitude: -111.9,
  approaches: [approach(1, 'SB Main St')],
})

beforeEach(() => {
  jest.clearAllMocks()
  mutateAsync.mockResolvedValue([{ locationIdentifier: '1001', value: 42 }])
  postAggregate.mockReturnValue({ mutateAsync })
  locationHandler.mockReturnValue({ location: null, changeLocation })
  routeHandler.mockReturnValue({ routeId: undefined })
  locationFromKey.mockReturnValue({ data: undefined, status: 'pending' })
  routeFromId.mockReturnValue({ data: undefined, status: 'pending' })
})

const postedPayload = () => mutateAsync.mock.calls[0][0]

describe('useAggregateOptionsHandler defaults', () => {
  it('starts on weekdays with every direction and movement selected', () => {
    const { result } = renderHook(() => useAggregateOptionsHandler())

    expect(result.current.selectedDays).toEqual([1, 2, 3, 4, 5])
    expect(result.current.selectedDirections).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
    expect(result.current.selectedMovements).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
    expect(result.current.aggregatedData).toEqual([])
  })

  it('does not fetch a location or route until one is chosen', () => {
    renderHook(() => useAggregateOptionsHandler())

    expect(locationFromKey.mock.calls[0][2]).toMatchObject({
      query: { enabled: false },
    })
    expect(routeFromId.mock.calls[0][2]).toMatchObject({
      query: { enabled: false },
    })
  })
})

describe('useAggregateOptionsHandler selection', () => {
  it('adds a fetched location to the selection', async () => {
    const { result, rerender } = renderHook(() => useAggregateOptionsHandler())

    locationHandler.mockReturnValue({ location: { id: 5 }, changeLocation })
    locationFromKey.mockReturnValue({
      data: locationEnvelope(5, '1001'),
      status: 'success',
    })
    rerender()

    await waitFor(() => expect(result.current.updatedLocations).toHaveLength(1))
    expect(result.current.updatedLocations[0].locationIdentifier).toBe('1001')
  })

  // The effect that appends a fetched location runs on every render while the
  // query stays successful, so without the identifier check the same location
  // would pile up each time.
  it('does not add the same location twice', async () => {
    const { result, rerender } = renderHook(() => useAggregateOptionsHandler())

    locationHandler.mockReturnValue({ location: { id: 5 }, changeLocation })
    locationFromKey.mockReturnValue({
      data: locationEnvelope(5, '1001'),
      status: 'success',
    })
    rerender()
    await waitFor(() => expect(result.current.updatedLocations).toHaveLength(1))

    rerender()
    rerender()

    expect(result.current.updatedLocations).toHaveLength(1)
  })

  it('pulls every location off a selected route', async () => {
    const { result, rerender } = renderHook(() => useAggregateOptionsHandler())

    routeHandler.mockReturnValue({ routeId: '7' })
    routeFromId.mockReturnValue({
      data: {
        routeLocations: [
          locationEnvelope(1, '1001'),
          locationEnvelope(2, '1002'),
        ],
      },
      status: 'success',
    })
    rerender()

    await waitFor(() => expect(result.current.updatedLocations).toHaveLength(2))
    expect(
      result.current.updatedLocations.map((l) => l.locationIdentifier)
    ).toEqual(['1001', '1002'])
  })

  it('treats a route with no locations as an empty selection', async () => {
    const { result, rerender } = renderHook(() => useAggregateOptionsHandler())

    routeHandler.mockReturnValue({ routeId: '7' })
    routeFromId.mockReturnValue({
      data: { routeLocations: null },
      status: 'success',
    })
    rerender()

    await waitFor(() => expect(result.current.updatedLocations).toEqual([]))
  })
})

describe('useAggregateOptionsHandler request assembly', () => {
  const runWithLocation = async () => {
    const view = renderHook(() => useAggregateOptionsHandler())

    locationHandler.mockReturnValue({ location: { id: 5 }, changeLocation })
    locationFromKey.mockReturnValue({
      data: locationEnvelope(5, '1001'),
      status: 'success',
    })
    view.rerender()
    await waitFor(() =>
      expect(view.result.current.updatedLocations).toHaveLength(1)
    )

    return view
  }

  it('posts the selected locations and the include tree', async () => {
    const { result } = await runWithLocation()

    await act(async () => {
      result.current.handleRunAnalysis()
    })

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1))
    expect(postedPayload().locationIdentifiers).toEqual(['1001'])
    expect(postedPayload().locations).toHaveLength(1)
    expect(postedPayload().locations[0].approaches[0].description).toBe(
      'SB Main St'
    )
  })

  it('resolves the metric string into aggregation and data type ids', async () => {
    const { result } = await runWithLocation()

    act(() => result.current.changeMetricType('Approach PCD-arrivalsOnRed'))
    await act(async () => {
      result.current.handleRunAnalysis()
    })

    await waitFor(() => expect(mutateAsync).toHaveBeenCalled())
    // 'Approach PCD' is the second aggregation type, and arrivalsOnRed is the
    // second option within it.
    expect(postedPayload().aggregationType).toBe(1)
    expect(postedPayload().dataType).toBe(1)
  })

  // An unrecognised metric name must not post `undefined` as the aggregation
  // type - it falls back to detector activation count.
  it('falls back to detector activation count for an unknown metric', async () => {
    const { result } = await runWithLocation()

    act(() => result.current.changeMetricType('Not A Metric-nope'))
    await act(async () => {
      result.current.handleRunAnalysis()
    })

    await waitFor(() => expect(mutateAsync).toHaveBeenCalled())
    expect(postedPayload().aggregationType).toBe(0)
    expect(postedPayload().dataType).toBe(0)
  })

  it('serializes the window as wall-clock literals with the time-of-day split out', async () => {
    const { result } = await runWithLocation()

    act(() => {
      result.current.changeStartDate(new Date(2026, 3, 1, 0, 0, 0))
      result.current.changeEndDate(new Date(2026, 3, 2, 0, 0, 0))
      result.current.changeStartTime(new Date(2026, 3, 1, 6, 30, 0))
      result.current.changeEndTime(new Date(2026, 3, 1, 18, 45, 0))
    })
    await act(async () => {
      result.current.handleRunAnalysis()
    })

    await waitFor(() => expect(mutateAsync).toHaveBeenCalled())
    expect(postedPayload().start).toBe('2026-04-01T00:00:00')
    expect(postedPayload().end).toBe('2026-04-02T00:00:00')
    expect(postedPayload().timeOptions).toMatchObject({
      timeOfDayStartHour: 6,
      timeOfDayStartMinute: 30,
      timeOfDayEndHour: 18,
      timeOfDayEndMinute: 45,
    })
  })

  it('expands the selected directions and movements into filter entries', async () => {
    const { result } = await runWithLocation()

    act(() => {
      result.current.changeSelectedDirections([1, 3])
      result.current.changeSelectedMovements([0])
    })
    await act(async () => {
      result.current.handleRunAnalysis()
    })

    await waitFor(() => expect(mutateAsync).toHaveBeenCalled())
    expect(postedPayload().filterDirections).toEqual([
      { directionTypeId: 1, description: 'string', include: true },
      { directionTypeId: 3, description: 'string', include: true },
    ])
    expect(postedPayload().filterMovements).toEqual([
      { movementTypeId: 0, description: 'string', include: true },
    ])
  })

  it('carries the axis, bin size, and aggregation choices through', async () => {
    const { result } = await runWithLocation()

    act(() => {
      result.current.changeBinSize(30)
      result.current.changeAverageOrSum(1)
      result.current.changeXAxisType(2)
      result.current.changeYAxisType(3)
      result.current.changeSelectedDays([6, 7])
    })
    await act(async () => {
      result.current.handleRunAnalysis()
    })

    await waitFor(() => expect(mutateAsync).toHaveBeenCalled())
    expect(postedPayload()).toMatchObject({
      selectedAggregationType: 1,
      selectedXAxisType: 2,
      selectedSeries: 3,
    })
    expect(postedPayload().timeOptions).toMatchObject({
      selectedBinSize: 30,
      daysOfWeek: [6, 7],
    })
  })

  it('stores the response as the aggregated data', async () => {
    const { result } = await runWithLocation()

    await act(async () => {
      result.current.handleRunAnalysis()
    })

    await waitFor(() =>
      expect(result.current.aggregatedData).toEqual([
        { locationIdentifier: '1001', value: 42 },
      ])
    )
  })
})
