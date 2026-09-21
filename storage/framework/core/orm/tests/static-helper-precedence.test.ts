/**
 * Stacks' static `update` and `delete` are the ones a model gets, even when
 * bun-query-builder ships its own.
 *
 * `addStaticHelpers` installed each Stacks helper only when the builder's
 * model lacked one - "bun-query-builder ships only the query-builder/instance
 * forms". bun-query-builder 0.2.70 started shipping a static `update(id, data)`
 * and `delete(id)`, so upgrading to it silently replaced both, and with them
 * the parts of Stacks' contract they carry:
 *
 *  - `update` rejected a guarded attribute with MassAssignmentException. The
 *    native one fills through the instance, which drops it silently, so a
 *    payload of `{ name, is_admin }` wrote the name and reported success.
 *  - `update` ran the model's `set:` hooks and awaited them. The native one
 *    does not await, so an async setter - `User.set.password` is bcrypt -
 *    bound a Promise and every `User.update(id, { password })` threw.
 *  - `delete(id)` answered whether a row went away.
 *
 * mass-assignment.test.ts pins the first. This file pins the other two, and
 * keeps a tripwire on the builder's native statics, so the next one it adds
 * fails here instead of quietly displacing a Stacks helper.
 */
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { configureOrm, createModel, getDatabase, releaseOrm } from 'bun-query-builder'
import { acquireDbConfigLock } from '@stacksjs/database'
import { defineModel } from '../src/define-model'

describe('static helper precedence', () => {
  let releaseDbConfigLock: () => void

  beforeAll(async () => {
    releaseDbConfigLock = await acquireDbConfigLock()
    configureOrm({ database: ':memory:' })
    getDatabase().run('CREATE TABLE precedence_members (id INTEGER PRIMARY KEY, email TEXT, password TEXT, created_at TEXT, updated_at TEXT)')
  })

  afterAll(() => {
    // See belongs-to-many.test.ts: release the configureOrm override while the
    // config lock is still held (stacksjs/stacks#2415).
    releaseOrm()
    releaseDbConfigLock()
  })

  const Member = defineModel({
    name: 'PrecedenceMember',
    table: 'precedence_members',
    primaryKey: 'id',
    attributes: {
      email: { type: 'string', fillable: true },
      password: { type: 'string', fillable: true },
    },
    // Async, like User.set.password, which is where the native update broke.
    set: { password: async (attributes: Record<string, unknown>) => `hashed:${attributes.password}` },
  } as any) as any

  function stored(id: number): Record<string, unknown> | undefined {
    return getDatabase().query('SELECT * FROM precedence_members WHERE id = ?').get(id) as Record<string, unknown> | undefined
  }

  it('Model.update runs async `set` hooks before writing', async () => {
    getDatabase().run(`INSERT INTO precedence_members (id, email, password) VALUES (1, 'a@example.com', 'hashed:original')`)

    await Member.update(1, { password: 'plaintext' })

    expect(stored(1)?.password).toBe('hashed:plaintext')
  })

  it('Model.delete reports whether a row went away', async () => {
    getDatabase().run(`INSERT INTO precedence_members (id, email, password) VALUES (2, 'b@example.com', 'x')`)

    expect(await Member.delete(2)).toBe(true)
    expect(stored(2)).toBeNull()
    expect(await Member.delete(2)).toBe(false)
  })

  /**
   * The tripwire. These are the helpers Stacks installs only when the builder
   * has none of its own. If a bun-query-builder upgrade adds another of them,
   * this fails, and someone decides whether Stacks' version must still win -
   * which is the decision `update` and `delete` never got.
   */
  it('knows which Stacks helpers the builder already provides', () => {
    const probe = createModel({ name: 'Probe', table: 'probes', primaryKey: 'id', attributes: { name: { fillable: true } } } as any) as unknown as Record<string, unknown>
    const installIfMissing = ['count', 'exists', 'findOrFail', 'firstOrCreate', 'forceCreate', 'forceUpdate', 'pluck', 'updateOrCreate', 'whereIn']
    const native = installIfMissing.filter(name => typeof probe[name] === 'function')

    expect(native).toEqual(['count', 'exists', 'findOrFail', 'firstOrCreate', 'pluck', 'updateOrCreate', 'whereIn'])
  })
})
