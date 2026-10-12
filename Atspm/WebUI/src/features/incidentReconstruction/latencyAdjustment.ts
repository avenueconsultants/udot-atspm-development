// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - latencyAdjustment.ts
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
// The page shows adjusted time: controller clock plus the adjustment the user
// typed. The adjustment is applied after the report comes back, so changing it
// never fetches the report again.

export const MAX_ADJUSTMENT_SECONDS = 300

/** Clamps to ±300 s and rounds to the tenth. Anything unreadable is 0. */
export function normalizeAdjustment(seconds: number): number {
  if (!Number.isFinite(seconds)) return 0
  const clamped = Math.min(
    MAX_ADJUSTMENT_SECONDS,
    Math.max(-MAX_ADJUSTMENT_SECONDS, seconds)
  )
  const tenths = Math.round(clamped * 10)
  return tenths === 0 ? 0 : tenths / 10
}

export function adjustmentMs(seconds: number): number {
  return Math.round(normalizeAdjustment(seconds) * 10) * 100
}

/** Controller time to the time shown on the page. */
export function toAdjusted(controllerTime: number, seconds: number): number {
  return controllerTime + adjustmentMs(seconds)
}

/** Shown time back to controller time. */
export function toController(adjustedTime: number, seconds: number): number {
  return adjustedTime - adjustmentMs(seconds)
}

/** The quiet line under the chart's subtitle, or null when the adjustment is zero. */
export function adjustmentNote(seconds: number): string | null {
  const value = normalizeAdjustment(seconds)
  if (value === 0) return null

  return `Latency adjustment: ${value.toFixed(1)}s`
}
