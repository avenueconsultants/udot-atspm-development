import TimeSpaceEChart from '@/features/charts/timeSpaceDiagram/shared/components/TimeSpaceEChart'
import { TransformedToolResponse } from '@/features/charts/types'
import { Box, Paper, useTheme } from '@mui/material'

export interface TimeSpaceChartProps {
  chartData: TransformedToolResponse
}

export default function TimeSpaceChart({ chartData }: TimeSpaceChartProps) {
  const theme = useTheme()

  const chart = chartData.data.charts[0]

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
          p: 4,
          mt: 3,
          marginLeft: '2px',
          backgroundColor: 'white',
        }}
      >
        <TimeSpaceEChart
          id={`time-space-chart`}
          option={chart.chart}
          theme={theme.palette.mode}
          style={{
            width: '100%',
            height:
              chart.chart.displayProps.numberOfLocations < 5
                ? chart.chart.displayProps.numberOfLocations * 150 + 160 + 'px'
                : chart.chart.displayProps.numberOfLocations * 70 + 160 + 'px',
            position: 'relative',
          }}
        />
      </Paper>
    </Box>
  )
}
