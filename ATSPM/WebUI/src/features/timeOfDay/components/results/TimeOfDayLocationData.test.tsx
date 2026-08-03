import type { TimeOfDayResult } from '@/api/reports'
import { render, screen, within } from '@testing-library/react'
import TimeOfDayLocationData from './TimeOfDayLocationData'

const result = {
  locations: [
    {
      locationIdentifier: '7190',
      locationDescription: 'Main St & Center St',
      daysWithData: 12,
      coverageFallbackUsed: false,
      currentPlanSchedule: [
        {
          planNumber: '1',
          start: '2026-04-15T07:00:00',
          end: '2026-04-15T09:00:00',
        },
      ],
      summary: {
        peakRawVolume: 1234,
        peakSmoothedVolume: 1200,
        peakHourlyRate: 4800,
        peakOccupancyPercent: 18.25,
        amPeakOccupancyPercent: 14.21,
        pmPeakOccupancyPercent: 16.89,
      },
      dataQualityFlag: 'Good',
    },
  ],
} as TimeOfDayResult

describe('TimeOfDayLocationData', () => {
  test('renders compact grouped supporting data without repeating TOD plans', () => {
    render(<TimeOfDayLocationData result={result} />)

    expect(
      screen.getByText(
        'Coverage, peak demand, occupancy, and review details for 1 selected location.'
      )
    ).toBeTruthy()

    const table = screen.getByRole('table', {
      name: 'time of day location supporting data',
    })
    expect(within(table).getByText('Coverage')).toBeTruthy()
    expect(within(table).getByText('Peak Demand')).toBeTruthy()
    expect(within(table).getByText('Occupancy')).toBeTruthy()
    expect(within(table).getByText('Review')).toBeTruthy()
    expect(within(table).getByText('V/C Ratio')).toBeTruthy()
    expect(within(table).queryByText('Peak')).toBeNull()
    expect(within(table).getByText('7190 - Main St & Center St')).toBeTruthy()
    expect(within(table).getByText('1,234')).toBeTruthy()
    expect(within(table).getByText('0.18')).toBeTruthy()
    expect(within(table).queryByText('18.3%')).toBeNull()
    expect(within(table).queryByText('Existing TOD Plans')).toBeNull()
    expect(within(table).queryByText(/Plan 1/)).toBeNull()
  })
})
