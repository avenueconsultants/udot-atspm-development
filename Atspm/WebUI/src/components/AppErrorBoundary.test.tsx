import { useGetArea } from '@/api/config'
import { CONFIG_API, odataCollection } from '@/test/fixtures/api'
import { server } from '@/test/msw/server'
import {
  renderWithProviders,
  screen,
  userEvent,
  waitFor,
} from '@/test/test-utils'
import { http, HttpResponse } from 'msw'
import { AppErrorBoundary } from './AppErrorBoundary'

function AreasPage() {
  const { data } = useGetArea()
  return <div>{data?.[0]?.name}</div>
}

describe('AppErrorBoundary', () => {
  beforeEach(() => {
    // React logs errors caught by the boundary; these failures are intentional.
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => jest.restoreAllMocks())

  it('allows another retry when the first retry also fails', async () => {
    const user = userEvent.setup()
    let requests = 0
    server.use(
      http.get(`${CONFIG_API}/Area`, () => {
        requests++
        return requests < 3
          ? HttpResponse.json({ title: 'Unavailable' }, { status: 503 })
          : HttpResponse.json(
              odataCollection('Area', [{ id: 1, name: 'Recovered area' }])
            )
      })
    )

    renderWithProviders(
      <AppErrorBoundary resetKey="/admin/areas">
        <AreasPage />
      </AppErrorBoundary>
    )

    await user.click(await screen.findByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(requests).toBe(2))
    await user.click(await screen.findByRole('button', { name: 'Try again' }))

    expect(await screen.findByText('Recovered area')).toBeInTheDocument()
    expect(requests).toBe(3)
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument()
  })

  it('retries a cached query error when navigation resets the boundary', async () => {
    let requests = 0
    server.use(
      http.get(`${CONFIG_API}/Area`, () => {
        requests++
        return requests === 1
          ? HttpResponse.json({ title: 'Unavailable' }, { status: 503 })
          : HttpResponse.json(
              odataCollection('Area', [{ id: 1, name: 'Recovered area' }])
            )
      })
    )
    const page = (resetKey: string) => (
      <AppErrorBoundary resetKey={resetKey}>
        <AreasPage />
      </AppErrorBoundary>
    )
    const view = renderWithProviders(page('/admin/areas'))

    await screen.findByRole('button', { name: 'Try again' })
    view.rerender(page('/admin/areas?view=details'))

    expect(await screen.findByText('Recovered area')).toBeInTheDocument()
    expect(requests).toBe(2)
  })
})
