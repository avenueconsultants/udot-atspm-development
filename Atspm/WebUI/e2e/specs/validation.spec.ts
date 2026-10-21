import { expect, test } from '@playwright/test'
import { knownDates, scenarios } from '../fixtures/seedData'
import { TimeOfDayPage } from '../page-objects/TimeOfDayPage'

test.describe('Time-of-day validation', () => {
  test('requires at least one location without calling the report API', async ({
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

    await tod.goto()
    await tod.generate()

    await expect(tod.errors()).toContainText(
      'Please select one or more locations.'
    )
    expect(reportRequests).toBe(0)
  })

  test('requires at least one date without calling the report API', async ({
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
      `?locations=${scenarios.unknownLocation}&dates=${knownDates.monday}`
    )
    await expect(tod.locationRows()).toHaveCount(1)
    await tod.clearDates()
    await tod.generate()

    await expect(tod.errors()).toContainText('Please select one or more dates.')
    expect(reportRequests).toBe(0)
  })
})
