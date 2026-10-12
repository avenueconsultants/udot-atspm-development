// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - urlCodecs.ts
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
import { normalizeAdjustment } from './latencyAdjustment'
import { SECOND, parseControllerTime, toRequestLiteral } from './wallClock'

// Everything the share link carries. Labels are keyed by event key
// (controller time, code and parameter), so they survive an adjustment change.

export const MAX_LABEL_LENGTH = 80
export const MAX_NAME_LENGTH = 60

const eventKeyPattern = /^\d{6}\.\d-\d+-\d+(?:-\d+)?$/
const bandKeyPattern = /^[A-Za-z0-9_-]{1,40}$/

/** The labeled events: every key is numbered on the chart, with or without text. */
export type Labels = Record<string, string>

/** "Display as" names, by band key. */
export type SignalNames = Record<string, string>

export function serializeLabels(labels: Labels): string {
  const entries = Object.entries(labels).filter(([key]) =>
    eventKeyPattern.test(key)
  )
  return JSON.stringify(Object.fromEntries(entries))
}

/** Reads labels back, dropping anything that is not an event key and a string. */
export function parseLabels(value: string): Labels | null {
  const parsed = parseRecord(value)
  if (!parsed) return null

  const labels: Labels = {}
  for (const [key, text] of Object.entries(parsed)) {
    if (!eventKeyPattern.test(key) || typeof text !== 'string') continue
    labels[key] = text.slice(0, MAX_LABEL_LENGTH)
  }
  return labels
}

export function serializeNames(names: SignalNames): string {
  const entries = Object.entries(names).filter(
    ([key, name]) => bandKeyPattern.test(key) && name.trim() !== ''
  )
  return JSON.stringify(Object.fromEntries(entries))
}

export function parseNames(value: string): SignalNames | null {
  const parsed = parseRecord(value)
  if (!parsed) return null

  const names: SignalNames = {}
  for (const [key, name] of Object.entries(parsed)) {
    if (!bandKeyPattern.test(key) || typeof name !== 'string') continue
    const trimmed = name.slice(0, MAX_NAME_LENGTH)
    if (trimmed.trim() !== '') names[key] = trimmed
  }
  return names
}

function parseRecord(value: string): Record<string, unknown> | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    return null
  }
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : null
}

/** "2026-04-14T17:42:00": whole seconds of controller time, from 1900 on as the date picker allows. */
export function parseTimeParam(value: string): number | null {
  const time = parseControllerTime(value)
  if (time === null || new Date(time).getUTCFullYear() < 1900) return null
  return Math.floor(time / SECOND) * SECOND
}

export const serializeTimeParam = toRequestLiteral

export function parseAdjustmentParam(value: string): number | null {
  const seconds = Number(value)
  return value.trim() !== '' && Number.isFinite(seconds)
    ? normalizeAdjustment(seconds)
    : null
}

export function serializeAdjustmentParam(seconds: number): string {
  return String(normalizeAdjustment(seconds))
}
