import { expect, test, type Page } from '@playwright/test'
import { knownDates, scenarios } from '../fixtures/seedData'
import { TimeOfDayPage } from '../page-objects/TimeOfDayPage'

const requestBodyFor = async (
  page: Page,
  amDirections: string[],
  pmDirections: string[]
) => {
  const params = new URLSearchParams({
    locations: scenarios.unknownLocation,
    dates: knownDates.monday,
    amPrimaryDirections: amDirections.join(','),
    pmPrimaryDirections: pmDirections.join(','),
  })
  const tod = new TimeOfDayPage(page)
  await tod.goto(`?${params}`)

  const requestPromise = page.waitForRequest(
    (request) =>
      request.url().includes('/api/v1/TimeOfDay') &&
      request.method() === 'POST'
  )
  await tod.generate()
  return (await requestPromise).postDataJSON()
}

test.describe('Time-of-day primary directions', () => {
  test('defaults to separate AM/PM grids with north and south selected', async ({
    page,
  }) => {
    const tod = new TimeOfDayPage(page)
    await tod.goto()

    await expect(
      page.getByRole('checkbox', { name: 'Separate AM/PM directions' })
    ).toBeChecked()

    for (const period of ['amPrimaryDirections', 'pmPrimaryDirections']) {
      const grid = page.getByTestId(`time-of-day-directions-${period}`)
      await expect(grid.getByRole('button', { name: 'Northbound' })).toHaveAttribute(
        'aria-pressed',
        'true'
      )
      await expect(grid.getByRole('button', { name: 'Southbound' })).toHaveAttribute(
        'aria-pressed',
        'true'
      )
    }
  })

  test('collapses to one all-day grid when period-specific directions are disabled', async ({
    page,
  }) => {
    const tod = new TimeOfDayPage(page)
    await tod.goto()

    await page
      .getByRole('checkbox', { name: 'Separate AM/PM directions' })
      .uncheck()

    await expect(
      page.getByTestId('time-of-day-directions-allDayPrimaryDirections')
    ).toBeVisible()
    await expect(
      page.getByTestId('time-of-day-directions-amPrimaryDirections')
    ).toHaveCount(0)
    await expect(
      page.getByTestId('time-of-day-directions-pmPrimaryDirections')
    ).toHaveCount(0)
  })

  test('sends one all-day direction when AM and PM match', async ({ page }) => {
    const body = await requestBodyFor(
      page,
      ['Northbound'],
      ['Northbound']
    )
    expect(body.allDayPrimaryDirections).toEqual(['Northbound'])
  })

  test('sends the axis union when AM and PM are opposing directions', async ({
    page,
  }) => {
    const body = await requestBodyFor(page, ['Northbound'], ['Southbound'])
    expect(body.allDayPrimaryDirections).toEqual([
      'Northbound',
      'Southbound',
    ])
  })

  test('lets the backend infer all-day direction when AM and PM cross axes', async ({
    page,
  }) => {
    const body = await requestBodyFor(page, ['Northbound'], ['Eastbound'])
    expect(body.allDayPrimaryDirections).toEqual([])
  })

  test('shows per-location and corridor warnings for a requested direction without data', async ({
    page,
  }) => {
    const tod = new TimeOfDayPage(page)
    await tod.goto(
      `?locations=${scenarios.splitPressure}&dates=${knownDates.monday}&dataSource=Aggregated&amPrimaryDirections=Southbound&pmPrimaryDirections=Southbound`
    )
    await tod.generate()

    await tod.warnings().getByRole('button', { name: /warnings?$/ }).click()
    await expect(tod.warnings()).toContainText(
      'primary direction data is unavailable'
    )
    await page.getByRole('tab', { name: 'Location Data' }).click()
    const row = page
      .getByRole('row')
      .filter({ hasText: scenarios.splitPressure })
    await expect(row).toContainText(
      'AM primary direction data unavailable for Southbound.'
    )
    await expect(row).toContainText(
      'PM primary direction data unavailable for Southbound.'
    )
  })

  test('degrades both analyses to summary text when requested directions have no corridor data', async ({
    page,
  }) => {
    const tod = new TimeOfDayPage(page)
    await tod.goto(
      `?locations=${scenarios.splitPressure}&dates=${knownDates.monday}&dataSource=Aggregated&amPrimaryDirections=Southbound&pmPrimaryDirections=Southbound`
    )
    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/TimeOfDay') &&
        response.request().method() === 'POST'
    )
    await tod.generate()
    const body = await (await responsePromise).json()

    expect(body.recommendation.recommendedSchedule).toEqual([])
    expect(body.recommendation.summaryText).toContain(
      'primary direction data is unavailable for AM: Southbound; PM: Southbound'
    )
    expect(body.splitPressure.crossTrafficShare).toEqual([])
    expect(body.splitPressure.summaryText).toContain('AM: Southbound')
    expect(body.splitPressure.summaryText).toContain('PM: Southbound')
  })
})
