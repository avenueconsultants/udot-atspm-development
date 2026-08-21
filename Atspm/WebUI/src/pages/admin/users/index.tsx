import {
  useDeleteUsersAssignRole,
  useDeleteUsersUserFromUserId,
  useGetUsersUsers,
} from '@/api/identity/atspmAuthenticationApi'
import { UserDTO } from '@/api/identity/atspmAuthenticationApi.schemas'
import AdminTable from '@/components/AdminTable/AdminTable'
import DeleteModal from '@/components/AdminTable/DeleteModal'
import { ResponsivePageLayout } from '@/components/ResponsivePage'
import { UserAssignmentCell } from '@/features/identity/components/users/UserAssignmentCell'
import UserModal from '@/features/identity/components/users/UserModal'
import { UserRolesCell } from '@/features/identity/components/users/UserRolesCell'
import {
  PageNames,
  useUserHasClaim,
  useViewPage,
} from '@/features/identity/pagesCheck'
import { useNotificationStore } from '@/stores/notifications'
import { Backdrop, CircularProgress } from '@mui/material'

const UsersAdmin = () => {
  const pageAccess = useViewPage(PageNames.Users)
  const hasUserEditClaim = useUserHasClaim('User:Edit')
  const hasUserDeleteClaim = useUserHasClaim('User:Delete')

  const { addNotification } = useNotificationStore()

  const { mutateAsync: deleteMutation } = useDeleteUsersUserFromUserId()
  const { mutateAsync: updateMutation } = useDeleteUsersAssignRole()
  const {
    data: allUserData,
    isLoading: usersIsLoading,
    refetch: refetchUsers,
  } = useGetUsersUsers<UserDTO[]>()

  const users = allUserData

  const normalizeIds = (values: unknown) =>
    Array.isArray(values)
      ? values
          .map((value) => Number(value))
          .filter((value) => !Number.isNaN(value))
      : []

  const handleEditUser = async (userData: UserDTO) => {
    const {
      userId,
      firstName,
      lastName,
      agency,
      userName,
      email,
      roles,
      areaIds,
      regionIds,
      jurisdictionIds,
    } = userData
    try {
      await updateMutation({
        data: {
          userId,
          firstName,
          lastName,
          agency,
          email: email?.toLowerCase(),
          userName: userName?.toLowerCase(),
          roles,
          areaIds: normalizeIds(areaIds),
          regionIds: normalizeIds(regionIds),
          jurisdictionIds: normalizeIds(jurisdictionIds),
        },
      })
      addNotification({
        title: `User updated successfully.`,
        type: 'success',
      })
      refetchUsers()
    } catch (error) {
      console.error('Mutation Error:', error)
      addNotification({
        title: `Error updating user: ${error.message}`,
        type: 'error',
      })
    }
  }

  const handleDeleteUser = async (userId: string | number) => {
    try {
      await deleteMutation({ userId: String(userId) })
      addNotification({
        title: `User deleted successfully.`,
        type: 'success',
      })
      refetchUsers()
    } catch (error) {
      console.error('Error deleting user:', error)
      addNotification({
        title: `Error deleting user: ${error.message}`,
        type: 'error',
      })
    }
  }

  if (pageAccess.isLoading) {
    return
  }

  const filteredData = users?.map((user) => {
    return {
      ...user,
      roles: user.roles?.sort(),
    }
  })

  const cells = [
    {
      key: 'fullName',
      label: 'Full Name',
    },
    {
      key: 'userName',
      label: 'Username',
    },
    {
      key: 'email',
      label: 'Email',
    },
    {
      key: 'agency',
      label: 'Agency',
    },
    {
      key: 'roles',
      label: 'Roles',
      component: UserRolesCell,
    },
    {
      key: 'regions',
      label: 'Regions',
      component: UserAssignmentCell,
    },
    {
      key: 'jurisdictions',
      label: 'Jurisdictions',
      component: UserAssignmentCell,
    },
    {
      key: 'areas',
      label: 'Areas',
      component: UserAssignmentCell,
    },
  ]

  if (usersIsLoading) {
    return (
      <Backdrop open>
        <CircularProgress color="inherit" />
      </Backdrop>
    )
  }

  if (!allUserData) {
    return <div>Error returning data</div>
  }

  return (
    <ResponsivePageLayout title="Manage Users" noBottomMargin>
      <AdminTable
        pageName="User"
        cells={cells}
        data={filteredData}
        hasEditPrivileges={hasUserEditClaim}
        hasDeletePrivileges={hasUserDeleteClaim}
        hideAuditProperties
        editModal={
          <UserModal isOpen={true} onSave={handleEditUser} data={null} />
        }
        deleteModal={
          <DeleteModal
            id={0}
            name={''}
            deleteByKey="userId"
            objectType="User"
            deleteLabel={(selectedRow: UserDTO) => selectedRow.fullName ?? ''}
            open={false}
            onConfirm={handleDeleteUser}
          />
        }
      />
    </ResponsivePageLayout>
  )
}

export default UsersAdmin
