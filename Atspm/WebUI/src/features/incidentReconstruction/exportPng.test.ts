// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - exportPng.test.ts
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
import { exportFileName } from './exportPng'
import { parseControllerTime } from './wallClock'

const at = (clock: string) =>
  parseControllerTime(`2026-04-14T${clock}`) as number

describe('exportFileName', () => {
  it('names the file by location and start time', () => {
    expect(exportFileName('7115', at('17:42:00'))).toBe(
      'incident-7115-20260414-174200'
    )
    expect(exportFileName('a/b c', at('09:05:03'))).toBe(
      'incident-a_b_c-20260414-090503'
    )
  })
})
