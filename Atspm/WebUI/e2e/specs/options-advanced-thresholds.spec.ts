import { expect, test, type Page } from '@playwright/test'
import { knownDates, scenarios } from '../fixtures/seedData'
import { TimeOfDayPage } from '../page-objects/TimeOfDayPage'

const openOccupancySettings = async (page: Page) => {
  await page.getByText('Occupancy and Review', { exact: true }).click()
  await expect(page.getByRole('button', { name: 'Collapse sidebar' })).toBeVisible()
}

type ResultBody = {
  recommendation: {
    recommendedSchedule: Array<{
      planNumber: string
      start: string
      end: string
    }>
  }
  locations: Array<{ summary: { peakOccupancyPercent: number } }>
  splitPressure: { reviewText: string }
}

const generatedRequestBody = async (page: Page) => {
  const requestPromise = page.waitForRequest(
    (request) =>
      request.url().includes('/api/v1/TimeOfDay') &&
      request.method() === 'POST'
  )
  await page.keyboard.press('Escape')
  await new TimeOfDayPage(page).generate()
  return (await requestPromise).postDataJSON()
}

const generateResult = async (page: Page, query: string) => {
  const tod = new TimeOfDayPage(page)
  await tod.goto(query)
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/TimeOfDay') &&
      response.request().method() === 'POST'
  )
  await tod.generate()
  const response = await responsePromise
  expect(response.status()).toBe(200)
  return (await response.json()) as ResultBody
}

const plan = (body: ResultBody, planNumber: string) =>
  body.recommendation.recommendedSchedule.find(
    (candidate: { planNumber: string }) => candidate.planNumber === planNumber
  )

const minutes = (timestamp: string) => {
  const value = new Date(timestamp)
  return value.getHours() * 60 + value.getMinutes()
}

test.describe('Time-of-day advanced thresholds', () => {
  test.beforeEach(async ({ page }) => {
    await new TimeOfDayPage(page).goto(
      `?locations=${scenarios.commute}&dates=${knownDates.monday}&dataSource=Aggregated`
    )
  })

  test('shows schedule thresholds as percentages', async ({ page }) => {
    await page
      .getByRole('button', { name: 'Customize roadway type thresholds' })
      .click()

    for (const name of [
      'AM start threshold',
      'AM end threshold',
      'PM start threshold',
      'PM end threshold',
      'Daily peak threshold',
      'Dynamic range threshold',
    ]) {
      const slider = page.getByRole('slider', { name })
      await expect(slider).toBeVisible()
      await expect(slider).toHaveAttribute('aria-valuemax', '100')
    }
  })

  test('keeps the previous valid capacity when zero is entered', async ({
    page,
  }) => {
    await openOccupancySettings(page)
    const capacity = page.getByRole('spinbutton', {
      name: 'Per-lane capacity (veh/hr)',
    })
    await expect(capacity).toHaveValue('800')

    await capacity.fill('0')
    await expect(capacity).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByText('Min 1', { exact: true })).toBeVisible()

    const body = await generatedRequestBody(page)
    expect(body.laneCapacityVehiclesPerHour).toBe(800)
  })

  test('keeps a cleared capacity blank while editing and sends the previous value', async ({
    page,
  }) => {
    await openOccupancySettings(page)
    const capacity = page.getByRole('spinbutton', {
      name: 'Per-lane capacity (veh/hr)',
    })

    await capacity.fill('')
    await expect(capacity).toHaveValue('')

    const body = await generatedRequestBody(page)
    expect(body.laneCapacityVehiclesPerHour).toBe(800)
  })

  test('sends edited review thresholds and direction lane overrides', async ({
    page,
  }) => {
    await openOccupancySettings(page)
    const split = page.getByRole('slider', {
      name: 'Split review threshold',
    })
    const shoulder = page.getByRole('slider', {
      name: 'Shoulder review threshold',
    })
    await split.focus()
    await split.press('Home')
    await split.press('ArrowRight')
    await shoulder.focus()
    await shoulder.press('End')
    await page
      .getByRole('spinbutton', { name: 'Northbound lanes' })
      .fill('3')

    const body = await generatedRequestBody(page)
    expect(body.splitReviewThresholdPercent).toBe(1)
    expect(body.shoulderReviewThresholdPercent).toBe(100)
    expect(body.directionLaneCounts).toMatchObject({ Northbound: 3 })
  })

  test('a lower AM exit threshold extends the AM plan', async ({ page }) => {
    const base = `?locations=${scenarios.commute}&dates=${knownDates.monday}&dataSource=Aggregated`
    const defaultResult = await generateResult(page, base)
    const lowerExitResult = await generateResult(page, `${base}&amExitPctOfPeak=0.2`)

    expect(minutes(plan(lowerExitResult, '1').end)).toBeGreaterThan(
      minutes(plan(defaultResult, '1').end)
    )
  })

  test('a lower PM exit threshold extends the PM plan', async ({ page }) => {
    const base = `?locations=${scenarios.commute}&dates=${knownDates.monday}&dataSource=Aggregated`
    const defaultResult = await generateResult(page, base)
    const lowerExitResult = await generateResult(page, `${base}&pmExitPctOfPeak=0.2`)

    expect(minutes(plan(lowerExitResult, '13').end)).toBeGreaterThan(
      minutes(plan(defaultResult, '13').end)
    )
  })

  test('hard-caps AM and PM plan end times', async ({ page }) => {
    const body = await generateResult(
      page,
      `?locations=${scenarios.commute}&dates=${knownDates.monday}&dataSource=Aggregated&maxAmEndTime=07:30&maxPmEndTime=16:30`
    )

    expect(minutes(plan(body, '1').end)).toBe(7 * 60 + 30)
    expect(minutes(plan(body, '13').end)).toBe(16 * 60 + 30)
  })

  test('uses the configured FREE fallback when evening volume stays high', async ({
    page,
  }) => {
    const body = await generateResult(
      page,
      `?locations=${scenarios.freeFallback}&dates=${knownDates.monday}&dataSource=Aggregated&freeFallbackTime=23:30`
    )
    const freePlans = body.recommendation.recommendedSchedule.filter(
      (candidate: { planNumber: string }) => candidate.planNumber === '254'
    )

    expect(minutes(freePlans.at(-1).start)).toBe(23 * 60 + 30)
  })

  test('recalculates occupancy when per-lane capacity changes', async ({
    page,
  }) => {
    const base = `?locations=${scenarios.commute}&dates=${knownDates.monday}&dataSource=Aggregated`
    const defaultResult = await generateResult(page, base)
    const lowerCapacity = await generateResult(page, `${base}&laneCapacity=400`)
    const defaultOccupancy = defaultResult.locations[0].summary.peakOccupancyPercent
    const changedOccupancy = lowerCapacity.locations[0].summary.peakOccupancyPercent

    expect(changedOccupancy).toBeCloseTo(defaultOccupancy * 2, 1)
  })

  test('moves split-pressure review text across configured thresholds', async ({
    page,
  }) => {
    const base = `?locations=${scenarios.splitPressure}&dates=${knownDates.monday}&dataSource=Aggregated&amPrimaryDirections=Northbound&pmPrimaryDirections=Northbound`
    const dominant = await generateResult(page, base)
    const splitReview = await generateResult(
      page,
      `${base}&splitReviewThresholdPercent=20&shoulderReviewThresholdPercent=40`
    )
    const shoulderReview = await generateResult(
      page,
      `${base}&splitReviewThresholdPercent=20&shoulderReviewThresholdPercent=30`
    )

    expect(dominant.splitPressure.reviewText).toContain(
      'primary street remains dominant'
    )
    expect(splitReview.splitPressure.reviewText).toContain(
      'review split allocation'
    )
    expect(shoulderReview.splitPressure.reviewText).toContain(
      'review shoulder timing'
    )
  })

  test('uses a direction lane override for occupancy capacity', async ({ page }) => {
    const base = `?locations=${scenarios.commute}&dates=${knownDates.monday}&dataSource=Aggregated`
    const detected = await generateResult(page, base)
    const overridden = await generateResult(
      page,
      `${base}&laneCounts=Northbound:2`
    )

    expect(overridden.locations[0].summary.peakOccupancyPercent).toBeCloseTo(
      detected.locations[0].summary.peakOccupancyPercent * (2 / 3),
      1
    )
  })
})
