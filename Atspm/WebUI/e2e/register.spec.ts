// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - e2e/register.spec.ts
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

// A render-only smoke test, matching login.spec.ts's approach: the
// registration mutation only fires on submit, so this never needs to touch
// the real identity API.
test('the registration form renders all of its fields', async ({ page }) => {
  await mockAppShell(page)
  await page.goto('/register')

  await expect(
    page.getByRole('heading', { name: 'Registration' })
  ).toBeVisible()
  await expect(page.getByLabel('First Name')).toBeVisible()
  await expect(page.getByLabel('Last Name')).toBeVisible()
  await expect(page.getByLabel('Email Address')).toBeVisible()
  await expect(page.getByLabel('Password')).toBeVisible()
  await expect(page.getByLabel('agency')).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Sign Up' })
  ).toBeVisible()

  const signInLink = page.getByRole('link', {
    name: 'Already have an account? Sign in',
  })
  await expect(signInLink).toHaveAttribute('href', '/login')
})
