import { Box, MenuItem } from '@mui/material'
import { renderMultiSectionDigitalClockTimeView } from '@mui/x-date-pickers/timeViewRenderers'
import { set } from 'date-fns'
import { useLayoutEffect, useRef } from 'react'

type Props = Parameters<typeof renderMultiSectionDigitalClockTimeView<Date>>[0]
const rowHeight = 40
const copies = 5

interface ColumnProps {
  label: string
  values: number[]
  selected: number
  formatValue(value: number): string
  onSelect(value: number): void
  isDisabled(value: number): boolean
  loop?: boolean
}

function TimeColumn({
  label,
  values,
  selected,
  formatValue,
  onSelect,
  isDisabled,
  loop = true,
}: ColumnProps) {
  const ref = useRef<HTMLDivElement>(null)
  const cycleHeight = values.length * rowHeight
  useLayoutEffect(() => {
    if (loop && ref.current) {
      ref.current.scrollTop =
        cycleHeight * 2 + Math.max(0, values.indexOf(selected)) * rowHeight
    }
    // Initialize the scroll position when the column opens; clicking must not jump it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loop, cycleHeight])

  return (
    <Box
      ref={ref}
      role="listbox"
      aria-label={label}
      onScroll={(event) => {
        if (!loop) return
        const list = event.currentTarget
        if (list.scrollTop < cycleHeight || list.scrollTop >= cycleHeight * 3) {
          list.scrollTop = cycleHeight * 2 + (list.scrollTop % cycleHeight)
        }
      }}
      sx={{
        height: 240,
        width: 64,
        overflowY: loop ? 'auto' : 'hidden',
        scrollbarWidth: 'none',
        '&::-webkit-scrollbar': { display: 'none' },
        overscrollBehavior: 'contain',
        borderRight: 1,
        borderColor: 'divider',
      }}
    >
      {Array.from({ length: loop ? copies : 1 }, (_, copy) =>
        values.map((value, index) => (
          <MenuItem
            key={`${copy}-${value}`}
            role="option"
            aria-label={formatValue(value)}
            aria-selected={value === selected}
            selected={value === selected}
            disabled={isDisabled(value)}
            tabIndex={value === selected && copy === (loop ? 2 : 0) ? 0 : -1}
            onClick={() => onSelect(value)}
            onKeyDown={(event) => {
              if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key))
                return
              event.preventDefault()
              const direction = event.key === 'ArrowUp' ? -1 : 1
              let next =
                event.key === 'Home'
                  ? 0
                  : event.key === 'End'
                    ? values.length - 1
                    : (index + direction + values.length) % values.length
              for (
                let count = 0;
                count < values.length && isDisabled(values[next]);
                count++
              ) {
                next = (next + direction + values.length) % values.length
              }
              const target = ref.current?.children[
                (loop ? 2 : 0) * values.length + next
              ] as HTMLElement | undefined
              target?.focus()
            }}
            sx={{
              height: rowHeight,
              minHeight: rowHeight,
              justifyContent: 'center',
              '&.Mui-selected': {
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
              },
            }}
          >
            {formatValue(value)}
          </MenuItem>
        ))
      )}
    </Box>
  )
}

export default function LoopingTimeView({
  value,
  onChange,
  minTime,
  maxTime,
  disabled,
  readOnly,
  shouldDisableTime,
}: Props) {
  const date = value ?? new Date()
  const hours = date.getHours()
  const makeDate = (unit: 'hours' | 'minutes', value: number) =>
    set(date, { [unit]: value })
  const minutesOfDay = (date: Date) => date.getHours() * 60 + date.getMinutes()
  const isDisabled = (unit: 'hours' | 'minutes', value: number) => {
    const candidate = makeDate(unit, value)
    return !!(
      disabled ||
      readOnly ||
      (minTime && minutesOfDay(candidate) < minutesOfDay(minTime)) ||
      (maxTime && minutesOfDay(candidate) > minutesOfDay(maxTime)) ||
      shouldDisableTime?.(candidate, unit)
    )
  }
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
      <TimeColumn
        label="Hours"
        values={Array.from({ length: 24 }, (_, i) => i)}
        selected={hours}
        formatValue={(value) => String(value).padStart(2, '0')}
        onSelect={(value) =>
          onChange?.(makeDate('hours', value), 'partial', 'hours')
        }
        isDisabled={(value) => isDisabled('hours', value)}
      />
      <TimeColumn
        label="Minutes"
        values={Array.from({ length: 60 }, (_, i) => i)}
        selected={date.getMinutes()}
        formatValue={(value) => String(value).padStart(2, '0')}
        onSelect={(value) =>
          onChange?.(makeDate('minutes', value), 'partial', 'minutes')
        }
        isDisabled={(value) => isDisabled('minutes', value)}
      />
    </Box>
  )
}

export const loopingTimeViewRenderers = {
  hours: (props: Props) => <LoopingTimeView {...props} />,
  minutes: (props: Props) => <LoopingTimeView {...props} />,
}
