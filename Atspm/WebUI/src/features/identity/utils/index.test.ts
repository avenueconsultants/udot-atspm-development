// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - index.test.ts
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
import Cookies from 'js-cookie'
import { doesUserHaveAccess, setSecureCookie } from './index'

jest.mock('js-cookie', () => ({
  __esModule: true,
  default: { get: jest.fn(), set: jest.fn() },
}))

describe('doesUserHaveAccess', () => {
  afterEach(() => {
    jest.resetAllMocks()
  })

  it('returns false when the loggedIn cookie is absent', () => {
    ;(Cookies.get as jest.Mock).mockReturnValue(undefined)
    expect(doesUserHaveAccess()).toBe(false)
  })

  it('returns false when logged in but there are no claims', () => {
    ;(Cookies.get as jest.Mock).mockImplementation((name: string) =>
      name === 'loggedIn' ? 'True' : undefined
    )
    expect(doesUserHaveAccess()).toBe(false)
  })

  it('returns true when logged in and claims are present', () => {
    ;(Cookies.get as jest.Mock).mockImplementation((name: string) => {
      if (name === 'loggedIn') return 'True'
      if (name === 'claims') return 'admin,editor'
      return undefined
    })
    expect(doesUserHaveAccess()).toBe(true)
  })
})

describe('setSecureCookie', () => {
  afterEach(() => {
    jest.resetAllMocks()
  })

  it('applies secure-by-default and a 1-day expiration', () => {
    setSecureCookie('token', 'abc123')

    expect(Cookies.set).toHaveBeenCalledWith('token', 'abc123', {
      secure: true,
      expires: 1,
    })
  })

  it('lets explicit options override the defaults', () => {
    setSecureCookie('token', 'abc123', { secure: false, expires: 7 })

    expect(Cookies.set).toHaveBeenCalledWith('token', 'abc123', {
      secure: false,
      expires: 7,
    })
  })

  it('merges partial overrides with the remaining defaults', () => {
    setSecureCookie('token', 'abc123', { sameSite: 'Strict' })

    expect(Cookies.set).toHaveBeenCalledWith('token', 'abc123', {
      secure: true,
      expires: 1,
      sameSite: 'Strict',
    })
  })
})
