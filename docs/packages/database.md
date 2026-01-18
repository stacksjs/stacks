# Database Package

A powerful database abstraction layer providing seamless driver switching between SQLite, MySQL, and PostgreSQL, built on top of bun-query-builder.

## Installation

```bash
bun add @stacksjs/database
```

## Basic Usage

```typescript
import { db, Database, createSqliteDatabase } from '@stacksjs/database'

// Use the default db instance (configured from environment)
const users = await db.selectFrom('users')
  .where('active', '=', true)
  .get()

// Create a custom database instance
const customDb = new Database({
  driver: 'postgres',
  connection: {
    database: 'myapp',
    host: 'localhost',
    port: 5432,
    username: 'postgres',
    password: 'secret'
  }
})
```

## Configuration

### Environment Variables

```env
DB_CONNECTION=sqlite
DB_DATABASE=database/stacks.sqlite

# For MySQL
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=stacks
DB_USERNAME=root
DB_PASSWORD=

# For PostgreSQL
DB_CONNECTION=postgres
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=stacks
DB_USERNAME=postgres
DB_PASSWORD=secret
```

### Programmatic Configuration

```typescript
import { Database, createDatabase } from '@stacksjs/database'

// SQLite
const sqliteDb = new Database({
  driver: 'sqlite',
  connection: { database: 'database/app.sqlite' }
})

// MySQL
const mysqlDb = new Database({
  driver: 'mysql',
  connection: {
    database: 'myapp',
    host: 'localhost',
    port: 3306,
    username: 'root',
    password: 'secret'
  }
})

// PostgreSQL
const postgresDb = new Database({
  driver: 'postgres',
  connection: {
    database: 'myapp',
    host: 'localhost',
    port: 5432,
    username: 'postgres',
    password: 'secret'
  }
})
```

### Database Options

```typescript
const db = new Database({
  driver: 'sqlite',
  connection: { database: 'app.sqlite' },

  // Enable verbose logging
  verbose: true,

  // Timestamp column names
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    defaultOrderColumn: 'created_at'
  },

  // Soft delete configuration
  softDeletes: {
    enabled: true,
    column: 'deleted_at',
    defaultFilter: true
  },

  // Model hooks
  hooks: {
    beforeCreate: async (data) => { /* ... */ },
    afterCreate: async (result) => { /* ... */ }
  }
})
```

## Query Builder

### Select Queries

```typescript
// Select all columns
const users = await db.selectFrom('users').selectAll().execute()

// Select specific columns
const users = await db.selectFrom('users')
  .select(['id', 'name', 'email'])
  .execute()

// Select with alias
const users = await db.selectFrom('users')
  .select(['id', 'name as userName'])
  .execute()

// Distinct
const cities = await db.selectFrom('users')
  .distinct()
  .select('city')
  .execute()
```

### Where Clauses

```typescript
// Simple where
const users = await db.selectFrom('users')
  .where('status', '=', 'active')
  .execute()

// Multiple conditions
const users = await db.selectFrom('users')
  .where('status', '=', 'active')
  .where('role', '=', 'admin')
  .execute()

// Or where
const users = await db.selectFrom('users')
  .where('role', '=', 'admin')
  .orWhere('role', '=', 'moderator')
  .execute()

// Where in
const users = await db.selectFrom('users')
  .whereIn('id', [1, 2, 3])
  .execute()

// Where null / not null
const unverified = await db.selectFrom('users')
  .whereNull('email_verified_at')
  .execute()

const verified = await db.selectFrom('users')
  .whereNotNull('email_verified_at')
  .execute()

// Where between
const users = await db.selectFrom('users')
  .whereBetween('age', 18, 65)
  .execute()

// Where like
const users = await db.selectFrom('users')
  .where('name', 'like', '%john%')
  .execute()
```

### Joins

```typescript
// Inner join
const posts = await db.selectFrom('posts')
  .innerJoin('users', 'posts.user_id', 'users.id')
  .select(['posts.*', 'users.name as author_name'])
  .execute()

// Left join
const posts = await db.selectFrom('posts')
  .leftJoin('comments', 'posts.id', 'comments.post_id')
  .selectAll()
  .execute()

// Right join
const posts = await db.selectFrom('posts')
  .rightJoin('users', 'posts.user_id', 'users.id')
  .selectAll()
  .execute()
```

### Ordering and Grouping

```typescript
// Order by
const users = await db.selectFrom('users')
  .orderBy('created_at', 'desc')
  .execute()

// Multiple order by
const users = await db.selectFrom('users')
  .orderBy('last_name', 'asc')
  .orderBy('first_name', 'asc')
  .execute()

// Group by
const stats = await db.selectFrom('orders')
  .select(['status', 'count(*) as total'])
  .groupBy('status')
  .execute()

// Having
const stats = await db.selectFrom('orders')
  .select(['user_id', 'sum(total) as total_spent'])
  .groupBy('user_id')
  .having('total_spent', '>', 1000)
  .execute()
```

### Pagination and Limits

```typescript
// Limit and offset
const users = await db.selectFrom('users')
  .limit(10)
  .offset(20)
  .execute()

// Pagination helper
const result = await db.selectFrom('users')
  .paginate(15, 1) // 15 per page, page 1

console.log(result.data)       // Array of records
console.log(result.total)      // Total record count
console.log(result.perPage)    // Items per page
console.log(result.currentPage) // Current page
console.log(result.lastPage)   // Last page number
```

### Aggregates

```typescript
// Count
const count = await db.selectFrom('users')
  .count()
  .executeTakeFirst()

// Sum
const total = await db.selectFrom('orders')
  .sum('amount')
  .executeTakeFirst()

// Average
const avg = await db.selectFrom('products')
  .avg('price')
  .executeTakeFirst()

// Min / Max
const minPrice = await db.selectFrom('products').min('price').executeTakeFirst()
const maxPrice = await db.selectFrom('products').max('price').executeTakeFirst()
```

### Insert Queries

```typescript
// Single insert
const result = await db.insertInto('users')
  .values({
    name: 'John Doe',
    email: 'john@example.com'
  })
  .execute()

// Insert with returning
const [user] = await db.insertInto('users')
  .values({ name: 'John', email: 'john@test.com' })
  .returning('id')
  .execute()

// Bulk insert
await db.insertInto('users')
  .values([
    { name: 'User 1', email: 'user1@test.com' },
    { name: 'User 2', email: 'user2@test.com' },
    { name: 'User 3', email: 'user3@test.com' }
  ])
  .execute()

// Insert or ignore
await db.insertInto('users')
  .values({ name: 'John', email: 'john@test.com' })
  .onConflict()
  .doNothing()
  .execute()

// Upsert
await db.insertInto('users')
  .values({ id: 1, name: 'John', email: 'john@test.com' })
  .onConflict('id')
  .doUpdateSet({ name: 'John Updated' })
  .execute()
```

### Update Queries

```typescript
// Simple update
await db.updateTable('users')
  .set({ status: 'inactive' })
  .where('id', '=', 1)
  .execute()

// Update multiple columns
await db.updateTable('users')
  .set({
    name: 'Jane Doe',
    updated_at: new Date()
  })
  .where('id', '=', 1)
  .execute()

// Increment / Decrement
await db.updateTable('products')
  .set({ stock: sql`stock - 1` })
  .where('id', '=', 1)
  .execute()
```

### Delete Queries

```typescript
// Delete by condition
await db.deleteFrom('users')
  .where('status', '=', 'inactive')
  .execute()

// Delete all (careful!)
await db.deleteFrom('temp_logs').execute()

// Truncate table
await db.truncateTable('sessions').execute()
```

## Migrations

### Creating Migrations

```typescript
import { Migration } from '@stacksjs/database'

export default class CreateUsersTable extends Migration {
  async up() {
    await this.schema.createTable('users', (table) => {
      table.id()
      table.string('name')
      table.string('email').unique()
      table.string('password')
      table.boolean('is_active').default(true)
      table.timestamps()
    })
  }

  async down() {
    await this.schema.dropTable('users')
  }
}
```

### Column Types

```typescript
table.id()                    // Auto-incrementing primary key
table.uuid('id').primary()    // UUID primary key
table.string('name', 255)     // VARCHAR
table.text('description')     // TEXT
table.integer('age')          // INTEGER
table.bigInteger('views')     // BIGINT
table.float('price')          // FLOAT
table.decimal('amount', 10, 2) // DECIMAL
table.boolean('active')       // BOOLEAN
table.date('birth_date')      // DATE
table.datetime('published_at') // DATETIME
table.timestamp('created_at')  // TIMESTAMP
table.json('metadata')        // JSON
table.binary('data')          // BLOB/BINARY
```

### Column Modifiers

```typescript
table.string('email')
  .unique()                   // Unique constraint
  .nullable()                 // Allow null
  .default('default')         // Default value
  .references('id', 'roles')  // Foreign key

table.timestamps()            // created_at and updated_at
table.softDeletes()           // deleted_at column
```

### Running Migrations

```bash
# Run all pending migrations
buddy migrate

# Rollback last batch
buddy migrate:rollback

# Reset and re-run all migrations
buddy migrate:fresh

# Check migration status
buddy migrate:status
```

## Seeding

### Creating Seeders

```typescript
import { Seeder } from '@stacksjs/database'

export default class UserSeeder extends Seeder {
  async run() {
    await this.db.insertInto('users').values([
      { name: 'Admin', email: 'admin@example.com', role: 'admin' },
      { name: 'User', email: 'user@example.com', role: 'user' }
    ]).execute()
  }
}
```

### Using Factories

```typescript
import { Seeder, factory } from '@stacksjs/database'
import { faker } from '@stacksjs/faker'

export default class UserSeeder extends Seeder {
  async run() {
    // Create 50 users with fake data
    await factory('users', 50, () => ({
      name: faker.person.fullName(),
      email: faker.internet.email(),
      created_at: faker.date.past()
    }))
  }
}
```

### Running Seeders

```bash
# Run all seeders
buddy db:seed

# Run specific seeder
buddy db:seed --class=UserSeeder
```

## Transactions

```typescript
import { db, transaction } from '@stacksjs/database'

// Using transaction helper
await transaction(async (trx) => {
  await trx.insertInto('orders')
    .values({ user_id: 1, total: 100 })
    .execute()

  await trx.updateTable('users')
    .set({ balance: sql`balance - 100` })
    .where('id', '=', 1)
    .execute()

  // If any query fails, all changes are rolled back
})

// Manual transaction control
const trx = await db.transaction()
try {
  await trx.insertInto('orders').values({ /* ... */ }).execute()
  await trx.commit()
} catch (error) {
  await trx.rollback()
  throw error
}
```

## Raw Queries

```typescript
import { db, sql } from '@stacksjs/database'

// Raw select
const users = await db.raw('SELECT * FROM users WHERE status = ?', ['active'])

// Raw expression in query
const users = await db.selectFrom('users')
  .select([
    'name',
    sql`CONCAT(first_name, ' ', last_name) as full_name`
  ])
  .execute()

// Raw where condition
const users = await db.selectFrom('users')
  .where(sql`YEAR(created_at) = ${2024}`)
  .execute()
```

## Driver Switching

```typescript
const database = new Database({
  driver: 'sqlite',
  connection: { database: 'app.sqlite' }
})

// Switch to PostgreSQL at runtime
database.switchDriver('postgres', {
  database: 'myapp',
  host: 'localhost',
  port: 5432,
  username: 'postgres',
  password: 'secret'
})
```

## Connection Management

```typescript
// Get current driver
console.log(database.driver) // 'sqlite'

// Check if initialized
console.log(database.isInitialized) // true

// Close connection
database.close()

// Reinitialize
database.initialize()
```

## Query Logging

```typescript
import { enableQueryLogging, disableQueryLogging } from '@stacksjs/database'

// Enable query logging
enableQueryLogging()

// All queries will be logged to console
await db.selectFrom('users').execute()
// [SQL] SELECT * FROM users (2.3ms)

// Disable logging
disableQueryLogging()
```

## Edge Cases

### Handling Connection Errors

```typescript
import { Database } from '@stacksjs/database'

try {
  const db = new Database({
    driver: 'postgres',
    connection: {
      host: 'invalid-host',
      database: 'myapp'
    }
  })
  await db.query.selectFrom('users').execute()
} catch (error) {
  if (error.code === 'ECONNREFUSED') {
    console.error('Database connection refused')
  }
}
```

### Handling Large Datasets

```typescript
// Use streaming for large datasets
const stream = db.selectFrom('logs')
  .where('created_at', '>', '2024-01-01')
  .stream()

for await (const row of stream) {
  processRow(row)
}
```

### Concurrent Connections

```typescript
// Connection pooling is handled automatically
// Configure pool size via environment
// DB_POOL_MIN=2
// DB_POOL_MAX=10
```

## API Reference

### Database Class

| Method | Description |
|--------|-------------|
| `query` | Get query builder instance |
| `driver` | Get current driver name |
| `connection` | Get connection config |
| `isInitialized` | Check initialization state |
| `initialize()` | Initialize connection |
| `switchDriver()` | Switch database driver |
| `close()` | Close connection |

### Factory Functions

| Function | Description |
|----------|-------------|
| `createDatabase(options)` | Create database with options |
| `createSqliteDatabase(path)` | Create SQLite database |
| `createPostgresDatabase(config)` | Create PostgreSQL database |
| `createMysqlDatabase(config)` | Create MySQL database |
| `Database.fromConfig(config)` | Create from Stacks config |
| `Database.fromEnv()` | Create from environment |

### Query Builder Methods

| Method | Description |
|--------|-------------|
| `selectFrom(table)` | Start select query |
| `insertInto(table)` | Start insert query |
| `updateTable(table)` | Start update query |
| `deleteFrom(table)` | Start delete query |
| `where()` | Add where clause |
| `orderBy()` | Add ordering |
| `limit()` | Limit results |
| `offset()` | Skip results |
| `join()` | Add join |
| `groupBy()` | Group results |
| `having()` | Having clause |
