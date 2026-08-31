// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - apiError.test.ts
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
import { getApiErrorMessage } from '@/lib/apiError'
import { AxiosError, AxiosHeaders } from 'axios'

// Each case here corresponds to a shape one of the APIs actually produces
// today. As the backend converges on ProblemDetails these stop being distinct
// paths, and the branch that handled the retired shape can be deleted from
// apiError.ts with this file as the record of what it was for.

const axiosErrorWith = (data: unknown, status = 400) => {
  const error = new AxiosError('Request failed with status code ' + status)
  error.response = {
    data,
    status,
    statusText: '',
    headers: new AxiosHeaders(),
    config: { headers: new AxiosHeaders() },
  }
  return error
}

describe('getApiErrorMessage', () => {
  // BadRequest(e.Message) - roughly half the controller error paths.
  it('uses a bare string body as the message', () => {
    expect(
      getApiErrorMessage(axiosErrorWith('Invalid query parameters.'))
    ).toBe('Invalid query parameters.')
  })

  it('trims a bare string body', () => {
    expect(getApiErrorMessage(axiosErrorWith('  Bad request.  '))).toBe(
      'Bad request.'
    )
  })

  // The unhandled-exception path: AddProblemDetails() + UseExceptionHandler.
  it('prefers detail over title on a ProblemDetails body', () => {
    expect(
      getApiErrorMessage(
        axiosErrorWith(
          {
            type: 'https://tools.ietf.org/html/rfc9110#section-15.6.1',
            title: 'An error occurred while processing your request.',
            status: 500,
            detail: 'Sequence contains no elements.',
          },
          500
        )
      )
    ).toBe('Sequence contains no elements.')
  })

  it('falls back to title when a ProblemDetails body has no detail', () => {
    expect(
      getApiErrorMessage(
        axiosErrorWith({ title: 'Location not found.', status: 404 }, 404)
      )
    ).toBe('Location not found.')
  })

  // BadRequest(ModelState) / ValidationProblem(ModelState).
  it('flattens validation errors into one message', () => {
    expect(
      getApiErrorMessage(
        axiosErrorWith({
          title: 'One or more validation errors occurred.',
          status: 400,
          errors: {
            Start: ['The Start field is required.'],
            BinSize: ['Bin size must be greater than zero.'],
          },
        })
      )
    ).toBe('The Start field is required. Bin size must be greater than zero.')
  })

  // The generic validation title tells the user nothing they can act on, so
  // the field messages have to win over it.
  it('prefers validation messages over the generic validation title', () => {
    const message = getApiErrorMessage(
      axiosErrorWith({
        title: 'One or more validation errors occurred.',
        errors: { Start: ['The Start field is required.'] },
      })
    )

    expect(message).toBe('The Start field is required.')
    expect(message).not.toContain('One or more validation errors')
  })

  it('tolerates a validation entry that is a bare string', () => {
    expect(
      getApiErrorMessage(
        axiosErrorWith({ errors: { Start: 'The Start field is required.' } })
      )
    ).toBe('The Start field is required.')
  })

  it('ignores an empty errors bag and falls back to the title', () => {
    expect(
      getApiErrorMessage(axiosErrorWith({ title: 'Bad request.', errors: {} }))
    ).toBe('Bad request.')
  })

  it('reads a message property, which some endpoints use instead', () => {
    expect(
      getApiErrorMessage(axiosErrorWith({ message: 'Report is unavailable.' }))
    ).toBe('Report is unavailable.')
  })

  // A gateway or proxy failure returns an HTML page. Rendering its markup is
  // worse than saying nothing useful.
  it('does not surface an HTML error page', () => {
    const message = getApiErrorMessage(
      axiosErrorWith('<html><body>502 Bad Gateway</body></html>', 502)
    )

    expect(message).not.toContain('<')
    expect(message).toBe('Something went wrong. Please try again.')
  })

  it('falls back when the body carries nothing usable', () => {
    expect(getApiErrorMessage(axiosErrorWith({ status: 500 }, 500))).toBe(
      'Something went wrong. Please try again.'
    )
    expect(getApiErrorMessage(axiosErrorWith(null, 500))).toBe(
      'Something went wrong. Please try again.'
    )
    expect(getApiErrorMessage(axiosErrorWith('   '))).toBe(
      'Something went wrong. Please try again.'
    )
  })

  it('uses a caller-supplied fallback instead of the generic one', () => {
    expect(
      getApiErrorMessage(axiosErrorWith({}, 500), 'Could not build the chart.')
    ).toBe('Could not build the chart.')
  })

  // These two never carry a body, whatever the backend does about its
  // error contract.
  it('reports a request that never reached the server', () => {
    expect(getApiErrorMessage(new AxiosError('Network Error'))).toBe(
      'Could not reach the server. Check your connection and try again.'
    )
  })

  it('reports a timeout distinctly from a connection failure', () => {
    const error = new AxiosError('timeout exceeded', AxiosError.ECONNABORTED)

    expect(getApiErrorMessage(error)).toBe(
      'The request timed out. Please try again.'
    )
  })

  it('reads the message off a plain Error', () => {
    expect(getApiErrorMessage(new Error('Unknown chart type'))).toBe(
      'Unknown chart type'
    )
  })

  it('handles values that are not errors at all', () => {
    expect(getApiErrorMessage('something broke')).toBe('something broke')
    expect(getApiErrorMessage(undefined)).toBe(
      'Something went wrong. Please try again.'
    )
    expect(getApiErrorMessage({ nope: true })).toBe(
      'Something went wrong. Please try again.'
    )
  })

  // The whole point of the helper: a component can render the result
  // directly, which the previous inline `error.response?.data` could not do.
  it('always returns a string, never an object React cannot render', () => {
    const bodies: unknown[] = [
      'plain string',
      { title: 'a title' },
      { errors: { A: ['one'] } },
      { unexpected: { nested: true } },
      null,
      undefined,
      42,
    ]

    for (const body of bodies) {
      expect(typeof getApiErrorMessage(axiosErrorWith(body))).toBe('string')
    }
  })
})
