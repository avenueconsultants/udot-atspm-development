// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - utils.test.ts
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
import { applyPrintMode } from './utils'

const buildOption = () => ({
  toolbox: { show: true },
  dataZoom: [{ type: 'slider' }],
  animation: true,
  series: [
    { name: 'A', animation: true, emphasis: { animation: true } },
    { name: 'B', animation: true },
  ],
})

describe('applyPrintMode', () => {
  it('removes toolbox, dataZoom, and disables animation by default', () => {
    const result = applyPrintMode(buildOption())

    expect(result.toolbox).toBeUndefined()
    expect(result.dataZoom).toBeUndefined()
    expect(result.animation).toBe(false)
    expect(result.series[0].animation).toBe(false)
    expect(result.series[0].emphasis?.animation).toBe(false)
    expect(result.series[1].animation).toBe(false)
  })

  it('returns the option unchanged when print is false', () => {
    const option = buildOption()
    const result = applyPrintMode(option, false)

    expect(result).toBe(option)
  })

  it('supports a single (non-array) series', () => {
    const option = {
      animation: true,
      series: { name: 'Solo', animation: true },
    }

    const result = applyPrintMode(option, { disableAnimation: true })

    expect(result.series.animation).toBe(false)
  })

  it('honors granular tweak flags to keep toolbox or dataZoom', () => {
    const result = applyPrintMode(buildOption(), {
      removeToolbox: false,
      removeDataZoom: false,
      disableAnimation: false,
    })

    expect(result.toolbox).toEqual({ show: true })
    expect(result.dataZoom).toEqual([{ type: 'slider' }])
    expect(result.animation).toBe(true)
  })

  it('runs a final mutate callback on the cloned option', () => {
    const result = applyPrintMode(buildOption(), {
      mutate: (opt) => {
        opt.title = 'Print Title'
      },
    })

    expect((result as { title?: string }).title).toBe('Print Title')
  })

  it('deep-clones the option instead of mutating the original', () => {
    const option = buildOption()
    applyPrintMode(option)

    expect(option.toolbox).toEqual({ show: true })
    expect(option.animation).toBe(true)
  })
})
