import type { TimeOfDayResult } from '@/api/reports'
import { Box, Button, ButtonGroup, Stack } from '@mui/material'
import { useEffect, useState } from 'react'
import type { TimeOfDayLocationNumberMap } from '../../transformers'
import {
  getCrossTrafficLocations,
  getLocationPeakEvents,
  getMovementPressures,
} from '../../transformers'
import { timeOfDayToggleGroupSx } from '../chart/TimeOfDayChartHeader'
import type { TimeOfDayAnalysisMode } from '../chart/TimeOfDayLayersPanel'
import {
  CrossTrafficLocationList,
  MovementPressureList,
  PeakList,
} from './TimeOfDayDetailTables'

const periods = ['AM', 'Midday', 'PM']
type TimeOfDayPressureDetailsView = 'cross-traffic' | 'movement-pressure'

export default function TimeOfDayDetailsPanel({
  result,
  activeMode,
  selectedSeries,
  locationNumberMap,
  selectedDetailKey,
  onSelectDetail,
  onSetSeriesVisibility,
}: {
  result: TimeOfDayResult
  activeMode: TimeOfDayAnalysisMode
  selectedSeries: Record<string, boolean>
  locationNumberMap: TimeOfDayLocationNumberMap
  selectedDetailKey?: string
  onSelectDetail: (detailKey: string) => void
  onSetSeriesVisibility: (seriesNames: string[], visible: boolean) => void
}) {
  const [pressureView, setPressureView] =
    useState<TimeOfDayPressureDetailsView>('cross-traffic')

  useEffect(() => {
    if (selectedDetailKey?.startsWith('crosstraffic:')) {
      setPressureView('cross-traffic')
    } else if (selectedDetailKey?.startsWith('movementpressure:')) {
      setPressureView('movement-pressure')
    }
  }, [selectedDetailKey])

  return (
    <Stack spacing={2}>
      {activeMode === 'pressure' && (
        <Box
          component="nav"
          aria-label="Pressure detail views"
          sx={{
            position: 'sticky',
            top: 0,
            zIndex: 1,
            bgcolor: 'common.white',
            px: 1.25,
            py: 0.75,
          }}
        >
          <ButtonGroup
            size="small"
            variant="outlined"
            aria-label="Time-of-day detail views"
            sx={timeOfDayToggleGroupSx}
          >
            <Button
              className={
                pressureView === 'cross-traffic' ? 'is-active' : undefined
              }
              onClick={() => setPressureView('cross-traffic')}
              aria-pressed={pressureView === 'cross-traffic'}
            >
              Cross Traffic
            </Button>
            <Button
              className={
                pressureView === 'movement-pressure' ? 'is-active' : undefined
              }
              onClick={() => setPressureView('movement-pressure')}
              aria-pressed={pressureView === 'movement-pressure'}
            >
              Movement Pressure
            </Button>
          </ButtonGroup>
        </Box>
      )}

      {activeMode === 'recommendation' && (
        <Stack spacing={2} role="region" aria-label="Peaks" sx={{ p: 1.25 }}>
          <PeakList
            title="AM Signal Peaks"
            peaks={getLocationPeakEvents(result.planProfile?.peaks, 'AM')}
            seriesVisible={Boolean(selectedSeries['AM Signal Peaks'])}
            selectedDetailKey={selectedDetailKey}
            onSelectDetail={onSelectDetail}
            onSetSeriesVisibility={(visible) =>
              onSetSeriesVisibility(['AM Signal Peaks'], visible)
            }
          />
          <PeakList
            title="PM Signal Peaks"
            peaks={getLocationPeakEvents(result.planProfile?.peaks, 'PM')}
            seriesVisible={Boolean(selectedSeries['PM Signal Peaks'])}
            selectedDetailKey={selectedDetailKey}
            onSelectDetail={onSelectDetail}
            onSetSeriesVisibility={(visible) =>
              onSetSeriesVisibility(['PM Signal Peaks'], visible)
            }
          />
        </Stack>
      )}

      {activeMode === 'pressure' && pressureView === 'cross-traffic' && (
        <Stack
          spacing={2}
          role="region"
          aria-label="Cross Traffic"
          sx={{ px: 1.25, pb: 1.25 }}
        >
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
              seriesVisible={Boolean(
                selectedSeries[`${period} Cross Traffic Locations`]
              )}
              selectedDetailKey={selectedDetailKey}
              onSelectDetail={onSelectDetail}
              onSetSeriesVisibility={(visible) =>
                onSetSeriesVisibility(
                  [`${period} Cross Traffic Locations`],
                  visible
                )
              }
            />
          ))}
        </Stack>
      )}

      {activeMode === 'pressure' && pressureView === 'movement-pressure' && (
        <Stack
          spacing={2}
          role="region"
          aria-label="Movement Pressure"
          sx={{ px: 1.25, pb: 1.25 }}
        >
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
              seriesVisible={Boolean(
                selectedSeries[`${period} Movement Pressure`]
              )}
              selectedDetailKey={selectedDetailKey}
              onSelectDetail={onSelectDetail}
              onSetSeriesVisibility={(visible) =>
                onSetSeriesVisibility([`${period} Movement Pressure`], visible)
              }
            />
          ))}
        </Stack>
      )}
    </Stack>
  )
}
