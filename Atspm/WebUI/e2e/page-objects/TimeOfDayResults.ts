import type { Page } from '@playwright/test'

export class TimeOfDayResults {
  constructor(readonly page: Page) {}

  readonly root = () => this.page.getByTestId('time-of-day-results')
  readonly chartTab = () =>
    this.page.getByRole('tab', { name: 'Time-of-Day Chart' })
  readonly schedulesTab = () =>
    this.page.getByRole('tab', { name: 'Schedules' })
  readonly locationDataTab = () =>
    this.page.getByRole('tab', { name: 'Location Data' })
}
