import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * `bun.lock` records the same dependency ranges the manifests declare.
 *
 * A commit that bumps a range without the lockfile that resolves it passes
 * every local check and then kills CI in its INSTALL step - `error: lockfile
 * had changes, but lockfile is frozen` - so typecheck, test, lint, compile,
 * scaffold-smoke and artifact-freshness all fail at once and none of them
 * fails for the reason it names. It happened with `bun-plugin-stx@^0.2.279`,
 * where two manifests moved and the lockfile still said `^0.2.274`.
 *
 * Comparing the recorded ranges catches it in the same test run everyone
 * already does before pushing, instead of in CI for everybody at once.
 */

const root = join(import.meta.dir, '..', '..', '..', '..', '..')

/** bun.lock is JSONC: trailing commas, otherwise JSON. */
function readLockfile(): any {
  const text = readFileSync(join(root, 'bun.lock'), 'utf8')
  return JSON.parse(text.replace(/,(\s*[}\]])/g, '$1'))
}

const FIELDS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'] as const

describe('bun.lock', () => {
  const lock = readLockfile()

  it('records the workspaces', () => {
    expect(Object.keys(lock.workspaces ?? {}).length).toBeGreaterThan(50)
  })

  it('records the same ranges the manifests declare', () => {
    const drift: string[] = []

    for (const [path, recorded] of Object.entries<any>(lock.workspaces ?? {})) {
      const manifestPath = join(root, path === '' ? '.' : path, 'package.json')
      let manifest: any
      try {
        manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
      }
      catch {
        drift.push(`${path}: bun.lock names a workspace with no package.json`)
        continue
      }

      for (const field of FIELDS) {
        const declared: Record<string, string> = manifest[field] ?? {}
        const inLock: Record<string, string> = recorded[field] ?? {}

        for (const [name, range] of Object.entries(declared)) {
          if (!(name in inLock))
            drift.push(`${path}: ${field}.${name} is declared but not in bun.lock`)
          else if (inLock[name] !== range)
            drift.push(`${path}: ${field}.${name} is '${range}' but bun.lock says '${inLock[name]}'`)
        }
        for (const name of Object.keys(inLock)) {
          if (!(name in declared))
            drift.push(`${path}: bun.lock records ${field}.${name}, which the manifest does not declare`)
        }
      }
    }

    expect(drift.sort()).toEqual([])
  })
})
