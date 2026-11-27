import type {
  DraggableProvidedDragHandleProps,
  DraggableProvidedDraggableProps,
} from '@hello-pangea/dnd'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'
import {
  Box,
  IconButton,
  ListSubheader,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material'
import { useState, type ReactElement } from 'react'
import {
  placementLabel,
  type AssignTarget,
  type Assignment,
  type Placement,
} from '../assignments'
import {
  itemsFor,
  ledgerFor,
  stateMarks,
  worstState,
  type CardState,
} from '../cards'
import { movementName, phaseRoles } from '../naming'
import type { ControllerSnapshot, ReviewItem } from '../types'
import CardLedger from './CardLedger'
import MovementArrow, { movementNames } from './MovementArrow'

/** What @hello-pangea/dnd hands a draggable, kept structural so the card can render without it. */
export type DragBinding = {
  ref: (element: HTMLElement | null) => void
  draggableProps: DraggableProvidedDraggableProps
  dragHandleProps: DraggableProvidedDragHandleProps | null
  isDragging: boolean
}

export default function DetectorCard({
  channel,
  controller,
  placement,
  assignment,
  targets,
  onAssign,
  items,
  drag,
}: {
  channel: number
  controller?: ControllerSnapshot['detectors'][number]
  placement?: Placement
  assignment?: Assignment
  targets?: AssignTarget[]
  onAssign?: (channel: number, approachId: number | null) => void
  items: ReviewItem[]
  drag?: DragBinding
}): ReactElement {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const own = itemsFor(items, [`detectors.${channel}`])
  const state: CardState = own.length ? worstState(own) : 'agreed'
  const mark = stateMarks[state]
  const declared = placement?.detector
  const approach = placement?.approach
  return (
    <Paper
      ref={drag?.ref}
      {...(drag?.draggableProps ?? {})}
      variant="outlined"
      sx={{
        p: 1,
        minWidth: 168,
        borderColor: state === 'agreed' ? 'divider' : mark.color,
        borderWidth: state === 'agreed' ? 1 : 2,
        opacity: drag?.isDragging ? 0.85 : 1,
      }}
    >
      <Stack spacing={0.5}>
        <Stack direction="row" spacing={0.5} alignItems="center">
          {drag?.dragHandleProps ? (
            <Tooltip title={`Move channel ${channel} to another movement`}>
              {/* The handle has to be an HTMLElement: dnd refuses an svg, so the props go on a
                  span rather than on the icon itself. */}
              <Box
                component="span"
                {...drag.dragHandleProps}
                aria-label={`Move channel ${channel}`}
                sx={{ display: 'inline-flex', cursor: 'grab' }}
              >
                <DragIndicatorIcon
                  fontSize="small"
                  sx={{ color: 'text.disabled' }}
                />
              </Box>
            </Tooltip>
          ) : null}
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
          {targets && onAssign ? (
            <>
              <IconButton
                size="small"
                aria-label={`Assign channel ${channel} to a movement`}
                onClick={(event) => setAnchor(event.currentTarget)}
                sx={{ ml: 'auto', fontSize: 12 }}
              >
                ⋯
              </IconButton>
              <Menu
                anchorEl={anchor}
                open={Boolean(anchor)}
                onClose={() => setAnchor(null)}
              >
                {/* Grouped by leg, because "the westbound approach" is what an engineer looks
                    for first and the movements under it are what ATSPM stores. */}
                {targets.map((target, index) => [
                  ...(index === 0 || targets[index - 1].leg !== target.leg
                    ? [
                        <ListSubheader key={`${target.leg}-head`}>
                          {target.leg}
                        </ListSubheader>,
                      ]
                    : []),
                  <MenuItem
                    key={String(target.id)}
                    selected={approach ? approach.id === target.id : !target.id}
                    onClick={() => {
                      setAnchor(null)
                      onAssign(channel, target.id)
                    }}
                  >
                    {target.label}
                  </MenuItem>,
                ])}
              </Menu>
            </>
          ) : null}
        </Stack>
        <Typography variant="caption" color="text.secondary">
          {controller?.callPhase
            ? `Controller: calls phase ${controller.callPhase}`
            : controller
              ? 'Controller: no call phase'
              : 'Not in the controller read'}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {approach
            ? `ATSPM: ${movementName(approach)} · ${phaseRoles(approach)}${
                declared
                  ? ` · ${movementNames[declared.movement] ?? 'movement not entered'}`
                  : ' · movement not entered'
              }${declared?.lane ? ` · lane ${declared.lane}` : ''}`
            : 'ATSPM: on no movement'}
        </Typography>
        {controller && (controller.delay || controller.extend) ? (
          <Typography variant="caption" color="text.secondary">
            Delay {controller.delay ?? 0}s · Extend {controller.extend ?? 0}s
          </Typography>
        ) : null}
        {assignment ? (
          <Typography variant="caption" sx={{ color: 'info.main' }}>
            ✎ {placementLabel(placement)} · was {assignment.was} · you, not
            saved
          </Typography>
        ) : null}
        <CardLedger entries={ledgerFor(own)} />
      </Stack>
    </Paper>
  )
}
