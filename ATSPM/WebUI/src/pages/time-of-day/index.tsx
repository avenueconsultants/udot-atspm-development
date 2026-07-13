import { ResponsivePageLayout } from '@/components/ResponsivePage'
import { useTimeOfDayReport } from '@/features/timeOfDay/api/getTimeOfDay'
import TimeOfDayOptions from '@/features/timeOfDay/components/TimeOfDayOptions'
import {
  areDateArraysEqual,
  areLaneCountsEqual,
  areStringArraysEqual,
  dataSourceParser,
  createSearchLocationsFromIdentifiers,
  laneCountsParser,
  normalizeDates,
  normalizeDirections,
  normalizeLaneCounts,
  normalizeLocationIdentifiers,
  resolveSearchLocationsByIdentifier,
  ymdDateParser,
} from '@/features/timeOfDay/queryParams'
import TimeOfDayResults from '@/features/timeOfDay/components/TimeOfDayResults'
import type {
  TimeOfDayFormState,
  TimeOfDayOptions as TimeOfDayRequestOptions,
} from '@/features/timeOfDay/types'
import { defaultPrimaryDirections } from '@/features/timeOfDay/types'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import { LoadingButton } from '@mui/lab'
import { Alert, Box, Stack } from '@mui/material'
import { AxiosError } from 'axios'
import { format, parseISO, startOfYesterday, subDays } from 'date-fns'
import {
  parseAsArrayOf,
  parseAsInteger,
  parseAsString,
  useQueryStates,
} from 'nuqs'
import { useEffect, useMemo, useState } from 'react'

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
  const defaultFormState = useMemo(() => getDefaultFormState(), [])
  const [qs, setQs] = useQueryStates(
    {
      locations: parseAsArrayOf(parseAsString, ',').withDefault([]),
      dates: parseAsArrayOf(ymdDateParser, ',').withDefault(
        defaultFormState.selectedDates
      ),
      dataSource: dataSourceParser.withDefault(defaultFormState.dataSource),
      primaryDirections: parseAsArrayOf(parseAsString, ',').withDefault(
        defaultFormState.allDayPrimaryDirections
      ),
      amPrimaryDirections: parseAsArrayOf(parseAsString, ',').withDefault(
        defaultFormState.amPrimaryDirections
      ),
      pmPrimaryDirections: parseAsArrayOf(parseAsString, ',').withDefault(
        defaultFormState.pmPrimaryDirections
      ),
      laneCapacity: parseAsInteger.withDefault(
        defaultFormState.laneCapacityVehiclesPerHour
      ),
      laneCounts: laneCountsParser.withDefault(
        defaultFormState.directionLaneCounts
      ),
    },
    { history: 'replace' }
  )
  const [formState, setFormState] =
    useState<TimeOfDayFormState>(defaultFormState)
  const [pageError, setPageError] = useState<PageError>({ type: 'NONE' })
  const {
    data: result,
    mutateAsync: generateTimeOfDay,
    isLoading,
  } = useTimeOfDayReport()

  const qsLocationsKey = qs.locations.join(',')

  useEffect(() => {
    const selectedDates = normalizeDates(
      qs.dates,
      defaultFormState.selectedDates
    )
    const allDayPrimaryDirections = normalizeDirections(
      qs.primaryDirections,
      defaultFormState.allDayPrimaryDirections
    )
    const amPrimaryDirections = normalizeDirections(
      qs.amPrimaryDirections,
      allDayPrimaryDirections
    )
    const pmPrimaryDirections = normalizeDirections(
      qs.pmPrimaryDirections,
      allDayPrimaryDirections
    )
    const laneCapacityVehiclesPerHour =
      Number.isFinite(qs.laneCapacity) && qs.laneCapacity > 0
        ? qs.laneCapacity
        : defaultFormState.laneCapacityVehiclesPerHour
    const directionLaneCounts = normalizeLaneCounts(qs.laneCounts)

    setFormState((currentFormState) => {
      if (
        areDateArraysEqual(currentFormState.selectedDates, selectedDates) &&
        currentFormState.dataSource === qs.dataSource &&
        areStringArraysEqual(
          currentFormState.allDayPrimaryDirections,
          allDayPrimaryDirections
        ) &&
        areStringArraysEqual(
          currentFormState.amPrimaryDirections,
          amPrimaryDirections
        ) &&
        areStringArraysEqual(
          currentFormState.pmPrimaryDirections,
          pmPrimaryDirections
        ) &&
        currentFormState.laneCapacityVehiclesPerHour ===
          laneCapacityVehiclesPerHour &&
        areLaneCountsEqual(
          currentFormState.directionLaneCounts,
          directionLaneCounts
        )
      ) {
        return currentFormState
      }

      return {
        ...currentFormState,
        selectedDates,
        dataSource: qs.dataSource,
        allDayPrimaryDirections,
        amPrimaryDirections,
        pmPrimaryDirections,
        laneCapacityVehiclesPerHour,
        directionLaneCounts,
      }
    })
  }, [
    qs.dates,
    qs.dataSource,
    qs.primaryDirections,
    qs.amPrimaryDirections,
    qs.pmPrimaryDirections,
    qs.laneCapacity,
    qs.laneCounts,
    defaultFormState,
  ])

  useEffect(() => {
    const identifiers = normalizeLocationIdentifiers(qs.locations)
    let cancelled = false

    if (identifiers.length === 0) {
      setFormState((currentFormState) =>
        currentFormState.selectedLocations.length
          ? { ...currentFormState, selectedLocations: [] }
          : currentFormState
      )
      return
    }

    const fallbackLocations = createSearchLocationsFromIdentifiers(identifiers)

    setFormState((currentFormState) => {
      const currentLocationIdentifiers = normalizeLocationIdentifiers(
        currentFormState.selectedLocations
          .map((location) => location.locationIdentifier)
          .filter((identifier): identifier is string => Boolean(identifier))
      )

      if (areStringArraysEqual(currentLocationIdentifiers, identifiers)) {
        return currentFormState
      }

      return {
        ...currentFormState,
        selectedLocations: fallbackLocations,
      }
    })

    void (async () => {
      try {
        const locations = await resolveSearchLocationsByIdentifier(identifiers)

        if (cancelled) return

        setFormState((currentFormState) => {
          const currentLocationIdentifiers = normalizeLocationIdentifiers(
            currentFormState.selectedLocations
              .map((location) => location.locationIdentifier)
              .filter((identifier): identifier is string =>
                Boolean(identifier)
              )
          )

          if (!areStringArraysEqual(currentLocationIdentifiers, identifiers)) {
            return currentFormState
          }

          return {
            ...currentFormState,
            selectedLocations: locations,
          }
        })
      } catch {
        return
      }
    })()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qsLocationsKey])

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
      binSizeMinutes: formState.binSizeMinutes,
      laneCapacityVehiclesPerHour: formState.laneCapacityVehiclesPerHour,
      directionLaneCounts: formState.directionLaneCounts,
    }
  }

  const handleGenerateAnalysis = async () => {
    const requestOptions = buildRequestOptions()
    if (!requestOptions) return

    setPageError({ type: 'NONE' })

    try {
      await setQs({
        locations: requestOptions.locationIdentifiers,
        dates: requestOptions.selectedDates.map((date) => parseISO(date)),
        dataSource: requestOptions.dataSource,
        primaryDirections: requestOptions.allDayPrimaryDirections,
        amPrimaryDirections: requestOptions.amPrimaryDirections,
        pmPrimaryDirections: requestOptions.pmPrimaryDirections,
        laneCapacity:
          requestOptions.laneCapacityVehiclesPerHour ??
          defaultFormState.laneCapacityVehiclesPerHour,
        laneCounts: requestOptions.directionLaneCounts ?? {},
      })
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
