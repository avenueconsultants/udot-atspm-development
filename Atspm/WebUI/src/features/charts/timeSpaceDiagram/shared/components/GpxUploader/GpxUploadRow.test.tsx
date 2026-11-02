import { fireEvent, render, screen, within } from '@testing-library/react'
import { GpxUploadRow } from './GpxUploadRow'

const renderRow = (
  startEndLocations: string[],
  onChange: jest.Mock = jest.fn()
) =>
  render(
    <GpxUploadRow
      entry={{ id: 'upload-1', primary: true }}
      index={0}
      startEndLocations={startEndLocations}
      canDelete={false}
      onDelete={jest.fn()}
      onChange={onChange}
    />
  )

describe('GpxUploadRow', () => {
  it('hides Start and End when the signals have map positions', () => {
    renderRow([])

    expect(screen.queryByLabelText('Start')).toBeNull()
    expect(screen.queryByLabelText('End')).toBeNull()
  })

  it('offers Start and End, defaulting to the first and last signal, when the signals have no map positions', () => {
    const onChange = jest.fn()
    renderRow(['7000', '7001', '7002'], onChange)

    screen.getByText(/placed by distance driven from Start/)
    expect(screen.getByLabelText('Start').textContent).toBe('7000')
    expect(screen.getByLabelText('End').textContent).toBe('7002')

    fireEvent.mouseDown(screen.getByLabelText('Start'))
    fireEvent.click(
      within(screen.getByRole('listbox')).getByRole('option', { name: '7001' })
    )

    expect(onChange).toHaveBeenCalledWith({ startLocation: '7001' })
  })
})
