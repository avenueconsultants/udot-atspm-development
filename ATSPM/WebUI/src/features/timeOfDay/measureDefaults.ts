import type { Default } from '@/features/charts/types'
import {
  timeOfDayDefaultTuningOptions,
  TimeOfDayTuningOptionKey,
  timeOfDayTuningOptionKeys,
  TimeOfDayTuningOptions,
} from './types'

export const timeOfDayMeasureTypeId = 41

export type TimeOfDayMeasureDefaults = Partial<
  Record<TimeOfDayTuningOptionKey, Default>
>

const stringOptionKeys = new Set<TimeOfDayTuningOptionKey>([
  'freeFallbackTime',
  'maxAmEndTime',
  'maxPmEndTime',
])

const parseNumberDefault = (
  defaults: TimeOfDayMeasureDefaults | undefined,
  key: TimeOfDayTuningOptionKey,
  fallback: number
) => {
  const value = defaults?.[key]?.value
  const parsed = typeof value === 'number' ? value : Number(value)

  return Number.isFinite(parsed) ? parsed : fallback
}

const parseStringDefault = (
  defaults: TimeOfDayMeasureDefaults | undefined,
  key: TimeOfDayTuningOptionKey,
  fallback: string
) => {
  const value = defaults?.[key]?.value

  return typeof value === 'string' && value.trim() ? value : fallback
}

export const buildTimeOfDayTuningOptionsFromDefaults = (
  defaults: TimeOfDayMeasureDefaults | undefined
): TimeOfDayTuningOptions =>
  timeOfDayTuningOptionKeys.reduce((options, key) => {
    if (stringOptionKeys.has(key)) {
      return {
        ...options,
        [key]: parseStringDefault(
          defaults,
          key,
          timeOfDayDefaultTuningOptions[key] as string
        ),
      }
    }

    return {
      ...options,
      [key]: parseNumberDefault(
        defaults,
        key,
        timeOfDayDefaultTuningOptions[key] as number
      ),
    }
  }, {} as TimeOfDayTuningOptions)
