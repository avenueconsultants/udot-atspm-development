import {
  useGetDeviceActiveDevicesCount,
  useGetLocationDetectionTypeCount,
} from '@/api/config'
import { useGetWatchDogDashboardDashboardGroup } from '@/api/reports'
import { StyledPaper } from '@/components/StyledPaper'
import WatchdogChartsContainer from '@/features/charts/watchdogDashboard/components/WatchdogChartsContainer'
import { toUTCDateStamp } from '@/utils/dateTime'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import { LoadingButton } from '@mui/lab'
import { Box } from '@mui/material'
import { startOfToday, startOfTomorrow, subDays, subYears } from 'date-fns'
import { useState } from 'react'
import HorizontalDateInput from './HorizontalDateInputs'

const WatchdogSummaryReport = () => {
  const [startDateTime, setStartDateTime] = useState(
    subYears(startOfToday(), 1)
  )
  const [endDateTime, setEndDateTime] = useState(subDays(startOfTomorrow(), 1))

  const {
    mutate: fetchDashboardData,
    data: dashboardData,
    isLoading,
    error,
  } = useGetWatchDogDashboardDashboardGroup()

  const { data: deviceCount } = useGetDeviceActiveDevicesCount()
  const { data: detectionTypeCount } = useGetLocationDetectionTypeCount({
    date: toUTCDateStamp(endDateTime),
  })
  const data = {
    ...dashboardData,
    deviceCount,
    detectionTypeCount,
  }

  const handleGenerateSummary = () => {
    fetchDashboardData({
      data: {
        start: toUTCDateStamp(startDateTime),
        end: toUTCDateStamp(endDateTime),
      },
    })
  }

  const handleStartDateTimeChange = (date: Date) => {
    setStartDateTime(date)
  }

  const handleEndDateTimeChange = (date: Date) => {
    setEndDateTime(date)
  }

  return (
    <>
      <StyledPaper
        sx={{
          flexGrow: 1,
          maxWidth: '30rem',
          padding: 2,
        }}
      >
        <HorizontalDateInput
          startDateTime={startDateTime}
          endDateTime={endDateTime}
          changeStartDate={handleStartDateTimeChange}
          changeEndDate={handleEndDateTimeChange}
        />
      </StyledPaper>
      <LoadingButton
        loading={isLoading}
        sx={{ mt: 2, padding: '10px', mb: 2 }}
        loadingPosition="start"
        startIcon={<PlayArrowIcon />}
        variant="contained"
        onClick={handleGenerateSummary}
      >
        Generate Summary
      </LoadingButton>

      {error && <Box>Error loading data</Box>}

      {!isLoading && dashboardData && deviceCount && detectionTypeCount && (
        <WatchdogChartsContainer data={data} isLoading={isLoading} />
      )}
    </>
  )
}

export default WatchdogSummaryReport
