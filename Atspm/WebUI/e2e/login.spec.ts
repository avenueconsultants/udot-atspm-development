// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - e2e/login.spec.ts
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//http://www.apache.org/licenses/LICENSE-2.
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
// #endregion
import { expect, test } from '@playwright/test'
import { mockAppShell } from './support/mockAppShell'

// A smoke test that only depends on the Next.js server itself (via the
// internal /api/get-env route) - it deliberately avoids submitting the form,
// since that calls the real identity API and there's no backend running in
// this setup yet.
test('login page renders the sign-in form', async ({ page }) => {
  await mockAppShell(page)
  await page.goto('/login')

  await expect(
    page.getByRole('heading', { name: 'Login' })
  ).toBeVisible()
  await expect(page.getByLabel('Email Address')).toBeVisible()
  await expect(page.getByLabel('Password')).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Sign In', exact: true })
  ).toBeVisible()
})

test('a successful sign-in stores the session cookies and redirects home', async ({
  page,
}) => {
  await mockAppShell(page)
  await page.route('**/Account/login', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 200,
        token: 'e2e-test-token',
        claims: ['admin'],
      }),
    })
  )

  await page.goto('/login')
  await page.getByLabel('Email Address').fill('user@example.com')
  await page.getByLabel('Password').fill('correct-password')
  await page
    .getByRole('button', { name: 'Sign In', exact: true })
    .click()

  // The component sets cookies synchronously right before triggering
  // `window.location.href = '/'`, which itself redirects again to the
  // default landing page - that follow-on navigation can detach the frame
  // mid-wait if this polls the URL instead, so check the cookies directly
  // rather than racing the redirect chain.
  await expect
    .poll(async () => {
      const cookies = await page.context().cookies()
      return cookies.find((c) => c.name === 'loggedIn')?.value
    })
    .toBe('True')

  const cookies = await page.context().cookies()
  expect(cookies.find((c) => c.name === 'token')?.value).toBe('e2e-test-token')
  expect(cookies.find((c) => c.name === 'claims')?.value).toBe('admin')
})

test('a failed sign-in shows an error and keeps the user on the login page', async ({
  page,
}) => {
  await mockAppShell(page)
  await page.route('**/Account/login', (route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ title: 'Invalid credentials' }),
    })
  )

  await page.goto('/login')
  await page.getByLabel('Email Address').fill('user@example.com')
  await page.getByLabel('Password').fill('wrong-password')
  await page
    .getByRole('button', { name: 'Sign In', exact: true })
    .click()

  await expect(page.getByText('Invalid email or password')).toBeVisible()
  expect(new URL(page.url()).pathname).toBe('/login')
})
