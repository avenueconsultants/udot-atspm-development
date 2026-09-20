import { expect, test, type Page } from '@playwright/test'
import { stubEndpoint } from './support/api'
import { installStrictApiGuard } from './support/strictApi'

const apiOrigin = 'https://strict-api.invalid'

// Every navigation/request is intercepted; this harness needs no app server
// or real API. Keep the page on the synthetic API origin to avoid CORS noise.
const setup = async (page: Page) => {
  const finish = await installStrictApiGuard(page, { reports: apiOrigin })
  await page.route(`${apiOrigin}/`, (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><title>API harness</title>',
    })
  )
  await page.goto(apiOrigin)
  return finish
}

test('strict API guard permits an explicitly stubbed endpoint and method', async ({
  page,
}) => {
  const finish = await setup(page)
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
})

test('strict API guard aborts and reports a wrong method on a known endpoint', async ({
  page,
}) => {
  const finish = await setup(page)
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
})

test('strict API guard aborts and reports an unexpected endpoint', async ({
  page,
}) => {
  const finish = await setup(page)
  const outcome = await page.evaluate(() =>
    fetch('/Unexpected').then(
      () => 'fulfilled',
      () => 'rejected'
    )
  )

  expect(outcome).toBe('rejected')
  await expect(finish()).rejects.toThrow(`GET ${apiOrigin}/Unexpected`)
})
