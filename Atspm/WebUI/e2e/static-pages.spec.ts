// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - e2e/static-pages.spec.ts
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

// The pages with no behaviour of their own: one render check each, in one
// spec, so they cost a single browser context between them.

test('an unknown route renders the custom 404 page with a link home', async ({
  page,
}) => {
  await mockAppShell(page)
  await page.goto('/this-route-does-not-exist')

  await expect(
    page.getByRole('heading', { name: '404 - Page Not Found' })
  ).toBeVisible()

  const goHome = page.getByRole('link', { name: 'Go Home' })
  await expect(goHome).toBeVisible()
  await expect(goHome).toHaveAttribute('href', '/')
})

test('the unauthorized page renders its message', async ({ page }) => {
  await mockAppShell(page)
  await page.goto('/unauthorized')

  await expect(
    page.getByRole('heading', { name: 'Unauthorized Access' })
  ).toBeVisible()
  await expect(
    page.getByText('You do not have permission to access this page.')
  ).toBeVisible()
})
