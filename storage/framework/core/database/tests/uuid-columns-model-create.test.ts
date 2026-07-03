import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { configureOrm, getDatabase } from 'bun-query-builder'
import { acquireDbConfigLock } from '@stacksjs/database'
import { defineModel } from '@stacksjs/orm'
import { sqlHelpers } from '../src/sql-helpers'
import { uuidColumnSql } from '../src/uuid-columns'

/**
 * stacksjs/status#1 Phase 9 — end-to-end regression for the reported bug:
 * "`await User.create({ name, email, password })` throws
 * `SQLiteError: table users has no column named uuid` on a freshly
 * migrated database" because the `useUuid` trait makes the ORM's real
 * write path (`ModelInstance.save()`'s create branch, bun-query-builder)
 * unconditionally set `data.uuid = crypto.randomUUID()` before insert,
 * with no schema check first.
 *
 * `uuid-columns.test.ts` proves the DDL and the real-model trait
 * discovery; this file proves the actual failure mode through the real
 * `Model.create()` entry point (not a hand-written INSERT), using a
 * synthetic `useUuid` model — same pattern as
 * `orm/tests/probe.test.ts` (`configureOrm` + `getDatabase` share one
 * in-memory connection with any `defineModel(...).create()` call).
 * A synthetic model (rather than the real `User`) keeps this hermetic:
 * the real `User` pulls in auth/billable/passkey traits and app config
 * that have no bearing on the uuid bug and no existing test precedent
 * for wiring up safely (see research: zero existing tests instantiate
 * `storage/framework/defaults/app/Models/User.ts` and call `.create()`).
 */

describe('Model.create() on a useUuid model — end-to-end regression (stacksjs/status#1 Phase 9)', () => {
  // `configureOrm()` mutates the same process-wide bun-query-builder config
  // singleton `initializeDbConfig()` does (stacksjs/stacks#1862) — hold the
  // lock for this file's entire lifetime so a sibling file's own config
  // call (via either entry point) can't repoint our connection mid-run.
  let releaseDbConfigLock: () => void

  beforeAll(async () => {
    releaseDbConfigLock = await acquireDbConfigLock()
    configureOrm({ database: ':memory:' })
    const db = getDatabase()
    // Mirrors the real `users` migration's shape: a create-table
    // migration generated (or hand-written) before `useUuid: true` was
    // ever a concern — no `uuid` column, same as every drifted
    // create-*-table migration this fix targets.
    db.run(`CREATE TABLE regress_uuid_widgets (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)`)
  })

  afterAll(() => {
    releaseDbConfigLock()
  })

  const Widget = defineModel({
    name: 'RegressUuidWidget',
    table: 'regress_uuid_widgets',
    primaryKey: 'id',
    autoIncrement: true,
    traits: { useUuid: true },
    attributes: {
      name: { type: 'string', fillable: true },
    },
  } as const)

  it('pre-fix failure mode: Model.create() throws against a table missing the uuid column — the exact reported bug', async () => {
    let thrown: unknown = null
    try {
      await (Widget as any).create({ name: 'a' })
    }
    catch (err) {
      thrown = err
    }
    expect(thrown).not.toBeNull()
    expect(String((thrown as Error)?.message)).toMatch(/no column named uuid|has no column named uuid/i)
  })

  it('post-fix: after the guarantee-ALTER runs, the same Model.create() call succeeds and persists a uuid', async () => {
    const db = getDatabase()
    db.run(uuidColumnSql('regress_uuid_widgets', sqlHelpers('sqlite')))

    const created = await (Widget as any).create({ name: 'b' }) as { uuid?: string, name?: string }
    expect(created).toBeTruthy()
    expect(created.uuid).toBeTruthy()
    expect(created.name).toBe('b')
  })
})
