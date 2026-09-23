// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - useMissingDays.test.ts
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
import { renderHook, waitFor } from '@testing-library/react'
import { format } from 'date-fns'
import useMissingDays from './useMissingDays'

const getEventLogDays = jest.fn()
const getAggregationDays = jest.fn()

jest.mock('@/api/data', () => ({
  __esModule: true,
  getEventLogDaysWithDataFromLocationIdentifierAndDataType: (
    ...args: unknown[]
  ) => getEventLogDays(...args),
  getAggregationDaysWithDataFromLocationIdentifierAndDataType: (
    ...args: unknown[]
  ) => getAggregationDays(...args),
}))

jest.mock('date-fns', () => ({
  ...jest.requireActual('date-fns'),
  startOfToday: () => new Date(2026, 3, 15),
}))

const dateKeys = (days: Date[]) => days.map((d) => format(d, 'yyyy-MM-dd'))

describe('useMissingDays', () => {
  beforeEach(() => {
    getEventLogDays.mockReset()
    getAggregationDays.mockReset()
  })

  it('fetches from the raw event-log endpoint and returns days with no data', async () => {
    getEventLogDays.mockResolvedValue(['2026-04-11'])

    // Dates are hoisted to stable references: passing a fresh `new Date()`
    // inline would give the effect's dependency array a new identity on
    // every render, re-triggering the effect forever.
    const startDate = new Date(2026, 3, 10)
    const endDate = new Date(2026, 3, 13)
    const { result } = renderHook(() =>
      useMissingDays('1001', 'someDataType', 'raw', startDate, endDate)
    )

    await waitFor(() => expect(result.current).not.toEqual([]))

    expect(getEventLogDays).toHaveBeenCalledTimes(1)
    expect(getAggregationDays).not.toHaveBeenCalled()
    expect(dateKeys(result.current)).toEqual([
      '2026-04-10',
      '2026-04-12',
      '2026-04-13',
    ])
  })

  it('fetches from the aggregation endpoint when dataCategory is "aggregation"', async () => {
    getAggregationDays.mockResolvedValue(['2026-04-10', '2026-04-11'])

    const startDate = new Date(2026, 3, 10)
    const endDate = new Date(2026, 3, 11)
    const { result } = renderHook(() =>
      useMissingDays('1001', 'someDataType', 'aggregation', startDate, endDate)
    )

    await waitFor(() => expect(getAggregationDays).toHaveBeenCalledTimes(1))

    expect(getEventLogDays).not.toHaveBeenCalled()
    expect(result.current).toEqual([])
  })

  it('excludes days after today, even when they have no reported data', async () => {
    getEventLogDays.mockResolvedValue([])

    const startDate = new Date(2026, 3, 14)
    const endDate = new Date(2026, 3, 17)
    const { result } = renderHook(() =>
      useMissingDays('1001', 'someDataType', 'raw', startDate, endDate)
    )

    await waitFor(() => expect(getEventLogDays).toHaveBeenCalledTimes(1))
    await waitFor(() =>
      expect(dateKeys(result.current)).toEqual(['2026-04-14', '2026-04-15'])
    )
  })

  it('does not fetch and returns no missing days when required params are absent', () => {
    const startDate = new Date(2026, 3, 10)
    const endDate = new Date(2026, 3, 13)
    const { result } = renderHook(() =>
      useMissingDays('', 'someDataType', 'raw', startDate, endDate)
    )

    expect(getEventLogDays).not.toHaveBeenCalled()
    expect(getAggregationDays).not.toHaveBeenCalled()
    expect(result.current).toEqual([])
  })

  it('returns no missing days when the API call fails', async () => {
    getEventLogDays.mockRejectedValue(new Error('network error'))
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)

    const startDate = new Date(2026, 3, 10)
    const endDate = new Date(2026, 3, 11)
    const { result } = renderHook(() =>
      useMissingDays('1001', 'someDataType', 'raw', startDate, endDate)
    )

    await waitFor(() => expect(getEventLogDays).toHaveBeenCalledTimes(1))
    expect(result.current).toEqual([])

    consoleError.mockRestore()
  })
})
