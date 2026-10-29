import { expect, test } from '@playwright/test'
import { featureData } from '../../fixtures/featureData'
import { RouteToolsPage } from '../../page-objects/RouteToolsPage'

test.describe('Time-Space and Link Pivot route tools', () => {
  test('Historic requires a route without submitting analysis', async ({ page }) => {
    const requests: string[] = []
    page.on('request', request => { if (request.method() === 'POST' && request.url().includes('/GetReportData')) requests.push(request.url()) })
    await page.goto('/time-space-diagrams')
    await page.getByRole('button', { name: 'Generate Charts' }).click()
    await expect(page.getByRole('alert')).toContainText('Please Select a route')
    expect(requests).toEqual([])
  })

  test('50th Percentile also requires a route', async ({ page }) => {
    await page.goto('/time-space-diagrams')
    await page.getByRole('tab', { name: '50th Percentile' }).click()
    await page.getByRole('button', { name: 'Generate Charts' }).click()
    await expect(page.getByText('Please Select a route', { exact: true })).toBeVisible()
    await expect(page.getByRole('tab', { name: '50th Percentile' })).toHaveAttribute('aria-selected', 'true')
  })

  test('hydrates the seeded corridor and shows its configured location order', async ({ page }) => {
    await new RouteToolsPage(page).historic()
    const table = page.getByRole('table').first()
    await expect(table).toContainText(featureData.location)
    await expect(table).toContainText(featureData.downstream)
    const rows = await table.getByRole('row').allTextContents()
    expect(rows.findIndex(row => row.includes(featureData.location))).toBeLessThan(rows.findIndex(row => row.includes(featureData.downstream)))
    await expect(page.getByText('Ready to run', { exact: true })).toBeVisible()
  })

  test('generates real Historic data for the selected corridor and writes URL state', async ({ page }) => {
    const routeId = await new RouteToolsPage(page).historic()
    const responsePromise = page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/v1/TimeSpaceDiagram/GetReportData')
    await page.getByRole('button', { name: 'Generate Charts' }).click()
    const response = await responsePromise
    expect(response.status(), await response.text()).toBe(200)
    expect(response.request().postDataJSON()).toMatchObject({ start: featureData.start, end: '2026-01-05T08:20:00', locationIdentifier: featureData.location })
    expect(String(response.request().postDataJSON().routeId)).toBe(routeId)
    const body = await response.json()
    expect(JSON.stringify(body)).toContain(featureData.location)
    expect(JSON.stringify(body)).toContain(featureData.downstream)
    await expect.poll(() => new URL(page.url()).searchParams.get('routeId')).toBe(routeId)
    await expect(page.getByRole('tab', { name: 'Historic', exact: true })).toHaveAttribute('aria-selected', 'true')
    await expect(page.locator('canvas').first()).toBeVisible()
  })

  test('preserves the selected route after URL reload', async ({ page }) => {
    await new RouteToolsPage(page).historic()
    await page.reload()
    await expect(page.getByRole('combobox', { name: 'Route Select' })).toHaveValue(featureData.route)
    await expect(page.getByRole('tab', { name: 'Historic', exact: true })).toHaveAttribute('aria-selected', 'true')
  })

  test('Link Pivot blocks analysis without a route', async ({ page }) => {
    const requests: string[] = []
    page.on('request', request => { if (request.method() === 'POST' && request.url().includes('/LinkPivot/')) requests.push(request.url()) })
    await page.goto('/link-pivot')
    await page.getByRole('button', { name: 'Run Analysis' }).click()
    await expect(page.getByRole('alert')).toContainText('Please select a route')
    expect(requests).toEqual([])
  })

  test('Link Pivot exposes editable cycle length, bias, and direction', async ({ page }) => {
    await page.goto('/link-pivot')
    await expect(page.getByLabel('Cycle Length')).toHaveValue('90')
    await expect(page.getByLabel('Bias', { exact: true })).toHaveValue('0')
    await page.getByLabel('Cycle Length').fill('60')
    await page.getByLabel('Bias', { exact: true }).fill('5')
    await page.getByRole('combobox', { name: 'Starting Point', exact: true }).click()
    await page.getByRole('option', { name: 'Upstream', exact: true }).click()
    await expect(page.getByLabel('Cycle Length')).toHaveValue('60')
    await expect(page.getByLabel('Bias', { exact: true })).toHaveValue('5')
    await expect(page.getByRole('combobox', { name: 'Starting Point', exact: true })).toHaveText('Upstream')
  })

  test('Link Pivot selects the same seeded corridor used by Time-Space', async ({ page }) => {
    await page.goto('/link-pivot')
    await page.getByRole('combobox', { name: 'Route', exact: true }).click()
    await page.getByRole('option', { name: featureData.route, exact: true }).click()
    await expect(page.getByRole('table').first()).toContainText(featureData.location)
    await expect(page.getByRole('table').first()).toContainText(featureData.downstream)
    await expect(page.getByText('Ready to run', { exact: true })).toBeVisible()
  })
})
