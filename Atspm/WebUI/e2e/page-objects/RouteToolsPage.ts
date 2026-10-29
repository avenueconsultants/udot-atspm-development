import { expect, type Page } from '@playwright/test'
import { featureData } from '../fixtures/featureData'
import { api } from '../helpers/stack'

export class RouteToolsPage {
  constructor(readonly page: Page) {}

  async routeId() {
    const { root, headers } = await api(this.page, 'CONFIG_URL')
    const query = new URLSearchParams({
      $filter: `name eq '${featureData.route}'`,
    })
    const response = await this.page.request.get(
      `${root}/api/v1/Route?${query}`,
      { headers }
    )
    expect(response.status()).toBe(200)
    const body = await response.json()
    expect(body.value).toHaveLength(1)
    return String(body.value[0].id)
  }

  async historic() {
    const routeId = await this.routeId()
    const params = new URLSearchParams({
      toolType: 'TimeSpaceHistoric',
      routeId,
      start: featureData.start,
      end: '2026-01-05T08:20:00',
    })
    await this.page.goto(`/time-space-diagrams?${params}`)
    await expect(
      this.page.getByRole('combobox', { name: 'Route Select' })
    ).toHaveValue(featureData.route)
    return routeId
  }
}
