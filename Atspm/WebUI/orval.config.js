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
const stripApiV1Prefix = (spec) => ({
  ...spec,
  paths: Object.fromEntries(
    Object.entries(spec.paths ?? {}).map(([path, pathItem]) => [
      path.replace(/^\/api\/v1(?=\/|$)/, ''),
      pathItem,
    ])
  ),
})

module.exports = {
  config: {
    input: {
      target: './api-specs/config-spec.json',
      override: {
        transformer: stripApiV1Prefix,
      },
    },
    output: {
      workspace: './src/api/config',
      target: './config-api.ts',
      client: 'react-query',
      httpClient: 'axios',
      mock: false,
      templates: './orval-templates',
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
      mock: false,
      templates: './orval-templates',
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
      mock: false,
      templates: './orval-templates',
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
        transformer: stripApiV1Prefix,
      },
    },
    output: {
      workspace: './src/api/identity',
      target: './atspmAuthenticationApi.ts',
      client: 'react-query',
      httpClient: 'axios',
      mock: false,
      templates: './orval-templates',
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
      mock: false,
      templates: './orval-templates',
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
