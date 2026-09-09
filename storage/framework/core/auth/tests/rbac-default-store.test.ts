/**
 * RBAC works without anyone wiring a store.
 *
 * stacksjs/stacks#2563: `setRbacStore()` is called from exactly one place,
 * `defaults/bootstrap.ts`, which the route loader imports only when default
 * routes are being loaded. So `STACKS_SKIP_DEFAULT_ROUTES=1` - the documented
 * escape hatch for apps that do not ship every framework model - also
 * disabled the RBAC *service*, and every `hasRole()` / `role:` guard answered
 * `RBAC store not configured. Call setRbacStore() first.`
 *
 * `getStore()` now installs the query-builder-backed store the first time one
 * is needed, so registration is opt-out rather than opt-in and the bootstrap's
 * call is an optimisation rather than a prerequisite.
 *
 * Runs in a subprocess on purpose: the store is module-level state, and a
 * sibling test file that calls `setRbacStore()` with a double would otherwise
 * satisfy this one for the wrong reason.
 */

import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'

const RBAC_MODULE = join(import.meta.dir, '../src/rbac.ts')

const PROBE = `
const { findRole } = await import(${JSON.stringify(RBAC_MODULE)})
try {
  await findRole('a-role-that-does-not-exist')
  console.log('PROBE:resolved')
}
catch (error) {
  console.log('PROBE:' + (error instanceof Error ? error.message : String(error)))
}
`

function probe(): string {
  const proc = Bun.spawnSync(['bun', '-e', PROBE], {
    // The flag is the whole point: this is the configuration in which the
    // bootstrap that used to be the only caller of setRbacStore() never runs.
    env: { ...process.env, STACKS_SKIP_DEFAULT_ROUTES: '1' },
    stderr: 'pipe',
    stdout: 'pipe',
  })

  const line = proc.stdout.toString().split('\n').find(l => l.startsWith('PROBE:'))

  return line ?? `PROBE:no output (stderr: ${proc.stderr.toString().slice(0, 400)})`
}

describe('RBAC default store', () => {
  test('an RBAC call with no setRbacStore() resolves a store', () => {
    const result = probe()

    // The call may still fail on the environment - no database file, no
    // `roles` table - and that is fine here. What must never come back is the
    // store itself being missing, which is the #2563 failure.
    expect(result).not.toMatch(/store not configured/i)
    expect(result).not.toMatch(/setRbacStore/)
    expect(result).not.toMatch(/undefined is not an object|Cannot read propert/i)
    expect(result).toStartWith('PROBE:')
  })
})
