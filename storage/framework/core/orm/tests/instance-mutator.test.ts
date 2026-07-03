/**
 * Coverage for the instance-write mutator pipeline. Audit top-12 #3:
 * `inst.password = 'plain'; inst.save()` on a model with an async
 * `set: { password: bcrypt }` was silently writing a Promise object to
 * the DB (pre-fix bun-query-builder save() called `setter()` and stored
 * the unawaited result).
 *
 * Post-fix:
 *   • The Stacks proxy `save()` wrapper pre-runs the setter pipeline
 *     synchronously and throws a clear error when a setter returns a
 *     Promise (so the failure mode is visible, not silent) before
 *     delegating to bun-query-builder's async save().
 *   • The Stacks proxy adds `saveAsync()` / `updateAsync()` which await
 *     async setters and then delegate to the underlying save with setters
 *     temporarily disabled (so the setter pipeline runs exactly once).
 *
 * We can't run a full integration save() in unit tests (no real table),
 * but we can lock in:
 *   - The proxy exposes `saveAsync` / `updateAsync` on every instance.
 *   - save() throws the new helpful error synchronously when a setter
 *     returns a Promise.
 *   - Sync setters still work as before (regression guard).
 */
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { Database } from 'bun:sqlite'
import { configureOrm, getDatabase } from 'bun-query-builder'
import { acquireDbConfigLock } from '@stacksjs/database'
import { defineModel } from '../src/define-model'

describe('instance mutator pipeline', () => {
  let db: Database
  // `configureOrm()` mutates the same process-wide bun-query-builder config
  // singleton `initializeDbConfig()` does (stacksjs/stacks#1862) — hold the
  // lock for this file's entire lifetime so a sibling file's own config
  // call (via either entry point) can't repoint our connection mid-run.
  let releaseDbConfigLock: () => void

  beforeAll(async () => {
    releaseDbConfigLock = await acquireDbConfigLock()
    configureOrm({ database: ':memory:' })
    db = getDatabase()
    db.run(`CREATE TABLE async_set_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT,
      password TEXT
    )`)
    db.run(`CREATE TABLE sync_set_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT
    )`)
  })

  afterAll(() => {
    releaseDbConfigLock()
  })

  const AsyncSetUser = defineModel({
    name: 'AsyncSetUser',
    table: 'async_set_users',
    primaryKey: 'id',
    autoIncrement: true,
    attributes: {
      email: { type: 'string', fillable: true },
      password: { type: 'string', fillable: true },
    },
    set: {
      // Async setter — `inst.save()` (sync) shouldn't store this Promise
      // verbatim. Stacks `saveAsync()` should resolve it before writing.
      password: async (attrs: Record<string, unknown>) => {
        await new Promise(r => setTimeout(r, 1))
        return `hashed:${String(attrs.password)}`
      },
    },
  } as const)

  const SyncSetUser = defineModel({
    name: 'SyncSetUser',
    table: 'sync_set_users',
    primaryKey: 'id',
    autoIncrement: true,
    attributes: {
      email: { type: 'string', fillable: true },
    },
    set: {
      email: (attrs: Record<string, unknown>) => String(attrs.email).toLowerCase(),
    },
  } as const)

  it('the proxy exposes saveAsync and updateAsync on instances', async () => {
    const inst = await (AsyncSetUser as any).create({ email: 'a@b.c', password: 'plain' })
    expect(typeof (inst as any).saveAsync).toBe('function')
    expect(typeof (inst as any).updateAsync).toBe('function')
  })

  it('sync save() throws a helpful error when a setter returns a Promise', async () => {
    const inst = await (AsyncSetUser as any).create({ email: 'a@b.c', password: 'plain' })
    ;(inst as any).password = 'new-plaintext'

    let thrown: unknown = null
    try {
      ;(inst as any).save()
    }
    catch (err) { thrown = err }

    expect(thrown).toBeInstanceOf(Error)
    const msg = (thrown as Error).message
    expect(msg).toContain('returned a Promise')
    expect(msg).toContain('saveAsync')
  })

  it('saveAsync awaits an async setter and persists the resolved value', async () => {
    const inst = await (AsyncSetUser as any).create({ email: 'b@b.c', password: 'plain' })
    ;(inst as any).password = 'new-plaintext'
    await (inst as any).saveAsync()

    // Re-read from the DB and check the stored password is the
    // setter-resolved value, not a `[object Promise]` artifact.
    const row = db.query('SELECT password FROM async_set_users WHERE id = ?').get((inst as any).id) as any
    expect(row.password).toBe('hashed:new-plaintext')
  })

  it('updateAsync runs the same async path with a data object argument', async () => {
    const inst = await (AsyncSetUser as any).create({ email: 'c@b.c', password: 'plain' })
    await (inst as any).updateAsync({ password: 'updated-plaintext' })
    const row = db.query('SELECT password FROM async_set_users WHERE id = ?').get((inst as any).id) as any
    expect(row.password).toBe('hashed:updated-plaintext')
  })

  it('sync setters still work via plain inst.save() (regression guard)', async () => {
    const inst = await (SyncSetUser as any).create({ email: 'MIXED@CASE.COM' })
    // Re-read after create
    const row = db.query('SELECT email FROM sync_set_users WHERE id = ?').get((inst as any).id) as any
    expect(row.email).toBe('mixed@case.com')

    ;(inst as any).email = 'AGAIN@CASE.COM'
    await (inst as any).save()
    const row2 = db.query('SELECT email FROM sync_set_users WHERE id = ?').get((inst as any).id) as any
    expect(row2.email).toBe('again@case.com')
  })
})
