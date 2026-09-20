// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - e2e/support/echarts.ts
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
import type { Page } from '@playwright/test'
import type { EChartsOption, EChartsType } from 'echarts'

// Charts are canvases, so specs inspect the actual chart instance to read
// rendered series or locate plotted marks. The app does not expose its
// echarts instances, and reaching for the bundled echarts module through
// webpack only works in development - the production bundle keeps no
// module cache. Both builds carry React's fiber on the chart's DOM node,
// so this walks up to the component that holds the instance in a ref.
const getChartInstance = (page: Page, containerSelector: string) =>
  page.evaluateHandle((containerSelector) => {
    type Instance = Pick<EChartsType, 'getOption' | 'getZr' | 'getDom'>
    type Hook = { memoizedState?: unknown; next?: Hook | null }
    type Fiber = {
      return?: Fiber | null
      memoizedState?: Hook | null
    }

    const isInstance = (value: unknown): value is Instance =>
      value != null &&
      typeof (value as Instance).getZr === 'function' &&
      typeof (value as Instance).getOption === 'function'

    const container = document.querySelector(containerSelector)
    const dom = (
      container?.matches('[_echarts_instance_]')
        ? container
        : container?.querySelector('[_echarts_instance_]')
    ) as HTMLElement | null | undefined
    if (!dom) throw new Error(`no chart under ${containerSelector}`)

    const fiberKey = Object.getOwnPropertyNames(dom).find((key) =>
      key.startsWith('__reactFiber$')
    )
    if (!fiberKey) throw new Error('no React fiber on the chart node')

    // The component that renders the chart keeps the echarts instance in
    // a ref, so it is one of the hooks on this node or an ancestor.
    let instance: Instance | undefined
    let fiber = (dom as unknown as Record<string, Fiber>)[fiberKey] as
      | Fiber
      | undefined
    while (fiber && !instance) {
      let hook = fiber.memoizedState
      while (hook && !instance) {
        const state = hook.memoizedState as { current?: unknown } | undefined
        if (state && isInstance(state.current)) instance = state.current
        hook = hook.next
      }
      fiber = fiber.return ?? undefined
    }
    if (!instance) {
      throw new Error(`no echarts instance above ${containerSelector}`)
    }

    return instance
  }, containerSelector)

/** Reads the actual chart's getOption() result after ECharts has applied it. */
export const readChartOption = async (
  page: Page,
  containerSelector: string
): Promise<EChartsOption> => {
  const instance = await getChartInstance(page, containerSelector)
  try {
    return await instance.evaluate(
      (chart) => chart.getOption() as EChartsOption
    )
  } finally {
    await instance.dispose()
  }
}

type EchartsPoint = { seriesName: string; dataIndex: number }

/**
 * Clicks the mark that `seriesName` drew for `dataIndex`, inside the chart
 * in `containerSelector`, with a real mouse click at its centre.
 */
export const clickSeriesPoint = async (
  page: Page,
  containerSelector: string,
  point: EchartsPoint
) => {
  const instance = await getChartInstance(page, containerSelector)
  try {
    const target = await instance.evaluate((instance, point) => {
      type Element = {
        __dataIndex?: number
        shape?: { x: number; y: number; width: number; height: number }
        parent?: { __ecComponentInfo?: { mainType?: string; index?: number } }
      }

      const option = instance.getOption() as EChartsOption
      const series = Array.isArray(option.series)
        ? option.series
        : option.series
          ? [option.series]
          : []
      const seriesIndex = series.findIndex((s) => s.name === point.seriesName)
      if (seriesIndex < 0) {
        throw new Error(
          `no series "${point.seriesName}" (have ${series
            .map((s) => s.name)
            .join(', ')})`
        )
      }

      // Locate the mark in zrender's display list rather than through axis
      // coordinates: multiple y-axes and barGap offsets can put an axis-
      // derived point outside the bar that was actually drawn.
      // Every element sits in a group tagged with its series' index and
      // carries the data index it stands for.
      const mark = (
        instance.getZr().storage.getDisplayList() as Element[]
      ).find(
        (element) =>
          element.__dataIndex === point.dataIndex &&
          element.shape != null &&
          element.parent?.__ecComponentInfo?.mainType === 'series' &&
          element.parent.__ecComponentInfo.index === seriesIndex
      )
      if (!mark?.shape) {
        throw new Error(
          `series "${point.seriesName}" drew nothing for index ${point.dataIndex}`
        )
      }

      // The click uses viewport coordinates, so scroll before measuring.
      // These charts sit below the fold when the option panel is above them.
      const chart = instance.getDom()
      chart.scrollIntoView({ block: 'center' })

      // Bars drawn upwards have negative heights; halving still finds
      // their centre.
      const { x, y, width, height } = mark.shape
      const rect = chart.getBoundingClientRect()
      return { x: rect.left + x + width / 2, y: rect.top + y + height / 2 }
    }, point)

    await page.mouse.click(target.x, target.y)
  } finally {
    await instance.dispose()
  }
}
