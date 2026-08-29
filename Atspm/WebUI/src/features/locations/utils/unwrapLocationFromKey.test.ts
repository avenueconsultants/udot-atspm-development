// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - unwrapLocationFromKey.test.ts
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
import { location1001 } from '@/test/fixtures/config'
import { unwrapLocationFromKey } from './unwrapLocationFromKey'

describe('unwrapLocationFromKey', () => {
  it('returns the entity a current config API sends', () => {
    expect(unwrapLocationFromKey(location1001)).toBe(location1001)
  })

  it('takes the first item from the envelope older config APIs sent', () => {
    expect(unwrapLocationFromKey([location1001])).toBe(location1001)
  })

  it('has nothing to unwrap before the query resolves', () => {
    expect(unwrapLocationFromKey(undefined)).toBeUndefined()
    expect(unwrapLocationFromKey([])).toBeUndefined()
  })
})
