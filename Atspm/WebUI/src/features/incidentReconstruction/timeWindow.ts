// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - timeWindow.ts
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
import { DAY, MINUTE, startOfControllerDay } from './wallClock'

// The window the user types: a date, a start and an end, all controller clock.
// The report API is asked for exactly this window.

export const MAX_WINDOW = 60 * MINUTE

/** A picked time's time of day on another day. */
export function timeOnDay(day: number, time: number): number {
  return startOfControllerDay(day) + (time - startOfControllerDay(time))
}

/**
 * Puts the end on the start's day, or on the next day when that makes a short
 * window across midnight, such as 23:59:30 to 00:00:30.
 */
export function endAfter(start: number, end: number): number {
  const sameDay = timeOnDay(start, end)
  return sameDay < start && sameDay + DAY - start <= MAX_WINDOW
    ? sameDay + DAY
    : sameDay
}

/** Why a typed window cannot be generated, or null when it can. */
export function windowProblem(
  start: number | null,
  end: number | null
): string | null {
  if (start === null || end === null) return 'Enter a start and an end.'
  if (end <= start) return 'End must be after start.'
  if (end - start > MAX_WINDOW) return 'The window can be at most 60 minutes.'
  return null
}
