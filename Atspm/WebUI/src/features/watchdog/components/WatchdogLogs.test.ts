// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - WatchdogLogs.test.ts
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
  WatchDogComponentTypesName,
  WatchDogIssueTypesName,
} from '@/api/config'
import { toIgnoreEvent } from './WatchdogLogs'

// The component module pulls in the notifications store, whose nanoid
// dependency ships ESM only; the store itself plays no part in this test.
jest.mock('@/stores/notifications', () => ({
  useNotificationStore: () => ({ addNotification: jest.fn() }),
}))

// A watchdog log row as the report API describes it: integer enums.
const row = {
  id: 7,
  key: 42,
  locationId: 1,
  locationIdentifier: '1001',
  timestamp: '2026-03-01T06:00:00',
  regionDescription: 'Region 2',
  jurisdictionName: 'Salt Lake City',
  areas: '',
  issueType: 'Record Count',
  issueTypeId: 1,
  phase: 2,
  details: '',
  componentType: 0,
  componentId: 100,
  ignored: false,
}

describe('toIgnoreEvent', () => {
  // Regression test: the ignore event used to be built by casting the report
  // API's integers into the config API's fields, which expect member names.
  it('translates the report API integers into the config API member names', () => {
    const event = toIgnoreEvent(
      row,
      new Date(2026, 2, 1),
      new Date(2026, 2, 31)
    )

    expect(event).toMatchObject({
      key: '42',
      locationId: 1,
      locationIdentifier: '1001',
      issueType: WatchDogIssueTypesName.RecordCount,
      componentType: WatchDogComponentTypesName.Location,
      componentId: 100,
      phase: 2,
    })
    expect(typeof event.start).toBe('string')
    expect(typeof event.end).toBe('string')
  })

  it('leaves an integer it cannot name undefined instead of inventing one', () => {
    const event = toIgnoreEvent(
      { ...row, issueTypeId: 999, componentType: 999 },
      new Date(2026, 2, 1),
      null
    )

    expect(event.issueType).toBeUndefined()
    expect(event.componentType).toBeUndefined()
  })

  it('omits the end date of an open-ended ignore', () => {
    expect(toIgnoreEvent(row, new Date(2026, 2, 1), null).end).toBeUndefined()
  })
})
