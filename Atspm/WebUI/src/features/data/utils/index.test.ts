// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - index.test.ts
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
import type { CompressedDataBase } from '@/api/data/data-api.schemas'
import type { DataTypeOption } from '@/features/data/components/dataTypeSelector/DataTypeSelector'
import { formatData, generateFilename } from './index'

const buildData = (rows: Record<string, unknown>[]): CompressedDataBase[] =>
  [{ data: rows }] as unknown as CompressedDataBase[]

describe('formatData', () => {
  it('returns a JSON string as-is for application/json', () => {
    const data = buildData([{ timestamp: '2026-04-01T08:00:00', value: 1 }])
    expect(formatData(data, 'application/json')).toBe(JSON.stringify(data))
  })

  it('builds a CSV with a header row and replaces the "T" in timestamps with a space', () => {
    const data = buildData([{ timestamp: '2026-04-01T08:00:00', value: 1 }])
    const csv = formatData(data, 'text/csv') as string

    expect(csv).toBe('timestamp,value\n2026-04-01 08:00:00,1\n')
  })

  it('quotes a CSV field that itself contains a comma', () => {
    const data = buildData([{ name: 'Main St, Suite 1', value: 1 }])
    const csv = formatData(data, 'text/csv') as string

    expect(csv).toBe('name,value\n"Main St, Suite 1",1\n')
  })

  it('returns an empty string for CSV/XML when there is no underlying data', () => {
    const data = buildData([])
    expect(formatData(data, 'text/csv')).toBe('')
    expect(formatData(data, 'application/xml')).toBe('')
  })

  it('builds an XML document with one element per row', () => {
    const data = buildData([{ timestamp: '2026-04-01T08:00:00', value: 1 }])
    const xml = formatData(data, 'application/xml') as string

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>')
    expect(xml).toContain('<eventLog>')
    expect(xml).toContain('<timestamp>2026-04-01T08:00:00</timestamp>')
    expect(xml).toContain('<value>1</value>')
  })

  it('flattens data across multiple CompressedDataBase entries', () => {
    const data = [
      { data: [{ value: 1 }] },
      { data: [{ value: 2 }] },
    ] as unknown as CompressedDataBase[]

    const csv = formatData(data, 'text/csv') as string
    expect(csv).toBe('value\n1\n2\n')
  })

  it('returns the raw data unchanged for an unrecognized mime type', () => {
    const data = buildData([{ value: 1 }])
    expect(formatData(data, 'text/plain')).toBe(data)
  })
})

describe('generateFilename', () => {
  const location = { locationIdentifier: '1001' } as unknown as Location
  const start = new Date(2026, 3, 1, 8, 0, 0)
  const end = new Date(2026, 3, 2, 8, 0, 0)

  it('omits the end timestamp for raw data types', () => {
    const dataType: DataTypeOption = {
      name: 'eventLog',
      displayName: 'Event Log',
      fields: [],
      type: 'raw',
    }

    expect(generateFilename(location, dataType, start, end, 'csv')).toBe(
      '1001_eventLog_2026-04-01T08:00:00.csv'
    )
  })

  it('includes both start and end timestamps for aggregation data types', () => {
    const dataType: DataTypeOption = {
      name: 'Speed Volume',
      displayName: 'Speed Volume',
      fields: [],
      type: 'aggregation',
    }

    expect(generateFilename(location, dataType, start, end, 'json')).toBe(
      '1001_SpeedVolume_2026-04-01T08:00:00_2026-04-02T08:00:00.json'
    )
  })
})
