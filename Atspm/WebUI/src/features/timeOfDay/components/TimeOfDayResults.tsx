import type {
  Plan,
  TimeOfDayCrossTrafficLocationDto,
  TimeOfDayMovementPressureDto,
  TimeOfDayResult,
} from '@/api/reports'
import ApacheEChart from '@/features/charts/components/apacheEChart'
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
import { useMemo } from 'react'
import type {
  TimeOfDayLocationNumberMap,
  TimeOfDayNumberedPeakEvent,
} from '../transformers'
import {
  buildPlanProfileOption,
  buildScheduleRows,
  buildSplitPressureLocationNumberMap,
  buildSplitPressureOption,
  formatNumber,
  formatPlanNumber,
  formatPlanTime,
  getCrossTrafficLocations,
  getLocationNumber,
  getLocationPeakEvents,
  getMovementPressures,
  getTimeOfDayPeriodBadgeColor,
  hasPlanProfileData,
  hasSplitPressureData,
} from '../transformers'

interface TimeOfDayResultsProps {
  result: TimeOfDayResult
}

const periods = ['AM', 'Midday', 'PM']

const compactReportTableContainerSx = {
  borderRadius: 2,
  borderColor: 'grey.200',
  overflowX: 'auto',
}

const compactReportTableHeadSx = {
  '& .MuiTableCell-head': {
    fontSize: '0.8rem',
    bgcolor: 'grey.100',
    lineHeight: '1rem',
    padding: '0.5rem',
    borderBottom: '1px solid',
    borderColor: 'divider',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
}

const compactReportTableRowSx = {
  '& .MuiTableCell-body': {
    fontSize: '0.9rem',
    borderRight: '1px solid #e0e0e0',
    padding: '.7rem',
    verticalAlign: 'middle',
  },
  '&:nth-of-type(odd)': { backgroundColor: '#f4f4f4' },
}

const chartSidePanelSx = {
  maxHeight: { xs: 720, md: 840 },
  overflowY: 'auto',
  overflowX: 'hidden',
  pr: 1,
  minWidth: 0,
}

const formatLocationLabel = (
  identifier?: string | null,
  description?: string | null
) => {
  if (identifier && description) {
    return description.includes(identifier)
      ? description
      : `${identifier} - ${description}`
  }

  return description ?? identifier ?? '-'
}

const formatBoolean = (value?: boolean | null) => {
  if (value === undefined || value === null) return '-'

  return value ? 'Yes' : 'No'
}

const formatPlanSchedule = (plans?: Plan[] | null) => {
  if (!plans?.length) return '-'

  return plans
    .map(
      (plan) =>
        `${formatPlanNumber(plan.planNumber)} ${formatPlanTime(
          plan.start
        )}-${formatPlanTime(plan.end)}`
    )
    .join('; ')
}

function SignalPeakBadge({
  badgeNumber,
  color,
}: {
  badgeNumber: number
  color: string
}) {
  return (
    <Box
      component="span"
      sx={{
        alignItems: 'center',
        bgcolor: color,
        borderRadius: '50%',
        color: 'common.white',
        display: 'inline-flex',
        flexShrink: 0,
        fontSize: 10,
        fontWeight: 700,
        height: 18,
        justifyContent: 'center',
        lineHeight: 1,
        minWidth: 18,
        opacity: 0.82,
        width: 18,
      }}
    >
      {badgeNumber}
    </Box>
  )
}

const renderTextBlock = (label: string, text?: string | null) => {
  if (!text) return null

  return (
    <Box>
      <Typography variant="subtitle2">{label}</Typography>
      <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
        {text}
      </Typography>
    </Box>
  )
}

function PeakList({
  title,
  peaks,
}: {
  title: string
  peaks: TimeOfDayNumberedPeakEvent[]
}) {
  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        {title}
      </Typography>
      {peaks.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No peaks
        </Typography>
      ) : (
        <TableContainer
          component={Paper}
          variant="outlined"
          sx={compactReportTableContainerSx}
        >
          <Table
            size="small"
            aria-label={`${title} peak list`}
            sx={{ minWidth: 480 }}
          >
            <TableHead sx={compactReportTableHeadSx}>
              <TableRow>
                <TableCell sx={{ width: 40 }} />
                <TableCell>Location</TableCell>
                <TableCell>Time</TableCell>
                <TableCell align="right">vph</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {peaks.map((peak, index) => (
                <TableRow
                  key={`${title}-${peak.locationIdentifier}-${index}`}
                  sx={compactReportTableRowSx}
                >
                  <TableCell>
                    <SignalPeakBadge
                      badgeNumber={peak.badgeNumber}
                      color={peak.badgeColor}
                    />
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    {formatLocationLabel(
                      peak.locationIdentifier,
                      peak.locationDescription
                    )}
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    {peak.timeOfDay ?? '-'}
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      fontVariantNumeric: 'tabular-nums',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {formatNumber(peak.value)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  )
}

function CrossTrafficLocationList({
  title,
  period,
  locations,
  locationNumberMap,
}: {
  title: string
  period: string
  locations: TimeOfDayCrossTrafficLocationDto[]
  locationNumberMap: TimeOfDayLocationNumberMap
}) {
  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        {title}
      </Typography>
      {locations.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No locations
        </Typography>
      ) : (
        <TableContainer
          component={Paper}
          variant="outlined"
          sx={compactReportTableContainerSx}
        >
          <Table
            size="small"
            aria-label={`${title} cross traffic locations`}
            sx={{ minWidth: 520 }}
          >
            <TableHead sx={compactReportTableHeadSx}>
              <TableRow>
                <TableCell sx={{ width: 40 }} />
                <TableCell>Location</TableCell>
                <TableCell>Peak</TableCell>
                <TableCell align="right">VPH</TableCell>
                <TableCell align="right">Share</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {locations.map((location, index) => (
                <TableRow
                  key={`${title}-${location.locationIdentifier}-${index}`}
                  sx={compactReportTableRowSx}
                >
                  <TableCell>
                    {getLocationNumber(
                      locationNumberMap,
                      location.locationIdentifier
                    ) ? (
                      <SignalPeakBadge
                        badgeNumber={
                          getLocationNumber(
                            locationNumberMap,
                            location.locationIdentifier
                          ) as number
                        }
                        color={getTimeOfDayPeriodBadgeColor(period)}
                      />
                    ) : null}
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    {formatLocationLabel(
                      location.locationIdentifier,
                      location.locationDescription
                    )}
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    {location.peakTime ?? '-'}
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      fontVariantNumeric: 'tabular-nums',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {formatNumber(location.totalVehiclesPerHour)}
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      fontVariantNumeric: 'tabular-nums',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {location.percentOfCrossTraffic === undefined ||
                    location.percentOfCrossTraffic === null
                      ? '-'
                      : `${formatNumber(location.percentOfCrossTraffic, 1)}%`}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  )
}

function MovementPressureList({
  title,
  period,
  movements,
  locationNumberMap,
}: {
  title: string
  period: string
  movements: TimeOfDayMovementPressureDto[]
  locationNumberMap: TimeOfDayLocationNumberMap
}) {
  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        {title}
      </Typography>
      {movements.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No movements
        </Typography>
      ) : (
        <TableContainer
          component={Paper}
          variant="outlined"
          sx={compactReportTableContainerSx}
        >
          <Table
            size="small"
            aria-label={`${title} movement pressure`}
            sx={{ minWidth: 520 }}
          >
            <TableHead sx={compactReportTableHeadSx}>
              <TableRow>
                <TableCell sx={{ width: 40 }} />
                <TableCell>Location</TableCell>
                <TableCell>Movement</TableCell>
                <TableCell>Peak</TableCell>
                <TableCell align="right">VPH</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {movements.map((movement, index) => (
                <TableRow
                  key={`${title}-${movement.locationIdentifier}-${movement.movement}-${index}`}
                  sx={compactReportTableRowSx}
                >
                  <TableCell>
                    {getLocationNumber(
                      locationNumberMap,
                      movement.locationIdentifier
                    ) ? (
                      <SignalPeakBadge
                        badgeNumber={
                          getLocationNumber(
                            locationNumberMap,
                            movement.locationIdentifier
                          ) as number
                        }
                        color={getTimeOfDayPeriodBadgeColor(period)}
                      />
                    ) : null}
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    {movement.locationIdentifier ?? '-'}
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    {movement.movementLabel ?? movement.movement ?? '-'}
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    {movement.peakTime ?? '-'}
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      fontVariantNumeric: 'tabular-nums',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {formatNumber(movement.volume)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  )
}

function PlanComparisonTable({ result }: { result: TimeOfDayResult }) {
  const rows = buildScheduleRows(result)
  const exceptionLocations =
    result.planComparison?.exceptionLocationIdentifiers ?? []

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h5" component="h2" sx={{ mb: 2 }}>
        Existing vs Recommended TOD Plan Comparison
      </Typography>
      <Stack spacing={1.5} sx={{ mb: 2 }}>
        {renderTextBlock('Recommendation', result.recommendation?.summaryText)}
        {renderTextBlock(
          'Current Schedule',
          result.planComparison?.summaryText
        )}
        {renderTextBlock('Exceptions', result.planComparison?.exceptionsText)}
        {exceptionLocations.length > 0 && (
          <Stack direction="row" gap={1} flexWrap="wrap">
            {exceptionLocations.map((location) => (
              <Chip
                key={location}
                color="warning"
                size="small"
                label={location}
              />
            ))}
          </Stack>
        )}
      </Stack>
      {rows.length === 0 ? (
        <Alert severity="warning">
          {result.planComparison?.summaryText ||
            'Current schedule unavailable.'}
        </Alert>
      ) : (
        <Table size="small" aria-label="time of day plan comparison">
          <TableHead>
            <TableRow>
              <TableCell>Schedule Type</TableCell>
              <TableCell>Locations</TableCell>
              <TableCell>Plan</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Start</TableCell>
              <TableCell>End</TableCell>
              <TableCell align="right">Duration Minutes</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.scheduleType}</TableCell>
                <TableCell>{row.locations}</TableCell>
                <TableCell>{row.plan}</TableCell>
                <TableCell>{row.description}</TableCell>
                <TableCell>{row.start}</TableCell>
                <TableCell>{row.end}</TableCell>
                <TableCell align="right">
                  {formatNumber(row.durationMinutes)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Paper>
  )
}

function LocationSupportingTable({ result }: { result: TimeOfDayResult }) {
  const locations = result.locations ?? []

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h5" component="h2" sx={{ mb: 2 }}>
        Location Supporting Data
      </Typography>
      {locations.length === 0 ? (
        <Alert severity="warning">No location supporting data available.</Alert>
      ) : (
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small" aria-label="time of day location supporting data">
            <TableHead>
              <TableRow>
                <TableCell>Location</TableCell>
                <TableCell>Location Name</TableCell>
                <TableCell align="right">Days With Data</TableCell>
                <TableCell>Fallback Used</TableCell>
                <TableCell>Existing TOD Plans</TableCell>
                <TableCell align="right">Peak Raw Volume</TableCell>
                <TableCell align="right">Peak Smoothed Volume</TableCell>
                <TableCell align="right">Peak Hourly Rate</TableCell>
                <TableCell align="right">Peak Occupancy</TableCell>
                <TableCell align="right">AM Peak Occupancy</TableCell>
                <TableCell align="right">PM Peak Occupancy</TableCell>
                <TableCell>AM Direction Exception</TableCell>
                <TableCell>PM Direction Exception</TableCell>
                <TableCell>Cross Traffic Review</TableCell>
                <TableCell>Data Quality Flag</TableCell>
                <TableCell>Notes</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {locations.map((location) => (
                <TableRow key={location.locationIdentifier}>
                  <TableCell>{location.locationIdentifier ?? '-'}</TableCell>
                  <TableCell>{location.locationDescription ?? '-'}</TableCell>
                  <TableCell align="right">
                    {formatNumber(location.daysWithData)}
                  </TableCell>
                  <TableCell>
                    {formatBoolean(location.coverageFallbackUsed)}
                  </TableCell>
                  <TableCell>
                    {formatPlanSchedule(location.currentPlanSchedule)}
                  </TableCell>
                  <TableCell align="right">
                    {formatNumber(location.summary?.peakRawVolume)}
                  </TableCell>
                  <TableCell align="right">
                    {formatNumber(location.summary?.peakSmoothedVolume)}
                  </TableCell>
                  <TableCell align="right">
                    {formatNumber(location.summary?.peakHourlyRate)}
                  </TableCell>
                  <TableCell align="right">
                    {location.summary?.peakOccupancyPercent === undefined ||
                    location.summary?.peakOccupancyPercent === null
                      ? '-'
                      : `${formatNumber(
                          location.summary.peakOccupancyPercent,
                          1
                        )}%`}
                  </TableCell>
                  <TableCell align="right">
                    {location.summary?.amPeakOccupancyPercent === undefined ||
                    location.summary?.amPeakOccupancyPercent === null
                      ? '-'
                      : `${formatNumber(
                          location.summary.amPeakOccupancyPercent,
                          1
                        )}%`}
                  </TableCell>
                  <TableCell align="right">
                    {location.summary?.pmPeakOccupancyPercent === undefined ||
                    location.summary?.pmPeakOccupancyPercent === null
                      ? '-'
                      : `${formatNumber(
                          location.summary.pmPeakOccupancyPercent,
                          1
                        )}%`}
                  </TableCell>
                  <TableCell>
                    {location.summary?.amDirectionExceptionMessage ?? '-'}
                  </TableCell>
                  <TableCell>
                    {location.summary?.pmDirectionExceptionMessage ?? '-'}
                  </TableCell>
                  <TableCell>
                    {location.summary?.crossTrafficReview ?? '-'}
                  </TableCell>
                  <TableCell>{location.dataQualityFlag ?? '-'}</TableCell>
                  <TableCell>{location.summary?.notes ?? '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}
    </Paper>
  )
}

export default function TimeOfDayResults({ result }: TimeOfDayResultsProps) {
  const planProfileOption = useMemo(
    () => buildPlanProfileOption(result),
    [result]
  )
  const splitPressureOption = useMemo(
    () => buildSplitPressureOption(result),
    [result]
  )
  const splitPressureLocationNumberMap = useMemo(
    () => buildSplitPressureLocationNumberMap(result),
    [result]
  )
  const warnings = result.warnings ?? []

  return (
    <Stack spacing={3} sx={{ mt: 3 }}>
      {warnings.length > 0 && (
        <Stack spacing={1}>
          {warnings.map((warning, index) => (
            <Alert key={`${warning.code}-${index}`} severity="warning">
              {[warning.locationIdentifier, warning.message]
                .filter(Boolean)
                .join(': ')}
            </Alert>
          ))}
        </Stack>
      )}

      <Paper sx={{ p: 3 }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1fr) 560px' },
            gap: 3,
            alignItems: 'start',
          }}
        >
          <Box>
            {hasPlanProfileData(result) ? (
              <Box sx={{ height: { xs: 720, md: 840 }, minWidth: 600 }}>
                <ApacheEChart
                  id="time-of-day-plan-profile"
                  option={planProfileOption}
                  hideInteractionMessage
                  style={{ width: '100%', height: '100%' }}
                />
              </Box>
            ) : (
              <Alert severity="warning">No Data Available</Alert>
            )}
          </Box>
          <Stack spacing={2} sx={chartSidePanelSx}>
            <PeakList
              title="AM Signal Peaks"
              peaks={getLocationPeakEvents(result.planProfile?.peaks, 'AM')}
            />
            <PeakList
              title="PM Signal Peaks"
              peaks={getLocationPeakEvents(result.planProfile?.peaks, 'PM')}
            />
          </Stack>
        </Box>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1fr) 560px' },
            gap: 3,
            alignItems: 'start',
          }}
        >
          <Box>
            {hasSplitPressureData(result) ? (
              <Box sx={{ height: { xs: 720, md: 840 }, minWidth: 600 }}>
                <ApacheEChart
                  id="time-of-day-split-pressure"
                  option={splitPressureOption}
                  hideInteractionMessage
                  style={{ width: '100%', height: '100%' }}
                />
              </Box>
            ) : (
              <Alert severity="warning">No Data Available</Alert>
            )}
          </Box>
          <Stack spacing={2} sx={chartSidePanelSx}>
            {periods.map((period) => (
              <CrossTrafficLocationList
                key={period}
                title={`${period} Cross Traffic Locations`}
                period={period}
                locations={getCrossTrafficLocations(
                  result.splitPressure?.crossTrafficLocations,
                  period
                )}
                locationNumberMap={splitPressureLocationNumberMap}
              />
            ))}
            {['AM', 'PM'].map((period) => (
              <MovementPressureList
                key={period}
                title={`${period} Movement Pressure`}
                period={period}
                movements={getMovementPressures(
                  result.splitPressure?.movementPressures,
                  period
                )}
                locationNumberMap={splitPressureLocationNumberMap}
              />
            ))}
            <Stack spacing={1}>
              {renderTextBlock('Summary', result.splitPressure?.summaryText)}
              {renderTextBlock('Review', result.splitPressure?.reviewText)}
            </Stack>
          </Stack>
        </Box>
      </Paper>

      <PlanComparisonTable result={result} />
      <LocationSupportingTable result={result} />
    </Stack>
  )
}
