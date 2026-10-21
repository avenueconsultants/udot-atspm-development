import { expect, test as setup } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const readEnvFile = () => {
  const envPath = path.resolve(__dirname, '../../.env')
  const values = new Map<string, string>()

  for (const rawLine of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const separator = line.indexOf('=')
    if (separator < 1) continue
    values.set(
      line.slice(0, separator),
      line.slice(separator + 1).replace(/^['"]|['"]$/g, '')
    )
  }

  return values
}

setup('authenticate the seeded administrator', async ({ page }) => {
  const env = readEnvFile()
  const email = process.env.PLAYWRIGHT_ADMIN_EMAIL ?? env.get('ADMIN_EMAIL')
  const password =
    process.env.PLAYWRIGHT_ADMIN_PASSWORD ?? env.get('ADMIN_PASSWORD')

  if (!email || !password) {
    throw new Error(
      'Set PLAYWRIGHT_ADMIN_EMAIL/PLAYWRIGHT_ADMIN_PASSWORD or ADMIN_EMAIL/ADMIN_PASSWORD in Atspm/.env.'
    )
  }

  await page.goto('/login')
  await page.getByLabel('Email Address').fill(email)
  await page.getByLabel('Password').fill(password)
  await Promise.all([
    page.waitForURL((url) => url.pathname !== '/login', {
      timeout: 30_000,
      waitUntil: 'commit',
    }),
    page.getByRole('button', { name: 'Sign In', exact: true }).click(),
  ])
  await expect(page).toHaveURL(/\/performance-measures$/)

  const authDir = path.resolve(__dirname, '.auth')
  fs.mkdirSync(authDir, { recursive: true })
  await page.context().storageState({ path: path.join(authDir, 'admin.json') })
})
