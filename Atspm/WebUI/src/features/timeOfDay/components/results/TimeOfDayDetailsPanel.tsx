import type { TimeOfDayResult } from '@/api/reports'
import { Button, ButtonGroup, Stack } from '@mui/material'
import { useEffect, useState } from 'react'
import type { TimeOfDayLocationNumberMap } from '../../transformers'
import {
  getCrossTrafficLocations,
  getLocationPeakEvents,
  getMovementPressures,
} from '../../transformers'
import { timeOfDayToggleGroupSx } from '../chart/TimeOfDayChartHeader'
import {
  CrossTrafficLocationList,
  MovementPressureList,
  PeakList,
} from './TimeOfDayDetailTables'

const periods = ['AM', 'Midday', 'PM']
type TimeOfDayDetailsView = 'peaks' | 'cross-traffic' | 'movement-pressure'

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
  const [activeView, setActiveView] = useState<TimeOfDayDetailsView>('peaks')

  useEffect(() => {
    if (selectedDetailKey?.startsWith('crosstraffic:')) {
      setActiveView('cross-traffic')
    } else if (selectedDetailKey?.startsWith('movementpressure:')) {
      setActiveView('movement-pressure')
    } else if (selectedDetailKey?.startsWith('signalpeak:')) {
      setActiveView('peaks')
    }
  }, [selectedDetailKey])

  return (
    <Stack spacing={2}>
      <ButtonGroup
        size="small"
        variant="outlined"
        aria-label="Time-of-day detail views"
        sx={{ ...timeOfDayToggleGroupSx, alignSelf: 'flex-start' }}
      >
        <Button
          className={activeView === 'peaks' ? 'is-active' : undefined}
          onClick={() => setActiveView('peaks')}
          aria-pressed={activeView === 'peaks'}
        >
          Peaks
        </Button>
        <Button
          className={activeView === 'cross-traffic' ? 'is-active' : undefined}
          onClick={() => setActiveView('cross-traffic')}
          aria-pressed={activeView === 'cross-traffic'}
        >
          Cross Traffic
        </Button>
        <Button
          className={
            activeView === 'movement-pressure' ? 'is-active' : undefined
          }
          onClick={() => setActiveView('movement-pressure')}
          aria-pressed={activeView === 'movement-pressure'}
        >
          Movement Pressure
        </Button>
      </ButtonGroup>

      {activeView === 'peaks' && (
        <Stack spacing={2} role="region" aria-label="Peaks">
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
        </Stack>
      )}

      {activeView === 'cross-traffic' && (
        <Stack spacing={2} role="region" aria-label="Cross Traffic">
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
        </Stack>
      )}

      {activeView === 'movement-pressure' && (
        <Stack spacing={2} role="region" aria-label="Movement Pressure">
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
      )}
    </Stack>
  )
}
