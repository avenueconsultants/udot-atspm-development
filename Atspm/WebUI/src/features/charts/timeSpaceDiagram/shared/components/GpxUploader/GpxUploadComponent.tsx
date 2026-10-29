import AddRoundedIcon from '@mui/icons-material/AddRounded'
import { Box, Button, Stack } from '@mui/material'
import { nanoid } from 'nanoid'
import type { GpxChartTrack } from '../../gpxRoutePlacement'
import { GpxUploadOptions } from '../../types'
import { GpxUploadRow } from './GpxUploadRow'

interface Prop {
  tracks: GpxChartTrack[]
  // Signals offered as "Start" and "End"; empty hides the pickers.
  startEndLocations: string[]
  entries: GpxUploadOptions[]
  setEntries: React.Dispatch<React.SetStateAction<GpxUploadOptions[]>>
}

// The first row is the primary track, which can't be removed.
export function createGpxUploadEntry(primary = false): GpxUploadOptions {
  return {
    id: nanoid(),
    error: null,
    primary,
  }
}

export const GpxUploadComponent = (prop: Prop) => {
  const { tracks, startEndLocations, entries, setEntries } = prop

  const updateEntry = (id: string, updates: Partial<GpxUploadOptions>) => {
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...updates } : e))
    )
  }

  const addEntry = () => {
    setEntries((prev) => [...prev, createGpxUploadEntry()])
  }

  const deleteEntry = (id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }

  return (
    <Box>
      <Stack spacing={1}>
        {entries.map((entry, index) => (
          <GpxUploadRow
            key={`${index} ${entry.id}`}
            entry={entry}
            index={index}
            message={tracks.find((track) => track.id === entry.id)?.message}
            startEndLocations={startEndLocations}
            canDelete={!entry.primary}
            onDelete={() => deleteEntry(entry.id)}
            onChange={(updates) => updateEntry(entry.id, updates)}
          />
        ))}

        <Button
          onClick={addEntry}
          variant="text"
          size="small"
          startIcon={<AddRoundedIcon fontSize="small" />}
          sx={{
            alignSelf: 'flex-start',
            px: 0.5,
            fontSize: '0.76rem',
            fontWeight: 600,
            textTransform: 'none',
          }}
        >
          Add another GPX
        </Button>
      </Stack>
    </Box>
  )
}
