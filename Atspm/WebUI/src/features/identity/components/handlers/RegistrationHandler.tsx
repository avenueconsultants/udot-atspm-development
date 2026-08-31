import { useAccountRegister } from '@/api/identity/atspmAuthenticationApi'
import { setSecureCookie } from '@/features/identity/utils'
import { FormEvent, useEffect, useState } from 'react'
import IdentityDto from '../../types/identityDto'
import { EmailAndPasswordHandler, ResponseHandler } from './baseHandler'

export interface RegistrationHandler
  extends EmailAndPasswordHandler,
    ResponseHandler {
  firstName: string
  lastName: string
  agency: string
  data: IdentityDto
  submitted: boolean
  handleSubmit(event: FormEvent<HTMLFormElement>): void
  saveFirstName(name: string): void
  saveLastName(name: string): void
  saveAgency(agency: string): void
  validateFirstName(): string | null
  validateLastName(): string | null
  validateAgency(): string | null
}

export const useRegistrationHandler = (): RegistrationHandler => {
  const [submitted, setSubmitted] = useState(false)
  const [email, setEmail] = useState<string>('')
  const [password, setPassword] = useState<string>('')
  const [firstName, setFirstName] = useState<string>('')
  const [lastName, setLastName] = useState<string>('')
  const [agency, setAgency] = useState<string>('')
  const [responseSuccess, setResponseSuccess] = useState(false)
  const [responseError, setResponseError] = useState(false)

  const [data, setData] = useState<IdentityDto>()

  const {
    mutate: register,
    data: mutationData,
    error,
    status,
  } = useAccountRegister()

  useEffect(() => {
    if (status === 'error' && error) {
      setData((error as any).response.data as IdentityDto)
    }
    if (mutationData) {
      setData(mutationData as IdentityDto)
    }
  }, [error, mutationData, status])

  useEffect(() => {
    if (status === 'success' && data !== undefined) {
      setSecureCookie('token', data.token)
      setSecureCookie('claims', data.claims.join(','))
      setSecureCookie('loggedIn', 'True')
      window.location.href = '/'
    }
  }, [data, status])

  useEffect(() => {
    if (status === 'success') {
      setResponseSuccess(true)
    }

    if (status === 'error') {
      setResponseError(true)
    }
  }, [status])

  const passwordCheck = () => {
    if (password.length < 8) {
      return 'Password should be at least 8 characters long.'
    }

    const hasUpperCase = /(?=.*[A-Z])/
    const hasDigit = /\d/
    const hasSpecialChar = /[!@#$%^&*()_+\[\]{};':"\\|,.<>?]/

    if (
      !hasUpperCase.test(password) ||
      !hasDigit.test(password) ||
      !hasSpecialChar.test(password)
    ) {
      return 'Password should contain at least one uppercase letter, one digit, and one symbol.'
    }

    return null
  }

  const emailCheck = () => {
    if (!email) {
      return 'Email is required.'
    }

    // Regular expression for validating email addresses
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
    if (!emailRegex.test(email)) {
      return 'Please enter a valid email address.'
    }

    return null
  }

  const firstNameCheck = () => {
    if (!firstName) {
      return 'Name is Required'
    }
    return null
  }

  const lastNameCheck = () => {
    if (!lastName) {
      return 'Name is Required'
    }
    return null
  }

  const agencyCheck = () => {
    if (!agency) {
      return 'Agency is Required'
    }
    return null
  }

  const handleSubmitForm = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitted(true)

    // Every field's validator has to gate submission, not just the
    // password's: these all render an inline error once `submitted` is true,
    // but previously only passwordCheck() could actually stop the request,
    // so a strong password was enough to send a blank name/agency or a
    // malformed email straight to the identity API.
    const hasError = [
      passwordCheck(),
      emailCheck(),
      firstNameCheck(),
      lastNameCheck(),
      agencyCheck(),
    ].some((error) => error !== null)

    if (hasError) {
      return
    }
    register({ data: { email, password, firstName, lastName, agency } })
  }

  const component: RegistrationHandler = {
    data: data as IdentityDto,
    email,
    password,
    firstName,
    lastName,
    agency,
    responseError,
    responseSuccess,
    submitted,
    handleResponseError: (val: boolean) => {
      setResponseError(val)
    },
    handleResponseSuccess: (val: boolean) => {
      setResponseSuccess(val)
    },
    validateEmail: () => {
      return emailCheck()
    },
    validatePassword: () => {
      return passwordCheck()
    },
    handleSubmit: (event: FormEvent<HTMLFormElement>) => {
      handleSubmitForm(event)
    },
    saveAgency: (agency: string) => {
      setAgency(agency)
    },
    saveEmail: (email: string) => {
      setEmail(email)
    },
    saveFirstName: (name: string) => {
      setFirstName(name)
    },
    saveLastName: (name: string) => {
      setLastName(name)
    },
    savePassword: (pass: string) => {
      setPassword(pass)
    },
    validateAgency: () => {
      return agencyCheck()
    },
    validateFirstName: () => {
      return firstNameCheck()
    },
    validateLastName: () => {
      return lastNameCheck()
    },
  }

  return component
}
