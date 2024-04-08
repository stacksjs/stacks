import { Attributes } from "@stacksjs/types"

export async function createTableMigration(modelPath: string) {
  
  log.debug('createTableMigration modelPath:', modelPath)

  const model = await import(modelPath)
  const tableName = model.default.table

  const fields = model.default.attributes
  const useTimestamps = model.default?.traits?.useTimestamps ?? model.default?.traits?.timestampable
  const useSoftDeletes = model.default?.traits?.useSoftDeletes ?? model.default?.traits?.softDeletable

  let migrationContent = `import type { Database } from '@stacksjs/database'\n`
  migrationContent += `import { sql } from '@stacksjs/database'\n\n`
  migrationContent += `export async function up(db: Database<any>) {\n`
  migrationContent += `  await db.schema\n`
  migrationContent += `    .createTable('${tableName}')\n`

  for (const [fieldName, options] of Object.entries(fields)) {
    const fieldOptions = options as Attributes
    const columnType = mapFieldTypeToColumnType(fieldOptions.validator?.rule)
    migrationContent += `    .addColumn('${fieldName}', '${columnType}'`

    // Check if there are configurations that require the lambda function
    if (fieldOptions.unique || (fieldOptions.validator?.rule?.required)) {
      migrationContent += `, col => col`
      if (fieldOptions.unique)
        migrationContent += `.unique()`
      if (fieldOptions.validator?.rule?.required)
        migrationContent += `.notNull()`
      migrationContent += ``
    }

    migrationContent += `)\n`
  }

  // Append created_at and updated_at columns if useTimestamps is true
  if (useTimestamps) {
    migrationContent += `    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))\n`
    migrationContent += `    .addColumn('updated_at', 'timestamp')\n`
  }

  // Append deleted_at column if useSoftDeletes is true
  if (useSoftDeletes)
    migrationContent += `    .addColumn('deleted_at', 'timestamp')\n`

  migrationContent += `    .execute()\n`
  migrationContent += `}\n`

  const timestamp = new Date().getTime().toString()
  const migrationFileName = `${timestamp}-create-${tableName}-table.ts`
  const migrationFilePath = path.userMigrationsPath(migrationFileName)

  // Assuming fs.writeFileSync is available or use an equivalent method
  Bun.write(migrationFilePath, migrationContent)

  log.success(`Created migration: ${migrationFileName}`)
}