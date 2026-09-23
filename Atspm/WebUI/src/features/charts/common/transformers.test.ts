// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - transformers.test.ts
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
import {
  createDataZoom,
  formatExportFileName,
  toDataPoints,
} from './transformers'

describe('toDataPoints', () => {
  it('normalizes missing collections and values', () => {
    expect(toDataPoints(undefined)).toEqual([])
    expect(
      toDataPoints([
        { timestamp: '2026-08-24T12:00:00Z', value: 3.5 },
        { timestamp: null, value: null },
      ])
    ).toEqual([
      { timestamp: '2026-08-24T12:00:00Z', value: 3.5 },
      { timestamp: '', value: 0 },
    ])
  })
})

describe('createDataZoom', () => {
  it('disables data shadows for horizontal sliders by default', () => {
    const dataZoom = createDataZoom()
    const horizontalSlider = dataZoom.find(
      (zoom) =>
        zoom.type === 'slider' && (zoom.orient ?? 'horizontal') === 'horizontal'
    )

    expect(horizontalSlider).toMatchObject({
      xAxisIndex: 0,
      bottom: 15,
      height: 30,
      showDataShadow: false,
    })
  })

  it('keeps horizontal slider defaults when a vertical slider is added', () => {
    const dataZoom = createDataZoom([
      {
        type: 'slider',
        orient: 'vertical',
        right: 220,
      },
    ])

    expect(dataZoom[0]).toMatchObject({
      type: 'slider',
      xAxisIndex: 0,
      bottom: 15,
      height: 30,
      showDataShadow: false,
    })
    expect(dataZoom[2]).toMatchObject({
      type: 'slider',
      orient: 'vertical',
      right: 220,
    })
  })
})

describe('formatExportFileName', () => {
  it('builds a title and range slug from valid dates', () => {
    expect(
      formatExportFileName(
        'Left Turn Gap Analysis - 1001 Main St',
        '2026-04-01T08:00:00',
        '2026-04-01T09:30:00'
      )
    ).toBe(
      'Left_Turn_Gap_Analysis_1001_Main_St_2026-04-01_08-00_to_2026-04-01_09-30'
    )
  })

  // Callers pass `data.start ?? ''` because every field on the generated
  // report types is nullable. date-fns/format throws RangeError on an
  // unparseable value, and because this runs while building chart options
  // that took down the whole chart, not just its export filename.
  it.each([
    ['both dates missing', '', ''],
    ['start missing', '', '2026-04-01T09:30:00'],
    ['end missing', '2026-04-01T08:00:00', ''],
    ['unparseable dates', 'not-a-date', 'also-not-a-date'],
  ])('degrades to the bare title when %s', (_label, start, end) => {
    expect(() => formatExportFileName('Wait Time', start, end)).not.toThrow()
    expect(formatExportFileName('Wait Time', start, end)).toBe('Wait_Time')
  })
})
