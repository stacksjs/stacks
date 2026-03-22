---
name: stacks-migrations
description: Use when working with database migrations in a Stacks application — creating migration files, running migrations, fresh migration (drop + recreate), seeding after migration, migration file naming conventions, or the 96+ built-in migration files. For the database API itself (queries, connections, SQL helpers), see stacks-database.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript, SQLite >= 3.47.2
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Database Migrations

Schema change management via migration files.

## Key Paths
- Migration files: `database/migrations/` (96+ files)
- Database config: `config/database.ts`

## CLI Commands

```bash
buddy migrate                       # run pending migrations
buddy migrate --diff                # show SQL without running
buddy migrate --auth                # include auth tables
buddy migrate:fresh                 # drop ALL tables and re-migrate
buddy migrate:fresh --seed          # drop, migrate, then seed
buddy migrate:dns                   # DNS-specific migration
buddy make:migration <name>         # create new migration file
buddy seed                          # seed database
buddy generate:migrations           # generate migrations from model diffs
```

## Creating a Migration

```bash
buddy make:migration create_orders_table
```

Creates a timestamped migration file in `database/migrations/`.

## Migration Generation from Models

When you define or modify a model, generate migrations automatically:

```bash
buddy generate:migrations
```

This diffs model definitions against the current schema and generates the necessary SQL.

## Built-in Migrations (96+)

The framework includes migrations for all built-in models:

### Core Tables
- `users` — id, name, email (unique), password, timestamps
- `personal_access_tokens` — auth tokens
- `passkeys` — WebAuthn credentials
- `password_resets` — password reset tokens

### Content
- `posts` — title, content, excerpt, views, status, published_at, author_id
- `pages`, `categories`, `tags`, `comments`
- `authors` — linked to users

### Commerce (20+ tables)
- `products`, `product_variants`, `product_units`
- `orders`, `order_items`
- `carts`, `cart_items`
- `coupons`, `gift_cards`, `reviews`
- `customers`, `manufacturers`

### Payments
- `payments`, `payment_methods`, `payment_products`, `payment_transactions`
- `subscriptions`, `transactions`

### Shipping
- `shipping_methods`, `shipping_rates`, `shipping_zones`
- `delivery_routes`, `drivers`

### System
- `jobs`, `failed_jobs` — queue tables
- `errors`, `logs`, `notifications`
- `activities`, `requests`, `websockets`

### Indexes
- `users.email` (unique), `users(email, name)` (composite)
- `subscribers.email` (unique)
- `coupons.code` (unique), `gift_cards.code` (unique)
- `payments.transaction_id` (unique)
- `subscriptions.provider_id` (unique)

## Workflow

1. Define/modify model in `storage/framework/models/` or `app/Models/`
2. Run `buddy generate:migrations` to generate SQL diffs
3. Review generated migration files
4. Run `buddy migrate` to apply

## Gotchas
- `migrate:fresh` drops ALL tables — only use in development
- Migrations run in filename order (timestamps ensure correct sequence)
- Never edit a migration that's been run in production — create a new one
- `--seed` flag after `migrate:fresh` seeds the database with factory data
- 96+ migration files exist by default for all framework models
- SQLite >= 3.47.2 is required (system requirement)
- For the database API (queries, connections), see the `stacks-database` skill
