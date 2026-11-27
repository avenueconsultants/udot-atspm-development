import { Paper, Stack, Typography } from '@mui/material'
import {
  itemsFor,
  ledgerFor,
  stateMarks,
  worstState,
  type CardState,
} from '../cards'
import type { BaselineApproach, ControllerSnapshot, ReviewItem } from '../types'
import CardLedger from './CardLedger'
import MovementArrow, { movementNames } from './MovementArrow'

export type BaselineDetector = BaselineApproach['detectors'][number]

export default function DetectorCard({
  channel,
  controller,
  declared,
  approach,
  items,
}: {
  channel: number
  controller?: ControllerSnapshot['detectors'][number]
  declared?: BaselineDetector
  approach?: BaselineApproach
  items: ReviewItem[]
}) {
  const own = itemsFor(items, [`detectors.${channel}`])
  const state: CardState = own.length ? worstState(own) : 'agreed'
  const mark = stateMarks[state]
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1,
        minWidth: 168,
        borderColor: state === 'agreed' ? 'divider' : mark.color,
        borderWidth: state === 'agreed' ? 1 : 2,
      }}
    >
      <Stack spacing={0.5}>
        <Stack direction="row" spacing={0.75} alignItems="center">
          {declared && approach ? (
            <MovementArrow
              direction={approach.direction}
              movement={declared.movement}
              size={20}
            />
          ) : null}
          <Typography variant="subtitle2">Channel {channel}</Typography>
          <Typography variant="caption" sx={{ color: mark.color }}>
            {mark.glyph}
          </Typography>
        </Stack>
        <Typography variant="caption" color="text.secondary">
          {controller?.callPhase
            ? `Controller: calls phase ${controller.callPhase}`
            : controller
              ? 'Controller: no call phase'
              : 'Not in the controller read'}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {declared && approach
            ? `ATSPM: ${approach.overlap ? 'overlap' : 'phase'} ${approach.phase}, ${
                movementNames[declared.movement] ?? 'unknown movement'
              }${declared.lane ? `, lane ${declared.lane}` : ''}`
            : 'ATSPM: unassigned'}
        </Typography>
        {controller && (controller.delay || controller.extend) ? (
          <Typography variant="caption" color="text.secondary">
            Delay {controller.delay ?? 0}s · Extend {controller.extend ?? 0}s
          </Typography>
        ) : null}
        <CardLedger entries={ledgerFor(own)} />
      </Stack>
    </Paper>
  )
}
