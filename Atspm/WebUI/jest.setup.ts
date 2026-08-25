// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - jest.setup.ts
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
import '@testing-library/jest-dom'
import { server } from '@/test/msw/server'
import { initializeAxiosInstances } from '@/lib/axios'

// configAxios/reportsAxios/etc. are only created by initializeAxiosInstances,
// which normally runs once at app startup - without this, every generated
// hook's underlying axios instance is undefined in tests, so MSW handlers
// registered via server.use() never get a request to intercept.
beforeAll(async () => {
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
  server.listen({ onUnhandledRequest: 'error' })
})
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
