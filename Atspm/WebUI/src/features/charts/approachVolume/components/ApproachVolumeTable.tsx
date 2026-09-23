import { ApproachVolumeSummaryData } from '@/features/charts/approachVolume/types'
import { formatNumber } from '@/utils/numberFormat'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  useTheme,
} from '@mui/material'

type ApproachVolumeTableProps = {
  data: ApproachVolumeSummaryData
}

// Every summary field is nullable on the contract; an absent one reads N/A.
const factor = (value: number | null | undefined) =>
  formatNumber(value, 3, { empty: 'N/A' })
const volume = (value: number | null | undefined) =>
  formatNumber(value, 0, { empty: 'N/A', grouping: true })

export function ApproachVolumeTable({ data }: ApproachVolumeTableProps) {
  const theme = useTheme()
  return (
    <Accordion
      disableGutters
      elevation={0}
      sx={{
        borderTop: '1px solid',
        marginTop: 3,
        '&:before': {
          display: 'none',
        },
      }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ p: 0 }}>
        <Typography variant="h5" component="h2">
          Peak Hour Data
        </Typography>
      </AccordionSummary>
      <AccordionDetails sx={{ p: 0 }}>
        <Paper variant="outlined">
          <Grid container spacing={0}>
            <Grid item xs={12}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell component="th" />
                    <TableCell>Total</TableCell>
                    <TableCell>{data.primaryDirectionName}</TableCell>
                    <TableCell>{data.opposingDirectionName}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <TableRow
                    sx={{ backgroundColor: theme.palette.background.default }}
                  >
                    <TableCell variant="head">Peak Hour</TableCell>
                    <TableCell>{data.peakHour ?? 'N/A'}</TableCell>
                    <TableCell>{data.primaryPeakHour ?? 'N/A'}</TableCell>
                    <TableCell>{data.opposingPeakHour ?? 'N/A'}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell variant="head">Peak Hour K Factor</TableCell>
                    <TableCell>{factor(data.kFactor)}</TableCell>
                    <TableCell>{factor(data.primaryKFactor)}</TableCell>
                    <TableCell>{factor(data.opposingKFactor)}</TableCell>
                  </TableRow>
                  <TableRow
                    sx={{ backgroundColor: theme.palette.background.default }}
                  >
                    <TableCell variant="head">Peak Hour D Factor</TableCell>
                    <TableCell>-</TableCell>
                    <TableCell>{factor(data.primaryDFactor)}</TableCell>
                    <TableCell>{factor(data.opposingDFactor)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell variant="head">Peak Hour Volume</TableCell>
                    <TableCell>{volume(data.peakHourVolume)}</TableCell>
                    <TableCell>{volume(data.primaryPeakHourVolume)}</TableCell>
                    <TableCell>{volume(data.opposingPeakHourVolume)}</TableCell>
                  </TableRow>
                  <TableRow
                    sx={{ backgroundColor: theme.palette.background.default }}
                  >
                    <TableCell variant="head">Peak Hour Factor</TableCell>
                    <TableCell>{factor(data.peakHourFactor)}</TableCell>
                    <TableCell>{factor(data.primaryPeakHourFactor)}</TableCell>
                    <TableCell>{factor(data.opposingPeakHourFactor)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell variant="head">Total Volume</TableCell>
                    <TableCell>{volume(data.totalVolume)}</TableCell>
                    <TableCell>{volume(data.primaryTotalVolume)}</TableCell>
                    <TableCell>{volume(data.opposingTotalVolume)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </Grid>
          </Grid>
        </Paper>
      </AccordionDetails>
    </Accordion>
  )
}
