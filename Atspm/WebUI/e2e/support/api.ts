// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - e2e/support/api.ts
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
import type { Page, Request } from '@playwright/test'

export interface ApiHosts {
  config?: string
  reports?: string
  identity?: string
  data?: string
  speed?: string
}

// An unset host is skipped; a malformed one throws, because a spec that
// silently reached the live network would be worse than a failed run.
const originOf = (url: string | undefined) =>
  url ? new URL(url).origin : undefined

// The origins the running app was configured with, read from its own
// /api/get-env route so a spec matches whatever URLs the local .env (or the
// CI .env.example) carries instead of guessing a hostname.
export const readApiHosts = async (page: Page): Promise<ApiHosts> => {
  const env: Record<string, string | undefined> = await page.request
    .get('/api/get-env')
    .then((response) => response.json())

  return {
    config: originOf(env.CONFIG_URL),
    reports: originOf(env.REPORTS_URL),
    identity: originOf(env.IDENTITY_URL),
    data: originOf(env.DATA_URL),
    speed: originOf(env.SPEED_URL),
  }
}

export const jsonResponse = (body: unknown, status = 200) =>
  body === undefined
    ? { status }
    : { status, contentType: 'application/json', body: JSON.stringify(body) }

interface EndpointStub {
  /** One of the ApiHosts origins. */
  host: string | undefined
  /** A pathname suffix ('/Area', '/Location/1') or a pathname pattern. */
  path: string | RegExp
  /** Without a method the stub answers every verb on the path. */
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  status?: number
  /** A fixed JSON body. */
  body?: unknown
  /** Builds the JSON body from the request, for echo-style responses. */
  respond?: (request: Request) => unknown
}

// Answers one endpoint on one API host and hands back every request it saw,
// so a test can assert what the generated client actually sent. A request
// for the same path with a different method falls through to whatever was
// registered before it - normally the stubApiHosts catch-all.
export const stubEndpoint = async (
  page: Page,
  stub: EndpointStub
): Promise<Request[]> => {
  if (!stub.host) {
    throw new Error(
      `No API host configured for ${String(stub.path)} - check the .env the e2e server runs with`
    )
  }
  const host = stub.host
  const requests: Request[] = []
  const matchesPath = (pathname: string) =>
    typeof stub.path === 'string'
      ? pathname.endsWith(stub.path)
      : stub.path.test(pathname)

  await page.route(
    (url) => url.origin === host && matchesPath(url.pathname),
    (route) => {
      const request = route.request()
      if (stub.method && request.method() !== stub.method) {
        return route.fallback()
      }
      requests.push(request)
      const body = stub.respond ? stub.respond(request) : stub.body
      return route.fulfill(jsonResponse(body, stub.status))
    }
  )

  return requests
}

// Leaflet asks the configured tile server for every visible tile. Nothing in
// the suite asserts on map imagery, and the CI environment points the tile
// layer at a placeholder host, so the requests are dropped rather than left
// to time out.
export const blockMapTiles = (page: Page) =>
  page.route(
    (url) => /\/\d+\/\d+\/\d+(@2x)?\.png$/.test(url.pathname),
    (route) => route.abort()
  )
