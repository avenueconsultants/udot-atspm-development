import type { Baseline, BaselineApproach } from './types'

/**
 * What an `Approach` row is, said the way an engineer reads a timing sheet.
 *
 * The row holds one direction, one protected phase, an optional permissive phase and an optional
 * pedestrian phase. The protected/permissive pair is a property of a single movement - "protected
 * on 5, permissive on 2" is the westbound left, while the westbound through is protected on 2 with
 * no permissive - so one row cannot describe a whole leg that has a protected left. The entity is
 * a movement, and the leg an engineer calls an approach is a group of them sharing a direction.
 *
 * The movement itself is not stored on the row: it lives on each detector's MovementType, which is
 * what every movement-aware report reads. So the name here is derived from the detectors, and a row
 * whose detectors disagree says so rather than picking one.
 */
export const directionAbbr: Record<number, string> = {
  0: '??',
  1: 'NB',
  2: 'SB',
  3: 'EB',
  4: 'WB',
  5: 'NE',
  6: 'NW',
  7: 'SE',
  8: 'SW',
}

export const legNames: Record<number, string> = {
  0: 'Direction not entered',
  1: 'Northbound approach',
  2: 'Southbound approach',
  3: 'Eastbound approach',
  4: 'Westbound approach',
  5: 'Northeastbound approach',
  6: 'Northwestbound approach',
  7: 'Southeastbound approach',
  8: 'Southwestbound approach',
}

export const movementAbbr: Record<number, string> = {
  1: 'T',
  2: 'R',
  3: 'L',
  4: 'TR',
  5: 'TL',
  6: 'NW',
  7: 'LTR',
  8: 'X',
}

/**
 * The movement letters for a row, taken from its detectors. Two different movements on one row is
 * a row being used as a leg, which is worth seeing rather than hiding behind the first one.
 */
export function movementTag(approach: BaselineApproach): string {
  const tags = [
    ...new Set(
      approach.detectors
        .map((detector) => movementAbbr[detector.movement])
        .filter((tag): tag is string => Boolean(tag))
    ),
  ]
  return tags.join('/')
}

/** `WBL`, or `WB` where no detector says which movement it is. */
export function movementName(approach: BaselineApproach): string {
  return `${directionAbbr[approach.direction] ?? '??'}${movementTag(approach)}`
}

/** `protected 5 · permissive 2 · ped 2`, with overlaps named as overlaps. */
export function phaseRoles(approach: BaselineApproach): string {
  const part = (label: string, phase: number | null, overlap: boolean) =>
    phase ? [`${label} ${overlap ? 'overlap ' : ''}${phase}`] : []
  return [
    ...part('protected', approach.phase, approach.overlap),
    ...part('permissive', approach.permissivePhase, approach.permissiveOverlap),
    ...part('ped', approach.pedestrianPhase, approach.pedestrianOverlap),
  ].join(' · ')
}

/** The whole label: `WBL · protected 5 · permissive 2`. */
export function movementLabel(approach: BaselineApproach): string {
  return `${movementName(approach)} · ${phaseRoles(approach)}`
}

export function legName(direction: number): string {
  return legNames[direction] ?? legNames[0]
}

/** The movements grouped into the legs an engineer means by "approach". */
export function legs(
  baseline: Baseline
): { direction: number; label: string; approaches: BaselineApproach[] }[] {
  const grouped: {
    direction: number
    label: string
    approaches: BaselineApproach[]
  }[] = []
  for (const approach of [...baseline.approaches].sort(
    (left, right) =>
      left.direction - right.direction ||
      left.phase - right.phase ||
      Number(left.overlap) - Number(right.overlap)
  )) {
    const leg = grouped.find((entry) => entry.direction === approach.direction)
    if (leg) leg.approaches.push(approach)
    else
      grouped.push({
        direction: approach.direction,
        label: legName(approach.direction),
        approaches: [approach],
      })
  }
  return grouped
}

/**
 * Rows claiming the same protected phase. Legitimate under split phasing, and still worth saying:
 * the phase-keyed measures - Purdue coordination, corridor offsets, left turn gap - look the
 * movement up with FirstOrDefault on the protected phase number, so one of the rows is picked and
 * the others' detectors never reach those charts.
 */
export function sharedProtectedPhases(
  baseline: Baseline
): { phase: number; overlap: boolean; approaches: BaselineApproach[] }[] {
  const shared: {
    phase: number
    overlap: boolean
    approaches: BaselineApproach[]
  }[] = []
  for (const approach of baseline.approaches) {
    const existing = shared.find(
      (entry) =>
        entry.phase === approach.phase && entry.overlap === approach.overlap
    )
    if (existing) existing.approaches.push(approach)
    else
      shared.push({
        phase: approach.phase,
        overlap: approach.overlap,
        approaches: [approach],
      })
  }
  return shared.filter((entry) => entry.approaches.length > 1)
}
