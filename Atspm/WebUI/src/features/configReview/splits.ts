import type { ControllerSnapshot, Phase } from './types'

export type Pattern = ControllerSnapshot['patterns'][number]

/**
 * Split seconds are stored by a phase's POSITION in its ring, not by phase number, and the
 * position comes from the pattern's sequence. Where the sequence definition is missing - NTCIP
 * reports the sequence number but not the sequence - the position falls back to ascending phase
 * order, which is the usual Econolite layout and is not proven for any one controller. The basis
 * travels with the value so nothing presents an assumed position as a measurement.
 */
export type SplitBasis = 'sequence' | 'assumed'

export function ringOrder(
  snapshot: ControllerSnapshot,
  pattern?: Pattern
): { order: Map<number, number[]>; basis: SplitBasis } {
  const excluded = new Set(snapshot.phasesNotInUse.map(({ phase }) => phase))
  const drawn = snapshot.phases.filter(
    (phase) =>
      phase.inUse !== false &&
      !excluded.has(phase.phase) &&
      phase.ring != null &&
      phase.ring > 0
  )
  const rings = [...new Set(drawn.map((phase) => phase.ring as number))].sort(
    (left, right) => left - right
  )
  const sequence = snapshot.sequences.find(
    (entry) => entry.sequenceNumber === pattern?.sequenceNumber
  )
  const order = new Map(
    rings.map((ring) => {
      const recorded = drawn
        .filter((phase) => phase.ring === ring)
        .map((phase) => phase.phase)
        .sort((left, right) => left - right)
      const defined = sequence?.ringPhases[String(ring)]
      return [
        ring,
        defined
          ? [
              ...defined,
              ...recorded.filter((number) => !defined.includes(number)),
            ]
          : recorded,
      ] as [number, number[]]
    })
  )
  return { order, basis: sequence ? 'sequence' : 'assumed' }
}

export function splitTableFor(snapshot: ControllerSnapshot, pattern?: Pattern) {
  return snapshot.splitTables.find(
    (entry) => entry.splitNumber === pattern?.splitNumber
  )
}

/** The programmed split for one phase under one pattern, with how its position was decided. */
export function programmedSplit(
  snapshot: ControllerSnapshot,
  phase: Phase,
  pattern?: Pattern
): { seconds: number; basis: SplitBasis } | null {
  const table = splitTableFor(snapshot, pattern)
  if (!table || phase.ring == null) return null
  const { order, basis } = ringOrder(snapshot, pattern)
  const position = order.get(phase.ring)?.indexOf(phase.phase) ?? -1
  const seconds = table.ringSplits[String(phase.ring)]?.[position]
  return position < 0 || seconds === undefined ? null : { seconds, basis }
}
