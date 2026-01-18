---
title: Models
description: Learn how to define and use ORM models in Stacks applications
---

# Models

Stacks provides a powerful, type-safe ORM that combines Laravel's Eloquent-like patterns with TypeScript's static typing. Models define your database schema, relationships, validation rules, and API endpoints in a single, declarative configuration.

## Introduction

Models in Stacks are configuration objects that define:
- Database table structure and attributes
- Relationships between models
- Validation rules
- API route generation
- Factory definitions for testing
- Timestamps, soft deletes, and other traits

Models are stored in `app/Models/` for your application models and `storage/framework/defaults/models/` for framework defaults.

## Defining Models

### Basic Model Structure

```typescript
// app/Models/Post.ts
import type { Model } from '@stacksjs/types'
import { schema } from '@stacksjs/validation'

export default {
  name: 'Post',
  table: 'posts',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useTimestamps: true,
    useUuid: true,
  },

  attributes: {
    title: {
      required: true,
      fillable: true,
      validation: {
        rule: schema.string().min(3).max(255),
        message: {
          min: 'Title must be at least 3 characters',
          max: 'Title cannot exceed 255 characters',
        },
      },
    },

    content: {
      required: true,
      fillable: true,
      validation: {
        rule: schema.string().min(10),
        message: {
          min: 'Content must be at least 10 characters',
        },
      },
    },

    published: {
      required: false,
      fillable: true,
      default: false,
      validation: {
        rule: schema.boolean(),
      },
    },
  },
} satisfies Model
```

### Model Options

| Option | Type | Description |
|--------|------|-------------|
| `name` | `string` | Model name (singular, PascalCase) |
| `table` | `string` | Database table name (optional, auto-generated) |
| `primaryKey` | `string` | Primary key column (default: `id`) |
| `autoIncrement` | `boolean` | Auto-increment primary key (default: `true`) |
| `traits` | `object` | Model behaviors and features |
| `attributes` | `object` | Column definitions |
| `hasOne` | `array` | Has-one relationships |
| `hasMany` | `array` | Has-many relationships |
| `belongsTo` | `array` | Belongs-to relationships |
| `belongsToMany` | `array` | Many-to-many relationships |

## Attributes

### Attribute Options

```typescript
attributes: {
  email: {
    // Basic options
    required: true,          // NOT NULL constraint
    unique: true,            // UNIQUE constraint
    fillable: true,          // Mass assignable
    hidden: false,           // Hidden from JSON output
    guarded: false,          // Protected from mass assignment

    // Default value
    default: 'guest@example.com',

    // Validation
    validation: {
      rule: schema.string().email(),
      message: 'Please enter a valid email address',
    },

    // Factory for seeding
    factory: faker => faker.internet.email(),
  },
}
```

### Validation Rules

Use the `schema` validator for type-safe validation:

```typescript
import { schema } from '@stacksjs/validation'

attributes: {
  // String validation
  name: {
    validation: {
      rule: schema.string().min(2).max(100),
    },
  },

  // Email validation
  email: {
    validation: {
      rule: schema.string().email(),
    },
  },

  // Number validation
  age: {
    validation: {
      rule: schema.number().min(0).max(150),
    },
  },

  // Enum validation
  status: {
    validation: {
      rule: schema.enum(['draft', 'published', 'archived']),
    },
  },

  // Boolean validation
  isActive: {
    validation: {
      rule: schema.boolean(),
    },
  },

  // Custom validation message
  password: {
    validation: {
      rule: schema.string().min(8).max(255),
      message: {
        min: 'Password must be at least 8 characters',
        max: 'Password cannot exceed 255 characters',
      },
    },
  },
}
```

### Factory Definitions

Define how test data is generated:

```typescript
attributes: {
  name: {
    factory: faker => faker.person.fullName(),
  },

  email: {
    factory: faker => faker.internet.email(),
  },

  status: {
    factory: faker => faker.helpers.arrayElement(['active', 'inactive', 'pending']),
  },

  // Factory with access to other attributes
  slug: {
    factory: (faker, attributes) => {
      const name = attributes?.name || faker.lorem.word()
      return name.toLowerCase().replace(/\s+/g, '-')
    },
  },
}
```

## Relationships

### Has One

Define a one-to-one relationship:

```typescript
// app/Models/User.ts
export default {
  name: 'User',
  table: 'users',

  hasOne: ['Profile'],

  // Or with configuration
  hasOne: [
    {
      model: 'Profile',
      foreignKey: 'user_id',
      relationName: 'profile',
    },
  ],
} satisfies Model
```

### Has Many

Define a one-to-many relationship:

```typescript
// app/Models/User.ts
export default {
  name: 'User',
  table: 'users',

  hasMany: ['Post', 'Comment'],

  // Or with configuration
  hasMany: [
    {
      model: 'Post',
      foreignKey: 'author_id',
      relationName: 'posts',
    },
    {
      model: 'Comment',
      foreignKey: 'user_id',
    },
  ],
} satisfies Model
```

### Belongs To

Define an inverse one-to-many relationship:

```typescript
// app/Models/Post.ts
export default {
  name: 'Post',
  table: 'posts',

  belongsTo: ['User'],

  // Or with configuration
  belongsTo: [
    {
      model: 'User',
      foreignKey: 'author_id',
      relationName: 'author',
    },
  ],
} satisfies Model
```

### Belongs To Many

Define a many-to-many relationship:

```typescript
// app/Models/Post.ts
export default {
  name: 'Post',
  table: 'posts',

  belongsToMany: ['Tag'],

  // With pivot table configuration
  belongsToMany: [
    {
      model: 'Tag',
      pivotTable: 'post_tags',
      firstForeignKey: 'post_id',
      secondForeignKey: 'tag_id',
    },
  ],
} satisfies Model
```

### Has One Through

Define a has-one-through relationship:

```typescript
// app/Models/Country.ts
export default {
  name: 'Country',
  table: 'countries',

  hasOneThrough: [
    {
      model: 'Capital',
      through: 'State',
      throughForeignKey: 'country_id',
      relationName: 'capital',
    },
  ],
} satisfies Model
```

### Polymorphic Relationships (Morph)

Define polymorphic relationships:

```typescript
// app/Models/Comment.ts
export default {
  name: 'Comment',
  table: 'comments',

  morphOne: {
    model: 'Image',
    morphName: 'imageable',
    type: 'imageable_type',
    id: 'imageable_id',
  },
} satisfies Model
```

## Traits

### Available Traits

```typescript
traits: {
  // Timestamps (created_at, updated_at)
  useTimestamps: true,

  // UUID column
  useUuid: true,

  // Soft deletes (deleted_at)
  useSoftDeletes: true,

  // Observable (emit events on changes)
  observe: true,

  // Searchable (Algolia/MeiliSearch integration)
  searchable: true,

  // Billable (Stripe integration)
  billable: true,

  // Auto-generate API routes
  useApi: {
    uri: 'posts',
    routes: ['index', 'store', 'show', 'update', 'destroy'],
    middleware: ['auth'],
  },

  // Seeder configuration
  useSeeder: {
    count: 50,
  },
}
```

### API Trait Configuration

Generate RESTful API routes automatically:

```typescript
traits: {
  useApi: {
    // Base URI for routes
    uri: 'posts',

    // Routes to generate
    routes: ['index', 'store', 'show', 'update', 'destroy'],

    // Or with custom action paths
    routes: {
      index: 'PostIndexAction',
      store: 'PostStoreAction',
      show: 'PostShowAction',
      update: 'PostUpdateAction',
      destroy: 'PostDestroyAction',
    },

    // Middleware for all routes
    middleware: ['auth', 'throttle:60,1'],
  },
}
```

This generates:
- `GET /posts` - List posts
- `POST /posts` - Create post
- `GET /posts/{id}` - Show post
- `PATCH /posts/{id}` - Update post
- `DELETE /posts/{id}` - Delete post

## Querying Models

### Basic Queries

```typescript
import { Post } from '@stacksjs/orm'

// Find by ID
const post = await Post.find(1)

// Find or fail
const post = await Post.findOrFail(1)

// Get all records
const posts = await Post.all()

// First record
const post = await Post.first()

// Last record
const post = await Post.last()
```

### Where Clauses

```typescript
// Simple where
const posts = await Post.where('status', 'published').get()

// With operator
const posts = await Post.where('views', '>', 100).get()

// Multiple conditions
const posts = await Post
  .where('status', 'published')
  .where('author_id', 1)
  .get()

// Or where
const posts = await Post
  .where('status', 'published')
  .orWhere([['status', 'draft'], ['author_id', 1]])
  .get()

// Where in
const posts = await Post.whereIn('id', [1, 2, 3]).get()

// Where not in
const posts = await Post.whereNotIn('status', ['archived', 'deleted']).get()

// Where null
const posts = await Post.whereNull('deleted_at').get()

// Where not null
const posts = await Post.whereNotNull('published_at').get()

// Where between
const posts = await Post.whereBetween('created_at', ['2024-01-01', '2024-12-31']).get()

// Where like
const posts = await Post.whereLike('title', '%TypeScript%').get()
```

### Ordering and Limiting

```typescript
// Order by
const posts = await Post.orderBy('created_at', 'desc').get()

// Order by shortcuts
const posts = await Post.orderByDesc('created_at').get()
const posts = await Post.orderByAsc('title').get()

// Latest/Oldest
const latestPost = await Post.latest('created_at')
const oldestPost = await Post.oldest('created_at')

// Random order
const posts = await Post.inRandomOrder().get()

// Limit and offset
const posts = await Post.take(10).skip(20).get()
```

### Selecting Columns

```typescript
// Select specific columns
const posts = await Post.select(['id', 'title', 'created_at']).get()

// Distinct values
const statuses = await Post.distinct('status').get()
```

### Aggregates

```typescript
// Count
const total = await Post.count()

// Max
const maxViews = await Post.max('views')

// Min
const minViews = await Post.min('views')

// Average
const avgViews = await Post.avg('views')

// Sum
const totalViews = await Post.sum('views')
```

### Pagination

```typescript
const result = await Post.paginate({
  page: 1,
  limit: 15,
})

// Result shape:
// {
//   data: Post[],
//   paging: {
//     total_records: number,
//     page: number,
//     total_pages: number,
//   },
//   next_cursor: number | null,
// }
```

### Eager Loading

```typescript
// Load relationships
const posts = await Post.with(['author', 'comments']).get()

// Nested relationships
const posts = await Post.with(['author', 'comments.user']).get()
```

### Chunking

Process large datasets efficiently:

```typescript
await Post.chunk(100, async (posts) => {
  for (const post of posts) {
    await processPost(post)
  }
})
```

## Creating and Updating

### Creating Records

```typescript
// Create single record
const post = await Post.create({
  title: 'Hello World',
  content: 'This is my first post',
  status: 'draft',
})

// Create multiple records
await Post.createMany([
  { title: 'Post 1', content: 'Content 1' },
  { title: 'Post 2', content: 'Content 2' },
])

// First or create
const post = await Post.firstOrCreate(
  { email: 'user@example.com' },  // Search criteria
  { name: 'New User' },            // Values to create with
)

// Update or create
const post = await Post.updateOrCreate(
  { email: 'user@example.com' },  // Search criteria
  { name: 'Updated Name' },        // Values to update/create with
)
```

### Updating Records

```typescript
// Update single record
const post = await Post.find(1)
await post.update({ title: 'Updated Title' })

// Save changes
post.title = 'New Title'
await post.save()

// Force update (bypass guarded)
await post.forceUpdate({ admin_only_field: 'value' })
```

### Deleting Records

```typescript
// Delete single record
const post = await Post.find(1)
await post.delete()

// Delete by ID
await Post.remove(1)
```

## Scopes

### Local Scopes

Define reusable query constraints:

```typescript
// In your model usage
const publishedPosts = await Post
  .where('status', 'published')
  .where('published_at', '<=', new Date())
  .get()

// Create a helper function
async function getPublishedPosts() {
  return Post
    .where('status', 'published')
    .whereNotNull('published_at')
    .orderByDesc('published_at')
    .get()
}
```

### Conditional Queries

```typescript
const posts = await Post
  .when(request.has('category'), (query) => {
    return query.where('category_id', request.get('category'))
  })
  .when(request.has('search'), (query) => {
    return query.whereLike('title', `%${request.get('search')}%`)
  })
  .get()
```

## Events

### Model Observers

Enable model events with the `observe` trait:

```typescript
traits: {
  observe: true,
}
```

This emits events on model changes:
- `{model}:created` - After creation
- `{model}:updated` - After update
- `{model}:deleted` - After deletion

### Listening to Events

```typescript
import { events } from '@stacksjs/events'

events.on('post:created', async (post) => {
  console.log('New post created:', post.title)
  await notifySubscribers(post)
})

events.on('post:updated', async (post) => {
  await invalidateCache(`post:${post.id}`)
})

events.on('post:deleted', async (post) => {
  await cleanupRelatedData(post.id)
})
```

## Soft Deletes

### Enabling Soft Deletes

```typescript
traits: {
  useSoftDeletes: true,
}
```

This adds a `deleted_at` column and modifies query behavior.

### Querying with Soft Deletes

```typescript
// Normal queries exclude soft-deleted records
const posts = await Post.all()

// Include soft-deleted records
const allPosts = await Post.withTrashed().get()

// Only soft-deleted records
const trashedPosts = await Post.onlyTrashed().get()

// Restore soft-deleted record
const post = await Post.withTrashed().find(1)
await post.restore()

// Permanently delete
await post.forceDelete()
```

## JSON Serialization

### Hiding Attributes

```typescript
attributes: {
  password: {
    hidden: true,  // Never included in JSON
    fillable: true,
    validation: {
      rule: schema.string().min(8),
    },
  },
}
```

### Converting to JSON

```typescript
const post = await Post.find(1)

// Get JSON representation
const json = post.toJSON()

// Includes all visible attributes and loaded relationships
```

## Edge Cases and Gotchas

### Mass Assignment Protection

Attributes must be marked as `fillable` for mass assignment:

```typescript
// This works
const post = await Post.create({
  title: 'Hello',      // fillable: true
  content: 'World',    // fillable: true
})

// This field is ignored
const post = await Post.create({
  admin_only: true,    // fillable: false (ignored)
})

// Use forceCreate to bypass
const post = await Post.forceCreate({
  admin_only: true,    // Works with forceCreate
})
```

### Relationship Loading

Always use `.with()` for eager loading to avoid N+1 queries:

```typescript
// Bad: N+1 queries
const posts = await Post.all()
for (const post of posts) {
  console.log(post.author.name)  // Query per post!
}

// Good: Eager loading
const posts = await Post.with(['author']).get()
for (const post of posts) {
  console.log(post.author.name)  // Already loaded
}
```

### Transaction Support

```typescript
import { transaction } from '@stacksjs/database'

await transaction(async (trx) => {
  const user = await User.create({ name: 'John' }, { transaction: trx })
  await Post.create({ title: 'Hello', author_id: user.id }, { transaction: trx })
  // Both operations commit or rollback together
})
```

## API Reference

### Model Instance Methods

| Method | Description |
|--------|-------------|
| `save()` | Save changes to database |
| `update(data)` | Update with new data |
| `forceUpdate(data)` | Update bypassing guarded |
| `delete()` | Delete the record |
| `toJSON()` | Convert to JSON object |
| `toSearchableObject()` | Convert for search indexing |

### Static Query Methods

| Method | Description |
|--------|-------------|
| `find(id)` | Find by primary key |
| `findOrFail(id)` | Find or throw error |
| `findMany(ids)` | Find multiple by IDs |
| `all()` | Get all records |
| `first()` | Get first record |
| `last()` | Get last record |
| `create(data)` | Create new record |
| `createMany(data[])` | Create multiple records |
| `where(column, value)` | Add where clause |
| `with(relations)` | Eager load relationships |
| `paginate(options)` | Paginate results |

## Related Documentation

- [Database](/features/database) - Database configuration
- [Migrations](/features/migrations) - Database migrations
- [Validation](/packages/validation) - Validation rules
- [Actions](/basics/actions) - Using models in actions
