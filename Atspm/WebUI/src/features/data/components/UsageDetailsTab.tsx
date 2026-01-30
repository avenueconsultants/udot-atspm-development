import { UsageEntry } from '@/api/config'
import UsageTable from '@/features/data/components/UsageTable'
import { Card, CardContent } from '@mui/material'

export function UsageDetailedTab({
  isLoading,
  rows,
}: {
  isLoading: boolean
  rows: UsageEntry[]
}) {
  return (
    <Card>
      <CardContent sx={{ p: 0 }}>
        <UsageTable isLoading={isLoading} rows={rows} />
      </CardContent>
    </Card>
  )
}
