import { path } from '@stacksjs/path'
import { fs } from '@stacksjs/storage'
import { plural, snakeCase } from '@stacksjs/strings'
import type { Model } from '@stacksjs/types'
import { globSync } from 'tinyglobby'

export function getModelName(model: Model, modelPath: string): string {
  if (model.name)
    return model.name

  const baseName = path.basename(modelPath)

  return baseName.replace(/\.ts$/, '')
}

export function getTableName(model: Model, modelPath: string): string {
  if (model.table)
    return model.table

  return snakeCase(plural(getModelName(model, modelPath)))
}

export function generateOrmModelString(modelName: string, tableName: string): string {
  return `import { db2 } from '../../db'

class ${modelName}Model {
  private query: any

  constructor() {
    this.query = db2.selectFrom('${tableName}')
  }

  // Static method to create a new query instance
  static query() {
    return new ${modelName}Model()
  }

  // Find by ID
  static async find(id: number) {
    return await db2.selectFrom('${tableName}').where('id', '=', id).executeTakeFirst()
  }

  // Get all records
  static async all() {
    return await db2.selectFrom('${tableName}').execute()
  }

  // Get the first record
  async first() {
    return await this.query.executeTakeFirst()
  }

  // Get all records from the query
  async get() {
    return await this.query.execute()
  }

  // Chainable where clause
  where(column: string, operator: any, value?: any) {
    if (value === undefined) {
      this.query = this.query.where(column, '=', operator)
    } else {
      this.query = this.query.where(column, operator, value)
    }
    return this
  }

  // Chainable select clause
  select(...columns: string[]) {
    this.query = this.query.select(columns as any)
    return this
  }

  // Chainable orderBy clause
  orderBy(column: string, direction: 'asc' | 'desc' = 'asc') {
    this.query = this.query.orderBy(column, direction)
    return this
  }

  // Chainable limit clause
  limit(count: number) {
    this.query = this.query.limit(count)
    return this
  }
}

export default ${modelName}Model
`
}

export async function generateOrmModels(): Promise<void> {
  const userModelFiles = globSync([
    path.userModelsPath('*.ts'),
    path.storagePath('framework/defaults/models/**/*.ts'),
  ], { absolute: true })

  for (const userModelFile of userModelFiles) {
    const model = (await import(userModelFile)).default as Model
    const modelName = getModelName(model, userModelFile)
    const tableName = getTableName(model, userModelFile)

    const modelString = generateOrmModelString(modelName, tableName)
    
    // Ensure the directory exists
    const ormModelsDir = path.storagePath('framework/core/db/src/orm/Models')
    await fs.promises.mkdir(ormModelsDir, { recursive: true })

    // Write the generated model file
    const outputPath = path.join(ormModelsDir, `${modelName}.ts`)
    await fs.promises.writeFile(outputPath, modelString, 'utf8')
    
    console.log(`Generated ORM model: ${modelName} -> ${outputPath}`)
  }
}

export async function generateOrmModel(modelPath: string): Promise<void> {
  const model = (await import(modelPath)).default as Model
  const modelName = getModelName(model, modelPath)
  const tableName = getTableName(model, modelPath)

  const modelString = generateOrmModelString(modelName, tableName)
  
  // Ensure the directory exists
  const ormModelsDir = path.storagePath('framework/core/db/src/orm/Models')
  await fs.promises.mkdir(ormModelsDir, { recursive: true })

  // Write the generated model file
  const outputPath = path.join(ormModelsDir, `${modelName}.ts`)
  await fs.promises.writeFile(outputPath, modelString, 'utf8')
  
  console.log(`Generated ORM model: ${modelName} -> ${outputPath}`)
}

