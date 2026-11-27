import { legName, movementLabel } from './naming'
import type { Baseline, BaselineApproach } from './types'

export type BaselineDetector = BaselineApproach['detectors'][number]

/**
 * Where the engineer has put a channel in this session, before anything is written back. ATSPM is
 * the only holder of a detector's approach - no controller, radar or lidar read carries it - so
 * these placements are the person's and nothing later overrides them silently. `was` is the
 * placement this one replaced, kept so the card can say what changed rather than only what it now
 * holds.
 */
export type Assignment = {
  approachId: number | null
  was: string
  at: string
}

export type Assignments = Record<number, Assignment>

export type AssignTarget = {
  id: number | null
  label: string
  leg: string
  phase: number | null
}

/** Every movement a channel may be placed on at this location, plus taking it off all of them. */
export function targetsFor(baseline: Baseline): AssignTarget[] {
  return [
    ...baseline.approaches.map((approach) => ({
      id: approach.id,
      label: movementLabel(approach),
      leg: legName(approach.direction),
      phase: approach.overlap ? null : approach.phase,
    })),
    { id: null, label: 'No movement', leg: 'Take it off', phase: null },
  ]
}

/**
 * The movements that carry a given phase, protected or permissive. A drop onto a phase card is
 * only unambiguous when exactly one of them exists; with two the person has to say which, and with
 * none there is nothing in ATSPM to place the channel on.
 */
export function targetsForPhase(
  baseline: Baseline,
  phase: number
): AssignTarget[] {
  return baseline.approaches
    .filter(
      (approach) =>
        (!approach.overlap && approach.phase === phase) ||
        (!approach.permissiveOverlap && approach.permissivePhase === phase)
    )
    .map((approach) => ({
      id: approach.id,
      label: movementLabel(approach),
      leg: legName(approach.direction),
      phase,
    }))
}

export type Placement = {
  approach: BaselineApproach | null
  detector?: BaselineDetector
  source: 'atspm' | 'engineer'
}

/**
 * Every channel ATSPM holds or the engineer has placed, with the approach it now sits on. A
 * placement made here keeps the stored detector record where there is one, because dragging a
 * channel changes which approach it belongs to and nothing else about it.
 */
export function placements(
  baseline: Baseline,
  assignments: Assignments
): Map<number, Placement> {
  const placed = new Map<number, Placement>()
  for (const approach of baseline.approaches)
    for (const detector of approach.detectors)
      placed.set(detector.channel, { approach, detector, source: 'atspm' })
  for (const [key, assignment] of Object.entries(assignments)) {
    const channel = Number(key)
    const approach =
      baseline.approaches.find((entry) => entry.id === assignment.approachId) ??
      null
    placed.set(channel, {
      approach,
      detector: placed.get(channel)?.detector,
      source: 'engineer',
    })
  }
  return placed
}

/** The label a card shows for the movement a channel sits on now, assigned or not. */
export function placementLabel(placement?: Placement): string {
  if (!placement || !placement.approach) return 'no movement'
  return movementLabel(placement.approach)
}

export function assign(
  baseline: Baseline,
  assignments: Assignments,
  channel: number,
  approachId: number | null
): Assignments {
  const was = placementLabel(placements(baseline, assignments).get(channel))
  return {
    ...assignments,
    [channel]: { approachId, was, at: new Date().toISOString() },
  }
}

/** The droppable id a phase card owns, and the channel a draggable id names. */
export const phaseDroppableId = (phase: number) => `phase-${phase}`
export const trayDroppableId = 'tray'
export const draggableId = (place: string, channel: number) =>
  `det-${place}-${channel}`
export function channelOf(id: string): number {
  return Number(id.slice(id.lastIndexOf('-') + 1))
}
export function phaseOf(droppableId: string): number | null {
  return droppableId.startsWith('phase-')
    ? Number(droppableId.slice('phase-'.length))
    : null
}
