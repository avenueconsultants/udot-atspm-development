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
        onToggleScheduleView={jest.fn()}
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
