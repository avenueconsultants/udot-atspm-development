import { expect, test, type Page } from '@playwright/test'
import { knownDates, scenarios } from '../fixtures/seedData'
import { TimeOfDayPage } from '../page-objects/TimeOfDayPage'

type LocationResult = {
  locationIdentifier: string
  daysWithData: number
  dataQualityFlag: string
  summary: {
    peakSmoothedVolume?: number | null
    peakOccupancyPercent?: number | null
    amPeakOccupancyPercent?: number | null
    pmPeakOccupancyPercent?: number | null
  }
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
  return { tod, body: await response.json() }
}

test.describe('Time-of-day location supporting data', () => {
  test('shows complete coverage and capacity-based occupancy arithmetic', async ({
    page,
  }) => {
    const { body } = await generate(
      page,
      `?locations=${scenarios.commute}&dates=${knownDates.monday}&dataSource=Aggregated`
    )
    const location = body.locations[0] as LocationResult
    expect(location.dataQualityFlag).toBe('Complete')
    expect(location.daysWithData).toBe(1)
    expect(location.summary.peakSmoothedVolume).toBeGreaterThan(0)
    expect(location.summary.peakOccupancyPercent).toBe(
      Math.round(((location.summary.peakSmoothedVolume ?? 0) / 1600) * 1000) /
        10
    )

    await page.getByRole('tab', { name: 'Location Data' }).click()
    const row = page.getByRole('row').filter({ hasText: scenarios.commute })
    await expect(row).toContainText('Complete')
    await expect(row.getByRole('cell').nth(6)).toHaveText(
      ((location.summary.peakOccupancyPercent ?? 0) / 100).toFixed(2)
    )
  })

  test('shows partial coverage for a location missing one selected day', async ({
    page,
  }) => {
    const { body } = await generate(
      page,
      `?locations=${scenarios.commute}&dates=${knownDates.monday},${knownDates.tuesday}&dataSource=Aggregated`
    )
    const location = body.locations[0] as LocationResult
    expect(location.dataQualityFlag).toBe('Partial')
    expect(location.daysWithData).toBe(1)

    await page.getByRole('tab', { name: 'Location Data' }).click()
    await expect(
      page.getByRole('row').filter({ hasText: scenarios.commute })
    ).toContainText('Partial')
  })

  test('shows NoData and dashes for a location with no observations', async ({
    page,
  }) => {
    const { body } = await generate(
      page,
      `?locations=${scenarios.noAggregations}&dates=${knownDates.monday}&dataSource=Aggregated`
    )
    const location = body.locations[0] as LocationResult
    expect(location.dataQualityFlag).toBe('NoData')

    await page.getByRole('tab', { name: 'Location Data' }).click()
    const row = page
      .getByRole('row')
      .filter({ hasText: scenarios.noAggregations })
    await expect(row).toContainText('NoData')
    await expect(row.getByRole('cell').nth(3)).toHaveText('0')
    await expect(row.getByRole('cell').nth(6)).toHaveText('-')
  })

  test('suppresses occupancy when detected lane capacity varies by date', async ({
    page,
  }) => {
    const tod = new TimeOfDayPage(page)
    await tod.goto(
      `?locations=${scenarios.capacityChanges}&dates=${knownDates.monday},${knownDates.tuesday}&dataSource=Aggregated`
    )

    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/TimeOfDay') &&
        response.request().method() === 'POST'
    )
    await tod.generate()
    expect((await responsePromise).status()).toBe(200)

    const warnings = tod.warnings()
    await warnings.getByRole('button', { name: /warnings?$/ }).click()
    await expect(warnings).toContainText(
      'Configured lane capacity differs across selected dates; capacity percentages are unavailable for the combined profile.'
    )

    await page.getByRole('tab', { name: 'Location Data' }).click()
    const row = page
      .getByRole('table', { name: 'time of day location supporting data' })
      .getByRole('row')
      .filter({ hasText: scenarios.capacityChanges })
    await expect(row).toBeVisible()
    await expect(row.getByRole('cell').nth(6)).toHaveText('-')
    await expect(row.getByRole('cell').nth(7)).toHaveText('-')
    await expect(row.getByRole('cell').nth(8)).toHaveText('-')
  })
})
