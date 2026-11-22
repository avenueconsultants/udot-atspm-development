import ApacheEChart from '@/features/charts/components/apacheEChart/ApacheEChart'
import type { Route } from '@/features/routes/types'
import { reportsRequest } from '@/lib/axios'
import { toDateStamp } from '@/utils/dateTime'
import { LoadingButton } from '@mui/lab'
import {
  Alert,
  Autocomplete,
  Box,
  Checkbox,
  FormControlLabel,
  MenuItem,
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
import type { EChartsOption, LineSeriesOption } from 'echarts'
import { useMemo, useState } from 'react'
import { useMutation } from 'react-query'

type Window = { start: number; end: number }
type Signal = {
  id: string
  name: string
  offset: number
  distance: number
  locked: boolean
}
type Plan = {
  name: string
  shifts: number[]
  directions: {
    direction: string
    vehicles: number
    meanDelay: number
    stops: number
    nonstopVehicles: number
  }[]
  plot: {
    start: string
    duration: number
    signals: { distance: number; primary: Window[]; opposing: Window[] }[]
    trajectories: {
      opposing: boolean
      points: { time: number; distance: number }[]
    }[]
  }
}
type Result = {
  cycle: number
  signals: Signal[]
  existing: Plan
  proposed: Plan
  linkPivot: Plan[]
  notes: string[]
}

type Request = {
  routeId: number
  start: string
  end: string
  speedLimit: number | null
  maxShift: number
  maxDirectionalIncrease: number | null
  lockedSignals: string[]
  compareLinkPivot: boolean
}

const wrap = (offset: number, cycle: number) =>
  ((offset % cycle) + cycle) % cycle

function clockLabel(start: string, elapsed: number) {
  const [hours, minutes, seconds] = start.slice(11, 19).split(':').map(Number)
  const total = wrap(
    Math.round(hours * 3600 + minutes * 60 + seconds + elapsed),
    86400
  )
  return [Math.floor(total / 3600), Math.floor(total / 60) % 60, total % 60]
    .map((value) => String(value).padStart(2, '0'))
    .join(':')
}

function chartFor(
  plan: Plan,
  signals: Signal[],
  duration: number
): EChartsOption {
  const band = Math.max(12, (signals.at(-1)?.distance ?? 0) * 0.008)
  const series: LineSeriesOption[] = ['primary', 'opposing'].map(
    (direction, index) => ({
      type: 'line',
      name: `${plan.directions[index].direction} green`,
      showSymbol: false,
      silent: true,
      lineStyle: { color: index === 0 ? '#087c4d' : '#2576ad', width: 4 },
      itemStyle: { color: index === 0 ? '#087c4d' : '#2576ad' },
      data: plan.plot.signals.flatMap((signal) =>
        signal[direction as 'primary' | 'opposing'].flatMap((window) => [
          [window.start, signal.distance + (index === 0 ? band : -band)],
          [window.end, signal.distance + (index === 0 ? band : -band)],
          [NaN, NaN],
        ])
      ),
    })
  )
  for (const [index, direction] of plan.directions.entries()) {
    const color = index === 0 ? '#087c4d' : '#2576ad'
    series.push({
      type: 'line',
      name: `${direction.direction} vehicles`,
      showSymbol: false,
      silent: true,
      lineStyle: { color, opacity: 0.4, width: 1 },
      itemStyle: { color },
      data: plan.plot.trajectories
        .filter(({ opposing }) => opposing === (index === 1))
        .flatMap(({ points }) => [
          ...points.map(({ time, distance }) => [time, distance]),
          [NaN, NaN],
        ]),
    })
  }
  series.push({
    type: 'line',
    name: 'Signals',
    data: [],
    markLine: {
      silent: true,
      symbol: 'none',
      lineStyle: { color: '#7a8793', opacity: 0.5 },
      label: { color: '#465968', formatter: '{b}', position: 'end' },
      data: signals.map((signal) => ({
        name: signal.id,
        yAxis: signal.distance,
      })),
    },
  })
  return {
    animation: false,
    aria: { enabled: true },
    legend: { top: 0 },
    grid: { left: 85, right: 60, top: 30, bottom: 75 },
    xAxis: {
      type: 'value',
      min: 0,
      max: Math.ceil(duration),
      name: 'Controller time',
      nameLocation: 'middle',
      nameGap: 30,
      axisLabel: {
        formatter: (value: number) => clockLabel(plan.plot.start, value),
      },
    },
    yAxis: { type: 'value', name: 'Distance (ft)', scale: true },
    dataZoom: [
      { type: 'slider', xAxisIndex: 0, bottom: 5, filterMode: 'none' },
    ],
    series,
  }
}

export default function CorridorOffsetsTab({ routes }: { routes: Route[] }) {
  const [route, setRoute] = useState<Route | null>(null)
  const [date, setDate] = useState(() => toDateStamp(new Date()))
  const [start, setStart] = useState('16:00')
  const [end, setEnd] = useState('16:30')
  const [speed, setSpeed] = useState('')
  const [maxShift, setMaxShift] = useState('30')
  const [maxLoss, setMaxLoss] = useState('')
  const [compareLinkPivot, setCompareLinkPivot] = useState(true)
  const [lockedSignals, setLockedSignals] = useState<string[]>([])
  const [selectedPlan, setSelectedPlan] = useState('Corridor')
  const report = useMutation((request: Request) =>
    reportsRequest<Result>({
      method: 'POST',
      url: '/api/v1/CorridorOffsets/GetReportData',
      data: request,
    })
  )
  const result = report.data
  const plans = useMemo(
    () =>
      result ? [result.existing, ...result.linkPivot, result.proposed] : [],
    [result]
  )
  const plan =
    plans.find((candidate) => candidate.name === selectedPlan) ??
    result?.proposed
  const chart = useMemo(
    () =>
      plan && result
        ? chartFor(
            plan,
            result.signals,
            Math.max(...plans.map(({ plot }) => plot.duration))
          )
        : null,
    [plan, plans, result]
  )
  const serverError = isAxiosError(report.error)
    ? report.error.response?.data
    : null
  const error =
    typeof serverError === 'string'
      ? serverError
      : 'The corridor report could not be generated.'

  return (
    <Stack spacing={2}>
      <Typography variant="body2">
        Compare offsets for traffic entering at the two corridor ends. Select a
        window within one coordinated plan.
      </Typography>
      <Box
        component="form"
        onSubmit={(event) => {
          event.preventDefault()
          if (!route || start >= end || report.isLoading) return
          setSelectedPlan('Corridor')
          report.mutate({
            routeId: route.id,
            start: `${date}T${start}:00`,
            end: `${date}T${end}:00`,
            speedLimit: speed === '' ? null : Number(speed),
            maxShift: Number(maxShift),
            maxDirectionalIncrease: maxLoss === '' ? null : Number(maxLoss),
            lockedSignals,
            compareLinkPivot,
          })
        }}
      >
        <Stack spacing={2}>
          <Autocomplete
            options={routes}
            getOptionLabel={(option) => option.name}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            value={route}
            onChange={(_, value) => {
              setRoute(value)
              setLockedSignals([])
              report.reset()
            }}
            renderInput={(params) => (
              <TextField {...params} label="Route" required />
            )}
          />
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            <TextField
              label="Date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              InputLabelProps={{ shrink: true }}
              required
            />
            <TextField
              label="Start time"
              type="time"
              value={start}
              onChange={(event) => setStart(event.target.value)}
              InputLabelProps={{ shrink: true }}
              required
            />
            <TextField
              label="End time"
              type="time"
              value={end}
              onChange={(event) => setEnd(event.target.value)}
              InputLabelProps={{ shrink: true }}
              required
            />
            <TextField
              label="Fallback speed (mph)"
              type="number"
              value={speed}
              onChange={(event) => setSpeed(event.target.value)}
              inputProps={{ min: 1, max: 85 }}
            />
            <TextField
              label="Max offset change (s)"
              type="number"
              value={maxShift}
              onChange={(event) => setMaxShift(event.target.value)}
              inputProps={{ min: 0, max: 120 }}
              required
            />
            <TextField
              label="Max delay increase per direction (s/vehicle)"
              type="number"
              value={maxLoss}
              onChange={(event) => setMaxLoss(event.target.value)}
              inputProps={{ min: 0, step: 0.1 }}
              sx={{ minWidth: 310 }}
            />
          </Stack>
          {route?.routeLocations?.length ? (
            <Autocomplete
              multiple
              options={route.routeLocations.map(
                (location) => location.locationIdentifier
              )}
              value={lockedSignals}
              onChange={(_, value) => setLockedSignals(value)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Keep existing offsets at these signals"
                />
              )}
            />
          ) : null}
          <Stack
            direction="row"
            spacing={2}
            alignItems="center"
            flexWrap="wrap"
          >
            <LoadingButton
              variant="contained"
              type="submit"
              loading={report.isLoading}
              disabled={!route || !date || start >= end}
            >
              Find corridor offsets
            </LoadingButton>
            <FormControlLabel
              label="Compare with Link Pivot"
              control={
                <Checkbox
                  checked={compareLinkPivot}
                  onChange={(_, checked) => setCompareLinkPivot(checked)}
                />
              }
            />
          </Stack>
        </Stack>
      </Box>
      {report.isError && <Alert severity="error">{error}</Alert>}
      {result && plan && chart && (
        <>
          {result.notes.map((note) => (
            <Alert key={note} severity="info">
              {note}
            </Alert>
          ))}
          <TableContainer>
            <Table size="small" aria-label="Corridor performance by direction">
              <TableHead>
                <TableRow>
                  {[
                    'Plan',
                    'Direction',
                    'Vehicles',
                    'Delay (s/vehicle)',
                    'Total stops',
                    'Nonstop trips',
                  ].map((label) => (
                    <TableCell key={label}>{label}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {plans.flatMap((candidate) =>
                  candidate.directions.map((direction) => (
                    <TableRow key={`${candidate.name}-${direction.direction}`}>
                      <TableCell>{candidate.name}</TableCell>
                      <TableCell>{direction.direction}</TableCell>
                      <TableCell>{direction.vehicles}</TableCell>
                      <TableCell>{direction.meanDelay.toFixed(1)}</TableCell>
                      <TableCell>{direction.stops}</TableCell>
                      <TableCell>
                        {(
                          (100 * direction.nonstopVehicles) /
                          direction.vehicles
                        ).toFixed(1)}
                        %
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TextField
            select
            label="Show plan on diagram"
            value={plan.name}
            onChange={(event) => setSelectedPlan(event.target.value)}
            sx={{ alignSelf: 'flex-start', minWidth: 230 }}
          >
            {plans.map((candidate) => (
              <MenuItem key={candidate.name} value={candidate.name}>
                {candidate.name}
              </MenuItem>
            ))}
          </TextField>
          <ApacheEChart
            id="corridor-offset-replay"
            option={chart}
            hideInteractionMessage
            style={{ height: 475 }}
          />
          <Typography variant="body2">
            The diagram samples vehicle lines. The performance table counts
            every scored vehicle.
          </Typography>
          <TableContainer>
            <Table size="small" aria-label="Corridor signal offsets">
              <TableHead>
                <TableRow>
                  {[
                    'Signal',
                    'Distance (ft)',
                    'Existing offset (s)',
                    `${plan.name} offset (s)`,
                    'Change (s)',
                  ].map((label) => (
                    <TableCell key={label}>{label}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {result.signals.map((signal, index) => (
                  <TableRow key={signal.id}>
                    <TableCell>
                      {signal.id} · {signal.name}
                      {signal.locked && ' (locked)'}
                    </TableCell>
                    <TableCell>{signal.distance}</TableCell>
                    <TableCell>{signal.offset}</TableCell>
                    <TableCell>
                      {wrap(signal.offset + plan.shifts[index], result.cycle)}
                    </TableCell>
                    <TableCell>
                      {plan.shifts[index] > 0 ? '+' : ''}
                      {plan.shifts[index]}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}
    </Stack>
  )
}
