/**
 * Coverage for `getRelations` polymorphic + hasManyThrough wiring. Audit
 * top-12 #6 (`query-builder.md`):
 *
 *   `morphTo`, `morphMany`, `morphToMany`, `morphedByMany`, and
 *   `hasManyThrough` were declared in `ModelOptions` but `getRelations()`
 *   only processed `hasOne | hasMany | belongsTo | hasOneThrough |
 *   belongsToMany | morphOne` — declaring any of the missing five
 *   silently no-op'd at runtime.
 *
 * The fix routes `morphMany` through the same processor as `morphOne`,
 * adds `processMorphTo` for the inverse pole, and adds
 * `processPolymorphicPivot` for `morphToMany` / `morphedByMany`. This
 * test exercises each branch and asserts the produced RelationConfig
 * shape — separately from any DB-level eager-load test.
 */
import { describe, expect, it } from 'bun:test'
import { getRelations } from '@stacksjs/model-meta'

// Most fixtures avoid the disk-backed relation loader. The named
// belongsToMany case intentionally resolves the framework's real Post and Tag
// models so the modern record form is covered at the Stacks adapter boundary.

describe('getRelations - polymorphic wiring (#6 audit fix)', () => {
  it('processes morphTo declarations into a runtime-resolvable RelationConfig', async () => {
    const result = await getRelations(
      {
        name: 'Comment',
        table: 'comments' as any,
        morphTo: { name: 'commentable' } as any,
      },
      'Comment',
    )
    // Pre-fix this returned an empty array — `morphTo` was silently dropped.
    expect(result.length).toBe(1)
    const r = result[0]
    expect(r.relationship).toBe('morphTo')
    // morphTo's target is resolved at runtime from <morph>_type, so
    // `model` / `table` are intentionally left blank in the static config.
    expect(r.model).toBe('')
    expect(r.foreignKey).toBe('commentable_id')
    expect(r.modelKey).toBe('commentable_type')
    expect(r.relationName).toBe('commentable')
  })

  it('uses the configured morph name when supplied', async () => {
    const result = await getRelations(
      {
        name: 'Comment',
        table: 'comments' as any,
        morphTo: { name: 'parent', type: 'parent_type', id: 'parent_id' } as any,
      },
      'Comment',
    )
    expect(result[0].relationName).toBe('parent')
    expect(result[0].foreignKey).toBe('parent_id')
    expect(result[0].modelKey).toBe('parent_type')
  })

  it('processes morphToMany into a polymorphic-pivot RelationConfig', async () => {
    const result = await getRelations(
      {
        name: 'Post',
        table: 'posts' as any,
        morphToMany: [{ model: 'Tag', morphName: 'taggable' }] as any,
      },
      'Post',
    )
    expect(result.length).toBe(1)
    const r = result[0]
    expect(r.relationship).toBe('morphToMany')
    expect(r.model).toBe('Tag')
    expect(r.pivotTable).toBe('taggable')
    expect(r.pivotForeign).toBe('taggable_id')
    expect(r.pivotKey).toBe('taggable_type')
  })

  it('processes morphedByMany (the inverse) the same way', async () => {
    const result = await getRelations(
      {
        name: 'Tag',
        table: 'tags' as any,
        morphedByMany: [{ model: 'Post', morphName: 'taggable' }] as any,
      },
      'Tag',
    )
    expect(result.length).toBe(1)
    const r = result[0]
    expect(r.relationship).toBe('morphedByMany')
    expect(r.model).toBe('Post')
    expect(r.pivotTable).toBe('taggable')
  })

  it('honors a custom pivotTable on polymorphic pivot declarations', async () => {
    const result = await getRelations(
      {
        name: 'Post',
        table: 'posts' as any,
        morphToMany: [{ model: 'Tag', morphName: 'taggable', pivotTable: 'post_tags' }] as any,
      },
      'Post',
    )
    expect(result[0].pivotTable).toBe('post_tags')
  })

  it('normalizes modern named belongsToMany relations', async () => {
    const result = await getRelations(
      {
        name: 'Post',
        table: 'posts' as any,
        belongsToMany: {
          tags: {
            model: 'Tag',
            table: 'taggable_models',
            foreignKey: 'taggable_id',
            relatedKey: 'tag_id',
            pivot: {
              columns: { taggable_type: { default: 'posts' } },
              timestamps: true,
            },
          },
        },
      },
      'Post',
    )

    expect(result).toHaveLength(1)
    expect(result[0].relationName).toBe('tags')
    expect(result[0].pivotTable).toBe('taggable_models')
    expect(result[0].foreignKey).toBe('taggable_id')
    expect(result[0].modelKey).toBe('tag_id')
  })

  it('returns an empty array when no relations are declared', async () => {
    const result = await getRelations(
      { name: 'Plain', table: 'plains' as any },
      'Plain',
    )
    expect(result).toEqual([])
  })
})

/**
 * A `belongsTo` entry may name the column it uses. Two halves of the framework
 * already honoured that - `deriveFkColumns` in generate-database-schema.ts and
 * `belongsToColumn` in @stacksjs/database, which is what emits the column and
 * protects it from the migration differ - while `getRelations` derived
 * `<related>_id` regardless and read a column no migration had created.
 *
 * It also decides whether a model can point at the same model twice: a herd
 * move from one field to another, an edge between two nodes, a transfer
 * between two accounts. Both entries resolved to one `modelKey` and the second
 * silently shadowed the first.
 */
describe('getRelations - belongsTo foreign keys', () => {
  it('honours a declared foreignKey on belongsTo', async () => {
    const result = await getRelations(
      {
        name: 'Order',
        table: 'orders' as any,
        belongsTo: [{ model: 'User', foreignKey: 'placed_by_id', relationName: 'placedBy' }] as any,
      } as any,
      'Order',
    )

    expect(result).toHaveLength(1)
    // The key lives on the declaring table, so it lands on modelKey. Pre-fix
    // this was 'user_id'.
    expect(result[0].modelKey).toBe('placed_by_id')
    expect(result[0].relationName).toBe('placedBy')
    // The other direction has nothing to point at on a belongsTo.
    expect(result[0].foreignKey).toBe('')
  })

  it('keeps two belongsTo to the same model distinct', async () => {
    const result = await getRelations(
      {
        name: 'Order',
        table: 'orders' as any,
        belongsTo: [
          { model: 'User', foreignKey: 'from_user_id', relationName: 'fromUser' },
          { model: 'User', foreignKey: 'to_user_id', relationName: 'toUser' },
        ] as any,
      } as any,
      'Order',
    )

    expect(result).toHaveLength(2)
    // Pre-fix both came back as 'user_id'.
    expect(result.map(r => r.modelKey)).toEqual(['from_user_id', 'to_user_id'])
    expect(result.map(r => r.relationName)).toEqual(['fromUser', 'toUser'])
  })

  it('still derives <related>_id when no foreignKey is declared', async () => {
    const result = await getRelations(
      { name: 'Order', table: 'orders' as any, belongsTo: ['User'] } as any,
      'Order',
    )

    expect(result).toHaveLength(1)
    expect(result[0].modelKey).toBe('user_id')
  })
})
