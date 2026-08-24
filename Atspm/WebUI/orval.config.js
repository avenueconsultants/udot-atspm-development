// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - orval.config.js
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

// configAxios and identityAxios (src/lib/axios.ts) already bake `/api/v1` into
// their base URL, so paths generated from the (accurate) spec - which include
// `/api/v1` themselves - would otherwise double up. Strip that leading segment
// here rather than changing the shared axios base URLs, since ~90 hand-written
// call sites elsewhere still assume the baked-in prefix.
const stripApiV1PrefixFromPaths = (paths) =>
  Object.fromEntries(
    Object.entries(paths ?? {}).map(([path, pathItem]) => [
      path.replace(/^\/api\/v1(?=\/|$)/, ''),
      pathItem,
    ])
  )

// OData/Swashbuckle declares a large set of content-type variants per
// response, including "application/octet-stream" as a generic fallback -
// present on every collection endpoint here, not just genuine file/binary
// ones. Orval treats octet-stream/pdf/zip as binary and sets
// responseType: 'blob' on the whole operation when any is present, which
// would make axios hand back a raw Blob instead of parsing the JSON these
// endpoints actually return (config/identity have no real file-download
// endpoints, so this is always the boilerplate case here). Drop just those
// three from response content maps; every other declared content type
// (the many application/json variants, xml, text/plain) is left alone.
const BINARY_CONTENT_TYPES = new Set([
  'application/octet-stream',
  'application/pdf',
  'application/zip',
])

const stripBoilerplateBinaryContentTypes = (paths) => {
  for (const pathItem of Object.values(paths ?? {})) {
    for (const operation of Object.values(pathItem ?? {})) {
      if (!operation || typeof operation !== 'object' || !operation.responses) {
        continue
      }
      for (const response of Object.values(operation.responses)) {
        if (!response?.content) continue
        for (const contentType of Object.keys(response.content)) {
          if (BINARY_CONTENT_TYPES.has(contentType.split(';')[0].trim())) {
            delete response.content[contentType]
          }
        }
      }
    }
  }
  return paths
}

// The route editor must send explicit nulls to clear distance navigation
// properties. The server accepts null for these fields, but the generated
// OpenAPI document currently omits that nullability metadata.
const restoreNullableRouteDistances = (spec) => {
  const routeLocationDto = spec.components?.schemas?.RouteLocationDto
  const distanceProperties = [
    'previousLocationDistance',
    'nextLocationDistance',
  ]

  for (const propertyName of distanceProperties) {
    const property = routeLocationDto?.properties?.[propertyName]
    if (property) property.nullable = true
  }

  return spec
}

const sanitizeSpec = (inputSpec) => {
  const spec = restoreNullableRouteDistances(inputSpec)

  return {
    ...spec,
    paths: stripBoilerplateBinaryContentTypes(
      stripApiV1PrefixFromPaths(spec.paths)
    ),
  }
}

module.exports = {
  config: {
    input: {
      target: './api-specs/config-spec.json',
      override: {
        transformer: sanitizeSpec,
      },
    },
    output: {
      workspace: './src/api/config',
      target: './config-api.ts',
      client: 'react-query',
      httpClient: 'axios',
      mock: true,
      mode: 'tags-split',
      override: {
        mutator: {
          path: '../../lib/axios.ts',
          name: 'configRequest',
        },
      },
    },
  },
  reports: {
    input: {
      target: './api-specs/reports-spec.json',
    },
    output: {
      workspace: './src/api/reports',
      target: './report-api.ts',
      client: 'react-query',
      httpClient: 'axios',
      mock: true,
      mode: 'tags-split',
      override: {
        mutator: {
          path: '../../lib/axios.ts',
          name: 'reportsRequest',
        },
      },
    },
  },
  data: {
    input: {
      target: './api-specs/data-spec.json',
    },
    output: {
      workspace: './src/api/data',
      target: './data-api.ts',
      client: 'react-query',
      httpClient: 'axios',
      mock: true,
      mode: 'tags-split',
      override: {
        mutator: {
          path: '../../lib/axios.ts',
          name: 'dataRequest',
        },
      },
    },
  },
  identity: {
    input: {
      target: './api-specs/identity-spec.json',
      override: {
        transformer: sanitizeSpec,
      },
    },
    output: {
      workspace: './src/api/identity',
      target: './atspmAuthenticationApi.ts',
      client: 'react-query',
      httpClient: 'axios',
      mock: true,
      mode: 'split',
      override: {
        mutator: {
          path: '../../lib/axios.ts',
          name: 'identityRequest',
        },
      },
    },
  },
  speedManagement: {
    input: {
      target: './api-specs/speed-spec.json',
    },
    output: {
      workspace: './src/api/speedManagement',
      target: './aTSPMSpeedManagementApi.ts',
      client: 'react-query',
      httpClient: 'axios',
      mock: true,
      mode: 'split',
      override: {
        mutator: {
          path: '../../lib/axios.ts',
          name: 'speedRequest',
        },
      },
    },
  },
}
