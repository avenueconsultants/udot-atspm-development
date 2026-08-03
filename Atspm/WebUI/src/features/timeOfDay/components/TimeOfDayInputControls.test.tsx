import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import type { TimeOfDayMeasureDefaults } from '../measureDefaults'
import {
  defaultPrimaryDirections,
  timeOfDayDefaultTuningOptions,
  type TimeOfDayFormState,
} from '../types'
import TimeOfDayAdvancedSidebar from './TimeOfDayAdvancedSidebar'
import TimeOfDayDirectionSelector from './TimeOfDayDirectionSelector'
import { TimeOfDayMeasureOptions } from './TimeOfDayMeasureOptions'

jest.mock('@/components/RightSidebar', () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

jest.mock('@mui/x-date-pickers', () => ({
  TimePicker: () => null,
}))

const options: TimeOfDayFormState = {
  selectedLocations: [],
  selectedDates: [],
  dataSource: 'IndianaEvents',
  allDayPrimaryDirections: defaultPrimaryDirections,
  amPrimaryDirections: defaultPrimaryDirections,
  pmPrimaryDirections: defaultPrimaryDirections,
  directionLaneCounts: {},
  ...timeOfDayDefaultTuningOptions,
}

describe('time-of-day inputs', () => {
  test('defaults to separate AM and PM primary directions', () => {
    render(
      <TimeOfDayDirectionSelector options={options} onChange={jest.fn()} />
    )

    expect(
      (
        screen.getByRole('checkbox', {
          name: 'Separate AM/PM directions',
        }) as HTMLInputElement
      ).checked
    ).toBe(true)
    expect(screen.getByText('AM')).toBeTruthy()
    expect(screen.getByText('PM')).toBeTruthy()
  })

  test('displays schedule threshold fractions as editable percents', () => {
    const handleChange = jest.fn()
    render(
      <TimeOfDayAdvancedSidebar
        activeSidebar={'schedule'}
        options={options}
        onChange={handleChange}
      />
    )

    const amStart = screen.getByRole('slider', {
      name: 'AM start — share of AM peak',
    })
    expect(amStart.getAttribute('aria-valuenow')).toBe('55')
    expect(screen.getAllByText('55%').length).toBeGreaterThan(0)

    fireEvent.change(amStart, { target: { value: '60' } })

    expect(handleChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ amEntryPctOfPeak: 0.6 })
    )
  })

  test('displays measure-default threshold fractions as percents', () => {
    const handleUpdate = jest.fn()
    const chartDefaults: TimeOfDayMeasureDefaults = {
      amEntryPctOfPeak: {
        id: 1,
        option: 'amEntryPctOfPeak',
        value: 0.55,
      },
    }

    render(
      <TimeOfDayMeasureOptions
        chartDefaults={chartDefaults}
        handleChartOptionsUpdate={handleUpdate}
      />
    )

    const amStart = screen.getByRole('spinbutton', {
      name: 'AM start threshold as percent of AM peak',
    })
    expect((amStart as HTMLInputElement).value).toBe('55')
    expect(amStart.getAttribute('max')).toBe('100')

    fireEvent.change(amStart, { target: { value: '60' } })

    expect(handleUpdate).toHaveBeenLastCalledWith({
      id: 1,
      option: 'amEntryPctOfPeak',
      value: '0.6',
    })
  })
})
