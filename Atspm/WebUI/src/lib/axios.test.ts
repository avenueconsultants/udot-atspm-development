// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - axios.test.ts
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
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import {
  buildApiBaseUrl,
  buildApiUrl,
  configAxios,
  initializeAxiosInstances,
  reportsAxios,
} from './axios'

// jest.setup.ts's setupFilesAfterEnv eagerly imports '@/lib/axios' (to call
// initializeAxiosInstances in a global beforeAll) before this file's own
// jest.mock() calls are hoisted and registered - by then axios.ts's
// module-level `import Cookies from 'js-cookie'` has already bound to the
// real js-cookie module, so `jest.mock('js-cookie', ...)` here can never
// retroactively intercept it. Driving real document.cookie instead sidesteps
// that and exercises the actual integration.
const clearTokenCookie = () => {
  document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'
}

describe('buildApiBaseUrl', () => {
  it('strips a trailing /api/v1 and slash from the base URL', () => {
    expect(buildApiBaseUrl('https://example.com/api/v1/')).toBe(
      'https://example.com'
    )
    expect(buildApiBaseUrl('https://example.com/api/v1')).toBe(
      'https://example.com'
    )
  })

  it('strips trailing slashes even without an /api/v1 suffix', () => {
    expect(buildApiBaseUrl('https://example.com///')).toBe(
      'https://example.com'
    )
  })

  it('appends the version path only when requested', () => {
    expect(buildApiBaseUrl('https://example.com', true)).toBe(
      'https://example.com/api/v1'
    )
    expect(buildApiBaseUrl('https://example.com', false)).toBe(
      'https://example.com'
    )
  })

  it('is idempotent for a URL that already has the version path', () => {
    expect(buildApiBaseUrl('https://example.com/api/v1', true)).toBe(
      'https://example.com/api/v1'
    )
  })
})

describe('buildApiUrl', () => {
  it('returns the raw path unchanged when no base URL is given', () => {
    expect(buildApiUrl(null, '/foo')).toBe('/foo')
    expect(buildApiUrl(undefined, '/foo')).toBe('/foo')
    expect(buildApiUrl('', '/foo')).toBe('/foo')
  })

  it('joins the normalized base URL and path, adding a leading slash if missing', () => {
    expect(buildApiUrl('https://example.com/api/v1', 'foo')).toBe(
      'https://example.com/foo'
    )
    expect(buildApiUrl('https://example.com/api/v1', '/foo')).toBe(
      'https://example.com/foo'
    )
  })
})

// initializeAxiosInstances registers axios interceptors rather than
// returning inspectable values, so these tests invoke the registered
// handlers directly (axios exposes them via interceptors.*.handlers) instead
// of making real network calls.
describe('initializeAxiosInstances OData unwrapping', () => {
  beforeEach(async () => {
    await initializeAxiosInstances({
      CONFIG_URL: 'http://localhost/config',
      REPORTS_URL: 'http://localhost/reports',
      IDENTITY_URL: 'http://localhost/identity',
      DATA_URL: 'http://localhost/data',
      SPEED_URL: 'http://localhost/speed',
      MAP_DEFAULT_LATITUDE: undefined,
      MAP_DEFAULT_LONGITUDE: undefined,
      MAP_DEFAULT_ZOOM: undefined,
      MAP_TILE_LAYER: undefined,
      MAP_TILE_ATTRIBUTION: undefined,
      POWERED_BY_IMAGE_URL: undefined,
      SPEED_LIMIT_MAP_LAYER: undefined,
    })
  })

  const runResponseInterceptor = (
    instance: typeof configAxios,
    data: unknown
  ) => {
    const handler = instance.interceptors.response.handlers?.[0]
    if (!handler?.fulfilled) {
      throw new Error('expected a registered response interceptor')
    }
    return handler.fulfilled({ data } as AxiosResponse)
  }

  it('unwraps a true OData collection envelope on the config API', () => {
    const result = runResponseInterceptor(configAxios, {
      '@odata.context': 'http://localhost/config/$metadata#Locations',
      value: [{ id: 1 }, { id: 2 }],
    })

    expect(result).toEqual([{ id: 1 }, { id: 2 }])
  })

  it('does not unwrap a single-entity DTO that happens to have its own "value" field', () => {
    const measureOption = { id: 1, value: 5 }
    const result = runResponseInterceptor(configAxios, measureOption)

    expect(result).toBe(measureOption)
  })

  it('does not unwrap when "value" is present but is not an array', () => {
    const data = { '@odata.context': 'ctx', value: 'not-an-array' }
    const result = runResponseInterceptor(configAxios, data)

    expect(result).toBe(data)
  })

  it('does not unwrap a response that is already an array', () => {
    const data = [{ id: 1 }]
    const result = runResponseInterceptor(configAxios, data)

    expect(result).toBe(data)
  })

  it('does not unwrap OData-shaped data on non-OData APIs like reports', () => {
    const data = {
      '@odata.context': 'ctx',
      value: [{ id: 1 }],
    }
    const result = runResponseInterceptor(reportsAxios, data)

    expect(result).toBe(data)
  })
})

describe('authRequestInterceptor', () => {
  beforeEach(async () => {
    clearTokenCookie()
    await initializeAxiosInstances({
      CONFIG_URL: 'http://localhost/config',
      REPORTS_URL: undefined,
      IDENTITY_URL: undefined,
      DATA_URL: undefined,
      SPEED_URL: undefined,
      MAP_DEFAULT_LATITUDE: undefined,
      MAP_DEFAULT_LONGITUDE: undefined,
      MAP_DEFAULT_ZOOM: undefined,
      MAP_TILE_LAYER: undefined,
      MAP_TILE_ATTRIBUTION: undefined,
      POWERED_BY_IMAGE_URL: undefined,
      SPEED_LIMIT_MAP_LAYER: undefined,
    })
  })

  afterEach(() => {
    clearTokenCookie()
  })

  const runRequestInterceptor = (
    config: Partial<InternalAxiosRequestConfig>
  ) => {
    const handler = configAxios.interceptors.request.handlers?.[0]
    if (!handler?.fulfilled) {
      throw new Error('expected a registered request interceptor')
    }
    return handler.fulfilled(
      config as InternalAxiosRequestConfig
    ) as InternalAxiosRequestConfig
  }

  it('adds a bearer Authorization header when a token cookie is present', () => {
    document.cookie = 'token=abc123'

    const result = runRequestInterceptor({ headers: {} as never })

    expect(result.headers.authorization).toBe('Bearer abc123')
  })

  it('leaves the Authorization header unset when there is no token cookie', () => {
    const result = runRequestInterceptor({ headers: {} as never })

    expect(result.headers.authorization).toBeUndefined()
  })
})
