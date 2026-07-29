import type { Plan, TimeOfDayResult } from '@/api/reports'
import {
  Alert,
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import {
  formatNumber,
  formatPlanNumber,
  formatPlanTime,
} from '../../transformers'

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

export default function TimeOfDayLocationData({
  result,
}: {
  result: TimeOfDayResult
}) {
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
