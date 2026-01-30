import { UsageEntry } from '@/api/config'
import ReportsApiInsightsCard from '@/features/data/components/ReportApiInsightsCard/ReportApiInsightsCard'
import UsageEntryFilters, {
  UsageEntryFiltersState,
} from '@/features/data/components/UsageEntryFilters'
import UsageTable from '@/features/data/components/UsageTable'
import { formatBytes } from '@/utils/formatting'
import { Card, CardContent, Paper, Stack, Typography } from '@mui/material'
import * as React from 'react'

interface UsageSummaryTabProps {
  rows: UsageEntry[]
  users?: any
  usersLoading?: boolean
  filters: UsageEntryFiltersState
  onFiltersChange: (next: UsageEntryFiltersState) => void
  onResetFilters: () => void
  dateRange?: { start: string | undefined; end: string | undefined }
}

function StatCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Paper sx={{ minWidth: 240, flex: '1 1 240px' }}>
      <CardContent>
        <Typography variant="h5" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="h3" sx={{ fontWeight: 600 }}>
          {value}
        </Typography>
      </CardContent>
    </Paper>
  )
}

export default function UsageSummaryTab({
  rows,
  users,
  filters,
  onFiltersChange,
  onResetFilters,
  usersLoading,
  dateRange,
}: UsageSummaryTabProps) {
  const reportRows = React.useMemo(
    () => rows.filter((r) => r.apiName?.includes('ReportApi')),
    [rows]
  )

  const dataRows = React.useMemo(
    () => rows.filter((r) => r.apiName?.includes('DataApi')),
    [rows]
  )

  const totalReportsGenerated = reportRows.length

  const totalDataDownloaded = React.useMemo(() => {
    let total = 0
    for (const r of dataRows) total += r.resultSizeBytes ?? 0
    return formatBytes(total)
  }, [dataRows])

  const tableData = React.useMemo(() => {
    return reportRows.map((r) => {
      const user = users?.find((u: any) => u.userId === r.userId)
      if (user) (r as any).user = user.userName
      return r
    })
  }, [reportRows, users])

  return (
    <Stack spacing={2}>
      <Stack
        direction="row"
        spacing={2}
        sx={{ flexWrap: 'wrap', alignItems: 'stretch' }}
      >
        <UsageEntryFilters
          value={filters}
          onChange={onFiltersChange}
          onReset={onResetFilters}
          users={users}
          usersLoading={usersLoading}
        />

        <StatCard
          label="Reports generated"
          value={totalReportsGenerated.toLocaleString()}
        />

        <StatCard label="Total data downloaded" value={totalDataDownloaded} />
      </Stack>

      {/* Keep everything else exactly like before */}
      <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap' }}>
        <ReportsApiInsightsCard
          rows={rows}
          users={users}
          usersLoading={usersLoading}
          dateRange={dateRange}
        />
      </Stack>

      <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap' }}>
        <Card sx={{ width: '100%' }}>
          <CardContent sx={{ p: 0 }}>
            <UsageTable isLoading={false} rows={tableData} />
          </CardContent>
        </Card>
      </Stack>
    </Stack>
  )
}
