import type { TimeOfDayResult } from '@/api/reports'
import { Box, Stack, Typography } from '@mui/material'
import type { TimeOfDayLocationNumberMap } from '../../transformers'
import {
  getCrossTrafficLocations,
  getLocationPeakEvents,
  getMovementPressures,
} from '../../transformers'
import {
  CrossTrafficLocationList,
  MovementPressureList,
  PeakList,
} from './TimeOfDayDetailTables'

const periods = ['AM', 'Midday', 'PM']

const TextBlock = ({
  label,
  text,
}: {
  label: string
  text?: string | null
}) => {
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

export default function TimeOfDayDetailsPanel({
  result,
  locationNumberMap,
  selectedDetailKey,
  onSelectDetail,
}: {
  result: TimeOfDayResult
  locationNumberMap: TimeOfDayLocationNumberMap
  selectedDetailKey?: string
  onSelectDetail: (detailKey: string) => void
}) {
  return (
    <Stack spacing={2}>
      <Stack spacing={1}>
        <TextBlock
          label="Recommendation"
          text={result.recommendation?.summaryText}
        />
        <TextBlock
          label="Current Schedule"
          text={result.planComparison?.summaryText}
        />
        <TextBlock
          label="Exceptions"
          text={result.planComparison?.exceptionsText}
        />
        <TextBlock
          label="Pressure Summary"
          text={result.splitPressure?.summaryText}
        />
        <TextBlock label="Review" text={result.splitPressure?.reviewText} />
      </Stack>
      <PeakList
        title="AM Signal Peaks"
        peaks={getLocationPeakEvents(result.planProfile?.peaks, 'AM')}
        selectedDetailKey={selectedDetailKey}
        onSelectDetail={onSelectDetail}
      />
      <PeakList
        title="PM Signal Peaks"
        peaks={getLocationPeakEvents(result.planProfile?.peaks, 'PM')}
        selectedDetailKey={selectedDetailKey}
        onSelectDetail={onSelectDetail}
      />
      {periods.map((period) => (
        <CrossTrafficLocationList
          key={period}
          title={`${period} Cross Traffic Locations`}
          period={period}
          locations={getCrossTrafficLocations(
            result.splitPressure?.crossTrafficLocations,
            period
          )}
          locationNumberMap={locationNumberMap}
          selectedDetailKey={selectedDetailKey}
          onSelectDetail={onSelectDetail}
        />
      ))}
      {['AM', 'PM'].map((period) => (
        <MovementPressureList
          key={period}
          title={`${period} Movement Pressure`}
          period={period}
          movements={getMovementPressures(
            result.splitPressure?.movementPressures,
            period,
            locationNumberMap
          )}
          locationNumberMap={locationNumberMap}
          selectedDetailKey={selectedDetailKey}
          onSelectDetail={onSelectDetail}
        />
      ))}
    </Stack>
  )
}
