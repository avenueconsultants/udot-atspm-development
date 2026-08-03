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
const categoryRailWidth = 34
const categoryBufferSize = 8
const minimumTimelineWidth = 1200
const minimumComparisonWidth =
  categoryRailWidth +
  labelColumnWidth +
  minimumTimelineWidth +
  categoryBufferSize
const timeTicks = Array.from({ length: 25 }, (_, hour) => ({
  minutes: hour * 60,
  label: `${String(hour).padStart(2, '0')}:00`,
}))

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
        '&::after': {
          position: 'absolute',
          zIndex: 2,
          inset: 0,
          content: '""',
          backgroundImage:
            'repeating-linear-gradient(to right, transparent 0, transparent calc(4.1666667% - 1px), rgba(100, 116, 139, 0.16) calc(4.1666667% - 1px), rgba(100, 116, 139, 0.16) 4.1666667%)',
          pointerEvents: 'none',
        },
      }}
    >
      {intervals.map(({ plan, startMinutes, endMinutes }, index) => {
        const planName = formatPlanNumber(plan.planNumber)
        const isNumberedPlan = /^\d+$/.test(planName)
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
                fontSize: '0.7rem',
                lineHeight: 1,
              }}
            >
              <Box
                component="span"
                data-plan-shape={isNumberedPlan ? 'circle' : 'pill'}
                sx={{
                  position: 'relative',
                  zIndex: 4,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: isNumberedPlan ? 20 : 'auto',
                  height: isNumberedPlan ? 20 : 'auto',
                  px: isNumberedPlan ? 0 : 0.8,
                  py: isNumberedPlan ? 0 : 0.3,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  borderRadius: isNumberedPlan ? '50%' : 0.75,
                  bgcolor: color,
                  color: 'common.white',
                  fontSize: isNumberedPlan ? '0.65rem' : 'inherit',
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
            borderLeft: '2px dashed',
            borderColor: 'rgba(71, 85, 105, 0.72)',
            pointerEvents: 'none',
            zIndex: 3,
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
  labelWidth = labelColumnWidth,
}: {
  label: ReactNode
  schedule: Plan[]
  colorMap: Map<string, string>
  ariaLabel: string
  proposedBoundaryMinutes?: number[]
  minHeight?: number
  labelWidth?: number
}) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: `${labelWidth}px minmax(${minimumTimelineWidth}px, 1fr)`,
        minHeight,
        overflow: 'hidden',
      }}
    >
      <Box
        data-schedule-row-label
        sx={{
          display: 'flex',
          alignItems: 'center',
          minWidth: 0,
          px: 2,
          py: 0.5,
          bgcolor: 'common.white',
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

type ScheduleGroupTone = 'proposed' | 'common' | 'exception'

const scheduleGroupTones = {
  proposed: {
    border: '#93C5FD',
    railBackground: '#DBEAFE',
    text: '#1D4ED8',
  },
  common: {
    border: '#A7F3D0',
    railBackground: '#D1FAE5',
    text: '#047857',
  },
  exception: {
    border: '#FED7AA',
    railBackground: '#FFEDD5',
    text: '#C2410C',
  },
} as const

function ScheduleGroup({
  tone,
  label,
  ariaLabel,
  showLabelRail = true,
  children,
}: {
  tone: ScheduleGroupTone
  label: string
  ariaLabel: string
  showLabelRail?: boolean
  children: ReactNode
}) {
  const colors = scheduleGroupTones[tone]
  const headingId = `time-of-day-${tone}-schedule-heading`

  return (
    <Box
      component="section"
      aria-label={showLabelRail ? undefined : ariaLabel}
      aria-labelledby={showLabelRail ? headingId : undefined}
      data-testid={`schedule-${tone}-group`}
      sx={{
        overflow: 'hidden',
        borderRadius: 2,
        bgcolor: 'common.white',
      }}
    >
      <Box
        aria-hidden
        data-testid={`schedule-${tone}-buffer-before`}
        sx={{
          height: categoryBufferSize,
          bgcolor: colors.railBackground,
        }}
      />
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: showLabelRail
            ? `${categoryRailWidth}px minmax(0, 1fr) ${categoryBufferSize}px`
            : `minmax(0, 1fr) ${categoryBufferSize}px`,
        }}
      >
        {showLabelRail && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 40,
              borderRight: '1px solid',
              borderColor: colors.border,
              bgcolor: colors.railBackground,
            }}
          >
            <Typography
              id={headingId}
              component="h3"
              variant="caption"
              aria-label={ariaLabel}
              sx={{
                color: colors.text,
                fontSize: '0.67rem',
                fontWeight: 800,
                letterSpacing: '0.08em',
                lineHeight: 1,
                textTransform: 'uppercase',
                transform: 'rotate(180deg)',
                whiteSpace: 'nowrap',
                writingMode: 'vertical-rl',
              }}
            >
              <Box component="span" aria-hidden>
                {label}
              </Box>
            </Typography>
          </Box>
        )}
        <Box
          sx={{
            minWidth: 0,
            '& > * + *': {
              borderTop: '1px solid',
              borderColor: 'common.white',
            },
            '& [data-schedule-row-label]': {
              bgcolor: colors.railBackground,
            },
          }}
        >
          {children}
        </Box>
        <Box
          aria-hidden
          data-testid={`schedule-${tone}-buffer-right`}
          sx={{ bgcolor: colors.railBackground }}
        />
      </Box>
      <Box
        aria-hidden
        data-testid={`schedule-${tone}-buffer-after`}
        sx={{
          height: categoryBufferSize,
          bgcolor: colors.railBackground,
        }}
      />
    </Box>
  )
}
function ScheduleLocationLabel({ location }: { location: ScheduleLocation }) {
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
        gridTemplateColumns: `${
          categoryRailWidth + labelColumnWidth
        }px minmax(${minimumTimelineWidth}px, 1fr) ${categoryBufferSize}px`,
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
      <Box />
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
      <Stack spacing={0} sx={{ minWidth: minimumComparisonWidth }}>
        <Stack spacing={0.75}>
          {proposedSchedule.length > 0 && (
            <ScheduleGroup
              tone="proposed"
              label="Proposed"
              ariaLabel="Proposed schedule"
              showLabelRail={false}
            >
              <ScheduleRow
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
                      Proposed schedule
                    </Typography>
                  </Box>
                }
                schedule={proposedSchedule}
                colorMap={colorMap}
                ariaLabel="Proposed schedule"
                proposedBoundaryMinutes={proposedBoundaryMinutes}
                labelWidth={categoryRailWidth + labelColumnWidth}
              />
            </ScheduleGroup>
          )}

          {commonSchedule.length > 0 && (
            <ScheduleGroup
              tone="common"
              label="Common"
              ariaLabel={`Common schedule — ${commonLocations.length} ${
                commonLocations.length === 1 ? 'location' : 'locations'
              }`}
            >
              {commonLocations.map((location) => (
                <ScheduleRow
                  key={location.identifier}
                  label={<ScheduleLocationLabel location={location} />}
                  schedule={commonSchedule}
                  colorMap={colorMap}
                  ariaLabel={`Common existing schedule for ${formatScheduleLocation(
                    location
                  )}`}
                  proposedBoundaryMinutes={proposedBoundaryMinutes}
                />
              ))}
            </ScheduleGroup>
          )}

          {exceptions.length > 0 && (
            <ScheduleGroup
              tone="exception"
              label="Exceptions"
              ariaLabel={`Exceptions — ${exceptions.length} ${
                exceptions.length === 1 ? 'location' : 'locations'
              }`}
            >
              {exceptions.map(({ location, schedule }) => (
                <ScheduleRow
                  key={location.identifier}
                  label={<ScheduleLocationLabel location={location} />}
                  schedule={schedule}
                  colorMap={colorMap}
                  ariaLabel={`Existing schedule for ${formatScheduleLocation(
                    location
                  )}`}
                  proposedBoundaryMinutes={proposedBoundaryMinutes}
                />
              ))}
            </ScheduleGroup>
          )}
        </Stack>

        <TimeAxis />
      </Stack>
    </Box>
  )
}
