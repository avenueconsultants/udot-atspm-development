import {
  SearchLocation as Location,
  useGetArea,
  useGetJurisdiction,
  useGetLocationLocationsForSearch,
  useGetRegion,
} from '@/api/config'
import SelectLocationNoMap from '@/features/locations/components/selectLocation/SelectLocationNoMap'
import { IssueTypeSelect } from '@/features/watchdog/components/issueTypeSelect'
import { Autocomplete, Box, TextField } from '@mui/material'
import { SyntheticEvent, useState } from 'react'

interface OptionalWatchDogFiltersProps {
  issueType: Record<string, string> | null
  setSelectedIssueType: (issueType: number) => void
  setAreaId: (areaId: number | null) => void
  setRegionId: (regionId: number | null) => void
  setJurisdictionId: (jurisdictionId: number | null) => void
  setLocationIdentifier: (locationIdentifier: string | null) => void
}

const OptionalWatchDogFilters = ({
  issueType,
  setSelectedIssueType,
  setAreaId,
  setRegionId,
  setJurisdictionId,
  setLocationIdentifier,
}: OptionalWatchDogFiltersProps) => {
  const [location, setLocation] = useState<Location | null>(null)

  const { data: areas = [] } = useGetArea()
  const { data: regions = [] } = useGetRegion()
  const { data: jurisdictions = [] } = useGetJurisdiction()
  const { data: locations = [] } = useGetLocationLocationsForSearch()

  const handleAreaChange = (
    _: SyntheticEvent,
    val: string | null | undefined
  ) => {
    const area = areas.find((a) => a.name === val)
    setAreaId(area?.id ?? null)
  }

  const handleRegionChange = (
    _: SyntheticEvent,
    val: string | null | undefined
  ) => {
    const region = regions.find((r) => r.description === val)
    setRegionId(region?.id ?? null)
  }

  const handleJurisdictionChange = (
    _: SyntheticEvent,
    val: string | null | undefined
  ) => {
    const jurisdiction = jurisdictions.find((j) => j.name === val)
    setJurisdictionId(jurisdiction?.id ?? null)
  }

  const handleLocationChange = (location: Location | null) => {
    setLocation(location)
    setLocationIdentifier(location?.locationIdentifier ?? null)
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Autocomplete
        sx={{ width: '100%' }}
        options={areas.map((area) => area.name)}
        renderInput={(params) => <TextField {...params} label="Area" />}
        onChange={handleAreaChange}
      />
      <Autocomplete
        sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
        options={regions.map((region) => region.description)}
        renderInput={(params) => <TextField {...params} label="Region" />}
        onChange={handleRegionChange}
      />
      <Autocomplete
        sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
        options={jurisdictions.map((jurisdiction) => jurisdiction.name)}
        renderInput={(params) => <TextField {...params} label="Jurisdiction" />}
        onChange={handleJurisdictionChange}
      />
      <SelectLocationNoMap
        location={location}
        setLocation={handleLocationChange}
        locations={locations}
      />
      <Box sx={{ marginTop: '-25px' }}>
        <IssueTypeSelect
          issueTypeData={issueType}
          setSelectedIssueTypeData={setSelectedIssueType}
        />
      </Box>
    </Box>
  )
}

export default OptionalWatchDogFilters
