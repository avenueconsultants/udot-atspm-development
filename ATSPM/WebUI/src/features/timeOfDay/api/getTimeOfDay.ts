import {
  getTimeOfDayReportData,
  TimeOfDayDataSource as ApiTimeOfDayDataSource,
} from '@/api/reports'
import type {
  ProblemDetails,
  TimeOfDayOptions as ApiTimeOfDayOptions,
  TimeOfDayResult,
} from '@/api/reports'
import { useMutation, UseMutationOptions } from 'react-query'
import type { TimeOfDayOptions } from '../types'

const apiDataSourceByName: Record<
  TimeOfDayOptions['dataSource'],
  ApiTimeOfDayOptions['dataSource']
> = {
  IndianaEvents: ApiTimeOfDayDataSource.NUMBER_0,
  Aggregated: ApiTimeOfDayDataSource.NUMBER_1,
}

export const toApiTimeOfDayOptions = (
  options: TimeOfDayOptions
): ApiTimeOfDayOptions => {
  const directionLaneCounts = Object.fromEntries(
    Object.entries(options.directionLaneCounts ?? {}).filter(
      ([, count]) => Number.isFinite(count) && count > 0
    )
  )

  return {
    locationIdentifiers: options.locationIdentifiers,
    selectedDates: options.selectedDates,
    binSizeMinutes: options.binSizeMinutes,
    dataSource: apiDataSourceByName[options.dataSource],
    allDayPrimaryDirections: options.allDayPrimaryDirections,
    amPrimaryDirections: options.amPrimaryDirections,
    pmPrimaryDirections: options.pmPrimaryDirections,
    laneCapacityVehiclesPerHour: options.laneCapacityVehiclesPerHour,
    directionLaneCounts: Object.keys(directionLaneCounts).length
      ? directionLaneCounts
      : undefined,
  }
}

export const getTimeOfDay = (options: TimeOfDayOptions) =>
  getTimeOfDayReportData(toApiTimeOfDayOptions(options))

export const useTimeOfDayReport = (
  options?: UseMutationOptions<TimeOfDayResult, ProblemDetails, TimeOfDayOptions>
) => useMutation<TimeOfDayResult, ProblemDetails, TimeOfDayOptions>(getTimeOfDay, options)
