/**
 * stacksjs/stacks#2560 - a failed post-install migrate must fail the install.
 *
 * `buddy setup` used to downgrade every migration failure to a warning and go
 * on to print "Project is setup" and exit 0, so a first install could complete,
 * report success, and leave a database with no schema. These pin the three
 * answers apart: migrated, deliberately skipped, and failed.
 */

import type { InitialMigrationDeps, Reachability } from '../src/initial-migration'
import { describe, expect, test } from 'bun:test'
import { migratesDuringSetup, runInitialMigration } from '../src/initial-migration'

function deps(overrides: Partial<InitialMigrationDeps> = {}): InitialMigrationDeps & { messages: string[] } {
  const messages: string[] = []

  return {
    messages,
    appEnv: 'local',
    isReachable: async (): Promise<Reachability> => ({ ok: true }),
    migrate: async () => ({ isErr: () => false }),
    failed: (result: unknown) => Boolean((result as { isErr?: () => boolean })?.isErr?.()),
    log: {
      info: (m: string) => messages.push(`info: ${m}`),
      warn: (m: string) => messages.push(`warn: ${m}`),
      success: (m: string) => messages.push(`success: ${m}`),
      debug: (m: unknown) => messages.push(`debug: ${String(m)}`),
    },
    ...overrides,
  }
}

describe('migratesDuringSetup', () => {
  test('runs in the environments a human is onboarding in', () => {
    for (const env of ['local', 'development', 'dev', 'test', 'LOCAL'])
      expect(migratesDuringSetup(env)).toBe(true)
  })

  test('leaves deploy and CI targets alone', () => {
    for (const env of ['production', 'staging', 'ci'])
      expect(migratesDuringSetup(env)).toBe(false)
  })
})

describe('runInitialMigration', () => {
  test('reports a clean run as migrated', async () => {
    const d = deps()
    expect(await runInitialMigration(d)).toBe('migrated')
    expect(d.messages).toContain('success: Database is migrated')
  })

  test('a failing migration FAILS - it is not downgraded to a warning', async () => {
    const d = deps({ migrate: async () => ({ isErr: () => true, error: new Error('there is already another table or index with this name: receipts') }) })

    expect(await runInitialMigration(d)).toBe('failed')
    // The old behaviour: "you can run it later", and setup carried on.
    expect(d.messages.join('\n')).not.toMatch(/run it later/)
  })

  test('a migration that throws also fails', async () => {
    const d = deps({ migrate: async () => { throw new Error('spawn failed') } })
    expect(await runInitialMigration(d)).toBe('failed')
  })

  test('an unreachable database skips, says why, and names the follow-up', async () => {
    const d = deps({ isReachable: async () => ({ ok: false, reason: 'postgres@localhost:5432 is not reachable yet (server-unreachable)' }) })

    expect(await runInitialMigration(d)).toBe('skipped')
    const output = d.messages.join('\n')
    expect(output).toContain('server-unreachable')
    expect(output).toContain('./buddy migrate')
    expect(output).toContain('no schema until you do')
  })

  test('does not even probe outside the onboarding environments', async () => {
    let probed = false
    const d = deps({
      appEnv: 'production',
      isReachable: async () => { probed = true; return { ok: true } },
      migrate: async () => { throw new Error('must not run') },
    })

    expect(await runInitialMigration(d)).toBe('skipped')
    expect(probed).toBe(false)
  })

  test('an unreachable database never runs the migration', async () => {
    let migrated = false
    const d = deps({
      isReachable: async () => ({ ok: false, reason: 'down' }),
      migrate: async () => { migrated = true; return { isErr: () => false } },
    })

    await runInitialMigration(d)
    expect(migrated).toBe(false)
  })
})
