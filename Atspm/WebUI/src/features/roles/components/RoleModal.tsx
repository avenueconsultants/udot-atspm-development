import {
  useGetClaimsClaims,
  useGetRolesRoles,
} from '@/api/identity/atspmAuthenticationApi'
import { RolesResult } from '@/api/identity/atspmAuthenticationApi.schemas'
import ATSPMDialog from '@/components/ATSPMDialog'
import PageClaimsCard from '@/features/roles/components/PageClaimsCard'
import { getApiErrorMessage } from '@/lib/apiError'
import { Box, TextField } from '@mui/material'
import { useForm } from 'react-hook-form'

interface RoleFormData {
  roleName: string
  claims: string[]
}

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  data: RolesResult | null
  onSave: (roleData: RoleFormData) => void
}

const RoleModal = ({ isOpen, onSave, onClose, data }: ModalProps) => {
  const {
    data: rolesData,
    isLoading: rolesIsLoading,
    error: rolesError,
  } = useGetRolesRoles()
  const {
    data: claimsData,
    isLoading: claimsIsLoading,
    error: claimsError,
  } = useGetClaimsClaims()

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<RoleFormData>({
    defaultValues: {
      roleName: data?.role || '',
      claims: data?.claims || [],
    },
    mode: 'onChange',
  })

  const roleId = data?.role
  const isNewRole = !roleId
  const watchedRoleName = watch('roleName')
  const userClaims = watch('claims')

  const handleClaimsChange = (claims: string[]) => {
    setValue('claims', claims, { shouldDirty: true })
  }

  const onSubmit = (formData: RoleFormData) => {
    if (!formData.roleName) return
    onSave({
      roleName: formData.roleName,
      claims: formData.claims,
    })
    onClose()
  }

  const existingRoleNames = (rolesData || []).map((role) =>
    (role.role ?? '').toLowerCase()
  )
  const isDuplicateRoleName =
    Boolean(isNewRole) &&
    Boolean(watchedRoleName) &&
    existingRoleNames.includes(watchedRoleName.toLowerCase())

  if (rolesIsLoading || claimsIsLoading) return null
  if (rolesError || claimsError) {
    return <div>Error: {getApiErrorMessage(rolesError || claimsError)}</div>
  }

  return (
    <ATSPMDialog
      isOpen={isOpen}
      onClose={onClose}
      title={isNewRole ? 'Create New Role' : `Role Permissions - ${roleId}`}
      onSubmit={handleSubmit(onSubmit)}
      dialogProps={{ sx: { minWidth: 600 } }}
    >
      {isNewRole && (
        <Box sx={{ mb: 3, mt: 1 }}>
          <TextField
            fullWidth
            label="Role Name"
            {...register('roleName', {
              required: 'Role name is required',
              validate: (value) => {
                if (!value || value.trim() === '') return true
                return (
                  !existingRoleNames.includes(value.toLowerCase()) ||
                  'Role name already exists'
                )
              },
            })}
            error={!!errors.roleName || isDuplicateRoleName}
            helperText={errors.roleName ? errors.roleName.message : ''}
          />
        </Box>
      )}

      <PageClaimsCard
        onClaimsChange={handleClaimsChange}
        userClaims={userClaims}
        claimsData={claimsData}
      />
    </ATSPMDialog>
  )
}

export default RoleModal
