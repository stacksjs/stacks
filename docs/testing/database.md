# Database Testing

Stacks provides powerful utilities for testing database operations, including automatic transaction rollback, factories, seeders, and assertions for verifying database state.

## Overview

Database testing helps you:

- **Test queries** - Verify CRUD operations work correctly
- **Test relationships** - Ensure model associations function
- **Test constraints** - Verify uniqueness, foreign keys, etc.
- **Isolate tests** - Each test gets a clean database state

## Setup

### Test Database Configuration

Configure a separate database for testing in `.env.test`:

```bash
# .env.test
DATABASE_URL=sqlite://./test.db
# Or use in-memory SQLite for speed
DATABASE_URL=sqlite://:memory:
```

### Database Migrations

Ensure migrations run before tests:

```typescript
// tests/setup.ts
import { beforeAll } from 'bun:test'
import { migrate } from '@stacksjs/database'

beforeAll(async () => {
  await migrate.latest()
})
```

## Transaction Testing

### Automatic Rollback

Use transactions to automatically rollback database changes after each test:

```typescript
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { db, beginTransaction, rollbackTransaction } from '@stacksjs/database'

describe('User Model', () => {
  beforeEach(async () => {
    await beginTransaction()
  })

  afterEach(async () => {
    await rollbackTransaction()
  })

  it('creates a user', async () => {
    await db.insertInto('users').values({
      name: 'John Doe',
      email: 'john@example.com',
    }).execute()

    const user = await db.selectFrom('users')
      .where('email', '=', 'john@example.com')
      .selectAll()
      .executeTakeFirst()

    expect(user).toBeDefined()
    expect(user?.name).toBe('John Doe')
    // Changes are rolled back after test
  })
})
```

### UseTransaction Helper

Stacks provides a helper that handles setup/teardown automatically:

```typescript
import { describe, expect, it } from 'bun:test'
import { useTransaction } from '@stacksjs/testing'
import { db } from '@stacksjs/database'

describe('Order Model', () => {
  useTransaction()  // Handles beforeEach/afterEach

  it('creates an order', async () => {
    const order = await db.insertInto('orders')
      .values({ user_id: 1, total: 99.99 })
      .returning('*')
      .executeTakeFirst()

    expect(order?.total).toBe(99.99)
  })

  it('runs in isolation', async () => {
    // Previous test's order doesn't exist here
    const orders = await db.selectFrom('orders').selectAll().execute()
    expect(orders).toHaveLength(0)
  })
})
```

## Factories

### Defining Factories

Create factories to generate test data:

```typescript
// tests/factories/UserFactory.ts
import { Factory } from '@stacksjs/testing'
import { db } from '@stacksjs/database'
import type { User } from '@/types'

export const UserFactory = new Factory<User>({
  // Define default attributes
  definition() {
    return {
      name: this.faker.person.fullName(),
      email: this.faker.internet.email(),
      password: this.faker.internet.password(),
      created_at: new Date(),
    }
  },

  // Create in database
  async create(attributes = {}) {
    const data = { ...this.make(), ...attributes }
    return db.insertInto('users')
      .values(data)
      .returning('*')
      .executeTakeFirstOrThrow()
  },

  // Make without saving
  make(attributes = {}) {
    return { ...this.definition(), ...attributes }
  },
})
```

### Using Factories

```typescript
import { describe, expect, it } from 'bun:test'
import { UserFactory } from '../factories/UserFactory'
import { PostFactory } from '../factories/PostFactory'

describe('User Posts', () => {
  it('creates user with posts', async () => {
    // Create a user
    const user = await UserFactory.create()

    // Create posts for the user
    const posts = await PostFactory.createMany(3, {
      user_id: user.id,
    })

    expect(posts).toHaveLength(3)
    expect(posts[0].user_id).toBe(user.id)
  })

  it('creates user without saving', () => {
    const user = UserFactory.make({ name: 'Test User' })

    expect(user.name).toBe('Test User')
    expect(user.email).toBeDefined()
  })
})
```

### Factory States

Define different states for your factories:

```typescript
// tests/factories/UserFactory.ts
export const UserFactory = new Factory<User>({
  definition() {
    return {
      name: this.faker.person.fullName(),
      email: this.faker.internet.email(),
      role: 'user',
      email_verified_at: null,
    }
  },

  // Define states
  states: {
    admin() {
      return { role: 'admin' }
    },

    verified() {
      return { email_verified_at: new Date() }
    },

    unverified() {
      return { email_verified_at: null }
    },
  },
})

// Usage
const admin = await UserFactory.state('admin').create()
const verifiedUser = await UserFactory.state('verified').create()
const verifiedAdmin = await UserFactory
  .state('admin')
  .state('verified')
  .create()
```

### Factory Sequences

Generate unique sequential values:

```typescript
export const UserFactory = new Factory<User>({
  definition() {
    return {
      name: this.faker.person.fullName(),
      email: this.sequence((n) => `user${n}@example.com`),
      username: this.sequence((n) => `user_${n}`),
    }
  },
})

// Creates user1@example.com, user2@example.com, etc.
const users = await UserFactory.createMany(3)
```

## Database Assertions

### assertDatabaseHas

Verify a record exists with specific attributes:

```typescript
import { describe, expect, it } from 'bun:test'
import { assertDatabaseHas, assertDatabaseMissing } from '@stacksjs/testing'

describe('User Registration', () => {
  it('creates user in database', async () => {
    await registerUser({
      name: 'John Doe',
      email: 'john@example.com',
    })

    await assertDatabaseHas('users', {
      email: 'john@example.com',
      name: 'John Doe',
    })
  })

  it('does not create duplicate users', async () => {
    await registerUser({ email: 'existing@example.com' })

    await expect(
      registerUser({ email: 'existing@example.com' })
    ).rejects.toThrow()

    // Should only have one user with this email
    await assertDatabaseCount('users', 1, {
      email: 'existing@example.com',
    })
  })
})
```

### assertDatabaseMissing

Verify a record does not exist:

```typescript
import { assertDatabaseMissing } from '@stacksjs/testing'

it('deletes user from database', async () => {
  const user = await UserFactory.create()

  await deleteUser(user.id)

  await assertDatabaseMissing('users', { id: user.id })
})
```

### assertDatabaseCount

Verify the number of matching records:

```typescript
import { assertDatabaseCount } from '@stacksjs/testing'

it('creates multiple orders', async () => {
  await createBulkOrders([
    { product_id: 1, quantity: 2 },
    { product_id: 2, quantity: 1 },
    { product_id: 1, quantity: 3 },
  ])

  await assertDatabaseCount('orders', 3)
  await assertDatabaseCount('orders', 2, { product_id: 1 })
})
```

### assertSoftDeleted

For soft-deletable models:

```typescript
import { assertSoftDeleted, assertNotSoftDeleted } from '@stacksjs/testing'

it('soft deletes user', async () => {
  const user = await UserFactory.create()

  await softDeleteUser(user.id)

  await assertSoftDeleted('users', { id: user.id })
})

it('restores soft deleted user', async () => {
  const user = await UserFactory.create()
  await softDeleteUser(user.id)

  await restoreUser(user.id)

  await assertNotSoftDeleted('users', { id: user.id })
})
```

## Testing Queries

### Testing Select Queries

```typescript
import { describe, expect, it } from 'bun:test'
import { db } from '@stacksjs/database'
import { UserFactory } from '../factories/UserFactory'

describe('User Queries', () => {
  it('finds users by role', async () => {
    await UserFactory.state('admin').create()
    await UserFactory.create()  // Regular user
    await UserFactory.state('admin').create()

    const admins = await db.selectFrom('users')
      .where('role', '=', 'admin')
      .selectAll()
      .execute()

    expect(admins).toHaveLength(2)
    expect(admins.every(u => u.role === 'admin')).toBe(true)
  })

  it('orders users by created_at', async () => {
    const older = await UserFactory.create({
      created_at: new Date('2024-01-01'),
    })
    const newer = await UserFactory.create({
      created_at: new Date('2024-06-01'),
    })

    const users = await db.selectFrom('users')
      .orderBy('created_at', 'desc')
      .selectAll()
      .execute()

    expect(users[0].id).toBe(newer.id)
    expect(users[1].id).toBe(older.id)
  })
})
```

### Testing Relationships

```typescript
import { describe, expect, it } from 'bun:test'
import { db } from '@stacksjs/database'
import { UserFactory, PostFactory, CommentFactory } from '../factories'

describe('Post Relationships', () => {
  it('loads post with author', async () => {
    const user = await UserFactory.create({ name: 'Jane Doe' })
    const post = await PostFactory.create({ user_id: user.id })

    const postWithAuthor = await db.selectFrom('posts')
      .innerJoin('users', 'users.id', 'posts.user_id')
      .where('posts.id', '=', post.id)
      .select([
        'posts.id',
        'posts.title',
        'users.name as author_name',
      ])
      .executeTakeFirst()

    expect(postWithAuthor?.author_name).toBe('Jane Doe')
  })

  it('counts post comments', async () => {
    const post = await PostFactory.create()
    await CommentFactory.createMany(5, { post_id: post.id })

    const postWithCount = await db.selectFrom('posts')
      .leftJoin('comments', 'comments.post_id', 'posts.id')
      .where('posts.id', '=', post.id)
      .groupBy('posts.id')
      .select([
        'posts.id',
        'posts.title',
        db.fn.count('comments.id').as('comment_count'),
      ])
      .executeTakeFirst()

    expect(Number(postWithCount?.comment_count)).toBe(5)
  })
})
```

### Testing Transactions

```typescript
import { describe, expect, it } from 'bun:test'
import { db } from '@stacksjs/database'
import { UserFactory, AccountFactory } from '../factories'

describe('Money Transfer', () => {
  it('transfers money atomically', async () => {
    const sender = await AccountFactory.create({ balance: 100 })
    const receiver = await AccountFactory.create({ balance: 50 })

    await transferMoney(sender.id, receiver.id, 30)

    const updatedSender = await db.selectFrom('accounts')
      .where('id', '=', sender.id)
      .select('balance')
      .executeTakeFirst()

    const updatedReceiver = await db.selectFrom('accounts')
      .where('id', '=', receiver.id)
      .select('balance')
      .executeTakeFirst()

    expect(updatedSender?.balance).toBe(70)
    expect(updatedReceiver?.balance).toBe(80)
  })

  it('rolls back on failure', async () => {
    const sender = await AccountFactory.create({ balance: 100 })
    const receiver = await AccountFactory.create({ balance: 50 })

    // Try to transfer more than available
    await expect(
      transferMoney(sender.id, receiver.id, 150)
    ).rejects.toThrow('Insufficient funds')

    // Balances should be unchanged
    const updatedSender = await db.selectFrom('accounts')
      .where('id', '=', sender.id)
      .select('balance')
      .executeTakeFirst()

    expect(updatedSender?.balance).toBe(100)  // Unchanged
  })
})
```

## Seeding Test Data

### Using Seeders

```typescript
// tests/seeders/TestSeeder.ts
import { Seeder } from '@stacksjs/database'
import { UserFactory, PostFactory } from '../factories'

export class TestSeeder extends Seeder {
  async run() {
    // Create admin user
    const admin = await UserFactory.state('admin').create({
      email: 'admin@example.com',
    })

    // Create regular users with posts
    const users = await UserFactory.createMany(5)

    for (const user of users) {
      await PostFactory.createMany(3, { user_id: user.id })
    }
  }
}
```

### Running Seeders in Tests

```typescript
import { beforeAll, describe, it } from 'bun:test'
import { TestSeeder } from '../seeders/TestSeeder'

describe('Dashboard', () => {
  beforeAll(async () => {
    await new TestSeeder().run()
  })

  it('displays user statistics', async () => {
    const stats = await getDashboardStats()

    expect(stats.userCount).toBe(6)  // 5 users + 1 admin
    expect(stats.postCount).toBe(15) // 5 users * 3 posts
  })
})
```

## Testing Migrations

```typescript
import { describe, expect, it } from 'bun:test'
import { migrate, db } from '@stacksjs/database'

describe('Migrations', () => {
  it('creates users table with correct columns', async () => {
    await migrate.latest()

    const columns = await db.introspection.getTableInfo('users')

    expect(columns.some(c => c.name === 'id')).toBe(true)
    expect(columns.some(c => c.name === 'email')).toBe(true)
    expect(columns.some(c => c.name === 'name')).toBe(true)
    expect(columns.some(c => c.name === 'created_at')).toBe(true)
  })

  it('rolls back migration correctly', async () => {
    await migrate.latest()
    await migrate.rollback()

    const tables = await db.introspection.getTables()
    expect(tables.some(t => t.name === 'users')).toBe(false)
  })
})
```

## Running Database Tests

```bash
# Run all tests (uses test database)
NODE_ENV=test buddy test

# Run with fresh database
buddy test --fresh-db

# Run specific test file
bun test tests/Feature/UserTest.ts

# Run with verbose SQL logging
DEBUG=sql buddy test
```

## Best Practices

### DO

- **Use transactions** - Rollback after each test for isolation
- **Use factories** - Generate realistic test data
- **Test edge cases** - NULL values, empty strings, boundaries
- **Test constraints** - Unique, foreign keys, check constraints
- **Clean up properly** - Don't leave test data around

### DON'T

- **Don't share database state** - Each test should be independent
- **Don't test ORM internals** - Test your application logic
- **Don't use production data** - Use factories with fake data
- **Don't skip migrations** - Test with the same schema as production

## Related Documentation

- **[Testing Overview](/testing/getting-started)** - Getting started with testing
- **[Unit Tests](/testing/unit-tests)** - Testing isolated functions
- **[Database Guide](/guide/database)** - Database queries and models
- **[Migrations](/guide/migrations)** - Database schema management
