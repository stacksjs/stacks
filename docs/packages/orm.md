# ORM Package

A powerful and elegant Object-Relational Mapping (ORM) for TypeScript applications, providing intuitive model definitions, relationships, and query building capabilities.

## Installation

```bash
bun add @stacksjs/orm
```

## Basic Usage

```typescript
import { User, Post, Comment } from '@stacksjs/orm'

// Find a single record
const user = await User.find(1)

// Find with conditions
const activeUsers = await User.where('status', '=', 'active').get()

// Create a new record
const newUser = await User.create({
  name: 'John Doe',
  email: 'john@example.com',
  password: 'hashed_password'
})

// Update a record
await User.where('id', '=', 1).update({ name: 'Jane Doe' })

// Delete a record
await User.where('id', '=', 1).delete()
```

## Defining Models

Models are defined in the `app/Models` directory using a declarative schema:

```typescript
// app/Models/User.ts
import { defineModel } from '@stacksjs/orm'

export default defineModel({
  name: 'User',
  table: 'users',

  attributes: {
    name: {
      type: 'string',
      required: true,
      maxLength: 255,
    },
    email: {
      type: 'string',
      required: true,
      unique: true,
      validation: 'email',
    },
    password: {
      type: 'string',
      required: true,
      hidden: true,
    },
    status: {
      type: 'string',
      default: 'active',
    },
  },

  traits: {
    useTimestamps: true,
    useSoftDeletes: true,
    useUuid: false,
  },
})
```

## Model Attributes

### Attribute Types

```typescript
attributes: {
  // String types
  name: { type: 'string', maxLength: 255 },
  bio: { type: 'text' },

  // Numeric types
  age: { type: 'integer' },
  price: { type: 'decimal', precision: 10, scale: 2 },
  quantity: { type: 'bigint' },

  // Boolean
  isActive: { type: 'boolean', default: false },

  // Date/Time
  publishedAt: { type: 'datetime' },
  birthDate: { type: 'date' },

  // JSON
  metadata: { type: 'json' },
}
```

### Attribute Options

```typescript
attributes: {
  email: {
    type: 'string',
    required: true,      // Cannot be null
    unique: true,        // Must be unique in table
    default: 'default',  // Default value
    hidden: false,       // Hide from JSON serialization
    fillable: true,      // Can be mass-assigned
    guarded: false,      // Protected from mass-assignment
  }
}
```

## Relationships

### Has One

```typescript
export default defineModel({
  name: 'User',

  hasOne: ['Profile'],

  // Or with configuration
  hasOne: [
    {
      model: 'Profile',
      foreignKey: 'user_id',
      relationName: 'userProfile',
    }
  ],
})

// Usage
const user = await User.with('profile').find(1)
console.log(user.profile)
```

### Has Many

```typescript
export default defineModel({
  name: 'User',

  hasMany: ['Post', 'Comment'],

  // Or with configuration
  hasMany: [
    {
      model: 'Post',
      foreignKey: 'author_id',
    }
  ],
})

// Usage
const user = await User.with('posts').find(1)
console.log(user.posts) // Array of posts
```

### Belongs To

```typescript
export default defineModel({
  name: 'Post',

  belongsTo: ['User'],

  // Or with configuration
  belongsTo: [
    {
      model: 'User',
      foreignKey: 'user_id',
      relationName: 'author',
    }
  ],
})

// Usage
const post = await Post.with('author').find(1)
console.log(post.author.name)
```

### Belongs To Many (Many-to-Many)

```typescript
export default defineModel({
  name: 'User',

  belongsToMany: [
    {
      model: 'Role',
      pivotTable: 'user_roles',
      firstForeignKey: 'user_id',
      secondForeignKey: 'role_id',
    }
  ],
})

// Usage
const user = await User.with('roles').find(1)
console.log(user.roles) // Array of roles
```

### Has One Through

```typescript
export default defineModel({
  name: 'Country',

  hasOneThrough: [
    {
      model: 'PostalCode',
      through: 'User',
      throughForeignKey: 'country_id',
    }
  ],
})
```

## Query Building

### Basic Queries

```typescript
// Select all
const users = await User.all()

// Find by ID
const user = await User.find(1)

// Find or fail
const user = await User.findOrFail(1)

// First record
const user = await User.first()

// Get specific columns
const users = await User.select('id', 'name', 'email').get()
```

### Where Clauses

```typescript
// Simple where
const users = await User.where('status', '=', 'active').get()

// Multiple conditions
const users = await User
  .where('status', '=', 'active')
  .where('age', '>=', 18)
  .get()

// Or where
const users = await User
  .where('role', '=', 'admin')
  .orWhere('role', '=', 'moderator')
  .get()

// Where in
const users = await User.whereIn('id', [1, 2, 3]).get()

// Where not in
const users = await User.whereNotIn('status', ['banned', 'suspended']).get()

// Where null
const users = await User.whereNull('deleted_at').get()

// Where not null
const users = await User.whereNotNull('email_verified_at').get()

// Where between
const users = await User.whereBetween('age', 18, 65).get()
```

### Ordering and Pagination

```typescript
// Order by
const users = await User.orderBy('created_at', 'desc').get()

// Multiple order by
const users = await User
  .orderBy('status', 'asc')
  .orderBy('name', 'asc')
  .get()

// Random order
const users = await User.inRandomOrder().get()

// Limit and offset
const users = await User.limit(10).offset(20).get()

// Pagination
const users = await User.paginate(15, 1) // 15 per page, page 1
```

### Aggregates

```typescript
// Count
const count = await User.count()

// Max
const maxAge = await User.max('age')

// Min
const minAge = await User.min('age')

// Average
const avgAge = await User.avg('age')

// Sum
const totalBalance = await User.sum('balance')
```

### Eager Loading

```typescript
// Single relationship
const users = await User.with('posts').get()

// Multiple relationships
const users = await User.with(['posts', 'profile', 'comments']).get()

// Nested relationships
const users = await User.with('posts.comments').get()

// Conditional eager loading
const users = await User.with({
  posts: (query) => query.where('published', '=', true)
}).get()
```

### Existence Queries

```typescript
// Has relationship
const usersWithPosts = await User.has('posts').get()

// Where has with conditions
const usersWithPublishedPosts = await User.whereHas('posts', (query) => {
  query.where('status', '=', 'published')
}).get()

// Doesn't have relationship
const usersWithoutPosts = await User.doesntHave('posts').get()

// Where doesn't have
const users = await User.whereDoesntHave('posts', (query) => {
  query.where('status', '=', 'draft')
}).get()
```

## Model Traits

### Timestamps

```typescript
traits: {
  useTimestamps: true, // Adds created_at and updated_at
}
```

### Soft Deletes

```typescript
traits: {
  useSoftDeletes: true, // Adds deleted_at column
}

// Usage
await User.find(1).delete() // Soft delete
await User.withTrashed().get() // Include soft deleted
await User.onlyTrashed().get() // Only soft deleted
await User.find(1).restore() // Restore soft deleted
await User.find(1).forceDelete() // Permanently delete
```

### UUID

```typescript
traits: {
  useUuid: true, // Use UUID instead of auto-increment
}
```

### Observable

```typescript
traits: {
  observe: true, // Enable model events
  // Or specify which events to observe
  observe: ['create', 'update', 'delete'],
}
```

## Custom Accessors and Mutators

```typescript
export default defineModel({
  name: 'User',

  // Custom getters
  get: {
    fullName: (attributes) => `${attributes.firstName} ${attributes.lastName}`,
    isAdmin: (attributes) => attributes.role === 'admin',
  },

  // Custom setters
  set: {
    password: async (value) => await hashPassword(value),
    email: (value) => value.toLowerCase(),
  },
})

// Usage
const user = await User.find(1)
console.log(user.fullName) // "John Doe"
```

## Scopes

Define reusable query constraints:

```typescript
export default defineModel({
  name: 'User',

  scopes: {
    active: (query) => query.where('status', '=', 'active'),
    admins: (query) => query.where('role', '=', 'admin'),
    recent: (query) => query.orderBy('created_at', 'desc').limit(10),
  },
})

// Usage
const activeAdmins = await User.active().admins().get()
const recentUsers = await User.recent().get()
```

## Mass Assignment

### Fillable Attributes

```typescript
export default defineModel({
  name: 'User',

  fillable: ['name', 'email', 'password'],
})

// Only these fields can be mass-assigned
await User.create({ name: 'John', email: 'john@test.com', role: 'admin' })
// 'role' will be ignored
```

### Guarded Attributes

```typescript
export default defineModel({
  name: 'User',

  guarded: ['role', 'permissions'],
})

// These fields cannot be mass-assigned
```

## Serialization

### Hidden Attributes

```typescript
export default defineModel({
  name: 'User',

  hidden: ['password', 'remember_token'],
})

// These fields won't appear in JSON output
const user = await User.find(1)
console.log(JSON.stringify(user)) // password not included
```

### Appending Computed Attributes

```typescript
export default defineModel({
  name: 'User',

  appends: ['fullName', 'isAdmin'],
})

// Computed attributes included in JSON
```

## Transactions

```typescript
import { transaction } from '@stacksjs/orm'

await transaction(async (trx) => {
  const user = await User.create({ name: 'John' }, trx)
  await Post.create({ title: 'Hello', user_id: user.id }, trx)
  // Both succeed or both rollback
})
```

## Raw Queries

```typescript
import { db } from '@stacksjs/database'

// Raw select
const users = await db.selectFrom('users')
  .where('status', '=', 'active')
  .selectAll()
  .execute()

// Raw insert
await db.insertInto('users')
  .values({ name: 'John', email: 'john@test.com' })
  .execute()
```

## Model Events

```typescript
import { dispatch, listen } from '@stacksjs/events'

// Listen for model events
listen('user:created', (user) => {
  console.log('New user created:', user.name)
})

listen('user:updated', (user) => {
  console.log('User updated:', user.id)
})

listen('user:deleted', (user) => {
  console.log('User deleted:', user.id)
})
```

## Edge Cases

### Handling Null Values

```typescript
// Where null with soft deletes
const activeUsers = await User
  .whereNull('deleted_at')
  .get()

// Coalescing null values
const users = await User.select('name', 'nickname')
  .get()
  .map(u => ({
    displayName: u.nickname ?? u.name
  }))
```

### Large Result Sets

```typescript
// Use chunking for large datasets
await User.chunk(100, async (users) => {
  for (const user of users) {
    await processUser(user)
  }
})

// Cursor for memory efficiency
for await (const user of User.cursor()) {
  await processUser(user)
}
```

### Concurrent Updates

```typescript
// Use transactions for concurrent updates
await transaction(async (trx) => {
  const user = await User.find(1, trx)
  user.balance += 100
  await user.save(trx)
})
```

## API Reference

### Model Static Methods

| Method | Description |
|--------|-------------|
| `find(id)` | Find by primary key |
| `findOrFail(id)` | Find or throw exception |
| `first()` | Get first record |
| `all()` | Get all records |
| `create(data)` | Create new record |
| `where(column, op, value)` | Add where clause |
| `with(relations)` | Eager load relationships |
| `orderBy(column, dir)` | Order results |
| `limit(n)` | Limit results |
| `paginate(perPage, page)` | Paginate results |
| `count()` | Count records |
| `chunk(size, callback)` | Process in chunks |

### Model Instance Methods

| Method | Description |
|--------|-------------|
| `save()` | Save changes |
| `delete()` | Delete record |
| `restore()` | Restore soft deleted |
| `forceDelete()` | Permanently delete |
| `refresh()` | Reload from database |
| `toJSON()` | Serialize to JSON |
