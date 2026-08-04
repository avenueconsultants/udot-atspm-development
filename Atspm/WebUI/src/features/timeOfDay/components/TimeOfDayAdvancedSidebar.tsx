import RightSidebar from '@/components/RightSidebar'
import { directionList } from '@/features/locations/types/DirectionType'
import { Box, Slider, Stack, TextField, Typography } from '@mui/material'
import { TimePicker } from '@mui/x-date-pickers'
import { format } from 'date-fns'
import type { ChangeEvent, ReactNode } from 'react'
import type { TimeOfDaySchedulePreset } from '../measureDefaults'
import type { TimeOfDayFormState, TimeOfDayTuningOptionKey } from '../types'
import TimeOfDaySchedulePresetSelect from './TimeOfDaySchedulePresetSelect'

export type AnalysisSidebar = 'schedule' | 'occupancy'

type TuningFieldDefinition = {
  option: TimeOfDayTuningOptionKey
  label: string
  type?: 'number' | 'time'
  inputProps?: Record<string, string | number>
}

const scheduleThresholdFields: TuningFieldDefinition[] = [
  {
    option: 'amEntryPctOfPeak',
    label: 'AM start threshold',
    inputProps: { min: 0, max: 1, step: 0.01 },
  },
  {
    option: 'amExitPctOfPeak',
    label: 'AM end threshold',
    inputProps: { min: 0, max: 1, step: 0.01 },
  },
  {
    option: 'pmEntryPctOfPeak',
    label: 'PM start threshold',
    inputProps: { min: 0, max: 1, step: 0.01 },
  },
  {
    option: 'pmExitPctOfPeak',
    label: 'PM end threshold',
    inputProps: { min: 0, max: 1, step: 0.01 },
  },
  {
    option: 'freeEntryPctOfDailyPeak',
    label: 'Daily peak threshold',
    inputProps: { min: 0, max: 1, step: 0.01 },
  },
  {
    option: 'freeEntryPctOfDynamicRange',
    label: 'Dynamic range threshold',
    inputProps: { min: 0, max: 1, step: 0.01 },
  },
  {
    option: 'entrySustainedBins',
    label: 'Consecutive bins for AM/PM transitions',
    inputProps: { min: 1, step: 1 },
  },
  {
    option: 'freeSustainedBins',
    label: 'Consecutive bins before FREE',
    inputProps: { min: 1, step: 1 },
  },
  {
    option: 'freeFallbackTime',
    label: 'Fallback FREE start time',
    type: 'time',
  },
  {
    option: 'maxAmEndTime',
    label: 'Latest allowed AM plan end',
    type: 'time',
  },
  {
    option: 'maxPmEndTime',
    label: 'Latest allowed PM plan end',
    type: 'time',
  },
]

const occupancyReviewFields: TuningFieldDefinition[] = [
  {
    option: 'laneCapacityVehiclesPerHour',
    label: 'Lane capacity (100% occupancy)',
    inputProps: { min: 1, step: 1 },
  },
  {
    option: 'approachVolumeAssumedLanes',
    label: 'Assumed lanes per approach',
    inputProps: { min: 1, step: 1 },
  },
  {
    option: 'splitReviewThresholdPercent',
    label: 'Split-review threshold',
    inputProps: { min: 0, max: 100, step: 1 },
  },
  {
    option: 'shoulderReviewThresholdPercent',
    label: 'Shoulder-review threshold',
    inputProps: { min: 0, max: 100, step: 1 },
  },
]

const parseTimeString = (value: unknown) => {
  if (typeof value !== 'string') return null

  const match = /^(\d{1,2}):(\d{2})$/.exec(value)
  if (!match) return null

  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null

  return new Date(2000, 0, 1, hours, minutes)
}

interface TimeOfDayAdvancedSidebarProps {
  activeSidebar: AnalysisSidebar
  options: TimeOfDayFormState
  onChange: (options: TimeOfDayFormState) => void
  schedulePresets?: TimeOfDaySchedulePreset[]
}

export default function TimeOfDayAdvancedSidebar({
  activeSidebar,
  options,
  onChange,
  schedulePresets = [],
}: TimeOfDayAdvancedSidebarProps) {
  const updateOptions = (patch: Partial<TimeOfDayFormState>) =>
    onChange({ ...options, ...patch })

  const handleTuningFieldChange =
    (field: TuningFieldDefinition) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      updateOptions({
        [field.option]: Number(event.target.value),
      } as Partial<TimeOfDayFormState>)
    }

  const handleLaneCountChange = (direction: string, rawValue: string) => {
    const directionLaneCounts = { ...options.directionLaneCounts }
    const laneCount = Number(rawValue)

    if (rawValue === '' || Number.isNaN(laneCount)) {
      delete directionLaneCounts[direction]
    } else {
      directionLaneCounts[direction] = laneCount
    }

    updateOptions({ directionLaneCounts })
  }

  const selectedLaneDirections = directionList.filter(
    (direction) =>
      options.amPrimaryDirections.includes(direction) ||
      options.pmPrimaryDirections.includes(direction)
  )

  const renderTuningSlider = (
    field: TuningFieldDefinition,
    maximum: number,
    valueSuffix = '',
    displayMultiplier = 1
  ) => {
    const value = Number(
      (Number(options[field.option]) * displayMultiplier).toFixed(10)
    )

    return (
      <Box key={field.option}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 1,
            mb: 0.25,
          }}
        >
          <Typography variant="caption" color="text.secondary">
            {field.label}
          </Typography>
          <Typography variant="caption" sx={{ fontWeight: 600 }}>
            {maximum === 1 ? value.toFixed(2) : value}
            {valueSuffix}
          </Typography>
        </Box>
        <Slider
          size="small"
          value={value}
          min={0}
          max={maximum}
          step={maximum === 1 ? 0.01 : 1}
          valueLabelDisplay="auto"
          valueLabelFormat={(sliderValue) =>
            maximum === 1
              ? Number(sliderValue).toFixed(2)
              : `${sliderValue}${valueSuffix}`
          }
          onChange={(_, sliderValue) =>
            updateOptions({
              [field.option]: Number(
                (Number(sliderValue) / displayMultiplier).toFixed(10)
              ),
            } as Partial<TimeOfDayFormState>)
          }
          aria-label={field.label}
          sx={{ py: 0.5 }}
        />
      </Box>
    )
  }

  const renderCompactTuningField = (field: TuningFieldDefinition) => (
    <Box
      key={field.option}
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 2,
      }}
    >
      <Typography variant="caption" color="text.secondary">
        {field.label}
      </Typography>
      {field.type === 'time' ? (
        <TimePicker
          ampm={false}
          format="HH:mm"
          closeOnSelect
          value={parseTimeString(options[field.option])}
          onChange={(value) =>
            updateOptions({
              [field.option]:
                value && !Number.isNaN(value.getTime())
                  ? format(value, 'HH:mm')
                  : '',
            } as Partial<TimeOfDayFormState>)
          }
          slotProps={{
            textField: {
              size: 'small',
              inputProps: { 'aria-label': field.label },
            },
          }}
          sx={{ width: 140, flexShrink: 0 }}
        />
      ) : (
        <TextField
          size="small"
          type="number"
          value={options[field.option]}
          onChange={handleTuningFieldChange(field)}
          inputProps={field.inputProps}
          aria-label={field.label}
          sx={{ width: 104, flexShrink: 0 }}
        />
      )}
    </Box>
  )

  const renderSidebarSection = (
    title: string,
    children: ReactNode,
    description?: string
  ) => (
    <Box
      component="section"
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        p: 1.5,
      }}
    >
      <Typography variant="subtitle2" sx={{ mb: description ? 0.5 : 1.5 }}>
        {title}
      </Typography>
      {description && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block', mb: 1.5, lineHeight: 1.45 }}
        >
          {description}
        </Typography>
      )}
      <Stack spacing={1.5}>{children}</Stack>
    </Box>
  )

  return (
    <RightSidebar
      width={420}
      dismissOnBackdrop
      title={
        activeSidebar === 'schedule'
          ? 'Schedule Thresholds'
          : 'Occupancy and Review'
      }
    >
      <Box
        sx={{
          p: 2,
          pt: 1,
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
        }}
      >
        {activeSidebar === 'schedule' ? (
          <Stack spacing={2}>
            <TimeOfDaySchedulePresetSelect
              options={options}
              onChange={onChange}
              presets={schedulePresets}
            />
            {renderSidebarSection(
              'AM / PM Transition Thresholds',
              <>
                {scheduleThresholdFields
                  .slice(0, 4)
                  .map((field) => renderTuningSlider(field, 100, '%', 100))}
                {renderCompactTuningField(scheduleThresholdFields[6])}
              </>,
              'Sets the volume levels that start and end AM/PM plans, expressed relative to each period’s peak. Consecutive bins prevent a brief spike or dip from triggering a transition.'
            )}
            {renderSidebarSection(
              'FREE Transition',
              <>
                {scheduleThresholdFields
                  .slice(4, 6)
                  .map((field) => renderTuningSlider(field, 100, '%', 100))}
                {renderCompactTuningField(scheduleThresholdFields[7])}
                {renderCompactTuningField(scheduleThresholdFields[8])}
              </>,
              'Uses the daily peak and baseline-to-peak dynamic range to decide when falling evening volume returns the schedule to FREE. The fallback time is used when no sustained transition is found.'
            )}
            {renderSidebarSection(
              'Plan Length Limits',
              <>
                {renderCompactTuningField(scheduleThresholdFields[9])}
                {renderCompactTuningField(scheduleThresholdFields[10])}
              </>,
              'Sets the latest time each peak plan can end. These limits also serve as fallbacks when the volume profile does not show a clear transition.'
            )}
          </Stack>
        ) : (
          <Stack spacing={2}>
            {renderSidebarSection(
              'Capacity & Review Thresholds',
              <>
                {renderCompactTuningField(occupancyReviewFields[0])}
                {renderCompactTuningField(occupancyReviewFields[1])}
                {occupancyReviewFields
                  .slice(2)
                  .map((field) => renderTuningSlider(field, 100, '%'))}
              </>
            )}
            {renderSidebarSection(
              'Direction Lanes',
              selectedLaneDirections.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Select at least one primary direction to configure lanes.
                </Typography>
              ) : (
                selectedLaneDirections.map((direction) => (
                  <Box
                    key={direction}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 2,
                    }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      {direction} lanes
                    </Typography>
                    <TextField
                      size="small"
                      type="number"
                      value={options.directionLaneCounts[direction] ?? ''}
                      onChange={(event) =>
                        handleLaneCountChange(direction, event.target.value)
                      }
                      inputProps={{ min: 0, step: 1 }}
                      aria-label={`${direction} lanes`}
                      sx={{ width: 104, flexShrink: 0 }}
                    />
                  </Box>
                ))
              )
            )}
          </Stack>
        )}
      </Box>
    </RightSidebar>
  )
}
