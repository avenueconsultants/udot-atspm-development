import { ConfigEnum, useConfigEnums } from '@/hooks/useConfigEnums'
import {
  Alert,
  Button,
  Drawer,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useState } from 'react'
import type { Annotation, ReviewItem } from '../types'

export default function AnnotationDrawer({
  item,
  onClose,
  onSave,
  busy,
}: {
  item: ReviewItem
  onClose: () => void
  onSave: (disposition: string, annotation: Annotation | null) => void
  busy: boolean
}) {
  const saved = item.annotation
    ? (JSON.parse(item.annotation) as Annotation)
    : null
  const [disposition, setDisposition] = useState(item.disposition)
  const [basis, setBasis] = useState(saved?.basis ?? '')
  const [reason, setReason] = useState(saved?.reason ?? '')
  const [confidence, setConfidence] = useState(
    saved?.confidence?.toString() ?? ''
  )
  const [direction, setDirection] = useState(saved?.direction?.toString() ?? '')
  const [movement, setMovement] = useState(saved?.movement?.toString() ?? '')
  const [lane, setLane] = useState(saved?.lane?.toString() ?? '')
  const { data: directions } = useConfigEnums(ConfigEnum.DirectionTypes)
  const { data: movements } = useConfigEnums(ConfigEnum.MovementTypes)
  const assignment = item.classification === 'NeedsDirection'
  const detector = assignment && item.group === 'detectors'
  const conflict = item.field.startsWith('!')
  const invalid =
    (basis !== '' &&
      (!reason.trim() || (basis === 'Inferred' && confidence === ''))) ||
    (disposition === 'Accepted' &&
      assignment &&
      (!basis || !direction || (detector && (!movement || !lane)))) ||
    (conflict && ['Accepted', 'Rejected'].includes(disposition) && !basis)
  const number = (value: string) => (value === '' ? null : Number(value))

  return (
    <Drawer anchor="right" open onClose={busy ? undefined : onClose}>
      <Stack
        component="form"
        spacing={2}
        sx={{ width: { xs: '100vw', sm: 460 }, p: 3 }}
        onSubmit={(event) => {
          event.preventDefault()
          if (invalid || busy) return
          onSave(
            disposition,
            basis === ''
              ? null
              : {
                  basis,
                  reason,
                  confidence: number(confidence),
                  direction: number(direction),
                  movement: number(movement),
                  lane: number(lane),
                }
          )
        }}
      >
        <Typography variant="h5">Review difference</Typography>
        <Typography>{item.summary}</Typography>
        {conflict && (
          <Alert severity="warning">
            Record how the displayed controller value was reviewed to unblock
            this group.
          </Alert>
        )}
        <TextField
          select
          label="Disposition"
          value={disposition}
          onChange={(event) => setDisposition(event.target.value)}
        >
          {['Pending', 'Accepted', 'Rejected', 'Deferred'].map((value) => (
            <MenuItem key={value} value={value}>
              {value}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Evidence"
          value={basis}
          onChange={(event) => setBasis(event.target.value)}
        >
          <MenuItem value="">No annotation</MenuItem>
          <MenuItem value="Measured">Measured</MenuItem>
          <MenuItem value="Inferred">Inferred</MenuItem>
        </TextField>
        {basis && (
          <>
            <TextField
              label="Basis and reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              multiline
              required
              inputProps={{ maxLength: 512 }}
            />
            {basis === 'Inferred' && (
              <TextField
                type="number"
                label="Confidence (0–1)"
                value={confidence}
                onChange={(event) => setConfidence(event.target.value)}
                required
                inputProps={{ min: 0, max: 1, step: 'any' }}
              />
            )}
            {assignment && (
              <TextField
                select
                label="Direction"
                value={direction}
                onChange={(event) => setDirection(event.target.value)}
              >
                <MenuItem value="">Choose a direction</MenuItem>
                {directions
                  ?.filter((value) => value.value !== 0)
                  .map((value) => (
                    <MenuItem key={value.value} value={String(value.value)}>
                      {value.name}
                    </MenuItem>
                  ))}
              </TextField>
            )}
            {detector && (
              <>
                <TextField
                  select
                  label="Movement"
                  value={movement}
                  onChange={(event) => setMovement(event.target.value)}
                >
                  <MenuItem value="">Choose a movement</MenuItem>
                  {movements
                    ?.filter((value) => value.value !== 0)
                    .map((value) => (
                      <MenuItem key={value.value} value={String(value.value)}>
                        {value.name}
                      </MenuItem>
                    ))}
                </TextField>
                <TextField
                  type="number"
                  label="Lane"
                  value={lane}
                  onChange={(event) => setLane(event.target.value)}
                  inputProps={{ min: 1, step: 1 }}
                />
              </>
            )}
          </>
        )}
        <Stack direction="row" spacing={1}>
          <Button disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button variant="contained" type="submit" disabled={invalid || busy}>
            Save decision
          </Button>
        </Stack>
      </Stack>
    </Drawer>
  )
}
