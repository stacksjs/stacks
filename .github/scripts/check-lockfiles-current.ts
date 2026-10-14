/**
 * Whether an install changed a committed lockfile.
 *
 * A committed lockfile should survive an install of the tree it describes.
 * When it does not, it was written against a different tree and everything
 * downstream resolves something other than what was reviewed.
 *
 * `pantry.lock` cannot quite meet that bar, and the reason is not staleness.
 * Its `packages` map holds the resolved transitive closure of the system
 * dependencies, and that closure is platform-specific: a Linux runner pulls a
 * GCC toolchain (binutils, libstdc++, gmp, mpfr, mpc, libiconv and an older
 * gettext) that macOS never needs, because the system compiler serves there
 * instead. The file is written on whichever platform the person regenerating
 * it uses, so a strict comparison can only pass on that one, and it had the
 * compile job red for days (stacksjs/stacks#2899).
 *
 * So an addition to `packages` is tolerated, and reported, while everything
 * the platform cannot explain still fails:
 *
 * - a REMOVED package, or one whose resolution CHANGED. No platform resolves
 *   a package the committed file does not, and neither resolves it to a
 *   different version.
 * - a change anywhere OUTSIDE `packages`: the declared dependencies and the
 *   format are the same on every platform.
 * - an added package that a workspace DECLARES. That is the case this guard
 *   exists for: somebody added a system dependency and did not commit the
 *   lockfile, and the install is filling it in. A transitive closure entry is
 *   declared by nobody, which is exactly what separates the two.
 *
 * `bun.lock` stays strict. Bun records every platform's optional packages in
 * one lockfile, and the Linux install leaves it untouched.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export interface LockfileDrift {
  /** Packages the install resolved that the committed file does not hold. */
  added: string[]
  /** Packages the committed file holds that the install did not resolve. */
  removed: string[]
  /** Packages resolved differently than the committed file records. */
  changed: string[]
  /** Of `added`, the ones a workspace declares directly rather than inherits. */
  declaredAdded: string[]
  /** Whether anything outside the `packages` map differs. */
  outsidePackages: boolean
}

interface PantryLock {
  workspaces?: Record<string, { system?: Record<string, string> }>
  packages?: Record<string, unknown>
}

/** The system dependencies a workspace names for itself, by package name. */
export function declaredSystemDependencies(lock: PantryLock): Set<string> {
  const declared = new Set<string>()
  for (const workspace of Object.values(lock.workspaces ?? {})) {
    for (const name of Object.keys(workspace.system ?? {}))
      declared.add(name)
  }
  return declared
}

/** The package name in a `name@version` key, which may itself hold slashes. */
export function packageName(key: string): string {
  const at = key.lastIndexOf('@')
  return at > 0 ? key.slice(0, at) : key
}

/** How the installed `pantry.lock` differs from the committed one. */
export function pantryLockDrift(committed: string, current: string): LockfileDrift {
  const before = JSON.parse(committed) as PantryLock
  const after = JSON.parse(current) as PantryLock
  const beforePackages = before.packages ?? {}
  const afterPackages = after.packages ?? {}

  const frame = (lock: PantryLock): string => {
    const { packages: _packages, ...rest } = lock
    return JSON.stringify(rest)
  }

  const declared = declaredSystemDependencies(after)
  const added = Object.keys(afterPackages).filter(key => !(key in beforePackages)).sort()

  return {
    added,
    removed: Object.keys(beforePackages).filter(key => !(key in afterPackages)).sort(),
    changed: Object.keys(beforePackages)
      .filter(key => key in afterPackages && JSON.stringify(beforePackages[key]) !== JSON.stringify(afterPackages[key]))
      .sort(),
    declaredAdded: added.filter(key => declared.has(packageName(key))),
    outsidePackages: frame(before) !== frame(after),
  }
}

/** Whether a platform difference is the whole of it. */
export function driftIsPlatformOnly(drift: LockfileDrift): boolean {
  return drift.removed.length === 0
    && drift.changed.length === 0
    && drift.declaredAdded.length === 0
    && !drift.outsidePackages
}

const REMEDIATION = 'Run `./pantry/.bin/bun install` - the pinned Bun (engines.bun) - and `pantry install`, then commit the result.'

if (import.meta.main) {
  const root = resolve(import.meta.dir, '..', '..')
  const committedCopy = (path: string): string => {
    const shown = Bun.spawnSync(['git', 'show', `HEAD:${path}`], { cwd: root, stdout: 'pipe', stderr: 'pipe' })
    if (shown.exitCode !== 0)
      throw new Error(`could not read HEAD:${path}: ${shown.stderr.toString().trim()}`)
    return shown.stdout.toString()
  }

  let failed = false

  const bunCommitted = committedCopy('bun.lock')
  const bunCurrent = readFileSync(resolve(root, 'bun.lock'), 'utf8')
  if (bunCommitted === bunCurrent) {
    console.log('✓ bun.lock survived the install')
  }
  else {
    failed = true
    console.error(`::error::Installing changed bun.lock. A committed lockfile must survive an install of the tree it describes. ${REMEDIATION}`)
  }

  const pantryCommitted = committedCopy('pantry.lock')
  const pantryCurrent = readFileSync(resolve(root, 'pantry.lock'), 'utf8')
  if (pantryCommitted === pantryCurrent) {
    console.log('✓ pantry.lock survived the install')
  }
  else {
    const drift = pantryLockDrift(pantryCommitted, pantryCurrent)

    if (driftIsPlatformOnly(drift)) {
      console.log(`✓ pantry.lock gained ${drift.added.length} package(s) this platform resolves and the committed file does not, which is the transitive closure differing:`)
      for (const key of drift.added)
        console.log(`    + ${key}`)
      console.log('  Nothing was removed, nothing resolved differently, and nothing a workspace declares is missing.')
    }
    else {
      failed = true
      const why = [
        drift.removed.length > 0 ? `removed: ${drift.removed.join(', ')}` : '',
        drift.changed.length > 0 ? `resolved differently: ${drift.changed.join(', ')}` : '',
        drift.declaredAdded.length > 0 ? `declared but absent from the lockfile: ${drift.declaredAdded.join(', ')}` : '',
        drift.outsidePackages ? 'the declared dependencies or the lockfile format changed' : '',
      ].filter(Boolean).join('; ')
      console.error(`::error::Installing changed pantry.lock in a way no platform difference explains (${why}). ${REMEDIATION}`)
    }
  }

  if (failed) {
    const diff = Bun.spawnSync(['git', 'diff', '--', 'bun.lock', 'pantry.lock'], { cwd: root, stdout: 'pipe', stderr: 'pipe' })
    console.error(diff.stdout.toString())
    process.exit(1)
  }
}
