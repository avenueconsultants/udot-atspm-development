// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - pagesCheck.test.ts
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
import { renderHook } from '@testing-library/react'
import Cookies from 'js-cookie'
import {
  PageNames,
  useGetAdminPagesList,
  useSideBarPermission,
  useUserHasClaim,
  useViewPage,
} from './pagesCheck'

jest.mock('js-cookie', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}))

jest.mock('next/router', () => ({
  __esModule: true,
  useRouter: () => ({}),
}))

const setCookie = (claims: string | undefined, loggedIn = 'true') => {
  ;(Cookies.get as jest.Mock).mockImplementation((name: string) => {
    if (name === 'claims') return claims
    if (name === 'loggedIn') return loggedIn
    return undefined
  })
}

beforeEach(() => {
  ;(Cookies.get as jest.Mock).mockReset()
})

describe('useGetAdminPagesList', () => {
  it('returns an empty map when there are no claims', () => {
    setCookie(undefined)
    const { result } = renderHook(() => useGetAdminPagesList())
    expect(result.current.size).toBe(0)
  })

  it('grants every admin page when the claims include "admin", case-insensitively', () => {
    setCookie('Admin')
    const { result } = renderHook(() => useGetAdminPagesList())

    expect(result.current.get(PageNames.Roles)).toBe('/admin/roles')
    expect(result.current.get(PageNames.Users)).toBe('/admin/users')
    expect(result.current.get(PageNames.FAQs)).toBe('/admin/faq')
  })

  it("grants only the pages matching the user's specific claims", () => {
    setCookie('Role:View,User:View')
    const { result } = renderHook(() => useGetAdminPagesList())

    expect(result.current.get(PageNames.Roles)).toBe('/admin/roles')
    expect(result.current.get(PageNames.Users)).toBe('/admin/users')
    expect(result.current.has(PageNames.FAQs)).toBe(false)
  })

  it('matches claims case-insensitively', () => {
    setCookie('role:view')
    const { result } = renderHook(() => useGetAdminPagesList())

    expect(result.current.get(PageNames.Roles)).toBe('/admin/roles')
  })
})

// jsdom (this version) makes window.location fully non-configurable, so it
// can't be spied on or swapped out - `.replace()`/`href =` calls below are
// real, hit jsdom's "Not implemented: navigation" path, and are asserted on
// indirectly via the hook's other state instead of the call itself.
describe('useViewPage', () => {
  let consoleError: jest.SpyInstance

  beforeEach(() => {
    consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
  })

  afterEach(() => {
    consoleError.mockRestore()
  })

  it('never stops loading when there is no session (redirects to login)', () => {
    setCookie(undefined, undefined)
    const { result } = renderHook(() => useViewPage(PageNames.Roles))

    expect(result.current.isLoading).toBe(true)
  })

  it('never stops loading when logged in but missing the page permission (redirects to unauthorized)', () => {
    setCookie('User:View', 'true')
    const { result } = renderHook(() => useViewPage(PageNames.Roles))

    expect(result.current.isLoading).toBe(true)
  })

  it('stops loading without redirecting when the user can view the page', () => {
    setCookie('Role:View', 'true')
    const { result } = renderHook(() => useViewPage(PageNames.Roles))

    expect(result.current.isLoading).toBe(false)
  })
})

describe('useSideBarPermission', () => {
  let consoleError: jest.SpyInstance

  beforeEach(() => {
    consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
  })

  afterEach(() => {
    consoleError.mockRestore()
  })

  it('grants permission when the claim matches, case-insensitively', () => {
    setCookie('watchdog:view')
    const { result } = renderHook(() => useSideBarPermission('Watchdog:View'))
    expect(result.current).toBe(true)
  })

  it('grants permission to admins regardless of the specific claim', () => {
    setCookie('Admin')
    const { result } = renderHook(() => useSideBarPermission('Watchdog:View'))
    expect(result.current).toBe(true)
  })

  it('denies permission when the claim is missing, whether or not a redirect is requested', () => {
    setCookie('User:View')
    const { result: withoutRedirect } = renderHook(() =>
      useSideBarPermission('Watchdog:View')
    )
    expect(withoutRedirect.current).toBe(false)

    const { result: withRedirect } = renderHook(() =>
      useSideBarPermission('Watchdog:View', true)
    )
    expect(withRedirect.current).toBe(false)
  })
})

describe('useUserHasClaim', () => {
  it('matches an exact claim from the comma-separated cookie', () => {
    setCookie('Role:View,User:View')
    const { result } = renderHook(() => useUserHasClaim('User:View'))
    expect(result.current).toBe(true)
  })

  it('grants access to a literal "Admin" claim regardless of the requested claim', () => {
    setCookie('Admin')
    const { result } = renderHook(() => useUserHasClaim('User:View'))
    expect(result.current).toBe(true)
  })

  it('matches claims case-insensitively, like the other permission hooks', () => {
    setCookie('user:view')
    const { result } = renderHook(() => useUserHasClaim('User:View'))
    expect(result.current).toBe(true)
  })

  it('denies access when the claim is absent', () => {
    setCookie('Role:View')
    const { result } = renderHook(() => useUserHasClaim('User:View'))
    expect(result.current).toBe(false)
  })
})
