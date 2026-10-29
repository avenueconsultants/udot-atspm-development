import { expect, test } from '@playwright/test'
import { PerformanceMeasuresPage } from '../../page-objects/PerformanceMeasuresPage'

const turningEndpoint = '/api/v1/TurningMovementCounts/GetReportData'

test.describe('Turning movement and pedestrian measures', () => {
  test('turning counts preserve three movements and the independent hourly total', async ({ page }) => {
    const measures = new PerformanceMeasuresPage(page)
    await measures.goto('TurningMovementCounts')
    const { body } = await measures.generate(turningEndpoint)
    expect(body.charts).toHaveLength(3)
    expect(body.charts.map((chart: { totalVolume: number }) => chart.totalVolume)).toEqual([120, 120, 120])
    expect(body.peakHour.value).toBe(360)
    expect(body.peakHourFactor).toBeCloseTo(1, 5)
    expect(body.table).toHaveLength(3)
    expect(body.table.reduce((sum: number, row: { volumes: Array<{ value: number }> }) => sum + row.volumes.reduce((subtotal, point) => subtotal + point.value, 0), 0)).toBe(360)
    await measures.expectChart()
    await expect(page.getByRole('button', { name: 'Download CSV', exact: true })).toBeVisible()
  })

  test('five-minute and fifteen-minute bins preserve total counts and peak-hour factor', async ({ page }) => {
    const measures = new PerformanceMeasuresPage(page)
    await measures.goto('TurningMovementCounts')
    const first = await measures.generate(turningEndpoint)
    await page.getByRole('combobox', { name: 'Bin Size' }).click()
    await page.getByRole('option', { name: '5', exact: true }).click()
    const second = await measures.generate(turningEndpoint)
    expect(Number(second.request.binSize)).toBe(5)
    expect(second.body.peakHour.value).toBe(360)
    expect(second.body.peakHourFactor).toBe(first.body.peakHourFactor)
    expect(second.body.charts.map((chart: { totalVolume: number }) => chart.totalVolume)).toEqual(first.body.charts.map((chart: { totalVolume: number }) => chart.totalVolume))
  })

  test('downloads actual CSV results containing the known volume', async ({ page }) => {
    const measures = new PerformanceMeasuresPage(page)
    await measures.goto('TurningMovementCounts')
    await measures.generate(turningEndpoint)
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Download CSV', exact: true }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/\.csv$/)
    expect(await download.failure()).toBeNull()
    const stream = await download.createReadStream()
    expect(stream).not.toBeNull()
    const chunks: Buffer[] = []
    for await (const chunk of stream!) chunks.push(Buffer.from(chunk))
    const csv = Buffer.concat(chunks).toString('utf8')
    expect(csv).toContain('120')
    expect(csv).toContain('2026')
  })

  test('pedestrian delay reflects sixty calls five seconds before walk', async ({ page }) => {
    const measures = new PerformanceMeasuresPage(page)
    await measures.goto('PedestrianDelay')
    await page.getByLabel('Time Buffer', { exact: true }).fill('0')
    const { request, body } = await measures.generate('/api/v1/PedDelay/GetReportData')
    expect(Number(request.timeBuffer)).toBe(0)
    expect(body).toHaveLength(2)
    for (const phase of body) {
      expect(phase.pedPresses).toBe(60)
      expect(phase.cyclesWithPedRequests).toBe(60)
      expect(phase.averageDelay).toBeCloseTo(5, 2)
      expect(phase.pedestrianDelay).toHaveLength(60)
    }
    await measures.expectChart()
  })

  test('pedestrian options are submitted independently of turning counts', async ({ page }) => {
    const measures = new PerformanceMeasuresPage(page)
    await measures.goto('PedestrianDelay')
    await page.getByLabel('Ped Recall Threshold', { exact: true }).fill('95')
    await page.getByLabel('Time Buffer', { exact: true }).fill('1')
    const { request, body } = await measures.generate('/api/v1/PedDelay/GetReportData')
    expect(Number(request.pedRecallThreshold)).toBe(95)
    expect(Number(request.timeBuffer)).toBe(1)
    expect(body.map((phase: { phaseNumber: number }) => phase.phaseNumber)).toEqual(expect.arrayContaining([2, 6]))
    await measures.expectChart()
  })
})
