// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - linkPivotPcdTimeWindow.test.ts
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
import {
  TimeSpaceAverageOptions,
  TimeSpaceHistoricOptions,
} from '@/features/charts/timeSpaceDiagram/shared/types'
import { getLinkPivotPcdTimeWindowFromTimeSpaceOptions } from './linkPivotPcdTimeWindow'

const localTimeOfDay = (date: Date) => [
  date.getHours(),
  date.getMinutes(),
  date.getSeconds(),
]

describe('getLinkPivotPcdTimeWindowFromTimeSpaceOptions', () => {
  it('builds a PCD time window from average options', () => {
    const options: TimeSpaceAverageOptions = {
      startDate: '2026-04-01',
      endDate: '2026-04-03',
      startTime: '08:15:00',
      endTime: '09:45:00',
      routeId: '42',
      speedLimit: null,
      sequence: [],
      coordinatedPhases: [],
      daysOfWeek: [1, 2, 3],
    }

    const result = getLinkPivotPcdTimeWindowFromTimeSpaceOptions(options)

    // The day bounds are UTC midnights; the times of day are local.
    expect(result.startDateTime.toISOString()).toBe('2026-04-01T00:00:00.000Z')
    expect(result.endDateTime.toISOString()).toBe('2026-04-03T00:00:00.000Z')
    expect(localTimeOfDay(result.startTime)).toEqual([8, 15, 0])
    expect(localTimeOfDay(result.endTime)).toEqual([9, 45, 0])
  })

  it('builds a PCD time window from historic options', () => {
    const options: TimeSpaceHistoricOptions = {
      locationIdentifier: '1234',
      extendStartStopSearch: 0,
      showAllLanesInfo: false,
      routeId: '42',
      chartType: ToolType.TimeSpaceHistoric,
      speedLimit: null,
      start: new Date('2026-04-05T07:30:00Z'),
      end: new Date('2026-04-06T08:45:00Z'),
    }

    const result = getLinkPivotPcdTimeWindowFromTimeSpaceOptions(options)

    expect(result.startDateTime.toISOString()).toBe('2026-04-05T00:00:00.000Z')
    expect(result.endDateTime.toISOString()).toBe('2026-04-06T00:00:00.000Z')
    expect(result.startTime.toISOString()).toBe('2026-04-05T07:30:00.000Z')
    expect(result.endTime.toISOString()).toBe('2026-04-06T08:45:00.000Z')
  })
})
