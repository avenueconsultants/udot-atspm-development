import { expect, test } from '@playwright/test'
import { knownDates, scenarios } from '../fixtures/seedData'
import { TimeOfDayPage } from '../page-objects/TimeOfDayPage'

test.describe('Time-of-day date options', () => {
  test('does not request day availability before a location is selected', async ({
    page,
  }) => {
    let availabilityRequests = 0
    page.on('request', (request) => {
      if (request.url().includes('/GetDaysWithData/')) availabilityRequests++
    })
    const tod = new TimeOfDayPage(page)
    await tod.goto(`?dates=${knownDates.monday}`)
    await page.waitForTimeout(500)

    expect(availabilityRequests).toBe(0)
  })

  test('loads seeded aggregation availability after selecting a location', async ({
    page,
  }) => {
    const availabilityResponse = page.waitForResponse(
      (response) =>
        response.url().includes(
          `/Aggregation/GetDaysWithData/${scenarios.commute}/DetectorEventCountAggregation`
        ) && response.status() === 200
    )
    const tod = new TimeOfDayPage(page)
    await tod.goto(
      `?locations=${scenarios.commute}&dates=${knownDates.monday}&dataSource=Aggregated`
    )
    await availabilityResponse
    await expect(
      page
        .getByRole('grid', { name: 'January 2026' })
        .getByRole('gridcell', { name: '5', exact: true })
        .first()
    ).toBeVisible()
  })

  test('groups three contiguous dates into one same-year range', async ({
    page,
  }) => {
    const tod = new TimeOfDayPage(page)
    await tod.goto(
      `?dates=${knownDates.monday},${knownDates.tuesday},${knownDates.wednesday}`
    )

    await expect(page.getByLabel('3 selected dates')).toBeVisible()
    await expect(
      page.getByText('Mon, Jan 5 - Wed, Jan 7', { exact: true })
    ).toBeVisible()
  })

  test('includes years when a selected range crosses a year boundary', async ({
    page,
  }) => {
    const tod = new TimeOfDayPage(page)
    await tod.goto('?dates=2025-12-31,2026-01-01')

    await expect(page.getByLabel('2 selected dates')).toBeVisible()
    await expect(
      page.getByText('Wed, Dec 31, 2025 - Thu, Jan 1, 2026', { exact: true })
    ).toBeVisible()
  })

  test('deleting one grouped range preserves the other selected dates', async ({
    page,
  }) => {
    const tod = new TimeOfDayPage(page)
    await tod.goto(
      `?dates=${knownDates.monday},${knownDates.tuesday},2026-01-09`
    )

    const groupedRange = page.getByText('Mon, Jan 5 - Tue, Jan 6', {
      exact: true,
    })
    await groupedRange.locator('..').press('Delete')

    await expect(page.getByLabel('1 selected dates')).toBeVisible()
    await expect(groupedRange).toHaveCount(0)
    await expect(page.getByText('Fri, Jan 9', { exact: true })).toBeVisible()
  })

  test('clear all restores the date empty state', async ({ page }) => {
    const tod = new TimeOfDayPage(page)
    await tod.goto(
      `?locations=${scenarios.commute}&dates=${knownDates.monday},${knownDates.tuesday}`
    )

    await page.getByTestId('time-of-day-clear-dates').click()

    await expect(page.getByLabel('0 selected dates')).toBeVisible()
    await expect(page.getByText('No dates selected')).toBeVisible()
  })
})
