import { filesystem } from '@stacksjs/storage'
import { projectPath } from '@stacksjs/path'
import type { ModelOptions, SchemaOptions } from '@stacksjs/types'

const { fs } = filesystem

interface ModelData {
  [key: string]: any
}

/**
 * Generates the Prisma schema file based on the given models and options.
 */
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

  if (!fs?.mkdirSync(`${projectPath()}/.stacks/database`, { recursive: true })) {
    console.error(`Error creating directory: ${projectPath()}/.stacks/database`)
    return
  }

  fs.writeFile(path, schema, (err) => {
    if (err)
      console.error(`Error writing schema file: ${err.message}`)
    else
      console.log(`Schema file generated successfully at path: ${path}`)
  })
}

/**
 * Reads the model data from the given folder path.
 */
async function readModelsFromFolder(folderPath: string): Promise<ModelData[]> {
  const models: ModelData[] = []

  try {
    const files = await fs.promises.readdir(folderPath)
    const promises = files
      .filter(file => file.endsWith('.ts'))
      .map(async (file) => {
        const filePath = `${folderPath}/${file}`
        const data = await import(filePath)
        models.push({
          name: data.default.name,
          columns: data.default.fields,
        })
      })

    await Promise.all(promises)
  }
  catch (err) {
    console.error(`Error reading models from folder: ${folderPath}`, err)
  }

  return models
}

export {
  generatePrismaSchema,
  readModelsFromFolder,
}
