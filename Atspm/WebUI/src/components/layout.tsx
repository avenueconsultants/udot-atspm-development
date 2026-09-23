import Sidebar from '@/components/sidebar/Sidebar'
import Toast from '@/components/toast'
import { Box, useTheme } from '@mui/material'
import React from 'react'
import { ErrorBoundary } from 'react-error-boundary'
import Topbar from './topbar'

interface LayoutProps {
  children: React.ReactNode
}

// The chrome renders outside the page-level ErrorBoundary in _app.tsx (that
// one wraps only <Component />), so before this an error thrown while
// rendering Topbar or Sidebar had nowhere to land and blanked the entire
// app - the page content included. Losing a nav bar is recoverable; losing
// the whole page isn't, so each chrome piece degrades to nothing on its own
// rather than taking down its sibling or the page.
const renderNothing = () => null

function ChromeErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary FallbackComponent={renderNothing}>{children}</ErrorBoundary>
  )
}

export default function Layout({ children }: LayoutProps) {
  const theme = useTheme()

  return (
    <Box className="app" sx={{ display: 'flex' }}>
      <Box
        component="main"
        className="content"
        sx={{
          backgroundColor: theme.palette.background.default,
        }}
      >
        <ChromeErrorBoundary>
          <Topbar />
        </ChromeErrorBoundary>
        <Box
          sx={{
            minHeight: `calc(100vh - 73px)`,
            width: '100%',
            p: 3,
            transition: 'width 0.3s ease-out',
            [theme.breakpoints.down('sm')]: {
              padding: theme.spacing(1),
            },
            [theme.breakpoints.down('xs')]: {
              padding: theme.spacing(0),
            },
          }}
        >
          {children}
        </Box>
        <ChromeErrorBoundary>
          <Sidebar />
        </ChromeErrorBoundary>
        <Toast />
      </Box>
    </Box>
  )
}
