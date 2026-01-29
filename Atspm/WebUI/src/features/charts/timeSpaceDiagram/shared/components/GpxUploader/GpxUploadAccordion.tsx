import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Typography,
} from '@mui/material'
import { GpxUploadOptions } from '../../types'
import { GpxUploadComponent } from './GpxUploadComponent'

interface Prop {
  locations: string[]
  entries: GpxUploadOptions[]
  setEntries: React.Dispatch<React.SetStateAction<GpxUploadOptions[]>>
}

export const GpxUploadAccordion = (prop: Prop) => {
  return (
    <Accordion defaultExpanded elevation={0}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography fontWeight={600}>GPX Options</Typography>
      </AccordionSummary>

      <AccordionDetails>
        <GpxUploadComponent
          locations={prop.locations}
          entries={prop.entries}
          setEntries={prop.setEntries}
        />
      </AccordionDetails>
    </Accordion>
  )
}
