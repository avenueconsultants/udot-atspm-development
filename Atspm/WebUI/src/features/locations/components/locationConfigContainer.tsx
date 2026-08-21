import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  SelectChangeEvent,
  Typography,
} from '@mui/material'
import { useEffect, useState } from 'react'

import {
  useGetLocationAllVersionsOfLocationFromIdentifier,
  useGetLocationFromKey,
} from '@/api/config'
import ApproachesInfo from '@/features/locations/components/ApproachesInfo/approachesInfo'
import DetectorsInfo from '@/features/locations/components/DetectorsInfo/detectorsInfo'
import LocationInfo from '@/features/locations/components/LocationInfo/locationInfo'
import { format } from 'date-fns'

interface LocationsConfigContainerProps {
  locationIdentifier: string
}

function LocationsConfigContainer({
  locationIdentifier,
}: LocationsConfigContainerProps) {
  const [version, setVersion] = useState({ id: 0, note: '' })
  const [isLocationInfoExpanded, setIsLocationInfoExpanded] = useState(true)
  const [isApproachesExpanded, setIsApproachesExpanded] = useState(true)
  const [isDetectorsExpanded, setIsDetectorsExpanded] = useState(true)

  const { data: versionData } = useGetLocationAllVersionsOfLocationFromIdentifier(
    `'${locationIdentifier}'`
  )

  useEffect(() => {
    if (versionData) {
      const newestVersion = versionData.reduce((newest, current) => {
        return new Date(newest.start ?? 0) > new Date(current.start ?? 0)
          ? newest
          : current
      }, versionData[0])
      setVersion({
        id: newestVersion?.id ?? 0,
        note: newestVersion?.note ?? '',
      })
    }
  }, [versionData])

  const { data: location } = useGetLocationFromKey(
    version.id,
    {
      expand:
        'approaches($expand=directionType, detectors($expand=detectionTypes, detectorComments))',
    },
    { query: { enabled: !!version.id } }
  )

  const handleChange = (event: SelectChangeEvent) => {
    const id = Number(event.target.value)
    setVersion({
      id,
      note: versionData?.find((v) => v.id === id)?.note || '',
    })
  }

  if (!location || !versionData) {
    return (
      <>
        <Typography variant="h4" fontWeight={'bold'} mt={2}>
          Loading...
        </Typography>
        <Box height={'600px'} />
      </>
    )
  }

  return (
    <Box>
      <Typography variant="h4" fontWeight={'bold'} my={2}>
        Version
      </Typography>
      <Paper sx={{ width: '300px', mb: 2 }}>
        <FormControl fullWidth>
          <InputLabel
            htmlFor={'location-version-select'}
            id={'location-version-select-label'}
          >
            Version
          </InputLabel>
          <Select
            value={String(version.id)}
            label="Version"
            labelId="location-version-select-label"
            id={'location-version-select'}
            inputProps={{ id: 'location-version-select' }}
            onChange={handleChange}
          >
            {versionData.map((version, index) => (
              <MenuItem key={index} value={String(version.id)}>
                {version.start
                  ? format(new Date(version.start), 'MM/dd/yyyy')
                  : ''}{' '}
                - {version.note}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Paper>
      <Accordion
        expanded={isLocationInfoExpanded}
        onChange={() => setIsLocationInfoExpanded(!isLocationInfoExpanded)}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h4" fontWeight={'bold'}>
            Location
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <LocationInfo location={location} />
        </AccordionDetails>
      </Accordion>
      <Accordion
        expanded={isApproachesExpanded}
        onChange={() => setIsApproachesExpanded(!isApproachesExpanded)}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h4" fontWeight={'bold'}>
            Approaches
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <ApproachesInfo location={location} />
        </AccordionDetails>
      </Accordion>
      <Accordion
        expanded={isDetectorsExpanded}
        onChange={() => setIsDetectorsExpanded(!isDetectorsExpanded)}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h4" fontWeight={'bold'}>
            Detectors
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <DetectorsInfo location={location} />
        </AccordionDetails>
      </Accordion>
    </Box>
  )
}

export default LocationsConfigContainer
