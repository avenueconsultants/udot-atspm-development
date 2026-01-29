import TimeSpaceEChart from '@/features/charts/timeSpaceDiagram/shared/components/TimeSpaceEChart'
import { TransformedToolResponse } from '@/features/charts/types'
import { Box, Paper, useTheme } from '@mui/material'
import { useState } from 'react'
import { GpxUploadAccordion } from '../../timeSpaceDiagram/shared/components/GpxUploader/GpxUploadAccordion'
import { GpxUploadOptions } from '../../timeSpaceDiagram/shared/types'

export interface TimeSpaceChartProps {
  chartData: TransformedToolResponse
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

export default function TimeSpaceChart({ chartData }: TimeSpaceChartProps) {
  const theme = useTheme()
  const chart = chartData.data.charts[0]
  const locations = chart.chart.displayProps.locations

  const [gpxEntries, setGpxEntries] = useState<GpxUploadOptions[]>([
    createEmptyEntry(locations),
  ])
  return (
    <Box
      sx={{
        overflow: 'hidden',
        width: '100%',
        position: 'absolute',
        left: 0,
      }}
    >
      <Paper
        sx={{
          p: 0,
          mt: 3,
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
              width: '20%', // 👈 20–30% sweet spot
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
              option={chart.chart}
              theme={theme.palette.mode}
              style={{
                width: '100%',
                height:
                  chart.chart.displayProps.numberOfLocations < 5
                    ? chart.chart.displayProps.numberOfLocations * 150 +
                      160 +
                      'px'
                    : chart.chart.displayProps.numberOfLocations * 70 +
                      160 +
                      'px',
                position: 'relative',
              }}
              gpxEntries={gpxEntries}
            />
          </Box>
        </Box>
      </Paper>
    </Box>
  )
}
