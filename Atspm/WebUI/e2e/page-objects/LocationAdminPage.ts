import { expect, type Page } from '@playwright/test'
import { featureData } from '../fixtures/featureData'
import { fixtureLocation } from '../helpers/stack'

export class LocationAdminPage {
  constructor(readonly page: Page) {}

  async goto() {
    const location = await fixtureLocation(this.page, featureData.admin)
    await this.page.goto(`/admin/locations/${location.id}`)
    await expect(this.page.getByLabel('Primary Name', { exact: true })).toBeVisible()
    return location
  }

  async openApproach() {
    await this.page.getByRole('tab', { name: 'Approaches', exact: true }).click()
    await this.page.getByRole('button', { name: /E2E NB through/ }).click()
    return this.page.getByRole('table').filter({ hasText: 'Approach Speed (mph)' }).first()
  }
}
