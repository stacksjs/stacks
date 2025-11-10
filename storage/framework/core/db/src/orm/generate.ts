import { path } from '@stacksjs/path'
import { fs } from '@stacksjs/storage'
import { plural, snakeCase } from '@stacksjs/strings'
import type { Model } from '@stacksjs/types'

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

function extractHiddenFields(model: Model): string[] {
  if (!model.attributes) return []

  return Object.keys(model.attributes).filter(key =>
    model.attributes?.[key]?.hidden === true
  ).map(field => snakeCase(field))
}

function extractFillableFields(model: Model): string[] {
  if (!model.attributes) return []

  const fillable = Object.keys(model.attributes).filter(key =>
    model.attributes?.[key]?.fillable === true
  ).map(field => snakeCase(field))

  // Add trait-specific fillable fields
  const additionalFields: string[] = []

  if (model.traits?.useUuid) {
    additionalFields.push('uuid')
  }

  if (model.traits?.useAuth) {
    const useAuth = model.traits.useAuth
    if (typeof useAuth === 'object' && useAuth.usePasskey) {
      additionalFields.push('two_factor_secret', 'public_key')
    }
  }

  return [...fillable, ...additionalFields]
}

function extractGuardedFields(model: Model): string[] {
  if (!model.attributes) return []

  return Object.keys(model.attributes).filter(key =>
    model.attributes?.[key]?.guarded === true
  ).map(field => snakeCase(field))
}

export function generateOrmModelString(modelName: string, tableName: string, model: Model): string {
  const hidden = extractHiddenFields(model)
  const fillable = extractFillableFields(model)
  const guarded = extractGuardedFields(model)

  const hiddenArray = hidden.length > 0 ? `['${hidden.join("', '")}']` : '[]'
  const fillableArray = fillable.length > 0 ? `['${fillable.join("', '")}']` : '[]'
  const guardedArray = guarded.length > 0 ? `['${guarded.join("', '")}']` : '[]'

  return `import { db2 } from '../../db'

class ${modelName}Model {
  private readonly hidden: string[] = ${hiddenArray}
  private readonly fillable: string[] = ${fillableArray}
  private readonly guarded: string[] = ${guardedArray}
  protected attributes: Record<string, any> = {}
  private query: any

  constructor(data?: Record<string, any>) {
    if (data) {
      this.attributes = { ...data }
    }
    this.query = db2.selectFrom('${tableName}')
  }

  // Static method to create a new query instance
  static query() {
    return new ${modelName}Model()
  }

  // Find by ID
  static async find(id: number) {
    const result = await db2.selectFrom('${tableName}').where('id', '=', id).executeTakeFirst()
    return result ? new ${modelName}Model(result) : undefined
  }

  // Get all records
  static async all() {
    const results = await db2.selectFrom('${tableName}').execute()
    return results.map((result: any) => new ${modelName}Model(result))
  }

  // Get the first record
  async first() {
    const result = await this.query.executeTakeFirst()
    return result ? new ${modelName}Model(result) : undefined
  }

  // Get all records from the query
  async get() {
    const results = await this.query.execute()
    return results.map((result: any) => new ${modelName}Model(result))
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

  // Create a new record
  static async create(data: Record<string, any>) {
    const instance = new ${modelName}Model()

    // Filter based on fillable and guarded
    const filteredData = Object.fromEntries(
      Object.entries(data).filter(([key]) =>
        !instance.guarded.includes(key) && instance.fillable.includes(key)
      )
    )

    const result = await db2.insertInto('${tableName}')
      .values(filteredData)
      .execute()

    // Fetch the created record
    const created = await db2.selectFrom('${tableName}')
      .where('id', '=', Number((result as any).insertId))
      .executeTakeFirst()

    return created ? new ${modelName}Model(created) : undefined
  }

  // Update the current record
  async update(data: Record<string, any>) {
    if (!this.attributes.id) {
      throw new Error('Cannot update a model without an ID')
    }

    // Filter based on fillable and guarded
    const filteredData = Object.fromEntries(
      Object.entries(data).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key)
      )
    )

    await (db2 as any).updateTable('${tableName}')
      .set(filteredData)
      .where('id', '=', this.attributes.id)
      .execute()

    // Fetch the updated record
    const updated = await db2.selectFrom('${tableName}')
      .where('id', '=', this.attributes.id)
      .executeTakeFirst()

    if (updated) {
      this.attributes = { ...updated }
    }

    return this
  }

  // Delete the current record
  async delete() {
    if (!this.attributes.id) {
      throw new Error('Cannot delete a model without an ID')
    }

    await (db2 as any).deleteFrom('${tableName}')
      .where('id', '=', this.attributes.id)
      .execute()

    return true
  }

  // Convert to JSON (excluding hidden fields)
  toJSON() {
    const json = { ...this.attributes }

    for (const field of this.hidden) {
      delete json[field]
    }

    return json
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

    const modelString = generateOrmModelString(modelName, tableName, model)

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

  const modelString = generateOrmModelString(modelName, tableName, model)

  // Ensure the directory exists
  const ormModelsDir = path.storagePath('framework/core/db/src/orm/Models')
  await fs.promises.mkdir(ormModelsDir, { recursive: true })

  // Write the generated model file
  const outputPath = path.join(ormModelsDir, `${modelName}.ts`)
  await fs.promises.writeFile(outputPath, modelString, 'utf8')

  console.log(`Generated ORM model: ${modelName} -> ${outputPath}`)
}

