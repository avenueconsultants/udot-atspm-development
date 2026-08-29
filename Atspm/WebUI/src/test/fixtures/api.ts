// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - test/fixtures/api.ts
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

// The base URLs jest.setup.ts hands initializeAxiosInstances, so a handler
// can name the exact URL a generated hook will request. The config and
// identity instances bake in /api/v1 (their generated paths have it
// stripped); the others don't (their generated paths include it).
export const CONFIG_API = 'http://localhost/config/api/v1'
export const IDENTITY_API = 'http://localhost/identity/api/v1'
export const REPORTS_API = 'http://localhost/reports/api/v1'
export const DATA_API = 'http://localhost/data/api/v1'

// The config API is OData. Collections arrive wrapped in an envelope, a
// keyed GET returns the bare entity with only the context link added, and a
// missing key is a 404 whose body is the key. Recorded from ConfigApi running
// against a seeded in-memory database.
export const odataCollection = <T>(entitySet: string, value: T[]) => ({
  '@odata.context': `${CONFIG_API}/$metadata#${entitySet}`,
  value,
})

export const odataEntity = <T extends object>(
  entitySet: string,
  entity: T
) => ({
  '@odata.context': `${CONFIG_API}/$metadata#${entitySet}/$entity`,
  ...entity,
})

export const odataNotFound = (key: number) => ({
  '@odata.context': `${CONFIG_API}/$metadata#Edm.Int32`,
  value: key,
})
