import { useGetAccountVerifyUserPasswordReset } from '@/api/identity/atspmAuthenticationApi'
import { VerifyUserPasswordResetResult } from '@/api/identity/atspmAuthenticationApi.schemas'
import { setSecureCookie } from '@/features/identity/utils'
import { getApiErrorMessage } from '@/lib/apiError'
import { addMinutes } from 'date-fns'
import { FormEvent, useEffect, useState } from 'react'
import { PasswordHandler, ResponseHandler } from './baseHandler'

export interface VerifyUserHandler extends PasswordHandler, ResponseHandler {
  data: VerifyUserPasswordResetResult | undefined
  errorMessage: string
  submitted: boolean
  handleSubmit(event: FormEvent<HTMLFormElement>): void
}

export const useVerifyUserHandler = (): VerifyUserHandler => {
  const [submitted, setSubmitted] = useState(false)
  const [responseError, setResponseError] = useState(false)
  const [responseSuccess, setResponseSuccess] = useState(false)
  const [password, setPassword] = useState<string>('')

  const {
    mutate: verifyUser,
    data,
    status,
    error,
  } = useGetAccountVerifyUserPasswordReset()

  useEffect(() => {
    if (status === 'success' && data?.token && data.username) {
      setSecureCookie('resetToken', data.token, {
        expires: addMinutes(new Date(), 5),
      })

      setSecureCookie('username', data.username)
      window.location.href = '/change-password'
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

  const handleSubmitForm = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitted(true)
    verifyUser({ data: { password } })
  }

  const component: VerifyUserHandler = {
    data,
    errorMessage: error
      ? getApiErrorMessage(error, 'Could not verify your password.')
      : '',
    password,
    responseError,
    responseSuccess,
    submitted,
    handleSubmit: (event: FormEvent<HTMLFormElement>) => {
      handleSubmitForm(event)
    },
    handleResponseError: (val: boolean) => {
      setResponseError(val)
    },
    handleResponseSuccess: (val: boolean) => {
      setResponseSuccess(val)
    },
    savePassword: (pass: string) => {
      setPassword(pass)
    },
    validatePassword: () => {
      return null
    },
  }

  return component
}
