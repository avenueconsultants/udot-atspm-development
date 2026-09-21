import {
  test as base,
  expect,
  type Page,
  type TestInfo,
} from '@playwright/test'
import { readApiHosts, type ApiHosts } from './api'

// Install this before endpoint stubs: the most recently registered page route
// wins, and a stub with the wrong HTTP method falls back to this guard.
// The returned teardown closes the page before checking failures so routing
// remains in place until the page can no longer send requests to live APIs.
export const installStrictApiGuard = async (
  page: Page,
  hosts: ApiHosts,
  diagnostics?: Pick<TestInfo, 'status' | 'expectedStatus' | 'attach'>
) => {
  const origins = new Set(Object.values(hosts).filter(Boolean))
  const unexpectedRequests: string[] = []
  const pendingAborts = new Set<Promise<void>>()

  await page.route(
    (url) => origins.has(url.origin),
    async (route) => {
      const request = route.request()
      const url = new URL(request.url())
      unexpectedRequests.push(
        `${request.method()} ${url.origin}${url.pathname}`
      )
      const abort = route.abort('blockedbyclient')
      pendingAborts.add(abort)
      try {
        await abort
      } finally {
        pendingAborts.delete(abort)
      }
    }
  )

  return async () => {
    // Playwright captures its automatic DOM snapshot after fixture teardown.
    // Keep a snapshot before closing, including when a late unexpected
    // request makes an otherwise successful test fail during this teardown.
    let snapshot: string | undefined
    if (diagnostics && !page.isClosed()) {
      try {
        snapshot = await page.ariaSnapshot({ timeout: 5_000 })
      } catch {
        // A crashed/closed page must not mask the original test or API failure.
      }
    }
    await page.close()
    await Promise.all(pendingAborts)
    if (
      diagnostics &&
      snapshot !== undefined &&
      (unexpectedRequests.length > 0 ||
        diagnostics.status !== diagnostics.expectedStatus)
    ) {
      await diagnostics.attach('failure-page-snapshot', {
        body: snapshot,
        contentType: 'text/plain',
      })
    }
    expect(
      unexpectedRequests,
      'Unexpected API requests: add explicit endpoint stubs with the expected HTTP method.'
    ).toEqual([])
  }
}

// Opt in by importing test here and requesting apiHosts. Existing specs may
// continue using stubApiHosts; strict specs must not install that permissive
// catch-all after this fixture, since it would hide unexpected API requests.
export const test = base.extend<{ apiHosts: ApiHosts }>({
  serviceWorkers: 'block',
  apiHosts: async ({ page }, use, testInfo) => {
    const hosts = await readApiHosts(page)
    const finish = await installStrictApiGuard(page, hosts, testInfo)
    try {
      await use(hosts)
    } finally {
      await finish()
    }
  },
})

export { expect }
