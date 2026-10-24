import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Typography,
} from '@mui/material'
import type { GpxChartTrack } from '../../gpxRoutePlacement'
import { GpxUploadOptions } from '../../types'
import { UPLOAD_ACCORDION_SX } from '../uploadStyles'
import { GpxUploadComponent } from './GpxUploadComponent'

interface Prop {
  tracks: GpxChartTrack[]
  startEndLocations: string[]
  entries: GpxUploadOptions[]
  setEntries: React.Dispatch<React.SetStateAction<GpxUploadOptions[]>>
}

export const GpxUploadAccordion = (prop: Prop) => {
  return (
    <Accordion defaultExpanded disableGutters elevation={0} sx={UPLOAD_ACCORDION_SX}>
      <AccordionSummary
        expandIcon={<ExpandMoreIcon sx={{ fontSize: 18, color: 'text.secondary' }} />}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography fontWeight={600} sx={{ fontSize: '0.82rem' }}>
            GPX Tracks
          </Typography>
          <Typography
            variant="caption"
            sx={{
              display: 'block',
              color: 'text.secondary',
              lineHeight: 1.3,
              mt: 0.1,
            }}
          >
            Add one or more GPX files to draw your drives on the chart.
          </Typography>
        </Box>
      </AccordionSummary>

      <AccordionDetails>
        <GpxUploadComponent
          tracks={prop.tracks}
          startEndLocations={prop.startEndLocations}
          entries={prop.entries}
          setEntries={prop.setEntries}
        />
      </AccordionDetails>
    </Accordion>
  )
}
