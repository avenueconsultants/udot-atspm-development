import type {
  TimeOfDayCrossTrafficLocationDto,
  TimeOfDayMovementPressureDto,
} from '@/api/reports'
import {
  Box,
  Checkbox,
  FormControlLabel,
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

import {
  compactReportTableContainerSx,
  compactReportTableHeadSx,
  compactReportTableRowSx,
  numericReportTableCellSx,
} from './timeOfDayReportTableStyles'

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

function DetailSectionHeader({
  title,
  seriesVisible,
  disabled,
  onSetSeriesVisibility,
}: {
  title: string
  seriesVisible: boolean
  disabled: boolean
  onSetSeriesVisibility: (visible: boolean) => void
}) {
  return (
    <Box
      sx={{
        alignItems: 'center',
        display: 'flex',
        justifyContent: 'space-between',
        mb: 1,
      }}
    >
      <Typography variant="subtitle2">{title}</Typography>
      <FormControlLabel
        control={
          <Checkbox
            size="small"
            checked={seriesVisible}
            disabled={disabled}
            onChange={(_, checked) => onSetSeriesVisibility(checked)}
            inputProps={{ 'aria-label': `Toggle ${title}` }}
            sx={{ p: 0.25 }}
          />
        }
        label="Show on chart"
        sx={{
          m: 0,
          gap: 0.5,
          '& .MuiFormControlLabel-label': {
            color: 'text.secondary',
            fontSize: '0.75rem',
          },
        }}
      />
    </Box>
  )
}

export function PeakList({
  title,
  peaks,
  seriesVisible,
  selectedDetailKey,
  onSelectDetail,
  onSetSeriesVisibility,
}: {
  title: string
  peaks: TimeOfDayNumberedPeakEvent[]
  seriesVisible: boolean
  selectedDetailKey?: string
  onSelectDetail: (detailKey: string) => void
  onSetSeriesVisibility: (visible: boolean) => void
}) {
  return (
    <Box>
      <DetailSectionHeader
        title={title}
        seriesVisible={seriesVisible}
        disabled={peaks.length === 0}
        onSetSeriesVisibility={onSetSeriesVisibility}
      />
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
                    <TableCell align="right" sx={numericReportTableCellSx}>
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
  seriesVisible,
  selectedDetailKey,
  onSelectDetail,
  onSetSeriesVisibility,
}: {
  title: string
  period: string
  locations: TimeOfDayCrossTrafficLocationDto[]
  locationNumberMap: TimeOfDayLocationNumberMap
  seriesVisible: boolean
  selectedDetailKey?: string
  onSelectDetail: (detailKey: string) => void
  onSetSeriesVisibility: (visible: boolean) => void
}) {
  return (
    <Box>
      <DetailSectionHeader
        title={title}
        seriesVisible={seriesVisible}
        disabled={locations.length === 0}
        onSetSeriesVisibility={onSetSeriesVisibility}
      />
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
                    <TableCell align="right" sx={numericReportTableCellSx}>
                      {formatNumber(location.totalVehiclesPerHour)}
                    </TableCell>
                    <TableCell align="right" sx={numericReportTableCellSx}>
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
  seriesVisible,
  selectedDetailKey,
  onSelectDetail,
  onSetSeriesVisibility,
}: {
  title: string
  period: string
  movements: TimeOfDayMovementPressureDto[]
  locationNumberMap: TimeOfDayLocationNumberMap
  seriesVisible: boolean
  selectedDetailKey?: string
  onSelectDetail: (detailKey: string) => void
  onSetSeriesVisibility: (visible: boolean) => void
}) {
  return (
    <Box>
      <DetailSectionHeader
        title={title}
        seriesVisible={seriesVisible}
        disabled={movements.length === 0}
        onSetSeriesVisibility={onSetSeriesVisibility}
      />
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
                    <TableCell align="right" sx={numericReportTableCellSx}>
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
