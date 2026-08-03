import type { TimeOfDayResult } from '@/api/reports'
import { Alert, AlertTitle, Box, Paper, Typography } from '@mui/material'
import {
  formatPlanNumber,
  getScheduleEntries,
  getSchedulePlanColorMap,
  minutesToTimeLabel,
} from '../../schedule'

interface SummaryItem {
  label: string
  value: string
}

interface TimeOfDaySummaryProps {
  result: TimeOfDayResult
  peakItems: SummaryItem[]
}

interface PeakDisplayValue {
  time: string
  value: string
  unit: string
}

const peakDisplayBySource: Record<
  string,
  { label: string; color: string; dashed?: boolean }
> = {
  'AM Corridor Peak': {
    label: 'AM corridor peak',
    color: '#ef6c00',
  },
  'PM Corridor Peak': {
    label: 'PM corridor peak',
    color: '#c62828',
  },
  'Peak Cross Traffic': {
    label: 'Peak cross traffic',
    color: '#6a1b9a',
    dashed: true,
  },
}

const parsePeakValue = (sourceValue: string): PeakDisplayValue => {
  const separator = ' - '
  const separatorIndex = sourceValue.indexOf(separator)
  const isTimeOnly = /^\d{1,2}:\d{2}$/.test(sourceValue)
  const time =
    separatorIndex >= 0
      ? sourceValue.slice(0, separatorIndex)
      : isTimeOnly
        ? sourceValue
        : ''
  const measurement =
    separatorIndex >= 0
      ? sourceValue.slice(separatorIndex + separator.length)
      : isTimeOnly
        ? ''
        : sourceValue
  const measurementParts = measurement.match(
    /^([+-]?(?:\d[\d,]*)(?:\.\d+)?)\s*(.*)$/
  )

  return {
    time,
    value: measurementParts?.[1] ?? measurement,
    unit: measurementParts?.[2] ?? '',
  }
}

const getPlanLabel = (planNumber: string, description?: string | null) => {
  if (planNumber === 'FREE') return 'Free'

  const normalizedDescription = description?.trim()
  return normalizedDescription || `Plan ${planNumber}`
}

const sectionTitleSx = {
  fontSize: '0.8rem',
  fontWeight: 700,
  lineHeight: 1.25,
}

const getActionableReviewThreshold = (
  thresholds?: Record<string, number> | null
) => {
  const normalizedThresholds = new Map(
    Object.entries(thresholds ?? {}).map(([name, value]) => [
      name.toLowerCase().replace(/[^a-z]/g, ''),
      value,
    ])
  )
  const splitReviewThreshold = normalizedThresholds.get('splitreview') ?? 35
  const shoulderReviewThreshold =
    normalizedThresholds.get('shoulderreview') ?? 45

  return Math.min(splitReviewThreshold, shoulderReviewThreshold)
}

export default function TimeOfDaySummary({
  result,
  peakItems,
}: TimeOfDaySummaryProps) {
  const proposedSchedule = result.recommendation?.recommendedSchedule ?? []
  const scheduleEntries = getScheduleEntries(proposedSchedule)
  const scheduleColorMap = getSchedulePlanColorMap([proposedSchedule])
  const splitPressure = result.splitPressure
  const reviewText = splitPressure?.reviewText?.trim()
  const peakCrossTrafficPercent = splitPressure?.peakCrossTrafficPercent
  const hasActionableReview =
    peakCrossTrafficPercent !== undefined &&
    peakCrossTrafficPercent !== null &&
    Number.isFinite(peakCrossTrafficPercent) &&
    peakCrossTrafficPercent >=
      getActionableReviewThreshold(splitPressure?.thresholdPercentByName)
  const hasMeasuredPeaks = peakItems.length > 0
  const hasSchedule = scheduleEntries.length > 0
  const sectionColumns = [hasSchedule, hasMeasuredPeaks, Boolean(reviewText)]
    .filter(Boolean)
    .map((_, index, sections) =>
      sections.length === 3 && index === 1 ? '1.4fr' : '0.9fr'
    )
    .join(' ')

  if (!hasSchedule && !hasMeasuredPeaks && !reviewText) return null

  return (
    <Paper
      component="section"
      aria-label="Summary"
      variant="outlined"
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: sectionColumns },
        borderColor: 'divider',
        bgcolor: 'common.white',
        boxShadow: 'none',
        overflow: 'hidden',
      }}
    >
      {hasSchedule && (
        <Box
          sx={{
            minWidth: 0,
            borderRight: {
              xs: 0,
              md: hasMeasuredPeaks || reviewText ? '1px solid' : 0,
            },
            borderBottom: {
              xs: hasMeasuredPeaks || reviewText ? '1px solid' : 0,
              md: 0,
            },
            borderColor: 'divider',
          }}
        >
          <Box
            sx={{
              px: 1.5,
              py: 1,
              borderBottom: '1px solid',
              borderColor: 'divider',
              bgcolor: 'grey.50',
            }}
          >
            <Typography component="h3" sx={sectionTitleSx}>
              Proposed Plan Schedule
            </Typography>
          </Box>
          <Box sx={{ display: 'grid', gap: 0.62, p: 1.5 }}>
            {scheduleEntries.map(({ plan, interval }) => {
              const planNumber = formatPlanNumber(plan.planNumber)
              const color = scheduleColorMap.get(planNumber) ?? '#8da0b4'

              return (
                <Box
                  key={`${interval.start}-${interval.end}-${planNumber}`}
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: '8px auto minmax(0, 1fr)',
                    alignItems: 'center',
                    columnGap: 0.85,
                    minWidth: 0,
                  }}
                >
                  <Box
                    aria-hidden
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: 0.4,
                      bgcolor: color,
                    }}
                  />
                  <Typography
                    sx={{
                      color: 'text.primary',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      lineHeight: 1.25,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {minutesToTimeLabel(interval.start)}
                    {'\u2013'}
                    {minutesToTimeLabel(interval.end)}
                  </Typography>
                  <Typography
                    sx={{
                      minWidth: 0,
                      overflow: 'hidden',
                      color: 'text.secondary',
                      fontSize: '0.7rem',
                      lineHeight: 1.25,
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {getPlanLabel(planNumber, plan.planDescription)}
                  </Typography>
                </Box>
              )
            })}
          </Box>
        </Box>
      )}

      {hasMeasuredPeaks && (
        <Box
          sx={{
            minWidth: 0,
            borderRight: {
              xs: 0,
              md: reviewText ? '1px solid' : 0,
            },
            borderBottom: {
              xs: reviewText ? '1px solid' : 0,
              md: 0,
            },
            borderColor: 'divider',
          }}
        >
          <Box
            sx={{
              px: 1.5,
              py: 1,
              borderBottom: '1px solid',
              borderColor: 'divider',
              bgcolor: 'grey.50',
            }}
          >
            <Typography component="h3" sx={sectionTitleSx}>
              Measured Peaks
            </Typography>
          </Box>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: `repeat(${peakItems.length}, minmax(0, 1fr))`,
              p: 1.5,
            }}
          >
            {peakItems.map((item, index) => {
              const displayValue = parsePeakValue(item.value)
              const display = peakDisplayBySource[item.label] ?? {
                label: item.label,
                color: '#546e7a',
              }
              const isCrossTraffic = item.label === 'Peak Cross Traffic'

              return (
                <Box
                  key={item.label}
                  sx={{
                    minWidth: 0,
                    px: index === 0 ? 0 : { xs: 1, sm: 1.75 },
                    pr:
                      index === peakItems.length - 1 ? 0 : { xs: 1, sm: 1.75 },
                    borderRight:
                      index === peakItems.length - 1 ? 0 : '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.75,
                      mb: 0.6,
                      minWidth: 0,
                    }}
                  >
                    <Box
                      aria-hidden
                      sx={{
                        width: 14,
                        flex: '0 0 auto',
                        borderTop: '2px solid',
                        borderTopColor: display.color,
                        borderTopStyle: display.dashed ? 'dashed' : 'solid',
                      }}
                    />
                    <Typography
                      sx={{
                        minWidth: 0,
                        overflow: 'hidden',
                        color: 'text.secondary',
                        fontSize: '0.7rem',
                        lineHeight: 1.25,
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {display.label}
                    </Typography>
                  </Box>
                  {displayValue.value && (
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'baseline',
                        gap: 0.6,
                        minWidth: 0,
                      }}
                    >
                      <Typography
                        sx={{
                          color: 'text.primary',
                          fontSize: '1.22rem',
                          fontWeight: 800,
                          lineHeight: 1.15,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {displayValue.value}
                      </Typography>
                      {displayValue.unit && (
                        <Typography
                          component="span"
                          sx={{
                            color: 'text.secondary',
                            fontSize: '0.68rem',
                            lineHeight: 1,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {displayValue.unit}
                        </Typography>
                      )}
                    </Box>
                  )}
                  {displayValue.time && (
                    <Box
                      component="span"
                      sx={{
                        display: 'inline-flex',
                        mt: displayValue.value ? 0.55 : 0.7,
                        px: 0.72,
                        py: 0.25,
                        borderRadius: 0.5,
                        bgcolor: isCrossTraffic
                          ? 'rgba(106, 27, 154, 0.1)'
                          : 'grey.100',
                        color: isCrossTraffic ? '#6a1b9a' : 'text.secondary',
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        lineHeight: 1.25,
                      }}
                    >
                      {displayValue.time}
                    </Box>
                  )}
                </Box>
              )
            })}
          </Box>
        </Box>
      )}

      {reviewText && (
        <Box sx={{ minWidth: 0, p: 1.5 }}>
          <Alert
            severity={hasActionableReview ? 'warning' : 'info'}
            variant="outlined"
            sx={{
              alignItems: 'flex-start',
              '& .MuiAlert-message': { width: '100%', minWidth: 0 },
            }}
          >
            <AlertTitle sx={{ mb: 0.4 }}>
              <Typography
                component="h3"
                sx={{
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  lineHeight: 1.25,
                }}
              >
                {hasActionableReview ? '1 review item' : 'Review status'}
              </Typography>
            </AlertTitle>
            <Typography
              sx={{
                color: 'text.primary',
                fontSize: '0.875rem',
                lineHeight: 1.45,
              }}
            >
              {reviewText}
            </Typography>
          </Alert>
        </Box>
      )}
    </Paper>
  )
}
