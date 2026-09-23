import type { DetectionTypeGroup, DeviceGroup } from '@/api/config'
import type { WatchDogDashboardGroup } from '@/api/reports'
import { AppErrorBoundary } from '@/components/AppErrorBoundary'
import type WatchdogChartsContainer from '@/features/charts/watchdogDashboard/components/WatchdogChartsContainer'
import { CONFIG_API, odataCollection, REPORTS_API } from '@/test/fixtures/api'
import { server } from '@/test/msw/server'
import {
  renderWithProviders,
  screen,
  userEvent,
  waitFor,
} from '@/test/test-utils'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFnsV3'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { useIsMutating } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import type { ComponentProps } from 'react'
import WatchdogSummaryReport from './WatchDogSummaryReport'

jest.mock(
  '@/features/charts/watchdogDashboard/components/WatchdogChartsContainer',
  () => ({
    __esModule: true,
    default: function SummaryCharts({
      data,
    }: ComponentProps<typeof WatchdogChartsContainer>) {
      return (
        <output aria-label="Summary chart data">{JSON.stringify(data)}</output>
      )
    },
  })
)

function PendingDashboardRequests() {
  const pendingRequests = useIsMutating()
  return (
    <output aria-label="Pending dashboard requests">{pendingRequests}</output>
  )
}

const deviceCounts = [
  { manufacturer: 'Example', model: 'Controller', firmware: '1.0', count: 7 },
] satisfies DeviceGroup[]
const detectionCounts = [
  { id: 'AdvancedCount', count: 11 },
] satisfies DetectionTypeGroup[]
const dashboard = {
  controllerTypeGroup: [{ name: 'Example', model: [] }],
  issueTypeGroup: [],
  detectionTypeGroup: [],
} satisfies WatchDogDashboardGroup

it.each([
  ['device', 403],
  ['detection', 500],
] as const)(
  'shows a failed %s count query (%i) and retries it with Generate Summary',
  async (failedCount, status) => {
    let rejectLookup = true
    let deviceReads = 0
    let detectionReads = 0
    let dashboardPosts = 0
    let releaseRecoveredLookup: () => void = () => {
      throw new Error('Deferred lookup was not initialized')
    }
    const recoveredLookup = new Promise<void>((resolve) => {
      releaseRecoveredLookup = resolve
    })
    const failureMessage = `${failedCount} counts unavailable`
    server.use(
      http.get(`${CONFIG_API}/Device/GetActiveDevicesCount`, async () => {
        deviceReads++
        if (failedCount === 'device') {
          if (rejectLookup) {
            return HttpResponse.json({ detail: failureMessage }, { status })
          }
          await recoveredLookup
        }
        return HttpResponse.json(odataCollection('DeviceGroup', deviceCounts))
      }),
      http.get(`${CONFIG_API}/Location/GetDetectionTypeCount`, async () => {
        detectionReads++
        if (failedCount === 'detection') {
          if (rejectLookup) {
            return HttpResponse.json({ detail: failureMessage }, { status })
          }
          await recoveredLookup
        }
        return HttpResponse.json(
          odataCollection('DetectionTypeGroup', detectionCounts)
        )
      }),
      http.post(`${REPORTS_API}/WatchDogDashboard/getDashboardGroup`, () => {
        dashboardPosts++
        return HttpResponse.json(dashboard)
      })
    )

    try {
      renderWithProviders(
        <AppErrorBoundary resetKey="watchdog-summary">
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <WatchdogSummaryReport />
            <PendingDashboardRequests />
          </LocalizationProvider>
        </AppErrorBoundary>
      )
      await waitFor(() => {
        expect(deviceReads).toBe(1)
        expect(detectionReads).toBe(1)
        expect(
          screen.getByRole('button', { name: 'Generate Summary' })
        ).toBeEnabled()
      })
      await userEvent.click(
        screen.getByRole('button', { name: 'Generate Summary' })
      )
      await waitFor(() => expect(dashboardPosts).toBe(1))
      await waitFor(() =>
        expect(
          screen.getByRole('button', { name: 'Generate Summary' })
        ).toBeEnabled()
      )

      expect(await screen.findByRole('alert')).toHaveTextContent(
        `Error loading data: ${failureMessage}`
      )
      expect(
        screen.queryByRole('heading', { name: 'Something went wrong' })
      ).not.toBeInTheDocument()
      expect(
        screen.queryByLabelText('Summary chart data')
      ).not.toBeInTheDocument()

      rejectLookup = false
      await userEvent.click(
        screen.getByRole('button', { name: 'Generate Summary' })
      )
      await waitFor(() => expect(dashboardPosts).toBe(2))
      // The POST has completed; only the deferred count lookup can keep the
      // button pending here.
      await waitFor(() =>
        expect(
          screen.getByLabelText('Pending dashboard requests')
        ).toHaveTextContent('0')
      )
      expect(
        screen.getByRole('button', { name: 'Generate Summary' })
      ).toBeDisabled()
      expect(
        screen.queryByLabelText('Summary chart data')
      ).not.toBeInTheDocument()
      releaseRecoveredLookup()

      const chartData = await screen.findByLabelText('Summary chart data')
      expect(JSON.parse(chartData.textContent ?? '{}')).toEqual({
        ...dashboard,
        deviceCount: deviceCounts,
        detectionTypeCount: detectionCounts,
      })
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'Generate Summary' })
      ).toBeEnabled()
      expect(failedCount === 'device' ? deviceReads : detectionReads).toBe(3)
      expect(failedCount === 'device' ? detectionReads : deviceReads).toBe(1)
    } finally {
      releaseRecoveredLookup()
    }
  }
)
