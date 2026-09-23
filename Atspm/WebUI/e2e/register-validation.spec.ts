// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - e2e/register-validation.spec.ts
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

// All client-side validation - every field's validator now has to pass
// before the registration mutation fires, so these never reach the identity
// API and need no backend mocking beyond the shared app-shell stub.
test("submitting the registration form empty shows every field's validation message", async ({
  page,
}) => {
  await mockAppShell(page)
  await page.goto('/register')

  await page.getByRole('button', { name: 'Sign Up' }).click()

  await expect(page.getByText('Name is Required').first()).toBeVisible()
  await expect(page.getByText('Agency is Required')).toBeVisible()
  await expect(page.getByText('Email is required.')).toBeVisible()
  await expect(
    page.getByText('Password should be at least 8 characters long.')
  ).toBeVisible()
})

test('a weak password shows the complexity requirements message', async ({
  page,
}) => {
  await mockAppShell(page)
  await page.goto('/register')

  await page.getByLabel('Password').fill('alllowercase')
  await page.getByRole('button', { name: 'Sign Up' }).click()

  await expect(
    page.getByText(
      'Password should contain at least one uppercase letter, one digit, and one symbol.'
    )
  ).toBeVisible()
})
