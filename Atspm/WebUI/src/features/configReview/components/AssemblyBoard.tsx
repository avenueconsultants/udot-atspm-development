import {
  Alert,
  Box,
  Chip,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useState } from 'react'
import { gateFailures, phaseGroups, stateMarks } from '../cards'
import { ringOrder, splitTableFor } from '../splits'
import type { Baseline, ControllerSnapshot, ReviewItem } from '../types'
import DetectorCard from './DetectorCard'
import PhaseCard from './PhaseCard'
import RingBarrierDiagram from './RingBarrierDiagram'

/**
 * One location's section of the board: the structure for the selected plan, the phase cards in
 * sequence order grouped into the barriers the controller already pairs them into, and a tray of
 * the channels belonging to no ATSPM detector. Read-only for now - the drop targets, the
 * engineer's own placements and the write back to ATSPM follow, and the layout is built so they
 * attach to cards that already carry their own state and ledger.
 */
export default function AssemblyBoard({
  locationIdentifier,
  baseline,
  snapshot,
  items,
}: {
  locationIdentifier: string
  baseline: Baseline
  snapshot: ControllerSnapshot | null
  items: ReviewItem[]
}) {
  const [selected, setSelected] = useState<number | null>(null)
  const pattern =
    snapshot?.patterns.find((entry) => entry.pattern === selected) ??
    snapshot?.patterns[0]
  const { order, basis } = snapshot
    ? ringOrder(snapshot, pattern)
    : { order: new Map<number, number[]>(), basis: 'assumed' as const }
  const groups = phaseGroups(snapshot, order)
  const declaredChannels = new Set(
    baseline.approaches.flatMap((approach) =>
      approach.detectors.map((detector) => detector.channel)
    )
  )
  const tray = (snapshot?.detectors ?? []).filter(
    (detector) => !declaredChannels.has(detector.channel)
  )
  const failures = gateFailures(baseline, snapshot)
  const splits = snapshot ? splitTableFor(snapshot, pattern) : undefined

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          flexWrap="wrap"
          useFlexGap
        >
          <Typography variant="h6">Location {locationIdentifier}</Typography>
          <Chip
            size="small"
            label={`${baseline.approaches.length} approaches · ${declaredChannels.size} detectors in ATSPM`}
          />
          {snapshot && (
            <Chip
              size="small"
              label={`${snapshot.phases.length} phases · ${snapshot.detectors.length} channels read`}
            />
          )}
          <Chip
            size="small"
            color={failures.length ? 'warning' : 'success'}
            label={
              failures.length
                ? `${failures.length} to complete before saving`
                : 'Ready to save'
            }
          />
          {pattern && snapshot && snapshot.patterns.length > 0 && (
            <TextField
              select
              size="small"
              label="Plan"
              value={String(pattern.pattern)}
              onChange={(event) => setSelected(Number(event.target.value))}
              sx={{ minWidth: 150 }}
            >
              {snapshot.patterns.map((entry) => (
                <MenuItem key={entry.pattern} value={String(entry.pattern)}>
                  Pattern {entry.pattern} · {entry.cycle}s
                </MenuItem>
              ))}
            </TextField>
          )}
        </Stack>

        <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
          {Object.entries(stateMarks).map(([key, value]) => (
            <Typography key={key} variant="caption" sx={{ color: value.color }}>
              {value.glyph} {value.label}
            </Typography>
          ))}
        </Stack>

        {snapshot ? (
          <>
            {pattern && (
              <Typography variant="body2">
                Pattern {pattern.pattern}: cycle {pattern.cycle}s · offset{' '}
                {pattern.offset}s · split {pattern.splitNumber ?? '—'} ·
                sequence {pattern.sequenceNumber ?? '—'}
                {splits
                  ? basis === 'sequence'
                    ? ' · splits placed by sequence'
                    : ' · split positions assumed from ascending phase order'
                  : ' · no split table supplied'}
              </Typography>
            )}
            <RingBarrierDiagram
              snapshot={snapshot}
              pattern={pattern}
              items={items}
            />
          </>
        ) : (
          <Alert severity="info">
            The ring, barrier and sequence slots are empty because ATSPM stores
            none of them. They fill when a controller snapshot is uploaded.
          </Alert>
        )}

        {groups.map((group) => (
          <Box key={group.map((phase) => phase.phase).join('-')}>
            <Typography variant="overline" color="text.secondary">
              {group.length > 1
                ? `Run together: ${[...group]
                    .map((phase) => phase.phase)
                    .sort((left, right) => left - right)
                    .join(' + ')}`
                : `Phase ${group[0].phase}`}
            </Typography>
            <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
              {group.map((phase) => (
                <PhaseCard
                  key={phase.phase}
                  phase={phase}
                  baseline={baseline}
                  snapshot={snapshot as ControllerSnapshot}
                  pattern={pattern}
                  items={items}
                />
              ))}
            </Stack>
          </Box>
        ))}

        {tray.length > 0 && (
          <Box>
            <Typography variant="overline" color="text.secondary">
              Channels with no ATSPM detector · {tray.length}
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {tray.map((detector) => (
                <DetectorCard
                  key={detector.channel}
                  channel={detector.channel}
                  controller={detector}
                  items={items}
                />
              ))}
            </Stack>
          </Box>
        )}

        {failures.length > 0 && (
          <Alert severity="warning">
            <Typography variant="body2">
              This location cannot be saved back to ATSPM yet. Other locations
              are unaffected.
            </Typography>
            <Stack component="ul" sx={{ pl: 2, m: 0 }}>
              {failures.map((failure) => (
                <Typography
                  component="li"
                  variant="caption"
                  key={`${failure.subject}-${failure.missing.join()}`}
                >
                  {failure.subject} needs {failure.missing.join(', ')}
                </Typography>
              ))}
            </Stack>
          </Alert>
        )}
      </Stack>
    </Paper>
  )
}
