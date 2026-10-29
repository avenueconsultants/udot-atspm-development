import { expect, test } from '@playwright/test'
import { featureData } from '../../fixtures/featureData'
import { selectLocation } from '../../helpers/stack'
import { PerformanceMeasuresPage } from '../../page-objects/PerformanceMeasuresPage'

const endpoint = '/api/v1/PurduePhaseTermination/GetReportData'

test.describe('Performance measures shared workflow', () => {
  test('requires a location without calling a report endpoint', async ({ page }) => {
    const requests: string[] = []
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.url().includes('/GetReportData')) requests.push(request.url())
    })
    await page.goto('/performance-measures')
    await new PerformanceMeasuresPage(page).generateButton().click()
    await expect(page.getByRole('alert')).toContainText('Please select a location.')
    expect(requests).toEqual([])
  })

  test('selects a seeded location and loads eligible measures', async ({ page }) => {
    await page.goto('/performance-measures')
    await selectLocation(page, featureData.location)
    const measure = page.getByRole('combobox', { name: 'Measure', exact: true })
    await measure.click()
    await expect(page.getByRole('option', { name: /Purdue Coordination/ })).toBeVisible()
    await expect(page.getByRole('option', { name: /Turning Movement Counts/ })).toBeVisible()
  })

  test('hydrates URL inputs without automatically generating a report', async ({ page }) => {
    const requests: string[] = []
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.url().includes('/GetReportData')) requests.push(request.url())
    })
    await new PerformanceMeasuresPage(page).goto()
    await expect(page.getByRole('combobox', { name: 'Location', exact: true })).toHaveValue(new RegExp(featureData.location))
    expect(requests).toEqual([])
  })

  test('sends the selected location, time range, and edited options', async ({ page }) => {
    const measures = new PerformanceMeasuresPage(page)
    await measures.goto()
    await page.getByLabel('Selected Consecutive Count').fill('1')
    const { request, body } = await measures.generate(endpoint)
    expect(request).toMatchObject({ locationIdentifier: featureData.location, start: featureData.start, end: featureData.end })
    expect(Number(request.selectedConsecutiveCount)).toBe(1)
    expect(body.phases.map((phase: { phaseNumber: number }) => phase.phaseNumber)).toEqual(expect.arrayContaining([2, 6]))
    await measures.expectChart()
  })

  test('writes generated state to the URL and restores it on reload', async ({ page }) => {
    const measures = new PerformanceMeasuresPage(page)
    await measures.goto()
    await page.getByLabel('Selected Consecutive Count').fill('1')
    await measures.generate(endpoint)
    await expect.poll(() => new URL(page.url()).searchParams.get('selectedConsecutiveCount')).toBe('1')
    await page.reload()
    await expect(page.getByLabel('Selected Consecutive Count')).toHaveValue('1')
    await expect(page.getByRole('combobox', { name: 'Location', exact: true })).toHaveValue(new RegExp(featureData.location))
  })

  test('loads location configuration through the Configuration tab', async ({ page }) => {
    await new PerformanceMeasuresPage(page).goto()
    await page.getByRole('tab', { name: 'Configuration', exact: true }).click()
    await expect(page.getByText('E2E NB through', { exact: true }).first()).toBeVisible()
    await page.getByRole('tab', { name: 'Charts', exact: true }).click()
    await expect(new PerformanceMeasuresPage(page).generateButton()).toBeVisible()
  })

  test('reports an API failure and allows a successful retry', async ({ page }) => {
    const measures = new PerformanceMeasuresPage(page)
    await measures.goto()
    // Failure injection is deliberate; the retry calls the actual report API.
    await page.route(`**${endpoint}`, (route) => route.fulfill({ status: 503, contentType: 'application/problem+json', body: JSON.stringify({ detail: 'E2E temporary report outage' }) }))
    await measures.generateButton().click()
    await expect(page.getByRole('alert')).toContainText('E2E temporary report outage')
    await page.unroute(`**${endpoint}`)
    await measures.generate(endpoint)
    await measures.expectChart()
    await expect(page.getByText('E2E temporary report outage')).toHaveCount(0)
  })
})
