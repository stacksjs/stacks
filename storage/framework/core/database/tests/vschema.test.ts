// VSchema derivation (`src/vschema.ts`).
//
// The property under test is co-location. Sharding every table by its own
// `id` is the intuitive choice and the wrong one: `users` lands on the shard
// for `users.id`, `posts` on the shard for `posts.id`, and a join between
// them fans out to every shard. Nothing appears broken — the cluster still
// answers — it just costs N times more, and worse as shards are added.
//
// So a child table must shard by its PARENT's key, which is a fact the
// models already state via `belongsTo`. These tests pin that derivation and
// the places it deliberately declines to guess.

import { describe, expect, test } from 'bun:test'
import type { ShardableModel } from '../src/vschema'
import {
  decideSharding,
  deriveVSchema,
  foreignKeyForModel,
  formatShardingReport,
  toShardableModel,
} from '../src/vschema'

function model(partial: Partial<ShardableModel> & { name: string, table: string }): ShardableModel {
  return { belongsTo: [], useUuid: false, ...partial }
}

const USERS = model({ name: 'User', table: 'users', useUuid: true })
const POSTS = model({ name: 'Post', table: 'posts', belongsTo: ['User'], useUuid: true })
const COMMENTS = model({ name: 'Comment', table: 'comments', belongsTo: ['Post'], useUuid: true })

describe('foreignKeyForModel', () => {
  test('follows the ORM naming convention', () => {
    expect(foreignKeyForModel('User')).toBe('user_id')
    expect(foreignKeyForModel('PrintDevice')).toBe('print_device_id')
    expect(foreignKeyForModel('GiftCard')).toBe('gift_card_id')
  })
})

describe('co-location is the point', () => {
  const tables = new Map([['User', 'users'], ['Post', 'posts']])

  test('a child shards by its parent key, not its own id', () => {
    const decision = decideSharding(POSTS, tables)
    // The whole reason this module exists: `posts.id` would scatter every
    // join back to users.
    expect(decision.column).toBe('user_id')
    expect(decision.column).not.toBe('id')
    expect(decision.reason).toBe('co-located with parent')
    expect(decision.parent).toBe('users')
  })

  test('a root entity shards by its own id', () => {
    const decision = decideSharding(USERS, tables)
    expect(decision.column).toBe('id')
    expect(decision.reason).toBe('root entity')
  })

  test('sharding stays one level deep and does not fake transitivity', () => {
    // comments -> posts -> users. A comment co-locates with its POST, not
    // with its user. Claiming otherwise would need a lookup vindex the user
    // has to design, so the derivation stops here rather than inventing a
    // topology that looks right and is not.
    const decision = decideSharding(COMMENTS, tables)
    expect(decision.column).toBe('post_id')
    expect(decision.column).not.toBe('user_id')
  })
})

describe('explicit declarations win', () => {
  const tables = new Map([['User', 'users']])

  test('a declared column overrides the derived one', () => {
    const declared = model({
      name: 'Post',
      table: 'posts',
      belongsTo: ['User'],
      sharding: { column: 'tenant_id', vindex: 'xxhash' },
    })
    const decision = decideSharding(declared, tables)
    expect(decision.column).toBe('tenant_id')
    expect(decision.vindex).toBe('xxhash')
    expect(decision.reason).toBe('explicit')
  })

  test('a reference table gets no vindex at all', () => {
    // Splitting a small, constantly-joined lookup table would make every
    // such join a scatter-gather; copying it costs nothing.
    const country = model({ name: 'Country', table: 'countries', sharding: { unsharded: true } })
    const decision = decideSharding(country, tables)
    expect(decision.column).toBeNull()
    expect(decision.vindex).toBeNull()
    expect(decision.reason).toBe('reference table')
  })
})

describe('multiple parents are warned about, not silently resolved', () => {
  test('shards by the first parent and says the others will scatter', () => {
    const pivot = model({
      name: 'OrderItem',
      table: 'order_items',
      belongsTo: ['Order', 'Product'],
    })
    const decision = decideSharding(pivot, new Map([['Order', 'orders'], ['Product', 'products']]))
    expect(decision.column).toBe('order_id')
    // Only one column can decide the shard, so the Product join scatters.
    // Picking silently would hide a real performance cliff.
    expect(decision.warning).toBeDefined()
    expect(decision.warning).toContain('Product')
  })

  test('a single parent produces no warning', () => {
    expect(decideSharding(POSTS, new Map([['User', 'users']])).warning).toBeUndefined()
  })
})

describe('deriveVSchema', () => {
  test('emits a sharded keyspace with one vindex definition per type', () => {
    const { vschema } = deriveVSchema([USERS, POSTS, COMMENTS])
    expect(vschema.sharded).toBe(true)
    // Three tables all using `hash` share ONE definition, referenced by name.
    expect(Object.keys(vschema.vindexes)).toEqual(['hash'])
    expect(Object.keys(vschema.tables).sort()).toEqual(['comments', 'posts', 'users'])
  })

  test('each table maps its sharding column to a vindex', () => {
    const { vschema } = deriveVSchema([USERS, POSTS])
    expect(vschema.tables.users?.column_vindexes).toEqual([{ column: 'id', name: 'hash' }])
    expect(vschema.tables.posts?.column_vindexes).toEqual([{ column: 'user_id', name: 'hash' }])
  })

  test('models without useUuid get a sequence, since AUTO_INCREMENT cannot work', () => {
    // A sharded keyspace cannot use AUTO_INCREMENT — every shard would hand
    // out the same values — so a table still wanting integer ids needs a
    // sequence in an unsharded keyspace.
    const legacy = model({ name: 'Invoice', table: 'invoices', useUuid: false })
    const { vschema } = deriveVSchema([legacy])
    expect(vschema.tables.invoices?.auto_increment).toEqual({ column: 'id', sequence: 'invoices_seq' })
  })

  test('useUuid models need no sequence', () => {
    const { vschema } = deriveVSchema([USERS])
    expect(vschema.tables.users?.auto_increment).toBeUndefined()
  })

  test('an explicit sequence name is honored', () => {
    const custom = model({
      name: 'Invoice',
      table: 'invoices',
      useUuid: false,
      sharding: { sequence: 'billing_seq' },
    })
    const { vschema } = deriveVSchema([custom])
    expect(vschema.tables.invoices?.auto_increment?.sequence).toBe('billing_seq')
  })

  test('reference tables are typed, not vindexed', () => {
    const country = model({ name: 'Country', table: 'countries', sharding: { unsharded: true } })
    const { vschema } = deriveVSchema([USERS, country])
    expect(vschema.tables.countries).toEqual({ type: 'reference' })
    expect(vschema.tables.countries?.column_vindexes).toBeUndefined()
  })

  test('mixed vindex types each get their own definition', () => {
    const stringKeyed = model({
      name: 'Session',
      table: 'sessions',
      useUuid: true,
      sharding: { column: 'token', vindex: 'binary_md5' },
    })
    const { vschema } = deriveVSchema([USERS, stringKeyed])
    expect(Object.keys(vschema.vindexes).sort()).toEqual(['binary_md5', 'hash'])
  })

  test('produces valid JSON', () => {
    const { vschema } = deriveVSchema([USERS, POSTS, COMMENTS])
    expect(() => JSON.parse(JSON.stringify(vschema))).not.toThrow()
  })
})

describe('toShardableModel normalizes belongsTo shapes', () => {
  test('accepts an array of names', () => {
    const m = toShardableModel({ name: 'Post', belongsTo: ['User'] }, 'posts')
    expect(m.belongsTo).toEqual(['User'])
  })

  test('accepts a bare string', () => {
    expect(toShardableModel({ name: 'Post', belongsTo: 'User' }, 'posts').belongsTo).toEqual(['User'])
  })

  test('accepts an object keyed by model name', () => {
    const m = toShardableModel({ name: 'Post', belongsTo: { User: { foreignKey: 'author_id' } } }, 'posts')
    expect(m.belongsTo).toEqual(['User'])
  })

  test('treats a missing belongsTo as a root entity', () => {
    expect(toShardableModel({ name: 'User' }, 'users').belongsTo).toEqual([])
  })

  test('carries useUuid and the sharding block through', () => {
    const m = toShardableModel(
      { name: 'User', traits: { useUuid: true, sharding: { column: 'tenant_id' } } },
      'users',
    )
    expect(m.useUuid).toBe(true)
    expect(m.sharding?.column).toBe('tenant_id')
  })
})

describe('formatShardingReport', () => {
  test('groups by reason so the topology is reviewable', () => {
    const { decisions } = deriveVSchema([USERS, POSTS])
    const report = formatShardingReport(decisions)
    expect(report).toContain('Root entities')
    expect(report).toContain('users')
    expect(report).toContain('Co-located with a parent')
    expect(report).toContain('posts')
  })

  test('surfaces warnings', () => {
    const pivot = model({ name: 'OrderItem', table: 'order_items', belongsTo: ['Order', 'Product'] })
    const { decisions } = deriveVSchema([pivot])
    expect(formatShardingReport(decisions)).toContain('Warnings')
  })

  test('an empty model set produces an empty report rather than throwing', () => {
    expect(() => formatShardingReport([])).not.toThrow()
  })
})
