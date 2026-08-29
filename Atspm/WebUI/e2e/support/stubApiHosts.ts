// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - e2e/support/stubApiHosts.ts
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
import { jsonResponse, readApiHosts, type ApiHosts } from './api'

// Answers every request bound for one of the API hosts with an empty JSON
// array, so a spec never reaches the live network for calls it doesn't care
// about. Register the routes a spec does care about after this one -
// Playwright tries the most recently registered handler first - and use the
// returned hosts to pin them to the right origin.
//
// The body is a bare array on purpose: only the config API wraps collections
// in an OData envelope, and axios unwraps that shape only when
// "@odata.context" is present, so an envelope returned for a report-API call
// would reach the component unwrapped and blow up on .map. A bare array
// passes through both paths untouched and satisfies every list consumer.
export const stubApiHosts = async (page: Page): Promise<ApiHosts> => {
  const hosts = await readApiHosts(page)
  const origins = Object.values(hosts).filter(
    (origin): origin is string => !!origin
  )

  await page.route(
    (url) => origins.includes(url.origin),
    (route) => route.fulfill(jsonResponse([]))
  )

  return hosts
}
