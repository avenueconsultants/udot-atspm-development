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
  it('inserts a space before a capital that follows a lowercase letter', () => {
    expect(addSpaces('myVariableName')).toBe('myVariable Name')
    expect(addSpaces('HelloWorld')).toBe('Hello World')
  })

  it('does not insert a space before the very first capital letter in the string', () => {
    // Quirk of the implementation: firstCapitalFound only starts being
    // enforced *after* the first capital is seen, so a single leading
    // capital-letter transition never gets a preceding space.
    expect(addSpaces('helloWorld')).toBe('helloWorld')
  })

  it('keeps a run of consecutive capitals together with no internal spaces', () => {
    expect(addSpaces('ALLCAPS')).toBe('ALLCAPS')
  })

  it('does not separate an acronym run from a following capitalized word', () => {
    // Another consequence of the same rule: because the letter right after
    // an acronym run is itself preceded by an uppercase letter, no space is
    // inserted at the acronym/word boundary.
    expect(addSpaces('ABCFoo')).toBe('ABCFoo')
  })

  it('leaves strings with no capitals unchanged', () => {
    expect(addSpaces('lowercase')).toBe('lowercase')
  })

  it('returns falsy input unchanged', () => {
    expect(addSpaces('')).toBe('')
    expect(addSpaces(null as unknown as string)).toBeNull()
  })
})
