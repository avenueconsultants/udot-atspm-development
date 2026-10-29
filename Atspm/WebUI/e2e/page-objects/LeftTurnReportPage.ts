import { expect, type Page } from '@playwright/test'
import { featureData } from '../fixtures/featureData'
import { selectLocation } from '../helpers/stack'

export class LeftTurnReportPage {
  constructor(readonly page: Page) {}

  async goto(selectFixture = true) {
    await this.page.clock.setFixedTime(new Date(2026, 0, 5, 12))
    await this.page.goto('/left-turn-gap-report')
    await expect(
      this.page.getByRole('button', { name: 'Run Check', exact: true })
    ).toBeVisible()
    if (selectFixture) {
      await selectLocation(this.page, featureData.location)
      await expect(
        this.page.getByRole('checkbox', { name: 'E2E NB through', exact: true })
      ).toBeChecked()
    }
  }

  async check() {
    const responsePromise = this.page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        new URL(response.url()).pathname
          .toLowerCase()
          .endsWith('/api/v1/leftturngapreportdatacheck/getreportdata')
    )
    await this.page
      .getByRole('button', { name: 'Run Check', exact: true })
      .click()
    const response = await responsePromise
    expect(response.status(), await response.text()).toBe(200)
    await expect(
      this.page.getByRole('columnheader', {
        name: 'Insufficient Detector Event Count',
        exact: true,
      })
    ).toBeVisible()
    return {
      request: response.request().postDataJSON(),
      body: await response.json(),
    }
  }
}
