import { StyledComponentHeader } from '@/components/HeaderStyling/StyledComponentHeader'
import MultiDaySelect from '@/features/tspReport/components/DateCalendar'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import {
  Box,
  Button,
  Chip,
  Divider,
  Paper,
  Stack,
  Typography,
} from '@mui/material'
import { differenceInCalendarDays, format, isSameDay } from 'date-fns'
import type { TimeOfDayFormState } from '../types'

type SelectedDateRange = {
  start: Date
  end: Date
}

const buildSelectedDateRanges = (dates: Date[]): SelectedDateRange[] =>
  dates.reduce<SelectedDateRange[]>((ranges, date) => {
    const currentRange = ranges[ranges.length - 1]

    if (!currentRange) {
      return [{ start: date, end: date }]
    }

    const calendarDayDifference = differenceInCalendarDays(
      date,
      currentRange.end
    )

    if (calendarDayDifference === 0) {
      return ranges
    }

    if (calendarDayDifference === 1) {
      currentRange.end = date
      return ranges
    }

    return [...ranges, { start: date, end: date }]
  }, [])

const isDateInSelectedRange = (date: Date, range: SelectedDateRange) =>
  differenceInCalendarDays(date, range.start) >= 0 &&
  differenceInCalendarDays(date, range.end) <= 0

interface TimeOfDayDatesOptionsProps {
  options: TimeOfDayFormState
  onChange: (options: TimeOfDayFormState) => void
}

export default function TimeOfDayDatesOptions({
  options,
  onChange,
}: TimeOfDayDatesOptionsProps) {
  const updateDates = (selectedDates: Date[]) =>
    onChange({ ...options, selectedDates })

  const sortedSelectedDates = [...options.selectedDates].sort(
    (a, b) => a.getTime() - b.getTime()
  )
  const selectedDateLabelFormat =
    new Set(sortedSelectedDates.map((date) => date.getFullYear())).size > 1
      ? 'EEE, MMM d, yyyy'
      : 'EEE, MMM d'
  const selectedDateRanges = buildSelectedDateRanges(sortedSelectedDates)

  const getSelectedDateRangeLabel = (range: SelectedDateRange) => {
    if (isSameDay(range.start, range.end)) {
      return format(range.start, selectedDateLabelFormat)
    }

    return `${format(range.start, selectedDateLabelFormat)} - ${format(
      range.end,
      selectedDateLabelFormat
    )}`
  }

  const handleDeleteDateRange = (range: SelectedDateRange) => {
    updateDates(
      options.selectedDates.filter(
        (selectedDate) => !isDateInSelectedRange(selectedDate, range)
      )
    )
  }

  return (
    <Paper
      sx={{
        width: { xs: '100%', sm: '336px' },
        height: 600,
        flex: '0 0 auto',
        display: 'flex',
        flexDirection: 'column',
        alignSelf: 'stretch',
        overflow: 'hidden',
      }}
    >
      <StyledComponentHeader header="Dates" />
      <Box
        sx={{
          p: 3,
          pt: 0,
          pb: 2,
          minHeight: 0,
          display: 'flex',
          flex: 1,
          flexDirection: 'column',
        }}
      >
        <Box sx={{ mx: -3, display: 'flex', justifyContent: 'center' }}>
          <MultiDaySelect
            selectedDays={options.selectedDates}
            onSelectedDaysChange={updateDates}
          />
        </Box>
        <Box
          sx={{
            minHeight: 0,
            display: 'flex',
            flex: 1,
            flexDirection: 'column',
          }}
        >
          <Divider sx={{ mb: 1 }}>
            <Stack direction="row" alignItems="center" spacing={0.75}>
              <Typography variant="caption">Selected dates</Typography>
              <Chip
                size="small"
                label={options.selectedDates.length}
                aria-label={`${options.selectedDates.length} selected dates`}
                sx={{ height: 20, minWidth: 26 }}
              />
              <Button
                size="small"
                color="error"
                startIcon={<DeleteOutlineIcon />}
                disabled={!options.selectedDates.length}
                onClick={() => updateDates([])}
                sx={{ textTransform: 'none', whiteSpace: 'nowrap' }}
              >
                Clear all
              </Button>
            </Stack>
          </Divider>
          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
            }}
          >
            <Stack direction="row" gap={1} flexWrap="wrap">
              {selectedDateRanges.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No dates selected
                </Typography>
              ) : (
                selectedDateRanges.map((range) => (
                  <Chip
                    key={`${range.start.toISOString()}-${range.end.toISOString()}`}
                    size="small"
                    label={getSelectedDateRangeLabel(range)}
                    onDelete={() => handleDeleteDateRange(range)}
                  />
                ))
              )}
            </Stack>
          </Box>
        </Box>
      </Box>
    </Paper>
  )
}
