import { expect, type Page } from '@playwright/test'

export async function api(
  page: Page,
  service: 'CONFIG_URL' | 'REPORTS_URL' | 'IDENTITY_URL' | 'DATA_URL'
) {
  const response = await page.request.get('/api/get-env')
  expect(response.ok()).toBeTruthy()
  const env = await response.json()
  expect(
    env[service],
    `${service} must point to the seeded test stack`
  ).toBeTruthy()
  const root = String(env[service])
    .replace(/\/api\/v1\/?$/i, '')
    .replace(/\/+$/, '')
  const token = (await page.context().cookies()).find(
    (cookie) => cookie.name === 'token'
  )?.value
  const headers: Record<string, string> = token
    ? { Authorization: `Bearer ${decodeURIComponent(token)}` }
    : {}
  return {
    root,
    headers,
  }
}

export async function fixtureLocation(page: Page, identifier: string) {
  const { root, headers } = await api(page, 'CONFIG_URL')
  const params = new URLSearchParams({
    $filter: `locationIdentifier eq '${identifier}'`,
    $expand: 'approaches($expand=detectors)',
    $orderby: 'start desc',
  })
  const response = await page.request.get(`${root}/api/v1/Location?${params}`, {
    headers,
  })
  expect(response.status()).toBe(200)
  const body = await response.json()
  expect(
    body.value.length,
    `Run npm run test:e2e:seed; missing ${identifier}`
  ).toBeGreaterThan(0)
  return body.value[0]
}

export async function selectLocation(page: Page, identifier: string) {
  const input = page.getByRole('combobox', { name: 'Location', exact: true })
  await input.fill(identifier)
  await page.getByRole('option').filter({ hasText: identifier }).click()
}
