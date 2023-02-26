import { filesystem } from '@stacksjs/storage'
import { projectPath } from '@stacksjs/path'
import type { ModelOptions, SchemaOptions } from '@stacksjs/types'

const { fs } = filesystem

function generatePrismaSchema(models: ModelOptions[], path: string, options: SchemaOptions): void {
  let schema = `datasource db {
  provider = "${options.database}"
  url = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

`

  for (const model of models) {
    schema += `model ${model.name} {
  id       Int      @id @default(autoincrement())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt()
`

    for (const column of model.columns) {
      let columnSchema = `  ${column.name} ${column.type}`

      if (column.required)
        columnSchema += ' @required'

      if (column.unique)
        columnSchema += ' @unique'

      if (column.default)
        columnSchema += ` @default(${column.default})`

      columnSchema += '\n'
      schema += columnSchema
    }

    schema += '}\n\n'
  }

  if (!fs.existsSync(`${projectPath()}/.stacks/database`))
    fs.mkdirSync(`${projectPath()}/.stacks/database`)

  fs.writeFile(path, schema, (err) => {
    if (err)
      console.error(`Error writing schema file: ${err.message}`)

    // console.log(`Schema file generated successfully at path: ${path}`)
  })
}

function readModelsFromFolder(folderPath: string): Promise<ModelOptions[]> {
  return new Promise((resolve, reject) => {
    const models: ModelOptions[] = []

    fs.readdir(folderPath, (err, files) => {
      if (err)
        reject(err)

      const promises = files
        .filter(file => file.endsWith('.ts'))
        .map((file) => {
          const filePath = `${folderPath}/${file}`

          return import(filePath).then((data) => {
            models.push({
              name: data.default.name,
              columns: data.default.fields,
            })
          })
        })

      Promise.all(promises)
        .then(() => resolve(models))
        .catch(err => reject(err))
    })
  })
}

async function migrate(path: string, options: SchemaOptions): Promise<void> {
  const models = await readModelsFromFolder(`${projectPath()}/.stacks/database/models`)

  generatePrismaSchema(models, path, options)
}

export {
  migrate,
}
