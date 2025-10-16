import { italic, log } from '@stacksjs/cli'
import { db, sql } from '@stacksjs/database'
import { path } from '@stacksjs/path'
import { hasMigrationBeenCreated } from '../index'

export function getTraitTables(): string[] {
  return [
    'tags',
    'taggables',
    'categorizables',
    'comments',
    'commentables',
    'commentable_upvotes',
    'passkeys',
    'password_resets',
    'query_logs',
    'migrations',
  ]
}

// SQLite/MySQL version
export async function createPasskeyMigration(): Promise<void> {
  const hasBeenMigrated = await hasMigrationBeenCreated('users')

  if (hasBeenMigrated)
    return

  let migrationContent = `import type { Database } from '@stacksjs/database'\n import { sql } from '@stacksjs/database'\n\n`
  migrationContent += `export async function up(db: Database<any>) {\n`
  migrationContent += `  await db.schema\n`
  migrationContent += `    .createTable('passkeys')\n`
  migrationContent += `    .addColumn('id', 'text')\n`
  migrationContent += `    .addColumn('cred_public_key', 'text')\n`
  migrationContent += `    .addColumn('webauthn_user_id', 'varchar(255)')\n`
  migrationContent += `    .addColumn('counter', 'integer', col => col.defaultTo(0))\n`
  migrationContent += `    .addColumn('device_type', 'varchar(255)')\n`
  migrationContent += `    .addColumn('credential_type', 'varchar(255)')\n`
  migrationContent += `    .addColumn('backup_eligible', 'boolean', col => col.defaultTo(false))\n`
  migrationContent += `    .addColumn('backup_status', 'boolean', col => col.defaultTo(false))\n`
  migrationContent += `    .addColumn('transports', 'varchar(255)')\n`
  migrationContent += `    .addColumn('last_used_at', 'text')\n`
  migrationContent += `    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))\n`
  migrationContent += `    .execute()\n`
  migrationContent += `    }\n`

  const timestamp = new Date().getTime().toString()
  const migrationFileName = `${timestamp}-create-passkeys-table.ts`
  const migrationFilePath = path.userMigrationsPath(migrationFileName)

  Bun.write(migrationFilePath, migrationContent)

  log.success(`Created migration: ${italic(migrationFileName)}`)
}

// PostgreSQL version
export async function createPostgresPasskeyMigration(): Promise<void> {
  const hasBeenMigrated = await hasMigrationBeenCreated('users')

  if (hasBeenMigrated)
    return

  let migrationContent = `import type { Database } from '@stacksjs/database'\n import { sql } from '@stacksjs/database'\n\n`
  migrationContent += `export async function up(db: Database<any>) {\n`
  migrationContent += `  await db.schema\n`
  migrationContent += `    .createTable('passkeys')\n`
  migrationContent += `    .addColumn('id', 'uuid', col => col.primaryKey())\n`
  migrationContent += `    .addColumn('cred_public_key', 'text')\n`
  migrationContent += `    .addColumn('webauthn_user_id', 'varchar(255)')\n`
  migrationContent += `    .addColumn('counter', 'integer', col => col.defaultTo(0))\n`
  migrationContent += `    .addColumn('device_type', 'varchar(255)')\n`
  migrationContent += `    .addColumn('credential_type', 'varchar(255)')\n`
  migrationContent += `    .addColumn('backup_eligible', 'boolean', col => col.defaultTo(false))\n`
  migrationContent += `    .addColumn('backup_status', 'boolean', col => col.defaultTo(false))\n`
  migrationContent += `    .addColumn('transports', 'varchar(255)')\n`
  migrationContent += `    .addColumn('last_used_at', 'timestamp')\n`
  migrationContent += `    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))\n`
  migrationContent += `    .execute()\n\n`
  migrationContent += `}\n`

  const timestamp = new Date().getTime().toString()
  const migrationFileName = `${timestamp}-create-passkeys-table.ts`
  const migrationFilePath = path.userMigrationsPath(migrationFileName)

  Bun.write(migrationFilePath, migrationContent)

  log.success(`Created migration: ${italic(migrationFileName)}`)
}

export async function createTaggableTable(): Promise<void> {
  const hasBeenMigrated = await hasMigrationBeenCreated('tags')

  if (hasBeenMigrated)
    return

  let migrationContent = `import type { Database } from '@stacksjs/database'\n`
  migrationContent += `import { sql } from '@stacksjs/database'\n\n`
  migrationContent += `export async function up(db: Database<any>) {\n`
  migrationContent += `  await db.schema\n`
  migrationContent += `    .createTable('tags')\n`
  migrationContent += `    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())\n`
  migrationContent += `    .addColumn('name', 'varchar(255)', col => col.notNull())\n`
  migrationContent += `    .addColumn('slug', 'varchar(255)', col => col.notNull().unique())\n`
  migrationContent += `    .addColumn('type', 'varchar(255)')\n`
  migrationContent += `    .addColumn('color', 'varchar(255)')\n`
  migrationContent += `    .addColumn('description', 'text')\n`
  migrationContent += `    .addColumn('is_active', 'boolean', col => col.defaultTo(true))\n`
  migrationContent += `    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))\n`
  migrationContent += `    .addColumn('updated_at', 'timestamp')\n`
  migrationContent += `    .execute()\n\n`

  migrationContent += `  await db.schema\n`
  migrationContent += `    .createIndex('idx_tags_slug')\n`
  migrationContent += `    .on('tags')\n`
  migrationContent += `    .column('slug')\n`
  migrationContent += `    .execute()\n\n`

  migrationContent += `  await db.schema\n`
  migrationContent += `    .createIndex('idx_tags_type')\n`
  migrationContent += `    .on('tags')\n`
  migrationContent += `    .column('type')\n`
  migrationContent += `    .execute()\n\n`

  migrationContent += `  await db.schema\n`
  migrationContent += `    .createIndex('idx_tags_name')\n`
  migrationContent += `    .on('tags')\n`
  migrationContent += `    .column('name')\n`
  migrationContent += `    .execute()\n\n`

  migrationContent += `}\n`

  const timestamp = new Date().getTime().toString()
  const migrationFileName = `${timestamp}-create-tags-table.ts`
  const migrationFilePath = path.userMigrationsPath(migrationFileName)

  Bun.write(migrationFilePath, migrationContent)

  log.success(`Created migration: ${italic(migrationFileName)}`)

  // Add small delay to ensure different timestamp for taggables migration
  await new Promise(resolve => setTimeout(resolve, 2))
  await createTaggablesTable()
}

export async function createPostgresTagsTable(): Promise<void> {
  const hasBeenMigrated = await hasMigrationBeenCreated('tags')

  if (hasBeenMigrated)
    return

  let migrationContent = `import type { Database } from '@stacksjs/database'\n`
  migrationContent += `import { sql } from '@stacksjs/database'\n\n`
  migrationContent += `export async function up(db: Database<any>) {\n`
  migrationContent += `  await db.schema\n`
  migrationContent += `    .createTable('tags')\n`
  migrationContent += `    .addColumn('id', 'serial', col => col.primaryKey())\n`
  migrationContent += `    .addColumn('name', 'varchar(255)', col => col.notNull())\n`
  migrationContent += `    .addColumn('slug', 'varchar(255)', col => col.notNull().unique())\n`
  migrationContent += `    .addColumn('type', 'varchar(255)')\n`
  migrationContent += `    .addColumn('color', 'varchar(255)')\n`
  migrationContent += `    .addColumn('description', 'text')\n`
  migrationContent += `    .addColumn('is_active', 'boolean', col => col.defaultTo(true))\n`
  migrationContent += `    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))\n`
  migrationContent += `    .addColumn('updated_at', 'timestamp')\n`
  migrationContent += `    .execute()\n\n`

  migrationContent += `  await db.schema\n`
  migrationContent += `    .createIndex('idx_tags_slug')\n`
  migrationContent += `    .on('tags')\n`
  migrationContent += `    .column('slug')\n`
  migrationContent += `    .execute()\n\n`

  migrationContent += `  await db.schema\n`
  migrationContent += `    .createIndex('idx_tags_type')\n`
  migrationContent += `    .on('tags')\n`
  migrationContent += `    .column('type')\n`
  migrationContent += `    .execute()\n\n`

  migrationContent += `  await db.schema\n`
  migrationContent += `    .createIndex('idx_tags_name')\n`
  migrationContent += `    .on('tags')\n`
  migrationContent += `    .column('name')\n`
  migrationContent += `    .execute()\n\n`

  migrationContent += `}\n`

  const timestamp = new Date().getTime().toString()
  const migrationFileName = `${timestamp}-create-tags-table.ts`
  const migrationFilePath = path.userMigrationsPath(migrationFileName)

  Bun.write(migrationFilePath, migrationContent)

  log.success(`Created migration: ${italic(migrationFileName)}`)

  // Add small delay to ensure different timestamp for taggables migration
  await new Promise(resolve => setTimeout(resolve, 2))
  await createPostgresTaggablesTable()
}

// SQLite/MySQL version
export async function createCategorizableTable(): Promise<void> {
  const hasBeenMigrated = await hasMigrationBeenCreated('categorizable')

  if (hasBeenMigrated)
    return

  let migrationContent = `import type { Database } from '@stacksjs/database'\n`
  migrationContent += `import { sql } from '@stacksjs/database'\n\n`
  migrationContent += `export async function up(db: Database<any>) {\n`
  migrationContent += `  await db.schema\n`
  migrationContent += `    .createTable('categorizables')\n`
  migrationContent += `    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())\n`
  migrationContent += `    .addColumn('name', 'varchar(255)', col => col.notNull())\n`
  migrationContent += `    .addColumn('slug', 'varchar(255)', col => col.notNull().unique())\n`
  migrationContent += `    .addColumn('description', 'text')\n`
  migrationContent += `    .addColumn('is_active', 'boolean', col => col.defaultTo(true))\n`
  migrationContent += `    .addColumn('categorizable_type', 'varchar(255)', col => col.notNull())\n`
  migrationContent += `    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))\n`
  migrationContent += `    .addColumn('updated_at', 'timestamp')\n`
  migrationContent += `    .execute()\n\n`

  // Add indexes with more descriptive names
  migrationContent += `  await db.schema\n`
  migrationContent += `    .createIndex('categorizables_id_index')\n`
  migrationContent += `    .on('categorizables')\n`
  migrationContent += `    .column('id')\n`
  migrationContent += `    .execute()\n\n`

  migrationContent += `  await db.schema\n`
  migrationContent += `    .createIndex('categorizables_slug_index')\n`
  migrationContent += `    .on('categorizables')\n`
  migrationContent += `    .column('slug')\n`
  migrationContent += `    .execute()\n\n`

  migrationContent += `  await db.schema\n`
  migrationContent += `    .createIndex('categorizables_polymorphic_index')\n`
  migrationContent += `    .on('categorizables')\n`
  migrationContent += `    .columns(['categorizable_type'])\n`
  migrationContent += `    .execute()\n\n`

  migrationContent += `  await db.schema\n`
  migrationContent += `    .createIndex('categorizables_is_active_index')\n`
  migrationContent += `    .on('categorizables')\n`
  migrationContent += `    .column('is_active')\n`
  migrationContent += `    .execute()\n`

  migrationContent += `}\n`

  const timestamp = new Date().getTime().toString()
  const migrationFileName = `${timestamp}-create-categorizables-table.ts`
  const migrationFilePath = path.userMigrationsPath(migrationFileName)

  Bun.write(migrationFilePath, migrationContent)

  log.success(`Created migration: ${italic(migrationFileName)}`)
}

// PostgreSQL version
export async function createPostgresCategorizableTable(): Promise<void> {
  const hasBeenMigrated = await hasMigrationBeenCreated('categorizable')

  if (hasBeenMigrated)
    return

  let migrationContent = `import type { Database } from '@stacksjs/database'\n`
  migrationContent += `import { sql } from '@stacksjs/database'\n\n`
  migrationContent += `export async function up(db: Database<any>) {\n`
  migrationContent += `  await db.schema\n`
  migrationContent += `    .createTable('categorizables')\n`
  migrationContent += `    .addColumn('id', 'serial', col => col.primaryKey())\n`
  migrationContent += `    .addColumn('name', 'varchar(255)', col => col.notNull())\n`
  migrationContent += `    .addColumn('slug', 'varchar(255)', col => col.notNull().unique())\n`
  migrationContent += `    .addColumn('description', 'text')\n`
  migrationContent += `    .addColumn('order', 'integer', col => col.defaultTo(0))\n`
  migrationContent += `    .addColumn('is_active', 'boolean', col => col.defaultTo(true))\n`
  migrationContent += `    .addColumn('categorizable_type', 'varchar(255)', col => col.notNull())\n`
  migrationContent += `    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))\n`
  migrationContent += `    .addColumn('updated_at', 'timestamp')\n`
  migrationContent += `    .execute()\n\n`

  migrationContent += `  await db.schema\n`
  migrationContent += `    .createIndex('idx_categorizables_slug')\n`
  migrationContent += `    .on('categorizables')\n`
  migrationContent += `    .column('slug')\n`
  migrationContent += `    .execute()\n\n`

  migrationContent += `  await db.schema\n`
  migrationContent += `    .createIndex('idx_categorizables_polymorphic')\n`
  migrationContent += `    .on('categorizables')\n`
  migrationContent += `    .columns(['categorizable_type'])\n`
  migrationContent += `    .execute()\n\n`

  migrationContent += `  await db.schema\n`
  migrationContent += `    .createIndex('idx_categorizables_order')\n`
  migrationContent += `    .on('categorizables')\n`
  migrationContent += `    .column('order')\n`
  migrationContent += `    .execute()\n\n`

  migrationContent += `  await db.schema\n`
  migrationContent += `    .createIndex('idx_categorizables_is_active')\n`
  migrationContent += `    .on('categorizables')\n`
  migrationContent += `    .column('is_active')\n`
  migrationContent += `    .execute()\n`

  migrationContent += `}\n`

  const timestamp = new Date().getTime().toString()
  const migrationFileName = `${timestamp}-create-categorizables-table.ts`
  const migrationFilePath = path.userMigrationsPath(migrationFileName)

  Bun.write(migrationFilePath, migrationContent)

  log.success(`Created migration: ${italic(migrationFileName)}`)
}

// SQLite/MySQL version
export async function createCommentablesTable(options: {
  requiresApproval?: boolean
  reportable?: boolean
  votable?: boolean
  requiresAuth?: boolean
} = {}): Promise<void> {
  const hasBeenMigrated = await hasMigrationBeenCreated('commentables')

  if (hasBeenMigrated)
    return

  let migrationContent = `import type { Database } from '@stacksjs/database'\n`
  migrationContent += `import { sql } from '@stacksjs/database'\n\n`
  migrationContent += `export async function up(db: Database<any>) {\n`
  migrationContent += `  await db.schema\n`
  migrationContent += `    .createTable('comments')\n`
  migrationContent += `    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())\n`
  migrationContent += `    .addColumn('title', 'varchar(255)', col => col.notNull())\n`
  migrationContent += `    .addColumn('body', 'text', col => col.notNull())\n`
  migrationContent += `    .addColumn('status', 'varchar(50)', col => col.notNull().defaultTo('${options.requiresApproval ? 'pending' : 'approved'}'))\n`
  migrationContent += `    .addColumn('approved_at', 'integer')\n`
  migrationContent += `    .addColumn('rejected_at', 'integer')\n`

  if (options.reportable) {
    migrationContent += `    .addColumn('reports_count', 'integer', col => col.defaultTo(0))\n`
    migrationContent += `    .addColumn('reported_at', 'integer')\n`
  }

  if (options.requiresAuth) {
    migrationContent += `    .addColumn('user_id', 'integer', col => col.notNull())\n`
  }

  migrationContent += `    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))\n`
  migrationContent += `    .addColumn('updated_at', 'timestamp')\n`
  migrationContent += `    .execute()\n\n`

  // Add indexes
  migrationContent += `  await db.schema.createIndex('idx_comments_status').on('comments').column('status').execute()\n`
  migrationContent += `  await db.schema.createIndex('idx_comments_created_at').on('comments').column('created_at').execute()\n`

  migrationContent += `}\n`

  const timestamp = new Date().getTime().toString()
  const migrationFileName = `${timestamp}-create-comments-table.ts`
  const migrationFilePath = path.userMigrationsPath(migrationFileName)

  Bun.write(migrationFilePath, migrationContent)

  log.success(`Created migration: ${italic(migrationFileName)}`)
}

// PostgreSQL version
export async function createPostgresCommentsTable(): Promise<void> {
  const hasBeenMigrated = await hasMigrationBeenCreated('commentables')

  if (hasBeenMigrated)
    return

  let migrationContent = `import type { Database } from '@stacksjs/database'\n`
  migrationContent += `import { sql } from '@stacksjs/database'\n\n`
  migrationContent += `export async function up(db: Database<any>) {\n`
  migrationContent += `  await db.schema\n`
  migrationContent += `    .createTable('comments')\n`
  migrationContent += `    .addColumn('id', 'serial', col => col.primaryKey())\n`
  migrationContent += `    .addColumn('title', 'varchar(255)', col => col.notNull())\n`
  migrationContent += `    .addColumn('body', 'text', col => col.notNull())\n`
  migrationContent += `    .addColumn('status', 'varchar(50)', col => col.notNull().defaultTo('pending'))\n`
  migrationContent += `    .addColumn('approved_at', 'integer')\n`
  migrationContent += `    .addColumn('rejected_at', 'integer')\n`
  migrationContent += `    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))\n`
  migrationContent += `    .addColumn('updated_at', 'timestamp')\n`
  migrationContent += `    .execute()\n\n`
  migrationContent += `  await db.schema.createIndex('idx_comments_status').on('comments').column('status').execute()\n`
  migrationContent += `  await db.schema.createIndex('idx_comments_created_at').on('comments').column('created_at').execute()\n`
  migrationContent += `}\n`

  const timestamp = new Date().getTime().toString()
  const migrationFileName = `${timestamp}-create-comments-table.ts`
  const migrationFilePath = path.userMigrationsPath(migrationFileName)

  Bun.write(migrationFilePath, migrationContent)

  log.success(`Created migration: ${italic(migrationFileName)}`)
}

export async function dropCommonTables(): Promise<void> {
  await db.schema.dropTable('passkeys').ifExists().execute()
  await db.schema.dropTable('password_resets').ifExists().execute()
  await db.schema.dropTable('query_logs').ifExists().execute()
  await db.schema.dropTable('categorizables').ifExists().execute()
  await db.schema.dropTable('commenteable_upvotes').ifExists().execute()
  await db.schema.dropTable('tags').ifExists().execute()
  await db.schema.dropTable('taggables').ifExists().execute()
  await db.schema.dropTable('categorizable_models').ifExists().execute()
  await db.schema.dropTable('commentables').ifExists().execute()
  await db.schema.dropTable('comments').ifExists().execute()
  await db.schema.dropTable('categories_models').ifExists().execute()
  await db.schema.dropTable('activities').ifExists().execute()
}

export async function truncateMigrationTables(): Promise<void> {
  await sql`TRUNCATE TABLE migrations`.execute(db)
  await sql`TRUNCATE TABLE migration_locks`.execute(db)
}

export async function createCommentUpvoteMigration(): Promise<void> {
  const hasBeenMigrated = await hasMigrationBeenCreated('commenteable_upvotes')

  if (hasBeenMigrated)
    return

  let migrationContent = `import type { Database } from '@stacksjs/database'\n import { sql } from '@stacksjs/database'\n\n`
  migrationContent += `export async function up(db: Database<any>) {\n`
  migrationContent += `  await db.schema\n`
  migrationContent += `    .createTable('commenteable_upvotes')\n`
  migrationContent += `    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())\n`
  migrationContent += `    .addColumn('upvoteable_id', 'integer', col => col.notNull())\n`
  migrationContent += `    .addColumn('upvoteable_type', 'varchar(255)', col => col.notNull())\n`
  migrationContent += `    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))\n`
  migrationContent += `    .execute()\n\n`
  migrationContent += `  await db.schema.createIndex('idx_commenteable_upvotes_upvoteable').on('commenteable_upvotes').columns(['upvoteable_id', 'upvoteable_type']).execute()\n`
  migrationContent += `}\n`

  const timestamp = new Date().getTime().toString()
  const migrationFileName = `${timestamp}-create-commenteable_upvotes-table.ts`
  const migrationFilePath = path.userMigrationsPath(migrationFileName)

  Bun.write(migrationFilePath, migrationContent)

  log.success(`Created migration: ${italic(migrationFileName)}`)
}

export async function createPostgresCommentUpvoteMigration(): Promise<void> {
  const hasBeenMigrated = await hasMigrationBeenCreated('commenteable_upvotes')

  if (hasBeenMigrated)
    return

  let migrationContent = `import type { Database } from '@stacksjs/database'\n import { sql } from '@stacksjs/database'\n\n`
  migrationContent += `export async function up(db: Database<any>) {\n`
  migrationContent += `  await db.schema\n`
  migrationContent += `    .createTable('commenteable_upvotes')\n`
  migrationContent += `    .addColumn('id', 'serial', col => col.primaryKey())\n`
  migrationContent += `    .addColumn('upvoteable_id', 'integer', col => col.notNull())\n`
  migrationContent += `    .addColumn('upvoteable_type', 'varchar(255)', col => col.notNull())\n`
  migrationContent += `    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))\n`
  migrationContent += `    .execute()\n\n`
  migrationContent += `  await db.schema.createIndex('idx_commenteable_upvotes_upvoteable').on('commenteable_upvotes').columns(['upvoteable_id', 'upvoteable_type']).execute()\n`
  migrationContent += `}\n`

  const timestamp = new Date().getTime().toString()
  const migrationFileName = `${timestamp}-create-commenteable_upvotes-table.ts`
  const migrationFilePath = path.userMigrationsPath(migrationFileName)

  Bun.write(migrationFilePath, migrationContent)

  log.success(`Created migration: ${italic(migrationFileName)}`)
}

export async function createCommentablesPivotTable(): Promise<void> {
  const hasBeenMigrated = await hasMigrationBeenCreated('commentables')

  if (hasBeenMigrated)
    return

  let migrationContent = `import type { Database } from '@stacksjs/database'\n`
  migrationContent += `import { sql } from '@stacksjs/database'\n\n`
  migrationContent += `export async function up(db: Database<any>) {\n`
  migrationContent += `  await db.schema\n`
  migrationContent += `    .createTable('commentables')\n`
  migrationContent += `    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())\n`
  migrationContent += `    .addColumn('comment_id', 'integer', col => col.notNull())\n`
  migrationContent += `    .addColumn('commentable_id', 'integer', col => col.notNull())\n`
  migrationContent += `    .addColumn('commentable_type', 'varchar(255)', col => col.notNull())\n`
  migrationContent += `    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))\n`
  migrationContent += `    .addColumn('updated_at', 'timestamp')\n`
  migrationContent += `    .execute()\n\n`

  // SQLite doesn't support adding foreign key constraints via ALTER TABLE
  // Foreign keys can only be added during table creation in SQLite

  migrationContent += `  await db.schema\n`
  migrationContent += `    .createIndex('idx_commentables_comment')\n`
  migrationContent += `    .on('commentables')\n`
  migrationContent += `    .column('comment_id')\n`
  migrationContent += `    .execute()\n\n`

  migrationContent += `  await db.schema\n`
  migrationContent += `    .createIndex('idx_commentables_polymorphic')\n`
  migrationContent += `    .on('commentables')\n`
  migrationContent += `    .columns(['commentable_id', 'commentable_type'])\n`
  migrationContent += `    .execute()\n\n`

  migrationContent += `  await db.schema\n`
  migrationContent += `    .createIndex('idx_commentables_unique')\n`
  migrationContent += `    .on('commentables')\n`
  migrationContent += `    .columns(['comment_id', 'commentable_id', 'commentable_type'])\n`
  migrationContent += `    .unique()\n`
  migrationContent += `    .execute()\n\n`

  migrationContent += `}\n`

  const timestamp = new Date().getTime().toString()
  const migrationFileName = `${timestamp}-create-commentables-pivot-table.ts`
  const migrationFilePath = path.userMigrationsPath(migrationFileName)

  Bun.write(migrationFilePath, migrationContent)

  log.success(`Created migration: ${italic(migrationFileName)}`)
}

export async function createPostgresCommentablesPivotTable(): Promise<void> {
  const hasBeenMigrated = await hasMigrationBeenCreated('commentables_pivot')

  if (hasBeenMigrated)
    return

  let migrationContent = `import type { Database } from '@stacksjs/database'\n`
  migrationContent += `import { sql } from '@stacksjs/database'\n\n`
  migrationContent += `export async function up(db: Database<any>) {\n`
  migrationContent += `  await db.schema\n`
  migrationContent += `    .createTable('commentables')\n`
  migrationContent += `    .addColumn('id', 'serial', col => col.primaryKey())\n`
  migrationContent += `    .addColumn('comment_id', 'integer', col => col.notNull())\n`
  migrationContent += `    .addColumn('commentable_id', 'integer', col => col.notNull())\n`
  migrationContent += `    .addColumn('commentable_type', 'varchar(255)', col => col.notNull())\n`
  migrationContent += `    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))\n`
  migrationContent += `    .addColumn('updated_at', 'timestamp')\n`
  migrationContent += `    .execute()\n\n`

  // Add foreign key constraint to comments table
  migrationContent += `  await db.schema\n`
  migrationContent += `    .alterTable('commentables')\n`
  migrationContent += `    .addForeignKeyConstraint('commentables_comment_id_foreign', ['comment_id'], 'comments', ['id'], (cb) => cb.onDelete('cascade'))\n`
  migrationContent += `    .execute()\n\n`

  migrationContent += `  await db.schema\n`
  migrationContent += `    .createIndex('idx_commentables_comment')\n`
  migrationContent += `    .on('commentables')\n`
  migrationContent += `    .column('comment_id')\n`
  migrationContent += `    .execute()\n\n`

  migrationContent += `  await db.schema\n`
  migrationContent += `    .createIndex('idx_commentables_polymorphic')\n`
  migrationContent += `    .on('commentables')\n`
  migrationContent += `    .columns(['commentable_id', 'commentable_type'])\n`
  migrationContent += `    .execute()\n\n`

  migrationContent += `  await db.schema\n`
  migrationContent += `    .createIndex('idx_commentables_unique')\n`
  migrationContent += `    .on('commentables')\n`
  migrationContent += `    .columns(['comment_id', 'commentable_id', 'commentable_type'])\n`
  migrationContent += `    .unique()\n`
  migrationContent += `    .execute()\n\n`

  migrationContent += `}\n`

  const timestamp = new Date().getTime().toString()
  const migrationFileName = `${timestamp}-create-commentables-pivot-table.ts`
  const migrationFilePath = path.userMigrationsPath(migrationFileName)

  Bun.write(migrationFilePath, migrationContent)

  log.success(`Created migration: ${italic(migrationFileName)}`)
}

export async function createTaggablesTable(): Promise<void> {
  const hasBeenMigrated = await hasMigrationBeenCreated('taggables')

  if (hasBeenMigrated)
    return

  let migrationContent = `import type { Database } from '@stacksjs/database'\n`
  migrationContent += `import { sql } from '@stacksjs/database'\n\n`
  migrationContent += `export async function up(db: Database<any>) {\n`
  migrationContent += `  await db.schema\n`
  migrationContent += `    .createTable('taggables')\n`
  migrationContent += `    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())\n`
  migrationContent += `    .addColumn('tag_id', 'integer', col => col.notNull())\n`
  migrationContent += `    .addColumn('taggable_id', 'integer', col => col.notNull())\n`
  migrationContent += `    .addColumn('taggable_type', 'varchar(255)', col => col.notNull())\n`
  migrationContent += `    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))\n`
  migrationContent += `    .addColumn('updated_at', 'timestamp')\n`
  migrationContent += `    .execute()\n\n`

  // SQLite doesn't support adding foreign key constraints via ALTER TABLE
  // Foreign keys can only be added during table creation in SQLite

  migrationContent += `  await db.schema\n`
  migrationContent += `    .createIndex('idx_taggables_tag')\n`
  migrationContent += `    .on('taggables')\n`
  migrationContent += `    .column('tag_id')\n`
  migrationContent += `    .execute()\n\n`

  migrationContent += `  await db.schema\n`
  migrationContent += `    .createIndex('idx_taggables_polymorphic')\n`
  migrationContent += `    .on('taggables')\n`
  migrationContent += `    .columns(['taggable_id', 'taggable_type'])\n`
  migrationContent += `    .execute()\n\n`

  migrationContent += `  await db.schema\n`
  migrationContent += `    .createIndex('idx_taggables_unique')\n`
  migrationContent += `    .on('taggables')\n`
  migrationContent += `    .columns(['tag_id', 'taggable_id', 'taggable_type'])\n`
  migrationContent += `    .unique()\n`
  migrationContent += `    .execute()\n\n`

  migrationContent += `}\n`

  const timestamp = new Date().getTime().toString()
  const migrationFileName = `${timestamp}-create-taggables-table.ts`
  const migrationFilePath = path.userMigrationsPath(migrationFileName)

  Bun.write(migrationFilePath, migrationContent)

  log.success(`Created migration: ${italic(migrationFileName)}`)
}

export async function createPostgresTaggablesTable(): Promise<void> {
  const hasBeenMigrated = await hasMigrationBeenCreated('taggables')

  if (hasBeenMigrated)
    return

  let migrationContent = `import type { Database } from '@stacksjs/database'\n`
  migrationContent += `import { sql } from '@stacksjs/database'\n\n`
  migrationContent += `export async function up(db: Database<any>) {\n`
  migrationContent += `  await db.schema\n`
  migrationContent += `    .createTable('taggables')\n`
  migrationContent += `    .addColumn('id', 'serial', col => col.primaryKey())\n`
  migrationContent += `    .addColumn('tag_id', 'integer', col => col.notNull())\n`
  migrationContent += `    .addColumn('taggable_id', 'integer', col => col.notNull())\n`
  migrationContent += `    .addColumn('taggable_type', 'varchar(255)', col => col.notNull())\n`
  migrationContent += `    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))\n`
  migrationContent += `    .addColumn('updated_at', 'timestamp')\n`
  migrationContent += `    .execute()\n\n`

  // Add foreign key constraint to tags table
  migrationContent += `  await db.schema\n`
  migrationContent += `    .alterTable('taggables')\n`
  migrationContent += `    .addForeignKeyConstraint('taggables_tag_id_foreign', ['tag_id'], 'tags', ['id'], (cb) => cb.onDelete('cascade'))\n`
  migrationContent += `    .execute()\n\n`

  migrationContent += `  await db.schema\n`
  migrationContent += `    .createIndex('idx_taggables_tag')\n`
  migrationContent += `    .on('taggables')\n`
  migrationContent += `    .column('tag_id')\n`
  migrationContent += `    .execute()\n\n`

  migrationContent += `  await db.schema\n`
  migrationContent += `    .createIndex('idx_taggables_polymorphic')\n`
  migrationContent += `    .on('taggables')\n`
  migrationContent += `    .columns(['taggable_id', 'taggable_type'])\n`
  migrationContent += `    .execute()\n\n`

  migrationContent += `  await db.schema\n`
  migrationContent += `    .createIndex('idx_taggables_unique')\n`
  migrationContent += `    .on('taggables')\n`
  migrationContent += `    .columns(['tag_id', 'taggable_id', 'taggable_type'])\n`
  migrationContent += `    .unique()\n`
  migrationContent += `    .execute()\n\n`

  migrationContent += `}\n`

  const timestamp = new Date().getTime().toString()
  const migrationFileName = `${timestamp}-create-taggables-table.ts`
  const migrationFilePath = path.userMigrationsPath(migrationFileName)

  Bun.write(migrationFilePath, migrationContent)

  log.success(`Created migration: ${italic(migrationFileName)}`)
}

export async function createQueryLogsTable(): Promise<void> {
  const hasBeenMigrated = await hasMigrationBeenCreated('query_logs')

  if (hasBeenMigrated)
    return

  let migrationContent = `import type { Database } from '@stacksjs/database'\n`
  migrationContent += `import { sql } from '@stacksjs/database'\n\n`
  migrationContent += `export async function up(db: Database<any>) {\n`
  migrationContent += `  await db.schema\n`
  migrationContent += `    .createTable('query_logs')\n`
  migrationContent += `    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())\n`
  migrationContent += `    .addColumn('query', 'text', col => col.notNull())\n`
  migrationContent += `    .addColumn('normalized_query', 'text')\n`
  migrationContent += `    .addColumn('duration', 'integer')\n`
  migrationContent += `    .addColumn('connection', 'varchar(255)')\n`
  migrationContent += `    .addColumn('status', 'varchar(50)')\n`
  migrationContent += `    .addColumn('executed_at', 'timestamp', col => col.notNull())\n`
  migrationContent += `    .addColumn('model', 'varchar(255)')\n`
  migrationContent += `    .addColumn('method', 'varchar(255)')\n`
  migrationContent += `    .addColumn('rows_affected', 'integer')\n`
  migrationContent += `    .addColumn('optimization_suggestions', 'json')\n`
  migrationContent += `    .addColumn('affected_tables', 'json')\n`
  migrationContent += `    .addColumn('indexes_used', 'json')\n`
  migrationContent += `    .addColumn('missing_indexes', 'json')\n`
  migrationContent += `    .addColumn('tags', 'json')\n`
  migrationContent += `    .addColumn('bindings', 'json')\n`
  migrationContent += `    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))\n`
  migrationContent += `    .addColumn('updated_at', 'timestamp')\n`
  migrationContent += `    .execute()\n\n`

  migrationContent += `  await db.schema\n`
  migrationContent += `    .createIndex('idx_query_logs_executed_at')\n`
  migrationContent += `    .on('query_logs')\n`
  migrationContent += `    .column('executed_at')\n`
  migrationContent += `    .execute()\n\n`

  migrationContent += `  await db.schema\n`
  migrationContent += `    .createIndex('idx_query_logs_status')\n`
  migrationContent += `    .on('query_logs')\n`
  migrationContent += `    .column('status')\n`
  migrationContent += `    .execute()\n\n`

  migrationContent += `  await db.schema\n`
  migrationContent += `    .createIndex('idx_query_logs_duration')\n`
  migrationContent += `    .on('query_logs')\n`
  migrationContent += `    .column('duration')\n`
  migrationContent += `    .execute()\n\n`

  migrationContent += `}\n`

  const timestamp = new Date().getTime().toString()
  const migrationFileName = `${timestamp}-create-query-logs-table.ts`
  const migrationFilePath = path.userMigrationsPath(migrationFileName)

  Bun.write(migrationFilePath, migrationContent)

  log.success(`Created migration: ${italic(migrationFileName)}`)
}

// PostgreSQL version
export async function createPostgresQueryLogsTable(): Promise<void> {
  const hasBeenMigrated = await hasMigrationBeenCreated('query_logs')

  if (hasBeenMigrated)
    return

  let migrationContent = `import type { Database } from '@stacksjs/database'\n`
  migrationContent += `import { sql } from '@stacksjs/database'\n\n`
  migrationContent += `export async function up(db: Database<any>) {\n`
  migrationContent += `  await db.schema\n`
  migrationContent += `    .createTable('query_logs')\n`
  migrationContent += `    .addColumn('id', 'serial', col => col.primaryKey())\n`
  migrationContent += `    .addColumn('query', 'text', col => col.notNull())\n`
  migrationContent += `    .addColumn('normalized_query', 'text')\n`
  migrationContent += `    .addColumn('duration', 'integer')\n`
  migrationContent += `    .addColumn('connection', 'varchar(255)')\n`
  migrationContent += `    .addColumn('status', 'varchar(50)')\n`
  migrationContent += `    .addColumn('executed_at', 'timestamp', col => col.notNull())\n`
  migrationContent += `    .addColumn('model', 'varchar(255)')\n`
  migrationContent += `    .addColumn('method', 'varchar(255)')\n`
  migrationContent += `    .addColumn('rows_affected', 'integer')\n`
  migrationContent += `    .addColumn('optimization_suggestions', 'jsonb')\n`
  migrationContent += `    .addColumn('affected_tables', 'jsonb')\n`
  migrationContent += `    .addColumn('indexes_used', 'jsonb')\n`
  migrationContent += `    .addColumn('missing_indexes', 'jsonb')\n`
  migrationContent += `    .addColumn('tags', 'jsonb')\n`
  migrationContent += `    .addColumn('bindings', 'jsonb')\n`
  migrationContent += `    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))\n`
  migrationContent += `    .addColumn('updated_at', 'timestamp')\n`
  migrationContent += `    .execute()\n\n`

  migrationContent += `  await db.schema\n`
  migrationContent += `    .createIndex('idx_query_logs_executed_at')\n`
  migrationContent += `    .on('query_logs')\n`
  migrationContent += `    .column('executed_at')\n`
  migrationContent += `    .execute()\n\n`

  migrationContent += `  await db.schema\n`
  migrationContent += `    .createIndex('idx_query_logs_status')\n`
  migrationContent += `    .on('query_logs')\n`
  migrationContent += `    .column('status')\n`
  migrationContent += `    .execute()\n\n`

  migrationContent += `  await db.schema\n`
  migrationContent += `    .createIndex('idx_query_logs_duration')\n`
  migrationContent += `    .on('query_logs')\n`
  migrationContent += `    .column('duration')\n`
  migrationContent += `    .execute()\n\n`

  migrationContent += `}\n`

  const timestamp = new Date().getTime().toString()
  const migrationFileName = `${timestamp}-create-query-logs-table.ts`
  const migrationFilePath = path.userMigrationsPath(migrationFileName)

  Bun.write(migrationFilePath, migrationContent)

  log.success(`Created migration: ${italic(migrationFileName)}`)
}
