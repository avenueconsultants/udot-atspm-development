// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - e2e/support/session.ts
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
import type { BrowserContext } from '@playwright/test'

// The app decides what a visitor may see from two cookies the login flow
// sets: `loggedIn` and the comma-separated `claims` list (see
// src/lib/Authorization.tsx and src/features/identity/pagesCheck.ts). No
// request reaches the identity API for that, so a session is just the
// cookies. 'Admin' unlocks every page; pass a narrower list to exercise a
// specific role.
export const signIn = (
  context: BrowserContext,
  baseURL: string | undefined,
  claims = 'Admin'
) => {
  const url = baseURL ?? 'http://localhost:3000'
  return context.addCookies([
    { name: 'loggedIn', value: 'true', url },
    { name: 'claims', value: claims, url },
  ])
}
