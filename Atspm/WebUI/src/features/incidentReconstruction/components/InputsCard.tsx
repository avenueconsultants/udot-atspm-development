// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - InputsCard.tsx
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//http://www.apache.org/licenses/LICENSE-2.
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
// #endregion
import { StyledPaper } from '@/components/StyledPaper'
import { MarkedDay } from '@/components/selectTimeSpan'
import {
  controllerTimeFromPicker,
  formatDisplayDate,
  pickerValueFromControllerTime,
  startOfControllerDay,
} from '@/features/incidentReconstruction/wallClock'
import { useLatestVersionOfAllLocations } from '@/features/locations/api'
import SelectLocationNoMap from '@/features/locations/components/selectLocation/SelectLocationNoMap'
import { Location } from '@/features/locations/types'
import { LoadingButton } from '@mui/lab'
import { Box } from '@mui/material'
import { DatePicker, TimePicker } from '@mui/x-date-pickers'
import { DateValidationError } from '@mui/x-date-pickers/models'
import { isAfter, isSameDay, startOfDay } from 'date-fns'
import { useState } from 'react'

interface InputsCardProps {
  locationIdentifier: string | null
  /** Start of the picked day, controller clock. */
  day: number | null
  start: number | null
  end: number | null
  missingDays: Date[]
  problem: string | null
  canGenerate: boolean
  loading: boolean
  onLocationChange(locationIdentifier: string | null): void
  onDateChange(date: number): void
  onStartChange(time: number): void
  onEndChange(time: number): void
  onMonthChange(month: Date): void
  onGenerate(): void
}

// The window is whole seconds; the tenth is fixed so it reads like the chart.
const timeFormat = "HH:mm:ss'.0'"
const timeViews = ['hours', 'minutes', 'seconds'] as const

/** The location picker is shared with other pages; this sizes it to the small fields beside it. */
const compactLocationSx = {
  width: 340,
  '& br': { display: 'none' },
  '& .MuiAutocomplete-root .MuiOutlinedInput-root': {
    paddingTop: '1px',
    paddingBottom: '1px',
  },
  '& .MuiInputLabel-root:not(.MuiInputLabel-shrink)': {
    transform: 'translate(14px, 9px) scale(1)',
  },
}

/**
 * Why Generate waits on the date field, or null. Typing a date passes through
 * partial dates such as year 0004. The picker's own error can't be used for
 * this: it reports a day without data ahead of a year out of range.
 */
function dateProblem(day: number | null, incomplete: boolean): string | null {
  if (incomplete) return 'Enter a full date.'
  if (day === null) return null
  const picked = pickerValueFromControllerTime(day)
  if (picked.getFullYear() < 1900) return 'Pick a date from 1900 on.'
  if (isAfter(startOfDay(picked), new Date())) return 'Pick a date up to today.'
  return null
}

/** Reads a time picker's value as controller time, or null while it is incomplete. */
function readPicker(value: Date | null): number | null {
  return value && !Number.isNaN(value.getTime())
    ? controllerTimeFromPicker(value)
    : null
}

export default function InputsCard({
  locationIdentifier,
  day,
  start,
  end,
  missingDays,
  problem,
  canGenerate,
  loading,
  onLocationChange,
  onDateChange,
  onStartChange,
  onEndChange,
  onMonthChange,
  onGenerate,
}: InputsCardProps) {
  const { data } = useLatestVersionOfAllLocations()
  const locations: Location[] = data?.value ?? []
  const location =
    locations.find((item) => item.locationIdentifier === locationIdentifier) ??
    null

  const [dateError, setDateError] = useState<DateValidationError>(null)
  const [dateEmpty, setDateEmpty] = useState(false)
  const problemWithDate = dateProblem(
    day,
    dateEmpty || dateError === 'invalidDate'
  )

  // An end after midnight names its date.
  const endDate =
    end !== null && day !== null && startOfControllerDay(end) !== day
      ? `Ends ${formatDisplayDate(end)}`
      : undefined

  return (
    <StyledPaper
      sx={{
        p: 2,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'flex-start',
        gap: 2,
      }}
    >
      <Box sx={compactLocationSx}>
        <SelectLocationNoMap
          location={location}
          setLocation={(value) =>
            onLocationChange(value?.locationIdentifier ?? null)
          }
          locations={locations}
        />
      </Box>
      <DatePicker
        label="Date"
        value={day === null ? null : pickerValueFromControllerTime(day)}
        onChange={(value) => {
          setDateEmpty(value === null)
          const time = readPicker(value)
          if (time !== null) onDateChange(time)
        }}
        onError={setDateError}
        onMonthChange={onMonthChange}
        onYearChange={onMonthChange}
        disableFuture
        format="yyyy-MM-dd"
        slots={{ day: MarkedDay }}
        slotProps={{
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          day: { highlightedDays: missingDays } as any,
          textField: {
            size: 'small',
            error: problemWithDate !== null,
            helperText: problemWithDate ?? undefined,
          },
        }}
        shouldDisableDate={(date) =>
          missingDays.some((missing) => isSameDay(missing, date))
        }
        sx={{ width: 170 }}
      />
      <TimePicker
        label="Start"
        value={start === null ? null : pickerValueFromControllerTime(start)}
        onChange={(value) => {
          const time = readPicker(value)
          if (time !== null) onStartChange(time)
        }}
        ampm={false}
        views={timeViews}
        format={timeFormat}
        slotProps={{ textField: { size: 'small' } }}
        sx={{ width: 150 }}
      />
      <TimePicker
        label="End"
        value={end === null ? null : pickerValueFromControllerTime(end)}
        onChange={(value) => {
          const time = readPicker(value)
          if (time !== null) onEndChange(time)
        }}
        ampm={false}
        views={timeViews}
        format={timeFormat}
        slotProps={{
          textField: {
            size: 'small',
            error: problem !== null,
            helperText: problem ?? endDate,
          },
        }}
        sx={{ width: 150 }}
      />
      <LoadingButton
        variant="contained"
        loading={loading}
        disabled={!canGenerate || problemWithDate !== null}
        onClick={onGenerate}
        sx={{ height: 40, px: 3 }}
      >
        Generate
      </LoadingButton>
    </StyledPaper>
  )
}
