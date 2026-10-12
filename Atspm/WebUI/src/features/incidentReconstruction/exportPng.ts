// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - exportPng.ts
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

import { formatClock, formatDate } from './wallClock'

/** "incident-7115-20260414-174200": the location and the window's start. */
export function exportFileName(
  locationIdentifier: string,
  start: number
): string {
  const location =
    locationIdentifier.replace(/[^A-Za-z0-9_-]/g, '_') || 'location'
  const stamp = `${formatDate(start).replace(/-/g, '')}-${formatClock(start)
    .slice(0, 8)
    .replace(/:/g, '')}`
  return `incident-${location}-${stamp}`
}

/** Saves the chart picture the chart made. */
export function downloadPng(fileName: string, dataUrl: string) {
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = `${fileName}.png`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
