import { expect, test } from '@playwright/test'
import { knownDates, scenarios } from '../fixtures/seedData'
import { TimeOfDayPage } from '../page-objects/TimeOfDayPage'

test.describe('Time-of-day URL state', () => {
  test('hydrates known parameters without automatically generating a report', async ({
    page,
  }) => {
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

    await tod.goto(
      `?locations=${scenarios.unknownLocation}&dates=${knownDates.monday},${knownDates.tuesday}&dataSource=Aggregated&primaryDirections=Northbound`
    )

    await expect(tod.locationRows()).toHaveCount(1)
    await expect(tod.locationRows().first()).toContainText(
      scenarios.unknownLocation
    )
    await expect(page.getByTestId('time-of-day-data-source')).toContainText(
      'Aggregated'
    )
    await expect(tod.results()).toHaveCount(0)
    expect(reportRequests).toBe(0)
  })

  test('renders an unresolved URL location as a removable stub', async ({
    page,
  }) => {
    const tod = new TimeOfDayPage(page)
    await tod.goto(`?locations=${scenarios.unknownLocation}`)

    await expect(tod.locationRows()).toHaveCount(1)
    await expect(tod.locationRows()).toContainText(scenarios.unknownLocation)
    await page
      .getByRole('button', { name: `Remove ${scenarios.unknownLocation}` })
      .click()
    await expect(tod.locationRows()).toHaveCount(0)
    await expect(page.getByText('No locations selected')).toBeVisible()
  })

  test('writes sorted, deduplicated state with replace semantics after generate', async ({
    page,
  }) => {
    const tod = new TimeOfDayPage(page)
    await tod.goto(
      `?locations=${scenarios.commute}&dates=${knownDates.tuesday},${knownDates.monday},${knownDates.tuesday}&dataSource=Aggregated`
    )
    const historyLength = await page.evaluate(() => window.history.length)
    await tod.generate()

    await expect
      .poll(() => new URL(page.url()).searchParams.get('dates'))
      .toBe(`${knownDates.monday},${knownDates.tuesday}`)
    expect(await page.evaluate(() => window.history.length)).toBe(historyLength)
  })
})
