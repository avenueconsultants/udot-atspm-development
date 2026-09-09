// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - e2e/admin-areas.spec.ts
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
import { expect, test, type Page } from '@playwright/test'
import { odataCollection } from '../src/test/fixtures/api'
import { stubEndpoint } from './support/api'
import { mockAppShell } from './support/mockAppShell'
import { signIn } from './support/session'
import { stubApiHosts } from './support/stubApiHosts'

// Areas is the plainest of the AdminTable screens, so it stands in for the
// whole family (regions, jurisdictions, roles...): read the OData entity
// set, create through POST, delete through DELETE /{key}. What the migration
// can break here is the wire shape, so each test asserts on the request the
// generated hook actually sent, not just on what the page showed afterwards.

const audit = {
  created: '2026-08-28T21:09:14.94Z',
  modified: '2026-08-28T21:09:14.94Z',
  createdBy: 'System',
  modifiedBy: 'System',
}

const areas = [
  { id: 1, name: 'North Valley', ...audit },
  { id: 2, name: 'West Bench', ...audit },
]

const stubBackend = async (page: Page) => {
  const hosts = await stubApiHosts(page)
  await mockAppShell(page)
  await stubEndpoint(page, {
    host: hosts.config,
    path: '/Area',
    method: 'GET',
    body: odataCollection('Area', areas),
  })
  return hosts
}

test.beforeEach(({ context, baseURL }) => signIn(context, baseURL))

test('lists the areas the config API returns', async ({ page }) => {
  await stubBackend(page)

  await page.goto('/admin/areas')

  await expect(page.getByRole('cell', { name: 'North Valley' })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'West Bench' })).toBeVisible()
})

test('creating an area posts only its name', async ({ page }) => {
  const hosts = await stubBackend(page)
  const posts = await stubEndpoint(page, {
    host: hosts.config,
    path: '/Area',
    method: 'POST',
    status: 201,
    respond: (request) => ({ id: 3, ...request.postDataJSON(), ...audit }),
  })

  await page.goto('/admin/areas')
  await page.getByRole('button', { name: 'New Area' }).click()

  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Name').fill('South Bench')
  await dialog.getByRole('button', { name: 'Save' }).click()

  await expect(page.getByText('Area Created')).toBeVisible()
  expect(posts).toHaveLength(1)
  // The editor modal hands the page a whole Area; the create must forward
  // only the name, not an undefined id or the audit fields.
  expect(posts[0].postDataJSON()).toEqual({ name: 'South Bench' })
})

test('deleting an area calls DELETE on its key', async ({ page }) => {
  const hosts = await stubBackend(page)
  const deletes = await stubEndpoint(page, {
    host: hosts.config,
    path: /\/Area\/\d+$/,
    method: 'DELETE',
    status: 204,
  })

  await page.goto('/admin/areas')
  await page
    .getByRole('row', { name: /West Bench/ })
    .getByRole('button', { name: 'more' })
    .click()
  await page.getByRole('menuitem', { name: 'Delete' }).click()
  await page.getByRole('button', { name: 'Delete Area' }).click()

  await expect(page.getByText('Area Deleted')).toBeVisible()
  expect(deletes).toHaveLength(1)
  expect(new URL(deletes[0].url()).pathname).toMatch(/\/Area\/2$/)
})
