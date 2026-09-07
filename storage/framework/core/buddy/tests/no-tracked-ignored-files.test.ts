import { describe, expect, it } from 'bun:test'
import { join } from 'node:path'

/**
 * Nothing this repository's `.gitignore` names is tracked.
 *
 * An ignore rule does not apply to a file already in the index, so a rule added
 * after the file was committed reads as if it works and does nothing. Four such
 * files were in git: the router package's `stacks.sqlite` with its `-shm` and
 * `-wal` companions, the scheduler's runtime state, and a generated package
 * manifest - every one of them matched by a rule in `.gitignore`, and every one
 * rewritten whenever the code that owns it runs.
 *
 * The visible cost is a permanently dirty working tree, in a checkout that more
 * than one session commits from: `git add` of a neighbouring path sweeps 32KB of
 * SQLite shared-memory index into somebody's commit.
 *
 * Only this repository's own rules count. A contributor's
 * `~/.gitignore_global` is theirs - it ignores `*.sql` and `*.zip` on the
 * machine this was written on, and the migration corpus is committed on purpose.
 */
// The repository root, not the package this test lives in: `git ls-files` is
// scoped to its working directory, so running it from the package would check
// one twentieth of the tree and pass.
const root = join(import.meta.dir, '..', '..', '..', '..', '..')

describe('the git index', () => {
  it('holds no file that .gitignore excludes', async () => {
    const listed = Bun.spawnSync(['git', 'ls-files', '-c', '--ignored', '--exclude-standard'], {
      cwd: root,
      stdout: 'pipe',
      stderr: 'pipe',
    })
    expect(listed.exitCode).toBe(0)

    const candidates = listed.stdout.toString().split('\n').map(line => line.trim()).filter(Boolean)

    // One `check-ignore` for the whole list rather than one per file: from the
    // repository root there are a couple of hundred candidates, and a spawn
    // each is slower than the work being checked.
    const rules = Bun.spawnSync(['git', 'check-ignore', '--no-index', '-v', '--stdin'], {
      cwd: root,
      stdin: new TextEncoder().encode(`${candidates.join('\n')}\n`),
      stdout: 'pipe',
      stderr: 'pipe',
    })

    const offenders: string[] = []
    for (const line of rules.stdout.toString().split('\n')) {
      // `<source>:<line>:<pattern>\t<path>`
      const [origin, path] = [line.slice(0, line.indexOf('\t')), line.slice(line.indexOf('\t') + 1)]
      if (!path)
        continue

      // `--ignored` honours every source of rules, including the user's global
      // file. Keep only the ones this repository states itself.
      if (!origin.startsWith('.gitignore:'))
        continue

      // A `.gitignore` inside an ignored directory is how the directory itself
      // stays in the tree. That one is deliberate.
      if (path.endsWith('/.gitignore'))
        continue

      offenders.push(path)
    }

    expect(offenders.sort()).toEqual([])
  })
})
