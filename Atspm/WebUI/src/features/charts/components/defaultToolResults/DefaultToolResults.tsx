import { TransformedToolResponse } from '@/features/charts/types'
import { Box, Button, Paper, useTheme } from '@mui/material'
import { useState } from 'react'
import TimeSpaceEChart from '../timeSpaceEChart/TimeSpaceEChart'

export interface DefaultToolResultsProps {
  chartData: TransformedToolResponse
  refs: React.RefObject<HTMLDivElement>[]
}

export default function TimeSpaceToolResults({
  chartData,
  refs,
}: DefaultToolResultsProps) {
  const theme = useTheme()

  const [resetKey, setResetKey] = useState(0)

  return (
    <>
      {chartData.data.charts.map((chartWrapper, index) => (
        <>
          <Button onClick={() => setResetKey((k) => k + 1)}>
            Reset Charts
          </Button>
          <Box
            key={index}
            ref={refs[index]}
            sx={{
              overflow: 'hidden',
              minWidth: '600px',
            }}
          >
            <Paper
              sx={{
                p: 4,
                my: 3,
                width: '99%',
                marginLeft: '2px',
                backgroundColor: 'white',
              }}
            >
              <TimeSpaceEChart
                id={`chart-${index}`}
                option={chartWrapper.chart}
                theme={theme.palette.mode}
                style={{
                  width: '100%',
                  height:
                    chartWrapper.chart.displayProps.numberOfLocations < 5
                      ? chartWrapper.chart.displayProps.numberOfLocations *
                          150 +
                        160 +
                        'px'
                      : chartWrapper.chart.displayProps.numberOfLocations * 70 +
                        160 +
                        'px',
                  position: 'relative',
                }}
                resetKey={resetKey}
              />
            </Paper>
          </Box>
        </>
      ))}
    </>
  )
}
