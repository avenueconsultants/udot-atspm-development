import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

import AuditBadge from './AuditInfo'

// Computed independently of the dateTime helpers the badge uses, so a
// regression there cannot move the expected value along with the actual one.
const pad2 = (n: number) => String(n).padStart(2, '0')
const localDateStamp = (date: Date) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`

describe('AuditBadge', () => {
  it('shows the last modification as a local calendar date with the editor', () => {
    const modified = '2026-05-21T02:30:00+00:00'

    render(
      <AuditBadge
        obj={{
          created: '2026-05-20T20:30:00-06:00',
          createdBy: 'author',
          modified,
          modifiedBy: 'editor',
        }}
      />
    )

    expect(
      screen.getByText(`Updated ${localDateStamp(new Date(modified))} • editor`)
    ).toBeInTheDocument()
  })

  it('falls back to the creation info when nothing has been modified', () => {
    const created = '2026-05-20T20:30:00-06:00'

    render(<AuditBadge obj={{ created, createdBy: 'author' }} />)

    expect(
      screen.getByText(`Created ${localDateStamp(new Date(created))} • author`)
    ).toBeInTheDocument()
  })

  it('says so when there is no history at all', () => {
    render(<AuditBadge obj={{}} />)

    expect(screen.getByText('No history available')).toBeInTheDocument()
  })
})
