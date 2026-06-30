// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - add-orval-license-header.js
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
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require('fs')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')

const defaultTargets = [
  path.join(projectRoot, 'src', 'api', 'config'),
  path.join(projectRoot, 'src', 'api', 'reports'),
  path.join(projectRoot, 'src', 'api', 'data'),
]

const licenseRegionPattern =
  /^\/\/ #region license\r?\n(?:\/\/[^\r\n]*\r?\n)*\/\/ #endregion\r?\n(?:\r?\n)?/

const getLicenseHeader = (fileName) => `// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - ${fileName}
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
`

const isTypeScriptFile = (filePath) =>
  filePath.endsWith('.ts') || filePath.endsWith('.tsx')

const collectFiles = (targetPath) => {
  if (!fs.existsSync(targetPath)) {
    return []
  }

  const stat = fs.statSync(targetPath)

  if (stat.isFile()) {
    return isTypeScriptFile(targetPath) ? [targetPath] : []
  }

  if (!stat.isDirectory()) {
    return []
  }

  return fs.readdirSync(targetPath, { withFileTypes: true }).flatMap((entry) =>
    collectFiles(path.join(targetPath, entry.name))
  )
}

const addLicenseHeader = (filePath) => {
  const source = fs.readFileSync(filePath, 'utf8')
  const body = source.replace(licenseRegionPattern, '')
  const nextSource = `${getLicenseHeader(path.basename(filePath))}\n${body}`

  if (nextSource !== source) {
    fs.writeFileSync(filePath, nextSource)
  }
}

const targets = process.argv.slice(2)
const files = (targets.length > 0 ? targets : defaultTargets).flatMap(
  collectFiles
)

files.forEach(addLicenseHeader)