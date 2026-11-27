import { render, screen } from '@testing-library/react'
import type { Baseline } from '../types'
import BaselineView, { declaredPhases } from './BaselineView'

// 7423 on R2:192 as ATSPM holds it: two through approaches, one advance detector each,
// and nothing at all about how the controller runs them.
const baseline: Baseline = {
  locationId: 412,
  start: '2021-07-01T00:00:00',
  fields: {},
  approaches: [
    {
      id: 1,
      phase: 2,
      overlap: false,
      direction: 4,
      description: 'WBT Ph2',
      permissivePhase: null,
      permissiveOverlap: false,
      pedestrianPhase: null,
      pedestrianOverlap: false,
      detectors: [
        {
          id: 11,
          channel: 18,
          lane: 1,
          movement: 1,
          dateAdded: '2021-07-01T00:00:00',
          laneType: 1,
          hardware: 2,
          detectionTypes: 1,
          identifier: '742318',
        },
      ],
    },
    {
      id: 2,
      phase: 6,
      overlap: false,
      direction: 3,
      description: 'EBT Ph6',
      permissivePhase: null,
      permissiveOverlap: false,
      pedestrianPhase: null,
      pedestrianOverlap: false,
      detectors: [
        {
          id: 12,
          channel: 20,
          lane: 1,
          movement: 1,
          dateAdded: '2021-07-01T00:00:00',
          laneType: 1,
          hardware: 2,
          detectionTypes: 1,
          identifier: '742320',
        },
      ],
    },
  ],
}

// One Approach row is one movement, and the leg an engineer calls an approach is the heading over
// them. The movement letters come from the detectors, because the row itself does not store them.
test('groups the movements ATSPM declares under the leg they belong to', () => {
  render(<BaselineView baseline={baseline} />)
  expect(
    [
      ...screen
        .getByRole('table', { name: 'Eastbound approach' })
        .querySelectorAll('tbody tr'),
    ].map((row) => row.textContent)
  ).toEqual(['EBTPhase 6——20EBT Ph6'])
  expect(
    [
      ...screen
        .getByRole('table', { name: 'Westbound approach' })
        .querySelectorAll('tbody tr'),
    ].map((row) => row.textContent)
  ).toEqual(['WBTPhase 2——18WBT Ph2'])
  expect(screen.getByText('Westbound approach · 1 movement')).toBeTruthy()
  expect(
    screen.getByText('Ch 18 · WBT · Phase 2 · Through · lane 1')
  ).toBeTruthy()
  expect(
    screen.getByText('Ch 20 · EBT · Phase 6 · Through · lane 1')
  ).toBeTruthy()
})

test('names a permissive phase and an overlap in the movement row', () => {
  render(
    <BaselineView
      baseline={{
        ...baseline,
        approaches: [
          {
            ...baseline.approaches[0],
            permissivePhase: 2,
            phase: 5,
            pedestrianPhase: 2,
            detectors: [
              { ...baseline.approaches[0].detectors[0], movement: 3 },
            ],
          },
        ],
      }}
    />
  )
  expect(
    [
      ...screen
        .getByRole('table', { name: 'Westbound approach' })
        .querySelectorAll('tbody tr'),
    ].map((row) => row.textContent)
  ).toEqual(['WBLPhase 5Phase 2Phase 218WBT Ph2'])
})

test('says plainly that ring, sequence and timing are not stored here', () => {
  render(<BaselineView baseline={baseline} />)
  expect(screen.getByText(/What ATSPM has no field for/)).toBeTruthy()
  for (const missing of ['rings', 'barriers', 'sequence', 'phase timing'])
    expect(screen.getByText(missing)).toBeTruthy()
})

test('separates a permissive and a pedestrian phase from the protected one', () => {
  const approach = {
    ...baseline.approaches[0],
    permissivePhase: 5,
    pedestrianPhase: 2,
  }
  expect(
    declaredPhases({ ...baseline, approaches: [approach] }).map(
      (entry) => `${entry.phase} ${entry.role}`
    )
  ).toEqual(['2 Pedestrian', '2 Protected', '5 Permissive'])
})

// An overlap number and a phase number look alike and mean different things: overlap 2 runs
// whenever its member phases do, and is not phase 2. Folding them into one row was how a
// previous review reported five conflicts at 7077 that did not exist.
test('keeps an overlap apart from the phase of the same number', () => {
  const approaches = [
    { ...baseline.approaches[0], id: 3, phase: 2, overlap: true },
    baseline.approaches[0],
  ]
  expect(
    declaredPhases({ ...baseline, approaches }).map(
      (entry) => `${entry.phase}${entry.overlap ? ' overlap' : ''}`
    )
  ).toEqual(['2', '2 overlap'])
})

test('warns when ATSPM declares nothing to compare against', () => {
  render(<BaselineView baseline={{ ...baseline, approaches: [] }} />)
  expect(screen.getByText(/declares no movements/)).toBeTruthy()
  expect(screen.getByText(/declares no detectors here/)).toBeTruthy()
})
