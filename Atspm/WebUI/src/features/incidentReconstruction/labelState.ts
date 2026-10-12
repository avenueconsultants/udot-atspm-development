// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - labelState.ts
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
import { Labels, MAX_LABEL_LENGTH, SignalNames } from './urlCodecs'
import { startOfControllerDay } from './wallClock'

// The labeled events and signal names the share link carries, and when they are cleared.

/** Numbers an event on the chart, or takes it off. Taking it off drops its text too. */
export function toggleLabeled(labels: Labels, key: string): Labels {
  if (key in labels) return withoutLabeled(labels, key)
  return { ...labels, [key]: '' }
}

export function withoutLabeled(labels: Labels, key: string): Labels {
  const next = { ...labels }
  delete next[key]
  return next
}

/** Sets a labeled event's text. An empty text keeps the event numbered. */
export function withLabelText(
  labels: Labels,
  key: string,
  text: string
): Labels {
  return { ...labels, [key]: text.slice(0, MAX_LABEL_LENGTH) }
}

/** Gives every labeled event with no text the suggestion for it. */
export function withFilledLabels(
  labels: Labels,
  suggestions: Map<string, string>
): Labels {
  const next = { ...labels }
  for (const [key, suggestion] of suggestions) {
    if (key in next && next[key].trim() === '') next[key] = suggestion
  }
  return next
}

/** Sets or clears one signal's "Display as" name. */
export function withName(
  names: SignalNames,
  key: string,
  name: string
): SignalNames {
  const next = { ...names }
  if (name.trim() === '') delete next[key]
  else next[key] = name
  return next
}

/** What Generate clears from the link: nothing, the labels, or those plus the signal and code choices. */
export type GenerateClear = 'nothing' | 'labels' | 'everything'

/**
 * Labels are keyed by the controller's time of day, so on another day they
 * would land on different events. Another location has different phases too.
 */
export function clearsOnGenerate(
  previous: { location: string | null; start: number | null },
  next: { location: string; start: number }
): GenerateClear {
  if (previous.location !== null && previous.location !== next.location) {
    return 'everything'
  }
  if (
    previous.start !== null &&
    startOfControllerDay(previous.start) !== startOfControllerDay(next.start)
  ) {
    return 'labels'
  }
  return 'nothing'
}
