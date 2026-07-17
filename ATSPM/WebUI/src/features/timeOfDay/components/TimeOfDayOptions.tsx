import MultipleLocationsSelect from '@/components/MultipleLocationsSelect/MultipleLocationsSelect'
import { StyledComponentHeader } from '@/components/HeaderStyling/StyledComponentHeader'
import MultiDaySelect from '@/features/tspReport/components/DateCalendar'
import { directionList } from '@/features/locations/types/DirectionType'
import DeleteIcon from '@mui/icons-material/Delete'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Checkbox,
  Chip,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  SelectChangeEvent,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { differenceInCalendarDays, format, isSameDay } from 'date-fns'
import type { ChangeEvent } from 'react'
import { useEffect, useState } from 'react'
import type {
  TimeOfDayDataSourceOption,
  TimeOfDayFormState,
} from '../types'
import { timeOfDayDataSourceLabels } from '../types'

type DirectionField =
  | 'allDayPrimaryDirections'
  | 'amPrimaryDirections'
  | 'pmPrimaryDirections'

interface TimeOfDayOptionsProps {
  options: TimeOfDayFormState
  onChange: (options: TimeOfDayFormState) => void
}

type SelectedDateRange = {
  start: Date
  end: Date
}

const areDirectionSetsEqual = (a: string[], b: string[]) =>
  a.length === b.length && a.every((direction) => b.includes(direction))

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

export default function TimeOfDayOptions({
  options,
  onChange,
}: TimeOfDayOptionsProps) {
  const [usePeriodSpecificDirections, setUsePeriodSpecificDirections] =
    useState(
      () =>
        !areDirectionSetsEqual(
          options.allDayPrimaryDirections,
          options.amPrimaryDirections
        ) ||
        !areDirectionSetsEqual(
          options.allDayPrimaryDirections,
          options.pmPrimaryDirections
        )
    )

  useEffect(() => {
    const hasPeriodSpecificDirections =
      !areDirectionSetsEqual(
        options.allDayPrimaryDirections,
        options.amPrimaryDirections
      ) ||
      !areDirectionSetsEqual(
        options.allDayPrimaryDirections,
        options.pmPrimaryDirections
      )

    if (hasPeriodSpecificDirections) {
      setUsePeriodSpecificDirections(true)
    }
  }, [
    options.allDayPrimaryDirections,
    options.amPrimaryDirections,
    options.pmPrimaryDirections,
  ])

  const updateOptions = (patch: Partial<TimeOfDayFormState>) => {
    onChange({ ...options, ...patch })
  }

  const handleDirectionChange =
    (field: DirectionField) => (event: SelectChangeEvent<string[]>) => {
      const value = event.target.value
      const selectedDirections =
        typeof value === 'string' ? value.split(',') : value

      if (field === 'allDayPrimaryDirections' && !usePeriodSpecificDirections) {
        updateOptions({
          allDayPrimaryDirections: selectedDirections,
          amPrimaryDirections: selectedDirections,
          pmPrimaryDirections: selectedDirections,
        })
        return
      }

      updateOptions({
        [field]: selectedDirections,
      } as Partial<TimeOfDayFormState>)
  }

  const handleUsePeriodSpecificDirectionsChange = (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const checked = event.target.checked
    setUsePeriodSpecificDirections(checked)

    if (!checked) {
      updateOptions({
        amPrimaryDirections: options.allDayPrimaryDirections,
        pmPrimaryDirections: options.allDayPrimaryDirections,
      })
    }
  }

  const handleDeleteLocation = (
    locationId?: number,
    identifier?: string | null
  ) => {
    updateOptions({
      selectedLocations: options.selectedLocations.filter(
        (location) =>
          location.id !== locationId &&
          location.locationIdentifier !== identifier
      ),
    })
  }

  const handleDeleteDateRange = (range: SelectedDateRange) => {
    updateOptions({
      selectedDates: options.selectedDates.filter(
        (selectedDate) => !isDateInSelectedRange(selectedDate, range)
      ),
    })
  }

  const handleLaneCountChange = (direction: string, rawValue: string) => {
    const nextLaneCounts = { ...options.directionLaneCounts }
    const laneCount = Number(rawValue)

    if (rawValue === '' || Number.isNaN(laneCount)) {
      delete nextLaneCounts[direction]
    } else {
      nextLaneCounts[direction] = laneCount
    }

    updateOptions({ directionLaneCounts: nextLaneCounts })
  }

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

  const renderDirectionSelect = (label: string, field: DirectionField) => (
    <FormControl size="small" fullWidth>
      <InputLabel id={`${field}-label`}>{label}</InputLabel>
      <Select
        labelId={`${field}-label`}
        multiple
        label={label}
        value={options[field]}
        onChange={handleDirectionChange(field)}
        renderValue={(selected) => selected.join(', ')}
      >
        {directionList.map((direction) => (
          <MenuItem key={direction} value={direction}>
            <Checkbox checked={options[field].includes(direction)} />
            <ListItemText primary={direction} />
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  )

  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 2,
        alignItems: 'stretch',
      }}
    >
      <Paper
        sx={{
          display: 'flex',
          flexDirection: 'column',
          width: { xs: '100%', md: 'fit-content' },
          maxWidth: '100%',
          alignSelf: 'stretch',
        }}
      >
        <StyledComponentHeader header="Corridor" />
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            p: 3,
            pt: 2,
          }}
        >
          <Box sx={{ width: { xs: '100%', md: '400px' }, flexShrink: 0 }}>
            <MultipleLocationsSelect
              selectedLocations={options.selectedLocations}
              setLocations={(locations) =>
                updateOptions({ selectedLocations: locations })
              }
            />
          </Box>
          <Divider
            orientation="vertical"
            flexItem
            sx={{ mx: 2, display: { xs: 'none', md: 'block' } }}
          />
          <Divider sx={{ my: 2, display: { xs: 'block', md: 'none' } }} />
          <Box
            sx={{
              width: { xs: '100%', md: '600px' },
              minWidth: { xs: 'auto', md: '450px' },
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="flex-end"
              sx={{ mb: 1 }}
            >
              <Button
                size="small"
                variant="outlined"
                color="error"
                startIcon={<DeleteIcon />}
                disabled={!options.selectedLocations.length}
                onClick={() => updateOptions({ selectedLocations: [] })}
              >
                Remove All
              </Button>
            </Stack>
            <Box sx={{ maxHeight: 430, overflowY: 'auto' }}>
              <Table
                size="small"
                stickyHeader
                aria-label="selected time of day locations"
              >
                <TableHead>
                  <TableRow>
                    <TableCell>
                      <Typography variant="subtitle2">
                        Selected Locations
                      </Typography>
                    </TableCell>
                    <TableCell align="right" />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {options.selectedLocations.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2}>
                        <Typography variant="body2" color="text.secondary">
                          No locations selected
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    options.selectedLocations.map((location) => (
                      <TableRow
                        key={`${location.id ?? ''}-${location.locationIdentifier}`}
                        hover
                      >
                        <TableCell>
                          {[
                            location.locationIdentifier,
                            [location.primaryName, location.secondaryName]
                              .filter(Boolean)
                              .join(' '),
                          ]
                            .filter(Boolean)
                            .join(' - ')}
                        </TableCell>
                        <TableCell align="right">
                          <IconButton
                            size="small"
                            color="error"
                            aria-label={`Remove ${location.locationIdentifier}`}
                            onClick={() =>
                              handleDeleteLocation(
                                location.id,
                                location.locationIdentifier
                              )
                            }
                          >
                            <DeleteIcon />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Box>
          </Box>
        </Box>
      </Paper>

      <Paper
        sx={{
          width: { xs: '100%', sm: '390px' },
          display: 'flex',
          flexDirection: 'column',
          alignSelf: 'stretch',
        }}
      >
        <StyledComponentHeader
          header="Dates"
          action={
            <Button
              size="small"
              variant="outlined"
              disabled={!options.selectedDates.length}
              onClick={() => updateOptions({ selectedDates: [] })}
            >
              Clear All
            </Button>
          }
        />
        <Box sx={{ p: 3, pt: 2 }}>
          <MultiDaySelect
            selectedDays={options.selectedDates}
            onSelectedDaysChange={(selectedDates) =>
              updateOptions({ selectedDates })
            }
          />
          <Box sx={{ mt: 1, maxHeight: 120, overflowY: 'auto', pr: 0.5 }}>
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
      </Paper>

      <Paper
        sx={{
          width: { xs: '100%', sm: '360px' },
          display: 'flex',
          flexDirection: 'column',
          alignSelf: 'stretch',
        }}
      >
        <StyledComponentHeader header="Analysis Parameters" />
        <Box sx={{ p: 3, pt: 2 }}>
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            }}
          >
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 0.75 }}>
                Data Source
              </Typography>
              <ToggleButtonGroup
                exclusive
                fullWidth
                color="primary"
                size="small"
                value={options.dataSource}
                onChange={(
                  _,
                  dataSource: TimeOfDayDataSourceOption | null
                ) => {
                  if (dataSource) updateOptions({ dataSource })
                }}
              >
                {Object.entries(timeOfDayDataSourceLabels).map(
                  ([value, label]) => (
                    <ToggleButton key={value} value={value}>
                      {label}
                    </ToggleButton>
                  )
                )}
              </ToggleButtonGroup>
            </Box>
            <TextField
              size="small"
              label="Bin Size Minutes"
              value={options.binSizeMinutes}
              disabled
              fullWidth
            />
            {renderDirectionSelect(
              'Primary Directions',
              'allDayPrimaryDirections'
            )}
            <FormControlLabel
              control={
                <Switch
                  checked={usePeriodSpecificDirections}
                  onChange={handleUsePeriodSpecificDirectionsChange}
                />
              }
              label="Use different AM/PM directions"
            />
            {usePeriodSpecificDirections && (
              <>
                {renderDirectionSelect(
                  'AM Primary Directions',
                  'amPrimaryDirections'
                )}
                {renderDirectionSelect(
                  'PM Primary Directions',
                  'pmPrimaryDirections'
                )}
              </>
            )}
          </Box>

          <Accordion sx={{ mt: 2 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography>Advanced Occupancy</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                }}
              >
                <TextField
                  size="small"
                  type="number"
                  label="Lane Capacity VPH"
                  value={options.laneCapacityVehiclesPerHour}
                  onChange={(event) =>
                    updateOptions({
                      laneCapacityVehiclesPerHour: Number(event.target.value),
                    })
                  }
                  inputProps={{ min: 1 }}
                />
                {directionList.map((direction) => (
                  <TextField
                    key={direction}
                    size="small"
                    type="number"
                    label={`${direction} Lanes`}
                    value={options.directionLaneCounts[direction] ?? ''}
                    onChange={(event) =>
                      handleLaneCountChange(direction, event.target.value)
                    }
                    inputProps={{ min: 0, step: 1 }}
                  />
                ))}
              </Box>
            </AccordionDetails>
          </Accordion>
        </Box>
      </Paper>
    </Box>
  )
}
