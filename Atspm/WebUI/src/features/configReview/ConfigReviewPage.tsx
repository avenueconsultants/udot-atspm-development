import { ResponsivePageLayout } from '@/components/ResponsivePage'
import { useGetRoute } from '@/features/routes/api/getRoutes'
import Authorization from '@/lib/Authorization'
import { toDateStamp } from '@/utils/dateTime'
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { isAxiosError } from 'axios'
import Cookies from 'js-cookie'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from 'react-query'
import {
  annotateItem,
  createReviews,
  getReview,
  getReviews,
  getRouteReview,
  loadBaseline,
  promoteReview,
  uploadSnapshot,
} from './api'
import AnnotationDrawer from './components/AnnotationDrawer'
import BaselineView from './components/BaselineView'
import RingBarrierDiagram, {
  phaseProvenance,
} from './components/RingBarrierDiagram'
import type { ControllerSnapshot, Phase, ReviewItem } from './types'

const groupNames: Record<string, string> = {
  phases: 'phases',
  phaseTiming: 'phase timing',
  phaseStructure: 'ring and phase structure',
  overlaps: 'overlaps',
  patterns: 'coordination patterns',
  splitTables: 'split tables',
  sequences: 'sequence definitions',
  detectors: 'detector assignments',
  configWrittenAt: 'cabinet write date',
}
// Almost nothing a controller holds has a field in ATSPM, so most Certain items are not
// disagreements at all - they are values ATSPM has never stored. Listing them under one
// heading with the real conflicts buries the handful worth arguing about.
const sections: {
  classification: string
  label: string
  stored?: boolean
}[] = [
  {
    classification: 'Certain',
    label: 'Values that disagree',
    stored: true,
  },
  {
    classification: 'Certain',
    label: 'Values ATSPM does not hold',
    stored: false,
  },
  { classification: 'NeedsDirection', label: 'Needs direction' },
  { classification: 'Held', label: 'Held' },
  { classification: 'NotComparable', label: 'Not comparable' },
]
const labels: [keyof Phase, string][] = [
  ['minGreen', 'Min green'],
  ['passage', 'Passage'],
  ['maxGreen1', 'Max green 1'],
  ['maxGreen2', 'Max green 2'],
  ['yellowChange', 'Yellow'],
  ['redClear', 'Red clearance'],
  ['walk', 'Walk'],
  ['pedClear', 'Ped clearance'],
]
const has = (permission: string) =>
  (Cookies.get('claims') ?? '')
    .split(',')
    .some((claim) => claim.trim() === 'Admin' || claim.trim() === permission)
const displayError = (error: unknown) => {
  if (isAxiosError(error)) {
    const response = error.response
    return (
      response?.data?.detail ??
      response?.data?.title ??
      response?.data ??
      (response?.status === 403
        ? 'This action requires additional configuration permissions.'
        : error.message)
    )
  }
  return error instanceof Error ? error.message : 'The request failed.'
}

function ReviewList() {
  const router = useRouter()
  const { data: routes } = useGetRoute()
  const reviews = useQuery(['configuration-reviews'], getReviews)
  const [date, setDate] = useState(() => toDateStamp(new Date()))
  const [subject, setSubject] = useState('location')
  const [location, setLocation] = useState('')
  const [route, setRoute] = useState('')
  const create = useMutation(createReviews, {
    onSuccess: (created) => {
      if (created[0]?.batchId)
        return router.push('/admin/config-review?batch=' + created[0].batchId)
      if (created.length === 1)
        return router.push(`/admin/config-review/${created[0].id}`)
      return reviews.refetch().then(() => undefined)
    },
  })

  return (
    <Stack spacing={2}>
      <Typography>
        Compare controller snapshots with the ATSPM configuration in effect on a
        selected date.
      </Typography>
      {has('LocationConfiguration:Edit') && (
        <Paper
          component="form"
          variant="outlined"
          sx={{ p: 2 }}
          onSubmit={(event) => {
            event.preventDefault()
            if (!date || (subject === 'location' ? !location.trim() : !route))
              return
            create.mutate({
              asOfDate: date,
              ...(subject === 'location'
                ? { locationIdentifier: location.trim() }
                : { routeId: Number(route) }),
            })
          }}
        >
          <Stack
            spacing={2}
            direction={{ xs: 'column', sm: 'row' }}
            alignItems={{ sm: 'center' }}
          >
            <TextField
              select
              label="Review scope"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
            >
              <MenuItem value="location">Location</MenuItem>
              <MenuItem value="route">Route</MenuItem>
            </TextField>
            {subject === 'location' ? (
              <TextField
                label="Location identifier"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                required
                inputProps={{ maxLength: 64 }}
              />
            ) : (
              <TextField
                select
                label="Route"
                value={route}
                onChange={(event) => setRoute(event.target.value)}
                required
                sx={{ minWidth: 250 }}
              >
                {(routes?.value ?? []).map((entry) => (
                  <MenuItem key={entry.id} value={String(entry.id)}>
                    {entry.name}
                  </MenuItem>
                ))}
              </TextField>
            )}
            <TextField
              type="date"
              label="As-of date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              InputLabelProps={{ shrink: true }}
              required
            />
            <Button
              variant="contained"
              type="submit"
              disabled={create.isLoading}
            >
              Create review
            </Button>
          </Stack>
        </Paper>
      )}
      {create.isError && (
        <Alert severity="error">{String(displayError(create.error))}</Alert>
      )}
      {create.data && create.data.length > 1 && (
        <Alert severity="success">
          Created {create.data.length} location reviews. Open each location to
          capture its baseline and upload its snapshot.
        </Alert>
      )}
      {reviews.isError && (
        <Alert severity="error">{String(displayError(reviews.error))}</Alert>
      )}
      {reviews.isLoading && (
        <Typography>Loading configuration reviews…</Typography>
      )}
      {reviews.data && (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small" aria-label="Configuration reviews">
            <TableHead>
              <TableRow>
                <TableCell>Location</TableCell>
                <TableCell>As-of date</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {reviews.data.map((review) => (
                <TableRow key={review.id}>
                  <TableCell>
                    <Link href={`/admin/config-review/${review.id}`}>
                      {review.locationIdentifier}
                    </Link>
                  </TableCell>
                  <TableCell>{review.asOfDate.slice(0, 10)}</TableCell>
                  <TableCell>{review.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {reviews.data.length === 0 && (
            <Typography sx={{ p: 2 }}>No reviews have been created.</Typography>
          )}
        </TableContainer>
      )}
    </Stack>
  )
}

function SnapshotView({
  snapshot,
  items,
}: {
  snapshot: ControllerSnapshot
  items: ReviewItem[]
}) {
  const [selected, setSelected] = useState<number | null>(null)
  const pattern =
    snapshot.patterns.find((entry) => entry.pattern === selected) ??
    snapshot.patterns[0]
  const excluded = new Set(snapshot.phasesNotInUse.map((phase) => phase.phase))
  const phases = snapshot.phases.filter(
    (phase) => phase.inUse !== false && !excluded.has(phase.phase)
  )
  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Chip label={`${snapshot.make} ${snapshot.model}`} />
        {snapshot.firmware && (
          <Chip
            label={`${snapshot.firmware.text}${snapshot.firmware.version ? ` ${snapshot.firmware.version}` : ''}`}
          />
        )}
      </Stack>
      <Typography variant="body2">
        Read on {snapshot.collectedAt}
        {snapshot.configWrittenAt &&
          ` · Cabinet wrote on ${snapshot.configWrittenAt}`}
      </Typography>
      {snapshot.unavailable.map((group) => (
        <Alert key={group} severity="info">
          The supplied sources cannot tell you about{' '}
          {groupNames[group] ?? group}.
        </Alert>
      ))}
      {snapshot.phasesNotInUse.length > 0 && (
        <Typography variant="body2">
          Phases excluded from service:{' '}
          {snapshot.phasesNotInUse
            .map((phase) => `${phase.phase} (${phase.reason})`)
            .join(', ')}
        </Typography>
      )}
      {snapshot.conflicts.map((conflict, index) => (
        <Alert severity="warning" key={`${conflict.field}-${index}`}>
          {conflict.field} · {JSON.stringify(conflict.firstValue)} (
          {conflict.firstSource}) and {JSON.stringify(conflict.secondValue)} (
          {conflict.secondSource})
        </Alert>
      ))}
      {pattern && (
        <Stack
          direction="row"
          spacing={2}
          alignItems="center"
          flexWrap="wrap"
          useFlexGap
        >
          <TextField
            select
            label="Coordination pattern"
            size="small"
            value={String(pattern.pattern)}
            onChange={(event) => setSelected(Number(event.target.value))}
          >
            {snapshot.patterns.map((entry) => (
              <MenuItem key={entry.pattern} value={String(entry.pattern)}>
                Pattern {entry.pattern}
              </MenuItem>
            ))}
          </TextField>
          <Typography variant="body2">
            Cycle {pattern.cycle}s · Offset {pattern.offset}s · Split{' '}
            {pattern.splitNumber ?? '—'} · Sequence{' '}
            {pattern.sequenceNumber ?? '—'}
          </Typography>
        </Stack>
      )}
      <RingBarrierDiagram snapshot={snapshot} pattern={pattern} items={items} />
      {phases.length > 0 && (
        <TableContainer>
          <Table size="small" aria-label="Phase timing">
            <TableHead>
              <TableRow>
                <TableCell>Phase</TableCell>
                {labels.map(([property, label]) => (
                  <TableCell key={property}>{label} (s)</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {phases.map((phase) => (
                <TableRow
                  key={phase.phase}
                  title={phaseProvenance(phase, items)}
                >
                  <TableCell>{phase.phase}</TableCell>
                  {labels.map(([property]) => {
                    const item = items.find(
                      (entry) =>
                        entry.field === `phases.${phase.phase}.${property}`
                    )
                    return (
                      <TableCell
                        key={property}
                        sx={
                          item
                            ? { color: 'primary.main', fontWeight: 'bold' }
                            : undefined
                        }
                        title={
                          item
                            ? `ATSPM: ${item.baselineValue}. Controller: ${item.controllerValue}. ${item.sources}`
                            : undefined
                        }
                      >
                        {phase[property] ?? '—'}
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      {!snapshot.unavailable.includes('detectors') && (
        <Stack spacing={1}>
          <Typography variant="h6">Detector assignments</Typography>
          {snapshot.detectors.length ? (
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              {snapshot.detectors.map((detector) => (
                <Chip
                  key={detector.channel}
                  title={detector.source ?? undefined}
                  color={
                    items.some(
                      (item) =>
                        item.field === `detectors.${detector.channel}.callPhase`
                    )
                      ? 'primary'
                      : 'default'
                  }
                  label={`Ch ${detector.channel} · ${detector.callPhase ? `Phase ${detector.callPhase}` : 'Unassigned'}`}
                />
              ))}
            </Stack>
          ) : (
            <Typography>No detectors were reported.</Typography>
          )}
        </Stack>
      )}
    </Stack>
  )
}

function RouteBatch({ id }: { id: string }) {
  const result = useQuery(['configuration-route-review', id], () =>
    getRouteReview(id)
  )
  if (result.isLoading) return <Typography>Loading route review…</Typography>
  if (!result.data)
    return <Alert severity="error">{String(displayError(result.error))}</Alert>
  const rows = result.data
  const firmware = new Map<string, number>()
  for (const row of rows) {
    if (row.firmware)
      firmware.set(row.firmware, (firmware.get(row.firmware) ?? 0) + 1)
  }
  return (
    <Stack spacing={2}>
      <Box>
        <Button component={Link} href="/admin/config-review">
          All reviews
        </Button>
      </Box>
      <Typography variant="h5">Route configuration review</Typography>
      <Typography>
        {rows.length} locations ·{' '}
        {rows.filter((row) => row.baselineCaptured).length} captured baselines
      </Typography>
      {firmware.size > 0 && (
        <Typography variant="body2">
          Firmware in use:{' '}
          {Array.from(firmware)
            .map(([name, count]) => name + ' (' + count + ')')
            .join(', ')}
        </Typography>
      )}
      <TableContainer component={Paper} variant="outlined">
        <Table size="small" aria-label="Route configuration findings">
          <TableHead>
            <TableRow>
              {[
                'Location',
                'Baseline',
                'Status',
                'Firmware',
                'Undeclared pedestrian phases',
                'Open conflicts',
                'Findings',
              ].map((label) => (
                <TableCell key={label}>{label}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.review.id}>
                <TableCell>
                  <Link href={'/admin/config-review/' + row.review.id}>
                    {row.review.locationIdentifier}
                  </Link>
                </TableCell>
                <TableCell>
                  {row.baselineCaptured ? 'Captured' : 'Unavailable'}
                </TableCell>
                <TableCell>{row.review.status}</TableCell>
                <TableCell>{row.firmware ?? '—'}</TableCell>
                <TableCell>{row.undeclaredPedestrianPhases}</TableCell>
                <TableCell>{row.unresolvedConflicts}</TableCell>
                <TableCell>{row.findings}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>
  )
}

function ReviewDetails({ id }: { id: string }) {
  const client = useQueryClient()
  const report = useQuery(['configuration-review', id], () => getReview(id))
  const mutation = useMutation((action: () => Promise<unknown>) => action(), {
    onSettled: () => client.invalidateQueries(['configuration-review', id]),
  })
  const [file, setFile] = useState<File | null>(null)
  const [annotation, setAnnotation] = useState<ReviewItem | null>(null)
  const [version, setVersion] = useState('in-place')
  const [effectiveDate, setEffectiveDate] = useState('')
  const [reason, setReason] = useState('')
  if (report.isLoading) return <Typography>Loading review…</Typography>
  if (!report.data)
    return <Alert severity="error">{String(displayError(report.error))}</Alert>

  const { review, baseline, snapshot, items, promotions } = report.data
  const editable =
    has('LocationConfiguration:Edit') &&
    ['Draft', 'Reviewed'].includes(review.status)
  const blocked = new Set(
    items
      .filter(
        (item) =>
          item.field.startsWith('!') &&
          ['Pending', 'Deferred'].includes(item.disposition)
      )
      .map((item) => item.group)
  )
  const promotable = items.filter(
    (item) =>
      ['Certain', 'NeedsDirection'].includes(item.classification) &&
      item.disposition === 'Accepted' &&
      !item.field.startsWith('!') &&
      !blocked.has(item.group) &&
      !(
        ['phaseStructure', 'phaseTiming'].includes(item.group) &&
        blocked.has('phases')
      )
  )

  return (
    <Stack spacing={2.5}>
      <Box>
        <Button
          component={Link}
          href={
            review.batchId
              ? '/admin/config-review?batch=' + review.batchId
              : '/admin/config-review'
          }
        >
          {review.batchId ? 'Route review' : 'All reviews'}
        </Button>
      </Box>
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        flexWrap="wrap"
        useFlexGap
      >
        <Typography variant="h5">
          Location {review.locationIdentifier}
        </Typography>
        <Chip label={review.status} size="small" />
        <Chip label={review.asOfDate.slice(0, 10)} size="small" />
      </Stack>
      {mutation.isError && (
        <Alert severity="error">{String(displayError(mutation.error))}</Alert>
      )}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={1}>
          <Typography variant="h6">ATSPM baseline</Typography>
          {baseline ? (
            <BaselineView baseline={baseline} />
          ) : (
            <Typography>
              Capture the configuration in effect for the review date before
              submitting a snapshot.
            </Typography>
          )}
          {editable && !snapshot.snapshot && (
            <Box>
              <Button
                variant={baseline ? 'outlined' : 'contained'}
                disabled={mutation.isLoading}
                onClick={() => mutation.mutate(() => loadBaseline(id))}
              >
                {baseline ? 'Recapture baseline' : 'Capture baseline'}
              </Button>
            </Box>
          )}
        </Stack>
      </Paper>
      {baseline && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack spacing={1.5}>
            <Typography variant="h6">Controller snapshot</Typography>
            {editable && (
              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                flexWrap="wrap"
                useFlexGap
              >
                <Button variant="outlined" component="label">
                  Choose normalized JSON
                  <input
                    hidden
                    type="file"
                    accept=".json,application/json"
                    onChange={(event) =>
                      setFile(event.target.files?.[0] ?? null)
                    }
                  />
                </Button>
                {file && <Typography variant="body2">{file.name}</Typography>}
                <Button
                  variant="contained"
                  disabled={!file || mutation.isLoading}
                  onClick={() => {
                    if (file)
                      mutation.mutate(() => uploadSnapshot(id, file), {
                        onSuccess: () => setFile(null),
                      })
                  }}
                >
                  Upload snapshot
                </Button>
              </Stack>
            )}
            {snapshot.files.map((entry) => (
              <Typography key={entry.id} variant="body2" title={entry.sha256}>
                {entry.name} · {entry.size.toLocaleString()} bytes ·{' '}
                {entry.parseReport}
              </Typography>
            ))}
          </Stack>
        </Paper>
      )}
      {snapshot.snapshot && (
        <SnapshotView snapshot={snapshot.snapshot} items={items} />
      )}
      {snapshot.snapshot && (
        <Stack spacing={1.5}>
          <Typography variant="h6">Findings</Typography>
          {items.length === 0 && (
            <Typography>No comparable differences were found.</Typography>
          )}
          {sections.map(({ classification, label, stored }) => {
            const rows = items.filter(
              (item) =>
                item.classification === classification &&
                (stored === undefined ||
                  stored === (item.baselineValue !== 'null'))
            )
            return (
              rows.length > 0 && (
                <Box key={label}>
                  <Typography variant="subtitle1">
                    {label} · {rows.length}
                  </Typography>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small" aria-label={label}>
                      <TableHead>
                        <TableRow>
                          <TableCell>Finding</TableCell>
                          <TableCell>ATSPM</TableCell>
                          <TableCell>Controller</TableCell>
                          <TableCell>Decision</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {rows.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell title={item.sources}>
                              {item.summary}
                            </TableCell>
                            <TableCell sx={{ overflowWrap: 'anywhere' }}>
                              {item.baselineValue === 'null'
                                ? '—'
                                : item.baselineValue}
                            </TableCell>
                            <TableCell sx={{ overflowWrap: 'anywhere' }}>
                              {item.controllerValue === 'null'
                                ? '—'
                                : item.controllerValue}
                            </TableCell>
                            <TableCell>
                              {editable ? (
                                <Button
                                  size="small"
                                  onClick={() => setAnnotation(item)}
                                >
                                  {item.disposition}
                                </Button>
                              ) : (
                                item.disposition
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )
            )
          })}
        </Stack>
      )}
      {editable && snapshot.snapshot && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack
            spacing={1.5}
            component="form"
            onSubmit={(event) => {
              event.preventDefault()
              mutation.mutate(() =>
                promoteReview(id, {
                  reason: reason.trim(),
                  effectiveDate: version === 'new' ? effectiveDate : null,
                })
              )
            }}
          >
            <Typography variant="h6">Promote approved items</Typography>
            <Typography>
              {promotable.length} ready · {items.length - promotable.length}{' '}
              excluded
            </Typography>
            {blocked.size > 0 && (
              <Alert severity="warning">
                Resolve source conflicts in {Array.from(blocked).join(', ')} to
                promote those groups.
              </Alert>
            )}
            {!has('ConfigReview:Promote') ? (
              <Typography>Promotion requires a configuration owner.</Typography>
            ) : (
              <>
                <TextField
                  select
                  label="Configuration version"
                  value={version}
                  onChange={(event) => setVersion(event.target.value)}
                >
                  <MenuItem value="in-place">Correct in place</MenuItem>
                  <MenuItem value="new">
                    Create a version with an effective date
                  </MenuItem>
                </TextField>
                {version === 'new' && (
                  <TextField
                    type="date"
                    label="Effective date"
                    value={effectiveDate}
                    required
                    onChange={(event) => setEffectiveDate(event.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                )}
                <TextField
                  label="Promotion reason"
                  value={reason}
                  required
                  onChange={(event) => setReason(event.target.value)}
                  inputProps={{ maxLength: 512 }}
                />
                <Box>
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={
                      mutation.isLoading ||
                      !promotable.length ||
                      !reason.trim() ||
                      (version === 'new' && !effectiveDate)
                    }
                  >
                    Promote accepted items
                  </Button>
                </Box>
              </>
            )}
          </Stack>
        </Paper>
      )}
      {promotions.length > 0 && (
        <Stack spacing={1}>
          <Divider />
          <Typography variant="h6">Promotion audit</Typography>
          {promotions.map((item) => (
            <Typography key={item.id} variant="body2" title={item.reason}>
              {item.field} · {item.basis} · {item.approvedBy} ·{' '}
              {item.approvedAt}
            </Typography>
          ))}
        </Stack>
      )}
      {annotation && (
        <AnnotationDrawer
          item={annotation}
          key={annotation.id}
          busy={mutation.isLoading}
          onClose={() => setAnnotation(null)}
          onSave={(disposition, data) =>
            mutation.mutate(
              () => annotateItem(id, annotation.id, disposition, data),
              { onSuccess: () => setAnnotation(null) }
            )
          }
        />
      )}
    </Stack>
  )
}

export default function ConfigReviewPage() {
  const router = useRouter()
  const id = Array.isArray(router.query.id)
    ? router.query.id[0]
    : router.query.id
  const batch =
    typeof router.query.batch === 'string' ? router.query.batch : null
  return (
    <Authorization requiredClaim="LocationConfiguration:View">
      <ResponsivePageLayout title="Configuration Review">
        {router.isReady &&
          (id ? (
            <ReviewDetails key={id} id={id} />
          ) : batch ? (
            <RouteBatch id={batch} />
          ) : (
            <ReviewList />
          ))}
      </ResponsivePageLayout>
    </Authorization>
  )
}
