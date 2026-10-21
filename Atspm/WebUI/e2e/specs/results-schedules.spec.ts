import { expect, test } from '@playwright/test'
import { knownDates, scenarios } from '../fixtures/seedData'
import { TimeOfDayPage } from '../page-objects/TimeOfDayPage'

test.describe('Time-of-day schedules', () => {
  test('groups a common schedule, an exception, and unavailable plan data', async ({
    page,
  }) => {
    const tod = new TimeOfDayPage(page)
    const locations = [
      scenarios.multiLocationMedian[0],
      scenarios.multiLocationMedian[1],
      scenarios.commute,
      scenarios.multiLocationMedian[2],
    ].join(',')
    await tod.goto(
      `?locations=${locations}&dates=${knownDates.monday}&dataSource=Aggregated`
    )

    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/TimeOfDay') &&
        response.request().method() === 'POST'
    )
    await tod.generate()
    expect((await responsePromise).status()).toBe(200)

    await page.getByRole('tab', { name: 'Schedules' }).click()
    const schedules = page.getByRole('tabpanel', { name: 'Schedules' })
    await expect(
      schedules.getByRole('region', { name: 'Common schedule — 2 locations' })
    ).toContainText(scenarios.multiLocationMedian[0])
    await expect(
      schedules.getByRole('region', { name: 'Common schedule — 2 locations' })
    ).toContainText(scenarios.multiLocationMedian[1])
    await expect(
      schedules.getByRole('region', { name: 'Exceptions — 1 location' })
    ).toContainText(scenarios.commute)
    await expect(
      schedules.getByRole('region', {
        name: 'Unavailable schedules — 1 location',
      })
    ).toContainText(scenarios.multiLocationMedian[2])
  })

  test('keeps current schedules visible when no recommendation can be built', async ({
    page,
  }) => {
    const tod = new TimeOfDayPage(page)
    await tod.goto(
      `?locations=${scenarios.zeroVolume}&dates=${knownDates.monday}&dataSource=Aggregated`
    )
    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/TimeOfDay') &&
        response.request().method() === 'POST'
    )
    await tod.generate()
    const body = await (await responsePromise).json()
    expect(body.recommendation.recommendedSchedule).toEqual([])

    await page.getByRole('tab', { name: 'Schedules' }).click()
    const schedules = page.getByRole('tabpanel', { name: 'Schedules' })
    await expect(schedules).toContainText(body.recommendation.summaryText)
    await expect(schedules).toContainText(scenarios.zeroVolume)
  })

  test('shows the no-current-schedule message when every location lacks plans', async ({
    page,
  }) => {
    const tod = new TimeOfDayPage(page)
    await tod.goto(
      `?locations=${scenarios.multiLocationMedian[2]}&dates=${knownDates.monday}&dataSource=Aggregated`
    )
    await tod.generate()
    await page.getByRole('tab', { name: 'Schedules' }).click()

    await expect(
      page.getByText(
        'No current schedule data is available for these selected locations.'
      )
    ).toBeVisible()
  })

  test('renders a location identifier containing a regex metacharacter', async ({
    page,
  }) => {
    const tod = new TimeOfDayPage(page)
    await tod.goto(
      `?locations=${encodeURIComponent(scenarios.regexIdentifier)}&dates=${knownDates.monday}&dataSource=Aggregated`
    )
    await tod.generate()
    await page.getByRole('tab', { name: 'Schedules' }).click()

    await expect(
      page.getByRole('tabpanel', { name: 'Schedules' })
    ).toContainText(scenarios.regexIdentifier)
  })
})
