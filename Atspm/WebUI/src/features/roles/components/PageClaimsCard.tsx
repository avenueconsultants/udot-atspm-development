import { useFlags } from '@/feature-flags/FeatureFlagContext'
import { Box, MenuItem, Select, Typography } from '@mui/material'
import { useMemo } from 'react'

interface PageClaimsCardProps {
  onClaimsChange: (claims: string[]) => void
  userClaims: string[]
  claimsData?: string[]
}

const PageClaimsCard = ({
  onClaimsChange,
  userClaims,
  claimsData,
}: PageClaimsCardProps) => {
  const flags = useFlags()
  const claims = useMemo(
    () =>
      claimsData?.filter(
        (claim) =>
          claim !== 'Admin' &&
          (flags.speedManagementTool || !claim.startsWith('SpeedConfiguration'))
      ) || [],
    [claimsData, flags.speedManagementTool]
  )

  const getPermissionName = (claim: string) => claim.split(':')[0]
  const uniquePermissions = useMemo(
    () => Array.from(new Set(claims.map(getPermissionName))),
    [claims]
  )

  const getAvailableOptions = (permission: string) => {
    const availableClaims = claims.filter((c) => c.startsWith(`${permission}:`))
    const options: string[] = []
    if (availableClaims.some((c) => c.endsWith('View'))) options.push('View')
    if (availableClaims.some((c) => c.endsWith('Edit')))
      options.push('View & Edit')
    if (availableClaims.some((c) => c.endsWith('Delete')))
      options.push('View, Edit, Delete')
    return options
  }

  const permissionDescriptions: Record<string, string> = {
    User: 'Update and delete user accounts, and assign roles to users.',
    Role: 'Manage roles, and assign permissions to roles.',
    LocationConfiguration: 'Manage locations info and settings.',
    GeneralConfiguration: 'Manage faqs, areas, regions, jurisdictions, etc.',
    Data: 'Export raw event logs.',
    Watchdog:
      'View the system’s watchdog logs and subscribe to daily watchdog email updates.',
    Report: 'View the left turn gap report.',
  }

  if (flags.speedManagementTool) {
    permissionDescriptions.SpeedConfiguration =
      'Manage speed configurations, impacts, impact types, segments, and versions.'
  }

  const selectedPermissions = useMemo(() => {
    const permissions: Record<string, string> = {}
    uniquePermissions.forEach((permission) => {
      if (userClaims.includes(`${permission}:Delete`)) {
        permissions[permission] = 'View, Edit, Delete'
      } else if (userClaims.includes(`${permission}:Edit`)) {
        permissions[permission] = 'View & Edit'
      } else if (userClaims.includes(`${permission}:View`)) {
        permissions[permission] = 'View'
      } else {
        permissions[permission] = ''
      }
    })
    return permissions
  }, [uniquePermissions, userClaims])

  const formatPermissionName = (permission: string) =>
    permission.replace(/(?<!^)([A-Z])/g, ' $1')

  const handlePermissionChange = (permission: string, value: string) => {
    // Only replace the edited permission; claims hidden by feature flags or
    // belonging to other permissions must survive an unrelated edit.
    const newClaims = userClaims.filter(
      (claim) => !claim.startsWith(`${permission}:`)
    )
    switch (value) {
      case 'View':
        newClaims.push(`${permission}:View`)
        break
      case 'View & Edit':
        newClaims.push(`${permission}:View`, `${permission}:Edit`)
        break
      case 'View, Edit, Delete':
        newClaims.push(
          `${permission}:View`,
          `${permission}:Edit`,
          `${permission}:Delete`
        )
        break
    }
    onClaimsChange(newClaims)
  }

  return (
    <>
      {uniquePermissions.map((permission) => {
        const availableOptions = getAvailableOptions(permission)
        return (
          <Box
            key={permission}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              mb: 2,
              width: '100%',
            }}
          >
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 1,
              }}
            >
              <Box>
                <Typography variant="h6" component="div" fontWeight="bold">
                  {formatPermissionName(permission)}
                </Typography>
                <Box sx={{ marginRight: 2, maxWidth: '400px' }}>
                  <Typography variant="body2" color="text.secondary">
                    {permissionDescriptions[permission] ||
                      'No description available.'}
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ minWidth: 200 }}>
                <Select
                  fullWidth
                  size="small"
                  value={selectedPermissions[permission] || ''}
                  onChange={(e) =>
                    handlePermissionChange(permission, e.target.value)
                  }
                  displayEmpty
                >
                  <MenuItem value="">None</MenuItem>
                  {availableOptions.map((option) => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  ))}
                </Select>
              </Box>
            </Box>
          </Box>
        )
      })}
    </>
  )
}

export default PageClaimsCard
