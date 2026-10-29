import { expect, test } from '@playwright/test'
import { featureData } from '../../fixtures/featureData'
import { api, fixtureLocation } from '../../helpers/stack'
import { LocationAdminPage } from '../../page-objects/LocationAdminPage'

test.describe('Location administration', () => {
  // All mutation tests use E2EADMIN01; never edit the report fixture locations.
  test.describe.configure({ mode: 'serial' })

  test.afterEach(async ({ page }) => {
    const location = await fixtureLocation(page, featureData.admin)
    const { root, headers } = await api(page, 'CONFIG_URL')
    const response = await page.request.patch(`${root}/api/v1/Location/${location.id}`, { headers, data: { primaryName: 'E2E feature regression' } })
    expect(response.ok()).toBeTruthy()
    for (const approach of location.approaches) {
      const restored = await page.request.patch(`${root}/api/v1/Approach/${approach.id}`, { headers, data: { mph: 35 } })
      expect(restored.ok()).toBeTruthy()
    }
  })

  test('loads the saved location, approaches, and detectors', async ({ page }) => {
    const admin = new LocationAdminPage(page)
    await admin.goto()
    await expect(page.getByLabel('Primary Name', { exact: true })).toHaveValue('E2E feature regression')
    await admin.openApproach()
    await expect(page.getByRole('columnheader', { name: 'Channel', exact: true }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'save approach', exact: true })).toHaveCount(2)
  })

  test('saves general information and persists it across a reload', async ({ page }) => {
    const location = await new LocationAdminPage(page).goto()
    await page.getByLabel('Primary Name', { exact: true }).fill('E2E saved primary name')
    const saved = page.waitForResponse(response => response.request().method() === 'PATCH' && new URL(response.url()).pathname.endsWith(`/Location/${location.id}`))
    await page.getByRole('button', { name: 'Save General Info' }).click()
    expect((await saved).ok()).toBeTruthy()
    await page.reload()
    await expect(page.getByLabel('Primary Name', { exact: true })).toHaveValue('E2E saved primary name')
    expect((await fixtureLocation(page, featureData.admin)).primaryName).toBe('E2E saved primary name')
  })

  test('saves an approach with blank optional speed as null', async ({ page }) => {
    const admin = new LocationAdminPage(page)
    await admin.goto()
    const table = await admin.openApproach()
    const speed = table.getByRole('row').last().getByRole('gridcell').nth(6)
    await speed.click()
    await speed.press('Enter')
    await speed.getByRole('textbox').fill('')
    await speed.getByRole('textbox').press('Enter')
    const saved = page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname.endsWith('/UpsertApproach'))
    await page.getByRole('button', { name: 'save approach', exact: true }).first().click()
    expect((await saved).ok()).toBeTruthy()
    const location = await fixtureLocation(page, featureData.admin)
    expect(location.approaches.find((approach: { protectedPhaseNumber: number }) => approach.protectedPhaseNumber === 2).mph).toBeNull()
    await page.reload()
    const reloaded = await admin.openApproach()
    await expect(reloaded.getByRole('row').last().getByRole('gridcell').nth(6)).toHaveText('')
  })

  test('blocks saving an approach without a required phase number', async ({ page }) => {
    const admin = new LocationAdminPage(page)
    await admin.goto()
    const table = await admin.openApproach()
    const phase = table.getByRole('row').last().getByRole('gridcell').nth(2)
    await phase.click()
    await phase.press('Enter')
    await phase.getByRole('textbox').fill('')
    await phase.getByRole('textbox').press('Enter')
    const requests: string[] = []
    page.on('request', request => { if (request.method() === 'POST' && request.url().includes('/UpsertApproach')) requests.push(request.url()) })
    await page.getByRole('button', { name: 'save approach', exact: true }).first().click()
    await expect(page.getByRole('img', { name: 'A Phase Number is required' }).first()).toBeVisible()
    expect(requests).toEqual([])
  })

  test('rejects duplicate location identifiers before creation', async ({ page }) => {
    await new LocationAdminPage(page).goto()
    await page.getByRole('button', { name: 'New Location', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Location Identifier').fill(featureData.admin)
    await expect(dialog.getByText('Location Identifier already exists.')).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Create Location' })).toBeDisabled()
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(dialog).toHaveCount(0)
  })

  test('requires an identifier of at most ten characters', async ({ page }) => {
    await new LocationAdminPage(page).goto()
    await page.getByRole('button', { name: 'New Location', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('button', { name: 'Create Location' })).toBeDisabled()
    await dialog.getByLabel('Location Identifier').fill('E2E-TOO-LONG-IDENTIFIER')
    await expect(dialog.getByText('Location Identifier must be 10 characters or fewer.')).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Create Location' })).toBeDisabled()
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  })
})
