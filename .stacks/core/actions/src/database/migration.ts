// import { generateMigrationFile } from '@stacksjs/database'
import User from '../../../../../app/models/User'
import { modelEntity, fieldAssociation, fieldEntity } from './fields'

const file = Bun.file('user-migration.ts')
const writer = file.writer()

writer.write('import { Kysely, sql } from \'kysely\'\n')
writer.write('import { db } from \'@stacksjs/database\'\n')
writer.write(' \n')
writer.write('export async function up(db: Kysely<any>): Promise<void> { \n')

writer.write('  await db.schema \n')
writer.write(`  .createTable('${User.table}') \n`)

for (let modelIndex = 0; modelIndex < modelEntity.length; modelIndex++) {
  const modelElement: any = modelEntity[modelIndex];

  let entity = '';

  for (let fieldIndex = 0; fieldIndex < modelElement.fieldArray.length; fieldIndex++) {
    const fieldArrayElement = modelElement.fieldArray[fieldIndex];

    console.log(fieldArrayElement)

    if (fieldAssociation[fieldArrayElement.entity]) {
      entity += `${fieldAssociation[fieldArrayElement.entity]}`;
    }

    if (fieldArrayElement.charValue) 
      entity += `(${fieldArrayElement.charValue})`;

    fieldEntity.forEach((entity) => {
      if (fieldArrayElement.entity === entity) {
        console.log(fieldArrayElement.charValue)
        entity += `(${fieldArrayElement.charValue})`;
      }
    })
  }

  writer.write(` .addColumn('${modelElement.field}', '${entity}', (col) => col.notNull()) \n`);
}

writer.write(' .addColumn(\'created_at\', \'timestamp\', (col) => col.defaultTo(sql`now()`).notNull()) \n')
writer.write(' .execute() \n')
writer.write('} \n\n')

writer.write('process.exit(0) \n')

writer.end()
