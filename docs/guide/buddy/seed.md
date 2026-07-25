---
title: Seed Command
description: "buddy seed fills your database with realistic test data, generated from the factory functions declared on your models."
---
# Seed Command

`buddy seed` fills your database with realistic test data. There are no seeder
files to write or register: seeding reads the models you already have.

```bash
buddy seed
```

## How it works

Two pieces on the model drive everything:

- the **`useSeeder` trait** says how many rows to generate, and optionally pins
  specific ones
- each attribute's **`factory` function** says what a single value looks like

`buddy seed` walks every model that declares `useSeeder`, generates that many
rows from the attribute factories, and inserts them. A model without the trait
is never seeded.

```typescript
// app/Models/Post.ts
import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

export default defineModel({
  name: 'Post',
  table: 'posts',

  traits: {
    useTimestamps: true,
    useSeeder: { count: 100 },
  },

  belongsTo: ['Author'],

  attributes: {
    title: {
      required: true,
      fillable: true,
      validation: { rule: schema.string().min(3).max(255) },
      factory: faker => faker.lorem.sentence(),
    },
    content: {
      fillable: true,
      validation: { rule: schema.string() },
      factory: faker => faker.lorem.paragraphs(3),
    },
    publishedAt: {
      fillable: true,
      validation: { rule: schema.timestamp() },
      factory: faker => faker.date.past().toISOString().slice(0, 19).replace('T', ' '),
    },
    status: {
      fillable: true,
      default: 'draft',
      validation: { rule: schema.enum(['draft', 'published', 'archived']) },
      factory: faker => faker.helpers.arrayElement(['draft', 'published', 'archived']),
    },
  },
} as const)
```

The `faker` argument comes from `@stacksjs/faker` - you never import it inside a
model.

## Options

| Option | Description |
|--------|-------------|
| `--only [models]` | Comma-separated list of models to seed |
| `--except [models]` | Comma-separated list of models to skip |
| `--include-defaults` | Also seed the framework's built-in models |
| `--fresh` | Truncate each table before seeding |
| `--allow-protected` | Seed auth/oauth models on a non-fresh database |
| `-p, --project [project]` | Target a specific project |
| `--verbose` | Enable verbose output |

`buddy db:seed` is an alias for `buddy seed`.

## Examples

```bash
buddy seed                          # every model with a useSeeder trait
buddy seed --fresh                  # truncate first, then re-seed
buddy seed --only Post,Comment      # just these two
buddy seed --except User            # everything but this one
buddy seed --include-defaults       # framework built-ins too
buddy migrate:fresh --seed          # drop, re-migrate, seed - the usual reset
```

## Pinning specific rows

`fixtures` sets specific rows over the generated ones. Keys use the model's
camelCase attribute names and are stored as snake_case columns.

```typescript
traits: {
  useSeeder: {
    count: 50,
    fixtures: [
      { name: 'Admin', email: 'admin@example.com' },
      { name: 'Support', email: 'support@example.com' },
    ],
  },
},
```

The first two rows are those two; the remaining 48 come from the factories. If
`fixtures` is longer than `count`, every fixture is still inserted.

## Rules worth knowing

**Tables that already have rows are skipped.** Seeding is not additive by
default, so re-running it will not pile up duplicates. Pass `--fresh` to
truncate and regenerate.

**Auth and OAuth models are protected.** On a non-fresh database, `User`,
`OauthAccessToken`, `OauthRefreshToken` and friends are skipped, because
re-rolling the Personal Access Client secret would silently invalidate every
live session. `--fresh` seeds them (you are wiping the database anyway), and
`--allow-protected` is the explicit override.

**Your models win over the defaults.** `app/Models/Post.ts` replaces the
built-in `Post`; only one of them seeds. Framework models are excluded entirely
unless you pass `--include-defaults`.

**Foreign keys need their parents.** A model that `belongsTo` another needs the
parent seeded too. If a seed fails on a constraint, check that the parent model
also carries a `useSeeder` trait.

## Environment

Seeding respects `APP_ENV` and connects to whatever `config/database.ts`
resolves for it.

```bash
APP_ENV=local buddy seed
APP_ENV=staging buddy seed
```

Be deliberate about anything other than local: `--fresh` truncates real tables.

## Troubleshooting

**"No models declare a `useSeeder` trait - nothing to seed."**
Your models have no seeding configured. Add `useSeeder: { count: N }` to the
ones you want filled, or pass `--include-defaults` to seed the framework's.

**Unique-constraint violations.**
Faker can repeat values across a large run. Make the factory itself unique
rather than relying on chance:

```typescript
email: {
  unique: true,
  validation: { rule: schema.string().email() },
  factory: faker => `${faker.string.alphanumeric(10)}@example.com`,
},
```

**Foreign-key failures.**
The referenced parent has no rows. Give the parent model a `useSeeder` trait, or
seed it first with `--only Parent`.

## Related

- [buddy migrate](/guide/buddy/migrate) - run database migrations
- [Models](/basics/models) - the full `defineModel()` reference
- [Database package](/packages/database) - queries, transactions, and seeding
