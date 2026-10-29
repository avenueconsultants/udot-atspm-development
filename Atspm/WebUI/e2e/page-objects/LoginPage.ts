import { expect, type Page } from '@playwright/test'

export class LoginPage {
  constructor(readonly page: Page) {}

  async goto() {
    await this.page.goto('/login')
    await expect(this.page.getByLabel('Email Address')).toBeVisible()
  }

  async signIn(email: string, password: string) {
    await this.goto()
    await this.page.getByLabel('Email Address').fill(email)
    await this.page.getByLabel('Password', { exact: true }).fill(password)
    await this.page.getByRole('button', { name: 'Sign In', exact: true }).click()
    await expect(this.page).toHaveURL(/\/performance-measures$/)
  }
}
