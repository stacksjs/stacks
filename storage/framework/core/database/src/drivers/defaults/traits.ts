import { italic, log } from '@stacksjs/cli'
import { db } from '@stacksjs/database'
import { path } from '@stacksjs/path'
import { hasMigrationBeenCreated } from '../index'

export function getTraitTables(): string[] {
  return [
    'taggables',
    'categorizables',
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
  migrationContent += `    .addColumn('user_id', 'integer')\n`
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
  migrationContent += `    .addColumn('user_id', 'integer', col => col.references('users.id').onDelete('cascade'))\n`
  migrationContent += `    .addColumn('webauthn_user_id', 'varchar(255)')\n`
  migrationContent += `    .addColumn('counter', 'integer', col => col.defaultTo(0))\n`
  migrationContent += `    .addColumn('device_type', 'varchar(255)')\n`
  migrationContent += `    .addColumn('credential_type', 'varchar(255)')\n`
  migrationContent += `    .addColumn('backup_eligible', 'boolean', col => col.defaultTo(false))\n`
  migrationContent += `    .addColumn('backup_status', 'boolean', col => col.defaultTo(false))\n`
  migrationContent += `    .addColumn('transports', 'varchar(255)')\n`
  migrationContent += `    .addColumn('last_used_at', 'timestamp with time zone')\n`
  migrationContent += `    .addColumn('created_at', 'timestamp with time zone', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))\n`
  migrationContent += `    .execute()\n\n`
  migrationContent += `  await db.schema.createIndex('idx_passkeys_user_id').on('passkeys').column('user_id').execute()\n`
  migrationContent += `}\n`

  const timestamp = new Date().getTime().toString()
  const migrationFileName = `${timestamp}-create-passkeys-table.ts`
  const migrationFilePath = path.userMigrationsPath(migrationFileName)

  Bun.write(migrationFilePath, migrationContent)

  log.success(`Created migration: ${italic(migrationFileName)}`)
}

export async function createTaggableTable(): Promise<void> {
  const hasBeenMigrated = await hasMigrationBeenCreated('taggable')

  if (hasBeenMigrated)
    return

  let migrationContent = `import type { Database } from '@stacksjs/database'\n`
  migrationContent += `import { sql } from '@stacksjs/database'\n\n`
  migrationContent += `export async function up(db: Database<any>) {\n`
  migrationContent += `  await db.schema\n`
  migrationContent += `    .createTable('taggables')\n`
  migrationContent += `    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())\n`
  migrationContent += `    .addColumn('name', 'varchar(255)', col => col.notNull())\n`
  migrationContent += `    .addColumn('slug', 'varchar(255)', col => col.notNull().unique())\n`
  migrationContent += `    .addColumn('description', 'text')\n`
  migrationContent += `    .addColumn('is_active', 'boolean', col => col.defaultTo(true))\n`
  migrationContent += `    .addColumn('taggable_type', 'varchar(255)', col => col.notNull())\n`
  migrationContent += `    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))\n`
  migrationContent += `    .addColumn('updated_at', 'timestamp')\n`
  migrationContent += `    .execute()\n\n`

  migrationContent += `  await db.schema\n`
  migrationContent += `    .createIndex('idx_taggable_slug')\n`
  migrationContent += `    .on('taggables')\n`
  migrationContent += `    .column('slug')\n`
  migrationContent += `    .execute()\n\n`

  migrationContent += `  await db.schema\n`
  migrationContent += `    .createIndex('idx_taggable_polymorphic')\n`
  migrationContent += `    .on('taggables')\n`
  migrationContent += `    .columns(['taggable_type'])\n`
  migrationContent += `    .execute()\n\n`

  migrationContent += `}\n`

  const timestamp = new Date().getTime().toString()
  const migrationFileName = `${timestamp}-create-taggable-table.ts`
  const migrationFilePath = path.userMigrationsPath(migrationFileName)

  Bun.write(migrationFilePath, migrationContent)

  await createTaggableModelsTable()
}

export async function createPostgresTaggableTable(): Promise<void> {
  const hasBeenMigrated = await hasMigrationBeenCreated('taggable')

  if (hasBeenMigrated)
    return

  let migrationContent = `import type { Database } from '@stacksjs/database'\n`
  migrationContent += `import { sql } from '@stacksjs/database'\n\n`
  migrationContent += `export async function up(db: Database<any>) {\n`
  migrationContent += `  await db.schema\n`
  migrationContent += `    .createTable('taggables')\n`
  migrationContent += `    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())\n`
  migrationContent += `    .addColumn('name', 'varchar(255)', col => col.notNull())\n`
  migrationContent += `    .addColumn('slug', 'varchar(255)', col => col.notNull().unique())\n`
  migrationContent += `    .addColumn('description', 'text')\n`
  migrationContent += `    .addColumn('is_active', 'boolean', col => col.defaultTo(true))\n`
  migrationContent += `    .addColumn('taggable_type', 'varchar(255)', col => col.notNull())\n`
  migrationContent += `    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))\n`
  migrationContent += `    .addColumn('updated_at', 'timestamp')\n`
  migrationContent += `    .execute()\n\n`

  migrationContent += `  await db.schema\n`
  migrationContent += `    .createIndex('idx_taggables_slug')\n`
  migrationContent += `    .on('taggables')\n`
  migrationContent += `    .column('slug')\n`
  migrationContent += `    .execute()\n\n`

  migrationContent += `  await db.schema\n`
  migrationContent += `    .createIndex('idx_taggables_polymorphic')\n`
  migrationContent += `    .on('taggables')\n`
  migrationContent += `    .columns(['taggable_type'])\n`
  migrationContent += `    .execute()\n\n`

  migrationContent += `}\n`

  const timestamp = new Date().getTime().toString()
  const migrationFileName = `${timestamp}-create-taggables-table.ts`
  const migrationFilePath = path.userMigrationsPath(migrationFileName)

  Bun.write(migrationFilePath, migrationContent)
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

  await createCategorizableModelsTable()
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
  migrationContent += `    .addColumn('created_at', 'timestamp with time zone', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))\n`
  migrationContent += `    .addColumn('updated_at', 'timestamp with time zone')\n`
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

  await createPostgresCategorizableModelsTable()
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
  migrationContent += `    .createTable('commentables')\n`
  migrationContent += `    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())\n`
  migrationContent += `    .addColumn('title', 'varchar(255)', col => col.notNull())\n`
  migrationContent += `    .addColumn('body', 'text', col => col.notNull())\n`
  migrationContent += `    .addColumn('status', 'varchar(50)', col => col.notNull().defaultTo('${options.requiresApproval ? 'pending' : 'approved'}'))\n`
  migrationContent += `    .addColumn('approved_at', 'integer')\n`
  migrationContent += `    .addColumn('rejected_at', 'integer')\n`
  migrationContent += `    .addColumn('user_id', 'integer', col => col.defaultTo(0).references('users.id').onDelete('cascade'))\n`
  migrationContent += `    .addColumn('commentables_id', 'integer', col => col.notNull())\n`
  migrationContent += `    .addColumn('commentables_type', 'varchar(255)', col => col.notNull())\n`

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
  migrationContent += `  await db.schema.createIndex('idx_commenteable_status').on('commentables').column('status').execute()\n`
  migrationContent += `  await db.schema.createIndex('idx_commenteable_commentables').on('commentables').columns(['commentables_id', 'commentables_type']).execute()\n`
  migrationContent += `  await db.schema.createIndex('idx_commenteable_user').on('commentables').column('user_id').execute()\n`

  migrationContent += `}\n`

  const timestamp = new Date().getTime().toString()
  const migrationFileName = `${timestamp}-create-commentables-table.ts`
  const migrationFilePath = path.userMigrationsPath(migrationFileName)

  Bun.write(migrationFilePath, migrationContent)

  log.success(`Created migration: ${italic(migrationFileName)}`)
}

// PostgreSQL version
export async function createPostgresCommenteableTable(): Promise<void> {
  const hasBeenMigrated = await hasMigrationBeenCreated('commentables')

  if (hasBeenMigrated)
    return

  let migrationContent = `import type { Database } from '@stacksjs/database'\n`
  migrationContent += `import { sql } from '@stacksjs/database'\n\n`
  migrationContent += `export async function up(db: Database<any>) {\n`
  migrationContent += `  await db.schema\n`
  migrationContent += `    .createTable('commentables')\n`
  migrationContent += `    .addColumn('id', 'serial', col => col.primaryKey())\n`
  migrationContent += `    .addColumn('title', 'varchar(255)', col => col.notNull())\n`
  migrationContent += `    .addColumn('body', 'text', col => col.notNull())\n`
  migrationContent += `    .addColumn('status', 'varchar(50)', col => col.notNull().defaultTo('pending'))\n`
  migrationContent += `    .addColumn('approved_at', 'integer')\n`
  migrationContent += `    .addColumn('rejected_at', 'integer')\n`
  migrationContent += `    .addColumn('commentables_id', 'integer', col => col.notNull())\n`
  migrationContent += `    .addColumn('commentables_type', 'varchar(255)', col => col.notNull())\n`
  migrationContent += `    .addColumn('created_at', 'timestamp with time zone', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))\n`
  migrationContent += `    .addColumn('updated_at', 'timestamp with time zone')\n`
  migrationContent += `    .execute()\n\n`
  migrationContent += `  await db.schema.createIndex('idx_commenteable_status').on('commentables').column('status').execute()\n`
  migrationContent += `  await db.schema.createIndex('idx_commenteable_commentables').on('commentables').columns(['commentables_id', 'commentables_type']).execute()\n`
  migrationContent += `}\n`

  const timestamp = new Date().getTime().toString()
  const migrationFileName = `${timestamp}-create-commentables-table.ts`
  const migrationFilePath = path.userMigrationsPath(migrationFileName)

  Bun.write(migrationFilePath, migrationContent)

  log.success(`Created migration: ${italic(migrationFileName)}`)
}

export async function createCategorizableModelTable(): Promise<void> {
  if (await hasMigrationBeenCreated('categories_models'))
    return

  const migrationContent = `import type { Database } from '@stacksjs/database'
  import { sql } from '@stacksjs/database'

  export async function up(db: Database<any>) {
  await db.schema
    .createTable('categorizable_models')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('category_id', 'integer', col => col.notNull())
    .addColumn('categorizable_id', 'integer', col => col.notNull())
    .addColumn('categorizable_type', 'varchar(255)', col => col.notNull())
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql\`CURRENT_TIMESTAMP\`))
    .addColumn('updated_at', 'timestamp')
    .execute()

  // Add indexes for better query performance
  await db.schema
    .createIndex('categories_models_category_id_index')
    .on('categories_models')
    .column('category_id')
    .execute()

  await db.schema
    .createIndex('categories_models_categorizable_index')
    .on('categories_models')
    .columns(['categorizable_type'])
    .execute()
}

export async function down(db: Database<any>) {
  await db.schema.dropTable('categories_models').execute()
}
`

  const timestamp = new Date().getTime().toString()
  const migrationFileName = `${timestamp}-create-categories-models-table.ts`
  const migrationFilePath = path.userMigrationsPath(migrationFileName)

  Bun.write(migrationFilePath, migrationContent)

  log.success(`Created migration: ${italic(migrationFileName)}`)
}

export async function dropCommonTables(): Promise<void> {
  await db.schema.dropTable('migrations').ifExists().execute()
  await db.schema.dropTable('migration_locks').ifExists().execute()
  await db.schema.dropTable('passkeys').ifExists().execute()
  await db.schema.dropTable('password_resets').ifExists().execute()
  await db.schema.dropTable('query_logs').ifExists().execute()
  await db.schema.dropTable('categorizables').ifExists().execute()
  await db.schema.dropTable('commenteable_upvotes').ifExists().execute()
  await db.schema.dropTable('taggables').ifExists().execute()
  await db.schema.dropTable('taggable_models').ifExists().execute()
  await db.schema.dropTable('categorizable_models').ifExists().execute()
  await db.schema.dropTable('commentables').ifExists().execute()
  await db.schema.dropTable('categories_models').ifExists().execute()
  await db.schema.dropTable('activities').ifExists().execute()
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
  migrationContent += `    .addColumn('user_id', 'integer', col => col.notNull())\n`
  migrationContent += `    .addColumn('upvoteable_id', 'integer', col => col.notNull())\n`
  migrationContent += `    .addColumn('upvoteable_type', 'varchar(255)', col => col.notNull())\n`
  migrationContent += `    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))\n`
  migrationContent += `    .execute()\n\n`
  migrationContent += `  await db.schema.createIndex('idx_commenteable_upvotes_user').on('commenteable_upvotes').column('user_id').execute()\n`
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
  migrationContent += `    .addColumn('user_id', 'integer', col => col.notNull())\n`
  migrationContent += `    .addColumn('upvoteable_id', 'integer', col => col.notNull())\n`
  migrationContent += `    .addColumn('upvoteable_type', 'varchar(255)', col => col.notNull())\n`
  migrationContent += `    .addColumn('created_at', 'timestamp with time zone', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))\n`
  migrationContent += `    .execute()\n\n`
  migrationContent += `  await db.schema.createIndex('idx_commenteable_upvotes_user').on('commenteable_upvotes').column('user_id').execute()\n`
  migrationContent += `  await db.schema.createIndex('idx_commenteable_upvotes_upvoteable').on('commenteable_upvotes').columns(['upvoteable_id', 'upvoteable_type']).execute()\n`
  migrationContent += `}\n`

  const timestamp = new Date().getTime().toString()
  const migrationFileName = `${timestamp}-create-commenteable_upvotes-table.ts`
  const migrationFilePath = path.userMigrationsPath(migrationFileName)

  Bun.write(migrationFilePath, migrationContent)

  log.success(`Created migration: ${italic(migrationFileName)}`)
}

export async function createTaggableModelsTable(): Promise<void> {
  const hasBeenMigrated = await hasMigrationBeenCreated('taggable_models')

  if (hasBeenMigrated)
    return

  let migrationContent = `import type { Database } from '@stacksjs/database'\n`
  migrationContent += `import { sql } from '@stacksjs/database'\n\n`
  migrationContent += `export async function up(db: Database<any>) {\n`
  migrationContent += `  await db.schema\n`
  migrationContent += `    .createTable('taggable_models')\n`
  migrationContent += `    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())\n`
  migrationContent += `    .addColumn('tag_id', 'integer', col => col.notNull())\n`
  migrationContent += `    .addColumn('taggable_id', 'integer', col => col.notNull())\n`
  migrationContent += `    .addColumn('taggable_type', 'varchar(255)', col => col.notNull())\n`
  migrationContent += `    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))\n`
  migrationContent += `    .addColumn('updated_at', 'timestamp')\n`
  migrationContent += `    .execute()\n\n`

  migrationContent += `  await db.schema\n`
  migrationContent += `    .createIndex('idx_taggable_models_tag')\n`
  migrationContent += `    .on('taggable_models')\n`
  migrationContent += `    .column('tag_id')\n`
  migrationContent += `    .execute()\n\n`

  migrationContent += `  await db.schema\n`
  migrationContent += `    .createIndex('idx_taggable_models_polymorphic')\n`
  migrationContent += `    .on('taggable_models')\n`
  migrationContent += `    .columns(['taggable_id', 'taggable_type'])\n`
  migrationContent += `    .execute()\n\n`

  migrationContent += `  await db.schema\n`
  migrationContent += `    .createIndex('idx_taggable_models_unique')\n`
  migrationContent += `    .on('taggable_models')\n`
  migrationContent += `    .columns(['tag_id', 'taggable_id', 'taggable_type'])\n`
  migrationContent += `    .unique()\n`
  migrationContent += `    .execute()\n\n`

  migrationContent += `}\n`

  const timestamp = new Date().getTime().toString()
  const migrationFileName = `${timestamp}-create-taggable-models-table.ts`
  const migrationFilePath = path.userMigrationsPath(migrationFileName)

  Bun.write(migrationFilePath, migrationContent)

  log.success(`Created migration: ${italic(migrationFileName)}`)
}

export async function createPostgresTaggableModelsTable(): Promise<void> {
  const hasBeenMigrated = await hasMigrationBeenCreated('taggable_models')

  if (hasBeenMigrated)
    return

  let migrationContent = `import type { Database } from '@stacksjs/database'\n`
  migrationContent += `import { sql } from '@stacksjs/database'\n\n`
  migrationContent += `export async function up(db: Database<any>) {\n`
  migrationContent += `  await db.schema\n`
  migrationContent += `    .createTable('taggable_models')\n`
  migrationContent += `    .addColumn('id', 'serial', col => col.primaryKey())\n`
  migrationContent += `    .addColumn('tag_id', 'integer', col => col.notNull())\n`
  migrationContent += `    .addColumn('taggable_id', 'integer', col => col.notNull())\n`
  migrationContent += `    .addColumn('taggable_type', 'varchar(255)', col => col.notNull())\n`
  migrationContent += `    .addColumn('created_at', 'timestamp with time zone', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))\n`
  migrationContent += `    .addColumn('updated_at', 'timestamp with time zone')\n`
  migrationContent += `    .execute()\n\n`

  migrationContent += `  await db.schema\n`
  migrationContent += `    .createIndex('idx_taggable_models_tag')\n`
  migrationContent += `    .on('taggable_models')\n`
  migrationContent += `    .column('tag_id')\n`
  migrationContent += `    .execute()\n\n`

  migrationContent += `  await db.schema\n`
  migrationContent += `    .createIndex('idx_taggable_models_polymorphic')\n`
  migrationContent += `    .on('taggable_models')\n`
  migrationContent += `    .columns(['taggable_id', 'taggable_type'])\n`
  migrationContent += `    .execute()\n\n`

  migrationContent += `  await db.schema\n`
  migrationContent += `    .createIndex('idx_taggable_models_unique')\n`
  migrationContent += `    .on('taggable_models')\n`
  migrationContent += `    .columns(['tag_id', 'taggable_id', 'taggable_type'])\n`
  migrationContent += `    .unique()\n`
  migrationContent += `    .execute()\n\n`

  migrationContent += `}\n`

  const timestamp = new Date().getTime().toString()
  const migrationFileName = `${timestamp}-create-taggable-models-table.ts`
  const migrationFilePath = path.userMigrationsPath(migrationFileName)

  Bun.write(migrationFilePath, migrationContent)

  log.success(`Created migration: ${italic(migrationFileName)}`)

  await createPostgresTaggableModelsTable()
}

export async function createCategorizableModelsTable(): Promise<void> {
  const hasBeenMigrated = await hasMigrationBeenCreated('categorizable_models')

  if (hasBeenMigrated)
    return

  let migrationContent = `import type { Database } from '@stacksjs/database'\n`
  migrationContent += `import { sql } from '@stacksjs/database'\n\n`
  migrationContent += `export async function up(db: Database<any>) {\n`
  migrationContent += `  await db.schema\n`
  migrationContent += `    .createTable('categorizable_models')\n`
  migrationContent += `    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())\n`
  migrationContent += `    .addColumn('category_id', 'integer', col => col.notNull())\n`
  migrationContent += `    .addColumn('categorizable_id', 'integer', col => col.notNull())\n`
  migrationContent += `    .addColumn('categorizable_type', 'varchar(255)', col => col.notNull())\n`
  migrationContent += `    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))\n`
  migrationContent += `    .addColumn('updated_at', 'timestamp')\n`
  migrationContent += `    .execute()\n\n`

  migrationContent += `  await db.schema\n`
  migrationContent += `    .createIndex('idx_categorizable_models_category')\n`
  migrationContent += `    .on('categorizable_models')\n`
  migrationContent += `    .column('category_id')\n`
  migrationContent += `    .execute()\n\n`

  migrationContent += `  await db.schema\n`
  migrationContent += `    .createIndex('idx_categorizable_models_polymorphic')\n`
  migrationContent += `    .on('categorizable_models')\n`
  migrationContent += `    .columns(['categorizable_id', 'categorizable_type'])\n`
  migrationContent += `    .execute()\n\n`

  migrationContent += `  await db.schema\n`
  migrationContent += `    .createIndex('idx_categorizable_models_unique')\n`
  migrationContent += `    .on('categorizable_models')\n`
  migrationContent += `    .columns(['category_id', 'categorizable_id', 'categorizable_type'])\n`
  migrationContent += `    .unique()\n`
  migrationContent += `    .execute()\n\n`

  migrationContent += `}\n`

  const timestamp = new Date().getTime().toString()
  const migrationFileName = `${timestamp}-create-categorizable-models-table.ts`
  const migrationFilePath = path.userMigrationsPath(migrationFileName)

  Bun.write(migrationFilePath, migrationContent)

  log.success(`Created migration: ${italic(migrationFileName)}`)
}

export async function createPostgresCategorizableModelsTable(): Promise<void> {
  const hasBeenMigrated = await hasMigrationBeenCreated('categorizable_models')

  if (hasBeenMigrated)
    return

  let migrationContent = `import type { Database } from '@stacksjs/database'\n`
  migrationContent += `import { sql } from '@stacksjs/database'\n\n`
  migrationContent += `export async function up(db: Database<any>) {\n`
  migrationContent += `  await db.schema\n`
  migrationContent += `    .createTable('categorizable_models')\n`
  migrationContent += `    .addColumn('id', 'serial', col => col.primaryKey())\n`
  migrationContent += `    .addColumn('category_id', 'integer', col => col.notNull())\n`
  migrationContent += `    .addColumn('categorizable_id', 'integer', col => col.notNull())\n`
  migrationContent += `    .addColumn('categorizable_type', 'varchar(255)', col => col.notNull())\n`
  migrationContent += `    .addColumn('created_at', 'timestamp with time zone', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))\n`
  migrationContent += `    .addColumn('updated_at', 'timestamp with time zone')\n`
  migrationContent += `    .execute()\n\n`

  migrationContent += `  await db.schema\n`
  migrationContent += `    .createIndex('idx_categorizable_models_category')\n`
  migrationContent += `    .on('categorizable_models')\n`
  migrationContent += `    .column('category_id')\n`
  migrationContent += `    .execute()\n\n`

  migrationContent += `  await db.schema\n`
  migrationContent += `    .createIndex('idx_categorizable_models_polymorphic')\n`
  migrationContent += `    .on('categorizable_models')\n`
  migrationContent += `    .columns(['categorizable_id', 'categorizable_type'])\n`
  migrationContent += `    .execute()\n\n`

  migrationContent += `  await db.schema\n`
  migrationContent += `    .createIndex('idx_categorizable_models_unique')\n`
  migrationContent += `    .on('categorizable_models')\n`
  migrationContent += `    .columns(['category_id', 'categorizable_id', 'categorizable_type'])\n`
  migrationContent += `    .unique()\n`
  migrationContent += `    .execute()\n\n`

  migrationContent += `}\n`

  const timestamp = new Date().getTime().toString()
  const migrationFileName = `${timestamp}-create-categorizable-models-table.ts`
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
  migrationContent += `    .addColumn('executed_at', 'timestamp with time zone', col => col.notNull())\n`
  migrationContent += `    .addColumn('model', 'varchar(255)')\n`
  migrationContent += `    .addColumn('method', 'varchar(255)')\n`
  migrationContent += `    .addColumn('rows_affected', 'integer')\n`
  migrationContent += `    .addColumn('optimization_suggestions', 'jsonb')\n`
  migrationContent += `    .addColumn('affected_tables', 'jsonb')\n`
  migrationContent += `    .addColumn('indexes_used', 'jsonb')\n`
  migrationContent += `    .addColumn('missing_indexes', 'jsonb')\n`
  migrationContent += `    .addColumn('tags', 'jsonb')\n`
  migrationContent += `    .addColumn('bindings', 'jsonb')\n`
  migrationContent += `    .addColumn('created_at', 'timestamp with time zone', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))\n`
  migrationContent += `    .addColumn('updated_at', 'timestamp with time zone')\n`
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
