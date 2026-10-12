// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - EventsPanel.tsx
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
import { CodeCount } from '@/features/incidentReconstruction/eventFilters'
import { EventRow } from '@/features/incidentReconstruction/eventRows'
import { formatClock } from '@/features/incidentReconstruction/wallClock'
import {
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Chip,
  TextField,
  Typography,
} from '@mui/material'
import NumberBadge from './NumberBadge'
import SectionHeader from './SectionHeader'

/** Past this many, the list asks for narrower codes rather than draw them all. */
const LIST_LIMIT = 200

interface EventsPanelProps {
  labeled: EventRow[]
  /** Events on the chart's signals with the chosen codes, not yet labeled. */
  unlabeled: EventRow[]
  /** Codes recorded on the chart's signals in the window. */
  counts: CodeCount[]
  selectedCodes: number[]
  onCodesChange(codes: number[]): void
  onResetCodes(): void
  onToggle(key: string): void
}

const codeLabel = (count: CodeCount) =>
  `${count.code} – ${count.name} (${count.count})`

function EventItem({
  row,
  onToggle,
}: {
  row: EventRow
  onToggle(key: string): void
}) {
  const parameter =
    row.event.parameterDescription !== '—'
      ? ` · ${row.event.parameterDescription}`
      : ''
  return (
    <Box
      component="label"
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 1,
        pl: 2,
        pr: 2.5,
        py: 0.25,
        cursor: 'pointer',
        '&:hover': { bgcolor: 'action.hover' },
      }}
    >
      <Checkbox
        size="small"
        checked={row.number !== null}
        onChange={() => onToggle(row.event.key)}
        inputProps={{
          'aria-label': `Label ${row.event.eventName} at ${formatClock(
            row.time
          )}`,
        }}
      />
      <Box sx={{ flex: 1, minWidth: 0, py: 0.75 }}>
        <Typography variant="body2" noWrap>
          <Box
            component="span"
            sx={{ fontVariantNumeric: 'tabular-nums', mr: 1 }}
          >
            {formatClock(row.time)}
          </Box>
          {row.event.eventCode} {row.event.eventName}
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          component="div"
          noWrap
        >
          {row.signalName}
          {parameter}
        </Typography>
      </Box>
      {row.number !== null && (
        <Box sx={{ pt: 1 }}>
          <NumberBadge number={row.number} />
        </Box>
      )}
    </Box>
  )
}

export default function EventsPanel({
  labeled,
  unlabeled,
  counts,
  selectedCodes,
  onCodesChange,
  onResetCodes,
  onToggle,
}: EventsPanelProps) {
  const selected = counts.filter((count) => selectedCodes.includes(count.code))
  // Codes not recorded on the chart's signals stay selected, so putting a
  // signal back brings them back.
  const hiddenSelections = selectedCodes.filter(
    (code) => !counts.some((count) => count.code === code)
  )
  const listed = unlabeled.slice(0, LIST_LIMIT)

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ px: 3, pt: 2 }}>
        Check an event to number it on the chart and add it to the Events table.
        The list holds events on the phases in the chart.
      </Typography>
      <Box sx={{ px: 3, pt: 2, pb: 1 }}>
        <Autocomplete
          multiple
          disableCloseOnSelect
          limitTags={4}
          size="small"
          disabled={counts.length === 0}
          options={counts}
          value={selected}
          getOptionLabel={codeLabel}
          isOptionEqualToValue={(option, value) => option.code === value.code}
          onChange={(_, value) =>
            onCodesChange([
              ...hiddenSelections,
              ...value.map((count) => count.code),
            ])
          }
          renderTags={(value, getTagProps) =>
            value.map((count, index) => (
              <Chip
                {...getTagProps({ index })}
                key={count.code}
                size="small"
                label={`${count.code} ${count.name}`}
              />
            ))
          }
          renderInput={(params) => (
            <TextField
              {...params}
              label="Event codes"
              placeholder={selected.length ? '' : 'Add a code'}
            />
          )}
        />
        <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
          <Button
            size="small"
            disabled={counts.length === 0}
            onClick={() => onCodesChange(counts.map((count) => count.code))}
          >
            Select all
          </Button>
          <Button size="small" onClick={onResetCodes}>
            Reset to defaults
          </Button>
        </Box>
      </Box>

      <SectionHeader title="Selected" count={labeled.length} />
      {labeled.length === 0 && (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ px: 3, py: 1.5 }}
        >
          None yet. Check an event below, or turn on Pick on chart and click
          one.
        </Typography>
      )}
      {labeled.map((row) => (
        <EventItem key={row.event.key} row={row} onToggle={onToggle} />
      ))}

      <Box sx={{ mt: 2 }}>
        <SectionHeader title="Unselected" count={unlabeled.length} />
      </Box>
      <Box sx={{ maxHeight: 560, overflowY: 'auto', pb: 1 }}>
        {listed.map((row) => (
          <EventItem key={row.event.key} row={row} onToggle={onToggle} />
        ))}
        {unlabeled.length > listed.length && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ px: 3, py: 1.5 }}
          >
            Showing the first {LIST_LIMIT} of {unlabeled.length}. Choose fewer
            event codes, or pick on the chart.
          </Typography>
        )}
        {unlabeled.length === 0 && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ px: 3, py: 1.5 }}
          >
            No other events with these codes on the chart&apos;s phases.
          </Typography>
        )}
      </Box>
    </Box>
  )
}
