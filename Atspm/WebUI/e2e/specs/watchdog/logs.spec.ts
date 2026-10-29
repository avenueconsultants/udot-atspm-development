import { expect, test } from '@playwright/test'
import { featureData } from '../../fixtures/featureData'
import { api, fixtureLocation } from '../../helpers/stack'
import { WatchdogPage } from '../../page-objects/WatchdogPage'

test.describe('Watchdog logs and filters', () => {
  test('returns the exact seeded log and renders its details', async ({ page }) => {
    const watchdog = new WatchdogPage(page)
    await watchdog.goto()
    const { request, body } = await watchdog.generate()
    expect(request.locationIdentifier).toBe(featureData.location)
    expect(request.start).toContain(featureData.date)
    expect(body.logEvents).toHaveLength(1)
    expect(body.logEvents[0]).toMatchObject({ locationIdentifier: featureData.location, issueType: 1, details: 'E2E deterministic record count warning' })
    await expect(page.getByRole('grid')).toContainText(featureData.location)
    await expect(page.getByRole('grid')).toContainText('E2E deterministic record count warning')
  })

  test('keeps location filters isolated from other fixture logs', async ({ page }) => {
    const watchdog = new WatchdogPage(page)
    await watchdog.goto(featureData.downstream)
    const { body } = await watchdog.generate()
    expect(body.logEvents).toHaveLength(1)
    expect(body.logEvents[0].locationIdentifier).toBe(featureData.downstream)
    await expect(page.getByRole('grid')).not.toContainText(featureData.location)
  })

  test('displays an empty state for a configured location without logs', async ({ page }) => {
    const watchdog = new WatchdogPage(page)
    await watchdog.goto(featureData.empty)
    const { body } = await watchdog.generate()
    expect(body.logEvents).toEqual([])
    await expect(page.getByRole('alert')).toContainText('No watchdog logs were found for the selected filters.')
  })

  test('filters by issue type using the actual report API', async ({ page }) => {
    const watchdog = new WatchdogPage(page)
    await watchdog.goto()
    await page.getByRole('combobox', { name: 'Issue Type', exact: true }).fill('2 -')
    await page.getByRole('option').filter({ hasText: /^2 -/ }).click()
    const { request, body } = await watchdog.generate()
    expect(request.issueType).toBe(2)
    expect(body.logEvents).toEqual([])
    await expect(page.getByRole('alert')).toContainText('No watchdog logs were found')
  })

  test('navigates between log, summary, and ignored-event views', async ({ page }) => {
    await new WatchdogPage(page).goto()
    await page.getByRole('tab', { name: 'Summary Report', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Generate Summary', exact: true })).toBeVisible()
    await page.getByRole('tab', { name: 'Ignored Events', exact: true }).click()
    await expect(page.getByRole('columnheader', { name: 'Location', exact: true })).toBeVisible()
    await page.getByRole('tab', { name: 'Logs', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Generate Report', exact: true })).toBeVisible()
  })

  test('persists and displays an ignored event without changing another location', async ({ page }) => {
    // Use the editing fixture, with cleanup even if the assertion fails.
    const location = await fixtureLocation(page, featureData.admin)
    const { root, headers } = await api(page, 'CONFIG_URL')
    const response = await page.request.post(`${root}/api/v1/WatchDogIgnoreEvent`, { headers, data: {
      locationId: location.id, locationIdentifier: featureData.admin, issueType: 'RecordCount',
      componentType: 'Location', componentId: location.id, key: `E2E-${featureData.admin}`,
      start: '2026-01-05T00:00:00', end: '2026-01-06T00:00:00', phase: null,
    } })
    expect(response.ok(), await response.text()).toBeTruthy()
    const created = await response.json()
    try {
      await new WatchdogPage(page).goto()
      await page.getByRole('tab', { name: 'Ignored Events', exact: true }).click()
      await expect(page.getByRole('row').filter({ hasText: featureData.admin })).toContainText('RecordCount')
      await page.reload()
      await page.getByRole('tab', { name: 'Ignored Events', exact: true }).click()
      await expect(page.getByRole('row').filter({ hasText: featureData.admin })).toBeVisible()
    } finally {
      const removed = await page.request.delete(`${root}/api/v1/WatchDogIgnoreEvent/${created.id}`, { headers })
      expect(removed.ok()).toBeTruthy()
    }
  })
})
