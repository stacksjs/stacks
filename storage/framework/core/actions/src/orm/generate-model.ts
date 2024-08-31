import { log } from '@stacksjs/logging'
import {
  fetchOtherModelRelations,
  getFillableAttributes,
  getHiddenAttributes,
  getModelName,
  getPivotTables,
  getRelationCount,
  getRelationType,
  getRelations,
  getTableName,
  writeModelNames,
  writeModelRequest,
  writeOrmActions,
} from '@stacksjs/orm'
import { path } from '@stacksjs/path'
import { fs, glob } from '@stacksjs/storage'
import { pascalCase, plural, singular, snakeCase } from '@stacksjs/strings'
import type { Model } from '@stacksjs/types'

await generateModelFiles()
await setKyselyTypes()

async function generateApiRoutes(modelFiles: string[]) {
  const file = Bun.file(path.frameworkPath(`orm/routes.ts`))
  const writer = file.writer()
  let routeString = `import { route } from '@stacksjs/router'\n\n\n`

  for (const modelFile of modelFiles) {
    log.debug(`Processing model file: ${modelFile}`)
    let middlewareString = ''
    const model = (await import(modelFile)).default as Model
    const modelName = getModelName(model, modelFile)
    const tableName = getTableName(model, modelFile)

    if (model.traits?.useApi) {
      if (model.traits?.useApi && typeof model.traits.useApi === 'object') {
        const middlewares = model.traits.useApi?.middleware
        const uri = model.traits.useApi?.uri || tableName

        if (middlewares) {
          middlewareString = `.middleware([`
          if (middlewares.length) {
            for (let i = 0; i < middlewares.length; i++) {
              middlewareString += `'${middlewares[i]}'`

              if (i < middlewares.length - 1) {
                middlewareString += ','
              }
            }
          }

          middlewareString += `])`
        }

        if (model.traits.useApi.routes && Object.keys(model.traits.useApi.routes).length > 0) {
          const apiRoutes = model.traits.useApi.routes
          for (const apiRoute in apiRoutes) {
            if (Object.prototype.hasOwnProperty.call(apiRoutes, apiRoute)) {
              let path: string | null = ''

              await writeOrmActions(apiRoute as string, modelName)

              const routePath = apiRoutes[apiRoute as keyof typeof apiRoutes]
              if (typeof routePath !== 'string') {
                throw new Error(`Invalid route path for ${apiRoute}`)
              }

              path = `${routePath}.ts`

              if (!path.includes('/')) {
                path = await lookupFile(path)
              }

              if (!path) {
                throw { message: 'Action Not Found!' }
              }

              if (apiRoute === 'index') routeString += `route.get('${uri}', '${path}')\n\n`
              if (apiRoute === 'show') routeString += `route.get('${uri}/{id}', '${path}')\n\n`
              if (apiRoute === 'store') routeString += `route.post('${uri}', '${path}')\n\n`
              if (apiRoute === 'update') routeString += `route.patch('${uri}/{id}', '${path}')\n\n`
              if (apiRoute === 'destroy') routeString += `route.delete('${uri}/{id}', '${path}')\n\n`
            }
          }
        }
      }
    }
  }

  writer.write(routeString)
  await writer.end()
}

async function lookupFile(fileName: string): Promise<string | null> {
  const ormDirectory = path.builtUserActionsPath('src', { relative: true })
  const filePath = path.join(ormDirectory, fileName)
  const pathExists = fs.existsSync(filePath)

  // Check if the directory exists
  if (pathExists) {
    return filePath
  }

  const actionDirectory = path.userActionsPath()
  const actionFilePath = path.join(actionDirectory, fileName)
  const fileExists = fs.existsSync(actionFilePath)

  if (fileExists) {
    return actionFilePath
  }

  return null
}

async function generateModelFiles(modelStringFile?: string): Promise<void> {
  await deleteExistingModels(modelStringFile)
  await deleteExistingOrmActions(modelStringFile)
  await deleteExistingModelNameTypes()
  await deleteExistingModelRequest(modelStringFile)
  await deleteExistingOrmRoute()

  await writeModelNames()
  await writeModelRequest()

  const modelFiles = glob.sync(path.userModelsPath('**/*.ts'))
  await generateApiRoutes(modelFiles)

  for (const modelFile of modelFiles) {
    if (modelStringFile && modelStringFile !== modelFile) continue

    log.debug(`Processing model file: ${modelFile}`)

    const model = (await import(modelFile)).default as Model
    const tableName = getTableName(model, modelFile)
    const modelName = getModelName(model, modelFile)
    const file = Bun.file(path.frameworkPath(`orm/src/models/${modelName}.ts`))
    const fields = await extractFields(model, modelFile)
    const classString = await generateModelString(tableName, modelName, model, fields)
    const writer = file.writer()

    writer.write(classString)
    await writer.end()
  }
}

async function deleteExistingModels(modelStringFile?: string) {
  const typePath = path.frameworkPath(`orm/src/types.ts`)
  if (fs.existsSync(typePath)) await Bun.$`rm ${typePath}`

  if (modelStringFile) {
    const modelPath = path.frameworkPath(`orm/src/models/${modelStringFile}.ts`)
    await Bun.$`rm ${modelPath}`

    return
  }

  const modelPaths = glob.sync(path.frameworkPath(`orm/src/models/*.ts`))
  for (const modelPath of modelPaths) {
    if (fs.existsSync(modelPath)) await Bun.$`rm ${modelPath}`
  }
}

async function deleteExistingOrmActions(modelStringFile?: string) {
  const routes = path.frameworkPath(`orm/routes.ts`)
  if (fs.existsSync(routes)) await Bun.$`rm ${routes}`

  if (modelStringFile) {
    const ormPath = path.builtUserActionsPath(`src/${modelStringFile}.ts`)
    if (fs.existsSync(ormPath)) await Bun.$`rm ${ormPath}`

    return
  }

  const ormPaths = glob.sync(path.builtUserActionsPath(`**/*.ts`))

  for (const ormPath of ormPaths) {
    if (fs.existsSync(ormPath)) await Bun.$`rm ${ormPath}`
  }
}

async function deleteExistingModelNameTypes() {
  const typeFile = path.corePath(`types/src/model-names.ts`)
  if (fs.existsSync(typeFile)) await Bun.$`rm ${typeFile}`
}

async function deleteExistingModelRequest(modelStringFile?: string) {
  const requestD = path.frameworkPath('types/requests.d.ts')
  if (fs.existsSync(requestD)) await Bun.$`rm ${requestD}`

  if (modelStringFile) {
    const requestFile = path.frameworkPath(`requests/${modelStringFile}.ts`)
    if (fs.existsSync(requestFile)) await Bun.$`rm ${requestFile}`

    return
  }

  const requestFiles = glob.sync(path.frameworkPath(`requests/*.ts`))
  for (const requestFile of requestFiles) {
    if (fs.existsSync(requestFile)) await Bun.$`rm ${requestFile}`
  }
}

async function deleteExistingOrmRoute() {
  const ormRoute = path.storagePath('framework/orm/routes')
  if (fs.existsSync(ormRoute)) await Bun.$`rm ${ormRoute}`
}

async function setKyselyTypes() {
  const modelFiles = glob.sync(path.userModelsPath('*.ts'))
  let text = ``

  for (const modelFile of modelFiles) {
    const model = (await import(modelFile)).default as Model
    const tableName = getTableName(model, modelFile)
    const modelName = getModelName(model, modelFile)
    const words = tableName.split('_')
    const pivotFormatted = `${words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join('')}`

    text += `import type { ${pivotFormatted}Table } from '../../../../orm/src/models/${modelName}'\n`
  }

  text += `import type { Generated } from 'kysely'\n\n`

  let pivotFormatted = ''
  for (const modelFile of modelFiles) {
    const model = (await import(modelFile)).default as Model
    const modelName = getModelName(model, modelFile)
    const pivotTables = await getPivotTables(model, modelName)

    for (const pivotTable of pivotTables) {
      const words = pivotTable.table.split('_')

      pivotFormatted = `${words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join('')}Table`

      text += `export interface ${pivotFormatted} {
        id: Generated<number>
        ${pivotTable.firstForeignKey}: number
        ${pivotTable.secondForeignKey}: number
      }`
    }
  }

  text += `\nexport interface Database {\n`

  for (const modelFile of modelFiles) {
    const model = (await import(modelFile)).default as Model
    const modelName = getModelName(model, modelFile)
    const tableName = await getTableName(model, modelFile)
    const pivotTables = await getPivotTables(model, modelName)

    for (const pivotTable of pivotTables) text += `  ${pivotTable.table}: ${pivotFormatted}\n`

    const words = tableName.split('_')
    const formattedTableName = `${words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join('')}Table`

    text += `  ${tableName}: ${formattedTableName}\n`
  }

  text += `}`

  const file = Bun.file(path.frameworkPath(`orm/src/types.ts`))
  const writer = file.writer()

  writer.write(text)

  await writer.end()
}

async function generateModelString(
  tableName: string,
  modelName: string,
  model: Model,
  attributes: ModelElement[],
): Promise<string> {
  const formattedTableName = pascalCase(tableName) // users -> Users
  const formattedModelName = modelName.toLowerCase() // User -> user

  let fieldString = ''
  let constructorFields = ''
  let jsonFields = '{\n'
  let declareFields = ''
  let whereStatements = ''
  let whereFunctionStatements = ''
  let relationMethods = ``
  let relationImports = ``
  let twoFactorStatements = ''
  let mittCreateStatement = ``
  let mittUpdateStatement = ``
  let mittDeleteStatement = ``

  const relations = await getRelations(model, modelName)

  for (const relationInstance of relations) {
    relationImports += `import ${relationInstance.model} from './${relationInstance.model}'\n\n`
  }

  const useTimestamps = model?.traits?.useTimestamps ?? model?.traits?.timestampable ?? true
  const useSoftDeletes = model?.traits?.useSoftDeletes ?? model?.traits?.softDeletable ?? false
  const observer = model?.traits?.observe

  if (typeof observer === 'boolean') {
    if (observer) {
      mittCreateStatement += `dispatch('${formattedModelName}:created', model)`
      mittUpdateStatement += `dispatch('${formattedModelName}:updated', model)`
      mittDeleteStatement += `dispatch('${formattedModelName}:deleted', this)`
    }
  }

  if (Array.isArray(observer)) {
    // Iterate through the array and append statements based on its contents
    if (observer.includes('create')) {
      mittCreateStatement += `dispatch('${formattedModelName}:created', model);`
    }
    if (observer.includes('update')) {
      mittUpdateStatement += `dispatch('${formattedModelName}:updated', model);`
    }
    if (observer.includes('delete')) {
      mittDeleteStatement += `dispatch('${formattedModelName}:deleted', model);`
    }
  }

  for (const relation of relations) {
    const modelRelation = relation.model
    const foreignKeyRelation = relation.foreignKey
    const tableRelation = relation.table || ''
    const pivotTableRelation = relation.pivotTable
    const formattedModelRelation = modelRelation.toLowerCase()
    const relationType = getRelationType(relation.relationship)
    const relationCount = getRelationCount(relation.relationship)

    if (relationType === 'throughType') {
      const relationName = relation.relationName || formattedModelName + modelRelation
      const throughRelation = relation.throughModel

      if (relation.throughModel === undefined) continue

      const formattedThroughRelation = relation?.throughModel?.toLowerCase()
      const throughTableRelation = throughRelation
      const foreignKeyThroughRelation = relation.throughForeignKey || `${formattedThroughRelation}_id`

      relationMethods += `
      async ${relationName}() {
        if (this.id === undefined)
          throw new Error('Relation Error!')

        const firstModel = await db.selectFrom('${throughTableRelation}')
          .where('${foreignKeyRelation}', '=', this.id)
          .selectAll()
          .executeTakeFirst()

        if (! firstModel)
          throw new Error('Model Relation Not Found!')

        const finalModel = ${modelRelation}
          .where('${foreignKeyThroughRelation}', '=', firstModel.id)
          .first()

        return new ${modelRelation}.modelInstance(finalModel)
      }\n\n`
    }

    if (relationType === 'hasType' && relationCount === 'many') {
      const relationName = relation.relationName || tableRelation

      relationMethods += `
      async ${relationName}() {
        if (this.id === undefined)
          throw new Error('Relation Error!')

        const results = await db.selectFrom('${tableRelation}')
          .where('${foreignKeyRelation}', '=', this.id)
          .selectAll()
          .execute()

          return results
      }\n\n`
    }

    if (relationType === 'hasType' && relationCount === 'one') {
      const relationName = relation.relationName || formattedModelRelation
      relationMethods += `
      async ${relationName}() {
        if (this.id === undefined)
          throw new Error('Relation Error!')

        const model = ${modelRelation}
        .where('${foreignKeyRelation}', '=', this.id).first()

        if (! model)
          throw new Error('Model Relation Not Found!')

        return model
      }\n\n`
    }

    if (relationType === 'belongsType' && !relationCount) {
      const relationName = relation.relationName || formattedModelRelation

      relationMethods += `
      async ${relationName}() {
        if (this.${foreignKeyRelation} === undefined)
          throw new Error('Relation Error!')

        const model = await ${modelRelation}
          .where('id', '=', ${foreignKeyRelation})
          .first()

        if (! model)
          throw new Error('Model Relation Not Found!')

        return model
      }\n\n`
    }

    if (relationType === 'belongsType' && relationCount === 'many') {
      const pivotTable = pivotTableRelation || tableRelation
      const relationName = relation.relationName || formattedModelName + plural(pascalCase(modelRelation))

      relationMethods += `
      async ${relationName}() {
        if (this.id === undefined)
          throw new Error('Relation Error!')

        const results = await db.selectFrom('${pivotTable}')
          .where('${foreignKeyRelation}', '=', this.id)
          .selectAll()
          .execute()

          const tableRelationIds = results.map(result => result.${singular(tableRelation)}_id)

          if (! tableRelationIds.length)
            throw new Error('Relation Error!')

          const relationResults = await ${modelRelation}.whereIn('id', tableRelationIds).get()

          return relationResults
      }\n\n`
    }
  }

  declareFields += `public id: number | undefined \n   `

  constructorFields += `this.id = ${formattedModelName}?.id\n   `

  const useTwoFactor = typeof model.traits?.useAuth === 'object' && model.traits.useAuth.useTwoFactor

  if (useTwoFactor) {
    declareFields += `public two_factor_secret: string | undefined \n`
    constructorFields += `this.two_factor_secret = ${formattedModelName}?.two_factor_secret\n   `

    twoFactorStatements += `
      async generateTwoFactorForModel() {
        const secret = generateTwoFactorSecret()

        await this.update({ 'two_factor_secret': secret })
      }

      verifyTwoFactorCode(code: string): boolean {
        if (! this.${formattedModelName}) return false

        const modelTwoFactorSecret = this.${formattedModelName}.two_factor_secret
        const isValid = verifyTwoFactorCode(code, modelTwoFactorSecret)

        return isValid
      }
    `
  }

  jsonFields += `\nid: this.id,\n`
  for (const attribute of attributes) {
    const entity = attribute.fieldArray?.entity === 'enum' ? 'string[]' : attribute.fieldArray?.entity

    fieldString += ` ${snakeCase(attribute.field)}: ${entity}\n     `
    declareFields += `public ${snakeCase(attribute.field)}: ${entity} | undefined \n   `
    constructorFields += `this.${snakeCase(attribute.field)} = ${formattedModelName}?.${snakeCase(attribute.field)}\n   `
    jsonFields += `${snakeCase(attribute.field)}: this.${snakeCase(attribute.field)},\n   `

    whereStatements += `static where${pascalCase(attribute.field)}(value: string | number | boolean | undefined | null): ${modelName}Model {
        const instance = new this(null)

        instance.query = instance.query.where('${attribute.field}', '=', value)

        return instance
      } \n\n`

    whereFunctionStatements += `export async function where${pascalCase(attribute.field)}(value: string | number | boolean | undefined | null): Promise<${modelName}Model[]> {
        const query = db.selectFrom('${tableName}').where('${attribute.field}', '=', value)
        const results = await query.execute()

        return results.map(modelItem => new ${modelName}Model(modelItem))
      } \n\n`
  }

  if (useTimestamps) {
    declareFields += `
      public created_at: Date | undefined
      public updated_at: Date | undefined
    `

    constructorFields += `
      this.created_at = user?.created_at\n
      this.updated_at = user?.updated_at\n
    `

    jsonFields += `
      created_at: this.created_at,\n
      updated_at: this.updated_at,\n
    `
  }

  if (useSoftDeletes) {
    declareFields += `
      public deleted_at: Date | undefined
    `

    constructorFields += `
      this.deleted_at = user?.deleted_at\n
    `

    jsonFields += `
      deleted_at: this.deleted_at,\n
    `
  }

  jsonFields += '}'

  const otherModelRelations = await fetchOtherModelRelations(model, modelName)

  for (const otherModelRelation of otherModelRelations) {
    fieldString += ` ${otherModelRelation.foreignKey}: number \n`

    declareFields += `public ${otherModelRelation.foreignKey}: number | undefined \n   `

    constructorFields += `this.${otherModelRelation.foreignKey} = ${formattedModelName}?.${otherModelRelation.foreignKey}\n   `
  }

  if (useTwoFactor) {
    fieldString += `two_factor_secret?: string \n`
  }

  if (useTimestamps) {
    fieldString += `
      created_at: ColumnType<Date, string | undefined, never>\n
      updated_at: ColumnType<Date, string | undefined, never>
    `
  }

  if (useSoftDeletes) {
    fieldString += `
      deleted_at: ColumnType<Date, string | undefined, never>\n
    `
  }

  const hidden = JSON.stringify(getHiddenAttributes(model.attributes))
  const fillable = JSON.stringify(getFillableAttributes(model.attributes))

  return `import type { ColumnType, Generated, Insertable, Selectable, Updateable } from 'kysely'
    import { db } from '@stacksjs/database'
    import { sql } from '@stacksjs/database'
    import { dispatch } from '@stacksjs/events'
    import { generateTwoFactorSecret } from '@stacksjs/auth'
    import { verifyTwoFactorCode } from '@stacksjs/auth'
    ${relationImports}
    // import { Kysely, MysqlDialect, PostgresDialect } from 'kysely'
    // import { Pool } from 'pg'

    // TODO: we need an action that auto-generates these table interfaces
    export interface ${formattedTableName}Table {
      id: Generated<number>
     ${fieldString}
    }

    interface ${modelName}Response {
      data: ${formattedTableName}
      paging: {
        total_records: number
        page: number
        total_pages: number
      }
      next_cursor: number | null
    }

    export type ${modelName}Type = Selectable<${formattedTableName}Table>
    export type New${modelName} = Insertable<${formattedTableName}Table>
    export type ${modelName}Update = Updateable<${formattedTableName}Table>
    export type ${formattedTableName} = ${modelName}Type[]

    export type ${modelName}Column = ${formattedTableName}
    export type ${modelName}Columns = Array<keyof ${formattedTableName}>

    type SortDirection = 'asc' | 'desc'
    interface SortOptions { column: ${modelName}Type, order: SortDirection }
    // Define a type for the options parameter
    interface QueryOptions {
      sort?: SortOptions
      limit?: number
      offset?: number
      page?: number
    }

    export class ${modelName}Model {
      private hidden = ${hidden}
      private fillable = ${fillable}
      private softDeletes = ${useSoftDeletes}
      protected query: any
      protected hasSelect: boolean
      ${declareFields}
      constructor(${formattedModelName}: Partial<${modelName}Type> | null) {
        ${constructorFields}

        this.query = db.selectFrom('${tableName}')
        this.hasSelect = false
      }

      // Method to find a ${modelName} by ID
      async find(id: number, fields?: (keyof ${modelName}Type)[]): Promise<${modelName}Model | undefined> {
        let query = db.selectFrom('${tableName}').where('id', '=', id)

        if (fields)
          query = query.select(fields)
        else
          query = query.selectAll()

        const model = await query.executeTakeFirst()

        if (!model)
          return undefined

        return this.parseResult(new ${modelName}Model(model))
      }

      // Method to find a ${modelName} by ID
      static async find(id: number, fields?: (keyof ${modelName}Type)[]): Promise<${modelName}Model | undefined> {
        let query = db.selectFrom('${tableName}').where('id', '=', id)

        const instance = new this(null)

        if (fields)
          query = query.select(fields)
        else
          query = query.selectAll()

        const model = await query.executeTakeFirst()

        if (!model)
          return undefined

        return instance.parseResult(new this(model))
      }

      static async all(): Promise<${modelName}Model[]> {
        let query = db.selectFrom('${tableName}').selectAll()

        const instance = new this(null)

        if (instance.softDeletes) {
          query = query.where('deleted_at', 'is', null)
        }

        const results = await query.execute();

        return results.map(modelItem => instance.parseResult(new ${modelName}Model(modelItem)));
      }


      static async findOrFail(id: number): Promise<${modelName}Model> {
        let query = db.selectFrom('${tableName}').where('id', '=', id)

        const instance = new this(null)

        if (instance.softDeletes) {
          query = query.where('deleted_at', 'is', null);
        }

        query = query.selectAll()

        const model = await query.executeTakeFirst()

        if (!model)
          throw(\`No model results found for \${id}\ \`)


        return instance.parseResult(new this(model))
      }

      static async findMany(ids: number[]): Promise<${modelName}Model[]> {
        let query = db.selectFrom('${tableName}').where('id', 'in', ids)

        const instance = new this(null)

        if (instance.softDeletes) {
          query = query.where('deleted_at', 'is', null);
        }

        query = query.selectAll()

        const model = await query.execute()

        return model.map(modelItem => instance.parseResult(new ${modelName}Model(modelItem)))
      }

      // Method to get a ${modelName} by criteria
      static async fetch(criteria: Partial<${modelName}Type>, options: QueryOptions = {}): Promise<${modelName}Model[]> {
        let query = db.selectFrom('${tableName}')

         const instance = new this(null)

        // Apply sorting from options
        if (options.sort)
          query = query.orderBy(options.sort.column, options.sort.order)

        // Apply limit and offset from options
        if (options.limit !== undefined)
          query = query.limit(options.limit)

        if (options.offset !== undefined)
          query = query.offset(options.offset)

        if (instance.softDeletes) {
          query = query.where('deleted_at', 'is', null);
        }

        const model = await query.selectAll().execute()
        return model.map(modelItem => new ${modelName}Model(modelItem))
      }

      // Method to get a ${modelName} by criteria
      static async get(): Promise<${modelName}Model[]> {
        let query = db.selectFrom('${tableName}');

        const instance = new this(null)

        // Check if soft deletes are enabled
        if (instance.softDeletes) {
          query = query.where('deleted_at', 'is', null);
        }

        const model = await query.selectAll().execute();

        return model.map(modelItem => new ${modelName}Model(modelItem));
      }

      // Method to get a ${modelName} by criteria
      async get(): Promise<${modelName}Model[]> {
        if (this.hasSelect) {

          if (this.softDeletes) {
            this.query = this.query.where('deleted_at', 'is', null);
          }

          const model = await this.query.execute()

          return model.map((modelItem: ${modelName}Model) => new ${modelName}Model(modelItem))
        }

        if (this.softDeletes) {
          this.query = this.query.where('deleted_at', 'is', null);
        }

        const model = await this.query.selectAll().execute()

        return model.map((modelItem: ${modelName}Model) => new ${modelName}Model(modelItem))
      }

      static async count(): Promise<number> {
        const instance = new this(null)

        if (instance.softDeletes) {
          instance.query = instance.query.where('deleted_at', 'is', null);
        }

        const results = await instance.query.selectAll().execute()

        return results.length
      }

      async count(): Promise<number> {
        if (this.hasSelect) {

          if (this.softDeletes) {
            this.query = this.query.where('deleted_at', 'is', null);
          }

          const results = await this.query.execute()

          return results.length
        }

        const results = await this.query.selectAll().execute()

        return results.length
      }

      // Method to get all ${tableName}
      static async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<${modelName}Response> {
        const totalRecordsResult = await db.selectFrom('${tableName}')
          .select(db.fn.count('id').as('total')) // Use 'id' or another actual column name
          .executeTakeFirst()

        const totalRecords = Number(totalRecordsResult?.total) || 0
        const totalPages = Math.ceil(totalRecords / (options.limit ?? 10))

        const ${tableName}WithExtra = await db.selectFrom('${tableName}')
          .selectAll()
          .orderBy('id', 'asc') // Assuming 'id' is used for cursor-based pagination
          .limit((options.limit ?? 10) + 1) // Fetch one extra record
          .offset(((options.page ?? 1) - 1) * (options.limit ?? 10)) // Ensure options.page is not undefined
          .execute()

        let nextCursor = null
        if (${tableName}WithExtra.length > (options.limit ?? 10))
          nextCursor = ${tableName}WithExtra.pop()!.id // Use the ID of the extra record as the next cursor

        return {
          data: ${tableName}WithExtra,
          paging: {
            total_records: totalRecords,
            page: options.page,
            total_pages: totalPages,
          },
          next_cursor: nextCursor,
        }
      }

      // Method to create a new ${formattedModelName}
      static async create(new${modelName}: New${modelName}): Promise<${modelName}Model | undefined> {
        const instance = new this(null)
        const filteredValues = Object.keys(new${modelName})
          .filter(key => instance.fillable.includes(key))
          .reduce((obj: any, key) => {
              obj[key] = new${modelName}[key];
              return obj
          }, {})

        if (Object.keys(filteredValues).length === 0) {
          return undefined
        }

        const result = await db.insertInto('${tableName}')
          .values(filteredValues)
          .executeTakeFirstOrThrow()

        const model = await find(Number(result.insertId)) as ${modelName}Model

        ${mittCreateStatement}

        return model
      }

      // Method to remove a ${modelName}
      static async remove(id: number): Promise<void> {
        const instance = new this(null)
        const model = await instance.find(id)

       if (instance.softDeletes) {
        await db.updateTable('${tableName}')
          .set({
            deleted_at: sql.raw('CURRENT_TIMESTAMP')
          })
          .where('id', '=', id)
          .execute();
        } else {
          await db.deleteFrom('${tableName}')
            .where('id', '=', id)
            .execute();
        }

        ${mittDeleteStatement}
      }

      where(...args: (string | number | boolean | undefined | null)[]): ${modelName}Model {
        let column: any
        let operator: any
        let value: any

        if (args.length === 2) {
          [column, value] = args
          operator = '='
        } else if (args.length === 3) {
            [column, operator, value] = args
        } else {
            throw new Error("Invalid number of arguments")
        }

        this.query = this.query.where(column, operator, value)

        return this
      }

      static where(...args: (string | number | boolean | undefined | null)[]): ${modelName}Model {
        let column: any
        let operator: any
        let value: any

        const instance = new this(null)

        if (args.length === 2) {
          [column, value] = args
          operator = '='
        } else if (args.length === 3) {
            [column, operator, value] = args
        } else {
            throw new Error("Invalid number of arguments")
        }

        instance.query = instance.query.where(column, operator, value)

        return instance
      }

       ${whereStatements}

      static whereIn(column: keyof ${modelName}Type, values: any[]): ${modelName}Model {
        const instance = new this(null)

        instance.query = instance.query.where(column, 'in', values)

        return instance
      }

      async first(): Promise<${modelName}Model | undefined> {
        const model = await this.query.selectAll().executeTakeFirst()

        if (! model) {
          return undefined
        }

        return this.parseResult(new ${modelName}Model(model))
      }

      async exists(): Promise<boolean> {
        const model = await this.query.selectAll().executeTakeFirst()

        return model !== null || model !== undefined
      }

      static async first(): Promise<${modelName}Type | undefined> {
        return await db.selectFrom('${tableName}')
          .selectAll()
          .executeTakeFirst()
      }

      async last(): Promise<${modelName}Type | undefined> {
        return await db.selectFrom('${tableName}')
          .selectAll()
          .orderBy('id', 'desc')
          .executeTakeFirst()
      }

      static orderBy(column: keyof ${modelName}Type, order: 'asc' | 'desc'): ${modelName}Model {
        const instance = new this(null)

        instance.query = instance.orderBy(column, order)

        return instance
      }

      orderBy(column: keyof ${modelName}Type, order: 'asc' | 'desc'): ${modelName}Model {
        this.query = this.query.orderBy(column, order)

        return this
      }

      static orderByDesc(column: keyof ${modelName}Type): ${modelName}Model {
        const instance = new this(null)

        instance.query = instance.query.orderBy(column, 'desc')

        return instance
      }

      orderByDesc(column: keyof ${modelName}Type): ${modelName}Model {
        this.query = this.orderBy(column, 'desc')

        return this
      }

      static orderByAsc(column: keyof ${modelName}Type): ${modelName}Model {
        const instance = new this(null)

        instance.query = instance.query.orderBy(column, 'desc')

        return instance
      }

      orderByAsc(column: keyof ${modelName}Type): ${modelName}Model {
        this.query = this.query.orderBy(column, 'desc')

        return this
      }

      // Method to update the ${tableName} instance
      async update(${formattedModelName}: ${modelName}Update): Promise<${modelName}Model | undefined> {
        if (this.id === undefined)
          throw new Error('${modelName} ID is undefined')

        const filteredValues = Object.keys(${formattedModelName})
            .filter(key => this.fillable.includes(key))
            .reduce((obj, key) => {
                obj[key] = ${formattedModelName}[key]
                return obj;
            }, {});

        await db.updateTable('${tableName}')
          .set(filteredValues)
          .where('id', '=', this.id)
          .executeTakeFirst()

        const model = this.find(Number(this.id))

        ${mittUpdateStatement}

        return model
      }

      // Method to save (insert or update) the ${formattedModelName} instance
      async save(): Promise<void> {
        if (!this.${formattedModelName})
          throw new Error('${modelName} data is undefined')

        if (this.${formattedModelName}.id === undefined) {
          // Insert new ${formattedModelName}
          const newModel = await db.insertInto('${tableName}')
            .values(this.${formattedModelName} as New${modelName})
            .executeTakeFirstOrThrow()
        }
        else {
          // Update existing ${formattedModelName}
          await this.update(this.${formattedModelName})
        }
      }

      // Method to delete (soft delete) the ${formattedModelName} instance
      async delete(): Promise<void> {
          if (this.id === undefined)
              throw new Error('${modelName} ID is undefined');

          // Check if soft deletes are enabled
          if (this.softDeletes) {
              // Update the deleted_at column with the current timestamp
              await db.updateTable('${tableName}')
                  .set({
                      deleted_at: sql.raw('CURRENT_TIMESTAMP')
                  })
                  .where('id', '=', this.id)
                  .execute();
          } else {
              // Perform a hard delete
              await db.deleteFrom('${tableName}')
                .where('id', '=', this.id)
                .execute();
          }

          ${mittDeleteStatement}
      }

      ${relationMethods}

      distinct(column: keyof ${modelName}Type): ${modelName}Model {
        this.query = this.query.distinctOn(column)

        return this
      }

      static distinct(column: keyof ${modelName}Type): ${modelName}Model {
        const instance = new this(null)

        instance.query = instance.query.distinctOn(column)

        return instance
      }

      join(table: string, firstCol: string, secondCol: string): ${modelName}Model {
        this.query = this.query.innerJoin(table, firstCol, secondCol)

        return this
      }

      static join(table: string, firstCol: string, secondCol: string): ${modelName}Model {
        const instance = new this(null)

        instance.query = instance.query.innerJoin(table, firstCol, secondCol)

        return instance
      }

      static async rawQuery(rawQuery: string): Promise<any> {
        return await sql\`\${rawQuery}\`\.execute(db)
      }

      toJSON() {
        const output: Partial<${modelName}Type> = ${jsonFields}

        this.hidden.forEach((attr) => {
          if (attr in output)
            delete output[attr as keyof Partial<${modelName}Type>]
        })

        type ${modelName} = Omit<${modelName}Type, 'password'>

        return output as ${modelName}
      }

      parseResult(model: ${modelName}Model): ${modelName}Model {
        delete model['query']
        delete model['fillable']
        delete model['two_factor_secret']
        delete model['hasSelect']
        delete model['softDeletes']

        for (const hiddenAttribute of this.hidden) {
          delete model[hiddenAttribute]
        }

        return model
      }

      ${twoFactorStatements}
    }

    async function find(id: number): Promise<${modelName}Model | null> {
      let query = db.selectFrom('${tableName}').where('id', '=', id)

      query.selectAll()

      const model = await query.executeTakeFirst()

      if (!model) return null

      return new ${modelName}Model(model)
    }

    export async function count(): Promise<number> {
      const results = await ${modelName}Model.count()

      return results
    }

    export async function create(new${modelName}: New${modelName}): Promise<${modelName}Model> {
      const result = await db.insertInto('${tableName}')
        .values(new${modelName})
        .executeTakeFirstOrThrow()

      return await find(Number(result.insertId)) as ${modelName}Model
    }

    export async function rawQuery(rawQuery: string): Promise<any> {
      return await sql\`\${rawQuery}\`\.execute(db)
    }

    export async function remove(id: number): Promise<void> {
      await db.deleteFrom('${tableName}')
        .where('id', '=', id)
        .execute()
    }

    ${whereFunctionStatements}

    const ${modelName} = ${modelName}Model

    export default ${modelName}
    `
}
