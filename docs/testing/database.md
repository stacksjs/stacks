---
title: Database Testing
description: "Stacks provides powerful utilities for testing database operations, including automatic transaction rollback, factories, seeders, and assertions for verify..."
---
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
import { setupDatabase } from '@stacksjs/testing/database'

// Creates the test database where the driver needs one, then migrates it.
beforeAll(async () => {
  await setupDatabase()
})
```

## Transaction Testing

### Automatic Rollback

Use transactions to automatically rollback database changes after each test:

```typescript
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { db } from '@stacksjs/database'
import { useTransactionalTests } from '@stacksjs/testing/database'

describe('User Model', () => {
  // Returns the two hooks, so you decide where they run. `useTransaction()`
  // below wires them for you.
  const { begin, rollback } = useTransactionalTests()

  beforeEach(begin)
  afterEach(rollback)

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
import { useTransaction } from '@stacksjs/testing/database'
import { db } from '@stacksjs/database'

describe('Order Model', () => {
  useTransaction()  // Handles beforeEach/afterEach

  it('creates an order', async () => {
    const order = await db.insertInto('orders')
      .values({ user_id: 1, total: 99.99 })
      .returning('_')
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

Test data comes from the `factory` functions the model already declares, one
per attribute:

```typescript
// app/Models/User.ts
export default defineModel({
  name: 'User',
  attributes: {
    name: { fillable: true, factory: faker => faker.person.fullName() },
    email: { fillable: true, unique: true, factory: faker => faker.internet.email() },
    password: { fillable: true, factory: faker => faker.internet.password() },
    role: { fillable: true, default: 'user' },
    email_verified_at: { fillable: true, factory: () => null },
  },
})
```

There is no separate factory file and no second place to declare the same
attributes. `factory('User')` reads that model:

```typescript
import { describe, expect, it } from 'bun:test'
import { factory } from '@stacksjs/testing/database'

describe('User Posts', () => {
  it('creates user with posts', async () => {
    const user = await factory('User').create()

    const posts = await factory('Post').createMany(3, {
      user_id: user.id,
    })

    expect(posts).toHaveLength(3)
    expect(posts[0].user_id).toBe(user.id)
  })

  it('creates user without saving', async () => {
    const user = await factory('User').make({ name: 'Test User' })

    expect(user.name).toBe('Test User')
    expect(user.email).toBeDefined()
  })
})
```

Rows come out of the same generator `buddy seed` uses, which matters in three
ways a hand-rolled factory tends to miss: password columns are hashed with the
configured algorithm, so the row can actually be signed in as; columns marked
`unique` are kept distinct across a batch, so `createMany(50)` does not collide;
and `belongsTo` columns are filled with real parent ids.

### States

A state is an override object, passed at the call site:

```typescript
const admin = await factory('User').create({ role: 'admin' })
const verified = await factory('User').create({ email_verified_at: new Date() })
const verifiedAdmin = await factory('User').create({
  role: 'admin',
  email_verified_at: new Date(),
})
```

Overrides are applied last and taken verbatim, uniqueness handling included: a
test asking for `{ email: 'known@example.com' }` has already decided what the
value is. Keys are converted to their column names, so `emailVerifiedAt` and
`email_verified_at` both work.

For a state you use across many tests, name it where it belongs - in the test
file, as an object:

```typescript
const admin = { role: 'admin', email_verified_at: new Date() }

const one = await factory('User').create(admin)
const many = await factory('User').createMany(3, admin)
```

## Database Assertions

### assertDatabaseHas

Verify a record exists with specific attributes:

```typescript
import { describe, expect, it } from 'bun:test'
import { assertDatabaseHas, assertDatabaseMissing } from '@stacksjs/testing/database'

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
import { assertDatabaseMissing } from '@stacksjs/testing/database'

it('deletes user from database', async () => {
  const user = await factory('User').create()

  await deleteUser(user.id)

  await assertDatabaseMissing('users', { id: user.id })
})
```

### assertDatabaseCount

Verify the number of matching records:

```typescript
import { assertDatabaseCount } from '@stacksjs/testing/database'

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
import { assertSoftDeleted, assertNotSoftDeleted } from '@stacksjs/testing/database'

it('soft deletes user', async () => {
  const user = await factory('User').create()

  await softDeleteUser(user.id)

  await assertSoftDeleted('users', { id: user.id })
})

it('restores soft deleted user', async () => {
  const user = await factory('User').create()
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
import { factory } from '@stacksjs/testing/database'

describe('User Queries', () => {
  it('finds users by role', async () => {
    await factory('User').create({ role: 'admin' })
    await factory('User').create()  // Regular user
    await factory('User').create({ role: 'admin' })

    const admins = await db.selectFrom('users')
      .where('role', '=', 'admin')
      .selectAll()
      .execute()

    expect(admins).toHaveLength(2)
    expect(admins.every(u => u.role === 'admin')).toBe(true)
  })

  it('orders users by created_at', async () => {
    const older = await factory('User').create({
      created_at: new Date('2024-01-01'),
    })
    const newer = await factory('User').create({
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
import { factory } from '@stacksjs/testing/database'

describe('Post Relationships', () => {
  it('loads post with author', async () => {
    const user = await factory('User').create({ name: 'Jane Doe' })
    const post = await factory('Post').create({ user_id: user.id })

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
    const post = await factory('Post').create()
    await factory('Comment').createMany(5, { post_id: post.id })

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
import { factory } from '@stacksjs/testing/database'

describe('Money Transfer', () => {
  it('transfers money atomically', async () => {
    const sender = await factory('Account').create({ balance: 100 })
    const receiver = await factory('Account').create({ balance: 50 })

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
    const sender = await factory('Account').create({ balance: 100 })
    const receiver = await factory('Account').create({ balance: 50 })

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
import { factory } from '@stacksjs/testing/database'

export class TestSeeder extends Seeder {
  async run() {
    // Create admin user
    const admin = await factory('User').create({
      role: 'admin',
      email: 'admin@example.com',
    })

    // Create regular users with posts
    const users = await factory('User').createMany(5)

    for (const user of users) {
      await factory('Post').createMany(3, { user_id: user.id })
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
- **[Database Guide](/packages/database)** - Database queries and models
- **[Migrations](/guide/buddy/migrate)** - Database schema management
