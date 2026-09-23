import { getGetMenuItemsQueryKey } from '@/api/config'
import { getGetProfileProfileQueryKey } from '@/api/identity'
import { queryClient as appQueryClient } from '@/lib/react-query'
import { CONFIG_API, IDENTITY_API, odataCollection } from '@/test/fixtures/api'
import { server } from '@/test/msw/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Cookies from 'js-cookie'
import { http, HttpResponse } from 'msw'
import Layout from './layout'

// Sidebar needs feature flags and routing; keep the real top bar and user menu.
jest.mock('@/components/sidebar/Sidebar', () => ({
  __esModule: true,
  default: () => null,
}))

jest.mock('@/components/toast', () => ({
  __esModule: true,
  default: () => null,
}))

describe('navigation request failures', () => {
  afterEach(() => {
    Cookies.remove('loggedIn')
    jest.restoreAllMocks()
  })

  it.each(['menu', 'profile'] as const)(
    'keeps controls usable after a %s failure and displays recovered data',
    async (failedRequest) => {
      const user = userEvent.setup()
      const loggedIn = failedRequest === 'profile'
      if (loggedIn) Cookies.set('loggedIn', 'True')
      // A regressed layout catches and logs the query error, then hides its nav.
      jest.spyOn(console, 'error').mockImplementation(() => undefined)
      const client = new QueryClient({
        defaultOptions: appQueryClient.getDefaultOptions(),
      })
      let recovered = false
      const unavailable = () =>
        HttpResponse.json({ title: 'Unavailable' }, { status: 503 })
      server.use(
        http.get(`${CONFIG_API}/MenuItems`, () =>
          failedRequest === 'menu' && !recovered
            ? unavailable()
            : HttpResponse.json(
                odataCollection('MenuItems', [
                  { id: 1, name: 'Reports', parentId: null, link: '/reports' },
                ])
              )
        ),
        http.get(`${IDENTITY_API}/Profile`, () =>
          failedRequest === 'profile' && !recovered
            ? unavailable()
            : HttpResponse.json({ firstName: 'Jane', lastName: 'Doe' })
        )
      )
      const queryKey =
        failedRequest === 'menu'
          ? getGetMenuItemsQueryKey()
          : getGetProfileProfileQueryKey()
      const page = (text: string) => (
        <QueryClientProvider client={client}>
          <Layout>
            <div>{text}</div>
          </Layout>
        </QueryClientProvider>
      )
      const view = render(page('First page'))

      try {
        await waitFor(() =>
          expect(client.getQueryState(queryKey)?.status).toBe('error')
        )
        expect(screen.getByAltText('ATSPM Logo')).toBeInTheDocument()
        expect(
          screen.getByRole('button', { name: 'Open navigation menu' })
        ).toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: 'User Menu' }))
        expect(
          await screen.findByRole('menuitem', {
            name: loggedIn ? 'Log out' : 'Log in',
          })
        ).toBeInTheDocument()
        await user.keyboard('{Escape}')

        recovered = true
        await act(async () => {
          await client.refetchQueries({ queryKey, type: 'all' })
        })
        view.rerender(page('Second page'))

        expect(await screen.findByText('Reports')).toBeInTheDocument()
        if (loggedIn) expect(await screen.findByText('JD')).toBeInTheDocument()
        expect(screen.getByText('Second page')).toBeInTheDocument()
        expect(
          screen.getByRole('button', { name: 'User Menu' })
        ).toBeInTheDocument()
      } finally {
        view.unmount()
        client.clear()
      }
    }
  )
})
