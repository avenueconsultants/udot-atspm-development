// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - LabeledEventsTable.tsx
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//http://www.apache.org/licenses/LICENSE-2.
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
// #endregion
import { EventRow } from '@/features/incidentReconstruction/eventRows'
import { formatSincePrevious } from '@/features/incidentReconstruction/reportText'
import { MAX_LABEL_LENGTH } from '@/features/incidentReconstruction/urlCodecs'
import { formatClock } from '@/features/incidentReconstruction/wallClock'
import CloseIcon from '@mui/icons-material/Close'
import {
  Box,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import CommitTextField from './CommitTextField'
import NumberBadge from './NumberBadge'

interface LabeledEventsTableProps {
  rows: EventRow[]
  adjusted: boolean
  onLabelChange(key: string, label: string): void
  onRemove(key: string): void
}

const headSx = { fontWeight: 600, color: 'text.primary', whiteSpace: 'nowrap' }
const detailSx = { color: 'text.secondary', fontSize: '0.8rem' }

export default function LabeledEventsTable({
  rows,
  adjusted,
  onLabelChange,
  onRemove,
}: LabeledEventsTableProps) {
  return (
    <Box>
      {/* Narrow screens scroll the table rather than squeeze the label. */}
      <Box sx={{ overflowX: 'auto' }}>
        {/* Nine columns: tighter cell padding leaves the label its room. */}
        <Table size="small" sx={{ '& .MuiTableCell-root': { px: 1 } }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ ...headSx, width: 40 }}>#</TableCell>
              <TableCell sx={headSx}>
                {adjusted ? 'Time (adjusted)' : 'Time'}
              </TableCell>
              <TableCell sx={headSx}>Since previous</TableCell>
              <TableCell sx={{ ...headSx, width: '26%', minWidth: 200 }}>
                Label
              </TableCell>
              <TableCell sx={{ ...headSx, minWidth: 110 }}>Event</TableCell>
              <TableCell sx={{ ...headSx, minWidth: 100 }}>Phase</TableCell>
              <TableCell sx={{ ...headSx, minWidth: 150 }}>Detail</TableCell>
              <TableCell sx={headSx}>Indication</TableCell>
              <TableCell sx={{ width: 48 }} />
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.event.key}>
                <TableCell>
                  <NumberBadge number={row.number ?? 0} />
                </TableCell>
                <TableCell sx={{ fontVariantNumeric: 'tabular-nums' }}>
                  {formatClock(row.time)}
                  {adjusted && (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      component="div"
                    >
                      Controller {formatClock(row.controllerTime)}
                    </Typography>
                  )}
                </TableCell>
                <TableCell
                  sx={{
                    fontVariantNumeric: 'tabular-nums',
                    color: 'text.secondary',
                  }}
                >
                  {formatSincePrevious(row.sincePrevious)}
                </TableCell>
                <TableCell>
                  <CommitTextField
                    size="small"
                    fullWidth
                    placeholder="Add a label"
                    value={row.label}
                    maxLength={MAX_LABEL_LENGTH}
                    inputProps={{
                      'aria-label': `Label for event ${row.number}`,
                    }}
                    onCommit={(label) => onLabelChange(row.event.key, label)}
                  />
                </TableCell>
                <TableCell sx={detailSx}>
                  {row.event.eventCode} {row.event.eventName}
                </TableCell>
                <TableCell sx={{ ...detailSx, whiteSpace: 'nowrap' }}>
                  {row.bandLabel}
                </TableCell>
                <TableCell sx={detailSx}>
                  {row.event.parameterDescription}
                </TableCell>
                <TableCell
                  sx={{
                    ...detailSx,
                    fontVariantNumeric: 'tabular-nums',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {/* The permissive indication, when there is one, on its own line. */}
                  {row.signal.split('; ').map((part) => (
                    <div key={part}>{part}</div>
                  ))}
                </TableCell>
                <TableCell>
                  <IconButton
                    size="small"
                    aria-label={`Remove event ${row.number}`}
                    onClick={() => onRemove(row.event.key)}
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={9}>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ py: 1 }}
                  >
                    No labeled events. Check events on the Events tab, or turn
                    on Pick on chart and click an event.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Box>
    </Box>
  )
}
