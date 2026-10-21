import { expect, test, type Page } from '@playwright/test'
import { knownDates, scenarios } from '../fixtures/seedData'
import { TimeOfDayPage } from '../page-objects/TimeOfDayPage'

const locations = [...scenarios.multiLocationMedian]

const selectedLocationOrder = async (page: Page) =>
  page
    .getByTestId('time-of-day-location-row')
    .evaluateAll((rows) =>
      rows.map((row) => row.getAttribute('aria-label')?.split(',')[0])
    )

test.describe('Time-of-day corridor options', () => {
  test.beforeEach(async ({ page }) => {
    const tod = new TimeOfDayPage(page)
    await tod.goto(
      `?locations=${locations.join(',')}&dates=${knownDates.monday}&dataSource=Aggregated`
    )
  })

  test('adds a single location through search', async ({ page }) => {
    const tod = new TimeOfDayPage(page)
    await tod.goto()
    const selectionMethod = page.getByRole('group', {
      name: 'Location selection method',
    })
    const locationMode = selectionMethod.getByRole('button', {
      name: 'Location',
      exact: true,
    })
    await locationMode.click()
    await expect(locationMode).toHaveAttribute('aria-pressed', 'true')
    const search = page.getByPlaceholder('Select a location')
    await search.fill(locations[0])
    await page.getByRole('option', { name: new RegExp(locations[0]) }).click()
    await page.getByRole('button', { name: 'Add Location' }).click()

    await expect(page.getByLabel('1 selected locations')).toBeVisible()
    await expect(
      page.getByRole('button', { name: `Remove ${locations[0]}` })
    ).toBeVisible()
  })

  test('shows the ordered selection, count, and endpoint breadcrumb', async ({
    page,
  }) => {
    await expect(
      page.getByLabel(`${locations.length} selected locations`)
    ).toBeVisible()
    await expect(page.getByTestId('time-of-day-location-row')).toHaveCount(3)
    await expect(selectedLocationOrder(page)).resolves.toEqual(locations)

    const corridor = page.getByTestId('time-of-day-corridor')
    await expect(corridor).toContainText(locations[0])
    await expect(corridor).toContainText(locations[locations.length - 1])
    await expect(corridor).toContainText('drag to reorder')
  })

  test('keyboard drag order is preserved in the generated request and URL', async ({
    page,
  }) => {
    const tod = new TimeOfDayPage(page)
    const secondHandle = page.getByRole('button', {
      name: `Reorder ${locations[1]}`,
    })
    await secondHandle.focus()
    await secondHandle.press('ArrowUp')

    const reordered = [locations[1], locations[0], locations[2]]
    await expect(selectedLocationOrder(page)).resolves.toEqual(reordered)

    const requestPromise = page.waitForRequest(
      (request) =>
        request.url().includes('/api/v1/TimeOfDay') &&
        request.method() === 'POST'
    )
    await tod.generate()
    const request = await requestPromise
    expect(request.postDataJSON().locationIdentifiers).toEqual(reordered)
    await expect
      .poll(() => new URL(page.url()).searchParams.get('locations'))
      .toBe(reordered.join(','))
  })

  test('removes one location and decrements the selected count', async ({ page }) => {
    await page
      .getByRole('button', { name: `Remove ${locations[1]}` })
      .click()

    await expect(page.getByLabel('2 selected locations')).toBeVisible()
    await expect(page.getByTestId('time-of-day-location-row')).toHaveCount(2)
    await expect(
      page.getByRole('button', { name: `Remove ${locations[1]}` })
    ).toHaveCount(0)
    await expect(selectedLocationOrder(page)).resolves.toEqual([
      locations[0],
      locations[2],
    ])
  })

  test('clear all restores the corridor empty state', async ({ page }) => {
    await page.getByTestId('time-of-day-clear-locations').click()

    await expect(page.getByLabel('0 selected locations')).toBeVisible()
    await expect(page.getByText('No locations selected')).toBeVisible()
    await expect(
      page.getByText(
        'Add a route, choose a location, or select one on the map.'
      )
    ).toBeVisible()
  })

  test('uses the median rather than the mean across three locations', async ({
    page,
  }) => {
    const tod = new TimeOfDayPage(page)
    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/TimeOfDay') &&
        response.request().method() === 'POST'
    )
    await tod.generate()
    const response = await responsePromise
    expect(response.status()).toBe(200)
    const body = await response.json()
    const point = body.planProfile.corridorProfile.points.find(
      (candidate: { minutes: number }) => candidate.minutes === 12 * 60
    )

    // Aggregation event counts are normalized from 15-minute counts to vph.
    expect(point.averageVolume).toBe(300)
    expect(point.averageVolume).not.toBeCloseTo((100 + 300 + 900) / 3)
  })
})
