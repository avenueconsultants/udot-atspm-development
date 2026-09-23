// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - ReportApiInsightsCard/utils.test.ts
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
import type { UsageEntry } from '@/api/config'
import { buildByTime, formatUsageLocalDateRange } from './utils'

// Computed independently of the dateTime helpers the card uses, so a
// regression there cannot move the expected value along with the actual one.
const pad2 = (n: number) => String(n).padStart(2, '0')
const localDateStamp = (date: Date) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`

describe('ReportApiInsightsCard usage time helpers', () => {
  it('groups usage rows by local day', () => {
    const instant = '2026-05-21T02:30:00+00:00'
    const rows: UsageEntry[] = [
      {
        id: 1,
        apiName: 'ReportApi',
        timestamp: instant,
        success: true,
      },
      {
        // The same instant, written with a different offset.
        id: 2,
        apiName: 'ReportApi',
        timestamp: '2026-05-20T20:30:00-06:00',
        success: true,
      },
    ]

    expect(
      buildByTime(rows, { groupBy: 'day', metric: 'ReportsGenerated' })
    ).toEqual([{ name: localDateStamp(new Date(instant)), count: 2 }])
  })

  // The bounds the filters produce carry no offset; the helpers read those
  // as UTC and display them as local dates.
  it('formats timezone-less usage bounds as local dates', () => {
    expect(
      formatUsageLocalDateRange('2026-05-01T00:00:00', '2026-05-21T00:00:00')
    ).toBe(
      `${localDateStamp(new Date('2026-05-01T00:00:00Z'))} - ${localDateStamp(
        new Date('2026-05-21T00:00:00Z')
      )}`
    )
  })
})
