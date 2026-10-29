import { expect, test } from '@playwright/test'
import { featureData } from '../../fixtures/featureData'
import { api } from '../../helpers/stack'
import { PerformanceMeasuresPage } from '../../page-objects/PerformanceMeasuresPage'

test.describe('Aggregate charts', () => {
  test('requires a selected location before analysis', async ({ page }) => {
    await page.goto('/aggregate-charts')
    await expect(
      page.getByRole('button', { name: 'Run Analysis', exact: true })
    ).toBeDisabled()
    await expect(
      page.getByRole('radio', { name: 'Sum', exact: true })
    ).toBeChecked()
  })

  test('expands the seeded route into selected locations', async ({ page }) => {
    await page.goto('/aggregate-charts')
    await page
      .locator('#route-select')
      .locator('..')
      .getByRole('combobox')
      .click()
    await page
      .getByRole('option', { name: featureData.route, exact: true })
      .click()
    await expect(
      page.getByRole('button', { name: 'Run Analysis', exact: true })
    ).toBeEnabled()
    await expect(
      page.getByRole('table', { name: 'collapsible table' })
    ).toContainText(featureData.location)
    await expect(
      page.getByRole('table', { name: 'collapsible table' })
    ).toContainText(featureData.downstream)
  })

  test('aggregates known detector counts through the actual report endpoint', async ({
    page,
  }) => {
    await page.clock.setFixedTime(new Date(2026, 0, 5, 12))
    await page.goto('/aggregate-charts')
    await page
      .locator('#route-select')
      .locator('..')
      .getByRole('combobox')
      .click()
    await page
      .getByRole('option', { name: featureData.route, exact: true })
      .click()
    await expect(
      page.getByRole('button', { name: 'Run Analysis', exact: true })
    ).toBeEnabled()
    const responsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        new URL(response.url()).pathname
          .toLowerCase()
          .endsWith('/api/v1/aggregation/getreportdata')
    )
    await page
      .getByRole('button', { name: 'Run Analysis', exact: true })
      .click()
    const response = await responsePromise
    expect(response.status(), await response.text()).toBe(200)
    const request = response.request().postDataJSON()
    expect(request.locationIdentifiers).toEqual(
      expect.arrayContaining([featureData.location, featureData.downstream])
    )
    expect(Number(request.aggregationType)).toBe(0)
    expect(Number(request.selectedAggregationType)).toBe(0)
    const body = await response.json()
    expect(body.length).toBeGreaterThan(0)
    const sum = body.reduce(
      (
        total: number,
        chart: { series: Array<{ dataPoints: Array<{ value: number }> }> }
      ) =>
        total +
        chart.series.reduce(
          (subtotal, series) =>
            subtotal +
            series.dataPoints.reduce((value, point) => value + point.value, 0),
          0
        ),
      0
    )
    expect(sum).toBe(720) // Two locations, three detectors, 120 counts per detector.
    await expect(page.locator('[id^="chart-"]').first()).toBeVisible()
  })

  test('edits aggregation mode and bin size without submitting automatically', async ({
    page,
  }) => {
    const requests: string[] = []
    page.on('request', (request) => {
      if (
        request.method() === 'POST' &&
        request.url().includes('/Aggregation/')
      )
        requests.push(request.url())
    })
    await page.goto('/aggregate-charts')
    await page.getByRole('radio', { name: 'Average', exact: true }).check()
    const bin = page.getByRole('slider', { name: 'Bin Size', exact: true })
    await bin.focus()
    await bin.press('ArrowRight')
    await expect(
      page.getByRole('radio', { name: 'Average', exact: true })
    ).toBeChecked()
    await expect(bin).toHaveAttribute('aria-valuenow', '2')
    expect(requests).toEqual([])
  })
})

test.describe('Specialized signal measures', () => {
  test('Priority Summary counts the two seeded requests and their distinct treatments', async ({
    page,
  }) => {
    const measures = new PerformanceMeasuresPage(page)
    await measures.goto('PrioritySummary')
    const { body } = await measures.generate(
      '/api/v1/PrioritySummary/GetReportData'
    )
    expect(body).toMatchObject({
      numberCheckins: 2,
      numberCheckouts: 2,
      numberEarlyGreens: 1,
      numberExtendedGreens: 1,
    })
    expect(body.cycles).toHaveLength(2)
    expect(body.averageDuration).toBe('00:00:20')
    await measures.expectChart()
  })

  test('Preemption Details reports the single seeded request and service', async ({
    page,
  }) => {
    const measures = new PerformanceMeasuresPage(page)
    await measures.goto('PreemptionDetails')
    const { body } = await measures.generate(
      '/api/v1/PreemptDetail/GetReportData'
    )
    expect(body.details).toHaveLength(1)
    expect(body.details[0].preemptionNumber).toBe(1)
    expect(body.details[0].cycles).toHaveLength(1)
    expect(body.summary.requestAndServices[0].requests).toHaveLength(1)
    expect(body.summary.requestAndServices[0].services).toHaveLength(1)
    await measures.expectChart()
  })

  test('Ramp Metering maps flow, encoded occupancy, and speed units', async ({
    page,
  }) => {
    const { root, headers } = await api(page, 'REPORTS_URL')
    const response = await page.request.post(
      `${root}/api/v1/RampMetering/GetReportData`,
      {
        headers,
        data: {
          locationIdentifier: featureData.location,
          start: featureData.start,
          end: featureData.end,
          combineLanes: false,
        },
      }
    )
    expect(response.status(), await response.text()).toBe(200)
    const body = await response.json()
    expect(body.mainlineAvgFlow).toHaveLength(1)
    expect(body.mainlineAvgFlow[0].value).toBe(1700)
    expect(body.mainlineAvgOcc[0].value).toBe(11)
    expect(body.mainlineAvgSpeed[0].value).toBeCloseTo(116 * 0.621371, 6)
  })
})

test.describe('Speed management navigation', () => {
  test('changes the data source and marks the request pending until Update', async ({
    page,
  }) => {
    await page.goto('/speed-management-tool')
    await page.getByRole('button', { name: 'PeMS', exact: true }).click()
    const source = page
      .locator('#data-source-options-popover')
      .getByRole('button', { name: 'ATSPM', exact: true })
    await source.click()
    await expect(source).toHaveAttribute('aria-pressed', 'true')
    await page.keyboard.press('Escape')
    await expect(
      page.getByRole('button', { name: 'ATSPM', exact: true })
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Update', exact: true })
    ).toBeEnabled()
  })

  test('edits day classification and analysis period independently', async ({
    page,
  }) => {
    await page.goto('/speed-management-tool')
    await page.getByRole('button', { name: 'Weekdays', exact: true }).click()
    await page.getByRole('radio', { name: 'Weekends', exact: true }).check()
    await page.keyboard.press('Escape')
    await expect(
      page.getByRole('button', { name: 'Weekends', exact: true })
    ).toBeVisible()
    await page.getByRole('button', { name: 'All Day', exact: true }).click()
    await page
      .getByRole('radio', { name: 'AM Peak (6 AM - 9 AM)', exact: true })
      .check()
    await page.keyboard.press('Escape')
    await expect(
      page.getByRole('button', { name: 'AM Peak (6 AM - 9 AM)', exact: true })
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Weekends', exact: true })
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Update', exact: true })
    ).toBeEnabled()
  })

  test('opens Map and Reports without requiring a selected segment', async ({
    page,
  }) => {
    await page.goto('/speed-management-tool')
    const tabs = page.getByRole('tablist', { name: 'Speed Management options' })
    await expect(
      tabs.getByRole('tab', { name: 'Map', exact: true })
    ).toHaveAttribute('aria-selected', 'true')
    await tabs.getByRole('tab', { name: 'Reports', exact: true }).click()
    await expect(
      tabs.getByRole('tab', { name: 'Reports', exact: true })
    ).toHaveAttribute('aria-selected', 'true')
    await tabs.getByRole('tab', { name: 'Map', exact: true }).click()
    await expect(
      tabs.getByRole('tab', { name: 'Map', exact: true })
    ).toHaveAttribute('aria-selected', 'true')
  })
})
