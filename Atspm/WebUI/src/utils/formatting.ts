// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - formatting.ts
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
export function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const k = 1024
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB']
  const i = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(k))
  )
  const v = bytes / Math.pow(k, i)
  const digits = v >= 100 ? 0 : v >= 10 ? 1 : 2
  return `${v.toFixed(digits)} ${units[i]}`
}

export function formatMs(ms: number) {
  if (!Number.isFinite(ms)) return ''
  if (ms < 1000) return `${ms} ms`
  // Round to the displayed precision before choosing a unit, so a duration
  // that would display as "60.00 s" is shown as a minute instead.
  const hundredths = Math.round(ms / 10)
  if (hundredths < 6000) return `${(hundredths / 100).toFixed(2)} s`
  const tenths = Math.round(ms / 100)
  const m = Math.floor(tenths / 600)
  const r = (tenths - m * 600) / 10
  return `${m}m ${r.toFixed(1)}s`
}
