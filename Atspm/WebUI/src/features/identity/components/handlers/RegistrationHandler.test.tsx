// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - RegistrationHandler.test.tsx
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
import { useRegistrationHandler } from './RegistrationHandler'

const register = jest.fn()

jest.mock('@/api/identity/atspmAuthenticationApi', () => ({
  __esModule: true,
  useAccountRegister: () => ({
    mutate: register,
    data: undefined,
    error: null,
    status: 'idle',
  }),
}))

jest.mock('@/features/identity/utils', () => ({
  __esModule: true,
  setSecureCookie: jest.fn(),
}))

const submitEvent = {
  preventDefault: jest.fn(),
} as unknown as React.FormEvent<HTMLFormElement>

describe('useRegistrationHandler validation', () => {
  beforeEach(() => {
    register.mockReset()
  })

  it('requires each name/agency field to validate itself, not firstName for all three', () => {
    const { result } = renderHook(() => useRegistrationHandler())

    act(() => {
      result.current.saveFirstName('Jane')
      result.current.saveLastName('')
      result.current.saveAgency('')
    })

    // Regression test for a copy-paste bug: lastNameCheck/agencyCheck used to
    // check `firstName` instead of their own field, so a filled-in first
    // name masked a missing last name or agency.
    expect(result.current.validateFirstName()).toBeNull()
    expect(result.current.validateLastName()).toBe('Name is Required')
    expect(result.current.validateAgency()).toBe('Agency is Required')
  })

  it('validates first, last, and agency independently once all are filled', () => {
    const { result } = renderHook(() => useRegistrationHandler())

    act(() => {
      result.current.saveFirstName('')
      result.current.saveLastName('Doe')
      result.current.saveAgency('UDOT')
    })

    expect(result.current.validateFirstName()).toBe('Name is Required')
    expect(result.current.validateLastName()).toBeNull()
    expect(result.current.validateAgency()).toBeNull()
  })

  it('requires an email in a valid format', () => {
    const { result } = renderHook(() => useRegistrationHandler())

    expect(result.current.validateEmail()).toBe('Email is required.')

    act(() => result.current.saveEmail('not-an-email'))
    expect(result.current.validateEmail()).toBe(
      'Please enter a valid email address.'
    )

    act(() => result.current.saveEmail('user@example.com'))
    expect(result.current.validateEmail()).toBeNull()
  })

  it('requires a password with length, case, digit, and symbol requirements', () => {
    const { result } = renderHook(() => useRegistrationHandler())

    act(() => result.current.savePassword('short1!'))
    expect(result.current.validatePassword()).toBe(
      'Password should be at least 8 characters long.'
    )

    act(() => result.current.savePassword('alllowercase1!'))
    expect(result.current.validatePassword()).toBe(
      'Password should contain at least one uppercase letter, one digit, and one symbol.'
    )

    act(() => result.current.savePassword('NoDigitsHere!'))
    expect(result.current.validatePassword()).toBe(
      'Password should contain at least one uppercase letter, one digit, and one symbol.'
    )

    act(() => result.current.savePassword('NoSymbol123'))
    expect(result.current.validatePassword()).toBe(
      'Password should contain at least one uppercase letter, one digit, and one symbol.'
    )

    act(() => result.current.savePassword('Valid123!'))
    expect(result.current.validatePassword()).toBeNull()
  })

  it('submits registration data once the password is valid', () => {
    const { result } = renderHook(() => useRegistrationHandler())

    act(() => {
      result.current.saveEmail('user@example.com')
      result.current.savePassword('Valid123!')
      result.current.saveFirstName('Jane')
      result.current.saveLastName('Doe')
      result.current.saveAgency('UDOT')
    })

    act(() => result.current.handleSubmit(submitEvent))

    expect(register).toHaveBeenCalledWith({
      data: {
        email: 'user@example.com',
        password: 'Valid123!',
        firstName: 'Jane',
        lastName: 'Doe',
        agency: 'UDOT',
      },
    })
  })

  it('blocks submission when the password is invalid', () => {
    const { result } = renderHook(() => useRegistrationHandler())

    act(() => result.current.savePassword('short'))
    act(() => result.current.handleSubmit(submitEvent))

    expect(register).not.toHaveBeenCalled()
  })

  // Every non-password field used to render an inline error but still let
  // the request through, so a strong password alone was enough to submit
  // blank names or a malformed email to the identity API.
  it.each([
    ['email', { email: '' }],
    ['email format', { email: 'not-an-email' }],
    ['first name', { firstName: '' }],
    ['last name', { lastName: '' }],
    ['agency', { agency: '' }],
  ])(
    'blocks submission on an invalid %s even when the password is strong',
    (_label, overrides: Record<string, string>) => {
      const { result } = renderHook(() => useRegistrationHandler())
      const fields = {
        email: 'user@example.com',
        firstName: 'Jane',
        lastName: 'Doe',
        agency: 'UDOT',
        ...overrides,
      }

      act(() => {
        result.current.savePassword('Valid123!')
        result.current.saveEmail(fields.email)
        result.current.saveFirstName(fields.firstName)
        result.current.saveLastName(fields.lastName)
        result.current.saveAgency(fields.agency)
      })
      act(() => result.current.handleSubmit(submitEvent))

      expect(register).not.toHaveBeenCalled()
    }
  )
})
