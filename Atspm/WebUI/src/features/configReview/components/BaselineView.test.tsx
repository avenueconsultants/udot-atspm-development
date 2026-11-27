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
        },
      ],
    },
  ],
}

test('shows the phases, directions and detectors ATSPM declares', () => {
  render(<BaselineView baseline={baseline} />)
  const rows = screen
    .getByRole('table', { name: 'Phases ATSPM declares' })
    .querySelectorAll('tbody tr')
  expect([...rows].map((row) => row.textContent)).toEqual([
    '2Protected—WBWBT Ph218',
    '6Protected—EBEBT Ph620',
  ])
  expect(screen.getByText('Ch 18 · Phase 2 · WB Through · lane 1')).toBeTruthy()
  expect(screen.getByText('Ch 20 · Phase 6 · EB Through · lane 1')).toBeTruthy()
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
  expect(screen.getByText(/declares no approaches/)).toBeTruthy()
  expect(screen.getByText(/declares no detectors here/)).toBeTruthy()
})
