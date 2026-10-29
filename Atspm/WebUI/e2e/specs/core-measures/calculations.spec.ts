import { expect, test } from '@playwright/test'
import { PerformanceMeasuresPage } from '../../page-objects/PerformanceMeasuresPage'

test.describe('Core performance measure calculations', () => {
  test('Purdue Coordination counts one green and one red arrival per cycle', async ({ page }) => {
    const measures = new PerformanceMeasuresPage(page)
    await measures.goto('PurdueCoordinationDiagram')
    const { body } = await measures.generate('/api/v1/PurdueCoordinationDiagram/GetReportData')
    expect(body).toHaveLength(2)
    for (const phase of body) {
      expect(phase.totalDetectorHits).toBe(120)
      expect(phase.totalOnGreenEvents).toBe(60)
      expect(phase.percentArrivalOnGreen).toBeCloseTo(50, 1)
      expect(phase.detectorEvents).toHaveLength(120)
    }
    await measures.expectChart()
  })

  test('Phase Termination preserves sixty gap outs for both phases', async ({ page }) => {
    const measures = new PerformanceMeasuresPage(page)
    await measures.goto('PurduePhaseTermination')
    await page.getByLabel('Selected Consecutive Count').fill('1')
    const { body } = await measures.generate('/api/v1/PurduePhaseTermination/GetReportData')
    expect(body.phases.map((phase: { phaseNumber: number }) => phase.phaseNumber)).toEqual(expect.arrayContaining([2, 6]))
    for (const phase of body.phases.filter((phase: { phaseNumber: number }) => [2, 6].includes(phase.phaseNumber))) {
      expect(phase.gapOuts).toHaveLength(60)
      expect(phase.maxOuts).toEqual([])
      expect(phase.forceOffs).toEqual([])
    }
    await measures.expectChart()
  })

  test('Split Failures reports no failure for brief detector occupancy', async ({ page }) => {
    const measures = new PerformanceMeasuresPage(page)
    await measures.goto('PurdueSplitFailure')
    await page.getByLabel('First Seconds of Red').fill('5')
    const { request, body } = await measures.generate('/api/v1/SplitFail/GetReportData')
    expect(Number(request.firstSecondsOfRed)).toBe(5)
    expect(body.length).toBeGreaterThan(0)
    for (const phase of body) {
      expect(phase.totalSplitFails).toBe(0)
      expect(phase.failLines).toEqual([])
      expect(phase.plans.reduce((sum: number, plan: { totalCycles: number }) => sum + plan.totalCycles, 0)).toBeGreaterThan(0)
    }
    await measures.expectChart()
  })

  test('Split Monitor distinguishes gap outs from max outs and force offs', async ({ page }) => {
    const measures = new PerformanceMeasuresPage(page)
    await measures.goto('SplitMonitor')
    const { body } = await measures.generate('/api/v1/SplitMonitor/GetReportData')
    expect(body.length).toBeGreaterThan(0)
    for (const phase of body.filter((phase: { phaseNumber: number }) => [2, 6].includes(phase.phaseNumber))) {
      expect(phase.gapOuts).toHaveLength(60)
      expect(phase.maxOuts).toEqual([])
      expect(phase.forceOffs).toEqual([])
    }
    await measures.expectChart()
  })

  test('Approach Volume preserves lane count totals and directional sums', async ({ page }) => {
    const measures = new PerformanceMeasuresPage(page)
    await measures.goto('ApproachVolume')
    const { body } = await measures.generate('/api/v1/ApproachVolume/GetReportData')
    expect(body.length).toBeGreaterThan(0)
    // AC maps to two through detectors (240); LLC includes the left detector (360).
    const totals = body.map((chart: { summaryData: { totalVolume: number } }) => chart.summaryData.totalVolume)
    expect(totals).toEqual(expect.arrayContaining([240, 360]))
    for (const chart of body) {
      expect(chart.summaryData.totalVolume).toBe(chart.summaryData.primaryTotalVolume + chart.summaryData.opposingTotalVolume)
    }
    await measures.expectChart()
  })

  test('changing coordination bin size preserves total detector hits', async ({ page }) => {
    const measures = new PerformanceMeasuresPage(page)
    await measures.goto('PurdueCoordinationDiagram')
    const first = await measures.generate('/api/v1/PurdueCoordinationDiagram/GetReportData')
    await page.getByRole('combobox', { name: 'Bin Size' }).click()
    await page.getByRole('option', { name: '5', exact: true }).click()
    const second = await measures.generate('/api/v1/PurdueCoordinationDiagram/GetReportData')
    expect(Number(second.request.binSize)).toBe(5)
    expect(second.body.map((phase: { totalDetectorHits: number }) => phase.totalDetectorHits)).toEqual(first.body.map((phase: { totalDetectorHits: number }) => phase.totalDetectorHits))
    await measures.expectChart()
  })
})
