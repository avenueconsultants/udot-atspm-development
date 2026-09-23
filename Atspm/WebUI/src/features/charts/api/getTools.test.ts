// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - getTools.test.ts
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
import { ToolOptions, ToolType } from '@/features/charts/common/types'

// Only the two report-data fetchers this dispatcher calls are stubbed, so
// which branch ran is observable and no request escapes to MSW.
jest.mock('@/api/reports', () => ({
  getTimeSpaceDiagramReportData: jest.fn(),
  getTimeSpaceDiagramAverageReportData: jest.fn(),
}))

import {
  getTimeSpaceDiagramAverageReportData,
  getTimeSpaceDiagramReportData,
} from '@/api/reports'
import { getTools, mapStringBooleansToBoolean } from './getTools'

const historicFetcher = getTimeSpaceDiagramReportData as jest.Mock
const averageFetcher = getTimeSpaceDiagramAverageReportData as jest.Mock

const baseOptions = (): ToolOptions =>
  ({
    routeId: '42',
    start: new Date(2026, 3, 1, 8, 0, 0),
    end: new Date(2026, 3, 1, 9, 30, 0),
  }) as unknown as ToolOptions

const sentTo = (fetcher: jest.Mock) => fetcher.mock.calls[0][0]

describe('mapStringBooleansToBoolean', () => {
  it('converts "true"/"false" strings to booleans regardless of case', () => {
    expect(
      mapStringBooleansToBoolean({
        a: 'true',
        b: 'FALSE',
        c: 'True',
        d: 'fAlSe',
      } as unknown as ToolOptions)
    ).toEqual({ a: true, b: false, c: true, d: false })
  })

  it('leaves strings that only look boolean-ish untouched', () => {
    expect(
      mapStringBooleansToBoolean({
        a: '15',
        b: 'truenorth',
        c: ' true ',
      } as unknown as ToolOptions)
    ).toEqual({ a: '15', b: 'truenorth', c: ' true ' })
  })

  it('passes non-string values through unchanged', () => {
    const date = new Date(2026, 3, 1)
    expect(
      mapStringBooleansToBoolean({
        a: 15,
        b: false,
        c: date,
      } as unknown as ToolOptions)
    ).toEqual({ a: 15, b: false, c: date })
  })
})

describe('getTools dispatch', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    historicFetcher.mockResolvedValue([])
    averageFetcher.mockResolvedValue([])
  })

  it('routes TimeSpaceHistoric to the historic fetcher only', async () => {
    const result = await getTools(ToolType.TimeSpaceHistoric, baseOptions())

    expect(historicFetcher).toHaveBeenCalledTimes(1)
    expect(averageFetcher).not.toHaveBeenCalled()
    expect(result.type).toBe(ToolType.TimeSpaceHistoric)
  })

  it('routes TimeSpaceAverage to the average fetcher only', async () => {
    const result = await getTools(ToolType.TimeSpaceAverage, baseOptions())

    expect(averageFetcher).toHaveBeenCalledTimes(1)
    expect(historicFetcher).not.toHaveBeenCalled()
    expect(result.type).toBe(ToolType.TimeSpaceAverage)
  })
})

describe('getTools routeId coercion', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    historicFetcher.mockResolvedValue([])
  })

  it('sends a numeric routeId when one was selected', async () => {
    await getTools(ToolType.TimeSpaceHistoric, baseOptions())

    expect(sentTo(historicFetcher).routeId).toBe(42)
  })

  // An unselected route arrives as an empty string from the query params;
  // sending Number('') === 0 would silently request route zero.
  it('omits routeId when no route is selected', async () => {
    await getTools(ToolType.TimeSpaceHistoric, {
      ...baseOptions(),
      routeId: '',
    } as unknown as ToolOptions)

    expect(sentTo(historicFetcher).routeId).toBeUndefined()
  })

  it('omits routeId when it is already absent', async () => {
    const options = baseOptions() as unknown as Record<string, unknown>
    delete options.routeId

    await getTools(
      ToolType.TimeSpaceHistoric,
      options as unknown as ToolOptions
    )

    expect(sentTo(historicFetcher).routeId).toBeUndefined()
  })
})

describe('getTools option serialization', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    historicFetcher.mockResolvedValue([])
    averageFetcher.mockResolvedValue([])
  })

  it('serializes start/end as wall-clock literals for the historic tool', async () => {
    await getTools(ToolType.TimeSpaceHistoric, baseOptions())

    expect(sentTo(historicFetcher).start).toBe('2026-04-01T08:00:00')
    expect(sentTo(historicFetcher).end).toBe('2026-04-01T09:30:00')
  })

  // Documents a real asymmetry rather than endorsing it: only the historic
  // branch runs start/end through dateToTimestamp, so the average branch
  // hands the raw Date straight to the generated fetcher. If the average
  // report ever starts mis-reading its window across a timezone boundary,
  // this is the line to look at.
  it('leaves start/end as Date objects for the average tool', async () => {
    await getTools(ToolType.TimeSpaceAverage, baseOptions())

    expect(sentTo(averageFetcher).start).toBeInstanceOf(Date)
    expect(sentTo(averageFetcher).end).toBeInstanceOf(Date)
  })
})

describe('getTools result normalization', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('defaults a missing error and isSuccess on each result row', async () => {
    historicFetcher.mockResolvedValue([{}])

    const result = await getTools(ToolType.TimeSpaceHistoric, baseOptions())

    expect(result.data).toEqual([
      { error: null, result: null, isSuccess: false },
    ])
  })

  it('keeps a reported failure intact', async () => {
    historicFetcher.mockResolvedValue([
      { error: 'No data for the selected window', isSuccess: false },
    ])

    const result = await getTools(ToolType.TimeSpaceHistoric, baseOptions())

    expect(result.data[0].error).toBe('No data for the selected window')
    expect(result.data[0].result).toBeNull()
  })

  it('normalizes an empty result set to an empty data array', async () => {
    averageFetcher.mockResolvedValue([])

    const result = await getTools(ToolType.TimeSpaceAverage, baseOptions())

    expect(result.data).toEqual([])
  })

  it('normalizes a null result on an otherwise successful row', async () => {
    averageFetcher.mockResolvedValue([{ isSuccess: true, result: null }])

    const result = await getTools(ToolType.TimeSpaceAverage, baseOptions())

    expect(result.data).toEqual([
      { error: null, result: null, isSuccess: true },
    ])
  })
})
