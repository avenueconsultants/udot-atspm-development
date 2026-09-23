import { afterEach, expect, test } from '@jest/globals'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { syncApi } from './sync-api.mjs'

const projects = {
  ConfigApi: 'config',
  ReportApi: 'reports',
  DataApi: 'data',
  IdentityApi: 'identity',
}
const spec = (version) =>
  JSON.stringify({
    openapi: '3.0.1',
    info: { title: 'Fixture', version },
    paths: {
      '/example': { get: { responses: { 200: { description: 'OK' } } } },
    },
  })
const oldSpec = spec('old')
const newSpec = spec('new')
const temporaryRoot = resolve(tmpdir())
const fixtureRoots = []

afterEach(() => {
  for (const root of fixtureRoots.splice(0)) {
    expect(dirname(resolve(root))).toBe(temporaryRoot)
    rmSync(root, { recursive: true, force: true })
  }
})

function fixture() {
  const root = mkdtempSync(join(temporaryRoot, 'atspm-sync-test-'))
  fixtureRoots.push(root)
  const webRoot = join(root, 'WebUI')
  const orvalRoot = join(webRoot, 'node_modules', 'orval')
  mkdirSync(orvalRoot, { recursive: true })
  writeFileSync(join(webRoot, 'package.json'), '{}')
  writeFileSync(
    join(orvalRoot, 'package.json'),
    JSON.stringify({
      name: 'orval',
      bin: { orval: './cli.mjs' },
    })
  )
  writeFileSync(join(orvalRoot, 'cli.mjs'), '')
  mkdirSync(join(webRoot, 'api-specs'))
  writeFileSync(join(webRoot, 'api-specs', 'speed-spec.json'), oldSpec)
  for (const [project, name] of Object.entries(projects)) {
    mkdirSync(join(root, project))
    writeFileSync(join(root, project, name + '-spec.json'), oldSpec)
  }
  return { root, webRoot }
}

function exportSpec(args, cwd, content = newSpec) {
  const prefix = '-property:SwaggerSpecOutputDir='
  const directory = args
    .find((arg) => arg.startsWith(prefix))
    .slice(prefix.length)
  writeFileSync(
    join(directory, projects[basename(cwd)] + '-spec.json'),
    content
  )
  return directory
}

function expectSavedSpecs(root, expected) {
  for (const [project, name] of Object.entries(projects)) {
    expect(readFileSync(join(root, project, name + '-spec.json'), 'utf8')).toBe(
      expected
    )
  }
}

test('publishes all four fresh exports before generating clients and cleans staging', () => {
  const { root, webRoot } = fixture()
  const exported = []
  let directory
  let orvalRan = false
  syncApi({
    webRoot,
    run(command, args, cwd) {
      if (command === 'dotnet') {
        expectSavedSpecs(root, oldSpec)
        exported.push(basename(cwd))
        directory = exportSpec(args, cwd)
      } else {
        expect(command).toBe(process.execPath)
        expect(cwd).toBe(webRoot)
        expectSavedSpecs(root, newSpec)
        expect(exported).toHaveLength(4)
        orvalRan = true
      }
    },
  })
  expect(exported).toEqual(Object.keys(projects))
  expect(orvalRan).toBe(true)
  expect(existsSync(directory)).toBe(false)
  expect(
    readFileSync(join(webRoot, 'api-specs', 'speed-spec.json'), 'utf8')
  ).toBe(oldSpec)
})

test('a later backend failure leaves every saved spec intact and skips Orval', () => {
  const { root, webRoot } = fixture()
  let directory
  expect(() =>
    syncApi({
      webRoot,
      run(command, args, cwd) {
        expect(command).toBe('dotnet')
        if (basename(cwd) === 'ReportApi') throw new Error('export failed')
        directory = exportSpec(args, cwd)
      },
    })
  ).toThrow(/export failed/)
  expectSavedSpecs(root, oldSpec)
  expect(existsSync(directory)).toBe(false)
})

test.each(['missing', 'invalid JSON', 'empty paths'])(
  'rejects %s from an exporter that reports success',
  (mode) => {
    const { root, webRoot } = fixture()
    let exports = 0
    expect(() =>
      syncApi({
        webRoot,
        run(command, args, cwd) {
          expect(command).toBe('dotnet')
          exports++
          if (mode === 'invalid JSON') exportSpec(args, cwd, '{')
          if (mode === 'empty paths')
            exportSpec(args, cwd, '{"openapi":"3.0.1","paths":{}}')
        },
      })
    ).toThrow()
    expect(exports).toBe(1)
    expectSavedSpecs(root, oldSpec)
  }
)

test('client generation failure is propagated and temporary exports are cleaned', () => {
  const { root, webRoot } = fixture()
  let directory
  expect(() =>
    syncApi({
      webRoot,
      run(command, args, cwd) {
        if (command === 'dotnet') directory = exportSpec(args, cwd)
        else throw new Error('client generation failed')
      },
    })
  ).toThrow(/client generation failed/)
  expectSavedSpecs(root, newSpec)
  expect(existsSync(directory)).toBe(false)
})
