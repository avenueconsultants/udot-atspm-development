import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  assign,
  channelOf,
  draggableId,
  placements,
  targetsForPhase,
} from '../assignments'
import { gateFailures, phaseGroups, stateOf } from '../cards'
import { programmedSplit, ringOrder } from '../splits'
import type { Baseline, ControllerSnapshot, ReviewItem } from '../types'
import AssemblyBoard from './AssemblyBoard'

// 7423 again: ATSPM declares two through approaches and two detectors, the cabinet runs eight
// phases and assigns sixteen channels, and channels 18 and 20 are each on the other's phase.
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

const phase = (
  number: number,
  ring: number,
  concurrent: number[],
  ped = false
) => ({
  phase: number,
  ring,
  concurrent,
  inUse: true,
  minGreen: 5,
  passage: 1.6,
  maxGreen1: 25,
  yellowChange: 4.3,
  redClear: 1.5,
  walk: ped ? 7 : 0,
  pedClear: ped ? 18 : 0,
  source: `ntcip:phase.${number}`,
})

const snapshot: ControllerSnapshot = {
  schemaVersion: 1,
  locationIdentifier: '7423',
  make: 'Econolite',
  model: 'Cobalt',
  collectedAt: '2026-11-26T15:30:00Z',
  sources: [],
  phases: [
    phase(1, 1, [5, 6]),
    phase(2, 1, [5, 6], true),
    phase(3, 1, [7, 8]),
    phase(4, 1, [7, 8], true),
    phase(5, 2, [1, 2]),
    phase(6, 2, [1, 2], true),
    phase(7, 2, [3, 4]),
    phase(8, 2, [3, 4], true),
  ],
  phasesNotInUse: [],
  overlaps: [],
  patterns: [
    {
      pattern: 1,
      cycle: 110,
      offset: 20,
      splitNumber: 1,
      sequenceNumber: 1,
      source: 'file:ASC3.DB',
    },
  ],
  splitTables: [
    {
      splitNumber: 1,
      ringSplits: {
        '1': [15, 40, 15, 40],
        '2': [15, 40, 15, 40],
      },
      source: 'file:ASC3.DB',
    },
  ],
  sequences: [
    {
      sequenceNumber: 1,
      ringPhases: { '1': [1, 2, 3, 4], '2': [5, 6, 7, 8] },
      source: 'file:ASC3.DB',
    },
  ],
  detectors: [
    { channel: 18, callPhase: 6, source: 'ntcip:det.18' },
    { channel: 20, callPhase: 2, source: 'ntcip:det.20' },
    { channel: 33, callPhase: 1, source: 'ntcip:det.33' },
  ],
  conflicts: [],
  notes: [],
  unavailable: [],
}

const item = (
  field: string,
  classification: string,
  baselineValue: string,
  controllerValue: string
): ReviewItem => ({
  id: field,
  field,
  group: 'detectors',
  classification,
  disposition: 'Pending',
  summary: field,
  baselineValue,
  controllerValue,
  sources: 'ntcip:7423',
  annotation: null,
})

const items: ReviewItem[] = [
  item('detectors.18.callPhase', 'NeedsDirection', '[2]', '6'),
  item('detectors.20.callPhase', 'NeedsDirection', '[6]', '2'),
  item('detectors.33.callPhase', 'NeedsDirection', '[]', '1'),
  item('approaches.1', 'NeedsDirection', 'null', '1'),
  item('phases.1.passage', 'Certain', 'null', '1.6'),
]

test('groups the phase cards by what runs together, in sequence order', () => {
  const { order } = ringOrder(snapshot, snapshot.patterns[0])
  expect(
    phaseGroups(snapshot, order).map((group) =>
      group.map((entry) => entry.phase)
    )
  ).toEqual([
    [1, 5, 2, 6],
    [3, 7, 4, 8],
  ])
})

test('places a programmed split by sequence position, not phase number', () => {
  const pattern = snapshot.patterns[0]
  expect(programmedSplit(snapshot, snapshot.phases[1], pattern)).toEqual({
    seconds: 40,
    basis: 'sequence',
  })
  // With no sequence definition the position is ascending phase order, and that has to be said.
  const guessed = { ...snapshot, sequences: [] }
  expect(programmedSplit(guessed, guessed.phases[1], pattern)).toEqual({
    seconds: 40,
    basis: 'assumed',
  })
})

test('a value ATSPM never stored is not reported as a disagreement', () => {
  expect(stateOf(items[4])).toBe('notHeld')
  expect(stateOf(item('phases.1.passage', 'Certain', '1.4', '1.6'))).toBe(
    'disagrees'
  )
  expect(stateOf(items[0])).toBe('needsPerson')
})

test('the gate names what each location still needs, and lets the rest through', () => {
  const failures = gateFailures(baseline, snapshot)
  const subjects = failures.map((failure) => failure.subject)
  // Six phases with no approach, and the one assigned channel ATSPM has never heard of.
  expect(subjects).toContain('Phase 1')
  expect(subjects).toContain('Channel 33')
  expect(subjects).not.toContain('Channel 18')
  expect(gateFailures(baseline, null)).toEqual([])

  const incomplete = {
    ...baseline,
    approaches: [
      {
        ...baseline.approaches[0],
        detectors: [
          {
            ...baseline.approaches[0].detectors[0],
            movement: 0,
            detectionTypes: 0,
          },
        ],
      },
    ],
  }
  expect(gateFailures(incomplete, null)).toEqual([
    {
      subject: 'Channel 18',
      missing: [
        'movement',
        'at least one detection type — it feeds no measure without one',
      ],
    },
  ])
})

test('renders the board with the plan, the cards and the tray', () => {
  render(
    <AssemblyBoard
      locationIdentifier="7423"
      baseline={baseline}
      snapshot={snapshot}
      items={items}
    />
  )
  expect(screen.getByText('Location 7423')).toBeTruthy()
  expect(screen.getByText(/splits placed by sequence/)).toBeTruthy()
  expect(screen.getByText('Run together: 1 + 2 + 5 + 6')).toBeTruthy()
  expect(screen.getByText(/Channels with no ATSPM approach · 1/)).toBeTruthy()
  // Phase 1 has no approach, so it says so rather than guessing a direction from the number.
  // Six of the eight phases in service have no approach, and each card says so.
  expect(
    screen.getAllByText(
      /Direction unknown — no ATSPM approach carries this phase/
    ).length
  ).toBe(6)
  // Phases 2, 4, 6 and 8 sit at position 1 in their ring and take the 40s split.
  expect(screen.getAllByText('Programmed split 40s').length).toBe(4)
  expect(screen.getAllByText('Programmed split 15s').length).toBe(4)
  expect(screen.getAllByText('Average served — not loaded').length).toBe(8)
  expect(screen.getByText(/to complete before saving/)).toBeTruthy()
})

test('says the structure slots are empty before a snapshot, rather than hiding them', () => {
  render(
    <AssemblyBoard
      locationIdentifier="7423"
      baseline={baseline}
      snapshot={null}
      items={[]}
    />
  )
  expect(screen.getByText(/ATSPM stores none of them/)).toBeTruthy()
  expect(screen.getByText('Ready to save')).toBeTruthy()
})

test('a phase with one approach settles a drop, and the rest have to be chosen', () => {
  // Phase 2 is carried by one approach, so dropping a channel on it needs no further question.
  expect(targetsForPhase(baseline, 2).map((target) => target.id)).toEqual([1])
  // Phase 1 is carried by none, so there is nothing in ATSPM to place a channel on.
  expect(targetsForPhase(baseline, 1)).toEqual([])
  expect(channelOf(draggableId('tray', 33))).toBe(33)
})

test('an assignment moves the channel and keeps what it replaced', () => {
  const moved = assign(baseline, {}, 18, 2)
  expect(moved[18].was).toBe('Phase 2 WB · WBT Ph2')
  const placed = placements(baseline, moved)
  expect(placed.get(18)?.approach?.id).toBe(2)
  // Dragging a channel changes the approach it belongs to and nothing else about it.
  expect(placed.get(18)?.detector?.identifier).toBe('742318')
  expect(placed.get(18)?.source).toBe('engineer')

  // A channel ATSPM never held carries no detector record, so the gate asks for the rest of it.
  const added = assign(baseline, {}, 33, 1)
  const failures = gateFailures(baseline, snapshot, added)
  expect(failures).toContainEqual({
    subject: 'Channel 33',
    missing: [
      'identifier',
      'movement',
      'lane type',
      'detection hardware',
      'at least one detection type — it feeds no measure without one',
    ],
  })
  // and it is no longer reported as a channel with no detector at all.
  expect(failures).not.toContainEqual({
    subject: 'Channel 33',
    missing: ['an ATSPM detector on phase 1'],
  })
})

test('the menu assigns a channel without a mouse drag', async () => {
  const user = userEvent.setup()
  render(
    <AssemblyBoard
      locationIdentifier="7423"
      baseline={baseline}
      snapshot={snapshot}
      items={items}
    />
  )
  // Channel 33 shows twice: on the phase 1 card because the controller calls phase 1 with it, and
  // in the tray because ATSPM holds no approach for it. Either card's menu does the same thing.
  await user.click(
    screen.getAllByLabelText('Assign channel 33 to an approach')[0]
  )
  await user.click(screen.getByText('Phase 2 WB · WBT Ph2'))
  expect(screen.getAllByText(/was no approach/).length).toBeGreaterThan(0)
  expect(screen.getByText(/Channels with no ATSPM approach · 0/)).toBeTruthy()
})
