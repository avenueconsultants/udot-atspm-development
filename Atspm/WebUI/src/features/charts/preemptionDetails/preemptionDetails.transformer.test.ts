// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - preemptionDetails.transformer.test.ts
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
import { ChartType } from '@/features/charts/common/types'
import transformPreemptionDetailsData from './preemptionDetails.transformer'
import type { RawPreemptionDetailsResponse } from './types'

// Unlike the other migrated charts, this response is an object rather than
// an array: an optional summary plus an optional list of per-location
// details. Both halves are nullable in the generated PreemptDetailResult, and
// the summary is prepended to the chart list only when present.

const cycle = () => ({
  inputOn: '2026-04-01T08:00:00',
  inputOff: '2026-04-01T08:01:00',
  gateDown: '2026-04-01T08:00:20',
  callMaxOut: '2026-04-01T08:00:30',
  delay: 5,
  timeToService: 12,
  dwellTime: 40,
  trackClear: '2026-04-01T08:00:45',
})

const populated = (): RawPreemptionDetailsResponse =>
  ({
    type: ChartType.PreemptionDetails,
    data: {
      summary: {
        locationIdentifier: '1001',
        locationDescription: '1001 - Main St & 400 S',
        start: '2026-04-01T08:00:00',
        end: '2026-04-01T09:00:00',
        requestAndServices: [
          {
            preemptionNumber: 1,
            requests: ['2026-04-01T08:00:00'],
            services: ['2026-04-01T08:00:30'],
          },
        ],
      },
      details: [
        {
          locationIdentifier: '1001',
          locationDescription: '1001 - Main St & 400 S',
          preemptionNumber: 1,
          start: '2026-04-01T08:00:00',
          end: '2026-04-01T09:00:00',
          cycles: [cycle()],
        },
      ],
    },
  }) as unknown as RawPreemptionDetailsResponse

describe('transformPreemptionDetailsData', () => {
  it('puts the summary chart ahead of the detail charts', () => {
    const result = transformPreemptionDetailsData(populated())

    expect(result.type).toBe(ChartType.PreemptionDetails)
    expect(result.data.charts).toHaveLength(2)
  })

  it('renders detail charts when there is no summary', () => {
    const response = populated()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(response.data as any).summary = null

    const result = transformPreemptionDetailsData(response)

    expect(result.data.charts).toHaveLength(1)
  })

  it('renders the summary chart when there are no details', () => {
    const response = populated()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(response.data as any).details = null

    const result = transformPreemptionDetailsData(response)

    expect(result.data.charts).toHaveLength(1)
  })

  it('returns no charts when both halves are missing', () => {
    const empty = {
      type: ChartType.PreemptionDetails,
      data: { summary: null, details: null },
    } as unknown as RawPreemptionDetailsResponse

    expect(() => transformPreemptionDetailsData(empty)).not.toThrow()
    expect(transformPreemptionDetailsData(empty).data.charts).toEqual([])
  })

  it('renders a detail whose every optional field is null', () => {
    const response = {
      type: ChartType.PreemptionDetails,
      data: {
        summary: null,
        details: [
          {
            locationIdentifier: null,
            locationDescription: null,
            preemptionNumber: null,
            start: null,
            end: null,
            cycles: null,
          },
        ],
      },
    } as unknown as RawPreemptionDetailsResponse

    expect(() => transformPreemptionDetailsData(response)).not.toThrow()
    expect(transformPreemptionDetailsData(response).data.charts).toHaveLength(1)
  })

  it('renders a summary whose every optional field is null', () => {
    const response = {
      type: ChartType.PreemptionDetails,
      data: {
        summary: {
          locationIdentifier: null,
          locationDescription: null,
          start: null,
          end: null,
          requestAndServices: null,
        },
        details: null,
      },
    } as unknown as RawPreemptionDetailsResponse

    expect(() => transformPreemptionDetailsData(response)).not.toThrow()
    expect(transformPreemptionDetailsData(response).data.charts).toHaveLength(1)
  })

  it('tolerates request/service lists that are individually null', () => {
    const response = populated()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(response.data as any).summary.requestAndServices = [
      { preemptionNumber: null, requests: null, services: null },
    ]

    expect(() => transformPreemptionDetailsData(response)).not.toThrow()
  })

  // getSeries skips cycle fields that are null, so a partially-reported cycle
  // must not take the chart down with it.
  it('tolerates cycles with null timing fields', () => {
    const response = populated()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(response.data as any).details[0].cycles = [
      {
        inputOn: '2026-04-01T08:00:00',
        inputOff: null,
        gateDown: null,
        callMaxOut: null,
        delay: null,
        timeToService: null,
        dwellTime: null,
        trackClear: null,
      },
    ]

    expect(() => transformPreemptionDetailsData(response)).not.toThrow()
  })
})
