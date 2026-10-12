// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - reportError.ts
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
import axios from 'axios'

/**
 * What to tell the user when Generate fails. The report API answers a bad
 * request with a plain message, and a bad field with validation errors.
 */
export function reportErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data
    if (typeof data === 'string' && data.trim()) return data
    if (data?.errors) return Object.values(data.errors).flat().join(' ')
    if (data?.title) return data.title
    if (!error.response) return 'The report service could not be reached.'
  }
  return 'The report could not be generated.'
}
