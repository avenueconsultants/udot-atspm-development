import { expect, test } from '@playwright/test'
import { featureData } from '../../fixtures/featureData'
import { api } from '../../helpers/stack'
import { LoginPage } from '../../page-objects/LoginPage'

test.describe('Anonymous authentication behavior', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('validates empty credentials before contacting IdentityApi', async ({ page }) => {
    const requests: string[] = []
    page.on('request', request => { if (request.url().includes('/Account/login')) requests.push(request.url()) })
    await new LoginPage(page).goto()
    await page.getByRole('button', { name: 'Sign In', exact: true }).click()
    await expect(page.getByText('Email is required', { exact: true })).toBeVisible()
    await expect(page.getByText('Password is required', { exact: true })).toBeVisible()
    expect(requests).toEqual([])
  })

  test('rejects invalid email formatting', async ({ page }) => {
    await new LoginPage(page).goto()
    await page.getByLabel('Email Address').fill('not-an-email')
    await page.getByLabel('Password', { exact: true }).fill('invalid')
    await page.getByRole('button', { name: 'Sign In', exact: true }).click()
    await expect(page.getByText('Invalid email format', { exact: true })).toBeVisible()
    await expect(page).toHaveURL(/\/login$/)
  })

  for (const path of ['/admin/locations', '/watchdog', '/left-turn-gap-report']) {
    test(`redirects anonymous navigation from ${path} to login`, async ({ page }) => {
      await page.goto(path)
      await expect(page).toHaveURL(/\/login$/)
      await expect(page.getByLabel('Email Address')).toBeVisible()
    })
  }

  test('rejects an unauthenticated profile API request', async ({ page }) => {
    const { root } = await api(page, 'IDENTITY_URL')
    const response = await page.request.get(`${root}/api/v1/Profile`)
    expect(response.status()).toBe(401)
  })

  test('rejects a malformed bearer token at the API', async ({ page }) => {
    const { root } = await api(page, 'IDENTITY_URL')
    const response = await page.request.get(`${root}/api/v1/Profile`, { headers: { Authorization: 'Bearer expired-or-invalid-token' } })
    expect(response.status()).toBe(401)
  })
})

test.describe('Unprivileged account permissions', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test.beforeEach(async ({ page }) => {
    await new LoginPage(page).signIn(featureData.ordinaryEmail, featureData.ordinaryPassword)
  })

  test('authenticates the seeded account and retrieves its own profile', async ({ page }) => {
    const { root, headers } = await api(page, 'IDENTITY_URL')
    const response = await page.request.get(`${root}/api/v1/Profile`, { headers })
    expect(response.status()).toBe(200)
    const body = await response.json()
    expect(body.email).toBe(featureData.ordinaryEmail)
    expect(body.roles).not.toContain('Admin')
  })

  for (const path of ['/admin/locations', '/watchdog', '/left-turn-gap-report']) {
    test(`denies unprivileged navigation to ${path}`, async ({ page }) => {
      await page.goto(path)
      await expect(page).toHaveURL(/\/unauthorized$/)
      await expect(page.getByRole('heading', { name: 'Unauthorized Access' })).toBeVisible()
    })
  }

  test('denies privileged API access even when the UI claims cookie says Admin', async ({ page }) => {
    const claims = (await page.context().cookies()).find(cookie => cookie.name === 'claims')
    await page.context().addCookies([{ name: 'claims', value: 'Admin', url: page.url(), secure: claims?.secure ?? true }])
    const { root, headers } = await api(page, 'IDENTITY_URL')
    const response = await page.request.get(`${root}/api/v1/Roles`, { headers })
    expect(response.status()).toBe(403)
  })
})

test.describe('Administrator permissions', () => {
  test('allows the authenticated administrator to read roles and location administration', async ({ page }) => {
    const { root, headers } = await api(page, 'IDENTITY_URL')
    const response = await page.request.get(`${root}/api/v1/Roles`, { headers })
    expect(response.status()).toBe(200)
    expect(JSON.stringify(await response.json())).toContain('Admin')
    await page.goto('/admin/locations')
    await expect(page.getByRole('button', { name: 'New Location', exact: true })).toBeVisible()
  })
})
