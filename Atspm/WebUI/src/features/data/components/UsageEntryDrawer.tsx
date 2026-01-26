import { UsageEntry } from '@/api/config/aTSPMConfigurationApi.schemas'
import { formatMs } from '@/pages/data/usage'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import {
  Box,
  Chip,
  Divider,
  Drawer,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material'
import React from 'react'

interface UsageEntryDrawerProps {
  active: UsageEntry | null
  setActive: (entry: UsageEntry | null) => void
}

export default function UsageEntryDrawer({
  active,
  setActive,
}: UsageEntryDrawerProps) {
  return (
    <Drawer
      anchor="right"
      open={Boolean(active)}
      onClose={() => setActive(null)}
      PaperProps={{ sx: { width: 520 } }}
    >
      <Box sx={{ p: 2 }}>
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              Usage Entry
            </Typography>
            <Box sx={{ flex: 1 }} />
            {active?.traceId ? (
              <Tooltip title="Copy TraceId">
                <IconButton
                  size="small"
                  onClick={async () => {
                    await navigator.clipboard.writeText(active.traceId || '')
                  }}
                >
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            ) : null}
          </Stack>

          {active ? (
            <Stack spacing={1}>
              <Typography variant="body2" color="text.secondary">
                {active.timestamp}
              </Typography>

              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                <Chip
                  size="small"
                  label={active.apiName || '(unknown api)'}
                  variant="outlined"
                />
                <Chip
                  size="small"
                  label={active.method || '(method?)'}
                  variant="outlined"
                />
                <Chip
                  size="small"
                  label={`Status ${active.statusCode}`}
                  variant="outlined"
                />
                <Chip
                  size="small"
                  label={formatMs(active.durationMs)}
                  variant="outlined"
                />
                {active.success ? (
                  <Chip size="small" label="Success" color="success" />
                ) : (
                  <Chip size="small" label="Failed" color="error" />
                )}
              </Stack>

              <Divider />

              <Stack spacing={1}>
                <Row label="User" value={active.userId} />
                <Row label="Remote IP" value={active.remoteIp} />
                <Row label="Route" value={active.route} />
                <Row label="Query" value={active.queryString} />
                <Row label="Controller" value={active.controller} />
                <Row label="Action" value={active.action} />
                <Row label="ResultCount" value={active.resultCount} />
                <Row label="ResultSizeBytes" value={active.resultSizeBytes} />
                <Row label="TraceId" value={active.traceId} />
                <Row label="ConnectionId" value={active.connectionId} />
              </Stack>

              {active.errorMessage ? (
                <>
                  <Divider />
                  <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                    Error
                  </Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                    {active.errorMessage}
                  </Typography>
                </>
              ) : null}

              <Divider />

              <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                Raw JSON
              </Typography>
              <Box
                component="pre"
                sx={{
                  m: 0,
                  p: 1,
                  borderRadius: 1,
                  bgcolor: 'action.hover',
                  overflow: 'auto',
                  maxHeight: 240,
                  fontSize: 12,
                }}
              >
                {JSON.stringify(active, null, 2)}
              </Box>
            </Stack>
          ) : null}
        </Stack>
      </Box>
    </Drawer>
  )
}

function Row({
  label,
  value,
}: {
  label: string
  value: React.ReactNode | null | undefined
}) {
  return (
    <Stack direction="row" spacing={1} alignItems="baseline">
      <Typography
        variant="caption"
        sx={{ fontWeight: 800, minWidth: 130, color: 'text.secondary' }}
      >
        {label}
      </Typography>
      <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
        {value == null || value === '' ? '—' : value}
      </Typography>
    </Stack>
  )
}
