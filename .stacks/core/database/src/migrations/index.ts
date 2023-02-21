import { filesystem } from '@stacksjs/storage'

const fs = filesystem.fs

interface Column {
  name: string
  type: string
  required?: boolean
  unique?: boolean
  default?: string
}

interface Model {
  name: string
  columns: Column[]
}

function generatePrismaSchema(models: Model[], path: string): void {
  let schema = `datasource db {
  provider = "postgresql"
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
  path = '.stacks/database/schema.prisma'
  fs.writeFile(path, schema, (err) => {
    if (err) {
      console.error(`Error writing schema file: ${err.message}`)
      return
    }
    console.log(`Schema file generated successfully at path: ${path}`)
  })
}

export { generatePrismaSchema }
