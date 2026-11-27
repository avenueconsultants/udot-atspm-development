import {
  DragDropContext,
  Draggable,
  Droppable,
  type DropResult,
} from '@hello-pangea/dnd'
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
import {
  assign,
  channelOf,
  draggableId,
  phaseOf,
  placements as placementsOf,
  targetsFor,
  targetsForPhase,
  trayDroppableId,
  type Assignments,
} from '../assignments'
import { gateFailures, phaseGroups, stateMarks } from '../cards'
import { movementName, sharedProtectedPhases } from '../naming'
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
  const [assignments, setAssignments] = useState<Assignments>({})
  const [notice, setNotice] = useState<string | null>(null)
  const targets = targetsFor(baseline)
  const placements = placementsOf(baseline, assignments)

  const place = (channel: number, approachId: number | null) => {
    setNotice(null)
    setAssignments((current) => assign(baseline, current, channel, approachId))
  }

  // A drop says which phase, and an approach is what ATSPM actually stores. Where a phase has one
  // approach the drop settles it; where it has two the person has to say which, and where it has
  // none there is nothing to place the channel on, so the board says so instead of inventing one.
  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return
    const channel = channelOf(result.draggableId)
    const target = result.destination.droppableId
    if (target === trayDroppableId) {
      place(channel, null)
      return
    }
    const phase = phaseOf(target)
    if (phase == null) return
    const candidates = targetsForPhase(baseline, phase)
    if (candidates.length === 1) {
      place(channel, candidates[0].id)
      return
    }
    setNotice(
      candidates.length === 0
        ? `ATSPM has no movement on phase ${phase}, so channel ${channel} cannot be placed there yet. A movement has to exist first.`
        : `Phase ${phase} is carried by ${candidates.length} movements, so channel ${channel} needs one chosen from its menu: ${candidates
            .map((candidate) => candidate.label)
            .join('; ')}.`
    )
  }
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
    (detector) => !placements.get(detector.channel)?.approach
  )
  const failures = gateFailures(baseline, snapshot, assignments)
  const splits = snapshot ? splitTableFor(snapshot, pattern) : undefined
  const shared = sharedProtectedPhases(baseline)

  return (
    <DragDropContext onDragEnd={onDragEnd}>
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
              label={`${baseline.approaches.length} movements · ${declaredChannels.size} detectors in ATSPM`}
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
              <Typography
                key={key}
                variant="caption"
                sx={{ color: value.color }}
              >
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
              The ring, barrier and sequence slots are empty because ATSPM
              stores none of them. They fill when a controller snapshot is
              uploaded.
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
                    placements={placements}
                    assignments={assignments}
                    targets={targets}
                    onAssign={place}
                  />
                ))}
              </Stack>
            </Box>
          ))}

          <Box>
            <Typography variant="overline" color="text.secondary">
              Channels on no movement · {tray.length}
            </Typography>
            <Droppable droppableId={trayDroppableId} direction="horizontal">
              {(provided, dropping) => (
                <Stack
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  direction="row"
                  spacing={1}
                  flexWrap="wrap"
                  useFlexGap
                  sx={{
                    minHeight: 56,
                    p: 0.5,
                    borderRadius: 1,
                    border: '1px dashed',
                    borderColor: dropping.isDraggingOver
                      ? 'info.main'
                      : 'divider',
                  }}
                >
                  {tray.length === 0 && (
                    <Typography variant="caption" color="text.secondary">
                      Every channel the controller assigns sits on an approach.
                      Drop one here to take it off.
                    </Typography>
                  )}
                  {tray.map((detector, index) => (
                    <Draggable
                      key={detector.channel}
                      draggableId={draggableId('tray', detector.channel)}
                      index={index}
                    >
                      {(dragProvided, dragState) => (
                        <DetectorCard
                          channel={detector.channel}
                          controller={detector}
                          placement={placements.get(detector.channel)}
                          assignment={assignments[detector.channel]}
                          targets={targets}
                          onAssign={place}
                          items={items}
                          drag={{
                            ref: dragProvided.innerRef,
                            draggableProps: dragProvided.draggableProps,
                            dragHandleProps: dragProvided.dragHandleProps,
                            isDragging: dragState.isDragging,
                          }}
                        />
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </Stack>
              )}
            </Droppable>
          </Box>

          {notice && (
            <Alert severity="info" onClose={() => setNotice(null)}>
              {notice}
            </Alert>
          )}

          {shared.length > 0 && (
            <Alert severity="warning">
              <Typography variant="body2">
                Two movements share a protected phase. That is legitimate under
                split phasing, and the phase-keyed measures — Purdue
                coordination, corridor offsets, left turn gap — look a movement
                up by its protected phase number and take the first match, so
                only one of them reaches those charts.
              </Typography>
              <Stack component="ul" sx={{ pl: 2, m: 0 }}>
                {shared.map((entry) => (
                  <Typography
                    component="li"
                    variant="caption"
                    key={`${entry.overlap ? 'o' : 'p'}-${entry.phase}`}
                  >
                    {entry.overlap ? 'Overlap' : 'Phase'} {entry.phase}:{' '}
                    {entry.approaches
                      .map((approach) => movementName(approach))
                      .join(', ')}
                  </Typography>
                ))}
              </Stack>
            </Alert>
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
    </DragDropContext>
  )
}
