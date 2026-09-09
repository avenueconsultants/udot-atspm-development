import type { Route, RouteLocation } from '@/api/config'
import { ToolType } from '@/features/charts/common/types'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useAverageOptionsHandler } from './timeSpaceAverageOptions.handler'

function buildRouteLocation(
  locationIdentifier: string,
  order: number
): RouteLocation {
  return {
    locationIdentifier,
    order,
  }
}

const routes: Route[] = [
  {
    id: 4122,
    name: '4122',
    routeLocations: [
      buildRouteLocation('7192', 1),
      buildRouteLocation('7191', 2),
    ],
  },
]

describe('useAverageOptionsHandler', () => {
  it('serializes custom sequence and coordinated phases into the request shape', async () => {
    const { result } = renderHook(() => useAverageOptionsHandler({ routes }))

    act(() => {
      result.current.setRouteId('4122')
    })

    await waitFor(() => {
      expect(result.current.routeLocationWithSequence).toHaveLength(2)
      expect(result.current.routeLocationWithCoordPhases).toHaveLength(2)
    })

    act(() => {
      result.current.updateLocationWithSequence({
        locationIdentifier: '7192',
        sequence: [
          [2, 1, 3, 4],
          [6, 5, 8, 7],
        ],
      })
      result.current.updateLocationWithCoordPhases({
        locationIdentifier: '7192',
        coordinatedPhases: [1, 5],
      })
    })

    const options = result.current.toOptions()

    expect(options.sequence).toEqual([
      {
        locationIdentifier: '7192',
        sequence: [
          [2, 1, 3, 4],
          [6, 5, 8, 7],
        ],
      },
      {
        locationIdentifier: '7191',
        sequence: [
          [1, 2, 3, 4],
          [5, 6, 7, 8],
        ],
      },
    ])
    expect(options.coordinatedPhases).toEqual([
      {
        locationIdentifier: '7192',
        coordinatedPhases: [1, 5],
      },
      {
        locationIdentifier: '7191',
        coordinatedPhases: [2, 6],
      },
    ])

    const params = result.current.toSearchParams()

    expect(params.get('toolType')).toBe(String(ToolType.TimeSpaceAverage))
    expect(JSON.parse(params.get('sequence') ?? '[]')).toEqual(options.sequence)
    expect(JSON.parse(params.get('coordinatedPhases') ?? '[]')).toEqual(
      options.coordinatedPhases
    )
  })

  it('keeps sequence and coordinated phases applied alongside the route id', async () => {
    const { result } = renderHook(() => useAverageOptionsHandler({ routes }))

    // What a shared link does: the route and its options arrive together, and
    // the effect that seeds a newly picked route runs straight afterwards.
    act(() => {
      result.current.applyFromOptions({
        routeId: '4122',
        sequence: [
          {
            locationIdentifier: '7192',
            sequence: [
              [2, 1, 4, 3],
              [5, 6, 7, 8],
            ],
          },
        ],
        coordinatedPhases: [
          { locationIdentifier: '7192', coordinatedPhases: [1, 5] },
        ],
      })
    })

    await waitFor(() => {
      expect(result.current.routeLocationWithSequence).toHaveLength(2)
    })

    const options = result.current.toOptions()

    expect(options.sequence[0]).toEqual({
      locationIdentifier: '7192',
      sequence: [
        [2, 1, 4, 3],
        [5, 6, 7, 8],
      ],
    })
    expect(options.coordinatedPhases[0]).toEqual({
      locationIdentifier: '7192',
      coordinatedPhases: [1, 5],
    })
    // The location the link said nothing about still gets the defaults, in
    // route order.
    expect(options.sequence[1]).toEqual({
      locationIdentifier: '7191',
      sequence: [
        [1, 2, 3, 4],
        [5, 6, 7, 8],
      ],
    })
    expect(options.coordinatedPhases[1]).toEqual({
      locationIdentifier: '7191',
      coordinatedPhases: [2, 6],
    })
  })

  it('reports a cleared time of day as no time rather than throwing', () => {
    const { result } = renderHook(() => useAverageOptionsHandler({ routes }))

    // The MUI time picker hands back null when its field is emptied.
    act(() => {
      result.current.changeStartTime(null)
    })

    const options = result.current.toOptions()

    expect(options.startTime).toBe('')
    expect(options.endTime).not.toBe('')
    // An empty time is dropped from a shared link rather than written as a
    // value the parser would reject on the way back in.
    expect(result.current.toSearchParams().has('startTime')).toBe(false)
  })
})
