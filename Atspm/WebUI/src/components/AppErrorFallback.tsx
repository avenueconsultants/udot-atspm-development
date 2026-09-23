import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import { FallbackProps } from 'react-error-boundary'

export function AppErrorFallback({ resetErrorBoundary }: FallbackProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        textAlign: 'center',
        gap: 2,
      }}
    >
      <Typography variant="h4" component="h1" gutterBottom>
        Something went wrong
      </Typography>
      <Typography variant="body1" gutterBottom>
        An unexpected error occurred while loading this page.
      </Typography>
      <Button variant="contained" color="primary" onClick={resetErrorBoundary}>
        Try again
      </Button>
    </Box>
  )
}
