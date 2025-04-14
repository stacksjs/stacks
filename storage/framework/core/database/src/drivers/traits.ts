import type { Model } from '@stacksjs/types'
import { italic, log } from '@stacksjs/cli'
import { db } from '@stacksjs/database'
import { path } from '@stacksjs/path'
import { fs } from '@stacksjs/storage'
import { snakeCase } from '@stacksjs/strings'
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
  const hasBeenMigrated = await hasMigrationBeenCreated('categorizable')

  if (hasBeenMigrated)
    return

  let migrationContent = `import type { Database } from '@stacksjs/database'\n`
  migrationContent += `import { sql } from '@stacksjs/database'\n\n`
  migrationContent += `export async function up(db: Database<any>) {\n`
  migrationContent += `  await db.schema\n`
  migrationContent += `    .createTable('categorizable')\n`
  migrationContent += `    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())\n`
  migrationContent += `    .addColumn('name', 'varchar(255)', col => col.notNull())\n`
  migrationContent += `    .addColumn('slug', 'varchar(255)', col => col.notNull().unique())\n`
  migrationContent += `    .addColumn('description', 'text')\n`
  migrationContent += `    .addColumn('parent_id', 'integer')\n`
  migrationContent += `    .addColumn('order', 'integer', col => col.defaultTo(0))\n`
  migrationContent += `    .addColumn('is_active', 'boolean', col => col.defaultTo(true))\n`
  migrationContent += `    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))\n`
  migrationContent += `    .addColumn('updated_at', 'timestamp')\n`
  migrationContent += `    .execute()\n\n`

  // Add indexes with more descriptive names
  migrationContent += `  await db.schema\n`
  migrationContent += `    .createIndex('categorizable_id_index')\n`
  migrationContent += `    .on('categorizable')\n`
  migrationContent += `    .column('id')\n`
  migrationContent += `    .execute()\n\n`

  migrationContent += `  await db.schema\n`
  migrationContent += `    .createIndex('categorizable_slug_index')\n`
  migrationContent += `    .on('categorizable')\n`
  migrationContent += `    .column('slug')\n`
  migrationContent += `    .execute()\n\n`

  migrationContent += `  await db.schema\n`
  migrationContent += `    .createIndex('categorizable_parent_id_index')\n`
  migrationContent += `    .on('categorizable')\n`
  migrationContent += `    .column('parent_id')\n`
  migrationContent += `    .execute()\n\n`

  migrationContent += `  await db.schema\n`
  migrationContent += `    .createIndex('categorizable_order_index')\n`
  migrationContent += `    .on('categorizable')\n`
  migrationContent += `    .column('order')\n`
  migrationContent += `    .execute()\n\n`

  migrationContent += `  await db.schema\n`
  migrationContent += `    .createIndex('categorizable_is_active_index')\n`
  migrationContent += `    .on('categorizable')\n`
  migrationContent += `    .column('is_active')\n`
  migrationContent += `    .execute()\n`

  migrationContent += `}\n`

  const timestamp = new Date().getTime().toString()
  const migrationFileName = `${timestamp}-create-categorizable-table.ts`
  const migrationFilePath = path.userMigrationsPath(migrationFileName)

  Bun.write(migrationFilePath, migrationContent)

  log.success(`Created migration: ${italic(migrationFileName)}`)
}

// PostgreSQL version
export async function createPostgresCategoriesTable(): Promise<void> {
  const hasBeenMigrated = await hasMigrationBeenCreated('categorizable')

  if (hasBeenMigrated)
    return

  let migrationContent = `import type { Database } from '@stacksjs/database'\n`
  migrationContent += `import { sql } from '@stacksjs/database'\n\n`
  migrationContent += `export async function up(db: Database<any>) {\n`
  migrationContent += `  await db.schema\n`
  migrationContent += `    .createTable('categorizable')\n`
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
export async function createCommenteableTable(options: {
  requiresApproval?: boolean
  reportable?: boolean
  votable?: boolean
  requiresAuth?: boolean
} = {}): Promise<void> {
  const hasBeenMigrated = await hasMigrationBeenCreated('commenteable')

  if (hasBeenMigrated)
    return

  let migrationContent = `import type { Database } from '@stacksjs/database'\n`
  migrationContent += `import { sql } from '@stacksjs/database'\n\n`
  migrationContent += `export async function up(db: Database<any>) {\n`
  migrationContent += `  await db.schema\n`
  migrationContent += `    .createTable('commenteable')\n`
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

  if (options.requiresAuth) {
    migrationContent += `    .addColumn('user_id', 'integer', col => col.notNull())\n`
  }

  migrationContent += `    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))\n`
  migrationContent += `    .addColumn('updated_at', 'timestamp')\n`
  migrationContent += `    .execute()\n\n`

  // Add indexes
  migrationContent += `  await db.schema.createIndex('idx_commenteable_status').on('commenteable').column('status').execute()\n`
  migrationContent += `  await db.schema.createIndex('idx_commenteable_commentable').on('commenteable').columns(['commentable_id', 'commentable_type']).execute()\n`

  if (options.reportable) {
    migrationContent += `  await db.schema.createIndex('idx_commenteable_reports').on('commenteable').column('reports_count').execute()\n`
  }

  if (options.votable) {
    migrationContent += `  await db.schema.createIndex('idx_commenteable_votes').on('commenteable').columns(['downvotes_count']).execute()\n`
  }

  if (options.requiresAuth) {
    migrationContent += `  await db.schema.createIndex('idx_commenteable_user').on('commenteable').column('user_id').execute()\n`
  }

  migrationContent += `}\n`

  const timestamp = new Date().getTime().toString()
  const migrationFileName = `${timestamp}-create-commenteable-table.ts`
  const migrationFilePath = path.userMigrationsPath(migrationFileName)

  Bun.write(migrationFilePath, migrationContent)

  log.success(`Created migration: ${italic(migrationFileName)}`)
}

// PostgreSQL version
export async function createPostgresCommenteableTable(): Promise<void> {
  const hasBeenMigrated = await hasMigrationBeenCreated('commenteable')

  if (hasBeenMigrated)
    return

  let migrationContent = `import type { Database } from '@stacksjs/database'\n`
  migrationContent += `import { sql } from '@stacksjs/database'\n\n`
  migrationContent += `export async function up(db: Database<any>) {\n`
  migrationContent += `  await db.schema\n`
  migrationContent += `    .createTable('commenteable')\n`
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
  migrationContent += `  await db.schema.createIndex('idx_commenteable_status').on('commenteable').column('status').execute()\n`
  migrationContent += `  await db.schema.createIndex('idx_commenteable_commentable').on('commenteable').columns(['commentable_id', 'commentable_type']).execute()\n`
  migrationContent += `}\n`

  const timestamp = new Date().getTime().toString()
  const migrationFileName = `${timestamp}-create-commenteable-table.ts`
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
  await db.schema.dropTable('categorizable_table').ifExists().execute()
  await db.schema.dropTable('commenteable').ifExists().execute()
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

export async function createUpvoteMigration(model: Model, modelName: string, tableName: string): Promise<void> {
  const migrationTable = getUpvoteTableName(model, tableName)

  const hasBeenMigrated = await hasMigrationBeenCreated(migrationTable)

  const foreignKey = getUpvoteForeignKey(model, modelName)

  if (hasBeenMigrated)
    return

  let migrationContent = `import type { Database } from '@stacksjs/database'\n import { sql } from '@stacksjs/database'\n\n`
  migrationContent += `export async function up(db: Database<any>) {\n`
  migrationContent += `  await db.schema\n`
  migrationContent += `    .createTable('${migrationTable}')\n`
  migrationContent += `    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())\n`
  migrationContent += `    .addColumn('user_id', 'integer', col => col.notNull())\n`
  migrationContent += `    .addColumn('${foreignKey}', 'integer', col => col.notNull())\n`
  migrationContent += `    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))\n`
  migrationContent += `    .execute()\n`
  migrationContent += `    }\n`

  const timestamp = new Date().getTime().toString()
  const migrationFileName = `${timestamp}-create-${migrationTable}-table.ts`

  const migrationFilePath = path.userMigrationsPath(migrationFileName)

  Bun.write(migrationFilePath, migrationContent)

  log.success(`Created migration: ${italic(migrationFileName)}`)
}

function getUpvoteTableName(model: Model, tableName: string): string {
  const defaultTable = `${tableName}_likes`
  const traits = model.traits

  return typeof traits?.likeable === 'object'
    ? traits.likeable.table || defaultTable
    : defaultTable
}

function getUpvoteForeignKey(model: Model, modelName: string): string {
  const defaultForeignKey = `${snakeCase(modelName)}_id`
  const traits = model.traits

  return typeof traits?.likeable === 'object'
    ? traits.likeable.foreignKey || defaultForeignKey
    : defaultForeignKey
}
