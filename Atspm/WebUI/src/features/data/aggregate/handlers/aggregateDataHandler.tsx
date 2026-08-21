import {
  LocationHandler,
  useLocationHandler,
} from '@/components/handlers/locationHandler'
import {
  RouteHandler,
  useRouteHandler,
} from '@/components/handlers/routeHandler'
import {
  Location,
  RouteLocationDto,
  useGetLocationFromKey,
  useGetRouteRouteViewFromId,
} from '@/api/config'
import { DateTimeProps, TimeOnlyProps } from '@/types/TimeProps'
import { dateToTimestamp } from '@/utils/dateTime'
import { startOfToday, startOfTomorrow } from 'date-fns'
import { useEffect, useState } from 'react'
import { usePostAggregateData } from '../../api/getAggregateData'
import {
  AggregateApiData,
  AggregateFilterDirection,
  AggregateFilterMovement,
  AggregateTimeOptions,
} from '../types/aggregateApiData'
import { AggregateData } from '../types/aggregateData'
import {
  AggregationType,
  MetricTypeOptionsList,
  YAxisOptions,
  binSizeMarks,
  chartTypeOptions,
  xAxisOptions,
} from '../types/aggregateOptionsData'
import {
  ExpandLocationHandler,
  useExpandLocationHandler,
} from './expandLocationHandler'

export interface AggregateOptionsHandler
  extends DateTimeProps,
    TimeOnlyProps,
    RouteHandler,
    LocationHandler,
    ExpandLocationHandler {
  aggregatedData: AggregateData[]
  selectedDays: number[]
  selectedDirections: number[]
  selectedMovements: number[]
  metricType: string
  binSize: number
  averageOrSum: number
  xAxisType: number
  yAxisType: number
  detectionType: string
  visualChartType: string
  changeSelectedDays(days: number[]): void
  changeSelectedDirections(directions: number[]): void
  changeSelectedMovements(movements: number[]): void
  changeMetricType(metricType: string): void
  changeBinSize(binSize: number): void
  changeAverageOrSum(value: number): void
  changeXAxisType(value: number): void
  changeYAxisType(value: number): void
  changeDetectionType(value: string): void
  changeVisualChartType(value: 'line' | 'bar' | 'pie'): void
  handleRunAnalysis(): void
}

// selectedLocations mixes locations picked individually (from a single
// Location lookup) with locations pulled in from a selected route (from
// RouteLocationDto, which carries denormalized display fields the plain
// Location navigation properties don't). RouteLocationDto already has
// everything the UI needs from either source, so it's the shared shape;
// individually-picked locations are adapted into it here.
const toRouteLocationDto = (location: Location): RouteLocationDto => ({
  locationIdentifier: location.locationIdentifier,
  primaryName: location.primaryName,
  secondaryName: location.secondaryName,
  latitude: location.latitude,
  longitude: location.longitude,
  locationId: location.id,
  approaches: location.approaches as unknown as RouteLocationDto['approaches'],
})

export const useAggregateOptionsHandler = (): AggregateOptionsHandler => {
  const [startDateTime, setStartDateTime] = useState(startOfToday())
  const [endDateTime, setEndDateTime] = useState(startOfTomorrow())
  const [startTime, setStartTime] = useState(
    new Date(new Date().setHours(0, 0, 0, 0))
  )
  const [endTime, setEndTime] = useState(
    new Date(new Date().setHours(0, 0, 0, 0))
  )
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5])
  const [selectedDirections, setSelectedDirections] = useState<number[]>([
    0, 1, 2, 3, 4, 5, 6, 7,
  ])
  const [selectedMovements, setSelectedMovements] = useState<number[]>([
    0, 1, 2, 3, 4, 5, 6, 7,
  ])
  const [metricType, setMetricType] = useState<string>('')
  const [xAxisType, setXAxisType] = useState<number>(xAxisOptions[0].id)
  const [yAxisType, setYAxisType] = useState<number>(YAxisOptions[0].id)
  const [detectionType, setDetectionType] = useState<string>('')
  const [visualChartType, setVisualChartType] = useState<
    'line' | 'bar' | 'pie'
  >(chartTypeOptions[0].id)
  const [binSize, setBinSize] = useState<number>(binSizeMarks[0].value)
  const [locationId, setLocationId] = useState<number | undefined>(undefined)
  const [averageOrSum, setAverageOrSum] = useState<number>(0)
  const [selectedLocations, setSelectedLocations] = useState<
    RouteLocationDto[]
  >([])
  const [aggregatedData, setAggregatedData] = useState<AggregateData[]>([])
  const [routeExpandedLocations, setRouteExpandedLocations] = useState<
    RouteLocationDto[]
  >([])
  const { data: locationExpandedData, status } = useGetLocationFromKey(
    locationId ?? 0,
    {
      expand:
        'areas, devices, approaches($expand=Detectors($expand=DetectionTypes, detectorComments))',
    },
    { query: { enabled: locationId != null } }
  )
  const postMutation = usePostAggregateData()
  const routeHandler = useRouteHandler()
  const routeIdNumber = routeHandler.routeId
    ? Number(routeHandler.routeId)
    : undefined
  const {
    data: routeWithExpandedLocations,
    status: routeStatus,
  } = useGetRouteRouteViewFromId(
    routeIdNumber ?? 0,
    { includeLocationDetail: true },
    { query: { enabled: routeIdNumber != null } }
  )
  const locationHandler = useLocationHandler()
  const expandedLocationsHandler = useExpandLocationHandler({
    locations: selectedLocations,
    setSelectedLocations,
    changeLocation: locationHandler.changeLocation,
  })

  const locationIdentifiers = selectedLocations.map(
    (location) => location.locationIdentifier
  )

  const getAggregateTypeEnumValue = (enumString: string): number => {
    if (Object.values(AggregationType).includes(enumString)) {
      // Type assertion to tell TypeScript that enumString is a valid member of AggregationType
      return AggregationType[enumString as keyof typeof AggregationType]
    }
    return 0
  }

  const getDataTypeValue = (aggregateVal: string, dataVal: string): number => {
    let dataTypeIndex = 0
    MetricTypeOptionsList.forEach(
      (metricType) =>
        metricType.id === aggregateVal &&
        metricType.options.forEach((option, index) => {
          if (option.id === dataVal) {
            dataTypeIndex = index
          }
        })
    )
    return dataTypeIndex
  }

  const createTimeOptions = (): AggregateTimeOptions => {
    return {
      start: dateToTimestamp(startDateTime),
      end: dateToTimestamp(endDateTime),
      timeOfDayStartHour: startTime.getHours(),
      timeOfDayStartMinute: startTime.getMinutes(),
      timeOfDayEndHour: endTime.getHours(),
      timeOfDayEndMinute: endTime.getMinutes(),
      daysOfWeek: selectedDays,
      timeOption: 0,
      selectedBinSize: binSize,
    }
  }

  const createFilterDirections = (): AggregateFilterDirection[] => {
    return selectedDirections.map((directionId) => {
      return {
        directionTypeId: directionId,
        description: 'string',
        include: true,
      }
    })
  }

  const createFilterMovements = (): AggregateFilterMovement[] => {
    return selectedMovements.map((movementId) => {
      return {
        movementTypeId: movementId,
        description: 'string',
        include: true,
      }
    })
  }

  const createAggregateObject = (): AggregateApiData => {
    const locationIdentifiers = selectedLocations.map(
      (location) => location.locationIdentifier ?? ''
    )
    const metric = metricType.split('-')
    const aggregationType = getAggregateTypeEnumValue(metric[0])
    const dataType = getDataTypeValue(metric[0], metric[1])

    const timeOptions = createTimeOptions()
    const filterDirections = createFilterDirections()
    const filterMovements = createFilterMovements()

    return {
      locationIdentifiers,
      start: dateToTimestamp(startDateTime),
      end: dateToTimestamp(endDateTime),
      aggregationType,
      dataType,
      timeOptions,
      selectedAggregationType: averageOrSum,
      selectedXAxisType: xAxisType,
      selectedSeries: yAxisType,
      locations: expandedLocationsHandler.updatedLocations,
      filterDirections,
      filterMovements,
    }
  }

  const handleSubmit = async () => {
    const aggregateObject: AggregateApiData = createAggregateObject()
    const result: AggregateData[] = (await postMutation.mutateAsync(
      aggregateObject
    )) as unknown as AggregateData[]
    setAggregatedData(result)
  }

  useEffect(() => {
    if (routeHandler.routeId) {
      setSelectedLocations([])
      setRouteExpandedLocations([])
    }
  }, [routeHandler.routeId])

  useEffect(() => {
    if (routeExpandedLocations && routeExpandedLocations.length > 0) {
      const filteredExpandedLocations = routeExpandedLocations.filter(
        (location) =>
          !locationIdentifiers.includes(location.locationIdentifier)
      )
      if (filteredExpandedLocations.length > 0) {
        setSelectedLocations((prev) => [...prev, ...filteredExpandedLocations])
      }
      setRouteExpandedLocations([])
    }
  }, [locationIdentifiers, routeExpandedLocations])

  useEffect(() => {
    if (routeStatus === 'success' && routeWithExpandedLocations) {
      setRouteExpandedLocations(routeWithExpandedLocations.routeLocations ?? [])
    }
  }, [routeStatus, routeWithExpandedLocations])

  useEffect(() => {
    if (locationHandler.location) {
      setLocationId(locationHandler.location.id)
    } else if (locationHandler.location === null) {
      setLocationId(undefined)
    }
  }, [locationHandler.location])

  useEffect(() => {
    if (status === 'success' && locationExpandedData) {
      const asRouteLocation = toRouteLocationDto(locationExpandedData)
      setSelectedLocations((prevArr) =>
        prevArr.some(
          (location) =>
            location.locationIdentifier === asRouteLocation.locationIdentifier
        )
          ? prevArr
          : [...prevArr, asRouteLocation]
      )
    }
  }, [locationExpandedData, status])

  const component: AggregateOptionsHandler = {
    ...expandedLocationsHandler,
    ...locationHandler,
    ...routeHandler,
    aggregatedData: aggregatedData as AggregateData[],
    startDateTime,
    endDateTime,
    startTime,
    endTime,
    selectedDays,
    selectedDirections,
    selectedMovements,
    metricType,
    binSize,
    averageOrSum,
    xAxisType,
    yAxisType,
    detectionType,
    visualChartType,
    handleRunAnalysis: () => {
      handleSubmit()
    },
    changeSelectedDays(days) {
      setSelectedDays(days)
    },
    changeSelectedDirections(directions) {
      setSelectedDirections(directions)
    },
    changeSelectedMovements(movements) {
      setSelectedMovements(movements)
    },
    changeStartDate: (date) => {
      setStartDateTime(date)
    },
    changeEndDate: (date) => {
      setEndDateTime(date)
    },
    changeStartTime: (date) => {
      setStartTime(date)
    },
    changeEndTime: (date) => {
      setEndTime(date)
    },
    changeMetricType(metricType) {
      setMetricType(metricType)
    },
    changeBinSize(binSize) {
      setBinSize(binSize)
    },
    changeXAxisType(value) {
      setXAxisType(value)
    },
    changeYAxisType(value) {
      setYAxisType(value)
    },
    changeDetectionType(value) {
      setDetectionType(value)
    },
    changeVisualChartType(value) {
      setVisualChartType(value)
    },
    changeAverageOrSum(value) {
      setAverageOrSum(value)
    },
  }

  return component
}
