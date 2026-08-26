// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - apiError.ts
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
import { AxiosError } from 'axios'

// The single place that turns whatever an API rejected with into a string a
// component can render.
//
// It exists because the backend does not yet speak one error shape. All four
// APIs register AddProblemDetails(), so RFC 7807 is the contract they intend,
// but roughly half the controller error paths still return a bare string
// (BadRequest(e.Message)) and the validation paths return
// ValidationProblemDetails. Until those converge, something has to know about
// all three - and that something should be one file, so that when the backend
// does converge the frontend adopts it by deleting a branch here rather than
// by revisiting every call site.
//
// Two branches are permanent regardless of what the backend does: a request
// that never reached the API (network failure, timeout, DNS) has no body at
// all, and an infrastructure error from a proxy or load balancer can return
// HTML rather than JSON. Neither will ever be ProblemDetails.

const DEFAULT_MESSAGE = 'Something went wrong. Please try again.'
const NETWORK_MESSAGE =
  'Could not reach the server. Check your connection and try again.'

interface ProblemDetailsLike {
  title?: unknown
  detail?: unknown
  message?: unknown
  errors?: unknown
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

const cleanString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  // A proxy or gateway failure often returns an HTML page. Showing its markup
  // to the user is worse than saying nothing, so treat it as unusable.
  if (trimmed.startsWith('<')) return null
  return trimmed
}

// ValidationProblemDetails carries { errors: { field: [msg, ...] } }. The
// field names are the API's own DTO property names, which are not always what
// the form calls them, so only the messages are surfaced.
const flattenValidationErrors = (errors: unknown): string | null => {
  if (!isRecord(errors)) return null

  const messages: string[] = []
  for (const value of Object.values(errors)) {
    if (Array.isArray(value)) {
      for (const entry of value) {
        const message = cleanString(entry)
        if (message) messages.push(message)
      }
    } else {
      const message = cleanString(value)
      if (message) messages.push(message)
    }
  }

  return messages.length ? messages.join(' ') : null
}

const fromResponseBody = (data: unknown): string | null => {
  // BadRequest(e.Message) and friends - still the most common shape today.
  const asString = cleanString(data)
  if (asString) return asString

  if (!isRecord(data)) return null
  const body = data as ProblemDetailsLike

  // Validation failures first: their `title` is the generic "One or more
  // validation errors occurred", which tells the user nothing actionable.
  const validation = flattenValidationErrors(body.errors)
  if (validation) return validation

  return (
    cleanString(body.detail) ??
    cleanString(body.message) ??
    cleanString(body.title)
  )
}

/**
 * Best-effort user-facing message for a rejected API call.
 *
 * Pass `fallback` when the calling screen has something more specific to say
 * than the generic default.
 */
export function getApiErrorMessage(
  error: unknown,
  fallback: string = DEFAULT_MESSAGE
): string {
  if (error instanceof AxiosError) {
    // No response at all means the request never completed - there is no body
    // to read and error.message is an axios internal ("Network Error").
    if (!error.response) {
      return error.code === AxiosError.ECONNABORTED
        ? 'The request timed out. Please try again.'
        : NETWORK_MESSAGE
    }

    return fromResponseBody(error.response.data) ?? fallback
  }

  if (error instanceof Error) {
    return cleanString(error.message) ?? fallback
  }

  return cleanString(error) ?? fallback
}
