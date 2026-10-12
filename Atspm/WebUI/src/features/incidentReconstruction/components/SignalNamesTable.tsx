// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - SignalNamesTable.tsx
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
import { TimelineBand } from '@/features/incidentReconstruction/types'
import {
  MAX_NAME_LENGTH,
  SignalNames,
} from '@/features/incidentReconstruction/urlCodecs'
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

interface SignalNamesTableProps {
  /** The signals on the chart, in chart order. */
  bands: TimelineBand[]
  names: SignalNames
  onNameChange(key: string, name: string): void
  onRemove(key: string): void
}

const headSx = { fontWeight: 600, color: 'text.primary', whiteSpace: 'nowrap' }

export default function SignalNamesTable({
  bands,
  names,
  onNameChange,
  onRemove,
}: SignalNamesTableProps) {
  return (
    <Box>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={headSx}>Phase</TableCell>
            <TableCell sx={{ ...headSx, width: '50%' }}>Display as</TableCell>
            <TableCell sx={{ width: 48 }} />
          </TableRow>
        </TableHead>
        <TableBody>
          {bands.map((band) => (
            <TableRow key={band.key}>
              <TableCell>{band.label}</TableCell>
              <TableCell>
                <CommitTextField
                  size="small"
                  fullWidth
                  placeholder={band.label}
                  value={names[band.key] ?? ''}
                  maxLength={MAX_NAME_LENGTH}
                  inputProps={{ 'aria-label': `Display ${band.label} as` }}
                  onCommit={(name) => onNameChange(band.key, name)}
                />
              </TableCell>
              <TableCell>
                <IconButton
                  size="small"
                  aria-label={`Remove ${band.label} from the chart`}
                  onClick={() => onRemove(band.key)}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </TableCell>
            </TableRow>
          ))}
          {bands.length === 0 && (
            <TableRow>
              <TableCell colSpan={3}>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ py: 1 }}
                >
                  No phases on the chart. Check a phase on the Phases tab beside
                  the chart.
                </Typography>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Box>
  )
}
