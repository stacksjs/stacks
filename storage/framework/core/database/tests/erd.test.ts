import { describe, expect, it } from 'bun:test'
import { columnType, relatedModelNames, relationEdges, renderErd, toDiagrammableModel } from '../src/erd'

const model = (name: string, table: string, extra: Record<string, unknown> = {}) =>
  toDiagrammableModel({ name, table, ...extra }, table)

describe('columnType', () => {
  it('takes the head of the rule list, which is the base type', () => {
    // `schema.string().max(100)` is [{name:'string'},{name:'max'}] - the rest
    // are constraints a diagram does not show.
    expect(columnType({ validation: { rule: { rules: [{ name: 'string' }, { name: 'max' }] } } })).toBe('string')
    expect(columnType({ validation: { rule: { rules: [{ name: 'number' }] } } })).toBe('number')
  })

  it('falls back to the shape of a default when there is no validation', () => {
    expect(columnType({ default: true })).toBe('boolean')
    expect(columnType({ default: 0 })).toBe('number')
    expect(columnType({ default: 'draft' })).toBe('string')
  })

  it('says unknown rather than guessing', () => {
    expect(columnType({})).toBe('unknown')
    expect(columnType(undefined)).toBe('unknown')
    expect(columnType({ default: { nested: true } })).toBe('unknown')
  })

  it('rejects a rule name Mermaid cannot render as a type token', () => {
    // Mermaid mangles punctuation in a type silently, so anything unrecognised
    // has to become `unknown` rather than reach the output.
    expect(columnType({ validation: { rule: { rules: [{ name: 'array<string>' }] } } })).toBe('unknown')
    expect(columnType({ validation: { rule: { rules: [{ name: 'Enum Value' }] } } })).toBe('unknown')
  })
})

describe('relatedModelNames', () => {
  it('accepts every shape a relation is declared in', () => {
    expect(relatedModelNames('Post')).toEqual(['Post'])
    expect(relatedModelNames(['Post', 'Comment'])).toEqual(['Post', 'Comment'])
    expect(relatedModelNames([{ model: 'Post' }, { model: 'Comment' }])).toEqual(['Post', 'Comment'])
    expect(relatedModelNames({ Post: {}, Comment: {} })).toEqual(['Post', 'Comment'])
  })

  it('is empty for anything else', () => {
    expect(relatedModelNames(undefined)).toEqual([])
    expect(relatedModelNames(null)).toEqual([])
    expect(relatedModelNames([{ notAModel: 1 }])).toEqual([])
  })
})

describe('toDiagrammableModel', () => {
  it('always starts with the primary key', () => {
    expect(model('User', 'users').columns[0]).toEqual({ name: 'id', type: 'number', key: 'PK' })
    expect(model('User', 'users', { primaryKey: 'user_id' }).columns[0]!.name).toBe('user_id')
  })

  it('includes trait columns, because they are real columns', () => {
    // A diagram that omits created_at describes a table that does not exist.
    const columns = model('Post', 'posts', {
      traits: { useUuid: true, useTimestamps: true, useSoftDeletes: true },
    }).columns.map(c => c.name)

    expect(columns).toEqual(['id', 'uuid', 'created_at', 'updated_at', 'deleted_at'])
  })

  it('adds a foreign key column per belongsTo', () => {
    const columns = model('Post', 'posts', { belongsTo: ['User'] }).columns
    expect(columns.find(c => c.name === 'user_id')).toEqual({ name: 'user_id', type: 'number', key: 'FK' })
  })

  it('does not duplicate a foreign key the model also declares as an attribute', () => {
    const columns = model('Post', 'posts', {
      belongsTo: ['User'],
      attributes: { user_id: { validation: { rule: { rules: [{ name: 'number' }] } } } },
    }).columns

    expect(columns.filter(c => c.name === 'user_id')).toHaveLength(1)
  })

  it('marks a unique attribute', () => {
    const columns = model('User', 'users', { attributes: { email: { unique: true } } }).columns
    expect(columns.find(c => c.name === 'email')?.key).toBe('UK')
  })
})

describe('relationEdges', () => {
  const users = model('User', 'users', { hasMany: ['Post'] })
  const posts = model('Post', 'posts', { belongsTo: ['User'] })

  it('draws one edge for a relationship declared from both sides', () => {
    // `User hasMany Post` and `Post belongsTo User` are the same edge; drawing
    // both puts two arrows between one pair of boxes.
    expect(relationEdges([users, posts])).toEqual([
      { from: 'users', to: 'posts', cardinality: '||--o{', label: 'has many' },
    ])
  })

  it('drops a relation naming a model that is not present', () => {
    // An edge to a table that does not exist reads as schema rather than as a
    // typo, which is worse than a missing edge.
    expect(relationEdges([model('Post', 'posts', { belongsTo: ['Ghost'] })])).toEqual([])
  })

  it('distinguishes hasOne from hasMany', () => {
    const author = model('Author', 'authors')
    const withOne = model('User', 'users', { hasOne: ['Author'] })
    expect(relationEdges([withOne, author])[0]!.cardinality).toBe('||--o|')
  })

  it('is deterministic regardless of input order', () => {
    expect(relationEdges([posts, users])).toEqual(relationEdges([users, posts]))
  })
})

describe('renderErd', () => {
  const models = [
    model('User', 'users', {
      hasMany: ['Post'],
      attributes: { email: { unique: true, validation: { rule: { rules: [{ name: 'string' }] } } } },
    }),
    model('Post', 'posts', { belongsTo: ['User'], traits: { useTimestamps: true } }),
  ]

  it('renders relationships before entities', () => {
    const output = renderErd(models)
    expect(output.startsWith('erDiagram\n  users ||--o{ posts')).toBeTrue()
    expect(output.indexOf('users ||--o{ posts')).toBeLessThan(output.indexOf('users {'))
  })

  it('renders each column as `type name KEY`', () => {
    expect(renderErd(models)).toContain('    string email UK')
    expect(renderErd(models)).toContain('    number user_id FK')
  })

  it('omits columns when asked, for a relationships-only overview', () => {
    const output = renderErd(models, { columns: false })
    expect(output).toContain('users ||--o{ posts')
    // No entity blocks. Checking for a bare `{` would match the cardinality.
    expect(output).not.toMatch(/^\s+\w+ \{$/m)
  })

  it('filters to a subset by table or model name', () => {
    expect(renderErd(models, { only: ['users'] })).toContain('users {')
    expect(renderErd(models, { only: ['users'] })).not.toContain('posts {')
    expect(renderErd(models, { only: ['Post'] })).toContain('posts {')
  })

  it('drops the edge when only one end is in the subset', () => {
    // Otherwise the diagram names a table it does not draw.
    expect(renderErd(models, { only: ['users'] })).not.toContain('||--o{')
  })

  it('is stable across renders, so a generated file does not churn', () => {
    expect(renderErd(models)).toBe(renderErd([...models].reverse()))
  })
})
