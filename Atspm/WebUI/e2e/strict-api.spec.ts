import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { stubEndpoint } from './support/api'
import { installStrictApiGuard } from './support/strictApi'

const apiOrigin = 'https://strict-api.invalid'

// Every navigation/request is intercepted; this harness needs no app server
// or real API. Keep the page on the synthetic API origin to avoid CORS noise.
const setup = async (
  page: Page,
  diagnostics: Pick<TestInfo, 'status' | 'expectedStatus' | 'attach'>
) => {
  const finish = await installStrictApiGuard(
    page,
    { reports: apiOrigin },
    diagnostics
  )
  await page.route(`${apiOrigin}/`, (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><title>API harness</title><h1>API harness</h1>',
    })
  )
  await page.goto(apiOrigin)
  return finish
}

test('strict API guard permits an explicitly stubbed endpoint and method', async ({
  page,
}, testInfo) => {
  const finish = await setup(page, testInfo)
  const requests = await stubEndpoint(page, {
    host: apiOrigin,
    path: '/Expected',
    method: 'GET',
    body: { count: 3 },
  })

  const response = await page.evaluate(async () => {
    const response = await fetch('/Expected')
    return { status: response.status, body: await response.json() }
  })
  expect(response).toEqual({ status: 200, body: { count: 3 } })
  expect(requests).toHaveLength(1)
  await finish()
  expect(
    testInfo.attachments.some((item) => item.name === 'failure-page-snapshot')
  ).toBe(false)
})

test('strict API guard aborts and reports a wrong method on a known endpoint', async ({
  page,
}, testInfo) => {
  const finish = await setup(page, testInfo)
  const requests = await stubEndpoint(page, {
    host: apiOrigin,
    path: '/Expected',
    method: 'GET',
    body: [],
  })

  const outcome = await page.evaluate(() =>
    fetch('/Expected', { method: 'POST' }).then(
      () => 'fulfilled',
      () => 'rejected'
    )
  )
  expect(outcome).toBe('rejected')
  expect(requests).toHaveLength(0)
  await expect(finish()).rejects.toThrow(`POST ${apiOrigin}/Expected`)
  expect(await failureSnapshot(testInfo)).toContain('heading "API harness"')
})

test('strict API guard aborts and reports an unexpected endpoint', async ({
  page,
}, testInfo) => {
  const finish = await setup(page, testInfo)
  const outcome = await page.evaluate(() =>
    fetch('/Unexpected').then(
      () => 'fulfilled',
      () => 'rejected'
    )
  )

  expect(outcome).toBe('rejected')
  await expect(finish()).rejects.toThrow(`GET ${apiOrigin}/Unexpected`)
  expect(await failureSnapshot(testInfo)).toContain('heading "API harness"')
})

async function failureSnapshot(testInfo: TestInfo) {
  const attachment = testInfo.attachments.find(
    (item) => item.name === 'failure-page-snapshot'
  )
  expect(
    attachment,
    'A failed test must retain the page snapshot'
  ).toBeDefined()
  if (!attachment) throw new Error('Missing failure page snapshot')
  return attachment.path
    ? readFile(attachment.path, 'utf8')
    : attachment.body?.toString('utf8')
}

test('strict API guard captures page diagnostics when the test has already failed', async ({
  page,
}, testInfo) => {
  const finish = await setup(page, {
    status: 'failed',
    expectedStatus: 'passed',
    attach: testInfo.attach.bind(testInfo),
  })
  await finish()
  expect(page.isClosed()).toBe(true)
  expect(await failureSnapshot(testInfo)).toContain('heading "API harness"')
})
