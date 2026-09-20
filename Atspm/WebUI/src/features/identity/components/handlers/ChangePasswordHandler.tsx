import {
  useDeleteTokenVerifyResetToken,
  useGetAccountChangePassword,
} from '@/api/identity/atspmAuthenticationApi'
import { VerifyResetTokenResult } from '@/api/identity/atspmAuthenticationApi.schemas'
import { setSecureCookie } from '@/features/identity/utils'
import Cookies from 'js-cookie'
import { useRouter } from 'next/router'
import { FormEvent, useEffect, useState } from 'react'
import { PasswordHandler, ResponseHandler } from './baseHandler'

export interface ChangePasswordHandler
  extends PasswordHandler,
    ResponseHandler {
  submitted: boolean
  confirmPassword: string
  validateConfirmPassword(): string | null
  saveConfirmPassword(pass: string): void
  handleSubmit(event: FormEvent<HTMLFormElement>): void
}

export interface VerifyTokenHandler {
  data: VerifyResetTokenResult | undefined
  isLoadingValidity: boolean
  isValidToken: boolean
  resetToken: string
}

interface changePasswordProp {
  resetToken: string
}

export const useChangePasswordHandler = ({
  resetToken,
}: changePasswordProp): ChangePasswordHandler => {
  const [submitted, setSubmitted] = useState(false)
  const [password, setPassword] = useState<string>('')
  // const [oldPassword, setOldPassword] = useState<string>('')
  const [confirmPassword, setConfirmPassword] = useState<string>('')
  const [responseSuccess, setResponseSuccess] = useState(false)
  const [responseError, setResponseError] = useState(false)

  const { mutate: changePassword, status } = useGetAccountChangePassword()

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

    const hasUpperCase = /[A-Z]/
    const hasDigit = /\d/
    const hasSpecialChar = /[!@#$%^&*()_+\[\]{};:'"\\|,.<>?]/

    if (
      !hasUpperCase.test(password) ||
      !hasDigit.test(password) ||
      !hasSpecialChar.test(password)
    ) {
      return 'Password should contain at least one uppercase letter, one digit, and one symbol.'
    }

    return null
  }

  const confirmPasswordCheck = () => {
    if (password !== confirmPassword) {
      return 'Passwords do not match.'
    }

    return null
  }

  const handleSubmitForm = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const passwordError = passwordCheck()
    const confirmPasswordError = confirmPasswordCheck()

    if (passwordError || confirmPasswordError) {
      return
    }
    setSubmitted(true)
    changePassword({
      data: { resetToken, newPassword: password, confirmPassword },
    })
  }

  const component: ChangePasswordHandler = {
    password,
    confirmPassword,
    responseError,
    responseSuccess,
    submitted,
    handleResponseError: (val: boolean) => {
      setResponseError(val)
    },
    handleResponseSuccess: (val: boolean) => {
      setResponseSuccess(val)
    },
    validatePassword: () => {
      return passwordCheck()
    },
    validateConfirmPassword: () => {
      return confirmPasswordCheck()
    },
    handleSubmit: (event: FormEvent<HTMLFormElement>) => {
      handleSubmitForm(event)
    },
    savePassword: (pass: string) => {
      setPassword(pass)
    },
    saveConfirmPassword: (pass: string) => {
      setConfirmPassword(pass)
    },
  }

  return component
}

export const useVerifyTokenHandler = (): VerifyTokenHandler => {
  const router = useRouter()
  const [isLoadingValidity, setIsLoadingValidity] = useState(true)
  const [username, setUsername] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [isValidToken, setIsValidToken] = useState(false)

  const {
    mutate: verifyResetToken,
    data,
    status,
  } = useDeleteTokenVerifyResetToken()

  useEffect(() => {
    if (data?.token) {
      setIsValidToken(true)
      setSecureCookie('token', data.token)
    }
  }, [data])

  useEffect(() => {
    const queryParams = new URLSearchParams(router.asPath.split('?')[1])
    const name = queryParams.get('username')
    const code = queryParams.get('token')
    if (name && code) {
      setUsername(name)
      setResetToken(code)
    }
  }, [router.asPath])

  useEffect(() => {
    const code = Cookies.get('resetToken')
    const name = Cookies.get('username')
    if (name && code) {
      setUsername(name)
      setResetToken(code)
    }
  }, [])

  useEffect(() => {
    if (resetToken && username && isLoadingValidity) {
      verifyResetToken({ data: { token: resetToken, username } })
    }
  }, [isLoadingValidity, verifyResetToken, resetToken, username])

  useEffect(() => {
    if (status === 'success') {
      setIsLoadingValidity(false)
    }
    if (status === 'error') {
      window.location.href = '/unauthorized'
    }
  }, [status])

  const component: VerifyTokenHandler = {
    data,
    isLoadingValidity,
    isValidToken,
    resetToken,
  }

  return component
}
