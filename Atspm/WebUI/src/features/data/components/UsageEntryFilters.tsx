import FilterAltIcon from '@mui/icons-material/FilterAlt'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import {
  Box,
  Button,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker'

function toIsoUtcOrUndefined(d: Date | null): string | undefined {
  if (!d) return undefined
  return d.toISOString()
}
function toDateOrNull(iso?: string): Date | null {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

export type UsageEntryFiltersState = {
  fromUtc?: string
  toUtc?: string
  apiName: string
  method: string
  success: 'all' | 'true' | 'false'
  statusClass: 'all' | '2xx' | '4xx' | '5xx'
  userId: string
}

export default function UsageEntryFilters({
  value,
  onChange,
  onReset,
}: {
  value: UsageEntryFiltersState
  onChange: (next: UsageEntryFiltersState) => void
  onReset: () => void
}) {
  const set = <K extends keyof UsageEntryFiltersState>(
    key: K,
    nextValue: UsageEntryFiltersState[K]
  ) => {
    onChange({ ...value, [key]: nextValue })
  }

  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            sx={{ flexWrap: 'wrap' }}
          >
            <FilterAltIcon fontSize="small" />
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Filters
            </Typography>

            <Box sx={{ flex: 1 }} />

            <Button
              size="small"
              startIcon={<RestartAltIcon />}
              onClick={onReset}
            >
              Reset
            </Button>
          </Stack>

          <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap' }}>
            <DateTimePicker
              label="From (UTC)"
              value={toDateOrNull(value.fromUtc)}
              onChange={(v) => set('fromUtc', toIsoUtcOrUndefined(v))}
              slotProps={{
                textField: { size: 'small', sx: { minWidth: 240 } },
              }}
            />

            <DateTimePicker
              label="To (UTC)"
              value={toDateOrNull(value.toUtc)}
              onChange={(v) => set('toUtc', toIsoUtcOrUndefined(v))}
              slotProps={{
                textField: { size: 'small', sx: { minWidth: 240 } },
              }}
            />

            <TextField
              size="small"
              label="API name"
              value={value.apiName}
              onChange={(e) => set('apiName', e.target.value)}
              sx={{ minWidth: 220 }}
            />

            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel id="method-lbl">Method</InputLabel>
              <Select
                labelId="method-lbl"
                label="Method"
                value={value.method}
                onChange={(e) => set('method', String(e.target.value))}
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="GET">GET</MenuItem>
                <MenuItem value="POST">POST</MenuItem>
                <MenuItem value="PUT">PUT</MenuItem>
                <MenuItem value="PATCH">PATCH</MenuItem>
                <MenuItem value="DELETE">DELETE</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel id="success-lbl">Success</InputLabel>
              <Select
                labelId="success-lbl"
                label="Success"
                value={value.success}
                onChange={(e) => set('success', e.target.value as any)}
              >
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="true">Success</MenuItem>
                <MenuItem value="false">Failed</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel id="status-lbl">Status class</InputLabel>
              <Select
                labelId="status-lbl"
                label="Status class"
                value={value.statusClass}
                onChange={(e) => set('statusClass', e.target.value as any)}
              >
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="2xx">2xx</MenuItem>
                <MenuItem value="4xx">4xx</MenuItem>
                <MenuItem value="5xx">5xx</MenuItem>
              </Select>
            </FormControl>

            <TextField
              size="small"
              label="UserId"
              value={value.userId}
              onChange={(e) => set('userId', e.target.value)}
              sx={{ minWidth: 200 }}
            />
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  )
}
