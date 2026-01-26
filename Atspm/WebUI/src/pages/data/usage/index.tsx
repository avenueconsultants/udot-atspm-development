import { useGetUsageEntry } from '@/api/config'
import ApacheEChart from '@/features/charts/components/apacheEChart'
import UsageEntryFilters, {
  UsageEntryFiltersState,
} from '@/features/data/components/UsageEntryFilters'
import UsageTable from '@/features/data/components/UsageTable'
import { useGetAllUsers } from '@/features/identity/api/getAllUsers'
import { Box, Card, CardContent, Chip, Stack, Typography } from '@mui/material'
import * as React from 'react'

export function formatMs(ms: number) {
  if (!Number.isFinite(ms)) return ''
  if (ms < 1000) return `${ms} ms`
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(2)} s`
  const m = Math.floor(s / 60)
  const r = s - m * 60
  return `${m}m ${r.toFixed(1)}s`
}

function statusClassOf(code: number): '2xx' | '4xx' | '5xx' | 'other' {
  if (code >= 200 && code < 300) return '2xx'
  if (code >= 400 && code < 500) return '4xx'
  if (code >= 500 && code < 600) return '5xx'
  return 'other'
}

export default function UsageEntriesPage() {
  const [fromUtc, setFromUtc] = React.useState<string | undefined>(() => {
    const d = new Date(Date.now() - 24 * 60 * 60 * 1000)
    return d.toISOString()
  })
  const [toUtc, setToUtc] = React.useState<string | undefined>(() =>
    new Date().toISOString()
  )

  const [apiName, setApiName] = React.useState('')
  const [method, setMethod] = React.useState<string>('')
  const [success, setSuccess] = React.useState<'all' | 'true' | 'false'>('all')
  const [statusClass, setStatusClass] = React.useState<
    'all' | '2xx' | '4xx' | '5xx'
  >('all')
  const [userId, setUserId] = React.useState('')

  const [page, setPage] = React.useState(0)
  const [pageSize, setPageSize] = React.useState(50)

  const filters: UsageEntryFiltersState = React.useMemo(
    () => ({ fromUtc, toUtc, apiName, method, success, statusClass, userId }),
    [fromUtc, toUtc, apiName, method, success, statusClass, userId]
  )

  const setFilters = (next: UsageEntryFiltersState) => {
    setFromUtc(next.fromUtc)
    setToUtc(next.toUtc)
    setApiName(next.apiName)
    setMethod(next.method)
    setSuccess(next.success)
    setStatusClass(next.statusClass)
    setUserId(next.userId)
    setPage(0)
  }

  const clearFilters = () => {
    setApiName('')
    setMethod('')
    setSuccess('all')
    setStatusClass('all')
    setUserId('')
    setPage(0)
  }

  const { data: usageData, isLoading } = useGetUsageEntry()
  const { data: userData } = useGetAllUsers()

  console.log('userData', userData)

  const rows = usageData?.value ?? []
  const total = usageData?.total ?? 0

  const successRate = React.useMemo(() => {
    if (!rows.length) return null
    const ok = rows.filter((r) => r.success).length
    return (ok / rows.length) * 100
  }, [rows])

  // ---- Small client-side aggregates for charts (current page only) ----
  const byApiName = React.useMemo(() => {
    const m = new Map<string, number>()
    for (const r of rows) {
      const k = r.apiName || '(unknown)'
      m.set(k, (m.get(k) ?? 0) + 1)
    }
    return [...m.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12)
  }, [rows])

  const byStatusClass = React.useMemo(() => {
    const m = new Map<string, number>()
    for (const r of rows) {
      const k = statusClassOf(r.statusCode)
      m.set(k, (m.get(k) ?? 0) + 1)
    }
    const order = ['2xx', '4xx', '5xx', 'other']
    return order
      .filter((k) => m.has(k))
      .map((k) => ({ name: k, count: m.get(k) ?? 0 }))
  }, [rows])

  return (
    <Box sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="h5" sx={{ fontWeight: 800 }}>
            Usage Analytics
          </Typography>
          <Chip
            size="small"
            label="API usage / behavioral view"
            variant="outlined"
          />
        </Stack>

        {/* Filters */}
        <UsageEntryFilters
          value={filters}
          onChange={setFilters}
          onReset={clearFilters}
        />

        {/* KPIs + charts */}
        <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap' }}>
          <Card sx={{ minWidth: 220, flex: '1 1 220px' }}>
            <CardContent>
              <Typography variant="overline">Requests (page)</Typography>
              <Typography variant="h5" sx={{ fontWeight: 800 }}>
                {rows.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total matches: {total}
              </Typography>
            </CardContent>
          </Card>

          <Card sx={{ minWidth: 220, flex: '1 1 220px' }}>
            <CardContent>
              <Typography variant="overline">Success rate (page)</Typography>
              <Typography variant="h5" sx={{ fontWeight: 800 }}>
                {successRate == null ? '—' : `${successRate.toFixed(1)}%`}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Based on current page rows
              </Typography>
            </CardContent>
          </Card>
        </Stack>

        <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap' }}>
          <Card sx={{ flex: '1 1 520px', minWidth: 520 }}>
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1 }}>
                Top APIs (current page)
              </Typography>
              <Box sx={{ height: 260 }}>
                <ApacheEChart
                  option={{
                    tooltip: { trigger: 'axis' },
                    grid: { left: 40, right: 10, top: 20, bottom: 40 },
                    xAxis: {
                      type: 'category',
                      data: byApiName.map((x) => x.name),
                      axisLabel: { rotate: 30 },
                    },
                    yAxis: { type: 'value' },
                    series: [
                      {
                        type: 'bar',
                        data: byApiName.map((x) => x.count),
                      },
                    ],
                  }}
                  style={{ height: '100%', width: '100%' }}
                />
              </Box>
            </CardContent>
          </Card>

          <Card sx={{ flex: '1 1 360px', minWidth: 360 }}>
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1 }}>
                Status class (current page)
              </Typography>
              <Box sx={{ height: 260 }}>
                <ApacheEChart
                  option={{
                    tooltip: { trigger: 'item' },
                    series: [
                      {
                        type: 'pie',
                        radius: ['40%', '70%'],
                        avoidLabelOverlap: true,
                        label: { show: true, formatter: '{b}: {c}' },
                        data: byStatusClass.map((x) => ({
                          name: x.name,
                          value: x.count,
                        })),
                      },
                    ],
                  }}
                  style={{ height: '100%', width: '100%' }}
                />
              </Box>
            </CardContent>
          </Card>
        </Stack>

        {/* Grid */}
        <Card>
          <CardContent sx={{ p: 0 }}>
            <UsageTable
              isLoading={isLoading}
              page={page}
              pageSize={pageSize}
              rows={rows}
              setPage={setPage}
              setPageSize={setPageSize}
              total={total}
            />
          </CardContent>
        </Card>
      </Stack>
    </Box>
  )
}
