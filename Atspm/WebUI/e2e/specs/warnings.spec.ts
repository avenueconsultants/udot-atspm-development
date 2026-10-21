import { expect, test, type Page, type Request } from '@playwright/test'
import { knownDates, scenarios } from '../fixtures/seedData'
import { TimeOfDayPage } from '../page-objects/TimeOfDayPage'

type Warning = { code?: string; locationIdentifier?: string }
type LocationResult = {
  locationIdentifier?: string
  dataQualityFlag?: string
  summary?: { peakRawVolume?: number | null }
}
type ReportResult = {
  warnings?: Warning[]
  locations?: LocationResult[]
}

const generate = async (page: Page, query: string) => {
  const tod = new TimeOfDayPage(page)
  await tod.goto(query)
  const requestPromise = page.waitForRequest(
    (request) =>
      request.url().includes('/api/v1/TimeOfDay') &&
      request.method() === 'POST'
  )
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/TimeOfDay') &&
      response.request().method() === 'POST'
  )
  await tod.generate()
  const [request, response] = await Promise.all([
    requestPromise,
    responsePromise,
  ])
  expect(response.status()).toBe(200)
  return {
    request,
    body: (await response.json()) as ReportResult,
  }
}

const warningCodes = (body: ReportResult) =>
  body.warnings?.map((warning) => warning.code) ?? []

const replayWithDuplicateDate = async (page: Page, request: Request) => {
  const payload = request.postDataJSON() as { selectedDates: string[] }
  const headers = await request.allHeaders()
  delete headers['content-length']
  const response = await page.request.post(request.url(), {
    data: {
      ...payload,
      selectedDates: [knownDates.monday, knownDates.monday],
    },
    headers,
  })
  expect(response.status()).toBe(200)
  return (await response.json()) as ReportResult
}

test.describe('Time-of-day warnings', () => {
  test('reports duplicate dates while calculating the date only once', async ({
    page,
  }) => {
    const single = await generate(
      page,
      `?locations=${scenarios.commute}&dates=${knownDates.monday}&dataSource=Aggregated`
    )
    const duplicate = await replayWithDuplicateDate(page, single.request)

    expect(warningCodes(duplicate)).toContain('DuplicateSelectedDates')
    expect(duplicate.locations?.[0]?.summary?.peakRawVolume).toBe(
      single.body.locations?.[0]?.summary?.peakRawVolume
    )
  })

  test('reports unavailable corridor-wide primary direction data', async ({
    page,
  }) => {
    const { body } = await generate(
      page,
      `?locations=${scenarios.commute}&dates=${knownDates.monday}&dataSource=Aggregated&amPrimaryDirections=Eastbound&pmPrimaryDirections=Eastbound`
    )

    expect(warningCodes(body)).toContain('PrimaryDirectionDataUnavailable')
  })

  test('reports missing plan data for a location with no controller plan events', async ({
    page,
  }) => {
    const { body } = await generate(
      page,
      `?locations=${scenarios.multiLocationMedian[2]}&dates=${knownDates.monday}&dataSource=Aggregated`
    )

    expect(warningCodes(body)).toContain('MissingPlanData')
  })

  test('reports partial location data and its Partial quality flag', async ({
    page,
  }) => {
    const { body } = await generate(
      page,
      `?locations=${scenarios.commute}&dates=${knownDates.monday},${knownDates.tuesday}&dataSource=Aggregated`
    )

    expect(warningCodes(body)).toContain('PartialLocationData')
    expect(body.locations?.[0]?.dataQualityFlag).toBe('Partial')
  })

  test('reports a missing historical location configuration', async ({ page }) => {
    const { body } = await generate(
      page,
      `?locations=${scenarios.commute}&dates=2019-01-01&dataSource=Aggregated`
    )

    expect(warningCodes(body)).toContain('MissingLocationConfiguration')
  })

  test('reports partial plan data when the first plan begins after midnight', async ({
    page,
  }) => {
    const { body } = await generate(
      page,
      `?locations=${scenarios.partialPlan}&dates=${knownDates.monday}&dataSource=Aggregated`
    )

    expect(warningCodes(body)).toContain('PartialPlanData')
  })

  test('reports no vehicle detectors for Aggregated when only a bike detector exists', async ({
    page,
  }) => {
    const { body } = await generate(
      page,
      `?locations=${scenarios.noVehicleDetectors}&dates=${knownDates.monday}&dataSource=Aggregated`
    )

    expect(warningCodes(body)).toContain('NoVehicleDetectors')
    expect(warningCodes(body)).not.toContain('NoTurningMovementDetectors')
  })

  test('reports no turning-movement detectors for Indiana when metric type 5 is unsupported', async ({
    page,
  }) => {
    const { body } = await generate(
      page,
      `?locations=${scenarios.noTurningMovementDetectors}&dates=${knownDates.monday}&dataSource=IndianaEvents`
    )

    expect(warningCodes(body)).toContain('NoTurningMovementDetectors')
    expect(warningCodes(body)).not.toContain('NoVehicleDetectors')
  })
})
