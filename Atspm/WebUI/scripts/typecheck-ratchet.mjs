// Runs `tsc --noEmit` and fails when the error count rises above the number
// recorded in typecheck-baseline.json. `next build` is configured with
// ignoreBuildErrors, so without this nothing stops the count from growing;
// with it, the count can only go down. Run with --update after fixing errors
// to lower the baseline.
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const baselinePath = fileURLToPath(
  new URL('../typecheck-baseline.json', import.meta.url)
)
const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'))

// TypeScript's own CLI entry, run in-process by node: no shell, no
// platform-specific `npx` lookup.
const tscBin = createRequire(import.meta.url).resolve('typescript/bin/tsc')
const tsc = spawnSync(
  process.execPath,
  [tscBin, '--noEmit', '-p', 'tsconfig.json'],
  { encoding: 'utf8' }
)
const output = `${tsc.stdout ?? ''}${tsc.stderr ?? ''}`
const errors = output.match(/error TS\d+:/g)?.length ?? 0

if (errors > baseline.errors) {
  console.error(output)
  console.error(
    `\ntsc reported ${errors} errors; the baseline is ${baseline.errors}. ` +
      'Fix the new errors - the baseline only ever moves down.'
  )
  process.exit(1)
}

if (errors < baseline.errors) {
  if (process.argv.includes('--update')) {
    writeFileSync(
      baselinePath,
      JSON.stringify({ ...baseline, errors }, null, 2) + '\n'
    )
    console.log(`Baseline lowered from ${baseline.errors} to ${errors}.`)
  } else {
    console.log(
      `tsc reported ${errors} errors, below the baseline of ${baseline.errors}. ` +
        'Run `npm run typecheck:ratchet -- --update` to lock in the improvement.'
    )
  }
} else {
  console.log(`tsc reported ${errors} errors, matching the baseline.`)
}
