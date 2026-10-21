import { expect, test } from '@playwright/test'
import { TimeOfDayPage } from '../page-objects/TimeOfDayPage'

test.describe('Time-of-day roadway presets', () => {
  test('applies every threshold and rematches after a manual edit is restored', async ({
    page,
  }) => {
    const tod = new TimeOfDayPage(page)
    await tod.goto()

    const preset = page.getByRole('combobox', {
      name: 'Roadway type threshold preset',
    })
    await preset.click()
    await page
      .getByRole('option', { name: 'FHWA Retail / Commercial' })
      .click()
    await expect(preset).toContainText('FHWA Retail / Commercial')

    await page
      .getByRole('button', { name: 'Customize roadway type thresholds' })
      .click()

    const expectedSliderValues: Record<string, string> = {
      'AM start threshold': '50',
      'AM end threshold': '38',
      'PM start threshold': '62',
      'PM end threshold': '36',
      'Daily peak threshold': '25',
      'Dynamic range threshold': '20',
    }
    for (const [name, value] of Object.entries(expectedSliderValues)) {
      await expect(page.getByRole('slider', { name })).toHaveAttribute(
        'aria-valuenow',
        value
      )
    }
    await expect(
      page.getByRole('spinbutton', {
        name: 'Consecutive bins for AM/PM transitions',
      })
    ).toHaveValue('3')
    await expect(
      page.getByRole('spinbutton', { name: 'Consecutive bins before FREE' })
    ).toHaveValue('4')

    const amStart = page.getByRole('slider', { name: 'AM start threshold' })
    await amStart.press('ArrowRight')
    await expect(preset).toContainText('Custom')

    await amStart.press('ArrowLeft')
    await expect(amStart).toHaveAttribute('aria-valuenow', '50')
    await expect(preset).toContainText('FHWA Retail / Commercial')
  })
})
