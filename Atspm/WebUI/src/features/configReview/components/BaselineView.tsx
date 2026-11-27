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
import { legs, movementName } from '../naming'
import type { Baseline, BaselineApproach } from '../types'

/** A phase, an overlap number, or nothing - and an overlap number is not a phase number. */
function phaseCell(phase: number | null, overlap: boolean): string {
  if (!phase) return '—'
  return `${overlap ? 'Overlap' : 'Phase'} ${phase}`
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
          label={`${baseline.approaches.length} movements · ${phases.length} declared phases · ${detectors.length} detectors`}
        />
      </Stack>

      {baseline.approaches.length === 0 ? (
        <Alert severity="warning">
          ATSPM declares no movements for this location, so there is nothing to
          compare a controller against yet.
        </Alert>
      ) : (
        <Stack spacing={2}>
          <Typography variant="h6">Movements ATSPM declares</Typography>
          {/* An Approach row is one movement: one direction, with the phase that runs it
              protected, the phase that runs it permissive, and its pedestrian phase. The leg an
              engineer calls an approach is the group of them sharing a direction, which is a
              heading here rather than a row, because ATSPM stores no such thing. */}
          {legs(baseline).map((leg) => (
            <Stack key={leg.direction} spacing={0.5}>
              <Typography variant="subtitle2">
                {leg.label} · {leg.approaches.length}{' '}
                {leg.approaches.length === 1 ? 'movement' : 'movements'}
              </Typography>
              <TableContainer>
                <Table size="small" aria-label={leg.label}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Movement</TableCell>
                      <TableCell>Protected</TableCell>
                      <TableCell>Permissive</TableCell>
                      <TableCell>Pedestrian</TableCell>
                      <TableCell>Detectors</TableCell>
                      <TableCell>Stored description</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {leg.approaches.map((approach) => (
                      <TableRow key={approach.id}>
                        <TableCell>{movementName(approach)}</TableCell>
                        <TableCell>
                          {phaseCell(approach.phase, approach.overlap)}
                        </TableCell>
                        <TableCell>
                          {phaseCell(
                            approach.permissivePhase,
                            approach.permissiveOverlap
                          )}
                        </TableCell>
                        <TableCell>
                          {phaseCell(
                            approach.pedestrianPhase,
                            approach.pedestrianOverlap
                          )}
                        </TableCell>
                        <TableCell>
                          {approach.detectors.length
                            ? approach.detectors
                                .map((detector) => detector.channel)
                                .join(', ')
                            : '—'}
                        </TableCell>
                        <TableCell>{approach.description ?? '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Stack>
          ))}
        </Stack>
      )}

      <Stack spacing={1}>
        <Typography variant="h6">Detectors ATSPM declares</Typography>
        {detectors.length ? (
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            {detectors.map(({ approach, detector }) => (
              <Chip
                key={detector.id}
                label={`Ch ${detector.channel} · ${movementName(approach)} · ${
                  approach.overlap ? 'Overlap' : 'Phase'
                } ${approach.phase} · ${
                  movements[detector.movement] ?? ''
                }${detector.lane ? ` · lane ${detector.lane}` : ''}`}
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
            not stored here. ATSPM records which phase a movement watches, not
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
