// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - timeWindow.test.ts
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
import { windowProblem } from './timeWindow'
import { MINUTE, parseControllerTime } from './wallClock'

const at = (clock: string) =>
  parseControllerTime(`2026-04-14T${clock}`) as number

describe('time window', () => {
  it('rejects windows the API would refuse', () => {
    expect(windowProblem(at('17:42:00'), at('17:42:00'))).toBe(
      'End must be after start.'
    )
    expect(windowProblem(at('17:00:00'), at('17:00:00') + 61 * MINUTE)).toBe(
      'The window can be at most 60 minutes.'
    )
    expect(windowProblem(at('17:00:00'), at('18:00:00'))).toBeNull()
  })
})
