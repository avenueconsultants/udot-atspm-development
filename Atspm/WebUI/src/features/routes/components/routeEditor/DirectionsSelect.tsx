import { RouteLocationDto, useGetLocationApproachesFromKey } from '@/api/config'
import CheckBoxIcon from '@mui/icons-material/CheckBox'
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank'
import {
  Box,
  FormControl,
  FormHelperText,
  MenuItem,
  Select,
  SelectChangeEvent,
  Typography,
  useTheme,
} from '@mui/material'

interface DirectionSelectProps {
  hasErrors: boolean
  link: RouteLocationDto
  onUpdate: (updatedLink: RouteLocationDto) => void
  updateType: 'primary' | 'opposing'
}

const DirectionSelect = ({
  hasErrors,
  link,
  onUpdate,
  updateType,
}: DirectionSelectProps) => {
  const theme = useTheme()
  const { data: approachesData } = useGetLocationApproachesFromKey(
    link.locationId ?? 0,
    undefined,
    { query: { enabled: link.locationId != null } }
  )

  const directionTypeId =
    updateType === 'primary' ? link.primaryDirectionId : link.opposingDirectionId
  const directionDescription =
    updateType === 'primary'
      ? link.primaryDirectionDescription
      : link.opposingDirectionDescription
  const phaseNumber =
    updateType === 'primary' ? link.primaryPhase : link.opposingPhase
  const isOverlap =
    updateType === 'primary' ? link.isPrimaryOverlap : link.isOpposingOverlap

  const formattedValue = `${directionTypeId}-${phaseNumber}-${
    isOverlap ? 'true' : 'false'
  }`

  const approaches = approachesData
    ?.slice()
    .sort(
      (a, b) => (a.protectedPhaseNumber ?? 0) - (b.protectedPhaseNumber ?? 0)
    )

  const handleSelectChange = (event: SelectChangeEvent<string>) => {
    const [directionTypeIdStr, protectedPhaseNumberStr, isOverlapStr] =
      event.target.value.split('-')
    const selectedApproach = approaches?.find(
      (approach) =>
        approach.directionTypeId === Number(directionTypeIdStr) &&
        approach.protectedPhaseNumber === Number(protectedPhaseNumberStr)
    )

    if (selectedApproach) {
      const updatedLink = { ...link }
      const newDirectionId = Number(directionTypeIdStr)
      const newPhase = Number(protectedPhaseNumberStr)
      const newIsOverlap = isOverlapStr === 'true'
      const newDescription = selectedApproach.directionType?.description ?? null

      if (updateType === 'primary') {
        updatedLink.primaryDirectionId = newDirectionId
        updatedLink.primaryDirectionDescription = newDescription
        updatedLink.primaryPhase = newPhase
        updatedLink.isPrimaryOverlap = newIsOverlap
      } else {
        updatedLink.opposingDirectionId = newDirectionId
        updatedLink.opposingDirectionDescription = newDescription
        updatedLink.opposingPhase = newPhase
        updatedLink.isOpposingOverlap = newIsOverlap
      }

      onUpdate(updatedLink)
    }
  }

  return (
    <FormControl fullWidth>
      <Select
        error={hasErrors && !directionTypeId}
        value={
          !!formattedValue || approaches?.length === 0 ? '' : formattedValue
        }
        onChange={handleSelectChange}
        displayEmpty
        renderValue={() => (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              width: '100%',
              alignItems: 'center',
            }}
          >
            <Typography>{directionDescription}</Typography>
            <Typography>{phaseNumber}</Typography>
            {isOverlap ? (
              <CheckBoxIcon color="success" fontSize="small" />
            ) : (
              <CheckBoxOutlineBlankIcon
                sx={{ color: theme.palette.grey[400] }}
                fontSize="small"
              />
            )}
          </Box>
        )}
        size="small"
      >
        {approaches?.map((approach, index) => (
          <MenuItem
            key={`${index}`}
            value={`${approach.directionTypeId}-${approach.protectedPhaseNumber}-${approach.isProtectedPhaseOverlap}`}
          >
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                width: '100%',
                alignItems: 'center',
              }}
            >
              <Typography>{approach.directionType?.description}</Typography>
              <Typography>{approach.protectedPhaseNumber}</Typography>
              {approach.isProtectedPhaseOverlap ? (
                <CheckBoxIcon color="success" fontSize="small" />
              ) : (
                <CheckBoxOutlineBlankIcon
                  sx={{ color: theme.palette.grey[400] }}
                  fontSize="small"
                />
              )}
            </Box>
          </MenuItem>
        ))}
      </Select>
      <FormHelperText error={hasErrors && !directionTypeId}>
        {hasErrors && !directionTypeId ? 'Direction is required' : ''}
      </FormHelperText>
    </FormControl>
  )
}

export default DirectionSelect
