// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - UserMenu.test.tsx
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//http://www.apache.org/licenses/LICENSE-2.
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
// #endregion
import { server } from '@/test/msw/server'
import { renderWithProviders, screen } from '@/test/test-utils'
import { HttpResponse, http } from 'msw'
import Cookies from 'js-cookie'
import UserMenu from './UserMenu'

// Regression test for the same class of bug fixed in Topbar (see its test
// file for the full history): UserMenu fetched /Profile unconditionally, so
// a logged-out 401 crashed the page under this app's throwOnError:true
// React Query default. Fixed with `throwOnError: false` rather than an
// `enabled` gate, since gating caused a separate flicker regression. These
// tests exercise the real hook against a mocked HTTP response so they can
// actually detect a crash, rather than a stubbed hook that can't.
jest.mock('@/stores/sidebar', () => ({
  __esModule: true,
  useSidebarStore: () => ({ closeSideBar: jest.fn() }),
}))

jest.mock('js-cookie', () => ({
  __esModule: true,
  default: { get: jest.fn(), remove: jest.fn() },
}))

describe('UserMenu', () => {
  beforeEach(() => {
    ;(Cookies.get as jest.Mock).mockReset().mockReturnValue(undefined)
  })

  it('does not crash and still renders the menu icon when /Profile 401s (logged out)', async () => {
    // A crash here doesn't throw synchronously during React's render (it
    // propagates through an XHR event-handler callback), so neither a plain
    // `findBy*` (which stops watching after its first successful match,
    // before the crash lands) nor act()-wrapping observes it reliably.
    // jsdom does report it as a genuine `window` error event, which this
    // listens for directly.
    const onWindowError = jest.fn()
    window.addEventListener('error', onWindowError)

    server.use(
      http.get('*/Profile', () =>
        HttpResponse.json({ title: 'Unauthorized' }, { status: 401 })
      )
    )

    renderWithProviders(<UserMenu />)
    await new Promise((resolve) => setTimeout(resolve, 150))
    window.removeEventListener('error', onWindowError)

    expect(onWindowError).not.toHaveBeenCalled()
    expect(
      screen.getByRole('button', { name: 'User Menu' })
    ).toBeInTheDocument()
  })

  it('shows the user\'s initials once the profile loads while logged in', async () => {
    ;(Cookies.get as jest.Mock).mockImplementation((name: string) =>
      name === 'loggedIn' ? 'True' : undefined
    )
    server.use(
      http.get('*/Profile', () =>
        HttpResponse.json({ firstName: 'Jane', lastName: 'Doe' })
      )
    )

    renderWithProviders(<UserMenu />)

    expect(await screen.findByText('JD')).toBeInTheDocument()
  })
})
