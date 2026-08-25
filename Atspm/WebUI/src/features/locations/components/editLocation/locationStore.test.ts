// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - locationStore.test.ts
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

// The store calls the generated delete endpoints directly on approach and
// detector removal. Stubbing them keeps these tests on the state machine and
// stops the calls reaching MSW, which is configured to error on anything
// unhandled.
jest.mock('@/api/config', () => ({
  deleteApproachFromKey: jest.fn(),
  deleteDetectorFromKey: jest.fn(),
}))

import { deleteApproachFromKey, deleteDetectorFromKey } from '@/api/config'
import type {
  ConfigApproach,
  ConfigDetector,
  ConfigLocation,
} from './locationStore'
import { useLocationStore } from './locationStore'

const store = () => useLocationStore.getState()

const detector = (over: Partial<ConfigDetector> = {}): ConfigDetector =>
  ({
    id: 1,
    detectorChannel: 3,
    dectectorIdentifier: '1001-1',
    detectionTypes: [],
    detectorComments: [],
    laneNumber: 1,
    ...over,
  }) as unknown as ConfigDetector

const approach = (over: Partial<ConfigApproach> = {}): ConfigApproach =>
  ({
    id: 10,
    description: 'SB Main St',
    protectedPhaseNumber: 2,
    permissivePhaseNumber: null,
    pedestrianPhaseNumber: null,
    isProtectedPhaseOverlap: false,
    isPermissivePhaseOverlap: false,
    isPedestrianPhaseOverlap: false,
    pedestrianDetectors: '',
    locationId: 5,
    detectors: [detector()],
    ...over,
  }) as unknown as ConfigApproach

const location = (approaches: ConfigApproach[]): ConfigLocation =>
  ({
    id: 5,
    locationIdentifier: '1001',
    primaryName: 'Main St',
    secondaryName: '400 S',
    approaches,
  }) as unknown as ConfigLocation

beforeEach(() => {
  jest.clearAllMocks()
  store().resetStore()
})

describe('setLocation', () => {
  it('seeds approaches, the saved baseline, and the channel map', () => {
    store().setLocation(location([approach()]))

    expect(store().location?.id).toBe(5)
    expect(store().approaches).toHaveLength(1)
    expect(store().savedApproaches).toHaveLength(1)
    expect(store().channelMap.get(1)).toBe(3)
  })

  it('defaults a missing detector channel to zero in the map', () => {
    store().setLocation(
      location([
        approach({
          detectors: [detector({ detectorChannel: null as unknown as number })],
        }),
      ])
    )

    expect(store().channelMap.get(1)).toBe(0)
  })

  // savedApproaches is the revert baseline, so it has to be a deep copy -
  // sharing structure with `approaches` would make every edit look saved.
  it('deep-copies the saved baseline rather than aliasing it', () => {
    store().setLocation(location([approach()]))

    store().approaches[0].description = 'edited in place'
    store().approaches[0].detectors[0].laneNumber = 99

    expect(store().savedApproaches[0].description).toBe('SB Main St')
    expect(store().savedApproaches[0].detectors[0].laneNumber).toBe(1)
  })

  it('handles a null location without throwing', () => {
    expect(() => store().setLocation(null)).not.toThrow()

    expect(store().location).toBeNull()
    expect(store().approaches).toEqual([])
    expect(store().channelMap.size).toBe(0)
  })
})

describe('hasUnsavedChanges', () => {
  it('is false immediately after loading a location', () => {
    store().setLocation(location([approach()]))

    expect(store().hasUnsavedChanges()).toBe(false)
  })

  it('is true once a field actually changes', () => {
    store().setLocation(location([approach()]))
    store().updateApproach({ ...approach(), description: 'NB Main St' })

    expect(store().hasUnsavedChanges()).toBe(true)
  })

  it('ignores the UI-only flags', () => {
    store().setLocation(location([approach()]))
    store().updateApproach({
      ...approach(),
      open: true,
      index: 7,
      isNew: true,
    })

    expect(store().hasUnsavedChanges()).toBe(false)
  })

  // normalize() stringifies numbers before comparing, so a phase number that
  // comes back from an input as "2" instead of 2 must not read as an edit.
  it('treats numerically equal values as unchanged across string and number', () => {
    store().setLocation(location([approach()]))
    store().updateApproach({
      ...approach(),
      protectedPhaseNumber: '2' as unknown as number,
    })

    expect(store().hasUnsavedChanges()).toBe(false)
  })

  it('is true when an approach is added', () => {
    store().setLocation(location([approach()]))
    store().addApproach()

    expect(store().hasUnsavedChanges()).toBe(true)
  })

  it('is true when the approach ids no longer line up', () => {
    store().setLocation(location([approach()]))
    store().updateApproaches([approach({ id: 999 })])

    expect(store().hasUnsavedChanges()).toBe(true)
  })
})

describe('handleLocationEdit', () => {
  it('updates the named field', () => {
    store().setLocation(location([]))
    store().handleLocationEdit('primaryName', 'State St')

    expect(store().location?.primaryName).toBe('State St')
  })

  it('is a no-op when no location is loaded', () => {
    expect(() =>
      store().handleLocationEdit('primaryName', 'State St')
    ).not.toThrow()
    expect(store().location).toBeNull()
  })
})

describe('updateApproach', () => {
  it('replaces the matching approach in place', () => {
    store().setLocation(location([approach(), approach({ id: 11 })]))
    store().updateApproach({ ...approach({ id: 11 }), description: 'EB 400 S' })

    expect(store().approaches).toHaveLength(2)
    expect(store().approaches[1].description).toBe('EB 400 S')
    expect(store().approaches[0].description).toBe('SB Main St')
  })

  it('appends an approach it has never seen', () => {
    store().setLocation(location([approach()]))
    store().updateApproach(approach({ id: 77 }))

    expect(store().approaches.map((a) => a.id)).toEqual([10, 77])
  })
})

describe('resetApproaches', () => {
  it('restores the saved baseline', () => {
    store().setLocation(location([approach()]))
    store().updateApproach({ ...approach(), description: 'edited' })
    store().resetApproaches()

    expect(store().approaches[0].description).toBe('SB Main St')
    expect(store().hasUnsavedChanges()).toBe(false)
  })

  it('restores a copy, so the baseline survives the next edit', () => {
    store().setLocation(location([approach()]))
    store().resetApproaches()

    store().approaches[0].description = 'edited in place'

    expect(store().savedApproaches[0].description).toBe('SB Main St')
  })
})

describe('addApproach', () => {
  it('prepends a new approach carrying the location id', () => {
    store().setLocation(location([approach()]))
    store().addApproach()

    expect(store().approaches).toHaveLength(2)
    expect(store().approaches[0].isNew).toBe(true)
    expect(store().approaches[0].description).toBe('New Approach')
    expect(store().approaches[0].locationId).toBe(5)
    expect(store().approaches[0].detectors).toEqual([])
  })
})

describe('copyApproach', () => {
  it('appends a copy with fresh ids and a cleared detector channel', () => {
    store().setLocation(location([approach()]))
    store().copyApproach(store().approaches[0])

    const copy = store().approaches[1]
    expect(copy.description).toBe('SB Main St (copy)')
    expect(copy.isNew).toBe(true)
    expect(copy.id).not.toBe(10)
    expect(copy.detectors[0].id).not.toBe(1)
    expect(copy.detectors[0].isNew).toBe(true)
    // A copied detector must not claim the original's channel, which is
    // unique per location.
    expect(copy.detectors[0].detectorChannel).toBeNull()
  })

  it('leaves the original untouched', () => {
    store().setLocation(location([approach()]))
    store().copyApproach(store().approaches[0])

    expect(store().approaches[0].description).toBe('SB Main St')
    expect(store().approaches[0].detectors[0].detectorChannel).toBe(3)
  })
})

describe('deleteApproach', () => {
  it('removes the approach and frees its detector channels', () => {
    store().setLocation(location([approach()]))
    store().deleteApproach(store().approaches[0])

    expect(store().approaches).toEqual([])
    expect(store().channelMap.has(1)).toBe(false)
  })

  it('calls the delete endpoint for an approach that exists server-side', () => {
    store().setLocation(location([approach()]))
    store().deleteApproach(store().approaches[0])

    expect(deleteApproachFromKey).toHaveBeenCalledWith(10)
  })

  it('does not call the delete endpoint for an unsaved approach', () => {
    store().setLocation(location([]))
    store().addApproach()
    store().deleteApproach(store().approaches[0])

    expect(deleteApproachFromKey).not.toHaveBeenCalled()
  })

  // Deleting rebases the saved baseline, so the removal itself does not
  // register as an unsaved change.
  it('rebases the saved baseline onto what is left', () => {
    store().setLocation(location([approach(), approach({ id: 11 })]))
    store().deleteApproach(store().approaches[0])

    expect(store().savedApproaches.map((a) => a.id)).toEqual([11])
    expect(store().hasUnsavedChanges()).toBe(false)
  })
})

describe('addDetector', () => {
  it('prepends a new detector to the named approach', () => {
    store().setLocation(location([approach()]))
    store().addDetector(10)

    expect(store().approaches[0].detectors).toHaveLength(2)
    expect(store().approaches[0].detectors[0].isNew).toBe(true)
    expect(store().approaches[0].detectors[0].approachId).toBe(10)
  })

  it('is a no-op for an approach that does not exist', () => {
    store().setLocation(location([approach()]))
    store().addDetector(9999)

    expect(store().approaches[0].detectors).toHaveLength(1)
  })
})

describe('updateDetector', () => {
  it('updates only the targeted detector', () => {
    store().setLocation(
      location([approach({ detectors: [detector(), detector({ id: 2 })] })])
    )
    store().updateDetector(2, 'laneNumber', 4)

    expect(store().approaches[0].detectors[0].laneNumber).toBe(1)
    expect(store().approaches[0].detectors[1].laneNumber).toBe(4)
  })

  it('tracks a numeric channel change in the channel map', () => {
    store().setLocation(location([approach()]))
    store().updateDetector(1, 'detectorChannel', 8)

    expect(store().channelMap.get(1)).toBe(8)
    expect(store().approaches[0].detectors[0].detectorChannel).toBe(8)
  })

  // Number inputs hand back strings, so the map would otherwise fill with
  // string keys that never match the numeric ones used for duplicate checks.
  it('parses a string channel before storing it', () => {
    store().setLocation(location([approach()]))
    store().updateDetector(1, 'detectorChannel', '8')

    expect(store().channelMap.get(1)).toBe(8)
  })

  it('falls back to zero for an unparseable channel', () => {
    store().setLocation(location([approach()]))
    store().updateDetector(1, 'detectorChannel', 'not a number')

    expect(store().channelMap.get(1)).toBe(0)
  })

  it('replaces the map instance so subscribers re-render', () => {
    store().setLocation(location([approach()]))
    const before = store().channelMap

    store().updateDetector(1, 'detectorChannel', 8)

    expect(store().channelMap).not.toBe(before)
  })

  it('leaves the map alone for non-channel fields', () => {
    store().setLocation(location([approach()]))
    const before = store().channelMap

    store().updateDetector(1, 'laneNumber', 4)

    expect(store().channelMap).toBe(before)
  })
})

describe('deleteDetector', () => {
  it('removes the detector from its approach', () => {
    store().setLocation(
      location([approach({ detectors: [detector(), detector({ id: 2 })] })])
    )
    store().deleteDetector(2)

    expect(store().approaches[0].detectors.map((d) => d.id)).toEqual([1])
  })

  it('calls the delete endpoint for a detector that exists server-side', () => {
    store().setLocation(location([approach()]))
    store().deleteDetector(1)

    expect(deleteDetectorFromKey).toHaveBeenCalledWith(1)
    expect(store().channelMap.has(1)).toBe(false)
  })

  it('does not call the delete endpoint for an unsaved detector', () => {
    store().setLocation(location([approach()]))
    store().addDetector(10)
    const newId = store().approaches[0].detectors[0].id

    store().deleteDetector(newId)

    expect(deleteDetectorFromKey).not.toHaveBeenCalled()
    expect(store().approaches[0].detectors).toHaveLength(1)
  })

  it('is a no-op for a detector that does not exist', () => {
    store().setLocation(location([approach()]))
    store().deleteDetector(9999)

    expect(store().approaches[0].detectors).toHaveLength(1)
    expect(deleteDetectorFromKey).not.toHaveBeenCalled()
  })
})

describe('resetStore', () => {
  it('clears every slice', () => {
    store().setLocation(location([approach()]))
    store().setErrors({ a: { error: 'bad', id: 'a' } })
    store().setWarnings({ b: { warning: 'careful', id: 'b' } })

    store().resetStore()

    expect(store().location).toBeNull()
    expect(store().approaches).toEqual([])
    expect(store().savedApproaches).toEqual([])
    expect(store().channelMap.size).toBe(0)
    expect(store().errors).toBeNull()
    expect(store().warnings).toBeNull()
  })
})

describe('errors and warnings', () => {
  it('clears both together', () => {
    store().setErrors({ a: { error: 'bad', id: 'a' } })
    store().setWarnings({ b: { warning: 'careful', id: 'b' } })

    store().clearErrorsAndWarnings()

    expect(store().errors).toBeNull()
    expect(store().warnings).toBeNull()
  })
})
