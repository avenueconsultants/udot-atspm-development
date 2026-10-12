// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - reportError.test.ts
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
import { AxiosError, AxiosHeaders, AxiosResponse } from 'axios'
import { reportErrorMessage } from './reportError'

const failed = (data: unknown) => {
  const config = { headers: new AxiosHeaders() }
  const response: AxiosResponse = {
    data,
    status: 400,
    statusText: 'Bad Request',
    headers: {},
    config,
  }
  return new AxiosError(
    'Request failed',
    'ERR_BAD_REQUEST',
    config,
    {},
    response
  )
}

describe('reportErrorMessage', () => {
  it('shows the message the report API sent', () => {
    expect(reportErrorMessage(failed('Location 9999 was not found.'))).toBe(
      'Location 9999 was not found.'
    )
  })

  it('joins validation errors', () => {
    expect(
      reportErrorMessage(
        failed({
          title: 'One or more validation errors occurred.',
          errors: {
            Start: ['Start is required.'],
            End: ['End must be after start.'],
          },
        })
      )
    ).toBe('Start is required. End must be after start.')
  })

  it('falls back to the title', () => {
    expect(reportErrorMessage(failed({ title: 'Server error' }))).toBe(
      'Server error'
    )
  })

  it('says when the report service could not be reached', () => {
    expect(reportErrorMessage(new AxiosError('Network Error'))).toBe(
      'The report service could not be reached.'
    )
  })

  it('says the report could not be generated for anything else', () => {
    expect(reportErrorMessage(new Error('boom'))).toBe(
      'The report could not be generated.'
    )
    expect(reportErrorMessage(failed('  '))).toBe(
      'The report could not be generated.'
    )
  })
})
