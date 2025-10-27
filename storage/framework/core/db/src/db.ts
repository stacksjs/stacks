import { buildDatabaseSchema, buildSchemaMeta, createQueryBuilder } from 'bun-query-builder'
import { path } from '@stacksjs/path'
import { globSync } from '@stacksjs/storage'


// Load or define your model files (see docs for model shape)
const userModelFiles = globSync([path.userModelsPath('*.ts'), path.storagePath('framework/defaults/models/**/*.ts')], { absolute: true })

const models = []

for (const userModelFile of userModelFiles) {
  const model = (await import(userModelFile)).default
  models.push(model)
}

const schema = buildDatabaseSchema(models)
const meta = buildSchemaMeta(models)
const db = createQueryBuilder<typeof schema>({ schema, meta })

export {
  db
}