// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - e2e/support/mockAppShell.ts
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

// Every page renders inside the shared Layout, whose Topbar/UserMenu chrome
// fetches /MenuItems (config API) and /Profile (identity API) unconditionally
// - authenticated or not. React Query's app-wide `throwOnError: true` default
// (src/lib/react-query.ts) means a 401 from either one - the real, live
// backend's genuine response when there's no session cookie - throws during
// render instead of just setting query error state, and Layout/Topbar aren't
// wrapped in an error boundary, so it crashes the whole page instead of just
// that component. Stubbing both keeps otherwise backend-independent e2e
// tests from tripping over that.
export const mockAppShell = async (page: Page) => {
  await page.route('**/MenuItems*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ '@odata.context': 'stub', value: [] }),
    })
  )
  await page.route('**/Profile', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({}),
    })
  )
}
