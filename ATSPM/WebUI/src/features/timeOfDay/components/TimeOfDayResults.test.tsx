import type { TimeOfDayResult } from '@/api/reports'
import { fireEvent, render, screen } from '@testing-library/react'

import TimeOfDayResults from './TimeOfDayResults'

jest.mock('@/features/charts/components/apacheEChart', () => ({
  __esModule: true,
  default: ({ id }: { id: string }) => <div data-testid={id} />,
}))

const result = {
  selectedDates: [],
  planProfile: {
    corridorProfile: {
      points: [{ minutes: 0, averageVolume: 100 }],
    },
    peaks: [],
  },
  splitPressure: {
    primaryProfile: {
      points: [{ minutes: 0, averageVolume: 80 }],
    },
    crossTrafficLocations: [],
    movementPressures: [],
  },
} as TimeOfDayResult

describe('TimeOfDayResults analysis tabs', () => {
  test('switches the chart and supporting details together', () => {
    render(<TimeOfDayResults result={result} />)

    const planTab = screen.getByRole('tab', {
      name: 'Plan Recommendation',
    })
    const splitPressureTab = screen.getByRole('tab', {
      name: 'Split Pressure',
    })

    expect(planTab.getAttribute('aria-selected')).toBe('true')
    expect(screen.getByTestId('time-of-day-plan-profile')).toBeTruthy()
    expect(screen.queryByTestId('time-of-day-split-pressure')).toBeNull()
    expect(screen.getByText('AM Signal Peaks')).toBeTruthy()

    fireEvent.click(splitPressureTab)

    expect(splitPressureTab.getAttribute('aria-selected')).toBe('true')
    expect(screen.getByTestId('time-of-day-split-pressure')).toBeTruthy()
    expect(screen.queryByTestId('time-of-day-plan-profile')).toBeNull()
    expect(screen.getByText('AM Cross Traffic Locations')).toBeTruthy()
    expect(screen.queryByText('AM Signal Peaks')).toBeNull()
    expect(
      screen
        .getByRole('tabpanel')
        .getAttribute('aria-labelledby')
    ).toBe('time-of-day-split-pressure-tab')
  })
})
