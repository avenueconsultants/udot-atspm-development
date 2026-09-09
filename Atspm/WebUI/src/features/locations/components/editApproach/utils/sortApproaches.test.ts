// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - sortApproaches.test.ts
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
import type { ConfigApproach } from '@/features/locations/components/editLocation/locationStore'
import {
  sortApproachesAndDetectors,
  sortApproachesByPhaseNumber,
  sortDetectorsByChannel,
} from './sortApproaches'

const buildApproach = (
  id: number,
  description: string | null,
  channels: number[] = []
): ConfigApproach =>
  ({
    id,
    description,
    protectedPhaseNumber: null,
    detectors: channels.map((detectorChannel, index) => ({
      id: index,
      detectorChannel,
      detectionTypes: [],
    })),
  }) as unknown as ConfigApproach

describe('sortApproachesByPhaseNumber', () => {
  it('sorts approaches by the phase number embedded in the description', () => {
    const approaches = [
      buildApproach(1, 'Phase 4'),
      buildApproach(2, 'Phase 2'),
      buildApproach(3, 'Phase 10'),
    ]

    const sorted = sortApproachesByPhaseNumber(approaches)

    expect(sorted.map((a) => a.id)).toEqual([2, 1, 3])
  })

  it('does not mutate the input array', () => {
    const approaches = [buildApproach(1, 'Phase 2'), buildApproach(2, 'Phase 1')]
    const original = [...approaches]

    sortApproachesByPhaseNumber(approaches)

    expect(approaches).toEqual(original)
  })

  it('places approaches without a phase number first', () => {
    const approaches = [
      buildApproach(1, 'Phase 3'),
      buildApproach(2, 'Northbound'),
      buildApproach(3, 'Phase 1'),
    ]

    const sorted = sortApproachesByPhaseNumber(approaches)

    expect(sorted.map((a) => a.id)).toEqual([2, 3, 1])
  })

  it('leaves relative order unchanged when neither description has a number', () => {
    const approaches = [
      buildApproach(1, 'Eastbound'),
      buildApproach(2, 'Westbound'),
    ]

    const sorted = sortApproachesByPhaseNumber(approaches)

    expect(sorted.map((a) => a.id)).toEqual([1, 2])
  })

  it('treats a null description the same as a missing phase number', () => {
    const approaches = [buildApproach(1, 'Phase 5'), buildApproach(2, null)]

    const sorted = sortApproachesByPhaseNumber(approaches)

    expect(sorted.map((a) => a.id)).toEqual([2, 1])
  })
})

describe('sortDetectorsByChannel', () => {
  it('sorts each approach detectors by channel number ascending', () => {
    const approaches = [buildApproach(1, 'Phase 1', [3, 1, 2])]

    const sorted = sortDetectorsByChannel(approaches)

    expect(sorted[0].detectors.map((d) => d.detectorChannel)).toEqual([1, 2, 3])
  })

  it('does not mutate the original approach objects', () => {
    const approaches = [buildApproach(1, 'Phase 1', [3, 1, 2])]

    sortDetectorsByChannel(approaches)

    expect(approaches[0].detectors.map((d) => d.detectorChannel)).toEqual([
      3, 1, 2,
    ])
  })
})

describe('sortApproachesAndDetectors', () => {
  it('sorts approaches by phase number and detectors by channel in one pass', () => {
    const approaches = [
      buildApproach(1, 'Phase 2', [2, 1]),
      buildApproach(2, 'Phase 1', [4, 3]),
    ]

    const sorted = sortApproachesAndDetectors(approaches)

    expect(sorted.map((a) => a.id)).toEqual([2, 1])
    expect(sorted[0].detectors.map((d) => d.detectorChannel)).toEqual([3, 4])
    expect(sorted[1].detectors.map((d) => d.detectorChannel)).toEqual([1, 2])
  })
})
