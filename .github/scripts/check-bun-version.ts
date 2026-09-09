/**
 * Tell the developer, at install time, that they are not on the pinned Bun.
 *
 * `engines.bun` names one exact version because Bun's lockfile format and its
 * resolver both move between releases. Installing with a different one does not
 * fail - it quietly produces a different `bun.lock`. On a clean checkout of
 * this repository, Bun 1.3.14 rewrote the lockfile the pinned 1.4.1 had
 * written: `lockfileVersion` 2 down to 1, and three packages resolved to
 * different versions, `@types/node` 26.5.0 down to 22.20.2 among them. That
 * last one changes what typechecks.
 *
 * This only warns. It cannot prevent the rewrite - Bun writes the lockfile
 * whether or not `preinstall` succeeds, which is worth knowing before anyone
 * tries to make this a hard gate - so the useful thing it can do is say what
 * happened and how to undo it, at the moment it happens, rather than leaving it
 * to `check-lockfile-version.ts` in CI several commits later.
 *
 * See stacksjs/stacks#2533.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'

/** The Bun this repository's lockfiles were written by. */
export function pinnedBunVersion(packageJson: string): string | null {
  const parsed = JSON.parse(packageJson) as { engines?: { bun?: string } }
  return parsed.engines?.bun ?? null
}

/**
 * Whether `running` is the pinned version.
 *
 * Deliberately an exact comparison rather than a range check: the pin is an
 * exact version, and "close enough" is what produces a lockfile nobody asked
 * for. A range would have accepted the 1.3.14 that caused this.
 */
export function isPinnedBun(running: string | undefined, pinned: string | null): boolean {
  if (!pinned || !running)
    return true // Nothing pinned, or not running under Bun: not this check's business.
  return running === pinned
}

/** What to print when they differ. Exported so the test asserts on the real text. */
export function mismatchWarning(running: string, pinned: string): string {
  return `\n⚠ Bun ${running} is not the pinned ${pinned} (engines.bun).\n`
    + `\n`
    + `  Installing with another Bun rewrites bun.lock: a different lockfileVersion,\n`
    + `  and packages resolved to different versions than the pinned toolchain picked.\n`
    + `  It has already been written by the time you read this.\n`
    + `\n`
    + `  If bun.lock changed and you did not mean it to:\n`
    + `\n`
    + `    git checkout -- bun.lock\n`
    + `\n`
    + `  The pinned Bun is already in this checkout - pantry provisions it. Use it:\n`
    + `\n`
    + `    ./pantry/.bin/bun install\n`
    + `\n`
    + `  (\`pantry install\` puts it there if pantry/ is missing.)\n`
}

if (import.meta.main) {
  const packageJson = readFileSync(resolve(import.meta.dir, '..', '..', 'package.json'), 'utf8')
  const pinned = pinnedBunVersion(packageJson)
  const running = process.versions.bun

  if (!isPinnedBun(running, pinned))
    console.warn(mismatchWarning(running!, pinned!))
}
