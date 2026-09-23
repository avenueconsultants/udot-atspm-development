import type {
  LeftTurnGapDataCheckOptions,
  LeftTurnGapReportOptions,
  LeftTurnGapReportResult,
} from '@/api/reports'
import type { LeftTurnGapReportFormState } from '@/features/leftTurnGapReport/types'
import ReportPage from '@/pages/left-turn-gap-report'
import { CONFIG_API, odataCollection, REPORTS_API } from '@/test/fixtures/api'
import { server } from '@/test/msw/server'
import {
  renderWithProviders,
  screen,
  userEvent,
  waitFor,
} from '@/test/test-utils'
import { http, HttpResponse } from 'msw'
import type { Dispatch, ReactNode, SetStateAction } from 'react'

jest.mock('@/lib/Authorization', () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => children,
}))
jest.mock('@/components/ResponsivePage', () => ({
  ResponsivePageLayout: ({ children }: { children: ReactNode }) => children,
}))
jest.mock('jspdf', () => ({ jsPDF: jest.fn() }))
// Keep real generated clients, query behavior, and report rendering. Stub only
// the map-heavy form so selection and request assertions remain focused.
jest.mock(
  '@/features/leftTurnGapReport/components/LeftTurnGapReportForm',
  () => ({
    __esModule: true,
    default: ({
      setParams,
    }: {
      setParams: Dispatch<SetStateAction<LeftTurnGapReportFormState>>
    }) => (
      <button
        onClick={() =>
          setParams((state) => ({
            ...state,
            location: { id: 1, locationIdentifier: '1001' },
            approachIds: [11, 12],
            startDateTime: new Date('2026-04-01T08:00:00Z'),
            endDateTime: new Date('2026-04-01T09:00:00Z'),
            pedestrianCallAnalysis: false,
            conflictingVolumesAnalysis: true,
          }))
        }
      >
        Select approaches
      </button>
    ),
  })
)

it('checks each approach, recovers from a rejected check, and submits a typed report', async () => {
  let rejectCheck = true
  const checks: LeftTurnGapDataCheckOptions[] = []
  const reports: LeftTurnGapReportOptions[] = []
  server.use(
    http.get(CONFIG_API + '/Approach', () =>
      HttpResponse.json(odataCollection('Approach', []))
    ),
    http.post(
      REPORTS_API + '/LeftTurnGapReportDataCheck/getReportData',
      async ({ request }) => {
        const body = (await request.json()) as LeftTurnGapDataCheckOptions
        checks.push(body)
        if (rejectCheck)
          return HttpResponse.json(
            { detail: 'Try this check again' },
            { status: 503 }
          )
        return HttpResponse.json({
          approachId: body.approachId,
          approachDescription: body.approachId === 11 ? 'NB Main' : 'SB Main',
          locationDescription: 'Main & First',
          start: body.start,
          end: body.end,
        })
      }
    ),
    http.post(
      REPORTS_API + '/LeftTurnGapReport/getReportData',
      async ({ request }) => {
        reports.push((await request.json()) as LeftTurnGapReportOptions)
        const result: LeftTurnGapReportResult[] = [
          { direction: 'NB', capacity: 100, demand: 50, vcRatio: 0.5 },
        ]
        return HttpResponse.json(result)
      }
    )
  )
  const user = userEvent.setup()
  renderWithProviders(<ReportPage />)
  expect(screen.getByRole('button', { name: 'Run Report' })).toBeDisabled()
  await user.click(screen.getByRole('button', { name: 'Select approaches' }))
  await user.click(screen.getByRole('button', { name: 'Run Check' }))
  expect(await screen.findByText('Try this check again')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Run Report' })).toBeDisabled()
  rejectCheck = false
  await user.click(screen.getByRole('button', { name: 'Run Check' }))
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Run Report' })).toBeEnabled()
  )
  expect(screen.getByText('NB Main')).toBeVisible()
  expect(screen.getByText('SB Main')).toBeVisible()
  expect(
    checks
      .slice(-2)
      .map((check) => check.approachId)
      .sort()
  ).toEqual([11, 12])
  await user.click(screen.getByRole('button', { name: 'Run Report' }))
  expect(await screen.findByText('Left Turn Approach: NB')).toBeVisible()
  expect(reports).toEqual([
    expect.objectContaining({
      locationIdentifier: '1001',
      approachIds: [11, 12],
      start: '2026-04-01T08:00:00.000Z',
      end: '2026-04-01T09:00:00.000Z',
      getPedestrianCall: false,
      getConflictingVolume: true,
      acceptableGapPercentage: 0.7,
      acceptableSplitFailPercentage: 0.5,
    }),
  ])
})
