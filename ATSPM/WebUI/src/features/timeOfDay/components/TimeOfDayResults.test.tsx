import type { TimeOfDayResult } from '@/api/reports'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { init as initECharts } from 'echarts'
import { getTimeOfDaySignalPeakDetailKey } from '../transformers'

import TimeOfDayResults from './TimeOfDayResults'

const mockChartHandlers = new Map<string, (params: unknown) => void>()
const mockChart = {
  dispatchAction: jest.fn(),
  dispose: jest.fn(),
  getDataURL: jest.fn(() => 'data:image/png;base64,test'),
  off: jest.fn((eventName: string) => mockChartHandlers.delete(eventName)),
  on: jest.fn((eventName: string, handler: (params: unknown) => void) => {
    mockChartHandlers.set(eventName, handler)
  }),
  resize: jest.fn(),
  setOption: jest.fn(),
}

jest.mock('echarts', () => ({
  ...jest.requireActual('echarts'),
  init: jest.fn(() => mockChart),
}))

const result = {
  selectedDates: ['2026-04-15'],
  locationIdentifiers: ['7190', '7191', '7192'],
  recommendation: {
    amPeakTime: '08:00',
    recommendedSchedule: [
      {
        planNumber: 'Free',
        planDescription: 'Free',
        start: '2026-04-15T00:00:00',
        end: '2026-04-15T07:00:00',
      },
      {
        planNumber: '1',
        planDescription: 'Plan 1',
        start: '2026-04-15T07:00:00',
        end: '2026-04-15T09:00:00',
      },
    ],
  },
  planComparison: {
    commonCurrentSchedule: [
      {
        planNumber: 'Free',
        planDescription: 'Free',
        start: '2026-04-15T00:00:00',
        end: '2026-04-15T06:00:00',
      },
      {
        planNumber: '7',
        planDescription: 'Plan 7',
        start: '2026-04-15T06:00:00',
        end: '2026-04-15T09:00:00',
      },
    ],
    exceptionLocationIdentifiers: ['7191', '7192'],
  },
  planProfile: {
    corridorProfile: {
      points: [{ minutes: 480, averageVolume: 3000, smoothedVolume: 2900 }],
    },
    peaks: [
      {
        period: 'AM',
        series: 'Location',
        locationIdentifier: '7190',
        minutes: 480,
        timeOfDay: '08:00',
        value: 2500,
      },
    ],
  },
  splitPressure: {
    primaryProfile: {
      points: [{ minutes: 480, averageVolume: 2400 }],
    },
    crossStreetProfile: {
      points: [{ minutes: 480, averageVolume: 900 }],
    },
    crossTrafficShare: [{ minutes: 480, crossTrafficPercent: 27.3 }],
    crossTrafficLocations: [
      {
        period: 'AM',
        locationIdentifier: '7191',
        minutes: 480,
        peakTime: '08:00',
        totalVehiclesPerHour: 900,
      },
    ],
    movementPressures: [
      {
        period: 'AM',
        locationIdentifier: '7192',
        movementLabel: 'Left',
        peakTime: '08:00',
        volume: 500,
      },
    ],
  },
  locations: [],
} as TimeOfDayResult

describe('TimeOfDayResults unified workspace', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockChartHandlers.clear()
  })

  test('uses top-level chart and location data tabs', () => {
    render(<TimeOfDayResults result={result} />)

    const chartTab = screen.getByRole('tab', {
      name: 'Time-of-Day Chart',
    })
    const locationDataTab = screen.getByRole('tab', { name: 'Location Data' })

    expect(chartTab.getAttribute('aria-selected')).toBe('true')
    expect(
      screen.getByRole('img', {
        name: 'Corridor time-of-day analysis chart',
      })
    ).toBeTruthy()
    expect(
      screen.getByRole('heading', {
        name: 'Corridor Time-of-Day Analysis',
      })
    ).toBeTruthy()
    expect(screen.getByText(/Wed, April 15, 2026/)).toBeTruthy()
    expect(screen.getByText('AM Corridor Peak:')).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Legend' })).toBeTruthy()
    expect(screen.queryByRole('tab', { name: 'Layers' })).toBeNull()

    fireEvent.click(locationDataTab)

    expect(locationDataTab.getAttribute('aria-selected')).toBe('true')
    expect(screen.getByText('Location Supporting Data')).toBeTruthy()
    expect(
      screen.queryByRole('img', {
        name: 'Corridor time-of-day analysis chart',
      })
    ).toBeNull()
  })

  test('switches analysis modes while independently controlling schedule views', () => {
    render(<TimeOfDayResults result={result} />)

    const recommendedToggle = screen.getByRole('button', {
      name: 'Recommended',
    })
    const pressureToggle = screen.getByRole('button', { name: 'Pressure' })
    const proposedSchedule = screen.getByRole('checkbox', {
      name: 'Toggle Proposed schedule',
    })
    const existingSchedule = screen.getByRole('checkbox', {
      name: 'Toggle Existing schedule',
    })

    expect(recommendedToggle.getAttribute('aria-pressed')).toBe('true')
    expect(pressureToggle.getAttribute('aria-pressed')).toBe('false')
    expect((proposedSchedule as HTMLInputElement).checked).toBe(true)
    expect(screen.queryByRole('button', { name: 'Proposed' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Existing' })).toBeNull()
    expect((existingSchedule as HTMLInputElement).checked).toBe(false)
    expect(
      screen.getByRole('checkbox', { name: 'Toggle Median raw volume' })
    ).toHaveProperty('checked', true)
    expect(
      screen.queryByRole('checkbox', { name: 'Toggle Movement pressure' })
    ).toBeNull()

    mockChart.dispatchAction.mockClear()
    mockChart.setOption.mockClear()
    act(() => {
      mockChartHandlers.get('mouseover')?.({
        seriesName: 'Proposed schedule rail',
      })
    })
    expect(mockChart.dispatchAction).toHaveBeenCalledWith({
      type: 'highlight',
      seriesName: 'Proposed schedule rail',
      dataIndex: 0,
    })
    expect(mockChart.setOption).not.toHaveBeenCalled()
    act(() => {
      mockChartHandlers.get('mouseout')?.({
        seriesName: 'Proposed schedule rail',
      })
    })
    expect(mockChart.dispatchAction).toHaveBeenCalledWith({
      type: 'downplay',
      seriesName: 'Proposed schedule rail',
      dataIndex: 0,
    })
    expect(mockChart.setOption).not.toHaveBeenCalled()

    act(() => {
      mockChartHandlers.get('mouseover')?.({
        componentType: 'yAxis',
        value: 'Existing',
      })
    })
    expect(mockChart.dispatchAction).toHaveBeenCalledWith({
      type: 'highlight',
      seriesName: 'Existing schedule rail',
      dataIndex: 0,
    })
    act(() => {
      mockChartHandlers.get('mouseout')?.({
        componentType: 'yAxis',
        value: 'Existing',
      })
    })
    expect(mockChart.dispatchAction).toHaveBeenCalledWith({
      type: 'downplay',
      seriesName: 'Existing schedule rail',
      dataIndex: 0,
    })
    expect(mockChart.setOption).not.toHaveBeenCalled()

    act(() => {
      mockChartHandlers.get('click')?.({
        componentType: 'yAxis',
        value: 'Existing',
      })
    })
    expect((proposedSchedule as HTMLInputElement).checked).toBe(true)
    expect((existingSchedule as HTMLInputElement).checked).toBe(true)
    expect(mockChart.dispatchAction).toHaveBeenCalledWith({
      type: 'legendSelect',
      name: 'Proposed plan windows',
    })
    expect(mockChart.dispatchAction).toHaveBeenCalledWith({
      type: 'legendSelect',
      name: 'Existing plan windows',
    })
    expect(mockChart.dispatchAction).toHaveBeenCalledWith({
      type: 'legendSelect',
      name: 'Proposed schedule rail',
    })
    expect(mockChart.dispatchAction).toHaveBeenCalledWith({
      type: 'legendSelect',
      name: 'Existing schedule rail',
    })
    expect(mockChart.dispatchAction).toHaveBeenCalledWith({
      type: 'legendSelect',
      name: 'Plan difference windows',
    })
    expect(mockChart.setOption).toHaveBeenCalledWith(
      expect.objectContaining({
        series: expect.arrayContaining([
          expect.objectContaining({
            id: 'tod-proposed-plan-windows',
            markArea: expect.objectContaining({
              data: expect.arrayContaining([expect.any(Array)]),
            }),
          }),
          expect.objectContaining({
            id: 'tod-existing-plan-windows',
            markArea: expect.objectContaining({
              data: expect.arrayContaining([expect.any(Array)]),
            }),
          }),
        ]),
      })
    )

    fireEvent.click(pressureToggle)

    expect(pressureToggle.getAttribute('aria-pressed')).toBe('true')
    expect(recommendedToggle.getAttribute('aria-pressed')).toBe('false')
    expect((proposedSchedule as HTMLInputElement).checked).toBe(true)
    expect(
      screen.getByRole('checkbox', { name: 'Toggle Movement pressure' })
    ).toHaveProperty('checked', false)
    expect(
      screen.getByRole('checkbox', { name: 'Toggle Cross-traffic percent' })
    ).toHaveProperty('checked', true)
    expect(mockChart.setOption).toHaveBeenCalledWith(
      expect.objectContaining({
        yAxis: [{}, expect.objectContaining({ show: true })],
      })
    )

    fireEvent.click(recommendedToggle)

    expect(recommendedToggle.getAttribute('aria-pressed')).toBe('true')
    expect(pressureToggle.getAttribute('aria-pressed')).toBe('false')
    expect((proposedSchedule as HTMLInputElement).checked).toBe(true)
    expect((existingSchedule as HTMLInputElement).checked).toBe(true)

    expect(
      screen.getByRole('checkbox', { name: 'Toggle Median raw volume' })
    ).toHaveProperty('checked', true)
    expect(
      screen.queryByRole('checkbox', { name: 'Toggle Movement pressure' })
    ).toBeNull()
    expect(initECharts).toHaveBeenCalledTimes(1)
    fireEvent.click(proposedSchedule)
    expect((proposedSchedule as HTMLInputElement).checked).toBe(false)
    expect((existingSchedule as HTMLInputElement).checked).toBe(true)
    expect(mockChart.dispatchAction).toHaveBeenCalledWith({
      type: 'legendUnSelect',
      name: 'Plan difference windows',
    })
    expect(mockChart.dispatchAction).toHaveBeenCalledWith({
      type: 'legendSelect',
      name: 'Proposed schedule rail',
    })
    const mutedProposedRail = mockChart.setOption.mock.calls
      .flatMap(([update]) => update?.series ?? [])
      .reverse()
      .find((series) => series.id === 'tod-proposed-schedule-rail')
    expect(mutedProposedRail?.silent).toBe(false)
    expect(mutedProposedRail?.cursor).toBe('pointer')
    expect(
      mutedProposedRail?.data.every(
        (datum: unknown[]) => datum[4] === '#94A3B8'
      )
    ).toBe(true)

    act(() => {
      mockChartHandlers.get('click')?.({
        seriesName: 'Proposed schedule rail',
      })
    })
    expect((proposedSchedule as HTMLInputElement).checked).toBe(true)
    act(() => {
      mockChartHandlers.get('click')?.({
        seriesName: 'Proposed schedule rail',
      })
    })
    expect((proposedSchedule as HTMLInputElement).checked).toBe(false)

    act(() => {
      mockChartHandlers.get('click')?.({
        seriesName: 'Existing schedule rail',
      })
    })
    expect((existingSchedule as HTMLInputElement).checked).toBe(false)
    act(() => {
      mockChartHandlers.get('click')?.({
        seriesName: 'Existing schedule rail',
      })
    })
    expect((existingSchedule as HTMLInputElement).checked).toBe(true)

    expect(mockChart.dispose).not.toHaveBeenCalled()
    expect(
      mockChart.setOption.mock.calls.filter(
        ([, settings]) => settings?.notMerge === true
      )
    ).toHaveLength(0)
  })

  test('opens Details and highlights a marker selected from the chart', () => {
    render(<TimeOfDayResults result={result} />)
    const signalPeak = result.planProfile?.peaks?.[0]
    if (!signalPeak) {
      throw new Error('Expected the test signal peak')
    }
    const detailKey = getTimeOfDaySignalPeakDetailKey(signalPeak)

    act(() => {
      mockChartHandlers.get('click')?.({ data: { detailKey } })
    })

    expect(
      screen.getByRole('tab', { name: 'Details' }).getAttribute('aria-selected')
    ).toBe('true')
    const peakTable = screen.getByRole('table', {
      name: 'AM Signal Peaks peak list',
    })
    const selectedRow = within(peakTable)
      .getAllByRole('row')
      .find((row) => row.getAttribute('aria-selected') === 'true')
    expect(selectedRow).toBeTruthy()
    expect(mockChart.dispatchAction).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'highlight',
        seriesName: 'AM Signal Peaks',
      })
    )

    mockChart.dispatchAction.mockClear()
    const crossTrafficTable = screen.getByRole('table', {
      name: 'AM Cross Traffic Locations cross traffic locations',
    })
    fireEvent.click(within(crossTrafficTable).getAllByRole('row')[1])

    expect(
      screen
        .getByRole('button', { name: 'Recommended' })
        .getAttribute('aria-pressed')
    ).toBe('false')
    expect(
      screen
        .getByRole('button', { name: 'Pressure' })
        .getAttribute('aria-pressed')
    ).toBe('true')
    expect(mockChart.dispatchAction).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'highlight',
        seriesName: 'AM Cross Traffic Locations',
      })
    )
  })
})
