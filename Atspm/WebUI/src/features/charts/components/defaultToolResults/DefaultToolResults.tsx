import TimeSpaceEChart from '@/features/charts/timeSpaceDiagram/shared/components/TimeSpaceEChart'
import LinkPivotAdjustmentTable from '@/features/tools/link-pivot/components/LinkPivotAdjustmentTable'
import { LinkPivotApproachLinkComponent } from '@/features/tools/link-pivot/components/LinkPivotApproachLinkComponent'
import { RawLinkPivotForTsdData } from '@/features/tools/link-pivot/types'
import {
  Alert,
  Box,
  Paper,
  Tab,
  Tabs,
  Typography,
  useTheme,
} from '@mui/material'
import { useEffect, useState } from 'react'
import { transformTimeSpaceData } from '../../api'
import { GpxUploadAccordion } from '../../timeSpaceDiagram/shared/components/GpxUploader/GpxUploadAccordion'
import { IgnoreLocationsAccordion } from '../../timeSpaceDiagram/shared/components/IgnoredLocations/IgnoredLocations'
import {
  GpxUploadOptions,
  RawTimeSpaceDiagramResponse,
  TimeSpaceBaseData,
} from '../../timeSpaceDiagram/shared/types'

export interface TimeSpaceChartProps {
  timeSpaceData: RawTimeSpaceDiagramResponse
  linkPivotTsdData: RawLinkPivotForTsdData[]
}

function createEmptyEntry(
  locations: string[],
  primary = false
): GpxUploadOptions {
  return {
    id: '',
    startLocation: locations[0],
    endLocation: locations[locations.length - 1],
    error: null,
    primary,
  }
}

function recomputeTimeSpaceData<T extends TimeSpaceBaseData>(
  baseData: T[],
  ignoredLocations: string[]
): T[] {
  const isIgnored = (id: string) => ignoredLocations.includes(id)

  const recomputeLane = (lane: T[]): T[] => {
    // If nothing ignored, just return non-ignored nodes unchanged
    if (!lane.some((l) => isIgnored(l.locationIdentifier))) {
      return lane
    }

    const recomputed: T[] = []

    for (let i = 0; i < lane.length; i++) {
      const current = lane[i]

      if (isIgnored(current.locationIdentifier)) {
        recomputed.push({
          start: current.start,
          end: current.end,
          locationIdentifier: current.locationIdentifier,
          locationDescription: current.locationDescription,
          phaseType: current.phaseType,
          distanceToNextLocation: current.distanceToNextLocation,
          distanceToPreviousLocation: current.distanceToPreviousLocation,
          phaseNumber: current.phaseNumber,
          phaseNumberSort: current.phaseNumberSort,
          speed: current.speed,
          approachId: current.approachId,
          approachDescription: current.approachDescription,
          calculatedDistanceToNext: 0,
          calculatedDistanceToPrevious: 0,
        } as T)

        continue
      }

      // ---- distance to previous non-ignored ----
      let distanceToPrevious = 0
      for (let j = i - 1; j >= 0; j--) {
        distanceToPrevious += lane[j].distanceToNextLocation
        if (!isIgnored(lane[j].locationIdentifier)) {
          break
        }
      }

      // ---- distance to next non-ignored ----
      let distanceToNext = 0
      for (let j = i; j < lane.length - 1; j++) {
        distanceToNext += lane[j].distanceToNextLocation
        if (!isIgnored(lane[j + 1].locationIdentifier)) {
          break
        }
      }

      recomputed.push({
        ...current,
        calculatedDistanceToPrevious: distanceToPrevious,
        calculatedDistanceToNext: distanceToNext,
      })
    }

    return recomputed
  }

  const primaryLane = baseData.filter((p) => p.phaseType === 'Primary')
  const opposingLane = baseData.filter((p) => p.phaseType === 'Opposing')

  return [...recomputeLane(primaryLane), ...recomputeLane(opposingLane)]
}

// Helper function to unwrap, recompute, and re-wrap data
function recomputeWrappedTimeSpaceData(
  wrappedData: any[],
  ignoredLocations: string[]
): any[] {
  // Extract successful results
  const unwrappedData = wrappedData
    .filter((item) => item.isSuccess && item.result)
    .map((item) => item.result)

  // Recompute with ignored locations
  const recomputed = recomputeTimeSpaceData(unwrappedData, ignoredLocations)

  // Re-wrap the recomputed data
  return recomputed.map((result) => ({
    error: null,
    result: result,
    isSuccess: true,
  }))
}

function addDefaultValues(
  timeSpaceData: RawTimeSpaceDiagramResponse
): RawTimeSpaceDiagramResponse {
  const wrappedData = timeSpaceData.data

  // Process each wrapped result
  const processedData = wrappedData.map((wrappedItem) => {
    // If this is an error result, return it unchanged
    if (!wrappedItem.isSuccess || !wrappedItem.result) {
      return wrappedItem
    }

    // For successful results, add calculated distance values
    const lane = wrappedItem.result
    return {
      ...wrappedItem,
      result: {
        ...lane,
        calculatedDistanceToNext: lane.distanceToNextLocation,
        calculatedDistanceToPrevious: lane.distanceToPreviousLocation,
      },
    }
  })

  return {
    type: timeSpaceData.type,
    data: processedData as any,
  }
}

export default function TimeSpaceChart({
  timeSpaceData,
  linkPivotTsdData,
}: TimeSpaceChartProps) {
  const theme = useTheme()
  const [activeTab, setActiveTab] = useState(0)
  const [transformErrors, setTransformErrors] = useState<string[]>([])

  const [baseTimeSpaceData, setBaseTimeSpaceData] =
    useState<RawTimeSpaceDiagramResponse>(addDefaultValues(timeSpaceData))

  const [transformedData, setTransformedData] = useState(() => {
    try {
      const result = transformTimeSpaceData(timeSpaceData)
      // Check if transformation returned errors
      if ('errors' in result && result.errors) {
        setTransformErrors(result.errors)
      }
      return result
    } catch (error) {
      console.error('Error transforming time space data:', error)
      setTransformErrors([
        error instanceof Error ? error.message : 'Unknown transformation error',
      ])
      // Return empty chart on error
      return {
        type: timeSpaceData.type,
        data: { chart: {} },
      }
    }
  })

  const locations = timeSpaceData.data
    .filter((p) => p.isSuccess && p.result && p.result.phaseType === 'Primary')
    .map((p) => p.result!.locationIdentifier)

  const [gpxEntries, setGpxEntries] = useState<GpxUploadOptions[]>([
    createEmptyEntry(locations),
  ])
  const [ignoredLocations, setIgnoredLocation] = useState<string[]>([])

  useEffect(() => {
    const recalculatedData =
      ignoredLocations.length > 0
        ? recomputeWrappedTimeSpaceData(
            baseTimeSpaceData.data,
            ignoredLocations
          )
        : baseTimeSpaceData.data

    const updatedResponse: RawTimeSpaceDiagramResponse = {
      type: baseTimeSpaceData.type,
      data: recalculatedData,
    }

    try {
      const result = transformTimeSpaceData(updatedResponse)
      setTransformedData(result)
      // Check if transformation returned errors
      if ('errors' in result && result.errors) {
        setTransformErrors(result.errors)
      } else {
        setTransformErrors([])
      }
    } catch (error) {
      console.error('Error transforming time space data:', error)
      setTransformErrors([
        error instanceof Error ? error.message : 'Unknown transformation error',
      ])
      setTransformedData({
        type: baseTimeSpaceData.type,
        data: { chart: {} },
      })
    }
  }, [ignoredLocations, baseTimeSpaceData])

  return (
    <Box
      sx={{
        overflow: 'hidden',
        width: '100%',
        position: 'absolute',
        left: 0,
      }}
    >
      {/* Display errors if any */}
      {transformErrors.length > 0 && (
        <Box sx={{ mt: 2, mx: 2 }}>
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>
              Some phases failed to process:
            </Typography>
            <Box component="ul" sx={{ m: 0, pl: 2 }}>
              {transformErrors.map((error, index) => (
                <li key={index}>
                  <Typography variant="body2">{error}</Typography>
                </li>
              ))}
            </Box>
          </Alert>
        </Box>
      )}

      {/* 🔹 Tabs Outside Paper */}
      <Tabs
        value={activeTab}
        onChange={(_, newValue) => setActiveTab(newValue)}
        sx={{ mt: 2 }}
      >
        <Tab label="Time Space Chart" />
        <Tab label="Link Pivot" />
      </Tabs>

      {/* 🔹 Default Tab — Existing Paper Layout */}
      {activeTab === 0 && (
        <Paper
          sx={{
            p: 0,
            mt: 2,
            marginLeft: '2px',
            backgroundColor: 'white',
          }}
        >
          <Box
            sx={{
              display: 'flex',
              width: '100%',
              minHeight: '100%',
            }}
          >
            {/* LEFT SIDE — GPX OPTIONS */}
            <Box
              sx={{
                width: '20%',
                minWidth: 260,
                borderRight: '1px solid',
                borderColor: 'divider',
                p: 2,
              }}
            >
              <GpxUploadAccordion
                locations={locations}
                entries={gpxEntries}
                setEntries={setGpxEntries}
              />
              <IgnoreLocationsAccordion
                locations={locations}
                ignoredLocations={ignoredLocations}
                setIgnoredLocations={setIgnoredLocation}
              />
            </Box>

            {/* RIGHT SIDE — CHART */}
            <Box
              sx={{
                width: '80%',
                p: 2,
              }}
            >
              <TimeSpaceEChart
                id="time-space-chart"
                option={transformedData.data.chart}
                theme={theme.palette.mode}
                style={{
                  width: '100%',
                  height:
                    locations.length < 5
                      ? locations.length * 200 + 160 + 'px'
                      : locations.length * 150 + 160 + 'px',
                  position: 'relative',
                }}
                gpxEntries={gpxEntries}
                ignoredLocations={ignoredLocations}
              />
            </Box>
          </Box>
        </Paper>
      )}

      {/* 🔹 Second Tab — LinkPivot (Outside Paper) */}
      {activeTab === 1 && (
        <Box>
          {linkPivotTsdData.map((pivot) => (
            <Box key={pivot.direction} sx={{ mb: 6 }}>
              <Typography variant="h4" fontWeight="bold" sx={{ my: 3 }}>
                {pivot.direction} Direction
              </Typography>

              {/* Adjustments */}
              <Typography variant="h5" fontWeight="bold" sx={{ mb: 2 }}>
                Adjustments
              </Typography>
              <Paper sx={{ mb: 3 }}>
                <LinkPivotAdjustmentTable
                  data={pivot.data.adjustments}
                  cycleLength={
                    baseTimeSpaceData.data.find((d) => d.isSuccess && d.result)
                      ?.result?.cycleLength || 0
                  }
                />
              </Paper>

              {/* Approach Link Comparison */}
              <Typography variant="h5" fontWeight="bold" sx={{ mb: 2 }}>
                Approach Link Comparison
              </Typography>
              <Paper>
                <LinkPivotApproachLinkComponent
                  data={pivot.data.approachLinks}
                  corridorSummary={pivot.data}
                  lpHandler={null}
                />
              </Paper>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  )
}
