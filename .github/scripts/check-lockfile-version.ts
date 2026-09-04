/**
 * Guard against a `bun.lock` written by a newer Bun than CI runs.
 *
 * Pantry provisions the exact Bun version declared by this repository. This
 * guard keeps a lockfile written by another runtime from reaching CI, where
 * every install would otherwise fail with an opaque lockfile error.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/** The lockfile format written by the Pantry-pinned Bun 1.4.1 toolchain. */
export const EXPECTED_LOCKFILE_VERSION = 2

/** Parse the `lockfileVersion` from bun.lock text, or null if absent. */
export function lockfileVersion(contents: string): number | null {
  const match = contents.match(/"lockfileVersion"\s*:\s*(\d+)/)
  return match ? Number(match[1]) : null
}

if (import.meta.main) {
  const path = resolve(import.meta.dir, '..', '..', 'bun.lock')
  const version = lockfileVersion(readFileSync(path, 'utf8'))

  if (version === EXPECTED_LOCKFILE_VERSION) {
    console.log(`✓ bun.lock is lockfileVersion ${version}`)
  }
  else {
    console.error(
      `✗ bun.lock is lockfileVersion ${version ?? 'unknown'}, but Pantry and \`engines.bun\` pin Bun 1.4.1, which writes v${EXPECTED_LOCKFILE_VERSION}.\n`
      + `\n`
      + `  Install the declared toolchain and regenerate the lockfile through Pantry:\n`
      + `\n`
      + `    pantry install\n`
      + `    bun install\n`
      + `\n`
      + `  Then commit bun.lock and pantry.lock together.`,
    )
    process.exit(1)
  }
}
