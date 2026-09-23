// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - expandLocationHandler.test.tsx
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
import { act, renderHook } from '@testing-library/react'
import { useExpandLocationHandler } from './expandLocationHandler'

// This hook mirrors the selected locations into the include/exclude tree the
// aggregate request is built from. It takes everything it needs as props and
// makes no API calls, so it can be driven directly.

const detector = (id: number, over: Record<string, unknown> = {}) => ({
  id,
  dectectorIdentifier: `det-${id}`,
  detectorChannel: id,
  laneNumber: 1,
  laneType: 'Vehicle',
  ...over,
})

const approach = (
  id: number,
  description: string,
  detectors = [detector(id * 10)]
) => ({ id, description, detectors })

const routeLocation = (
  locationIdentifier: string,
  approaches = [approach(1, 'SB Main St')]
): RouteLocationDto =>
  ({
    locationIdentifier,
    primaryName: `${locationIdentifier} primary`,
    secondaryName: `${locationIdentifier} secondary`,
    approaches,
  }) as unknown as RouteLocationDto

const setup = (locations: RouteLocationDto[]) => {
  const setSelectedLocations = jest.fn()
  const changeLocation = jest.fn()

  const view = renderHook(
    (props: { locations: RouteLocationDto[] }) =>
      useExpandLocationHandler({
        locations: props.locations,
        setSelectedLocations,
        changeLocation,
      }),
    { initialProps: { locations } }
  )

  return { ...view, setSelectedLocations, changeLocation }
}

describe('useExpandLocationHandler', () => {
  it('mirrors the selected locations into an include tree', () => {
    const { result } = setup([routeLocation('1001')])

    expect(result.current.updatedLocations).toHaveLength(1)
    const location = result.current.updatedLocations[0]
    expect(location.locationIdentifier).toBe('1001')
    expect(location.exclude).toBe(false)
    expect(location.open).toBe(false)
    expect(location.approaches[0].description).toBe('SB Main St')
    expect(location.approaches[0].detectors[0].dectectorIdentifier).toBe(
      'det-10'
    )
  })

  it('defaults every nullable field rather than carrying null through', () => {
    const bare = {
      locationIdentifier: null,
      primaryName: null,
      secondaryName: null,
      approaches: [{ id: null, description: null, detectors: null }],
    } as unknown as RouteLocationDto

    const { result } = setup([bare])

    const location = result.current.updatedLocations[0]
    expect(location.locationIdentifier).toBe('')
    expect(location.primaryName).toBe('')
    expect(location.approaches[0].approachId).toBe(0)
    expect(location.approaches[0].detectors).toEqual([])
  })

  it('treats a location with no approaches as an empty tree', () => {
    const { result } = setup([
      { locationIdentifier: '1001', approaches: null } as never,
    ])

    expect(result.current.updatedLocations[0].approaches).toEqual([])
  })

  it('toggles a location open and closed', () => {
    const { result } = setup([routeLocation('1001')])
    const location = result.current.updatedLocations[0]

    act(() => result.current.updateLocationOpen(location))
    expect(result.current.updatedLocations[0].open).toBe(true)

    act(() => result.current.updateLocationOpen(location))
    expect(result.current.updatedLocations[0].open).toBe(false)
  })

  it('toggles a location exclude flag', () => {
    const { result } = setup([routeLocation('1001')])

    act(() =>
      result.current.updateLocationExclude(result.current.updatedLocations[0])
    )

    expect(result.current.updatedLocations[0].exclude).toBe(true)
  })

  it('toggles an approach without touching its siblings', () => {
    const { result } = setup([
      routeLocation('1001', [
        approach(1, 'SB Main St'),
        approach(2, 'NB Main St'),
      ]),
    ])
    const location = result.current.updatedLocations[0]

    act(() =>
      result.current.updateApproachExclude(location, location.approaches[0])
    )

    expect(result.current.updatedLocations[0].approaches[0].exclude).toBe(true)
    expect(result.current.updatedLocations[0].approaches[1].exclude).toBe(false)
  })

  it('toggles a detector without touching its siblings', () => {
    const { result } = setup([
      routeLocation('1001', [
        approach(1, 'SB Main St', [detector(10), detector(11)]),
      ]),
    ])
    const location = result.current.updatedLocations[0]
    const target = location.approaches[0]

    act(() =>
      result.current.updateDetectorExclude(
        location,
        target,
        target.detectors[1]
      )
    )

    const detectors = result.current.updatedLocations[0].approaches[0].detectors
    expect(detectors[0].exclude).toBe(false)
    expect(detectors[1].exclude).toBe(true)
  })

  it('leaves other locations alone when one is toggled', () => {
    const { result } = setup([routeLocation('1001'), routeLocation('1002')])

    act(() =>
      result.current.updateLocationExclude(result.current.updatedLocations[0])
    )

    expect(result.current.updatedLocations[0].exclude).toBe(true)
    expect(result.current.updatedLocations[1].exclude).toBe(false)
  })

  // Rebuilding the tree on every selection change must not discard the
  // include/exclude choices already made, or adding one location would reset
  // the filtering done on all the others.
  it('preserves existing choices when another location is added', () => {
    const { result, rerender } = setup([routeLocation('1001')])

    act(() =>
      result.current.updateLocationExclude(result.current.updatedLocations[0])
    )
    expect(result.current.updatedLocations[0].exclude).toBe(true)

    rerender({ locations: [routeLocation('1001'), routeLocation('1002')] })

    expect(result.current.updatedLocations).toHaveLength(2)
    expect(result.current.updatedLocations[0].exclude).toBe(true)
    expect(result.current.updatedLocations[1].exclude).toBe(false)
  })

  it('preserves approach and detector choices across a rebuild', () => {
    const { result, rerender } = setup([routeLocation('1001')])
    const location = result.current.updatedLocations[0]

    act(() =>
      result.current.updateApproachExclude(location, location.approaches[0])
    )
    act(() =>
      result.current.updateDetectorExclude(
        location,
        location.approaches[0],
        location.approaches[0].detectors[0]
      )
    )

    rerender({ locations: [routeLocation('1001'), routeLocation('1002')] })

    const rebuilt = result.current.updatedLocations[0]
    expect(rebuilt.approaches[0].exclude).toBe(true)
    expect(rebuilt.approaches[0].detectors[0].exclude).toBe(true)
  })

  it('drops a location that is no longer selected', () => {
    const { result, rerender } = setup([
      routeLocation('1001'),
      routeLocation('1002'),
    ])

    rerender({ locations: [routeLocation('1002')] })

    expect(
      result.current.updatedLocations.map((l) => l.locationIdentifier)
    ).toEqual(['1002'])
  })

  it('removes the location from the selection and clears the picker on delete', () => {
    const { result, setSelectedLocations, changeLocation } = setup([
      routeLocation('1001'),
      routeLocation('1002'),
    ])

    act(() => result.current.deleteLocation(result.current.updatedLocations[0]))

    expect(changeLocation).toHaveBeenCalledWith(null)
    const updater = setSelectedLocations.mock.calls[0][0] as (
      prev: RouteLocationDto[]
    ) => RouteLocationDto[]
    expect(
      updater([routeLocation('1001'), routeLocation('1002')]).map(
        (l) => l.locationIdentifier
      )
    ).toEqual(['1002'])
  })

  // Approaches are matched by description rather than by id in the toggle
  // handlers, so two approaches sharing a description on one location move
  // together. Recorded as current behaviour: the aggregate UI shows the
  // description, so duplicates are indistinguishable to the user anyway.
  it('toggles same-named approaches together', () => {
    const { result } = setup([
      routeLocation('1001', [
        approach(1, 'SB Main St'),
        approach(2, 'SB Main St'),
      ]),
    ])
    const location = result.current.updatedLocations[0]

    act(() =>
      result.current.updateApproachExclude(location, location.approaches[0])
    )

    expect(result.current.updatedLocations[0].approaches[0].exclude).toBe(true)
    expect(result.current.updatedLocations[0].approaches[1].exclude).toBe(true)
  })
})
