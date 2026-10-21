import { expect, test, type Page } from '@playwright/test'
import { knownDates, scenarios } from '../fixtures/seedData'
import { TimeOfDayPage } from '../page-objects/TimeOfDayPage'

type ReportResult = {
  recommendation?: {
    recommendedSchedule?: unknown[]
    amPeakTime?: string
    pmPeakTime?: string
  }
  planProfile?: { corridorProfile?: { points?: unknown[] } }
  splitPressure?: {
    crossTrafficShare?: Array<{
      minutes?: number
      crossTrafficPercent?: number | null
    }>
  }
  warnings?: Array<{ code?: string }>
}

const generate = async (page: Page, query: string) => {
  const tod = new TimeOfDayPage(page)
  await tod.goto(query)
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/TimeOfDay') &&
      response.request().method() === 'POST'
  )
  await tod.generate()
  const response = await responsePromise
  expect(response.status()).toBe(200)
  return { tod, body: (await response.json()) as ReportResult }
}

test.describe('Time-of-day chart results', () => {
  test('renders the chart when usable volume data exists', async ({ page }) => {
    const { tod } = await generate(
      page,
      `?locations=${scenarios.commute}&dates=${knownDates.monday}&dataSource=Aggregated`
    )

    await expect(tod.results()).toBeVisible()
    await expect(page.getByText('No Data Available')).toHaveCount(0)
    await expect(
      page.getByRole('img', { name: 'Corridor time-of-day analysis chart' })
    ).toBeVisible()
  })

  test('keeps the analysis mode and sidebar detail tabs synchronized', async ({
    page,
  }) => {
    await generate(
      page,
      `?locations=${scenarios.commute}&dates=${knownDates.monday}&dataSource=Aggregated`
    )

    const peaks = page.getByRole('button', { name: 'Peaks' })
    const pressure = page.getByRole('button', {
      name: 'Movement Demand & Cross Traffic',
    })
    await expect(peaks).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('tab', { name: 'Signal Peaks' })).toBeVisible()

    await pressure.click()
    await expect(pressure).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('tab', { name: 'Signal Peaks' })).toHaveCount(0)
    await expect(page.getByRole('tab', { name: 'Cross Traffic' })).toBeVisible()

    await peaks.click()
    await expect(peaks).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('tab', { name: 'Cross Traffic' })).toHaveCount(0)
    await expect(page.getByRole('tab', { name: 'Signal Peaks' })).toBeVisible()
  })

  test('toggles a chart layer without requesting a new report', async ({
    page,
  }) => {
    let reportRequests = 0
    page.on('request', (request) => {
      if (
        request.url().includes('/api/v1/TimeOfDay') &&
        request.method() === 'POST'
      ) {
        reportRequests++
      }
    })
    await generate(
      page,
      `?locations=${scenarios.commute}&dates=${knownDates.monday}&dataSource=Aggregated`
    )
    const proposed = page.getByRole('checkbox', { name: 'Toggle Proposed' })
    await expect(proposed).toBeChecked()
    await proposed.uncheck()
    await expect(proposed).not.toBeChecked()
    await proposed.check()
    await expect(proposed).toBeChecked()
    expect(reportRequests).toBe(1)
  })

  test('returns empty analyses and renders No Data Available for zero observations', async ({
    page,
  }) => {
    const { body } = await generate(
      page,
      `?locations=${scenarios.zeroVolume}&dates=${knownDates.monday}&dataSource=Aggregated`
    )

    expect(body.recommendation?.recommendedSchedule ?? []).toEqual([])
    expect(body.planProfile?.corridorProfile?.points ?? []).toEqual([])
    expect(body.splitPressure?.crossTrafficShare ?? []).toEqual([])
    expect(body.warnings?.map((warning) => warning.code)).toEqual(
      expect.arrayContaining(['NoLocationVolumeData', 'NoUsableVolumeData'])
    )
    await expect(
      page.getByText('No Data Available', { exact: true })
    ).toBeVisible()
  })

  test('keeps AM and PM peaks in their defined windows despite a lunch spike', async ({
    page,
  }) => {
    const { body } = await generate(
      page,
      `?locations=${scenarios.lunchSpike}&dates=${knownDates.monday}&dataSource=Aggregated`
    )
    const toMinutes = (value = '') => {
      const [hours, minutes] = value.split(':').map(Number)
      return hours * 60 + minutes
    }

    expect(toMinutes(body.recommendation?.amPeakTime)).toBeGreaterThanOrEqual(
      6 * 60
    )
    expect(toMinutes(body.recommendation?.amPeakTime)).toBeLessThan(8 * 60 + 30)
    expect(toMinutes(body.recommendation?.pmPeakTime)).toBeGreaterThanOrEqual(
      15 * 60
    )
    expect(toMinutes(body.recommendation?.pmPeakTime)).toBeLessThan(18 * 60)
  })

  test('suppresses cross-traffic percentage below the volume floor', async ({
    page,
  }) => {
    const { body } = await generate(
      page,
      `?locations=${scenarios.splitPressure}&dates=${knownDates.monday}&dataSource=Aggregated&amPrimaryDirections=Northbound&pmPrimaryDirections=Northbound`
    )
    const noon = body.splitPressure?.crossTrafficShare?.find(
      (point) => point.minutes === 720
    )

    expect(noon).toBeDefined()
    expect(noon?.crossTrafficPercent).toBeNull()
  })

  test('shows the plan-coverage banner when one selected location has no plan events', async ({
    page,
  }) => {
    await generate(
      page,
      `?locations=${scenarios.commute},${scenarios.multiLocationMedian[2]}&dates=${knownDates.monday}&dataSource=Aggregated`
    )

    await expect(
      page.getByText('Existing plan coverage needs review.')
    ).toBeVisible()
  })
})
