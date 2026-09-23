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
import type { MeasureType } from '@/api/config/config-api.schemas'
import {
  getGetMeasureTypeQueryOptions,
  getMeasureType,
  getMeasureTypeCount,
  getMeasureTypeFromKey,
} from '@/api/config/measure-type/measure-type'
import { configAxios, configRequest, reportsAxios } from '@/lib/axios'
import {
  CONFIG_API,
  odataCollection,
  odataEntity,
  odataNotFound,
  REPORTS_API,
} from '@/test/fixtures/api'
import { measureTypes } from '@/test/fixtures/config'
import { server } from '@/test/msw/server'
import { QueryClient } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'

// axios.test.ts drives the interceptors directly. These go through the real
// instances jest.setup.ts creates, end to end, against responses in the
// shapes the APIs were recorded sending.
describe('config API responses', () => {
  it('returns an item array from a generated collection request', async () => {
    server.use(
      http.get(`${CONFIG_API}/MeasureType`, () =>
        HttpResponse.json(odataCollection('MeasureType', measureTypes))
      )
    )

    const result: MeasureType[] = await getMeasureType()
    expect(result).toEqual(measureTypes)
  })

  it('returns an item array from a generated keyed request', async () => {
    server.use(
      http.get(`${CONFIG_API}/MeasureType/1`, () =>
        HttpResponse.json(odataCollection('MeasureType', [measureTypes[0]]))
      )
    )

    const result: MeasureType[] = await getMeasureTypeFromKey(1)
    expect(result).toEqual([measureTypes[0]])
  })

  it('returns a scalar from a generated count request', async () => {
    server.use(
      http.get(`${CONFIG_API}/MeasureType/$count`, () => HttpResponse.text('2'))
    )

    const result: number = await getMeasureTypeCount()
    expect(result).toBe(2)
  })

  it('infers item arrays for generated query options', async () => {
    server.use(
      http.get(`${CONFIG_API}/MeasureType`, () =>
        HttpResponse.json(odataCollection('MeasureType', measureTypes))
      )
    )

    const client = new QueryClient()
    try {
      const result: MeasureType[] = await client.fetchQuery(
        getGetMeasureTypeQueryOptions()
      )
      expect(result).toEqual(measureTypes)
    } finally {
      client.clear()
    }
  })

  it('passes a single-entity response through unchanged', async () => {
    const entity = odataEntity('MeasureType', measureTypes[0])
    server.use(
      http.get(`${CONFIG_API}/MeasureType/Single`, () =>
        HttpResponse.json(entity)
      )
    )

    const result = await configAxios.get('/MeasureType/Single')

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

    const result: typeof measureOption = await configRequest<
      typeof measureOption
    >({
      url: '/MeasureOption/3',
      method: 'GET',
    })
    expect(result).toEqual(measureOption)
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
