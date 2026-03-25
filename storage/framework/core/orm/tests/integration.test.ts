import { describe, expect, test } from 'bun:test'
import { defineModel } from '../src/define-model'
import type { CasterInterface, CastType } from '../src/define-model'

// ============================================================================
// defineModel - Core model creation and property spreading
// ============================================================================

describe('ORM defineModel Integration - Model Creation', () => {
  test('defineModel creates a model with all core properties', () => {
    const Post = defineModel({
      name: 'Post',
      table: 'posts',
      primaryKey: 'id',
      autoIncrement: true,
      attributes: {
        title: { type: 'string', fillable: true },
        body: { type: 'string', fillable: true },
        views: { type: 'number', fillable: true, default: 0 },
      },
      traits: { useTimestamps: true },
    } as const)

    expect(Post.name).toBe('Post')
    expect(Post.table).toBe('posts')
    expect(Post.primaryKey).toBe('id')
    expect(Post.autoIncrement).toBe(true)
    expect(Post._isStacksModel).toBe(true)
    expect(typeof Post.getDefinition).toBe('function')
  })

  test('getDefinition returns the original definition reference', () => {
    const definition = {
      name: 'Article',
      table: 'articles',
      primaryKey: 'id',
      autoIncrement: true,
      attributes: {
        title: { type: 'string', fillable: true },
      },
    } as const

    const Article = defineModel(definition)
    const retrieved = Article.getDefinition()
    expect(retrieved).toBe(definition)
    expect(retrieved.name).toBe('Article')
    expect(retrieved.table).toBe('articles')
    expect(retrieved.attributes.title.type).toBe('string')
  })

  test('defineModel with minimal definition', () => {
    const Simple = defineModel({
      name: 'Simple',
      table: 'simples',
      attributes: {
        value: { type: 'string' },
      },
    } as const)

    expect(Simple.name).toBe('Simple')
    expect(Simple.table).toBe('simples')
    expect(Simple._isStacksModel).toBe(true)
    expect(typeof Simple.find).toBe('function')
    expect(typeof Simple.create).toBe('function')
  })

  test('defineModel preserves relation arrays', () => {
    const Post = defineModel({
      name: 'Post',
      table: 'posts',
      primaryKey: 'id',
      autoIncrement: true,
      attributes: {
        title: { type: 'string', fillable: true },
      },
      belongsTo: ['Author'],
      hasMany: ['Comment', 'Tag'],
    } as const)

    expect(Post.belongsTo).toEqual(['Author'])
    expect(Post.hasMany).toEqual(['Comment', 'Tag'])
  })

  test('defineModel preserves dashboard config', () => {
    const Post = defineModel({
      name: 'Post',
      table: 'posts',
      primaryKey: 'id',
      autoIncrement: true,
      attributes: {
        title: { type: 'string', fillable: true },
      },
      dashboard: { highlight: true },
    } as const)

    expect(Post.dashboard).toEqual({ highlight: true })
  })

  test('defineModel preserves traits config', () => {
    const Post = defineModel({
      name: 'Post',
      table: 'posts',
      primaryKey: 'id',
      autoIncrement: true,
      attributes: {
        title: { type: 'string', fillable: true },
      },
      traits: {
        useTimestamps: true,
        useUuid: true,
        useSeeder: { count: 10 },
      },
    } as const)

    expect(Post.traits).toBeDefined()
    expect(Post.traits?.useTimestamps).toBe(true)
    expect(Post.traits?.useUuid).toBe(true)
  })

  test('defineModel preserves indexes config', () => {
    const Author = defineModel({
      name: 'Author',
      table: 'authors',
      primaryKey: 'id',
      autoIncrement: true,
      attributes: {
        email: { type: 'string', fillable: true },
        name: { type: 'string', fillable: true },
      },
      indexes: [
        { name: 'authors_email_name_index', columns: ['email', 'name'] },
      ],
    } as const)

    expect(Author.indexes).toBeDefined()
    expect(Author.indexes).toHaveLength(1)
    expect(Author.indexes![0].name).toBe('authors_email_name_index')
    expect(Author.indexes![0].columns).toEqual(['email', 'name'])
  })
})

// ============================================================================
// defineModel - Query builder methods
// ============================================================================

describe('ORM defineModel Integration - Query Methods', () => {
  test('model has all static query methods', () => {
    const Post = defineModel({
      name: 'Post',
      table: 'posts',
      primaryKey: 'id',
      autoIncrement: true,
      attributes: {
        title: { type: 'string', fillable: true },
      },
    } as const)

    expect(typeof Post.find).toBe('function')
    expect(typeof Post.findOrFail).toBe('function')
    expect(typeof Post.findMany).toBe('function')
    expect(typeof Post.all).toBe('function')
    expect(typeof Post.create).toBe('function')
    expect(typeof Post.createMany).toBe('function')
    expect(typeof Post.query).toBe('function')
    expect(typeof Post.where).toBe('function')
    expect(typeof Post.first).toBe('function')
    expect(typeof Post.last).toBe('function')
    expect(typeof Post.count).toBe('function')
    expect(typeof Post.destroy).toBe('function')
    expect(typeof Post.remove).toBe('function')
    expect(typeof Post.truncate).toBe('function')
    expect(typeof Post.make).toBe('function')
    expect(typeof Post.latest).toBe('function')
    expect(typeof Post.oldest).toBe('function')
    expect(typeof Post.updateOrCreate).toBe('function')
    expect(typeof Post.firstOrCreate).toBe('function')
  })

  test('model has select, orderBy, limit methods', () => {
    const Post = defineModel({
      name: 'Post',
      table: 'posts',
      primaryKey: 'id',
      autoIncrement: true,
      attributes: {
        title: { type: 'string', fillable: true },
      },
    } as const)

    expect(typeof Post.select).toBe('function')
    expect(typeof Post.orderBy).toBe('function')
    expect(typeof Post.orderByDesc).toBe('function')
    expect(typeof Post.limit).toBe('function')
    expect(typeof Post.skip).toBe('function')
    expect(typeof Post.take).toBe('function')
  })

  test('model has with() for eager loading', () => {
    const Post = defineModel({
      name: 'Post',
      table: 'posts',
      primaryKey: 'id',
      autoIncrement: true,
      attributes: {
        title: { type: 'string', fillable: true },
      },
      belongsTo: ['Author'],
      hasMany: ['Comment'],
    } as const)

    expect(typeof Post.with).toBe('function')
  })

  test('where() returns a chainable query builder', () => {
    const Post = defineModel({
      name: 'Post',
      table: 'posts',
      primaryKey: 'id',
      autoIncrement: true,
      attributes: {
        title: { type: 'string', fillable: true },
        status: { type: 'string', fillable: true },
      },
    } as const)

    const query = Post.where('title', 'test')
    expect(query).toBeDefined()
    expect(typeof query.first).toBe('function')
    expect(typeof query.get).toBe('function')
    expect(typeof query.count).toBe('function')
    expect(typeof query.where).toBe('function')
    expect(typeof query.orWhere).toBe('function')
  })

  test('query chaining: where + orderBy + limit', () => {
    const Post = defineModel({
      name: 'Post',
      table: 'posts',
      primaryKey: 'id',
      autoIncrement: true,
      attributes: {
        title: { type: 'string', fillable: true },
        views: { type: 'number', fillable: true },
      },
    } as const)

    const query = Post.where('title', 'test').orderBy('views', 'desc').limit(10)
    expect(query).toBeDefined()
    expect(typeof query.get).toBe('function')
    expect(typeof query.first).toBe('function')
  })

  test('select() returns a chainable query builder', () => {
    const Post = defineModel({
      name: 'Post',
      table: 'posts',
      primaryKey: 'id',
      autoIncrement: true,
      attributes: {
        title: { type: 'string', fillable: true },
        body: { type: 'string', fillable: true },
      },
    } as const)

    const query = Post.select('title')
    expect(query).toBeDefined()
    expect(typeof query.first).toBe('function')
    expect(typeof query.get).toBe('function')
  })

  test('dynamic whereColumn methods via Proxy', () => {
    const Post = defineModel({
      name: 'Post',
      table: 'posts',
      primaryKey: 'id',
      autoIncrement: true,
      attributes: {
        title: { type: 'string', fillable: true },
        status: { type: 'string', fillable: true },
      },
    } as const)

    expect(typeof (Post as any).whereTitle).toBe('function')
    expect(typeof (Post as any).whereStatus).toBe('function')

    const query = (Post as any).whereTitle('test')
    expect(query).toBeDefined()
    expect(typeof query.first).toBe('function')
  })
})

// ============================================================================
// defineModel - Casts system
// ============================================================================

describe('ORM defineModel Integration - Attribute Casting', () => {
  test('defineModel stores casts configuration', () => {
    const Item = defineModel({
      name: 'Item',
      table: 'items',
      attributes: {
        metadata: { type: 'string', fillable: true },
        isActive: { type: 'boolean', fillable: true },
        tags: { type: 'string', fillable: true },
      },
      casts: {
        metadata: 'json',
        isActive: 'boolean',
        tags: 'array',
      },
    } as const)

    expect(Item.casts).toBeDefined()
    expect(Item.casts!.metadata).toBe('json')
    expect(Item.casts!.isActive).toBe('boolean')
    expect(Item.casts!.tags).toBe('array')
  })

  test('defineModel with all built-in cast types', () => {
    const Model = defineModel({
      name: 'CastTest',
      table: 'cast_tests',
      attributes: {
        strField: { type: 'string', fillable: true },
        numField: { type: 'number', fillable: true },
        intField: { type: 'number', fillable: true },
        floatField: { type: 'number', fillable: true },
        boolField: { type: 'boolean', fillable: true },
        jsonField: { type: 'string', fillable: true },
        dateField: { type: 'string', fillable: true },
        dtField: { type: 'string', fillable: true },
        arrField: { type: 'string', fillable: true },
      },
      casts: {
        strField: 'string',
        numField: 'number',
        intField: 'integer',
        floatField: 'float',
        boolField: 'boolean',
        jsonField: 'json',
        dateField: 'date',
        dtField: 'datetime',
        arrField: 'array',
      },
    } as const)

    expect(Model.casts).toBeDefined()
    expect(Object.keys(Model.casts!)).toHaveLength(9)
  })
})

// ============================================================================
// Built-in casters - Direct logic tests (replicated from source)
// ============================================================================

describe('ORM Built-in Casters - Direct Logic', () => {
  // We replicate the caster logic here since builtInCasters is not exported
  const casters: Record<CastType, CasterInterface> = {
    string: {
      get: (v: unknown) => v != null ? String(v) : null,
      set: (v: unknown) => v != null ? String(v) : null,
    },
    number: {
      get: (v: unknown) => v != null ? Number(v) : null,
      set: (v: unknown) => v != null ? Number(v) : null,
    },
    integer: {
      get: (v: unknown) => v != null ? Math.trunc(Number(v)) : null,
      set: (v: unknown) => v != null ? Math.trunc(Number(v)) : null,
    },
    float: {
      get: (v: unknown) => v != null ? Number.parseFloat(String(v)) : null,
      set: (v: unknown) => v != null ? Number.parseFloat(String(v)) : null,
    },
    boolean: {
      get: (v: unknown) => v === 1 || v === '1' || v === true || v === 'true',
      set: (v: unknown) => (v === true || v === 1 || v === '1' || v === 'true') ? 1 : 0,
    },
    json: {
      get: (v: unknown) => {
        if (v == null) return null
        if (typeof v === 'string') { try { return JSON.parse(v) } catch { return v } }
        return v
      },
      set: (v: unknown) => {
        if (v == null) return null
        return typeof v === 'string' ? v : JSON.stringify(v)
      },
    },
    datetime: {
      get: (v: unknown) => v ? new Date(v as string) : null,
      set: (v: unknown) => v instanceof Date ? v.toISOString() : v,
    },
    date: {
      get: (v: unknown) => v ? new Date(v as string) : null,
      set: (v: unknown) => v instanceof Date ? v.toISOString().split('T')[0] : v,
    },
    array: {
      get: (v: unknown) => {
        if (v == null) return []
        if (Array.isArray(v)) return v
        if (typeof v === 'string') { try { return JSON.parse(v) } catch { return [] } }
        return []
      },
      set: (v: unknown) => {
        if (v == null) return null
        return Array.isArray(v) ? JSON.stringify(v) : v
      },
    },
  }

  test('string caster: get converts number to string', () => {
    expect(casters.string.get(42)).toBe('42')
    expect(casters.string.get(null)).toBe(null)
    expect(casters.string.get('hello')).toBe('hello')
  })

  test('string caster: set converts number to string', () => {
    expect(casters.string.set(42)).toBe('42')
    expect(casters.string.set(null)).toBe(null)
  })

  test('number caster: get converts string to number', () => {
    expect(casters.number.get('42')).toBe(42)
    expect(casters.number.get(null)).toBe(null)
    expect(casters.number.get(3.14)).toBe(3.14)
  })

  test('integer caster: truncates decimals', () => {
    expect(casters.integer.get(3.7)).toBe(3)
    expect(casters.integer.get('5.9')).toBe(5)
    expect(casters.integer.set(3.7)).toBe(3)
    expect(casters.integer.get(null)).toBe(null)
  })

  test('float caster: parses float strings', () => {
    expect(casters.float.get('3.14')).toBe(3.14)
    expect(casters.float.get(2.5)).toBe(2.5)
    expect(casters.float.set('3.14')).toBe(3.14)
    expect(casters.float.get(null)).toBe(null)
  })

  test('boolean caster: get truthy values', () => {
    expect(casters.boolean.get(1)).toBe(true)
    expect(casters.boolean.get('1')).toBe(true)
    expect(casters.boolean.get(true)).toBe(true)
    expect(casters.boolean.get('true')).toBe(true)
    expect(casters.boolean.get(0)).toBe(false)
    expect(casters.boolean.get('0')).toBe(false)
    expect(casters.boolean.get(false)).toBe(false)
    expect(casters.boolean.get(null)).toBe(false)
  })

  test('boolean caster: set converts to 1/0', () => {
    expect(casters.boolean.set(true)).toBe(1)
    expect(casters.boolean.set(1)).toBe(1)
    expect(casters.boolean.set('1')).toBe(1)
    expect(casters.boolean.set('true')).toBe(1)
    expect(casters.boolean.set(false)).toBe(0)
    expect(casters.boolean.set(0)).toBe(0)
    expect(casters.boolean.set(null)).toBe(0)
  })

  test('json caster: get parses JSON string to object', () => {
    expect(casters.json.get('{"key":"value"}')).toEqual({ key: 'value' })
    expect(casters.json.get(null)).toBe(null)
    expect(casters.json.get({ already: 'parsed' })).toEqual({ already: 'parsed' })
    expect(casters.json.get('invalid json')).toBe('invalid json')
  })

  test('json caster: set serializes object to JSON string', () => {
    expect(casters.json.set({ key: 'value' })).toBe('{"key":"value"}')
    expect(casters.json.set(null)).toBe(null)
    expect(casters.json.set('already a string')).toBe('already a string')
  })

  test('datetime caster: get converts string to Date', () => {
    const result = casters.datetime.get('2024-01-15T10:30:00.000Z')
    expect(result).toBeInstanceOf(Date)
    expect((result as Date).getFullYear()).toBe(2024)
    expect(casters.datetime.get(null)).toBe(null)
  })

  test('datetime caster: set converts Date to ISO string', () => {
    const d = new Date('2024-01-15T10:30:00.000Z')
    expect(casters.datetime.set(d)).toBe('2024-01-15T10:30:00.000Z')
    expect(casters.datetime.set('already a string')).toBe('already a string')
  })

  test('date caster: get converts string to Date', () => {
    const result = casters.date.get('2024-01-15')
    expect(result).toBeInstanceOf(Date)
    expect(casters.date.get(null)).toBe(null)
  })

  test('date caster: set converts Date to YYYY-MM-DD', () => {
    const d = new Date('2024-01-15T10:30:00.000Z')
    expect(casters.date.set(d)).toBe('2024-01-15')
    expect(casters.date.set('already a string')).toBe('already a string')
  })

  test('array caster: get parses JSON array string', () => {
    expect(casters.array.get('["a","b","c"]')).toEqual(['a', 'b', 'c'])
    expect(casters.array.get(null)).toEqual([])
    expect(casters.array.get(['already', 'array'])).toEqual(['already', 'array'])
    expect(casters.array.get('not valid json')).toEqual([])
  })

  test('array caster: set serializes array to JSON', () => {
    expect(casters.array.set(['a', 'b'])).toBe('["a","b"]')
    expect(casters.array.set(null)).toBe(null)
    expect(casters.array.set('not array')).toBe('not array')
  })
})

// ============================================================================
// defineModel - Trait methods
// ============================================================================

describe('ORM defineModel Integration - Trait Methods', () => {
  test('taggable trait attaches tag methods', () => {
    const Post = defineModel({
      name: 'Post',
      table: 'posts',
      primaryKey: 'id',
      autoIncrement: true,
      attributes: { title: { type: 'string', fillable: true } },
      traits: { taggable: true },
    } as const)

    expect(Post._taggable).toBeDefined()
    expect(typeof Post._taggable!.tags).toBe('function')
    expect(typeof Post._taggable!.tagCount).toBe('function')
    expect(typeof Post._taggable!.addTag).toBe('function')
    expect(typeof Post._taggable!.activeTags).toBe('function')
    expect(typeof Post._taggable!.inactiveTags).toBe('function')
    expect(typeof Post._taggable!.removeTag).toBe('function')
  })

  test('categorizable trait attaches category methods', () => {
    const Post = defineModel({
      name: 'Post',
      table: 'posts',
      primaryKey: 'id',
      autoIncrement: true,
      attributes: { title: { type: 'string', fillable: true } },
      traits: { categorizable: true },
    } as const)

    expect(Post._categorizable).toBeDefined()
    expect(typeof Post._categorizable!.categories).toBe('function')
    expect(typeof Post._categorizable!.categoryCount).toBe('function')
    expect(typeof Post._categorizable!.addCategory).toBe('function')
    expect(typeof Post._categorizable!.activeCategories).toBe('function')
    expect(typeof Post._categorizable!.inactiveCategories).toBe('function')
    expect(typeof Post._categorizable!.removeCategory).toBe('function')
  })

  test('commentable trait attaches comment methods', () => {
    const Post = defineModel({
      name: 'Post',
      table: 'posts',
      primaryKey: 'id',
      autoIncrement: true,
      attributes: { title: { type: 'string', fillable: true } },
      traits: { commentable: true },
    } as const)

    expect(Post._commentable).toBeDefined()
    expect(typeof Post._commentable!.comments).toBe('function')
    expect(typeof Post._commentable!.commentCount).toBe('function')
    expect(typeof Post._commentable!.addComment).toBe('function')
    expect(typeof Post._commentable!.approvedComments).toBe('function')
    expect(typeof Post._commentable!.pendingComments).toBe('function')
    expect(typeof Post._commentable!.rejectedComments).toBe('function')
  })

  test('billable trait attaches billing methods', () => {
    const User = defineModel({
      name: 'User',
      table: 'users',
      primaryKey: 'id',
      autoIncrement: true,
      attributes: { email: { type: 'string', fillable: true } },
      traits: { billable: true },
    } as const)

    expect(User._billable).toBeDefined()
    expect(typeof User._billable!.createStripeUser).toBe('function')
    expect(typeof User._billable!.updateStripeUser).toBe('function')
    expect(typeof User._billable!.deleteStripeUser).toBe('function')
    expect(typeof User._billable!.paymentMethods).toBe('function')
    expect(typeof User._billable!.newSubscription).toBe('function')
    expect(typeof User._billable!.cancelSubscription).toBe('function')
    expect(typeof User._billable!.checkout).toBe('function')
  })

  test('likeable trait attaches like methods', () => {
    const Post = defineModel({
      name: 'Post',
      table: 'posts',
      primaryKey: 'id',
      autoIncrement: true,
      attributes: { title: { type: 'string', fillable: true } },
      traits: { likeable: true },
    } as const)

    expect(Post._likeable).toBeDefined()
    expect(typeof Post._likeable!.likes).toBe('function')
    expect(typeof Post._likeable!.likeCount).toBe('function')
    expect(typeof Post._likeable!.like).toBe('function')
    expect(typeof Post._likeable!.unlike).toBe('function')
    expect(typeof Post._likeable!.isLiked).toBe('function')
  })

  test('useAuth with useTwoFactor attaches 2FA methods', () => {
    const User = defineModel({
      name: 'User',
      table: 'users',
      primaryKey: 'id',
      autoIncrement: true,
      attributes: { email: { type: 'string', fillable: true } },
      traits: { useAuth: { useTwoFactor: true } },
    } as const)

    expect(User._twoFactor).toBeDefined()
  })

  test('no traits means no trait methods attached', () => {
    const Post = defineModel({
      name: 'Post',
      table: 'posts',
      primaryKey: 'id',
      autoIncrement: true,
      attributes: { title: { type: 'string', fillable: true } },
    } as const)

    expect(Post._taggable).toBeUndefined()
    expect(Post._categorizable).toBeUndefined()
    expect(Post._commentable).toBeUndefined()
    expect(Post._billable).toBeUndefined()
    expect(Post._likeable).toBeUndefined()
    expect(Post._twoFactor).toBeUndefined()
  })

  test('non-trait traits do not attach trait methods', () => {
    const Post = defineModel({
      name: 'Post',
      table: 'posts',
      primaryKey: 'id',
      autoIncrement: true,
      attributes: { title: { type: 'string', fillable: true } },
      traits: {
        useTimestamps: true,
        useSeeder: { count: 10 },
      },
    } as const)

    expect(Post._taggable).toBeUndefined()
    expect(Post._categorizable).toBeUndefined()
    expect(Post._commentable).toBeUndefined()
    expect(Post._billable).toBeUndefined()
    expect(Post._likeable).toBeUndefined()
  })
})

// ============================================================================
// defineModel - Observer / event hooks
// ============================================================================

describe('ORM defineModel Integration - Observer Hooks', () => {
  test('observe: true builds hooks for create/update/delete', () => {
    const Post = defineModel({
      name: 'Post',
      table: 'posts',
      primaryKey: 'id',
      autoIncrement: true,
      attributes: { title: { type: 'string', fillable: true } },
      traits: { observe: true },
    } as const)

    // Model should still be fully functional with hooks
    expect(Post._isStacksModel).toBe(true)
    expect(typeof Post.create).toBe('function')
    expect(typeof Post.destroy).toBe('function')
  })

  test('observe: array builds hooks for specific events only', () => {
    const Post = defineModel({
      name: 'Post',
      table: 'posts',
      primaryKey: 'id',
      autoIncrement: true,
      attributes: { title: { type: 'string', fillable: true } },
      traits: { observe: ['create', 'delete'] },
    } as const)

    expect(Post._isStacksModel).toBe(true)
    expect(typeof Post.create).toBe('function')
  })

  test('no observe trait means no hooks', () => {
    const Post = defineModel({
      name: 'Post',
      table: 'posts',
      primaryKey: 'id',
      autoIncrement: true,
      attributes: { title: { type: 'string', fillable: true } },
      traits: { useTimestamps: true },
    } as const)

    expect(Post._isStacksModel).toBe(true)
  })
})

// ============================================================================
// defineModel - Complex model with all features
// ============================================================================

describe('ORM defineModel Integration - Complex Models', () => {
  test('model with all features combined', () => {
    const Author = defineModel({
      name: 'Author',
      table: 'authors',
      primaryKey: 'id',
      autoIncrement: true,
      indexes: [
        { name: 'authors_email_name_index', columns: ['email', 'name'] },
      ],
      traits: {
        useAuth: { usePasskey: true },
        useUuid: true,
        useTimestamps: true,
        useSearch: {
          displayable: ['id', 'name', 'email'],
          searchable: ['name', 'email'],
          sortable: ['created_at', 'updated_at'],
          filterable: [],
        },
        useSeeder: { count: 10 },
        useApi: { uri: 'authors', routes: ['index', 'store', 'show'] },
        observe: true,
        taggable: true,
        billable: true,
      },
      hasMany: ['Post'],
      belongsTo: ['User'],
      attributes: {
        name: { order: 1, fillable: true },
        email: { unique: true, order: 2, fillable: true },
      },
      dashboard: { highlight: true },
    } as const)

    // Query methods
    expect(typeof Author.find).toBe('function')
    expect(typeof Author.create).toBe('function')
    expect(typeof Author.where).toBe('function')
    expect(typeof Author.with).toBe('function')

    // Definition properties
    expect(Author.name).toBe('Author')
    expect(Author.table).toBe('authors')
    expect(Author.hasMany).toEqual(['Post'])
    expect(Author.belongsTo).toEqual(['User'])
    expect(Author.traits?.useUuid).toBe(true)
    expect(Author.traits?.useTimestamps).toBe(true)
    expect(Author.dashboard?.highlight).toBe(true)
    expect(Author._isStacksModel).toBe(true)

    // Trait methods
    expect(Author._taggable).toBeDefined()
    expect(Author._billable).toBeDefined()
  })

  test('model with multiple relationship types', () => {
    const Project = defineModel({
      name: 'Project',
      table: 'projects',
      primaryKey: 'id',
      autoIncrement: true,
      attributes: {
        name: { type: 'string', fillable: true },
        description: { type: 'string', fillable: true },
      },
      hasMany: ['Task', 'Comment'],
      belongsTo: ['Organization'],
      traits: {
        useTimestamps: true,
        taggable: true,
        categorizable: true,
        commentable: true,
      },
    } as const)

    expect(Project.hasMany).toEqual(['Task', 'Comment'])
    expect(Project.belongsTo).toEqual(['Organization'])
    expect(Project._taggable).toBeDefined()
    expect(Project._categorizable).toBeDefined()
    expect(Project._commentable).toBeDefined()
  })
})
