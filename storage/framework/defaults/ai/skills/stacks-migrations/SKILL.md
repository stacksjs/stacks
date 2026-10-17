---
name: stacks-migrations
description: Use when working with database migrations in a Stacks application - creating migration files, running migrations, fresh migration (drop + recreate), seeding after migration, migration file naming conventions, or the 237 built-in migration files. For the database API itself (queries, connections, SQL helpers), see stacks-database.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript, SQLite >= 3.47.2
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Database Migrations

Schema change management via migration files.

## Key Paths
- Migration files: `database/migrations/`
- Database config: `config/database.ts`
- Model snapshot: `storage/framework/database/model-snapshot.<dialect>.json`

## CLI Commands

```bash
buddy migrate                       # run pending migrations
buddy migrate --diff                # show SQL without running
buddy migrate --auth                # include auth tables
buddy migrate:fresh                 # drop ALL tables and re-migrate
buddy migrate:fresh --seed          # drop, migrate, then seed
buddy make:migration <name>         # create new migration file
buddy seed                          # seed database
buddy generate:migrations           # generate migrations from model diffs
buddy migrate:regenerate <dialect>  # rebuild the whole corpus from the models
buddy migrate:status                # corpus vs ledger vs live schema; lists hand-written files
buddy migrate:align                 # plan repairs of a database that drifted from the models
buddy migrate:align --apply         # rename legacy indexes, add missing indexes/FKs/columns, widen losslessly
```

## Creating a Schema Migration

```bash
buddy generate:migrations
```

Define or update the model first, then let the generator write the SQL in
`database/migrations/`. Do not hand-write a model's schema changes or edit a
generated migration to compensate for a missing model declaration.

## Migration Generation from Models

When you define or modify a model, generate migrations automatically:

```bash
buddy generate:migrations
```

This recursively discovers the application and framework model roots:

- `storage/framework/defaults/app/Models/`
- `app/Models/`

Framework defaults are a fallback when the application has no models of its own.
When `app/Models/` contributes models, the generator uses that application's
schema and excludes framework demo tables. Set
`database.models.includeFrameworkDefaults` only when the application deliberately
wants the merged registry; application models override matching framework names.
Discovered package model roots also contribute their declared models.

The generator diffs the resolved registry against the committed dialect snapshot.
An application does not need an `app/Models/` directory for fallback framework
model migrations to be discovered. Inspect the resolved scope with verbose output
when a framework table is unexpectedly absent; do not hand-write a duplicate model
migration or enable every demo table to add a single infrastructure table.

The snapshot is part of the schema history and must be committed with the
generated migration. It lives under `storage/framework/database/`, not `.qb/`.
Run the generator a second time before committing. A stable change reports
`Nothing to migrate` and `Model snapshot unchanged`.

Generation also makes ignored, generator-marked SQL visible to Git using
intent-to-add, including on a no-op rerun. This handles global `*.sql` ignores
without changing application ignore rules or staging SQL contents. Review and
stage migrations with their models and snapshot normally; do not add per-file
`.gitignore` exceptions. Dry-run previews never change the Git index.

## How generated files are numbered

The `migrations` ledger keys on the filename and stores nothing else (no
checksum), and `migrate` skips every file whose name it lists. A new file that
reuses a recorded name is therefore never applied, silently. That happens after
`migrate:regenerate` restarts the corpus at 1 while older databases still hold
the old corpus's rows.

So `generate:migrations` numbers past three sources, not just the files on
disk: the ledger of the configured database (when it can be read; a missing
SQLite file is not created), and every filename the migrations directory has
dropped in git history (`retiredMigrationNames`, renames included), which
stands in for production ledgers this machine cannot see. Numbering continues
after the highest sequential ordinal among them and skips any ordinal they use.
Timestamp ordinals (`make:migration` names, >= 1e9) found only in the ledger or
history are skipped but do not raise the floor; package band files are ignored.
Expect a gap after a regeneration; it is intended. In a shallow clone with no
database the guard falls back to the files on disk, so generate locally.

Do not rename a generated file to close a gap or reuse a number, and do not
renumber a file that any database has run. `buddy migrate` warns when two
generated files share a number (two branches each generated it), and
`buddy migrate --strict` refuses any duplicated number before running anything.
Renumber the unapplied file past the highest number.

## Built-in migration families

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

1. Define/modify the app model under `app/Models/`; edit defaults only when working on the framework
2. Run `buddy generate:migrations` to generate SQL diffs
3. Review generated migration files
4. Run `buddy generate:migrations` again and confirm there is no remaining diff
5. Run `buddy migrate` to apply
6. Review models, generated SQL, and `storage/framework/database/model-snapshot.<dialect>.json` together; commit when authorized

## Native migration and schema tooling

Models, named pivot schemas, indexes, foreign-key actions, auth/queue/notification
support tables, and optional feature selection contribute to schema management.
The model diff uses the dialect snapshot; live schema inspection is a separate
drift check. A stable no-op generation is not proof that an independently edited
production database matches the declaration.

Inspect native schema, FK and unique-index audits through the database package:
`auditSchemaDrift`, `auditForeignKeys`, `auditUniqueIndexes`, and their associated
CLI commands. Read `buddy list` and each command's help for the current flags.
Safe schema helpers include `addColumnSafely`, `renameColumnSafely`, and
`backfillInBatches`; they have dialect-specific preconditions and are not a
universal zero-downtime guarantee.

The runner tracks applied migrations, locks concurrent runs, selects the active
dialect corpus, and preserves application-owned tables when optional bundles
are excluded. Removing a feature from generation is not permission to drop its
live data. MySQL/PostgreSQL/Vitess/Turso require their own SQL and evidence
checks; never run SQLite SQL on a different provider because its filename exists.

Source: `core/database/src/{migrations,model-sources,migration-ledger,
safe-migrations,schema-drift,fk-audit,unique-audit}.ts`, `config/query-builder.ts`,
and their retained database tests.

## Drifted databases and hand-written migrations

Every migration should carry the generator's `-- qb:generated` marker.
`migrate:status` lists files without it and `--strict` fails on them; allow
reference-data files in `database.safety.allowHandWrittenMigrations`.

To bring a database built from hand-written history under the models:
`migrate:regenerate <dialect> --replace-unmarked --force` (replaces obsolete enum
type files, index drops and DELETE/UPDATE-only data fixes; never INSERT/COPY
files), then `migrate:align --apply` (Postgres: renames legacy-named indexes,
adds missing indexes, foreign keys after an orphan check, missing columns, and
lossless widenings; reports everything destructive), then
`migrate:status --reconcile` and `migrate`.

## Gotchas
- `migrate:fresh` drops ALL tables — only use in development
- Migrations run in filename order; two files with one number run alphabetically, which `--strict` refuses
- Never reuse a migration filename: the ledger keys on the name only, so a reused name is skipped, not run
- Never edit a migration that's been run in production — create a new one
- Keep the committed model snapshot in sync with every generated migration
- Do not commit a second snapshot under `.qb/`; that indicates a missing `snapshotDir` configuration
- If a generated SQLite migration rebuilds tables, test it against a copy of the current database and run `PRAGMA integrity_check` plus `PRAGMA foreign_key_check`
- `--seed` flag after `migrate:fresh` seeds the database with factory data
- 237 migration files exist by default for all framework models
- SQLite >= 3.47.2 is required (system requirement)
- For the database API (queries, connections), see the `stacks-database` skill
