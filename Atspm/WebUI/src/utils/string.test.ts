// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - string.test.ts
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
import { addSpaces } from './string'

describe('addSpaces', () => {
  it('puts a space before each capital that starts a word', () => {
    expect(addSpaces('myVariableName')).toBe('my Variable Name')
    expect(addSpaces('helloWorld')).toBe('hello World')
    expect(addSpaces('HelloWorld')).toBe('Hello World')
  })

  it('keeps an acronym together and separates it from the word that follows', () => {
    expect(addSpaces('ALLCAPS')).toBe('ALLCAPS')
    expect(addSpaces('ABCFoo')).toBe('ABC Foo')
    expect(addSpaces('ReportApi')).toBe('Report Api')
  })

  it('separates a capital from a preceding digit', () => {
    expect(addSpaces('speed85thPercentile')).toBe('speed85th Percentile')
  })

  it('leaves strings with no capitals unchanged', () => {
    expect(addSpaces('lowercase')).toBe('lowercase')
  })

  it('returns falsy input unchanged', () => {
    expect(addSpaces('')).toBe('')
    expect(addSpaces(null as unknown as string)).toBeNull()
  })
})
