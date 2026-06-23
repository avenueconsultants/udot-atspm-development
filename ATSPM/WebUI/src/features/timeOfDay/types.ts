import type { SearchLocation } from '@/api/config'

export type TimeOfDayDataSourceOption = 'IndianaEvents' | 'Aggregated'

export interface TimeOfDayOptions {
  locationIdentifiers: string[]
  selectedDates: string[]
  binSizeMinutes: 15
  dataSource: TimeOfDayDataSourceOption
  allDayPrimaryDirections: string[]
  amPrimaryDirections: string[]
  pmPrimaryDirections: string[]
  laneCapacityVehiclesPerHour?: number
  directionLaneCounts?: Record<string, number>
}

export interface TimeOfDayFormState {
  selectedLocations: SearchLocation[]
  selectedDates: Date[]
  dataSource: TimeOfDayDataSourceOption
  allDayPrimaryDirections: string[]
  amPrimaryDirections: string[]
  pmPrimaryDirections: string[]
  binSizeMinutes: 15
  laneCapacityVehiclesPerHour: number
  directionLaneCounts: Record<string, number>
}

export const timeOfDayDataSourceLabels: Record<
  TimeOfDayDataSourceOption,
  string
> = {
  IndianaEvents: 'Indiana Events',
  Aggregated: 'Aggregated',
}

export const defaultPrimaryDirections = ['Northbound', 'Southbound']
