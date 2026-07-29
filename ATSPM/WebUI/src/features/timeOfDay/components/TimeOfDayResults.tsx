import type { TimeOfDayResult } from '@/api/reports'
import { Alert, Box, Paper, Stack, Tab, Tabs } from '@mui/material'
import { useCallback, useMemo, useState } from 'react'
import {
  buildSplitPressureLocationNumberMap,
  buildTimeOfDayAnalysisModel,
  hasPlanProfileData,
  hasSplitPressureData,
} from '../transformers'
import TimeOfDayChartWorkspace from './TimeOfDayChartWorkspace'
import TimeOfDaySchedules from './TimeOfDaySchedules'
import TimeOfDayDetailsPanel from './results/TimeOfDayDetailsPanel'
import TimeOfDayLocationData from './results/TimeOfDayLocationData'

interface TimeOfDayResultsProps {
  result: TimeOfDayResult
}

type TimeOfDayResultsTab = 'chart' | 'location-data' | 'schedules'

export default function TimeOfDayResults({ result }: TimeOfDayResultsProps) {
  const [activeTab, setActiveTab] = useState<TimeOfDayResultsTab>('chart')
  const analysisModel = useMemo(
    () => buildTimeOfDayAnalysisModel(result),
    [result]
  )
  const splitPressureLocationNumberMap = useMemo(
    () => buildSplitPressureLocationNumberMap(result),
    [result]
  )
  const warnings = result.warnings ?? []
  const hasChartData =
    hasPlanProfileData(result) ||
    hasSplitPressureData(result) ||
    analysisModel.layers.some(
      (layer) => layer.group === 'Schedules' && layer.available
    )
  const renderDetails = useCallback(
    ({
      selectedDetailKey,
      onSelectDetail,
    }: {
      selectedDetailKey?: string
      onSelectDetail: (detailKey: string) => void
    }) => (
      <TimeOfDayDetailsPanel
        result={result}
        locationNumberMap={splitPressureLocationNumberMap}
        selectedDetailKey={selectedDetailKey}
        onSelectDetail={onSelectDetail}
      />
    ),
    [result, splitPressureLocationNumberMap]
  )

  return (
    <Stack
      spacing={0}
      sx={{
        position: 'relative',
        width: {
          xs: 'calc(100% + 16px)',
          sm: 'calc(100% + 48px)',
        },
        ml: { xs: -1, sm: -3 },
      }}
    >
      {warnings.length > 0 && (
        <Stack spacing={1} sx={{ mt: 2, mx: 2 }}>
          {warnings.map((warning, index) => (
            <Alert key={`${warning.code}-${index}`} severity="warning">
              {[warning.locationIdentifier, warning.message]
                .filter(Boolean)
                .join(': ')}
            </Alert>
          ))}
        </Stack>
      )}

      <Tabs
        value={activeTab}
        onChange={(_, value: TimeOfDayResultsTab) => setActiveTab(value)}
        aria-label="Time-of-day results"
        sx={{ mt: 2 }}
      >
        <Tab value="chart" label="Time-of-Day Chart" />
        <Tab value="schedules" label="Schedules" />
        <Tab value="location-data" label="Location Data" />
      </Tabs>

      {activeTab === 'chart' && (
        <Paper
          sx={{ p: 0, ml: '2px', bgcolor: 'common.white' }}
          role="tabpanel"
          aria-label="Time-of-day chart"
        >
          {hasChartData ? (
            <TimeOfDayChartWorkspace
              model={analysisModel}
              renderDetails={renderDetails}
            />
          ) : (
            <Alert severity="warning">No Data Available</Alert>
          )}
        </Paper>
      )}
      {activeTab === 'location-data' && (
        <Box role="tabpanel" aria-label="Location data">
          <TimeOfDayLocationData result={result} />
        </Box>
      )}
      {activeTab === 'schedules' && (
        <Box role="tabpanel" aria-label="Schedules">
          <TimeOfDaySchedules result={result} />
        </Box>
      )}
    </Stack>
  )
}
