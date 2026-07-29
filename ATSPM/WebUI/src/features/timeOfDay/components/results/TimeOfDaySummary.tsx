import type { TimeOfDayResult } from '@/api/reports'
import { Box, Card, CardContent, Typography } from '@mui/material'

interface SummaryItem {
  label: string
  value: string
}

interface TimeOfDaySummaryProps {
  result: TimeOfDayResult
  peakItems: SummaryItem[]
}

interface SummaryCardProps {
  label: string
  value: string
  isMetric?: boolean
}

function SummaryCard({ label, value, isMetric = false }: SummaryCardProps) {
  return (
    <Card
      variant="outlined"
      sx={{
        height: '100%',
        borderColor: 'divider',
        borderTopWidth: 3,
        borderTopColor: isMetric ? 'primary.main' : 'grey.400',
        boxShadow: 'none',
      }}
    >
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Typography
          component="h4"
          variant="subtitle2"
          sx={{ mb: 0.75, fontWeight: 700 }}
        >
          {label}
        </Typography>
        <Typography
          variant={isMetric ? 'body1' : 'body2'}
          sx={{
            fontWeight: isMetric ? 600 : 400,
            whiteSpace: 'pre-line',
          }}
        >
          {value}
        </Typography>
      </CardContent>
    </Card>
  )
}

export default function TimeOfDaySummary({
  result,
  peakItems,
}: TimeOfDaySummaryProps) {
  const narrativeItems = [
    {
      label: 'Recommendation',
      value: result.recommendation?.summaryText,
    },
    {
      label: 'Pressure Summary',
      value: result.splitPressure?.summaryText,
    },
    {
      label: 'Review',
      value: result.splitPressure?.reviewText,
    },
  ].filter(
    (item): item is SummaryItem =>
      typeof item.value === 'string' && item.value.length > 0
  )

  if (peakItems.length === 0 && narrativeItems.length === 0) return null

  return (
    <Box
      component="section"
      aria-labelledby="time-of-day-summary-heading"
      sx={{
        px: { xs: 1.5, sm: 2 },
        py: 2,
        border: '1px solid',
        borderTop: 0,
        borderColor: 'divider',
        bgcolor: 'grey.50',
      }}
    >
      <Typography
        id="time-of-day-summary-heading"
        component="h3"
        variant="h6"
        sx={{ mb: 1.5, fontSize: '1rem', fontWeight: 700 }}
      >
        Summary
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gridAutoRows: '1fr',
          gap: 1.5,
        }}
      >
        {peakItems.map((item) => (
          <SummaryCard
            key={item.label}
            label={item.label}
            value={item.value}
            isMetric
          />
        ))}
        {narrativeItems.map((item) => (
          <SummaryCard key={item.label} label={item.label} value={item.value} />
        ))}
      </Box>
    </Box>
  )
}
