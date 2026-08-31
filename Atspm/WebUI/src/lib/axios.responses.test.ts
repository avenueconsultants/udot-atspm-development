// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - axios.responses.test.ts
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
import { configAxios, reportsAxios } from '@/lib/axios'
import {
  CONFIG_API,
  odataCollection,
  odataEntity,
  odataNotFound,
  REPORTS_API,
} from '@/test/fixtures/api'
import { measureTypes } from '@/test/fixtures/config'
import { server } from '@/test/msw/server'
import { http, HttpResponse } from 'msw'

// axios.test.ts drives the interceptors directly. These go through the real
// instances jest.setup.ts creates, end to end, against responses in the
// shapes the APIs were recorded sending.
describe('config API responses', () => {
  it('unwraps an OData collection to its items', async () => {
    server.use(
      http.get(`${CONFIG_API}/MeasureType`, () =>
        HttpResponse.json(odataCollection('MeasureType', measureTypes))
      )
    )

    await expect(configAxios.get('/MeasureType')).resolves.toEqual(measureTypes)
  })

  it('passes a keyed GET through as the single entity it is', async () => {
    const entity = odataEntity('MeasureType', measureTypes[0])
    server.use(
      http.get(`${CONFIG_API}/MeasureType/1`, () => HttpResponse.json(entity))
    )

    const result = await configAxios.get('/MeasureType/1')

    expect(Array.isArray(result)).toBe(false)
    expect(result).toEqual(entity)
  })

  // MeasureOption has a field of its own called `value`; without the context
  // link the unwrap must not mistake it for the envelope.
  it('leaves a payload with its own value field alone', async () => {
    const measureOption = { id: 3, option: 'binSize', value: ['15', '30'] }
    server.use(
      http.get(`${CONFIG_API}/MeasureOption/3`, () =>
        HttpResponse.json(measureOption)
      )
    )

    await expect(configAxios.get('/MeasureOption/3')).resolves.toEqual(
      measureOption
    )
  })

  it('rejects a missing key with the 404 the API sends', async () => {
    server.use(
      http.get(`${CONFIG_API}/MeasureType/999999`, () =>
        HttpResponse.json(odataNotFound(999999), { status: 404 })
      )
    )

    await expect(configAxios.get('/MeasureType/999999')).rejects.toMatchObject({
      response: { status: 404, data: odataNotFound(999999) },
    })
  })
})

describe('other API responses', () => {
  // Only the config API is OData, so only its instance unwraps; a report
  // payload that happened to look like an envelope must arrive untouched.
  it('are never unwrapped', async () => {
    const payload = { '@odata.context': 'not-really', value: [1, 2, 3] }
    server.use(
      http.get(`${REPORTS_API}/Watchdog/IssueTypes`, () =>
        HttpResponse.json(payload)
      )
    )

    await expect(
      reportsAxios.get('/api/v1/Watchdog/IssueTypes')
    ).resolves.toEqual(payload)
  })
})
