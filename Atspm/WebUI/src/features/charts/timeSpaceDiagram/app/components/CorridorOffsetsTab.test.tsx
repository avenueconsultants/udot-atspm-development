import type { Route } from '@/features/routes/types'
import { reportsRequest } from '@/lib/axios'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from 'react-query'
import CorridorOffsetsTab from './CorridorOffsetsTab'

jest.mock('@/lib/axios', () => ({ reportsRequest: jest.fn() }))

jest.mock('@/features/charts/components/apacheEChart/ApacheEChart', () => ({
  __esModule: true,
  default: () => <div>Corridor trajectory chart</div>,
}))

test('posts requests to the corridor report and renders the coverage error', async () => {
  const request = jest.mocked(reportsRequest)
  request.mockRejectedValue({
    isAxiosError: true,
    response: {
      data: 'Signal 4164 has no controller events in the selected window.',
    },
  })
  const routes: Route[] = [
    { id: 220, name: 'R2: 7000 S Redwood to 7800 S', routeLocations: [] },
  ]
  render(
    <QueryClientProvider client={new QueryClient()}>
      <CorridorOffsetsTab routes={routes} />
    </QueryClientProvider>
  )

  expect(
    screen
      .getByRole('button', { name: 'Find corridor offsets' })
      .hasAttribute('disabled')
  ).toBe(true)
  fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Route' }))
  fireEvent.click(await screen.findByRole('option', { name: routes[0].name }))
  fireEvent.change(screen.getByLabelText(/^Date/), {
    target: { value: '2026-11-20' },
  })
  fireEvent.change(screen.getByLabelText('Fallback speed (mph)'), {
    target: { value: '35' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Find corridor offsets' }))

  await waitFor(() =>
    expect(request).toHaveBeenCalledWith({
      method: 'POST',
      url: '/api/v1/CorridorOffsets/GetReportData',
      data: {
        routeId: 220,
        start: '2026-11-20T16:00:00',
        end: '2026-11-20T16:30:00',
        speedLimit: 35,
        maxShift: 30,
        maxDirectionalIncrease: null,
        lockedSignals: [],
        compareLinkPivot: true,
      },
    })
  )
  expect(
    await screen.findByText(/Signal 4164 has no controller events/)
  ).toBeTruthy()
  expect(screen.queryByText('Corridor trajectory chart')).toBeNull()
})
