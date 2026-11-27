import { placements, type Assignments } from './assignments'
import type { Baseline, ControllerSnapshot, Phase, ReviewItem } from './types'

/**
 * The four states a card can be in. They are derived from the classifications the comparison
 * already produces rather than invented here, and each is rendered with a glyph and a label as
 * well as a color, because red against green is the most common color blindness and this page is
 * read on a laptop in daylight.
 */
export type CardState = 'agreed' | 'notHeld' | 'disagrees' | 'needsPerson'

export const stateMarks: Record<
  CardState,
  { glyph: string; label: string; color: string }
> = {
  agreed: { glyph: '=', label: 'Agrees with ATSPM', color: 'text.secondary' },
  notHeld: { glyph: '+', label: 'ATSPM holds nothing', color: 'info.main' },
  disagrees: { glyph: '!', label: 'Disagrees with ATSPM', color: 'error.main' },
  needsPerson: { glyph: '?', label: 'Needs a person', color: 'warning.main' },
}

const rank: Record<CardState, number> = {
  agreed: 0,
  notHeld: 1,
  needsPerson: 2,
  disagrees: 3,
}

export function stateOf(item: ReviewItem): CardState {
  if (item.classification === 'Certain')
    return item.baselineValue === 'null' ? 'notHeld' : 'disagrees'
  if (item.classification === 'NotComparable') return 'agreed'
  return 'needsPerson'
}

/** The worst state among a card's fields, since a card shows one mark for the whole card. */
export function worstState(items: ReviewItem[]): CardState {
  return items.reduce<CardState>(
    (worst, item) =>
      rank[stateOf(item)] > rank[worst] ? stateOf(item) : worst,
    'agreed'
  )
}

export function itemsFor(items: ReviewItem[], prefixes: string[]) {
  return items.filter((item) =>
    prefixes.some(
      (prefix) => item.field === prefix || item.field.startsWith(`${prefix}.`)
    )
  )
}

/** One entry of a card's own history: what a source said, and what it replaced. */
export type LedgerEntry = {
  field: string
  value: string
  was: string
  sources: string
  state: CardState
}

export function ledgerFor(items: ReviewItem[]): LedgerEntry[] {
  return items.map((item) => ({
    field: item.field,
    value: item.controllerValue === 'null' ? '—' : item.controllerValue,
    was: item.baselineValue === 'null' ? 'nothing stored' : item.baselineValue,
    sources: item.sources,
    state: stateOf(item),
  }))
}

export type GateFailure = { subject: string; missing: string[] }

const laneTypeNames: Record<number, string> = {
  1: 'vehicle',
  2: 'bike',
  3: 'pedestrian',
  4: 'exit',
  5: 'light rail',
  6: 'bus',
  7: 'heavy vehicle',
}

/**
 * What ATSPM cannot function without. The three NA enums are all zero and all save without
 * complaint, so they count as missing: a detector with MovementType = NA is indistinguishable from
 * a through movement by anything downstream. A detector with no DetectionType is worse - it joins
 * to MeasureType, so the channel is stored, looks configured, and feeds no chart at all.
 */
export function gateFailures(
  baseline: Baseline,
  snapshot: ControllerSnapshot | null,
  assignments: Assignments = {}
): GateFailure[] {
  const failures: GateFailure[] = []
  const placed = placements(baseline, assignments)
  for (const approach of baseline.approaches) {
    const missing: string[] = []
    if (!approach.direction) missing.push('direction')
    if (!approach.description?.trim()) missing.push('description')
    if (missing.length)
      failures.push({
        subject: `Approach ${approach.overlap ? 'overlap' : 'phase'} ${approach.phase}`,
        missing,
      })
  }
  for (const [channel, placement] of placed) {
    if (!placement.approach) continue
    const detector = placement.detector
    const missing: string[] = []
    if (!detector) {
      // Dragging a channel onto a phase records where it belongs and nothing else about it, so the
      // gate asks for the rest rather than saving a detector that feeds no measure.
      failures.push({
        subject: `Channel ${channel}`,
        missing: [
          'identifier',
          'movement',
          'lane type',
          'detection hardware',
          'at least one detection type — it feeds no measure without one',
        ],
      })
      continue
    }
    if (!detector.identifier?.trim()) missing.push('identifier')
    if (!detector.movement) missing.push('movement')
    if (!laneTypeNames[detector.laneType]) missing.push('lane type')
    if (!detector.hardware) missing.push('detection hardware')
    if (!detector.detectionTypes)
      missing.push(
        'at least one detection type — it feeds no measure without one'
      )
    if (missing.length)
      failures.push({ subject: `Channel ${channel}`, missing })
  }
  if (!snapshot) return failures

  const declared = new Set(
    baseline.approaches.flatMap((approach) => [
      ...(approach.overlap ? [] : [approach.phase]),
      ...(approach.permissiveOverlap || !approach.permissivePhase
        ? []
        : [approach.permissivePhase]),
    ])
  )
  const excluded = new Set(snapshot.phasesNotInUse.map(({ phase }) => phase))
  for (const phase of snapshot.phases)
    if (
      phase.inUse !== false &&
      !excluded.has(phase.phase) &&
      !declared.has(phase.phase)
    )
      failures.push({
        subject: `Phase ${phase.phase}`,
        missing: ['an approach to carry it'],
      })
  for (const detector of snapshot.detectors)
    if (detector.callPhase && !placed.get(detector.channel)?.approach)
      failures.push({
        subject: `Channel ${detector.channel}`,
        missing: [`an ATSPM detector on phase ${detector.callPhase}`],
      })
  return failures
}

/** Phase cards run in sequence order, lowest first, and group into the barrier they share. */
export function phaseGroups(
  snapshot: ControllerSnapshot | null,
  order: Map<number, number[]>
): Phase[][] {
  if (!snapshot) return []
  const excluded = new Set(snapshot.phasesNotInUse.map(({ phase }) => phase))
  const position = (phase: Phase) => {
    const index =
      phase.ring == null
        ? -1
        : (order.get(phase.ring)?.indexOf(phase.phase) ?? -1)
    return index < 0 ? Number.MAX_SAFE_INTEGER : index
  }
  const inService = snapshot.phases
    .filter((phase) => phase.inUse !== false && !excluded.has(phase.phase))
    .sort(
      (left, right) =>
        position(left) - position(right) || left.phase - right.phase
    )
  // Phases that may run together are already paired by the controller, so the cards arrive
  // grouped rather than asking the engineer to work out the pairing.
  const groups: Phase[][] = []
  for (const phase of inService) {
    const existing = groups.find((members) =>
      members.some(
        (member) =>
          member.concurrent?.includes(phase.phase) ||
          phase.concurrent?.includes(member.phase) ||
          (phase.barrier != null && member.barrier === phase.barrier)
      )
    )
    if (existing) existing.push(phase)
    else groups.push([phase])
  }
  return groups
}
