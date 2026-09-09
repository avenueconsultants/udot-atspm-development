// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - checkDetectors.test.ts
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
import { hasUniqueDetectorChannels } from './checkDetectors'

describe('hasUniqueDetectorChannels', () => {
  it('is valid when every detector has a distinct channel', () => {
    const result = hasUniqueDetectorChannels(
      new Map([
        [1, 1],
        [2, 2],
        [3, 3],
      ])
    )

    expect(result.isValid).toBe(true)
    expect(result.errors).toEqual({})
  })

  it('flags every detector that shares a duplicated channel', () => {
    const result = hasUniqueDetectorChannels(
      new Map([
        [1, 5],
        [2, 5],
        [3, 6],
      ])
    )

    expect(result.isValid).toBe(false)
    expect(Object.keys(result.errors).sort()).toEqual(['1', '2'])
    expect(result.errors['1']).toEqual({
      error: 'Duplicate detector channel',
      id: '1',
    })
  })

  it('ignores 0, null, and undefined channels when checking for duplicates', () => {
    const result = hasUniqueDetectorChannels(
      new Map<number, number>([
        [1, 0],
        [2, 0],
        [3, null as unknown as number],
        [4, undefined as unknown as number],
      ])
    )

    expect(result.isValid).toBe(true)
    expect(result.errors).toEqual({})
  })

  it('is valid for an empty map', () => {
    const result = hasUniqueDetectorChannels(new Map())
    expect(result.isValid).toBe(true)
    expect(result.errors).toEqual({})
  })
})
