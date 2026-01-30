import { UsageEntry } from '@/api/config'
import ApacheEChart from '@/features/charts/components/apacheEChart'
import { Color } from '@/features/charts/utils'
import { Box, Card, CardContent, Typography } from '@mui/material'
import * as React from 'react'

export type IdentityUser = {
  firstName?: string | null
  lastName?: string | null
  agency?: string | null
  email?: string | null
  userName?: string | null
  userId: string
  fullName?: string | null
  roles?: string[] | null
}

function normalizeUsers(users: any): IdentityUser[] {
  if (!users) return []
  if (Array.isArray(users)) return users as IdentityUser[]
  if (typeof users === 'object') return Object.values(users) as IdentityUser[]
  return []
}

function getUserLabel(u?: IdentityUser | null) {
  if (!u) return 'Unknown'
  return u.fullName?.trim() || u.email?.trim() || u.userName?.trim() || u.userId
}

type SeriesPoint = { name: string; count: number }

export default function ReportsApiUserCard({
  rows,
  users,
  title = 'Reports usage by user',
  height = 600,
  maxBars = 30,
}: {
  rows: UsageEntry[]
  users?: any // array OR object keyed like {"0": {...}}
  title?: string
  height?: number
  maxBars?: number
}) {
  const usersList = React.useMemo(() => normalizeUsers(users), [users])

  const userById = React.useMemo(() => {
    const m = new Map<string, IdentityUser>()
    for (const u of usersList) {
      if (u?.userId) m.set(u.userId, u)
    }
    return m
  }, [usersList])

  const reportRows = React.useMemo(
    () => rows.filter((r) => r.apiName?.includes('ReportApi')),
    [rows]
  )

  const data: SeriesPoint[] = React.useMemo(() => {
    const m = new Map<string, number>()
    for (const r of reportRows) {
      const uid = r.userId || ''
      const u = uid ? userById.get(uid) : undefined
      const label = uid ? getUserLabel(u) : 'Unknown'
      m.set(label, (m.get(label) ?? 0) + 1)
    }
    return [...m.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
  }, [reportRows, userById])

  const active = React.useMemo(() => data.slice(0, maxBars), [data, maxBars])

  return (
    <Card sx={{ flex: '1 1 480px', minWidth: 480 }}>
      <CardContent sx={{ pb: 1 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
          {title}
        </Typography>
      </CardContent>

      <CardContent sx={{ pt: 0 }}>
        <Box sx={{ height }}>
          <ApacheEChart
            option={{
              tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
              grid: { left: 260, right: 20, top: 20, bottom: 20 },
              xAxis: { type: 'value' },
              yAxis: {
                type: 'category',
                data: active.map((x) => x.name),
                axisLabel: { width: 240, overflow: 'truncate' },
              },
              color: Color.LightBlue,
              series: [
                {
                  type: 'bar',
                  data: active.map((x) => x.count),
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
