import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { createGpxUploadEntry, GpxUploadComponent } from './GpxUploadComponent'

// nanoid ships only as an ES module, which Jest can't load.
let mockLastId = 0
jest.mock('nanoid', () => ({ nanoid: () => `upload-${++mockLastId}` }))

const Uploads = () => {
  const [entries, setEntries] = useState([createGpxUploadEntry(true)])
  return (
    <GpxUploadComponent
      tracks={[]}
      startEndLocations={[]}
      entries={entries}
      setEntries={setEntries}
    />
  )
}

describe('GpxUploadComponent', () => {
  it('keeps the first row as the primary track and lets added rows be removed', () => {
    render(<Uploads />)

    screen.getByText('Primary track')
    expect(screen.queryByLabelText('Remove GPX')).toBeNull()

    fireEvent.click(screen.getByText('Add another GPX'))
    screen.getByText('Additional track')
    fireEvent.click(screen.getByLabelText('Remove GPX'))

    expect(screen.queryByText('Additional track')).toBeNull()
    screen.getByText('Primary track')
  })
})
