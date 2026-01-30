import { UsageEntry } from '@/api/config'
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

type GroupBy = 'day' | 'week' | 'month'

function toDateKey(d: Date, groupBy: GroupBy) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')

  if (groupBy === 'day') return `${y}-${m}-${day}`
  if (groupBy === 'month') return `${y}-${m}`

  const oneJan = new Date(d.getFullYear(), 0, 1)
  const week =
    Math.ceil(
      ((d.getTime() - oneJan.getTime()) / 86400000 + oneJan.getDay() + 1) / 7
    ) || 1

  return `${y}-W${String(week).padStart(2, '0')}`
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

export default function ReportsApiUsageStackedByTimeCard({
  rows,
  title = 'Reports API Usage by Time and Chart',
  height,
}: {
  rows: UsageEntry[]
  title?: string
  height?: number
}) {
  const [groupBy, setGroupBy] = React.useState<GroupBy>('day')

  const { buckets, totals, charts, chartSeriesByBucket } = React.useMemo(() => {
    const bucketSet = new Set<string>()
    const chartSet = new Set<string>()

    const totalByBucket = new Map<string, number>()
    const byBucketByChart = new Map<string, Map<string, number>>()

    for (const r of rows) {
      if (!r.apiName?.includes('ReportApi')) continue
      if (!r.timestamp) continue

      const date = new Date(r.timestamp)
      if (Number.isNaN(date.getTime())) continue

      const bucket = toDateKey(date, groupBy)
      const chart = r.controller || 'Unknown'

      bucketSet.add(bucket)
      chartSet.add(chart)

      totalByBucket.set(bucket, (totalByBucket.get(bucket) ?? 0) + 1)

      if (!byBucketByChart.has(bucket)) byBucketByChart.set(bucket, new Map())
      const m = byBucketByChart.get(bucket)!
      m.set(chart, (m.get(chart) ?? 0) + 1)
    }

    const buckets = [...bucketSet].sort()
    const charts = [...chartSet].sort()

    const totals = buckets.map((b) => totalByBucket.get(b) ?? 0)

    const chartSeriesByBucket = charts.map((chart) =>
      buckets.map((b) => byBucketByChart.get(b)?.get(chart) ?? 0)
    )

    return { buckets, totals, charts, chartSeriesByBucket }
  }, [rows, groupBy])

  // Switch axes: buckets on Y, value on X; make card height scale with bucket count
  const computedHeight = React.useMemo(() => {
    if (height) return height
    // ~22px per row + header/legend padding
    return clamp(180 + buckets.length * 40, 320, 1600)
  }, [height, buckets.length])

  const series = React.useMemo(() => {
    // Main wide bar: total per bucket (horizontal)
    const totalSeries = {
      name: 'Total',
      type: 'bar' as const,
      data: totals,
      barWidth: 18,
      barGap: '60%',
      itemStyle: { color: Color.LightBlue },
      emphasis: { focus: 'series' as const },
      z: 1,
      label: { show: true, position: 'right' as const },
    }

    // Thin stacked bar on the side: composition by chart (horizontal)
    const thinSeries = charts.map((chart, idx) => ({
      name: chart,
      type: 'bar' as const,
      stack: 'byChart',
      data: chartSeriesByBucket[idx],
      barWidth: 6,
      barGap: '-130%',
      barCategoryGap: '25%',
      emphasis: { focus: 'series' as const },
      z: 2,
    }))

    return [totalSeries, ...thinSeries]
  }, [totals, charts, chartSeriesByBucket])

  return (
    <Card sx={{ flex: '1 1 980px', minWidth: 980 }}>
      <CardContent>
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
            {title}
          </Typography>

          <Box sx={{ flex: 1 }} />

          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel id="group-by-label">Group by</InputLabel>
            <Select
              labelId="group-by-label"
              label="Group by"
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as GroupBy)}
            >
              <MenuItem value="day">Day</MenuItem>
              <MenuItem value="week">Week</MenuItem>
              <MenuItem value="month">Month</MenuItem>
            </Select>
          </FormControl>
        </Stack>

        <Box sx={{ height: computedHeight }}>
          <ApacheEChart
            option={{
              tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'shadow' },
              },
              legend: {
                type: 'scroll',
                orient: 'vertical' as const,
                top: 10,
                right: 0,
                bottom: 10,
              },
              grid: {
                left: 90,
                right: 240,
                top: 20,
                bottom: 20,
                containLabel: true,
              },
              xAxis: { type: 'value' },
              yAxis: {
                type: 'category',
                data: buckets,
                axisLabel: { width: 80, overflow: 'truncate' },
              },
              series,
            }}
            style={{ height: '100%', width: '100%' }}
          />
        </Box>
      </CardContent>
    </Card>
  )
}
