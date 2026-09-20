import {
  type DetectionTypeGroup,
  type DeviceGroup,
  useGetDeviceActiveDevicesCount,
  useGetLocationDetectionTypeCount,
} from '@/api/config'
import { useGetWatchDogDashboardDashboardGroup } from '@/api/reports'
import { StyledPaper } from '@/components/StyledPaper'
import WatchdogChartsContainer from '@/features/charts/watchdogDashboard/components/WatchdogChartsContainer'
import { getApiErrorMessage } from '@/lib/apiError'
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
    isPending: isDashboardPending,
    error,
  } = useGetWatchDogDashboardDashboardGroup()

  const {
    data: deviceCount,
    error: deviceCountError,
    isFetching: isDeviceCountFetching,
    refetch: refetchDeviceCount,
  } = useGetDeviceActiveDevicesCount<DeviceGroup[], unknown>(undefined, {
    query: { throwOnError: false },
  })
  const {
    data: detectionTypeCount,
    error: detectionTypeCountError,
    isFetching: isDetectionTypeCountFetching,
    refetch: refetchDetectionTypeCount,
  } = useGetLocationDetectionTypeCount<DetectionTypeGroup[], unknown>(
    { date: toUTCDateStamp(endDateTime) },
    { query: { throwOnError: false } }
  )
  const isLoading =
    isDashboardPending || isDeviceCountFetching || isDetectionTypeCountFetching
  const requestError = error ?? deviceCountError ?? detectionTypeCountError
  const data = {
    ...dashboardData,
    deviceCount,
    detectionTypeCount,
  }

  const handleGenerateSummary = () => {
    if (deviceCountError) void refetchDeviceCount()
    if (detectionTypeCountError) void refetchDetectionTypeCount()
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

      {requestError && (
        <Box role="alert">
          Error loading data: {getApiErrorMessage(requestError)}
        </Box>
      )}

      {!isLoading && dashboardData && deviceCount && detectionTypeCount && (
        <WatchdogChartsContainer data={data} isLoading={isLoading} />
      )}
    </>
  )
}

export default WatchdogSummaryReport
