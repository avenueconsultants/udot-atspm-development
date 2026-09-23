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
// - authenticated or not. Those 401 against the real, remote backend when
// there's no session cookie. That no longer crashes the page (auth errors
// don't throw app-wide, per src/lib/react-query.ts, and Layout now wraps its
// chrome in an error boundary), but stubbing them still keeps these tests
// off the live network so they stay fast and deterministic.
//
// The profile carries a name because a signed-in UserMenu (see
// e2e/support/session.ts) draws the avatar initials from it.
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
      body: JSON.stringify({ firstName: 'Test', lastName: 'User' }),
    })
  )
}
