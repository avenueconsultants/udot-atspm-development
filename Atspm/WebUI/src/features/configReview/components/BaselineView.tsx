import {
  Alert,
  Box,
  Chip,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import type { Baseline, BaselineApproach } from '../types'

const directions: Record<number, string> = {
  0: '—',
  1: 'NB',
  2: 'SB',
  3: 'EB',
  4: 'WB',
  5: 'NE',
  6: 'NW',
  7: 'SE',
  8: 'SW',
}
const movements: Record<number, string> = {
  0: '—',
  1: 'Through',
  2: 'Right',
  3: 'Left',
  4: 'Through/Right',
  5: 'Through/Left',
  6: 'Northwest',
  7: 'Left/Through/Right',
  8: 'Crosswalk',
}

/** The phases ATSPM declares, each with the approach that carries it. */
export type DeclaredPhase = {
  phase: number
  overlap: boolean
  role: 'Protected' | 'Permissive' | 'Pedestrian'
  approach: BaselineApproach
}

export function declaredPhases(baseline: Baseline): DeclaredPhase[] {
  const declared = baseline.approaches.flatMap((approach) => [
    {
      phase: approach.phase,
      overlap: approach.overlap,
      role: 'Protected' as const,
      approach,
    },
    ...(approach.permissivePhase
      ? [
          {
            phase: approach.permissivePhase,
            overlap: approach.permissiveOverlap,
            role: 'Permissive' as const,
            approach,
          },
        ]
      : []),
    ...(approach.pedestrianPhase
      ? [
          {
            phase: approach.pedestrianPhase,
            overlap: approach.pedestrianOverlap,
            role: 'Pedestrian' as const,
            approach,
          },
        ]
      : []),
  ])
  // An overlap number and a phase number are different things that look alike, so a
  // protected overlap 2 and a protected phase 2 are not the same row and must not be
  // folded together.
  return declared.sort(
    (left, right) =>
      Number(left.overlap) - Number(right.overlap) ||
      left.phase - right.phase ||
      left.role.localeCompare(right.role)
  )
}

/**
 * What ATSPM holds for this location before any controller file is uploaded. It is
 * deliberately explicit about the things ATSPM has no field for - ring, barrier, sequence
 * and phase timing - because the gap is the reason a controller snapshot is needed, and a
 * section that is simply absent reads as a location with nothing programmed.
 */
export default function BaselineView({ baseline }: { baseline: Baseline }) {
  const phases = declaredPhases(baseline)
  const detectors = baseline.approaches.flatMap((approach) =>
    approach.detectors.map((detector) => ({ approach, detector }))
  )
  const fields = Object.entries(baseline.fields ?? {}).sort(([left], [right]) =>
    left.localeCompare(right)
  )
  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Chip label={`Configuration version ${baseline.locationId}`} />
        <Chip label={`Effective ${baseline.start.slice(0, 10)}`} />
        <Chip
          label={`${baseline.approaches.length} approaches · ${phases.length} declared phases · ${detectors.length} detectors`}
        />
      </Stack>

      {phases.length === 0 ? (
        <Alert severity="warning">
          ATSPM declares no approaches for this location, so there is nothing to
          compare a controller against yet.
        </Alert>
      ) : (
        <Stack spacing={1}>
          <Typography variant="h6">Phases ATSPM declares</Typography>
          <TableContainer>
            <Table size="small" aria-label="Phases ATSPM declares">
              <TableHead>
                <TableRow>
                  <TableCell>Phase</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>Overlap</TableCell>
                  <TableCell>Direction</TableCell>
                  <TableCell>Approach</TableCell>
                  <TableCell>Detectors</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {phases.map((entry) => (
                  <TableRow
                    key={`${entry.role}-${entry.overlap ? 'o' : 'p'}-${entry.phase}-${entry.approach.id}`}
                  >
                    <TableCell>{entry.phase}</TableCell>
                    <TableCell>{entry.role}</TableCell>
                    <TableCell>
                      {entry.overlap ? (
                        <Chip size="small" label="Overlap" />
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell>
                      {directions[entry.approach.direction] ??
                        entry.approach.direction}
                    </TableCell>
                    <TableCell>{entry.approach.description ?? '—'}</TableCell>
                    <TableCell>
                      {entry.role === 'Protected' &&
                      entry.approach.detectors.length
                        ? entry.approach.detectors
                            .map((detector) => detector.channel)
                            .join(', ')
                        : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Stack>
      )}

      <Stack spacing={1}>
        <Typography variant="h6">Detectors ATSPM declares</Typography>
        {detectors.length ? (
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            {detectors.map(({ approach, detector }) => (
              <Chip
                key={detector.id}
                label={`Ch ${detector.channel} · ${
                  approach.overlap ? 'Overlap' : 'Phase'
                } ${approach.phase} · ${
                  directions[approach.direction] ?? approach.direction
                } ${movements[detector.movement] ?? ''}${
                  detector.lane ? ` · lane ${detector.lane}` : ''
                }`}
              />
            ))}
          </Stack>
        ) : (
          <Typography>
            ATSPM declares no detectors here. Every measure that counts vehicles
            is empty until some are.
          </Typography>
        )}
      </Stack>

      {fields.length > 0 && (
        <Stack spacing={1}>
          <Typography variant="h6">Values ATSPM has stored</Typography>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            {fields.map(([field, value]) => (
              <Chip
                key={field}
                variant="outlined"
                label={`${field} ${value}`}
              />
            ))}
          </Stack>
        </Stack>
      )}

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={1}>
          <Typography variant="subtitle2">
            What ATSPM has no field for
          </Typography>
          <Typography variant="body2">
            Ring and barrier assignments, the phase sequence, overlap membership
            and every phase timing value - minimum green, passage, maximum
            green, yellow, red clearance, walk and pedestrian clearance - are
            not stored here. ATSPM records which phase an approach watches, not
            how the controller runs it. Upload a controller snapshot to see the
            ring and barrier diagram, the sequence and the timing, and to find
            out whether the phases above are the ones actually in service.
          </Typography>
          <Box>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              {[
                'rings',
                'barriers',
                'sequence',
                'overlap membership',
                'phase timing',
                'coordination patterns',
              ].map((missing) => (
                <Chip key={missing} size="small" label={missing} />
              ))}
            </Stack>
          </Box>
        </Stack>
      </Paper>
    </Stack>
  )
}
