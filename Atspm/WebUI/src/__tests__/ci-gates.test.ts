import { spawnSync } from 'node:child_process'
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'

let workspace: string

beforeEach(() => {
  workspace = mkdtempSync(join(tmpdir(), 'atspm-ci-gate-test-'))
  mkdirSync(join(workspace, 'scripts'))
})

afterEach(() => {
  // Delete only this test's freshly allocated temporary workspace.
  if (
    dirname(resolve(workspace)) !== resolve(tmpdir()) ||
    !basename(workspace).startsWith('atspm-ci-gate-test-')
  ) {
    throw new Error('Unexpected test workspace')
  }
  rmSync(workspace, { recursive: true, force: true })
})

function copyScript(name: string) {
  copyFileSync(resolve('scripts', name), join(workspace, 'scripts', name))
}

function runScript(name: string, args: string[] = []) {
  return spawnSync(process.execPath, [join('scripts', name), ...args], {
    cwd: workspace,
    encoding: 'utf8',
    maxBuffer: 4 * 1024 * 1024,
  })
}

function fakeCompiler(program: string) {
  copyScript('typecheck-ratchet.mjs')
  writeFileSync(join(workspace, 'typecheck-baseline.json'), '{"errors":3}\n')
  const bin = join(workspace, 'node_modules', 'typescript', 'bin')
  mkdirSync(bin, { recursive: true })
  writeFileSync(join(bin, 'tsc'), program)
}

function baseline() {
  return JSON.parse(
    readFileSync(join(workspace, 'typecheck-baseline.json'), 'utf8')
  ).errors
}

describe('typecheck gate', () => {
  it.each([
    [
      'a compiler crash',
      "process.stderr.write('Compiler crashed'); process.exit(137)",
    ],
    ['an unexplained failure', 'process.exit(1)'],
    [
      'a configuration error',
      "console.log('error TS5058: The specified path does not exist: tsconfig.json'); process.exit(1)",
    ],
    [
      'truncated output',
      "process.stdout.write('app.ts(1,1): error TS2322: Example\\n' + 'x'.repeat(2_000_000))",
    ],
  ])('rejects %s without lowering the baseline', (_, program) => {
    fakeCompiler(program)

    const result = runScript('typecheck-ratchet.mjs', ['--update'])

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('TypeScript did not complete')
    expect(baseline()).toBe(3)
  })

  it('accepts existing diagnostics and can record a lower count', () => {
    fakeCompiler(
      "console.log('app.ts(1,1): error TS2322: Example'); process.exit(1)"
    )

    expect(runScript('typecheck-ratchet.mjs').status).toBe(0)
    expect(baseline()).toBe(3)
    expect(runScript('typecheck-ratchet.mjs', ['--update']).status).toBe(0)
    expect(baseline()).toBe(1)
  })

  it('rejects additional diagnostics', () => {
    fakeCompiler(
      "console.log('app.ts(1,1): error TS2322: Example\\n'.repeat(4)); process.exit(1)"
    )

    expect(runScript('typecheck-ratchet.mjs', ['--update']).status).toBe(1)
    expect(baseline()).toBe(3)
  })

  it('allows a successful compiler run to lower the baseline to zero', () => {
    fakeCompiler('process.exit(0)')

    expect(runScript('typecheck-ratchet.mjs', ['--update']).status).toBe(0)
    expect(baseline()).toBe(0)
  })
})

function git(...args: string[]) {
  const result = spawnSync('git', args, {
    cwd: workspace,
    encoding: 'utf8',
  })
  if (result.status !== 0) throw new Error(result.stderr)
}

describe('generated-client gate', () => {
  beforeEach(() => {
    copyScript('check-api.mjs')
    mkdirSync(join(workspace, 'src', 'api'), { recursive: true })
    writeFileSync(join(workspace, 'src', 'api', 'existing.ts'), 'export {}\n')
    git('init', '--quiet')
    git('add', '.')
    git(
      '-c',
      'user.name=CI gate test',
      '-c',
      'user.email=test@example.invalid',
      '-c',
      'core.hooksPath=/dev/null',
      '-c',
      'commit.gpgSign=false',
      'commit',
      '--quiet',
      '-m',
      'Fixture'
    )
  })

  it('accepts unchanged clients and ignores unrelated files', () => {
    writeFileSync(join(workspace, 'unrelated.txt'), 'not generated')
    expect(runScript('check-api.mjs').status).toBe(0)
  })

  it('accepts regenerated files whose only change is CRLF versus LF', () => {
    git('config', 'core.autocrlf', 'true')
    writeFileSync(join(workspace, 'src', 'api', 'existing.ts'), 'export {}\r\n')
    expect(runScript('check-api.mjs').status).toBe(0)
  })

  it('rejects an untracked generated tag file', () => {
    mkdirSync(join(workspace, 'src', 'api', 'new-tag'))
    writeFileSync(
      join(workspace, 'src', 'api', 'new-tag', 'new-tag.ts'),
      'export {}'
    )
    const result = runScript('check-api.mjs')
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('new-tag.ts')
  })

  it.each([false, true])(
    'rejects changes to an existing client (staged: %s)',
    (staged) => {
      writeFileSync(
        join(workspace, 'src', 'api', 'existing.ts'),
        'export const changed = true'
      )
      if (staged) git('add', 'src/api')
      expect(runScript('check-api.mjs').status).toBe(1)
    }
  )
})
