// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - e2e/admin-access.spec.ts
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

// /admin/roles unconditionally fetches its own /Roles list on every render
// (the same un-gated-query pattern fixed in Topbar/UserMenu, just not fixed
// here yet), so it needs stubbing too to keep this test backend-independent.
const mockRolesList = (page: import('@playwright/test').Page) =>
  page.route('**/Roles', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    })
  )

test('an unauthenticated visit to an admin page redirects to login', async ({
  page,
  context,
}) => {
  await context.clearCookies()
  await mockAppShell(page)
  await mockRolesList(page)

  await page.goto('/admin/roles')
  await page.waitForURL('**/login')

  await expect(
    page.getByRole('heading', { name: 'Login' })
  ).toBeVisible()
})

test('a logged-in visit to an admin page without permission redirects to unauthorized', async ({
  page,
  context,
}) => {
  await context.addCookies([
    {
      name: 'loggedIn',
      value: 'true',
      domain: 'localhost',
      path: '/',
    },
    {
      name: 'claims',
      value: 'SomeOtherPermission:View',
      domain: 'localhost',
      path: '/',
    },
  ])
  await mockAppShell(page)
  await mockRolesList(page)

  await page.goto('/admin/roles')
  await page.waitForURL('**/unauthorized')

  await expect(
    page.getByRole('heading', { name: 'Unauthorized Access' })
  ).toBeVisible()
})
