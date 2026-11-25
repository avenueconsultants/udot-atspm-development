import { render, screen } from '@testing-library/react'
import type { ControllerSnapshot, Phase } from '../types'
import RingBarrierDiagram, { barriersFor } from './RingBarrierDiagram'

const phases: Phase[] = [
  { phase: 1, ring: 1, concurrent: [5, 6], inUse: true },
  { phase: 2, ring: 1, concurrent: [5, 6], inUse: true },
  { phase: 4, ring: 1, concurrent: [8, 15], inUse: true },
  { phase: 11, ring: 1, concurrent: [8, 15], inUse: true },
  { phase: 5, ring: 2, concurrent: [1, 2], inUse: true },
  { phase: 6, ring: 2, concurrent: [1, 2], inUse: true },
  { phase: 8, ring: 2, concurrent: [4, 11], inUse: true },
  { phase: 15, ring: 2, concurrent: [4, 11], inUse: true },
]
const snapshot: ControllerSnapshot = {
  schemaVersion: 1,
  locationIdentifier: '7521',
  make: 'Econolite',
  model: 'Cobalt',
  collectedAt: '2026-11-25T10:26:00Z',
  sources: [],
  phases,
  phasesNotInUse: [{ phase: 14, reason: 'ring0' }],
  overlaps: [],
  patterns: [],
  splitTables: [],
  sequences: [],
  detectors: [],
  conflicts: [],
  notes: [],
  unavailable: ['sequences'],
}

test('uses controller concurrency for the standard barriers', () => {
  const standard = phases.map((phase) => ({
    ...phase,
    phase: phase.phase === 11 ? 3 : phase.phase === 15 ? 7 : phase.phase,
    concurrent: phase.concurrent?.map((number) =>
      number === 11 ? 3 : number === 15 ? 7 : number
    ),
  }))
  expect(
    barriersFor(standard).map((barrier) =>
      barrier.map(({ phase }) => phase).sort((a, b) => a - b)
    )
  ).toEqual([
    [1, 2, 5, 6],
    [3, 4, 7, 8],
  ])
})

test('places all of 7521’s phases and excludes phases not in use', () => {
  render(<RingBarrierDiagram snapshot={snapshot} items={[]} />)
  expect(
    barriersFor(phases).map((barrier) => barrier.map(({ phase }) => phase))
  ).toEqual([
    [1, 2, 5, 6],
    [4, 11, 8, 15],
  ])
  phases.forEach(({ phase }) =>
    expect(screen.getByText('Phase ' + phase)).toBeTruthy()
  )
  expect(screen.queryByText('Phase 14')).toBeNull()
  expect(screen.getByText(/Sequence definition unavailable/)).toBeTruthy()
})
