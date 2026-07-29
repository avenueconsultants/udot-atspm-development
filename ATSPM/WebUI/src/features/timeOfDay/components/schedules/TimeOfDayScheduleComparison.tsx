import type { Plan } from '@/api/reports'
import { Alert, Box, Stack, Tooltip, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import type { ReactNode } from 'react'
import { formatPlanNumber } from '../../transformers'
import type {
  ScheduleException,
  ScheduleLocation,
} from './timeOfDayScheduleModel'
import {
  formatClockTime,
  freePlanColor,
  getScheduleIntervals,
  getScheduleSummary,
} from './timeOfDayScheduleModel'

interface ScheduleComparisonProps {
  proposedSchedule: Plan[]
  commonSchedule: Plan[]
  commonLocations: ScheduleLocation[]
  exceptions: ScheduleException[]
  colorMap: Map<string, string>
}

const labelColumnWidth = 248
const minimumTimelineWidth = 700
const timeTicks = [
  { minutes: 0, label: '12 AM' },
  { minutes: 360, label: '6 AM' },
  { minutes: 720, label: '12 PM' },
  { minutes: 1080, label: '6 PM' },
  { minutes: 1440, label: '12 AM' },
]

const formatScheduleLocation = ({
  identifier,
  description,
}: ScheduleLocation) => {
  const locationDescription = description
    ?.replace(new RegExp(`^#?${identifier}\\s*[-–—:]\\s*`), '')
    .trim()

  return locationDescription
    ? `#${identifier} — ${locationDescription}`
    : `#${identifier}`
}

function ScheduleRail({
  schedule,
  colorMap,
  ariaLabel,
  proposedBoundaryMinutes = [],
}: {
  schedule: Plan[]
  colorMap: Map<string, string>
  ariaLabel: string
  proposedBoundaryMinutes?: number[]
}) {
  const intervals = getScheduleIntervals(schedule)

  return (
    <Box
      role="img"
      aria-label={`${ariaLabel}: ${getScheduleSummary(schedule)}`}
      sx={{
        position: 'relative',
        alignSelf: 'stretch',
        minHeight: 40,
        overflow: 'hidden',
        bgcolor: '#F1F5F9',
      }}
    >
      {intervals.map(({ plan, startMinutes, endMinutes }, index) => {
        const planName = formatPlanNumber(plan.planNumber)
        const color = colorMap.get(planName) ?? freePlanColor
        const intervalLabel = `${planName}, ${formatClockTime(
          startMinutes
        )} to ${formatClockTime(endMinutes)}${
          plan.planDescription ? `, ${plan.planDescription}` : ''
        }`

        return (
          <Tooltip
            key={`${planName}-${startMinutes}-${endMinutes}-${index}`}
            title={intervalLabel}
          >
            <Box
              component="span"
              aria-hidden
              sx={{
                position: 'absolute',
                insetBlock: 0,
                left: `${(startMinutes / 1440) * 100}%`,
                width: `${((endMinutes - startMinutes) / 1440) * 100}%`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: 2,
                overflow: 'hidden',
                bgcolor: alpha(color, planName === 'FREE' ? 0.14 : 0.2),
                color,
                fontSize: '0.75rem',
                fontWeight: 700,
                lineHeight: 1,
                zIndex: 1,
              }}
            >
              <Box
                component="span"
                sx={{
                  px: 0.5,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {planName}
              </Box>
            </Box>
          </Tooltip>
        )
      })}
      {proposedBoundaryMinutes.map((minutes) => (
        <Box
          key={minutes}
          data-testid="proposed-boundary-guide"
          aria-hidden
          sx={{
            position: 'absolute',
            insetBlock: 0,
            left: `${(minutes / 1440) * 100}%`,
            borderLeft: '1px dashed',
            borderColor: 'rgba(71, 85, 105, 0.72)',
            pointerEvents: 'none',
            zIndex: 2,
          }}
        />
      ))}
    </Box>
  )
}

function ScheduleRow({
  label,
  schedule,
  colorMap,
  ariaLabel,
  proposedBoundaryMinutes,
  minHeight = 41,
  reference = false,
}: {
  label: ReactNode
  schedule: Plan[]
  colorMap: Map<string, string>
  ariaLabel: string
  proposedBoundaryMinutes?: number[]
  minHeight?: number
  reference?: boolean
}) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: `${labelColumnWidth}px minmax(${minimumTimelineWidth}px, 1fr)`,
        minHeight,
        overflow: 'hidden',
        border: reference ? '1px solid' : 0,
        borderColor: reference ? '#DBEAFE' : undefined,
        borderRadius: reference ? 1 : 0,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          minWidth: 0,
          px: 2,
          py: reference ? 0.75 : 0.5,
          bgcolor: reference ? '#F8FAFC' : 'common.white',
        }}
      >
        {label}
      </Box>
      <ScheduleRail
        schedule={schedule}
        colorMap={colorMap}
        ariaLabel={ariaLabel}
        proposedBoundaryMinutes={proposedBoundaryMinutes}
      />
    </Box>
  )
}

function ScheduleGroupHeader({
  tone,
  children,
}: {
  tone: 'common' | 'exception'
  children: ReactNode
}) {
  const common = tone === 'common'
  const color = common ? '#065F46' : '#9A3412'

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.75,
        minHeight: 29,
        px: 1.5,
        borderRadius: 1,
        bgcolor: common ? '#ECFDF5' : '#FFF7ED',
      }}
    >
      <Box
        aria-hidden
        sx={{
          width: 6,
          height: 6,
          flexShrink: 0,
          borderRadius: '50%',
          bgcolor: common ? '#10B981' : '#F59E0B',
        }}
      />
      <Typography
        component="h3"
        variant="caption"
        sx={{
          color,
          fontWeight: 700,
          lineHeight: 1.2,
          textTransform: 'uppercase',
        }}
      >
        {children}
      </Typography>
    </Box>
  )
}

function CommonScheduleLabel({ locations }: { locations: ScheduleLocation[] }) {
  return (
    <Stack spacing={0.25} sx={{ minWidth: 0 }}>
      <Typography variant="subtitle2" fontWeight={700}>
        Common existing
      </Typography>
      {locations.map((location) => {
        const label = formatScheduleLocation(location)

        return (
          <Typography
            key={location.identifier}
            variant="caption"
            color="text.secondary"
            title={label}
            noWrap
            sx={{ lineHeight: 1.25 }}
          >
            {label}
          </Typography>
        )
      })}
    </Stack>
  )
}

function ExceptionScheduleLabel({ location }: { location: ScheduleLocation }) {
  const label = formatScheduleLocation(location)

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.25,
        minWidth: 0,
        width: '100%',
      }}
    >
      <Typography
        variant="caption"
        title={label}
        noWrap
        sx={{ color: '#172033' }}
      >
        {label}
      </Typography>
    </Box>
  )
}

function TimeAxis() {
  return (
    <Box
      aria-hidden
      sx={{
        display: 'grid',
        gridTemplateColumns: `${labelColumnWidth}px minmax(${minimumTimelineWidth}px, 1fr)`,
      }}
    >
      <Box />
      <Box sx={{ position: 'relative', height: 30, mt: 0.5 }}>
        {timeTicks.map((tick, index) => (
          <Typography
            key={tick.minutes}
            variant="caption"
            color="text.secondary"
            sx={{
              position: 'absolute',
              top: 2,
              left:
                index === timeTicks.length - 1
                  ? 'auto'
                  : `${(tick.minutes / 1440) * 100}%`,
              right: index === timeTicks.length - 1 ? 0 : 'auto',
              transform:
                index === 0 || index === timeTicks.length - 1
                  ? 'none'
                  : 'translateX(-50%)',
              fontSize: '0.68rem',
              fontVariantNumeric: 'tabular-nums',
              whiteSpace: 'nowrap',
            }}
          >
            {tick.label}
          </Typography>
        ))}
      </Box>
    </Box>
  )
}

export default function TimeOfDayScheduleComparison({
  proposedSchedule,
  commonSchedule,
  commonLocations,
  exceptions,
  colorMap,
}: ScheduleComparisonProps) {
  const proposedBoundaryMinutes = [
    ...new Set(
      getScheduleIntervals(proposedSchedule)
        .flatMap(({ startMinutes, endMinutes }) => [startMinutes, endMinutes])
        .filter((minutes) => minutes > 0 && minutes < 1440)
    ),
  ].sort((left, right) => left - right)
  const hasScheduleRows =
    proposedSchedule.length > 0 ||
    commonSchedule.length > 0 ||
    exceptions.length > 0

  if (!hasScheduleRows) {
    return <Alert severity="warning">No schedule data available.</Alert>
  }

  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Stack spacing={0} sx={{ minWidth: 980 }}>
        {proposedSchedule.length > 0 && (
          <Box sx={{ mb: 1.5 }}>
            <ScheduleRow
              reference
              label={
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.75,
                    minWidth: 0,
                  }}
                >
                  <Box
                    component="span"
                    sx={{
                      px: 0.55,
                      py: 0.15,
                      borderRadius: 0.5,
                      bgcolor: '#1D4ED8',
                      color: 'common.white',
                      fontSize: '0.62rem',
                      fontWeight: 800,
                      lineHeight: 1.25,
                    }}
                  >
                    REF
                  </Box>
                  <Typography
                    variant="subtitle2"
                    sx={{ color: '#1D4ED8', fontWeight: 700 }}
                  >
                    Proposed
                  </Typography>
                </Box>
              }
              schedule={proposedSchedule}
              colorMap={colorMap}
              ariaLabel="Proposed reference schedule"
            />
          </Box>
        )}

        {commonSchedule.length > 0 && (
          <Box sx={{ mb: exceptions.length ? 1.25 : 0 }}>
            <ScheduleGroupHeader tone="common">
              Common schedule — {commonLocations.length}{' '}
              {commonLocations.length === 1 ? 'location' : 'locations'}
            </ScheduleGroupHeader>
            <Box sx={{ mt: 0.5 }}>
              <ScheduleRow
                label={<CommonScheduleLabel locations={commonLocations} />}
                schedule={commonSchedule}
                colorMap={colorMap}
                ariaLabel={`Common existing schedule used by ${commonLocations
                  .map(formatScheduleLocation)
                  .join(', ')}`}
                proposedBoundaryMinutes={proposedBoundaryMinutes}
                minHeight={Math.max(72, 33 + commonLocations.length * 16)}
              />
            </Box>
          </Box>
        )}

        {exceptions.length > 0 && (
          <Box>
            <ScheduleGroupHeader tone="exception">
              Exceptions — {exceptions.length}{' '}
              {exceptions.length === 1 ? 'location' : 'locations'}
            </ScheduleGroupHeader>
            <Box sx={{ mt: 0.5 }}>
              {exceptions.map(({ location, schedule }) => (
                <ScheduleRow
                  key={location.identifier}
                  label={<ExceptionScheduleLabel location={location} />}
                  schedule={schedule}
                  colorMap={colorMap}
                  ariaLabel={`Existing schedule for ${formatScheduleLocation(
                    location
                  )}`}
                  proposedBoundaryMinutes={proposedBoundaryMinutes}
                />
              ))}
            </Box>
          </Box>
        )}

        <TimeAxis />
      </Stack>
    </Box>
  )
}
