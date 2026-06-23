import { ResponsivePageLayout } from '@/components/ResponsivePage'
import TimeOfDayOptions from '@/features/timeOfDay/components/TimeOfDayOptions'
import TimeOfDayResults from '@/features/timeOfDay/components/TimeOfDayResults'
import { useTimeOfDayReport } from '@/features/timeOfDay/api/getTimeOfDay'
import type {
  TimeOfDayFormState,
  TimeOfDayOptions as TimeOfDayRequestOptions,
} from '@/features/timeOfDay/types'
import { defaultPrimaryDirections } from '@/features/timeOfDay/types'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import { LoadingButton } from '@mui/lab'
import { Alert, Box, Stack } from '@mui/material'
import { AxiosError } from 'axios'
import { format, startOfYesterday, subDays } from 'date-fns'
import { useState } from 'react'

type PageError =
  | { type: 'NONE' }
  | { type: 'VALIDATION'; message: string }
  | { type: 'API'; message: string }

const getDefaultFormState = (): TimeOfDayFormState => ({
  selectedLocations: [],
  selectedDates: [subDays(startOfYesterday(), 1), startOfYesterday()],
  dataSource: 'IndianaEvents',
  allDayPrimaryDirections: defaultPrimaryDirections,
  amPrimaryDirections: defaultPrimaryDirections,
  pmPrimaryDirections: defaultPrimaryDirections,
  binSizeMinutes: 15,
  laneCapacityVehiclesPerHour: 800,
  directionLaneCounts: {},
})

const getErrorMessage = (error: unknown) => {
  if (error instanceof AxiosError) {
    const responseData = error.response?.data

    if (typeof responseData === 'string') return responseData
    if (responseData?.detail && typeof responseData.detail === 'string') {
      return responseData.detail
    }
    if (responseData?.title && typeof responseData.title === 'string') {
      return responseData.title
    }
  }

  if (error instanceof Error) return error.message

  return 'Unable to generate Time Of Day analysis.'
}

export default function TimeOfDayPage() {
  const [formState, setFormState] = useState<TimeOfDayFormState>(
    getDefaultFormState
  )
  const [pageError, setPageError] = useState<PageError>({ type: 'NONE' })
  const {
    data: result,
    mutateAsync: generateTimeOfDay,
    isLoading,
  } = useTimeOfDayReport()

  const buildRequestOptions = (): TimeOfDayRequestOptions | null => {
    const locationIdentifiers = formState.selectedLocations
      .map((location) => location.locationIdentifier)
      .filter((identifier): identifier is string => Boolean(identifier))

    if (locationIdentifiers.length === 0) {
      setPageError({
        type: 'VALIDATION',
        message: 'Please select one or more locations.',
      })
      return null
    }

    if (formState.selectedDates.length === 0) {
      setPageError({
        type: 'VALIDATION',
        message: 'Please select one or more dates.',
      })
      return null
    }

    const selectedDates = Array.from(
      new Set(formState.selectedDates.map((date) => format(date, 'yyyy-MM-dd')))
    ).sort()

    return {
      locationIdentifiers,
      selectedDates,
      dataSource: formState.dataSource,
      allDayPrimaryDirections: formState.allDayPrimaryDirections,
      amPrimaryDirections: formState.amPrimaryDirections,
      pmPrimaryDirections: formState.pmPrimaryDirections,
      binSizeMinutes: 15,
      laneCapacityVehiclesPerHour: formState.laneCapacityVehiclesPerHour,
      directionLaneCounts: formState.directionLaneCounts,
    }
  }

  const handleGenerateAnalysis = async () => {
    const requestOptions = buildRequestOptions()
    if (!requestOptions) return

    setPageError({ type: 'NONE' })

    try {
      await generateTimeOfDay(requestOptions)
    } catch (error) {
      setPageError({ type: 'API', message: getErrorMessage(error) })
    }
  }

  return (
    <ResponsivePageLayout title="Time Of Day" useFullWidth>
      <Stack spacing={2}>
        <TimeOfDayOptions options={formState} onChange={setFormState} />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <LoadingButton
            loading={isLoading}
            loadingPosition="start"
            startIcon={<PlayArrowIcon />}
            variant="contained"
            sx={{ padding: '10px' }}
            onClick={handleGenerateAnalysis}
          >
            Generate Analysis
          </LoadingButton>
          {pageError.type !== 'NONE' && (
            <Alert severity="error">{pageError.message}</Alert>
          )}
        </Box>
      </Stack>
      {result && <TimeOfDayResults result={result} />}
    </ResponsivePageLayout>
  )
}
