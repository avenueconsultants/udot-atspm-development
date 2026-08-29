import { ApproachVolumeSummaryData } from '@/features/charts/approachVolume/types'
import { formatNullableNumber } from '@/features/charts/utils'
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

const defaultDecimalPoints = 3

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
                    <TableCell>
                      {formatNullableNumber(data.kFactor, defaultDecimalPoints)}
                    </TableCell>
                    <TableCell>
                      {formatNullableNumber(
                        data.primaryKFactor,
                        defaultDecimalPoints
                      )}
                    </TableCell>
                    <TableCell>
                      {formatNullableNumber(
                        data.opposingKFactor,
                        defaultDecimalPoints
                      )}
                    </TableCell>
                  </TableRow>
                  <TableRow
                    sx={{ backgroundColor: theme.palette.background.default }}
                  >
                    <TableCell variant="head">Peak Hour D Factor</TableCell>
                    <TableCell>-</TableCell>
                    <TableCell>
                      {formatNullableNumber(
                        data.primaryDFactor,
                        defaultDecimalPoints
                      )}
                    </TableCell>
                    <TableCell>
                      {formatNullableNumber(
                        data.opposingDFactor,
                        defaultDecimalPoints
                      )}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell variant="head">Peak Hour Volume</TableCell>
                    <TableCell>
                      {formatNullableNumber(data.peakHourVolume)}
                    </TableCell>
                    <TableCell>
                      {formatNullableNumber(data.primaryPeakHourVolume)}
                    </TableCell>
                    <TableCell>
                      {formatNullableNumber(data.opposingPeakHourVolume)}
                    </TableCell>
                  </TableRow>
                  <TableRow
                    sx={{ backgroundColor: theme.palette.background.default }}
                  >
                    <TableCell variant="head">Peak Hour Factor</TableCell>
                    <TableCell>
                      {formatNullableNumber(
                        data.peakHourFactor,
                        defaultDecimalPoints
                      )}
                    </TableCell>
                    <TableCell>
                      {formatNullableNumber(
                        data.primaryPeakHourFactor,
                        defaultDecimalPoints
                      )}
                    </TableCell>
                    <TableCell>
                      {formatNullableNumber(
                        data.opposingPeakHourFactor,
                        defaultDecimalPoints
                      )}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell variant="head">Total Volume</TableCell>
                    <TableCell>
                      {formatNullableNumber(data.totalVolume)}
                    </TableCell>
                    <TableCell>
                      {formatNullableNumber(data.primaryTotalVolume)}
                    </TableCell>
                    <TableCell>
                      {formatNullableNumber(data.opposingTotalVolume)}
                    </TableCell>
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
