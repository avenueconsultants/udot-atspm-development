import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const cwd = fileURLToPath(new URL('..', import.meta.url))
function git(args, allowedStatuses = [0]) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' })
  if (result.error || !allowedStatuses.includes(result.status)) {
    console.error(
      'Unable to check generated clients:',
      result.error ?? result.stderr
    )
    process.exit(1)
  }
  return result
}

// Compare content to HEAD to include staged changes while respecting Git's
// line-ending normalization. New tag files also need an explicit check:
// git diff does not include untracked files.
const diff = git(
  ['diff', '--exit-code', '--stat', 'HEAD', '--', 'src/api'],
  [0, 1]
)
const untracked = git([
  'ls-files',
  '--others',
  '--exclude-standard',
  '--',
  'src/api',
])
if (diff.status !== 0 || untracked.stdout.trim()) {
  console.error(diff.stdout + untracked.stdout)
  console.error(
    'Generated clients differ from the commit. Regenerate and commit src/api.'
  )
  process.exit(1)
}

console.log('Generated clients match the commit.')
