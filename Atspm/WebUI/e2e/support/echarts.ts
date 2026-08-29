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

// Charts are canvases, so a spec that has to click a plotted mark needs the
// chart's own scene graph. The app does not expose its echarts instances,
// and reaching for the bundled echarts module through webpack only works
// in development - the production bundle keeps no module cache. What both
// builds do carry is React's fiber on the chart's DOM node, so this walks
// up the tree to the component that holds the instance in a ref. It only
// reads, and executes nothing.
//
// The mark is located by walking zrender's display list for the element
// that series drew for that data index, and clicked at the centre of the
// rectangle it actually rendered. Deriving the point from the axes instead
// (convertToPixel) is wrong on these charts: several carry more than one
// y-axis, and the bars are laid out with a barGap offset from the axis
// position, so the computed point lands outside the bar.

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
  const target = await page.evaluate(
    ({ containerSelector, point }) => {
      type Instance = {
        getOption: () => { series?: { name?: string }[] }
        getZr: () => { storage: { getDisplayList: () => unknown[] } }
        getDom: () => HTMLElement
      }
      type Element = {
        __dataIndex?: number
        shape?: { x: number; y: number; width: number; height: number }
        parent?: { __ecComponentInfo?: { mainType?: string; index?: number } }
      }
      type Fiber = {
        return?: Fiber | null
        memoizedState?: { memoizedState?: unknown; next?: unknown } | null
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
          hook = hook.next as typeof hook
        }
        fiber = fiber.return ?? undefined
      }
      if (!instance) {
        throw new Error(`no echarts instance above ${containerSelector}`)
      }

      const series = instance.getOption().series ?? []
      const seriesIndex = series.findIndex((s) => s.name === point.seriesName)
      if (seriesIndex < 0) {
        throw new Error(
          `no series "${point.seriesName}" (have ${series
            .map((s) => s.name)
            .join(', ')})`
        )
      }

      // Every element a series draws sits in a group tagged with that
      // series' index, and carries the data index it stands for.
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

      // The click below is dispatched in viewport coordinates, so the chart
      // has to be on screen before its position is measured - these charts
      // sit well below the fold once the option panel is above them.
      const chart = instance.getDom()
      chart.scrollIntoView({ block: 'center' })

      // Bars are drawn upwards from the axis, so the height is negative;
      // halving it lands in the middle of the bar either way.
      const { x, y, width, height } = mark.shape
      const rect = chart.getBoundingClientRect()
      return { x: rect.left + x + width / 2, y: rect.top + y + height / 2 }
    },
    { containerSelector, point }
  )

  await page.mouse.click(target.x, target.y)
}
