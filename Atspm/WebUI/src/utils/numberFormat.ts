// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - numberFormat.ts
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
export function roundTo(
  value: number | null | undefined,
  decimals: number
): number | null {
  if (value == null) return null
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

export interface FormatNumberOptions {
  /** What a null, undefined or non-numeric value renders as. */
  empty?: string
  /** Thousands separators, in the user's locale. */
  grouping?: boolean
}

export function formatNumber(
  value: number | string | null | undefined,
  decimals = 0,
  { empty = '', grouping = false }: FormatNumberOptions = {}
): string {
  if (value == null) return empty

  const numeric = typeof value === 'number' ? value : Number(String(value))

  if (!Number.isFinite(numeric)) return empty

  if (grouping) {
    return numeric.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
  }

  if (decimals === 0) {
    return String(Math.round(numeric))
  }

  return numeric.toFixed(decimals)
}
