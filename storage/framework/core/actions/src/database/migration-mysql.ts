import User from '../../../../../../app/Models/User'
import { fieldAssociation, fieldEntity, modelEntity } from './fields'

const file = Bun.file('user-migration.ts')

const driver = 'mysql'

const writer = file.writer()

writer.write('import { db, sql, Database } from \'@stacksjs/database\'\n')
writer.write('\n')
writer.write('export async function up(db: Database<any>) {\n')

writer.write('  await db.schema\n')
writer.write(`    .createTable('${User.table}')\n`)

writer.write('    .addColumn(\'id\', \'integer\', (col) => col.primaryKey())\n')

for (let modelIndex = 0; modelIndex < modelEntity.length; modelIndex++) {
  const modelElement = modelEntity[modelIndex]

  if (!modelElement)
    continue

  let entity = ''
  let characteristic = ''

  const isNullablePresent = modelElement.fieldArray.some(item => item.entity === 'nullable')

  if (modelElement.default)
    characteristic += `.defaultTo('${modelElement.default.toString()}')`

  if (modelElement.unique)
    characteristic += '.unique()'

  if (!isNullablePresent)
    characteristic += '.notNull()'

  for (let fieldIndex = 0; fieldIndex < modelElement.fieldArray.length; fieldIndex++) {
    const fieldArrayElement = modelElement.fieldArray[fieldIndex]

    if (!fieldArrayElement)
      continue

    if (!fieldAssociation[driver])
      continue

    if (fieldAssociation[driver][fieldArrayElement.entity])
      entity += `${fieldAssociation[driver][fieldArrayElement.entity]}`

    fieldEntity.forEach((entityField) => {
      if (fieldArrayElement.entity === entityField)
        entity += `(${fieldArrayElement.charValue})`
    })

    const isMaxLengthPresent = modelElement.fieldArray.some(item => item.entity === 'maxLength')

    if (fieldAssociation[driver][fieldArrayElement.entity] === 'varchar' && !isMaxLengthPresent)
      entity += '(255)'
  }

  writer.write(`    .addColumn('${modelElement.field}', '${entity}', (col) => col${characteristic})\n`)
}

writer.write('    .addColumn(\'created_at\', \'timestamp\', (col) => col.defaultTo(sql`now()`).notNull())\n')
writer.write('    .execute()\n')
writer.write('}\n\n')

writer.write('process.exit(0)\n')

await writer.end()
