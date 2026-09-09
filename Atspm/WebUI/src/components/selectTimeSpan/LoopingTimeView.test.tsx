import '@testing-library/jest-dom'
import { fireEvent, render, screen, within } from '@testing-library/react'
import LoopingTimeView from './LoopingTimeView'

it('selects 24-hour times and wraps the scrolling columns', () => {
  const onChange = jest.fn()
  render(
    <LoopingTimeView
      value={new Date(2026, 8, 1, 7, 30)}
      onChange={onChange}
      view="hours"
      views={['hours', 'minutes']}
    />
  )
  expect(
    screen.queryByRole('listbox', { name: 'AM/PM' })
  ).not.toBeInTheDocument()
  const hours = screen.getByRole('listbox', { name: 'Hours' })
  fireEvent.click(within(hours).getAllByRole('option', { name: '19' })[2])
  expect(onChange).toHaveBeenLastCalledWith(
    new Date(2026, 8, 1, 19, 30),
    'partial',
    'hours'
  )
  fireEvent.click(within(hours).getAllByRole('option', { name: '00' })[2])
  expect(onChange).toHaveBeenLastCalledWith(
    new Date(2026, 8, 1, 0, 30),
    'partial',
    'hours'
  )

  for (const [label, count] of [
    ['Hours', 24],
    ['Minutes', 60],
  ] as const) {
    const list = screen.getByRole('listbox', { name: label })
    list.scrollTop = count * 40 * 3 + 10
    fireEvent.scroll(list)
    expect(list.scrollTop).toBe(count * 40 * 2 + 10)
    list.scrollTop = 10
    fireEvent.scroll(list)
    expect(list.scrollTop).toBe(count * 40 * 2 + 10)
  }
  const minutes = screen.getByRole('listbox', { name: 'Minutes' })
  fireEvent.click(within(minutes).getAllByRole('option', { name: '59' })[2])
  expect(onChange).toHaveBeenLastCalledWith(
    new Date(2026, 8, 1, 7, 59),
    'partial',
    'minutes'
  )
})

it('preserves minimum time restrictions and keyboard wrapping', () => {
  render(
    <LoopingTimeView
      value={new Date(2026, 8, 1, 7, 30)}
      minTime={new Date(2026, 8, 1, 7, 15)}
      view="hours"
      views={['hours', 'minutes']}
    />
  )
  const minutes = screen.getByRole('listbox', { name: 'Minutes' })
  expect(
    within(minutes).getAllByRole('option', { name: '14' })[2]
  ).toHaveAttribute('aria-disabled', 'true')
  const last = within(minutes).getAllByRole('option', { name: '59' })[2]
  fireEvent.keyDown(last, { key: 'ArrowDown' })
  expect(
    within(minutes).getAllByRole('option', { name: '15' })[2]
  ).toHaveFocus()
})
