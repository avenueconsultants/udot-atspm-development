import { spawnSync } from 'node:child_process'
import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptPath = fileURLToPath(import.meta.url)
const defaultWebRoot = resolve(dirname(scriptPath), '..')
const apis = [
  { project: 'ConfigApi', spec: 'config' },
  { project: 'ReportApi', spec: 'reports' },
  { project: 'DataApi', spec: 'data' },
  { project: 'IdentityApi', spec: 'identity' },
]

function runCommand(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(
      command + ' failed (' + (result.signal ?? 'exit ' + result.status) + ').'
    )
  }
}

function validateSpec(path) {
  const spec = JSON.parse(readFileSync(path, 'utf8'))
  if (
    !(typeof spec.openapi === 'string' || spec.swagger === '2.0') ||
    !spec.paths ||
    typeof spec.paths !== 'object' ||
    Array.isArray(spec.paths) ||
    Object.keys(spec.paths).length === 0
  ) {
    throw new Error('No OpenAPI paths were exported to ' + path + '.')
  }
}

export function syncApi({ webRoot = defaultWebRoot, run = runCommand } = {}) {
  const apiRoot = resolve(webRoot, '..')
  let orvalCli
  try {
    const require = createRequire(join(webRoot, 'package.json'))
    const packagePath = require.resolve('orval/package.json')
    const orvalPackage = JSON.parse(readFileSync(packagePath, 'utf8'))
    orvalCli = resolve(dirname(packagePath), orvalPackage.bin.orval)
    if (!existsSync(orvalCli)) throw new Error('Orval CLI is missing.')
  } catch (error) {
    throw new Error(
      'Install WebUI dependencies with npm ci before syncing APIs.',
      {
        cause: error,
      }
    )
  }

  // Speed Management is maintained separately; its committed spec is an input.
  validateSpec(join(webRoot, 'api-specs', 'speed-spec.json'))

  console.log('Restoring the pinned Swagger CLI...')
  run(
    'dotnet',
    [
      'tool',
      'restore',
      '--tool-manifest',
      join(apiRoot, '.config', 'dotnet-tools.json'),
    ],
    apiRoot
  )

  const temporaryRoot = resolve(tmpdir())
  const exportDirectory = mkdtempSync(join(temporaryRoot, 'atspm-api-sync-'))
  try {
    for (const { project, spec } of apis) {
      console.log('Building and exporting ' + project + '...')
      // Each project's directory determines its appsettings files during startup.
      run(
        'dotnet',
        [
          'msbuild',
          project + '.csproj',
          '-restore',
          '-target:ExportSwaggerSpec',
          '-property:Configuration=Debug',
          '-property:SwaggerSpecOutputDir=' + exportDirectory,
          '-verbosity:minimal',
        ],
        join(apiRoot, project)
      )
      // Never let a missing/empty export reuse an old spec.
      validateSpec(join(exportDirectory, spec + '-spec.json'))
    }

    // Publish specs only once every backend has built and exported successfully.
    for (const { project, spec } of apis) {
      copyFileSync(
        join(exportDirectory, spec + '-spec.json'),
        join(apiRoot, project, spec + '-spec.json')
      )
    }

    console.log('Generating the frontend clients with Orval...')
    // Invoke the CLI with Node so Windows does not need a shell/.cmd shim.
    run(process.execPath, [orvalCli, '--config', 'orval.config.js'], webRoot)
    console.log(
      'API sync complete. Review and commit the specs and src/api changes.'
    )
  } finally {
    if (dirname(resolve(exportDirectory)) !== temporaryRoot) {
      throw new Error(
        'Refusing to remove an export directory outside the temporary directory.'
      )
    }
    rmSync(exportDirectory, { recursive: true, force: true })
  }
}

if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  try {
    syncApi()
  } catch (error) {
    console.error('API sync failed:', error.message)
    process.exitCode = 1
  }
}
