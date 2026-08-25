// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - e2e/unauthorized.spec.ts
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

test('visiting verify-user while logged out redirects to unauthorized', async ({
  page,
  context,
}) => {
  await context.clearCookies()
  await mockAppShell(page)

  await page.goto('/verify-user')
  await page.waitForURL('**/unauthorized')

  await expect(
    page.getByRole('heading', { name: 'Unauthorized Access' })
  ).toBeVisible()
})
