# Seed Command

The `buddy seed` command populates your database with test data using model factories, making it easy to generate realistic data for development and testing.

## Basic Usage

```bash
buddy seed
```

## Command Syntax

```bash
buddy seed [options]
```

### Options

| Option | Description |
|--------|-------------|
| `-p, --project [project]` | Target a specific project |
| `--verbose` | Enable verbose output |

## Aliases

```bash
buddy seed
buddy db:seed
```

## How Seeding Works

Stacks uses model-based seeding. For each model with a defined factory, the seeder:

1. Reads the model's seeder configuration
2. Uses the factory to generate fake data
3. Inserts the records into the database

## Defining Seeders

Seeders are defined in your models:

```typescript
// app/Models/User.ts
import { Model } from '@stacksjs/orm'
import { faker } from '@stacksjs/faker'

export default class User extends Model {
  static table = 'users'

  static fields = {
    name: { type: 'string', required: true },
    email: { type: 'string', unique: true, required: true },
    password: { type: 'string', required: true },
  }

  // Define seeder
  static seeder = {
    count: 50, // Create 50 users
  }

  // Define factory for generating fake data
  static factory() {
    return {
      name: faker.person.fullName(),
      email: faker.internet.email(),
      password: faker.internet.password(),
    }
  }
}
```

## Examples

### Basic Seeding

```bash
buddy seed
```

Output:
```
buddy seed

Seeded your local database.

Completed in 1.23s
```

### Seeding with Verbose Output

```bash
buddy seed --verbose
```

Shows detailed information about each model being seeded.

### Seeding After Fresh Migration

```bash
buddy migrate:fresh --seed
```

This is the recommended way to reset and seed your database in one command.

### Seeding Specific Project

```bash
buddy seed -p my-project
```

## Factory Definitions

Factories generate realistic fake data using Faker:

```typescript
// app/Models/Post.ts
import { Model } from '@stacksjs/orm'
import { faker } from '@stacksjs/faker'

export default class Post extends Model {
  static table = 'posts'

  static fields = {
    title: { type: 'string', required: true },
    content: { type: 'text' },
    authorId: { type: 'integer', references: 'users.id' },
    publishedAt: { type: 'timestamp', nullable: true },
    status: { type: 'string', default: 'draft' },
  }

  static seeder = {
    count: 100,
  }

  static factory() {
    return {
      title: faker.lorem.sentence(),
      content: faker.lorem.paragraphs(3),
      authorId: faker.number.int({ min: 1, max: 50 }),
      publishedAt: faker.date.past(),
      status: faker.helpers.arrayElement(['draft', 'published', 'archived']),
    }
  }
}
```

## Advanced Factory Patterns

### Conditional Data

```typescript
static factory() {
  const isPublished = faker.datatype.boolean()

  return {
    title: faker.lorem.sentence(),
    status: isPublished ? 'published' : 'draft',
    publishedAt: isPublished ? faker.date.past() : null,
  }
}
```

### Sequential Data

```typescript
let counter = 0

static factory() {
  counter++
  return {
    email: `user${counter}@example.com`,
    username: `user${counter}`,
  }
}
```

### Related Records

```typescript
static seeder = {
  count: 50,
  // Create related records
  relations: {
    posts: 5, // Create 5 posts for each user
  },
}
```

## Environment-Specific Seeding

Seeding respects the `APP_ENV` environment variable:

```bash
# Seed local database (default)
APP_ENV=local buddy seed

# Seed staging database
APP_ENV=staging buddy seed
```

**Warning**: Be careful when seeding non-development environments.

## Troubleshooting

### No Models Found

```
Error: No models found. Please create models in app/Models or ensure framework defaults exist.
```

**Solution**: Create models with seeder configurations:

```bash
buddy make:model User
```

### Seeding Fails Due to Constraints

Foreign key constraints may cause seeding to fail:

```bash
# Ensure parent records exist first
# Order matters in your models
```

**Solution**: Check the seeding order and ensure related records exist.

### Duplicate Entry Errors

If unique constraints are violated:

```typescript
static factory() {
  return {
    // Use unique values
    email: faker.internet.email({ provider: 'example.com' }),
    // Or add timestamp for uniqueness
    username: `user_${Date.now()}_${faker.number.int(1000)}`,
  }
}
```

### Memory Issues with Large Seeds

For seeding large amounts of data:

```bash
# Increase memory limit
NODE_OPTIONS="--max-old-space-size=4096" buddy seed
```

## Best Practices

### Development Workflow

```bash
# Reset database with fresh seed data
buddy migrate:fresh --seed
```

### Testing

```bash
# Seed test database before running tests
APP_ENV=testing buddy seed
buddy test
```

### Realistic Data

Use Faker's locale support for realistic data:

```typescript
import { faker } from '@stacksjs/faker'

// Use German locale
faker.locale = 'de'

static factory() {
  return {
    name: faker.person.fullName(), // German names
    address: faker.location.streetAddress(), // German addresses
  }
}
```

## Related Commands

- [buddy migrate](/guide/buddy/migrate) - Run database migrations
- [buddy migrate:fresh](/guide/buddy/migrate) - Fresh migration with optional seeding
- [buddy make:model](/guide/buddy/generate) - Create a new model
