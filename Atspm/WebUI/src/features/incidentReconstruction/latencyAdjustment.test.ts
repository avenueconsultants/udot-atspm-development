// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - latencyAdjustment.test.ts
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
  adjustmentNote,
  normalizeAdjustment,
  toAdjusted,
  toController,
} from './latencyAdjustment'
import { formatClock, parseControllerTime } from './wallClock'

const at = (clock: string) =>
  parseControllerTime(`2026-04-14T${clock}`) as number

describe('latency adjustment', () => {
  it('moves controller time forward for a positive adjustment', () => {
    expect(formatClock(toAdjusted(at('17:42:30.9'), 1.5))).toBe('17:42:32.4')
  })

  it('moves controller time back for a negative adjustment', () => {
    expect(formatClock(toAdjusted(at('17:42:30.9'), -2))).toBe('17:42:28.9')
  })

  it('handles tenths without floating point drift', () => {
    expect(formatClock(toAdjusted(at('17:42:30.9'), 0.3))).toBe('17:42:31.2')
    expect(toController(toAdjusted(at('17:42:30.9'), 0.3), 0.3)).toBe(
      at('17:42:30.9')
    )
  })

  it('clamps to 300 seconds and rounds to the tenth', () => {
    expect(normalizeAdjustment(450)).toBe(300)
    expect(normalizeAdjustment(-301)).toBe(-300)
    expect(normalizeAdjustment(1.26)).toBe(1.3)
    expect(normalizeAdjustment(Number.NaN)).toBe(0)
    expect(Object.is(normalizeAdjustment(-0.01), 0)).toBe(true)
  })

  it('notes the adjustment on the chart only when there is one', () => {
    expect(adjustmentNote(0)).toBeNull()
    expect(adjustmentNote(1.6)).toBe('Latency adjustment: 1.6s')
    expect(adjustmentNote(-0.3)).toBe('Latency adjustment: -0.3s')
    expect(adjustmentNote(2)).toBe('Latency adjustment: 2.0s')
  })
})
