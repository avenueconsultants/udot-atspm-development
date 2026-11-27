import { Chip, Divider, Paper, Stack, Tooltip, Typography } from '@mui/material'
import {
  itemsFor,
  ledgerFor,
  stateMarks,
  worstState,
  type CardState,
} from '../cards'
import { programmedSplit, type Pattern } from '../splits'
import type {
  Baseline,
  BaselineApproach,
  ControllerSnapshot,
  Phase,
  ReviewItem,
} from '../types'
import CardLedger from './CardLedger'
import DetectorCard from './DetectorCard'
import MovementArrow, { directionNames } from './MovementArrow'

// Fields drawn in their own rows, so the generic settings block below shows only what is left and
// a parameter added to the contract appears with no change here.
const timing: [keyof Phase, string][] = [
  ['minGreen', 'Min green'],
  ['passage', 'Passage'],
  ['maxGreen1', 'Max 1'],
  ['maxGreen2', 'Max 2'],
  ['yellowChange', 'Yellow'],
  ['redClear', 'Red clear'],
  ['walk', 'Walk'],
  ['pedClear', 'Ped clear'],
]
const handled = new Set<string>([
  'phase',
  'source',
  'inUse',
  'ring',
  'barrier',
  'concurrent',
  ...timing.map(([property]) => property as string),
])

export type PhaseRole = {
  approach: BaselineApproach
  role: 'Protected' | 'Permissive' | 'Pedestrian'
}

export function rolesFor(baseline: Baseline, phase: number): PhaseRole[] {
  return baseline.approaches.flatMap((approach) => [
    ...(!approach.overlap && approach.phase === phase
      ? [{ approach, role: 'Protected' as const }]
      : []),
    ...(!approach.permissiveOverlap && approach.permissivePhase === phase
      ? [{ approach, role: 'Permissive' as const }]
      : []),
    ...(!approach.pedestrianOverlap && approach.pedestrianPhase === phase
      ? [{ approach, role: 'Pedestrian' as const }]
      : []),
  ])
}

export default function PhaseCard({
  phase,
  baseline,
  snapshot,
  pattern,
  items,
}: {
  phase: Phase
  baseline: Baseline
  snapshot: ControllerSnapshot
  pattern?: Pattern
  items: ReviewItem[]
}) {
  const own = itemsFor(items, [
    `phases.${phase.phase}`,
    `approaches.${phase.phase}`,
    `pedestrian.${phase.phase}`,
  ])
  const state: CardState = own.length ? worstState(own) : 'agreed'
  const mark = stateMarks[state]
  const roles = rolesFor(baseline, phase.phase)
  const split = programmedSplit(snapshot, phase, pattern)
  const channels = snapshot.detectors.filter(
    (detector) => detector.callPhase === phase.phase
  )
  const declared = roles.flatMap(({ approach }) =>
    approach.detectors.map((detector) => ({ approach, detector }))
  )
  const extra = Object.entries(phase).filter(
    ([property, value]) => !handled.has(property) && value != null
  )
  const overlaps = snapshot.overlaps.filter((overlap) =>
    overlap.includedPhases.includes(phase.phase)
  )
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.5,
        borderColor: state === 'agreed' ? 'divider' : mark.color,
        borderWidth: state === 'agreed' ? 1 : 2,
        minWidth: 290,
        flex: '1 1 290px',
      }}
    >
      <Stack spacing={1}>
        <Stack
          direction="row"
          spacing={0.75}
          alignItems="center"
          flexWrap="wrap"
          useFlexGap
        >
          {roles.length ? (
            roles
              .filter((entry) => entry.role !== 'Pedestrian')
              .map(({ approach, role }) => (
                <MovementArrow
                  key={`${approach.id}-${role}`}
                  direction={approach.direction}
                  movement={
                    approach.detectors[0]?.movement ||
                    (role === 'Permissive' ? 3 : 1)
                  }
                  protectedMovement={role === 'Protected'}
                />
              ))
          ) : (
            <MovementArrow direction={0} movement={0} />
          )}
          <Typography variant="subtitle1">Phase {phase.phase}</Typography>
          <Tooltip title={mark.label}>
            <Typography sx={{ color: mark.color }}>{mark.glyph}</Typography>
          </Tooltip>
          {phase.ring ? (
            <Chip size="small" label={`Ring ${phase.ring}`} />
          ) : null}
          {roles.some((entry) => entry.role === 'Pedestrian') ? (
            <Chip size="small" label="Ped declared" />
          ) : phase.walk && phase.pedClear ? (
            <Chip
              size="small"
              color="warning"
              label="Ped programmed, not declared"
            />
          ) : null}
          {overlaps.map((overlap) => (
            <Chip
              key={overlap.overlap}
              size="small"
              variant="outlined"
              label={`In overlap ${overlap.overlap}`}
            />
          ))}
        </Stack>

        <Typography variant="body2">
          {roles.length
            ? roles
                .map(
                  ({ approach, role }) =>
                    `${role}: ${directionNames[approach.direction] ?? 'unknown direction'}${
                      approach.description ? ` (${approach.description})` : ''
                    }`
                )
                .join(' · ')
            : 'Direction unknown — no ATSPM approach carries this phase.'}
        </Typography>

        <Divider />
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {timing.map(([property, label]) => (
            <Typography key={property} variant="caption" color="text.secondary">
              {label} {phase[property] ?? '—'}s
            </Typography>
          ))}
        </Stack>

        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Typography variant="caption">
            Programmed split{' '}
            {split
              ? `${split.seconds}s${split.basis === 'assumed' ? ' (position assumed)' : ''}`
              : '— no split table for this plan'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Average served — not loaded
          </Typography>
        </Stack>

        {extra.length > 0 && (
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {extra.map(([property, value]) => (
              <Typography
                key={property}
                variant="caption"
                color="text.secondary"
              >
                {property} {String(value)}
              </Typography>
            ))}
          </Stack>
        )}

        {(channels.length > 0 || declared.length > 0) && (
          <>
            <Divider />
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {channels.map((detector) => {
                const match = declared.find(
                  (entry) => entry.detector.channel === detector.channel
                )
                return (
                  <DetectorCard
                    key={detector.channel}
                    channel={detector.channel}
                    controller={detector}
                    declared={match?.detector}
                    approach={match?.approach}
                    items={items}
                  />
                )
              })}
              {declared
                .filter(
                  (entry) =>
                    !channels.some(
                      (detector) => detector.channel === entry.detector.channel
                    )
                )
                .map(({ approach, detector }) => (
                  <DetectorCard
                    key={detector.channel}
                    channel={detector.channel}
                    declared={detector}
                    approach={approach}
                    items={items}
                  />
                ))}
            </Stack>
          </>
        )}

        <CardLedger entries={ledgerFor(own)} />
      </Stack>
    </Paper>
  )
}
