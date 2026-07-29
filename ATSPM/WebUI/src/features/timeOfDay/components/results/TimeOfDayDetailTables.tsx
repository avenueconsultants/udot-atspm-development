import type {
  TimeOfDayCrossTrafficLocationDto,
  TimeOfDayMovementPressureDto,
} from '@/api/reports'
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import type {
  TimeOfDayLocationNumberMap,
  TimeOfDayNumberedPeakEvent,
} from '../../transformers'
import {
  formatNumber,
  getLocationNumber,
  getTimeOfDayCrossTrafficDetailKey,
  getTimeOfDayMovementPressureDetailKey,
  getTimeOfDayPeriodBadgeColor,
  getTimeOfDaySignalPeakDetailKey,
} from '../../transformers'

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

function SignalPeakBadge({
  badgeNumber,
  color,
  shape = 'circle',
}: {
  badgeNumber: number
  color: string
  shape?: 'circle' | 'square'
}) {
  return (
    <Box
      component="span"
      sx={{
        alignItems: 'center',
        bgcolor: color,
        borderRadius: shape === 'circle' ? '50%' : '2px',
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

export function PeakList({
  title,
  peaks,
  selectedDetailKey,
  onSelectDetail,
}: {
  title: string
  peaks: TimeOfDayNumberedPeakEvent[]
  selectedDetailKey?: string
  onSelectDetail: (detailKey: string) => void
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
              {peaks.map((peak, index) => {
                const detailKey = getTimeOfDaySignalPeakDetailKey(peak)

                return (
                  <TableRow
                    key={`${title}-${peak.locationIdentifier}-${index}`}
                    hover
                    selected={selectedDetailKey === detailKey}
                    aria-selected={selectedDetailKey === detailKey}
                    onClick={() => onSelectDetail(detailKey)}
                    sx={{ ...compactReportTableRowSx, cursor: 'pointer' }}
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
                )
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  )
}

export function CrossTrafficLocationList({
  title,
  period,
  locations,
  locationNumberMap,
  selectedDetailKey,
  onSelectDetail,
}: {
  title: string
  period: string
  locations: TimeOfDayCrossTrafficLocationDto[]
  locationNumberMap: TimeOfDayLocationNumberMap
  selectedDetailKey?: string
  onSelectDetail: (detailKey: string) => void
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
              {locations.map((location, index) => {
                const detailKey = getTimeOfDayCrossTrafficDetailKey(
                  location,
                  period
                )
                const locationNumber = getLocationNumber(
                  locationNumberMap,
                  location.locationIdentifier
                )

                return (
                  <TableRow
                    key={`${title}-${location.locationIdentifier}-${index}`}
                    hover
                    selected={selectedDetailKey === detailKey}
                    aria-selected={selectedDetailKey === detailKey}
                    onClick={() => onSelectDetail(detailKey)}
                    sx={{ ...compactReportTableRowSx, cursor: 'pointer' }}
                  >
                    <TableCell>
                      {locationNumber ? (
                        <SignalPeakBadge
                          badgeNumber={locationNumber}
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
                )
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  )
}

export function MovementPressureList({
  title,
  period,
  movements,
  locationNumberMap,
  selectedDetailKey,
  onSelectDetail,
}: {
  title: string
  period: string
  movements: TimeOfDayMovementPressureDto[]
  locationNumberMap: TimeOfDayLocationNumberMap
  selectedDetailKey?: string
  onSelectDetail: (detailKey: string) => void
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
              {movements.map((movement, index) => {
                const detailKey = getTimeOfDayMovementPressureDetailKey(
                  movement,
                  period
                )
                const locationNumber = getLocationNumber(
                  locationNumberMap,
                  movement.locationIdentifier
                )

                return (
                  <TableRow
                    key={`${title}-${movement.locationIdentifier}-${movement.movement}-${index}`}
                    hover
                    selected={selectedDetailKey === detailKey}
                    aria-selected={selectedDetailKey === detailKey}
                    onClick={() => onSelectDetail(detailKey)}
                    sx={{ ...compactReportTableRowSx, cursor: 'pointer' }}
                  >
                    <TableCell>
                      {locationNumber ? (
                        <SignalPeakBadge
                          badgeNumber={locationNumber}
                          color={getTimeOfDayPeriodBadgeColor(period)}
                          shape="square"
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
                )
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  )
}
