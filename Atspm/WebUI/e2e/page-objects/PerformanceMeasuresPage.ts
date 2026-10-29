import { expect, type Page } from '@playwright/test'
import { featureData } from '../fixtures/featureData'

export class PerformanceMeasuresPage {
  constructor(readonly page: Page) {}

  readonly generateButton = () =>
    this.page.getByRole('button', { name: 'Generate Charts', exact: true })

  async goto(
    chartType = 'PurduePhaseTermination',
    location: string = featureData.location
  ) {
    const params = new URLSearchParams({
      location,
      chartType,
      start: featureData.start,
      end: featureData.end,
    })
    await this.page.goto(`/performance-measures?${params}`)
    await expect(
      this.page.locator('input#measure-type-select'),
      `Fixture must expose the requested ${chartType} measure`
    ).toHaveValue(chartType)
    await expect(this.generateButton()).toBeVisible()
  }

  async generate(endpoint: string) {
    const responsePromise = this.page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname
          .toLowerCase()
          .endsWith(endpoint.toLowerCase()) &&
        response.request().method() === 'POST'
    )
    await this.generateButton().click()
    const response = await responsePromise
    expect(response.status(), await response.text()).toBe(200)
    return {
      request: response.request().postDataJSON(),
      body: await response.json(),
    }
  }

  async expectChart() {
    await expect(this.page.locator('[id^="chart-"]').first()).toBeVisible()
    await expect(
      this.page.locator('[id^="chart-"]').first().locator('canvas, svg').first()
    ).toBeVisible()
  }
}
