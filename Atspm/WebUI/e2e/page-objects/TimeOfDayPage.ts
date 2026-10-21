import { expect, type Page } from '@playwright/test'

export class TimeOfDayPage {
  constructor(readonly page: Page) {}

  readonly root = () => this.page.getByTestId('time-of-day-page')
  readonly generateButton = () => this.page.getByTestId('time-of-day-generate')
  readonly errors = () => this.page.getByTestId('time-of-day-errors')
  readonly warnings = () => this.page.getByTestId('time-of-day-warnings')
  readonly locationRows = () =>
    this.page.getByTestId('time-of-day-location-row')
  readonly results = () => this.page.getByTestId('time-of-day-results')

  async goto(query = '') {
    await this.page.goto(`/time-of-day${query}`)
    await expect(this.root()).toBeVisible()
  }

  async generate() {
    await this.generateButton().click()
  }

  async clearDates() {
    await this.page.getByTestId('time-of-day-clear-dates').click()
  }

  async clearLocations() {
    await this.page.getByTestId('time-of-day-clear-locations').click()
  }
}
