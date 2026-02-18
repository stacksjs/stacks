import { describe, expect, it } from 'bun:test'
import { defineModel } from '../../storage/framework/core/orm/src/define-model'

describe('defineModel', () => {
  describe('basic model creation', () => {
    it('should return a model object with query methods', () => {
      const Post = defineModel({
        name: 'Post',
        table: 'posts',
        primaryKey: 'id',
        autoIncrement: true,
        attributes: {
          title: {
            type: 'string',
            fillable: true,
          },
          body: {
            type: 'string',
            fillable: true,
          },
        },
      } as const)

      // Static query methods
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

    it('should return a model with select and orderBy methods', () => {
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

    it('should return a model with relation methods', () => {
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
  })

  describe('definition spreading', () => {
    it('should spread definition properties onto the model', () => {
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
          useSeeder: { count: 10 },
        },
      } as const)

      expect(Post.name).toBe('Post')
      expect(Post.table).toBe('posts')
      expect(Post.primaryKey).toBe('id')
      expect(Post.autoIncrement).toBe(true)
      expect(Post.attributes).toBeDefined()
      expect(Post.attributes.title).toBeDefined()
      expect(Post.traits).toBeDefined()
      expect(Post.traits?.useTimestamps).toBe(true)
    })

    it('should preserve relation arrays from definition', () => {
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

    it('should preserve dashboard config from definition', () => {
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
  })

  describe('getDefinition', () => {
    it('should return the original definition', () => {
      const definition = {
        name: 'Post',
        table: 'posts',
        primaryKey: 'id',
        autoIncrement: true,
        attributes: {
          title: { type: 'string', fillable: true },
          views: { type: 'number', fillable: true },
        },
        belongsTo: ['Author'],
      } as const

      const Post = defineModel(definition)

      const retrieved = Post.getDefinition()
      expect(retrieved).toBe(definition) // Same reference
      expect(retrieved.name).toBe('Post')
      expect(retrieved.table).toBe('posts')
      expect(retrieved.attributes.title.type).toBe('string')
    })
  })

  describe('_isStacksModel flag', () => {
    it('should mark the model with _isStacksModel', () => {
      const Post = defineModel({
        name: 'Post',
        table: 'posts',
        primaryKey: 'id',
        autoIncrement: true,
        attributes: {
          title: { type: 'string', fillable: true },
        },
      } as const)

      expect(Post._isStacksModel).toBe(true)
    })
  })

  describe('event hooks from traits.observe', () => {
    it('should build hooks when observe is true', () => {
      const Post = defineModel({
        name: 'Post',
        table: 'posts',
        primaryKey: 'id',
        autoIncrement: true,
        attributes: {
          title: { type: 'string', fillable: true },
        },
        traits: {
          observe: true,
        },
      } as const)

      // Model should still function — hooks are built internally
      expect(Post._isStacksModel).toBe(true)
      expect(typeof Post.create).toBe('function')
    })

    it('should build hooks for specific events when observe is an array', () => {
      const Post = defineModel({
        name: 'Post',
        table: 'posts',
        primaryKey: 'id',
        autoIncrement: true,
        attributes: {
          title: { type: 'string', fillable: true },
        },
        traits: {
          observe: ['create', 'delete'],
        },
      } as const)

      expect(Post._isStacksModel).toBe(true)
      expect(typeof Post.create).toBe('function')
    })

    it('should not build hooks when observe is not set', () => {
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
        },
      } as const)

      expect(Post._isStacksModel).toBe(true)
    })
  })

  describe('trait methods', () => {
    it('should attach taggable methods when taggable trait is set', () => {
      const Post = defineModel({
        name: 'Post',
        table: 'posts',
        primaryKey: 'id',
        autoIncrement: true,
        attributes: {
          title: { type: 'string', fillable: true },
        },
        traits: {
          taggable: true,
        },
      } as const)

      expect(Post._taggable).toBeDefined()
      expect(typeof Post._taggable.tags).toBe('function')
      expect(typeof Post._taggable.tagCount).toBe('function')
      expect(typeof Post._taggable.addTag).toBe('function')
      expect(typeof Post._taggable.activeTags).toBe('function')
      expect(typeof Post._taggable.inactiveTags).toBe('function')
      expect(typeof Post._taggable.removeTag).toBe('function')
    })

    it('should attach categorizable methods when categorizable trait is set', () => {
      const Post = defineModel({
        name: 'Post',
        table: 'posts',
        primaryKey: 'id',
        autoIncrement: true,
        attributes: {
          title: { type: 'string', fillable: true },
        },
        traits: {
          categorizable: true,
        },
      } as const)

      expect(Post._categorizable).toBeDefined()
      expect(typeof Post._categorizable.categories).toBe('function')
      expect(typeof Post._categorizable.categoryCount).toBe('function')
      expect(typeof Post._categorizable.addCategory).toBe('function')
      expect(typeof Post._categorizable.activeCategories).toBe('function')
      expect(typeof Post._categorizable.inactiveCategories).toBe('function')
      expect(typeof Post._categorizable.removeCategory).toBe('function')
    })

    it('should attach commentable methods when commentables trait is set', () => {
      const Post = defineModel({
        name: 'Post',
        table: 'posts',
        primaryKey: 'id',
        autoIncrement: true,
        attributes: {
          title: { type: 'string', fillable: true },
        },
        traits: {
          commentables: true,
        },
      } as const)

      expect(Post._commentable).toBeDefined()
      expect(typeof Post._commentable.comments).toBe('function')
      expect(typeof Post._commentable.commentCount).toBe('function')
      expect(typeof Post._commentable.addComment).toBe('function')
      expect(typeof Post._commentable.approvedComments).toBe('function')
      expect(typeof Post._commentable.pendingComments).toBe('function')
      expect(typeof Post._commentable.rejectedComments).toBe('function')
    })

    it('should attach billable methods when billable trait is set', () => {
      const User = defineModel({
        name: 'User',
        table: 'users',
        primaryKey: 'id',
        autoIncrement: true,
        attributes: {
          email: { type: 'string', fillable: true },
        },
        traits: {
          billable: true,
        },
      } as const)

      expect(User._billable).toBeDefined()
      expect(typeof User._billable.createStripeUser).toBe('function')
      expect(typeof User._billable.updateStripeUser).toBe('function')
      expect(typeof User._billable.deleteStripeUser).toBe('function')
      expect(typeof User._billable.paymentMethods).toBe('function')
      expect(typeof User._billable.newSubscription).toBe('function')
      expect(typeof User._billable.cancelSubscription).toBe('function')
      expect(typeof User._billable.checkout).toBe('function')
    })

    it('should attach likeable methods when likeable trait is set', () => {
      const Post = defineModel({
        name: 'Post',
        table: 'posts',
        primaryKey: 'id',
        autoIncrement: true,
        attributes: {
          title: { type: 'string', fillable: true },
        },
        traits: {
          likeable: true,
        },
      } as const)

      expect(Post._likeable).toBeDefined()
      expect(typeof Post._likeable.likes).toBe('function')
      expect(typeof Post._likeable.likeCount).toBe('function')
      expect(typeof Post._likeable.like).toBe('function')
      expect(typeof Post._likeable.unlike).toBe('function')
      expect(typeof Post._likeable.isLiked).toBe('function')
    })

    it('should not attach trait methods when no traits are set', () => {
      const Post = defineModel({
        name: 'Post',
        table: 'posts',
        primaryKey: 'id',
        autoIncrement: true,
        attributes: {
          title: { type: 'string', fillable: true },
        },
      } as const)

      expect(Post._taggable).toBeUndefined()
      expect(Post._categorizable).toBeUndefined()
      expect(Post._commentable).toBeUndefined()
      expect(Post._billable).toBeUndefined()
      expect(Post._likeable).toBeUndefined()
    })

    it('should not attach trait methods when traits exist but specific traits are not set', () => {
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

  describe('query builder chaining', () => {
    it('should return a query builder from where()', () => {
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

    it('should return a query builder from select()', () => {
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

    it('should return a query builder from orderBy()', () => {
      const Post = defineModel({
        name: 'Post',
        table: 'posts',
        primaryKey: 'id',
        autoIncrement: true,
        attributes: {
          title: { type: 'string', fillable: true },
        },
      } as const)

      const query = Post.orderBy('title', 'asc')
      expect(query).toBeDefined()
      expect(typeof query.first).toBe('function')
    })

    it('should support chaining where + orderBy + limit', () => {
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
  })

  describe('model with complex definition', () => {
    it('should handle a model with all features', () => {
      const Author = defineModel({
        name: 'Author',
        table: 'authors',
        primaryKey: 'id',
        autoIncrement: true,
        indexes: [
          {
            name: 'authors_email_name_index',
            columns: ['email', 'name'],
          },
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
        },
        hasMany: ['Post'],
        belongsTo: ['User'],
        attributes: {
          name: {
            order: 1,
            fillable: true,
          },
          email: {
            unique: true,
            order: 2,
            fillable: true,
          },
        },
        dashboard: { highlight: true },
      } as const)

      // All static methods available
      expect(typeof Author.find).toBe('function')
      expect(typeof Author.create).toBe('function')
      expect(typeof Author.where).toBe('function')
      expect(typeof Author.with).toBe('function')

      // Definition properties accessible
      expect(Author.name).toBe('Author')
      expect(Author.table).toBe('authors')
      expect(Author.hasMany).toEqual(['Post'])
      expect(Author.belongsTo).toEqual(['User'])
      expect(Author.traits?.useUuid).toBe(true)
      expect(Author.traits?.useTimestamps).toBe(true)
      expect(Author.dashboard?.highlight).toBe(true)
      expect(Author._isStacksModel).toBe(true)
    })
  })

  describe('dynamic where methods', () => {
    it('should support dynamic whereColumn methods via Proxy', () => {
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

      // Dynamic where methods are created via Proxy
      expect(typeof (Post as any).whereTitle).toBe('function')
      expect(typeof (Post as any).whereStatus).toBe('function')

      const query = (Post as any).whereTitle('test')
      expect(query).toBeDefined()
      expect(typeof query.first).toBe('function')
    })
  })

  describe('model without optional fields', () => {
    it('should handle minimal definition', () => {
      const Simple = defineModel({
        name: 'Simple',
        table: 'simples',
        attributes: {
          value: { type: 'string' },
        },
      } as const)

      expect(Simple.name).toBe('Simple')
      expect(Simple.table).toBe('simples')
      expect(typeof Simple.find).toBe('function')
      expect(typeof Simple.create).toBe('function')
      expect(Simple._isStacksModel).toBe(true)
    })
  })
})
