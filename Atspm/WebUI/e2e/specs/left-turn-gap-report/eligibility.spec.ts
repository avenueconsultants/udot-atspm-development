import { expect, test } from '@playwright/test'
import { featureData } from '../../fixtures/featureData'
import { selectLocation } from '../../helpers/stack'
import { LeftTurnReportPage } from '../../page-objects/LeftTurnReportPage'

test.describe('Left-turn gap report', () => {
  test('requires eligible approaches and a completed data check', async ({ page }) => {
    await new LeftTurnReportPage(page).goto(false)
    await expect(page.getByRole('button', { name: 'Run Check', exact: true })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Run Report', exact: true })).toBeDisabled()
  })

  test('selects only approaches with left-turn detectors', async ({ page }) => {
    await new LeftTurnReportPage(page).goto()
    await expect(page.getByRole('checkbox', { name: 'E2E NB through', exact: true })).toBeChecked()
    await expect(page.getByRole('checkbox', { name: 'E2E SB through', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Run Check', exact: true })).toBeEnabled()
    await expect(page.getByRole('button', { name: 'Run Report', exact: true })).toBeDisabled()
  })

  test('submits default thresholds and displays real aggregation gaps', async ({ page }) => {
    const report = new LeftTurnReportPage(page)
    await report.goto()
    const { request, body } = await report.check()
    expect(request).toMatchObject({ locationIdentifier: featureData.location, volumePerHourThreshold: 60, gapOutThreshold: 50, pedestrianThreshold: 30, daysOfWeek: [0, 1, 2, 3, 4, 5, 6] })
    expect(request.start).toContain(featureData.date)
    expect(body.locationIdentifier).toBe(featureData.location)
    expect(body.insufficientCycleAggregation).toBe(true)
    expect(body.insufficientPedAggregations).toBe(true)
    await expect(page.getByRole('table').getByRole('row').filter({ hasText: 'E2E NB through' })).toContainText('Check Detector')
    await expect(page.getByRole('button', { name: 'Run Report', exact: true })).toBeEnabled()
  })

  test('rechecks with edited data-quality thresholds', async ({ page }) => {
    const report = new LeftTurnReportPage(page)
    await report.goto()
    await page.locator('#cycles-with-ped-outs').fill('20')
    await page.locator('#cycles-with-gap-outs').fill('40')
    await page.locator('#left-turn-volume').fill('80')
    const { request } = await report.check()
    expect(request).toMatchObject({ volumePerHourThreshold: 80, gapOutThreshold: 40, pedestrianThreshold: 20 })
  })

  test('changing the location invalidates the completed data check', async ({ page }) => {
    const report = new LeftTurnReportPage(page)
    await report.goto()
    await report.check()
    await expect(page.getByRole('button', { name: 'Run Report', exact: true })).toBeEnabled()
    await selectLocation(page, featureData.downstream)
    await expect(page.getByRole('button', { name: 'Run Report', exact: true })).toBeDisabled()
  })

  test('removing all approaches blocks both actions', async ({ page }) => {
    const report = new LeftTurnReportPage(page)
    await report.goto()
    await report.check()
    await page.getByRole('checkbox', { name: 'E2E NB through', exact: true }).uncheck()
    await expect(page.getByRole('button', { name: 'Run Check', exact: true })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Run Report', exact: true })).toBeDisabled()
  })

  test('requires at least one selected analysis after the data check', async ({ page }) => {
    const report = new LeftTurnReportPage(page)
    await report.goto()
    await report.check()
    for (const name of ['Final Gap Analysis Report', 'Split Fail Analysis', 'Pedestrian Call Analysis', 'Conflicting Volumes Analysis']) await page.getByRole('checkbox', { name, exact: true }).uncheck()
    await expect(page.getByRole('button', { name: 'Run Report', exact: true })).toBeDisabled()
    await page.getByRole('checkbox', { name: 'Final Gap Analysis Report', exact: true }).check()
    await expect(page.getByRole('button', { name: 'Run Report', exact: true })).toBeEnabled()
  })
})
