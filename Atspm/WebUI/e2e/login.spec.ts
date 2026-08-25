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

// A smoke test that only depends on the Next.js server itself (via the
// internal /api/get-env route) - it deliberately avoids submitting the form,
// since that calls the real identity API and there's no backend running in
// this setup yet.
test('login page renders the sign-in form', async ({ page }) => {
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
