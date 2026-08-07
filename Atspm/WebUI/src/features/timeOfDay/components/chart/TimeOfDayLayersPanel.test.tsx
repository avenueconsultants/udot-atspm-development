import { fireEvent, render, screen } from '@testing-library/react'
import type { TimeOfDayChartLayer } from '../../transformers'
import TimeOfDayLayersPanel from './TimeOfDayLayersPanel'

const directionalSeriesNames = [
  'Eastbound total profile',
  'Northbound total profile',
  'Southbound total profile',
  'Westbound total profile',
]

const directionalColors = ['#00897b', '#7b1fa2', '#f57c00', '#5d4037']

const directionalProfilesLayer: TimeOfDayChartLayer = {
  id: 'directional-profiles',
  group: 'Corridor Demand',
  label: 'Directional profiles',
  description: 'Representative directional volume profiles.',
  preview: 'dashed-line',
  color: directionalColors[0],
  additionalColors: directionalColors.slice(1),
  seriesNames: directionalSeriesNames,
  seriesControls: directionalSeriesNames.map((seriesName, index) => ({
    seriesName,
    label: seriesName,
    color: directionalColors[index],
    available: true,
  })),
  available: true,
}

describe('TimeOfDayLayersPanel directional profiles', () => {
  test('expands one combined item into parent and per-direction checkboxes', () => {
    const onSetSeriesVisibility = jest.fn()

    render(
      <TimeOfDayLayersPanel
        layers={[directionalProfilesLayer]}
        selectedSeries={Object.fromEntries(
          directionalSeriesNames.map((seriesName) => [seriesName, true])
        )}
        onSetSeriesVisibility={onSetSeriesVisibility}
      />
    )

    const parentCheckbox = screen.getByRole('checkbox', {
      name: 'Toggle Directional profiles',
    })
    expect(parentCheckbox).toHaveProperty('checked', true)
    directionalSeriesNames.forEach((seriesName) => {
      expect(
        screen.queryByRole('checkbox', { name: `Toggle ${seriesName}` })
      ).toBeNull()
    })

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Show Directional profiles details',
      })
    )

    directionalSeriesNames.forEach((seriesName) => {
      expect(
        screen.getByRole('checkbox', { name: `Toggle ${seriesName}` })
      ).toHaveProperty('checked', true)
    })

    fireEvent.click(
      screen.getByRole('checkbox', {
        name: 'Toggle Northbound total profile',
      })
    )
    expect(onSetSeriesVisibility).toHaveBeenLastCalledWith(
      ['Northbound total profile'],
      false
    )

    fireEvent.click(parentCheckbox)
    expect(onSetSeriesVisibility).toHaveBeenLastCalledWith(
      directionalSeriesNames,
      false
    )
  })
})

const scheduleSeriesNames = [
  'Proposed plan windows',
  'Proposed schedule rail',
  'Existing plan windows',
  'Existing schedule rail',
  'Plan difference windows',
]

const schedulesLayer: TimeOfDayChartLayer = {
  id: 'schedules',
  group: 'Schedules',
  label: 'Schedules',
  description:
    'Proposed and existing timing-plan windows. Expand for the color and hatch key.',
  preview: 'schedule',
  color: '#ef6c00',
  additionalColors: ['#2e7d32', '#1565c0'],
  seriesNames: scheduleSeriesNames,
  legendItems: [
    { label: 'AM peak plan', color: '#ef6c00', preview: 'area' },
    { label: 'Midday plan', color: '#2e7d32', preview: 'area' },
    { label: 'PM peak plan', color: '#1565c0', preview: 'area' },
    { label: 'FREE operation', color: '#607d8b', preview: 'area' },
    {
      label: 'Proposed and existing schedules differ',
      color: '#f59e0b',
      preview: 'hatch',
    },
  ],
  available: true,
}

describe('TimeOfDayLayersPanel schedules', () => {
  test('explains schedule colors and hatching without per-item toggles', () => {
    const onSetSeriesVisibility = jest.fn()

    render(
      <TimeOfDayLayersPanel
        layers={[schedulesLayer]}
        selectedSeries={Object.fromEntries(
          scheduleSeriesNames.map((seriesName) => [seriesName, true])
        )}
        onSetSeriesVisibility={onSetSeriesVisibility}
      />
    )

    const parentCheckbox = screen.getByRole('checkbox', {
      name: 'Toggle Schedules',
    })
    expect(parentCheckbox).toHaveProperty('checked', true)

    fireEvent.click(
      screen.getByRole('button', { name: 'Show Schedules details' })
    )

    schedulesLayer.legendItems?.forEach(({ label }) => {
      expect(screen.getByText(label)).toBeTruthy()
      expect(
        screen.queryByRole('checkbox', { name: `Toggle ${label}` })
      ).toBeNull()
    })

    expect(screen.getAllByRole('checkbox')).toHaveLength(1)
    fireEvent.click(parentCheckbox)
    expect(onSetSeriesVisibility).toHaveBeenLastCalledWith(
      scheduleSeriesNames,
      false
    )
  })
})
