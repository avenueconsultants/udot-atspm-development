import { expect, test } from '@playwright/test'
import { knownDates, scenarios } from '../fixtures/seedData'
import { TimeOfDayPage } from '../page-objects/TimeOfDayPage'

test.describe('Time-of-day data source', () => {
  test('defaults to Indiana Events and explains the fixed bin size', async ({
    page,
  }) => {
    const tod = new TimeOfDayPage(page)
    await tod.goto()

    const dataSource = page.getByTestId('time-of-day-data-source')
    await expect(
      dataSource.getByRole('button', { name: 'Indiana Events' })
    ).toHaveAttribute('aria-pressed', 'true')
    await expect(
      dataSource.getByRole('button', { name: 'Aggregated' })
    ).toHaveAttribute('aria-pressed', 'false')
    await expect(
      page.getByText('Volumes are counted in 15-minute bins.')
    ).toBeVisible()
  })

  test('switches to Aggregated without submitting the form', async ({ page }) => {
    const tod = new TimeOfDayPage(page)
    let reportRequests = 0
    page.on('request', (request) => {
      if (
        request.url().includes('/api/v1/TimeOfDay') &&
        request.method() === 'POST'
      ) {
        reportRequests += 1
      }
    })

    await tod.goto()
    const aggregated = page
      .getByTestId('time-of-day-data-source')
      .getByRole('button', { name: 'Aggregated' })
    await aggregated.click()

    await expect(aggregated).toHaveAttribute('aria-pressed', 'true')
    expect(reportRequests).toBe(0)
  })

  test('uses seeded aggregation rows and reports limited movement detail', async ({
    page,
  }) => {
    const tod = new TimeOfDayPage(page)
    await tod.goto(
      `?locations=${scenarios.commute}&dates=${knownDates.monday}&dataSource=Aggregated`
    )

    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/TimeOfDay') &&
        response.request().method() === 'POST'
    )
    await tod.generate()

    await expect.poll(async () => (await responsePromise).status()).toBe(200)
    await expect(tod.results()).toBeVisible()
    const warningSummary = tod
      .warnings()
      .getByRole('button', { name: /warnings?$/ })
    const movementDetailWarning =
      'Aggregated detector counts were mapped through detector metadata; movement detail is limited by detector configuration.'
    if (
      (await tod.warnings().getByText(movementDetailWarning).count()) === 0 &&
      (await warningSummary.count()) > 0
    )
      await warningSummary.click()
    await expect(tod.warnings()).toContainText(movementDetailWarning)
  })

  test('reports NoData when a configured location has no aggregation rows', async ({
    page,
  }) => {
    const tod = new TimeOfDayPage(page)
    await tod.goto(
      `?locations=${scenarios.noAggregations}&dates=${knownDates.monday}&dataSource=Aggregated`
    )

    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/TimeOfDay') &&
        response.request().method() === 'POST'
    )
    await tod.generate()
    const response = await responsePromise
    expect(response.status()).toBe(200)
    const body = (await response.json()) as {
      warnings?: Array<{ code?: string; locationIdentifier?: string }>
    }
    expect(body.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'NoLocationVolumeData',
          locationIdentifier: scenarios.noAggregations,
        }),
        expect.objectContaining({ code: 'NoUsableVolumeData' }),
      ])
    )
    await expect(tod.warnings()).toContainText(/warnings?$/)

    await page.getByRole('tab', { name: 'Location Data' }).click()
    const row = page
      .getByRole('table', { name: 'time of day location supporting data' })
      .getByRole('row')
      .filter({ hasText: scenarios.noAggregations })
    await expect(row).toContainText('NoData')
  })
})
