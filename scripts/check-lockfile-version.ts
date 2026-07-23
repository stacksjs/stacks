/**
 * Guard against a `bun.lock` written by a newer Bun than CI runs.
 *
 * CI provisions Bun 1.3.x (the repo's `engines: bun ^1.3.0`), which reads
 * `lockfileVersion: 1`. Bun 1.4.x writes `lockfileVersion: 2`, which 1.3.x
 * cannot parse — every job then dies at `bun install --frozen-lockfile` with a
 * cryptic `Unknown lockfile version`. This runs before install and fails fast
 * with an actionable message so the fix is obvious.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/** The lockfile format CI's Bun understands. Bump if the toolchain moves to 1.4.x. */
export const EXPECTED_LOCKFILE_VERSION = 1

/** Parse the `lockfileVersion` from bun.lock text, or null if absent. */
export function lockfileVersion(contents: string): number | null {
  const match = contents.match(/"lockfileVersion"\s*:\s*(\d+)/)
  return match ? Number(match[1]) : null
}

if (import.meta.main) {
  const path = resolve(import.meta.dir, '..', 'bun.lock')
  const version = lockfileVersion(readFileSync(path, 'utf8'))

  if (version === EXPECTED_LOCKFILE_VERSION) {
    console.log(`✓ bun.lock is lockfileVersion ${version}`)
  }
  else {
    console.error(
      `✗ bun.lock is lockfileVersion ${version ?? 'unknown'}, but CI's Bun (1.3.x — the repo's \`engines\`) reads v${EXPECTED_LOCKFILE_VERSION}.\n`
      + `\n`
      + `  This happens when \`bun install\` runs on Bun 1.4.x, which writes v2 that 1.3.x can't parse\n`
      + `  ("Unknown lockfile version" at install). Regenerate the lockfile with stable Bun:\n`
      + `\n`
      + `    bunx bun@1.3.14 install\n`
      + `\n`
      + `  ...then commit bun.lock. (Or, to move the whole toolchain to 1.4.x, bump CI's Bun +\n`
      + `  \`engines\` and set EXPECTED_LOCKFILE_VERSION here to 2.)`,
    )
    process.exit(1)
  }
}
