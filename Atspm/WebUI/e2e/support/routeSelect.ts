// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - e2e/support/routeSelect.ts
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
import type { Page } from '@playwright/test'

// The shared RouteSelect component (link pivot, aggregate charts) is a MUI
// Select whose label points at a hidden input with id "route-select"; the
// visible control is that input's sibling combobox.
export const routePicker = (page: Page) =>
  page.locator('#route-select').locator('..').getByRole('combobox')

export const chooseRoute = async (page: Page, name: string) => {
  await routePicker(page).click()
  await page.getByRole('option', { name }).click()
}
