// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - Topbar.test.tsx
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
import { doesUserHaveAccess } from '@/features/identity/utils'
import { server } from '@/test/msw/server'
import { renderWithProviders, screen } from '@/test/test-utils'
import { HttpResponse, http } from 'msw'
import Topbar from './Topbar'

// Regression test for a real bug: Topbar fetched /MenuItems unconditionally,
// even when logged out. The config API then 401s, and since React Query
// defaults to throwOnError app-wide with no error boundary around Topbar,
// that crashed the whole page. Fixed with `throwOnError: false` on the
// query - deliberately NOT `enabled: <cookie flag>`, which was tried first
// and reverted: it made the nav flash empty -> hidden -> populated on every
// authenticated load (isLoading flips true the instant `enabled` turns on),
// and using `userHasAccess` (which requires claims) rather than a plain
// logged-in check hid the nav entirely for claims-less logged-in users.
// These tests exercise the real hook against a mocked HTTP response rather
// than a stubbed hook, since a stubbed `isLoading`/`enabled` return value
// can't actually detect either failure mode.
jest.mock('@/features/identity/utils', () => ({
  __esModule: true,
  doesUserHaveAccess: jest.fn(),
}))

jest.mock('@/stores/sidebar', () => ({
  __esModule: true,
  useSidebarStore: () => ({ toggleSidebar: jest.fn() }),
}))

jest.mock('@/components/topbar/AdminMenu', () => ({
  __esModule: true,
  default: () => <div>Admin Menu</div>,
}))

jest.mock('./DropdownButton', () => ({
  __esModule: true,
  default: ({ title }: { title: string }) => <div>{title}</div>,
}))

jest.mock('./UserMenu', () => ({
  __esModule: true,
  default: () => <div>User Menu</div>,
}))

describe('Topbar', () => {
  beforeEach(() => {
    ;(doesUserHaveAccess as jest.Mock).mockReset().mockReturnValue(false)
  })

  it('does not crash and still renders the nav chrome when /MenuItems 401s (logged out)', async () => {
    // See the matching test in UserMenu.test.tsx for why this listens for a
    // window error event rather than using findBy*/act(): the crash surfaces
    // through an XHR event-handler callback, not a synchronous React render
    // throw, so neither approach reliably observes it.
    const onWindowError = jest.fn()
    window.addEventListener('error', onWindowError)

    server.use(
      http.get('*/MenuItems', () =>
        HttpResponse.json({ title: 'Unauthorized' }, { status: 401 })
      )
    )

    renderWithProviders(<Topbar />)
    await new Promise((resolve) => setTimeout(resolve, 150))
    window.removeEventListener('error', onWindowError)

    expect(onWindowError).not.toHaveBeenCalled()
    expect(screen.getByText('User Menu')).toBeInTheDocument()
    expect(screen.getByText('Info')).toBeInTheDocument()
  })

  it('renders the fetched menu items once the request succeeds', async () => {
    ;(doesUserHaveAccess as jest.Mock).mockReturnValue(true)
    server.use(
      http.get('*/MenuItems', () =>
        HttpResponse.json([
          { id: 1, name: 'Reports', parentId: null, link: '/reports' },
        ])
      )
    )

    renderWithProviders(<Topbar />)

    expect(await screen.findByText('Reports')).toBeInTheDocument()
    expect(screen.getByText('Admin Menu')).toBeInTheDocument()
  })
})
