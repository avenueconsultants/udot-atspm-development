import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFnsV3'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import SelectDateTime from './SelectTimeSpan'

function Harness({ singleDay = true }) {
  const [start, setStart] = useState(new Date(2026, 8, 1))
  const [end, setEnd] = useState(new Date(2026, 8, 1, 23, 59))
  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <SelectDateTime
        singleDay={singleDay}
        noCalendar
        startDateTime={start}
        endDateTime={end}
        changeStartDate={setStart}
        changeEndDate={setEnd}
      />
    </LocalizationProvider>
  )
}

it('shows custom time inputs and restores the all-day range', async () => {
  const user = userEvent.setup()
  render(<Harness />)
  expect(screen.getByRole('radio', { name: 'All day' })).toBeChecked()
  expect(screen.queryByLabelText('End')).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Start time')).not.toBeInTheDocument()
  await user.click(screen.getByRole('radio', { name: 'Custom' }))
  expect(screen.getByLabelText('Start time')).toHaveValue('12:00')
  expect(screen.getByLabelText('End time')).toHaveValue('14:00')
  await user.click(screen.getByRole('radio', { name: 'All day' }))
  expect(screen.queryByLabelText('Start time')).not.toBeInTheDocument()
  await user.click(screen.getByRole('radio', { name: 'Custom' }))
  await user.click(screen.getByRole('button', { name: 'Reset' }))
  expect(screen.getByRole('radio', { name: 'All day' })).toBeChecked()
})

it('keeps the existing date range controls for other pages', () => {
  render(<Harness singleDay={false} />)
  expect(screen.getByLabelText('Start')).toBeInTheDocument()
  expect(screen.getByLabelText('End')).toBeInTheDocument()
  expect(screen.queryByRole('radio')).not.toBeInTheDocument()
})
