// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - ChangePasswordHandler.test.tsx
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
import { act, renderHook } from '@testing-library/react'
import Cookies from 'js-cookie'
import {
  useChangePasswordHandler,
  useVerifyTokenHandler,
} from './ChangePasswordHandler'

const changePassword = jest.fn()
const verifyResetToken = jest.fn()
let mutationState: { status: string; data?: unknown } = { status: 'idle' }
let verifyState: { status: string; data?: unknown } = { status: 'idle' }
let asPath = '/change-password'

jest.mock('@/api/identity/atspmAuthenticationApi', () => ({
  __esModule: true,
  useGetAccountChangePassword: () => ({
    mutate: changePassword,
    ...mutationState,
  }),
  useDeleteTokenVerifyResetToken: () => ({
    mutate: verifyResetToken,
    ...verifyState,
  }),
}))

jest.mock('@/features/identity/utils', () => ({
  __esModule: true,
  setSecureCookie: jest.fn(),
}))

jest.mock('next/router', () => ({
  __esModule: true,
  useRouter: () => ({ asPath }),
}))

jest.mock('js-cookie', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}))

const submitEvent = {
  preventDefault: jest.fn(),
} as unknown as React.FormEvent<HTMLFormElement>

describe('useChangePasswordHandler', () => {
  beforeEach(() => {
    changePassword.mockReset()
    mutationState = { status: 'idle' }
  })

  it('enforces the same password complexity rules as registration', () => {
    const { result } = renderHook(() =>
      useChangePasswordHandler({ resetToken: 'token-123' })
    )

    act(() => result.current.savePassword('short'))
    expect(result.current.validatePassword()).toBe(
      'Password should be at least 8 characters long.'
    )

    act(() => result.current.savePassword('nouppercase1!'))
    expect(result.current.validatePassword()).toBe(
      'Password should contain at least one uppercase letter, one digit, and one symbol.'
    )

    act(() => result.current.savePassword('Valid123!'))
    expect(result.current.validatePassword()).toBeNull()
  })

  it('requires the confirmation password to match', () => {
    const { result } = renderHook(() =>
      useChangePasswordHandler({ resetToken: 'token-123' })
    )

    act(() => {
      result.current.savePassword('Valid123!')
      result.current.saveConfirmPassword('Different123!')
    })
    expect(result.current.validateConfirmPassword()).toBe(
      'Passwords do not match.'
    )

    act(() => result.current.saveConfirmPassword('Valid123!'))
    expect(result.current.validateConfirmPassword()).toBeNull()
  })

  it('submits the reset token and new password once both checks pass', () => {
    const { result } = renderHook(() =>
      useChangePasswordHandler({ resetToken: 'token-123' })
    )

    act(() => {
      result.current.savePassword('Valid123!')
      result.current.saveConfirmPassword('Valid123!')
    })
    act(() => result.current.handleSubmit(submitEvent))

    expect(changePassword).toHaveBeenCalledWith({
      data: {
        resetToken: 'token-123',
        newPassword: 'Valid123!',
        confirmPassword: 'Valid123!',
      },
    })
  })

  it('blocks submission when the passwords do not match', () => {
    const { result } = renderHook(() =>
      useChangePasswordHandler({ resetToken: 'token-123' })
    )

    act(() => {
      result.current.savePassword('Valid123!')
      result.current.saveConfirmPassword('Nope123!')
    })
    act(() => result.current.handleSubmit(submitEvent))

    expect(changePassword).not.toHaveBeenCalled()
  })
})

describe('useVerifyTokenHandler', () => {
  beforeEach(() => {
    verifyResetToken.mockReset()
    verifyState = { status: 'idle' }
    asPath = '/change-password'
    ;(Cookies.get as jest.Mock).mockReset().mockReturnValue(undefined)
  })

  it('reads the username and token from the URL query string', () => {
    asPath = '/change-password?username=jane&token=abc123'

    const { result } = renderHook(() => useVerifyTokenHandler())

    expect(result.current.resetToken).toBe('abc123')
  })

  it('falls back to cookies when the URL has no query string', () => {
    ;(Cookies.get as jest.Mock).mockImplementation((name: string) => {
      if (name === 'username') return 'jane'
      if (name === 'resetToken') return 'cookie-token'
      return undefined
    })

    const { result } = renderHook(() => useVerifyTokenHandler())

    expect(result.current.resetToken).toBe('cookie-token')
  })

  it('does not crash when token verification fails', () => {
    // jsdom in this version makes window.location non-configurable, so the
    // resulting `window.location.href = '/unauthorized'` can't be observed
    // directly here - it does hit jsdom's "Not implemented: navigation"
    // path, which this only confirms doesn't throw.
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)

    verifyState = { status: 'error' }
    expect(() => renderHook(() => useVerifyTokenHandler())).not.toThrow()

    consoleError.mockRestore()
  })
})
