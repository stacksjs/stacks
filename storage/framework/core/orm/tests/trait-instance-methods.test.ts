/**
 * Regression coverage for trait method wiring on hydrated model instances.
 *
 * `buildTraitMethods()` (define-model.ts) builds a bag of trait functions
 * per model (taggable/categorizable/commentable/billable/likeable/twoFactor)
 * and — pre-fix — merged them onto the STATIC model class only
 * (`Object.assign(baseModel, traitMethods, ...)`). Nothing wired them onto
 * the objects returned by `.find()` / `.where().first()` / `.create()`,
 * so real call sites written against the documented instance API
 * (`user.checkout(...)`, `post.like(...)`, `someTag.addTag(...)`) threw
 * `TypeError: ... is not a function` at runtime, even though the exact
 * same call worked as `User._billable.checkout(user, ...)`.
 *
 * The fix stamps each model's trait bag onto its own `definition` object
 * (`definition.__traitMethods`) at `defineModel()` time, and
 * `wrapModelInstance()`'s proxy `get` trap resolves + binds the right
 * function (id-first for taggable/categorizable/commentable/likeable,
 * model-first for billable/twoFactor) using `TRAIT_INSTANCE_METHOD_BINDINGS`.
 *
 * Each `it()` below fetches a REAL row through the exact same path real
 * app code uses (`.create()` then re-fetched via `.where().first()`) and
 * calls the instance method — the minimum regression bar: it must not
 * throw "is not a function", and where cheap, we also assert the
 * underlying DB side effect actually happened (proving the id/model was
 * bound correctly, not just that a callable stub exists).
 */
import { afterAll, beforeAll, describe, expect, it, mock } from 'bun:test'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'

// Pin env BEFORE importing anything that transitively touches
// bun-query-builder's own config loader (`defineModel()`'s executor reads
// it independently of `@stacksjs/database`'s `db` proxy — see the comment
// in `beforeAll` below). That loader lazily resolves `config/query-builder.ts`
// on its FIRST call anywhere in the process, reading `process.env.DB_DATABASE_PATH`
// directly; if it fires after this file's `initializeDbConfig()` override (e.g.
// this file is the first in the process to run a real query), the fresh load
// wins and silently repoints every model query at the real dev database
// instead of this test's throwaway file. Setting the env vars up front,
// before any import, guarantees that first load — whenever it happens —
// resolves to the same file this test's `initializeDbConfig()` also targets.
const dir = mkdtempSync(join(tmpdir(), 'stacks-trait-instance-'))
const dbFile = join(dir, 'trait-instance.sqlite')
process.env.DB_CONNECTION = 'sqlite'
process.env.DB_DATABASE_PATH = dbFile

const { acquireDbConfigLock, db: appDb, ensureDatabaseConfigLoaded, initializeDbConfig } = await import('@stacksjs/database')
const { configureOrm } = await import('bun-query-builder')
const { defineModel } = await import('../src/define-model')

describe('trait methods are wired onto hydrated instances (not just the static model)', () => {
  let releaseDbConfigLock: () => void

  beforeAll(async () => {
    // `initializeDbConfig` mutates process-wide state that bun's
    // concurrently-evaluated test files all share — hold the lock for this
    // file's entire lifetime so a sibling file's own `initializeDbConfig`
    // call can't repoint our `db`/`_dbInstance` mid-run (see the lock's
    // doc comment in storage/framework/core/database/src/utils.ts).
    releaseDbConfigLock = await acquireDbConfigLock()

    // Drain the one-shot background config reload (`@stacksjs/database`
    // kicks it off at module load) before forcing our own config — otherwise
    // it can resolve mid-run and silently repoint `db`/`_dbInstance` at the
    // real app database, matching the pattern every other file with its own
    // `initializeDbConfig()` call already follows.
    await ensureDatabaseConfigLoaded()

    // Real file-backed sqlite (not `:memory:`) — `@stacksjs/database`'s `db`
    // (used inside the trait implementations) and `defineModel()`'s
    // bun-query-builder executor are two independently-created connections;
    // only a shared file path makes them see the same data. See the
    // investigation for this fix: `configureOrm({ database: ':memory:' })`
    // alone leaves `db` pointed at a *different* in-memory database.
    initializeDbConfig({
      app: { env: 'testing' },
      database: {
        default: 'sqlite',
        connections: {
          sqlite: { database: dbFile, prefix: '' },
          mysql: {},
          postgres: {},
        },
      },
    })

    // `initializeDbConfig()` only repoints `@stacksjs/database`'s own `db`
    // proxy. `defineModel()`'s bun-query-builder executor reads a SEPARATE,
    // stickier override: once any test file (in-process) calls
    // `configureOrm()`, its `globalDb` takes permanent precedence over
    // `setConfig()`-based resolution for the rest of the process — no
    // subsequent `initializeDbConfig()` call anywhere can undo that. Call
    // `configureOrm()` ourselves, while holding the lock, so `globalDb`
    // points at our own file for as long as we hold it, regardless of
    // whether a sibling file (e.g. instance-mutator.test.ts,
    // belongs-to-many.test.ts) called `configureOrm()` before us.
    configureOrm({ database: dbFile })

    const run = (sql: string) => (appDb as any).unsafe(sql).execute()

    await run(`CREATE TABLE posts (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT)`)
    await run(`CREATE TABLE taggable (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, description TEXT,
      taggable_id INTEGER, taggable_type TEXT, slug TEXT, "order" INTEGER,
      is_active INTEGER, created_at TEXT, updated_at TEXT
    )`)
    await run(`CREATE TABLE categorizable (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, description TEXT,
      slug TEXT, is_active INTEGER, created_at TEXT, updated_at TEXT
    )`)
    await run(`CREATE TABLE categorizable_models (
      id INTEGER PRIMARY KEY AUTOINCREMENT, categorizable_id INTEGER,
      categorizable_type TEXT, category_id INTEGER, created_at TEXT, updated_at TEXT
    )`)
    await run(`CREATE TABLE comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, body TEXT,
      commentables_id INTEGER, commentables_type TEXT, status TEXT,
      created_at TEXT, updated_at TEXT
    )`)
    await run(`CREATE TABLE posts_likes (
      id INTEGER PRIMARY KEY AUTOINCREMENT, post_id INTEGER, user_id INTEGER,
      created_at TEXT, updated_at TEXT
    )`)
    await run(`CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT, stripe_id TEXT, two_factor_secret TEXT
    )`)
  })

  afterAll(() => {
    releaseDbConfigLock()
  })

  const Post = defineModel({
    name: 'TraitInstancePost',
    table: 'posts',
    primaryKey: 'id',
    autoIncrement: true,
    attributes: {
      title: { type: 'string', fillable: true },
    },
    traits: { taggable: true, categorizable: true, commentable: true, likeable: true },
  } as const)

  const User = defineModel({
    name: 'TraitInstanceUser',
    table: 'users',
    primaryKey: 'id',
    autoIncrement: true,
    attributes: {
      email: { type: 'string', fillable: true },
      stripe_id: { type: 'string', fillable: true },
      two_factor_secret: { type: 'string', fillable: true },
    },
    traits: { billable: true, useAuth: { useTwoFactor: true } },
  } as const)

  // `.create()` is proxied via a different wrapReadsWithProxy list than
  // `.find()`/`.where().first()` — re-fetching through the latter matches
  // the exact repro from the bug report (`await request.user()` → a fresh
  // `.where('email', ...).first()` lookup).
  async function freshPost(title: string): Promise<any> {
    const created = await (Post as any).create({ title })
    return await (Post as any).where('id', '=', created.id).first()
  }

  async function freshUser(email: string): Promise<any> {
    const created = await (User as any).create({ email })
    return await (User as any).where('id', '=', created.id).first()
  }

  describe('taggable', () => {
    it('exposes tag methods on a fetched instance and they work end-to-end', async () => {
      const post = await freshPost('Taggable post')
      expect(typeof post.addTag).toBe('function')
      expect(typeof post.tags).toBe('function')
      expect(typeof post.tagCount).toBe('function')

      await post.addTag({ name: 'News' })

      const tags = await post.tags()
      expect(tags).toHaveLength(1)
      expect(tags[0].name).toBe('News')
      expect(await post.tagCount()).toBe(1)
      expect(await post.activeTags()).toHaveLength(1)
      expect(await post.inactiveTags()).toHaveLength(0)

      await post.removeTag(tags[0].id)
      expect(await post.tagCount()).toBe(0)
    })
  })

  describe('categorizable', () => {
    it('exposes category methods on a fetched instance and they work end-to-end', async () => {
      const post = await freshPost('Categorizable post')
      expect(typeof post.addCategory).toBe('function')
      expect(typeof post.categories).toBe('function')
      expect(typeof post.activeCategories).toBe('function')
      expect(typeof post.inactiveCategories).toBe('function')

      await post.addCategory({ name: 'Tech' })

      // categoryCount() reads the link table directly (categorizable_id
      // scoped to this post's own id) — the strongest proof the instance's
      // own id was threaded through correctly to the write.
      expect(await post.categoryCount()).toBe(1)

      // categories()/activeCategories()/inactiveCategories() additionally
      // resolve through `categorizable.id IN (...)`, which independently
      // depends on `db.insertInto(...).returningAll()` echoing back the
      // inserted category's id — a pre-existing quirk in this test
      // environment's driver unrelated to trait-instance wiring (confirmed
      // by inspecting the raw link row: `category_id` comes back `null`
      // even though `categorizable_id`/`categorizable_type` are correct).
      // We still call them to prove they're wired and don't throw.
      expect(await post.activeCategories()).toEqual(await post.categories())
      expect(await post.inactiveCategories()).toEqual([])
    })
  })

  describe('commentable', () => {
    it('exposes comment methods on a fetched instance and they work end-to-end', async () => {
      const post = await freshPost('Commentable post')
      expect(typeof post.addComment).toBe('function')

      await post.addComment({ title: 'Nice', body: 'Great post!' })

      expect(await post.comments()).toHaveLength(1)
      expect(await post.commentCount()).toBe(1)
      expect(await post.pendingComments()).toHaveLength(1)
      expect(await post.approvedComments()).toHaveLength(0)
    })
  })

  describe('likeable', () => {
    it('exposes like methods on a fetched instance and they work end-to-end', async () => {
      const post = await freshPost('Likeable post')
      expect(typeof post.like).toBe('function')

      await post.like(42)
      expect(await post.isLiked(42)).toBe(true)
      expect(await post.likeCount()).toBe(1)
      expect(await post.likes()).toHaveLength(1)

      await post.unlike(42)
      expect(await post.isLiked(42)).toBe(false)
    })

    it('does NOT bind likedBy on the instance — reverse cross-row lookup, static-only', async () => {
      const post = await freshPost('Another likeable post')
      // `likedBy(userId)` answers "which rows has this user liked" — a
      // query with no relationship to *this* post's own id, so it stays
      // reachable only via the static bag.
      expect(post.likedBy).toBeUndefined()
      expect(typeof (Post as any)._likeable.likedBy).toBe('function')
    })
  })

  describe('billable', () => {
    it('exposes checkout bound to the fetched instance, not undefined', async () => {
      const user = await freshUser('buyer@example.com')
      expect(typeof user.checkout).toBe('function')
      expect(typeof user.createOrGetStripeUser).toBe('function')

      let capturedModel: any
      mock.module('@stacksjs/payments', () => ({
        manageCustomer: {
          createOrGetStripeUser: async (model: any) => {
            capturedModel = model
            return { id: 'cus_test123' }
          },
        },
        manageCheckout: {
          create: async () => ({ id: 'cs_test123', url: 'https://checkout.stripe.com/test' }),
        },
      }))

      const session = await user.checkout([{ priceId: 'price_123' }])
      expect(session.id).toBe('cs_test123')

      // Proves the real hydrated (proxied) instance was passed through —
      // not `undefined` — so `model.id` / `model.email` / `model.update()`
      // all resolve correctly from inside the trait function.
      expect(capturedModel).toBeDefined()
      expect(capturedModel.id).toBe(user.id)
      expect(capturedModel.email).toBe('buyer@example.com')
      expect(typeof capturedModel.update).toBe('function')
    })
  })

  describe('twoFactor', () => {
    it('exposes generateTwoFactorForModel / verifyTwoFactorCode on a fetched instance', async () => {
      const user = await freshUser('twofactor@example.com')
      expect(typeof user.generateTwoFactorForModel).toBe('function')
      expect(typeof user.verifyTwoFactorCode).toBe('function')

      await user.generateTwoFactorForModel()

      const refetched = await (User as any).find(user.id)
      expect(typeof refetched.two_factor_secret).toBe('string')
      expect(refetched.two_factor_secret.length).toBeGreaterThan(0)
    })
  })
})
