// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - lpPcdTransformer.test.ts
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//http://www.apache.org/licenses/LICENSE-2.
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
// #endregion
import { ToolType } from '@/features/charts/common/types'
import type { EChartsOption } from 'echarts'
import type { RawLpPcdData } from '../types'
import transformlpPcdData from './lpPcdTransformer'

const transformPcdData = jest.fn()

jest.mock(
  '@/features/charts/purdueCoordinationDiagram/purdueCoordinationDiagram.transformer',
  () => ({
    __esModule: true,
    transformPcdData: (...args: unknown[]) => transformPcdData(...args),
  })
)

// transformPcdData is exercised by its own transformer tests; here it's
// stubbed so these tests isolate transformlpPcdData's own logic: how it
// assembles the chart list and treats the first chart differently from the
// rest.
const buildStubbedPcdChart = (): EChartsOption => ({
  xAxis: { type: 'time' },
  grid: { show: true },
})

const buildData = (): RawLpPcdData =>
  ({
    totalAog: 42,
    totalPAog: 87,
    volume: 100,
    pcd: [
      {
        percentArrivalOnGreen: 90,
        start: '2026-04-01T08:00:00',
        end: '2026-04-01T09:00:00',
        phaseDescription: 'Phase 2',
      },
      {
        percentArrivalOnGreen: 75,
        start: '2026-04-01T08:00:00',
        end: '2026-04-01T09:00:00',
        phaseDescription: 'Phase 6',
      },
    ],
  }) as unknown as RawLpPcdData

describe('transformlpPcdData', () => {
  beforeEach(() => {
    transformPcdData.mockReset()
    transformPcdData.mockImplementation(() => buildStubbedPcdChart())
  })

  it('wraps one chart per pcd entry under a LpPcd tool response', () => {
    const result = transformlpPcdData(buildData(), 'Time of Day')

    expect(result.type).toBe(ToolType.LpPcd)
    expect(result.data.charts).toHaveLength(2)
  })

  it('calls transformPcdData with a wider plan width for entries after the first', () => {
    transformlpPcdData(buildData(), 'Time of Day')

    expect(transformPcdData).toHaveBeenNthCalledWith(1, expect.anything(), 120)
    expect(transformPcdData).toHaveBeenNthCalledWith(2, expect.anything(), 80)
  })

  it('gives only the first chart a full title, location, and legend', () => {
    const result = transformlpPcdData(buildData(), 'Time of Day')
    type ChartWithTitleAndLegend = EChartsOption & {
      legend?: { data?: unknown[] }
    }

    const first = result.data.charts[0].chart as ChartWithTitleAndLegend
    const second = result.data.charts[1].chart as ChartWithTitleAndLegend

    expect(first.title).toBeDefined()
    expect(second.title).toBeDefined()
    expect(second.legend).toEqual({ data: [] })
    expect(first.legend).not.toEqual({ data: [] })
  })

  it('adds an inside zoom to every chart but only the first two dataZoom entries otherwise', () => {
    const result = transformlpPcdData(buildData(), 'Time of Day')

    for (const { chart } of result.data.charts) {
      const dataZoom = (chart as EChartsOption).dataZoom
      expect(Array.isArray(dataZoom)).toBe(true)
      expect((dataZoom as unknown[])[0]).toMatchObject({ type: 'inside' })
      expect(dataZoom).toHaveLength(2)
    }
  })

  it('gives non-first charts extra bottom grid space for their slider', () => {
    const result = transformlpPcdData(buildData(), 'Time of Day')

    const firstGrid = result.data.charts[0].chart.grid as { bottom?: number }
    const secondGrid = result.data.charts[1].chart.grid as { bottom?: number }

    expect(secondGrid.bottom).toBe(150)
    expect(firstGrid.bottom).toBe(100)
  })
})
