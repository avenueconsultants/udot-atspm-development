import { Autocomplete, TextField } from '@mui/material'
import React from 'react'

interface IssueTypeSelectProps {
  issueTypeData: Record<number, string> | null
  setSelectedIssueTypeData: (id: number | null) => void
}

export const IssueTypeSelect: React.FC<IssueTypeSelectProps> = ({
  issueTypeData,
  setSelectedIssueTypeData,
}) => {
  const options = issueTypeData
    ? Object.entries(issueTypeData).map(([key, name]) => ({
        id: Number(key),
        name,
      }))
    : []

  return (
    <Autocomplete
      options={options}
      getOptionLabel={(option) => `${option.id} - ${option.name}`}
      renderInput={(params) => (
        <TextField {...params} label="Issue Type" variant="outlined" />
      )}
      onChange={(_event, newValue) =>
        setSelectedIssueTypeData(newValue?.id ?? null)
      }
    />
  )
}
