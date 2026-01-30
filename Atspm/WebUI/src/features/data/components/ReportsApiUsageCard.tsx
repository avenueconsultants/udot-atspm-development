import { UsageEntry } from '@/api/config'
import {
  createGrid,
  createTooltip,
} from '@/features/charts/common/transformers'
import ApacheEChart from '@/features/charts/components/apacheEChart'
import { Color } from '@/features/charts/utils'
import {
  Box,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material'
import * as React from 'react'

export default function ReportsApiUsageCard({
  rows,
  title = 'Charts Generated',
  height = 420,
}: {
  rows: UsageEntry[]
  title?: string
  maxBars?: number
  height?: number
}) {
  type SortBy = 'Name' | 'Usage'
  const [sortBy, setSortBy] = React.useState<SortBy>('Usage')
  const data = React.useMemo(() => {
    const m = new Map<string, number>()

    for (const r of rows) {
      if (!r.apiName?.includes('ReportApi')) continue
      const key = r.controller || 'Unknown'
      m.set(key, (m.get(key) ?? 0) + 1)
    }

    return [...m.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) =>
        sortBy === 'Name' ? b.name.localeCompare(a.name) : a.count - b.count
      )
  }, [rows, sortBy])

  const tooltip = createTooltip()
  const grid = createGrid({ left: 180, right: 20, top: 20, bottom: 20 })

  return (
    <Card sx={{ flex: '1 1 720px', minWidth: 720 }}>
      <CardContent>
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
            {title}
          </Typography>

          <Box sx={{ flex: 1 }} />

          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel id="sort-by-label">Sort by</InputLabel>
            <Select
              labelId="sort-by-label"
              label="Sort by"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
            >
              <MenuItem value="Name">Name</MenuItem>
              <MenuItem value="Usage">Usage</MenuItem>
            </Select>
          </FormControl>
        </Stack>

        <Box sx={{ height }}>
          <ApacheEChart
            option={{
              tooltip,
              grid,
              xAxis: { type: 'value' },
              yAxis: {
                type: 'category',
                data: data.map((x) => x.name),
                axisLabel: { width: 200, overflow: 'truncate' },
              },
              color: Color.LightBlue,
              series: [
                {
                  type: 'bar',
                  data: data.map((x) => x.count),
                  label: { show: true, position: 'right' },
                },
              ],
            }}
            style={{ height: '100%', width: '100%' }}
          />
        </Box>
      </CardContent>
    </Card>
  )
}
