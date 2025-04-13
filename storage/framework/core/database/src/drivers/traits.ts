import { italic, log } from '@stacksjs/cli'
import { db } from '@stacksjs/database'
import { path } from '@stacksjs/path'
import { fs } from '@stacksjs/storage'
import { hasMigrationBeenCreated } from './index'

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

// SQLite/MySQL version
export async function createCategoriesTable(): Promise<void> {
  const hasBeenMigrated = await hasMigrationBeenCreated('categories')

  if (hasBeenMigrated)
    return

  let migrationContent = `import type { Database } from '@stacksjs/database'\n`
  migrationContent += `import { sql } from '@stacksjs/database'\n\n`
  migrationContent += `export async function up(db: Database<any>) {\n`
  migrationContent += `  await db.schema\n`
  migrationContent += `    .createTable('categories')\n`
  migrationContent += `    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())\n`
  migrationContent += `    .addColumn('name', 'varchar(255)', col => col.notNull())\n`
  migrationContent += `    .addColumn('description', 'text')\n`
  migrationContent += `    .addColumn('slug', 'varchar(255)', col => col.notNull().unique())\n`
  migrationContent += `    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))\n`
  migrationContent += `    .addColumn('updated_at', 'timestamp')\n`
  migrationContent += `    .execute()\n\n`
  migrationContent += `  await db.schema.createIndex('idx_categories_slug').on('categories').column('slug').execute()\n`
  migrationContent += `}\n`

  const timestamp = new Date().getTime().toString()
  const migrationFileName = `${timestamp}-create-categories-table.ts`
  const migrationFilePath = path.userMigrationsPath(migrationFileName)

  Bun.write(migrationFilePath, migrationContent)

  log.success(`Created migration: ${italic(migrationFileName)}`)
}

// PostgreSQL version
export async function createPostgresCategoriesTable(): Promise<void> {
  const hasBeenMigrated = await hasMigrationBeenCreated('categories')

  if (hasBeenMigrated)
    return

  let migrationContent = `import type { Database } from '@stacksjs/database'\n`
  migrationContent += `import { sql } from '@stacksjs/database'\n\n`
  migrationContent += `export async function up(db: Database<any>) {\n`
  migrationContent += `  await db.schema\n`
  migrationContent += `    .createTable('categories')\n`
  migrationContent += `    .addColumn('id', 'serial', col => col.primaryKey())\n`
  migrationContent += `    .addColumn('name', 'varchar(255)', col => col.notNull())\n`
  migrationContent += `    .addColumn('description', 'text')\n`
  migrationContent += `    .addColumn('slug', 'varchar(255)', col => col.notNull().unique())\n`
  migrationContent += `    .addColumn('created_at', 'timestamp with time zone', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))\n`
  migrationContent += `    .addColumn('updated_at', 'timestamp with time zone')\n`
  migrationContent += `    .execute()\n\n`
  migrationContent += `  await db.schema.createIndex('idx_categories_slug').on('categories').column('slug').execute()\n`
  migrationContent += `}\n`

  const timestamp = new Date().getTime().toString()
  const migrationFileName = `${timestamp}-create-categories-table.ts`
  const migrationFilePath = path.userMigrationsPath(migrationFileName)

  Bun.write(migrationFilePath, migrationContent)

  log.success(`Created migration: ${italic(migrationFileName)}`)
}

// SQLite/MySQL version
export async function createCommentsTable(options: {
  requiresApproval?: boolean
  reportable?: boolean
  votable?: boolean
  requiresAuth?: boolean
} = {}): Promise<void> {
  const hasBeenMigrated = await hasMigrationBeenCreated('comments')

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
  migrationContent += `    .addColumn('commentable_id', 'integer', col => col.notNull())\n`
  migrationContent += `    .addColumn('commentable_type', 'varchar(255)', col => col.notNull())\n`

  if (options.reportable) {
    migrationContent += `    .addColumn('reports_count', 'integer', col => col.defaultTo(0))\n`
    migrationContent += `    .addColumn('reported_at', 'integer')\n`
  }

  if (options.votable) {
    migrationContent += `    .addColumn('upvotes_count', 'integer', col => col.defaultTo(0))\n`
    migrationContent += `    .addColumn('downvotes_count', 'integer', col => col.defaultTo(0))\n`
  }

  if (options.requiresAuth) {
    migrationContent += `    .addColumn('user_id', 'integer', col => col.notNull())\n`
  }

  migrationContent += `    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))\n`
  migrationContent += `    .addColumn('updated_at', 'timestamp')\n`
  migrationContent += `    .execute()\n\n`

  // Add indexes
  migrationContent += `  await db.schema.createIndex('idx_comments_status').on('comments').column('status').execute()\n`
  migrationContent += `  await db.schema.createIndex('idx_comments_commentable').on('comments').columns(['commentable_id', 'commentable_type']).execute()\n`

  if (options.reportable) {
    migrationContent += `  await db.schema.createIndex('idx_comments_reports').on('comments').column('reports_count').execute()\n`
  }

  if (options.votable) {
    migrationContent += `  await db.schema.createIndex('idx_comments_votes').on('comments').columns(['upvotes_count', 'downvotes_count']).execute()\n`
  }

  if (options.requiresAuth) {
    migrationContent += `  await db.schema.createIndex('idx_comments_user').on('comments').column('user_id').execute()\n`
  }

  migrationContent += `}\n`

  const timestamp = new Date().getTime().toString()
  const migrationFileName = `${timestamp}-create-comments-table.ts`
  const migrationFilePath = path.userMigrationsPath(migrationFileName)

  Bun.write(migrationFilePath, migrationContent)

  log.success(`Created migration: ${italic(migrationFileName)}`)
}

// PostgreSQL version
export async function createPostgresCommentsTable(): Promise<void> {
  const hasBeenMigrated = await hasMigrationBeenCreated('comments')

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
  migrationContent += `    .addColumn('commentable_id', 'integer', col => col.notNull())\n`
  migrationContent += `    .addColumn('commentable_type', 'varchar(255)', col => col.notNull())\n`
  migrationContent += `    .addColumn('created_at', 'timestamp with time zone', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))\n`
  migrationContent += `    .addColumn('updated_at', 'timestamp with time zone')\n`
  migrationContent += `    .execute()\n\n`
  migrationContent += `  await db.schema.createIndex('idx_comments_status').on('comments').column('status').execute()\n`
  migrationContent += `  await db.schema.createIndex('idx_comments_commentable').on('comments').columns(['commentable_id', 'commentable_type']).execute()\n`
  migrationContent += `}\n`

  const timestamp = new Date().getTime().toString()
  const migrationFileName = `${timestamp}-create-comments-table.ts`
  const migrationFilePath = path.userMigrationsPath(migrationFileName)

  Bun.write(migrationFilePath, migrationContent)

  log.success(`Created migration: ${italic(migrationFileName)}`)
}

export async function createCategoriesModelsTable(): Promise<void> {
  if (await hasMigrationBeenCreated('categories_models'))
    return

  const migrationContent = `import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('categories_models')
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
    .columns(['categorizable_id', 'categorizable_type'])
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
  await db.schema.dropTable('categories').ifExists().execute()
  await db.schema.dropTable('comments').ifExists().execute()
  await db.schema.dropTable('categories_models').ifExists().execute()
  await db.schema.dropTable('activities').ifExists().execute()
}

export async function deleteFrameworkModels(): Promise<void> {
  const modelFiles = await fs.readdir(path.frameworkPath('models'))

  if (modelFiles.length) {
    for (const file of modelFiles) {
      if (file.endsWith('.ts')) {
        const modelPath = path.frameworkPath(`models/${file}`)
        if (fs.existsSync(modelPath))
          await Bun.$`rm ${modelPath}`
      }
    }
  }
}

export async function deleteMigrationFiles(): Promise<void> {
  const files = await fs.readdir(path.userMigrationsPath())

  if (files.length) {
    for (const file of files) {
      if (file.endsWith('.ts')) {
        const migrationPath = path.userMigrationsPath(`${file}`)
        if (fs.existsSync(migrationPath))
          await Bun.$`rm ${migrationPath}`
      }
    }
  }
}
