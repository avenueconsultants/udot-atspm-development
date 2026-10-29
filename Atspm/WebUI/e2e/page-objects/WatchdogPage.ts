import { expect, type Page } from '@playwright/test'
import { featureData } from '../fixtures/featureData'
import { selectLocation } from '../helpers/stack'

export class WatchdogPage {
  constructor(readonly page: Page) {}

  async goto(identifier: string = featureData.location) {
    await this.page.clock.setFixedTime(new Date(2026, 0, 6, 12))
    await this.page.goto('/watchdog')
    await expect(
      this.page.getByRole('tab', { name: 'Logs', exact: true })
    ).toHaveAttribute('aria-selected', 'true')
    await selectLocation(this.page, identifier)
  }

  async generate() {
    const responsePromise = this.page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        new URL(response.url()).pathname
          .toLowerCase()
          .endsWith('/api/v1/watchdog/getreportdata')
    )
    await this.page
      .getByRole('button', { name: 'Generate Report', exact: true })
      .click()
    const response = await responsePromise
    expect(response.status(), await response.text()).toBe(200)
    return {
      request: response.request().postDataJSON(),
      body: await response.json(),
    }
  }
}
