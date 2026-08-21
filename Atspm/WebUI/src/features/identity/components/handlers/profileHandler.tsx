import {
  useGetProfileProfile,
  useGetProfileUpdateProfile,
} from '@/api/identity/atspmAuthenticationApi'
import { useNotificationStore } from '@/stores/notifications'
import { useEffect, useState } from 'react'
import { ProfileData } from '../../types/profile'
import { ResponseHandler } from './baseHandler'

export interface ProfileHandler extends ResponseHandler {
  profileData: ProfileData
  submitted: boolean
  isEditing: boolean
  isLoading: boolean
  phoneNumberError: string | null
  handleInputChange(field: string, value: string): void
  handleSaveClick(): void
  handleEditClick(): void
  validatePhoneNumber(phoneNumber: string): void
}

export const useProfileHandler = (): ProfileHandler => {
  const [isEditing, setIsEditing] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [responseSuccess, setResponseSuccess] = useState(false)
  const [responseError, setResponseError] = useState(false)
  const [phoneNumberError, setPhoneNumberError] = useState<string | null>(null)
  const { data: profileResponse } = useGetProfileProfile<ProfileData>()
  const [formData, setFormData] = useState<ProfileData>({
    firstName: '',
    lastName: '',
    agency: '',
    email: '',
    phoneNumber: '',
    roles: '',
  })

  const addNotification = useNotificationStore((state) => state.addNotification)
  const {
    mutate: saveProfile,
    data: saveUser,
    isSuccess,
    error,
  } = useGetProfileUpdateProfile({
    mutation: {
      onSuccess: () => {
        addNotification({ type: 'success', title: 'Profile updated' })
      },
      onError: () => {
        addNotification({ type: 'error', title: 'Failed to update profile' })
      },
    },
  })

  useEffect(() => {
    if (profileResponse) {
      setFormData({
        firstName: profileResponse.firstName,
        lastName: profileResponse.lastName,
        agency: profileResponse.agency,
        email: profileResponse.email,
        phoneNumber: profileResponse.phoneNumber || '',
        roles: profileResponse.roles,
      })
      setIsLoading(false)
      validatePhoneNumber(profileResponse.phoneNumber || '')
    }
  }, [profileResponse])

  useEffect(() => {
    if (saveUser !== undefined && isSuccess) {
      setResponseSuccess(true)
      setSubmitted(true)
      setIsEditing(false)
    }
    if (error) {
      setResponseError(true)
    }
  }, [error, isSuccess, saveUser])

  const validatePhoneNumber = (phoneNumber: string) => {
    const phoneRegex = /^(\+1|1)?[-.\s]?\(?[2-9]\d{2}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/
    
    if (!phoneNumber) {
      setPhoneNumberError("Phone number is required")
    } else if (!phoneRegex.test(phoneNumber)) {
      setPhoneNumberError("Must be a valid phone number")
    } else {
      setPhoneNumberError(null)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
    if (field === 'phoneNumber') {
      validatePhoneNumber(value)
    }
  }

  const handleSaveClick = () => {
    if (!phoneNumberError) {
      saveProfile({
        data: {
          firstName: formData.firstName,
          lastName: formData.lastName,
          agency: formData.agency,
          email: formData.email,
          phoneNumber: formData.phoneNumber,
        },
      })
    }
  }

  const component: ProfileHandler = {
    profileData: formData,
    submitted,
    responseError,
    responseSuccess,
    isEditing,
    isLoading,
    phoneNumberError,
    handleResponseError: (val: boolean) => {
      setResponseError(val)
    },
    handleResponseSuccess: (val: boolean) => {
      setResponseSuccess(val)
    },
    handleInputChange,
    handleSaveClick,
    handleEditClick: () => {
      setIsEditing(!isEditing)
    },
    validatePhoneNumber,
  }

  return component
}