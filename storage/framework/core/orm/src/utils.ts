import type {
  Attributes,
  BaseRelation,
  FieldArrayElement,
  Model,
  ModelElement,
  RelationConfig,
  TableNames,
} from '@stacksjs/types'
import { generator, parser, traverse } from '@stacksjs/build'
import { italic, log } from '@stacksjs/cli'
import { handleError } from '@stacksjs/error-handling'
import { path } from '@stacksjs/path'
import { fs, globSync } from '@stacksjs/storage'
import { plural, singular, snakeCase } from '@stacksjs/strings'
import { isString } from '@stacksjs/validation'
import { generateModelString } from './generate'

type ModelPath = string

export async function modelTableName(model: Model | ModelPath): Promise<string> {
  if (typeof model === 'string') {
    model = (await import(model)).default as Model
  }

  return model.table ?? snakeCase(plural(model?.name || ''))
}

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

export function getPivotTableName(formattedModelName: string, modelRelationTable: string): string {
  const models = [formattedModelName, modelRelationTable]

  models.sort()

  models[0] = singular(models[0] || '')

  const pivotTableName = models.join('_')

  return pivotTableName
}

export function hasRelations(obj: any, key: string): boolean {
  return key in obj
}

export async function getRelations(model: Model, modelName: string): Promise<RelationConfig[]> {
  const relationsArray = ['hasOne', 'belongsTo', 'hasMany', 'belongsToMany', 'hasOneThrough']
  const relationships = []

  for (const relation of relationsArray) {
    if (hasRelations(model, relation)) {
      for (const relationInstance of model[relation as keyof Model] as BaseRelation) {
        let relationModel = relationInstance.model
        let modelRelation: Model
        if (isString(relationInstance)) {
          relationModel = relationInstance
        }

        const modelRelationPath = path.userModelsPath(`${relationModel}.ts`)
        const modelPath = path.userModelsPath(`${modelName}.ts`)
        const coreModelRelationPath = path.storagePath(`framework/defaults/models/${relationModel}.ts`)

        if (fs.existsSync(modelRelationPath))
          modelRelation = (await import(modelRelationPath)).default as Model
        else
          modelRelation = (await import(coreModelRelationPath)).default as Model

        const modelRelationTable = getTableName(modelRelation, modelRelationPath)
        const table = getTableName(model, modelPath)
        const modelRelationName = snakeCase(getModelName(modelRelation, modelRelationPath))
        const formattedModelName = snakeCase(modelName)

        const relationshipData: RelationConfig = {
          relationship: relation,
          model: relationModel,
          table: modelRelationTable as TableNames,
          relationTable: table as TableNames,
          foreignKey: relationInstance.foreignKey || `${formattedModelName}_id`,
          modelKey: `${modelRelationName}_id`,
          relationName: relationInstance.relationName || '',
          relationModel: modelName,
          throughModel: relationInstance.through || '',
          throughForeignKey: relationInstance.throughForeignKey || '',
          pivotForeign: relationInstance.foreignKey || `${formattedModelName}_id`,
          pivotKey: `${modelRelationName}_id`,
          pivotTable:
            relationInstance?.pivotTable
            || getPivotTableName(plural(formattedModelName), plural(modelRelation.table || '')),
        }

        if (['belongsToMany', 'belongsTo'].includes(relation))
          relationshipData.foreignKey = ''

        if (['belongsToMany'].includes(relation)) {
          relationshipData.pivotForeign = relationInstance.foreignKey || `${formattedModelName}_id`
          relationshipData.pivotKey = `${modelRelationName}_id`
        }

        relationships.push(relationshipData)
      }
    }
  }

  return relationships
}

export function getRelationType(relation: string): string {
  const belongToType = /belongs/
  const hasType = /has/
  const throughType = /Through/

  if (throughType.test(relation))
    return 'throughType'

  if (belongToType.test(relation))
    return 'belongsType'

  if (hasType.test(relation))
    return 'hasType'

  return ''
}

export function getRelationCount(relation: string): string {
  const singular = /One/
  const plural = /Many/

  if (plural.test(relation))
    return 'many'

  if (singular.test(relation))
    return 'one'

  return ''
}

export async function getPivotTables(
  model: Model,
  modelPath: string,
): Promise<{ table: string, firstForeignKey?: string, secondForeignKey?: string }[]> {
  const pivotTable = []

  if ('belongsToMany' in model) {
    const belongsToManyArr = model.belongsToMany || []
    for (const belongsToManyRelation of belongsToManyArr) {
      const modelRelationPath = path.userModelsPath(`${belongsToManyRelation}.ts`)
      const modelRelation = (await import(modelRelationPath)).default as Model
      const modelRelationTableName = getTableName(modelRelation, modelRelationPath)
      const modelName = getModelName(model, modelPath)
      const tableName = getTableName(model, modelPath)
      const formattedModelName = modelName.toLowerCase()

      const firstForeignKey
        = typeof belongsToManyRelation === 'object' && 'firstForeignKey' in belongsToManyRelation
          ? belongsToManyRelation.firstForeignKey
          : `${singular(tableName)}_${model.primaryKey}`

      const secondForeignKey
        = typeof belongsToManyRelation === 'object' && 'secondForeignKey' in belongsToManyRelation
          ? belongsToManyRelation.secondForeignKey
          : `${singular(modelRelationTableName)}_${model.primaryKey}`

      pivotTable.push({
        table:
          (typeof belongsToManyRelation === 'object' && 'pivotTable' in belongsToManyRelation
            ? belongsToManyRelation.pivotTable
            : undefined) ?? getPivotTableName(plural(formattedModelName), plural(modelRelation.table || '')),
        firstForeignKey,
        secondForeignKey,
      })
    }

    return pivotTable
  }

  return []
}

export async function fetchOtherModelRelations(modelName?: string): Promise<RelationConfig[]> {
  const modelFiles = globSync([path.userModelsPath('*.ts')], { absolute: true })
  const coreModelFiles = globSync([path.storagePath('framework/defaults/models/*.ts')], { absolute: true })

  const allModelFiles = [...modelFiles, ...coreModelFiles]

  const modelRelations = []

  for (let i = 0; i < allModelFiles.length; i++) {
    const modelFileElement = allModelFiles[i] as string

    const modelFile = await import(modelFileElement)

    if (modelName === modelFile.default.name)
      continue

    const otherModelName = getModelName(modelFile, modelFileElement)
    const relations = await getRelations(modelFile.default, otherModelName)

    if (!relations.length)
      continue

    const relation = relations.find(relation => relation.model === modelName)

    if (relation)
      modelRelations.push(relation)
  }

  return modelRelations
}

export function getHiddenAttributes(attributes: Attributes | undefined): string[] {
  if (attributes === undefined)
    return []

  return Object.keys(attributes).filter((key) => {
    if (attributes === undefined)
      return false

    return attributes[key]?.hidden === true
  })
}

export function getFillableAttributes(model: Model, otherModelRelations: RelationConfig[]): string[] {
  const attributes = model.attributes

  const additionalCols = []

  if (attributes === undefined)
    return []

  const useBillable = typeof model.traits?.billable === 'object' || typeof model.traits?.billable === 'boolean'
  const usePasskey = typeof model.traits?.useAuth === 'object' ? model.traits?.useAuth.usePasskey : false
  const useUuid = typeof model.traits?.useUuid || false

  if (useBillable)
    additionalCols.push('stripe_id')

  if (useUuid)
    additionalCols.push('uuid')

  if (usePasskey)
    additionalCols.push(...['two_factor_secret', 'public_key'])

  const foreignKeys = otherModelRelations.map(otherModelRelation => otherModelRelation.foreignKey).filter(relation => relation)

  return [
    ...Object.keys(attributes)
      .filter((key) => {
        if (attributes === undefined)
          return false

        return attributes[key]?.fillable === true
      })
      .map(attribute => snakeCase(attribute)),
    ...additionalCols,
    ...foreignKeys,
  ]
}

export async function writeModelNames(): Promise<void> {
  const models = globSync([path.userModelsPath('*.ts')], { absolute: true })
  const coreModelFiles = globSync([path.storagePath('framework/defaults/models/*.ts')], { absolute: true })
  let fileString = `export type ModelNames = `

  for (let i = 0; i < models.length; i++) {
    const modelPath = models[i] as string
    const model = (await import(modelPath)).default as Model
    const modelName = getModelName(model, modelPath)

    fileString += `'${modelName}'`

    if (i < models.length - 1) {
      fileString += ' | '
    }
  }

  fileString += ' | '

  for (let j = 0; j < coreModelFiles.length; j++) {
    const modelPath = coreModelFiles[j] as string

    const model = (await import(modelPath)).default as Model
    const modelName = getModelName(model, modelPath)

    fileString += `'${modelName}'`

    if (j < coreModelFiles.length - 1) {
      fileString += ' | '
    }
  }

  // Ensure the directory exists
  const typesDir = path.dirname(path.typesPath(`src/model-names.ts`))
  await fs.promises.mkdir(typesDir, { recursive: true })

  // Write to the file
  const typeFilePath = path.typesPath(`src/model-names.ts`)
  await fs.promises.writeFile(typeFilePath, fileString, 'utf8')
}

export async function writeTableNames(): Promise<void> {
  const models = globSync([path.userModelsPath('*.ts')], { absolute: true })
  const coreModelFiles = globSync([path.storagePath('framework/defaults/models/*.ts')], { absolute: true })

  let fileString = `export type TableNames = `

  for (let i = 0; i < models.length; i++) {
    const modelPath = models[i] as string
    const model = (await import(modelPath)).default as Model
    const tableName = getTableName(model, modelPath)

    const pivotTables = await getPivotTables(model, modelPath)

    for (const pivot of pivotTables) {
      fileString += `'${pivot.table}'`
      fileString += ' | '
    }

    fileString += `'${tableName}'`

    if (i < models.length - 1) {
      fileString += ' | '
    }
  }

  fileString += ' | '

  for (let j = 0; j < coreModelFiles.length; j++) {
    const modelPath = coreModelFiles[j] as string

    const model = (await import(modelPath)).default as Model
    const tableName = getTableName(model, modelPath)

    fileString += `'${tableName}'`

    if (j < coreModelFiles.length - 1) {
      fileString += ' | '
    }
  }

  // Ensure the directory exists
  const typesDir = path.dirname(path.typesPath(`src/table-names.ts`))
  await fs.promises.mkdir(typesDir, { recursive: true })

  // Write to the file
  const typeFilePath = path.typesPath(`src/table-names.ts`)
  await fs.promises.writeFile(typeFilePath, fileString, 'utf8')
}

export async function writeModelRequest(): Promise<void> {
  const modelFiles = globSync([path.userModelsPath('*.ts')], { absolute: true })
  const coreModelFiles = globSync([path.storagePath('framework/defaults/models/*.ts')], { absolute: true })
  const allModelFiles = [...modelFiles, ...coreModelFiles]

  const requestD = Bun.file(path.frameworkPath('types/requests.d.ts'))

  let importTypes = ``
  let importTypesString = ``
  let typeString = `import { Request } from '../core/router/src/request'\nimport type { VineType } from '@stacksjs/types'\n\n`

  typeString += `interface ValidationField {
    rule: VineType
    message: Record<string, string>
  }\n\n`

  typeString += `interface CustomAttributes {
    [key: string]: ValidationField
  }\n\n`

  for (let i = 0; i < allModelFiles.length; i++) {
    let fieldStringType = ``
    let fieldString = ``
    let fieldStringInt = ``
    let fileString = `import { Request } from '@stacksjs/router'\nimport { validateField, customValidate, type schema } from '@stacksjs/validation'\n`

    const modeFileElement = allModelFiles[i] as string

    const model = (await import(modeFileElement)).default as Model

    const modelName = getModelName(model, modeFileElement)
    const useTimestamps = model?.traits?.useTimestamps ?? model?.traits?.timestampable ?? true
    const useUuid = model?.traits?.useUuid || false
    const useSoftDeletes = model?.traits?.useSoftDeletes ?? model?.traits?.softDeletable ?? false
    const attributes = await extractFields(model, modeFileElement)

    fieldString += ` id: number\n`
    fieldStringInt += `public id = 1\n`

    fieldStringType += ` get(key: 'id'): number\n`

    const entityGroups: Record<string, string[]> = {}

    // Group attributes by their entity type
    for (const attribute of attributes) {
      const entity = attribute.fieldArray?.entity === 'enum' ? 'string[]' : attribute.fieldArray?.entity
      let defaultValue: any = `''`

      if (attribute.fieldArray?.entity === 'boolean')
        defaultValue = false
      if (attribute.fieldArray?.entity === 'number')
        defaultValue = 0

      // Convert the field name to snake_case
      const snakeField = snakeCase(attribute.field)

      if (typeof entity === 'string') {
        if (entityGroups[entity]) {
          entityGroups[entity].push(`'${snakeField}'`)
        }
        else {
          entityGroups[entity] = [`'${snakeField}'`]
        }

        fieldString += ` ${snakeCase(attribute.field)}: ${entity}\n     `
        fieldStringInt += `public ${snakeField} = ${defaultValue}\n`
      }
    }

    // Generate fieldStringType with grouped fields
    for (const [entity, fields] of Object.entries(entityGroups)) {
      const concatenatedFields = fields.join(' | ')
      fieldStringType += ` get(key: ${concatenatedFields}): ${entity}\n`
    }

    const otherModelRelations = await fetchOtherModelRelations(modelName)

    for (const otherModel of otherModelRelations) {
      if (!otherModel.foreignKey)
        continue

      fieldString += ` ${otherModel.foreignKey}: number\n     `
      fieldStringType += ` get(key: '${otherModel.foreignKey}'): string \n`
      fieldStringInt += `public ${otherModel.foreignKey} = 0\n`
    }

    if (useTimestamps) {
      fieldStringInt += `public created_at = new Date
        public updated_at = new Date
      `
    }

    if (useUuid)
      fieldStringInt += `public uuid = ''`

    if (useSoftDeletes) {
      fieldStringInt += `
        public deleted_at = new Date()
      `

      fieldString += `deleted_at?: Date\n`
    }

    fieldString += `created_at?: Date
      updated_at?: Date`

    const requestFile = Bun.file(path.frameworkPath(`requests/${modelName}Request.ts`))

    importTypes = `${modelName}RequestType`
    importTypesString += `${importTypes}`

    if (i < modelFiles.length - 1)
      importTypesString += ` | `

    fileString += `import type { ${importTypes} } from '../types/requests'\n\n`
    fileString += `interface ValidationField {
      rule: ReturnType<typeof schema.string>
      message: Record<string, string>
    }\n\n`
    fileString += `interface CustomAttributes {
      [key: string]: ValidationField
    }\n`

    const types = `export interface ${modelName}RequestType extends Request {
      validate(attributes?: CustomAttributes): void
      ${fieldStringType}
      all(): RequestData${modelName}
      ${fieldString}
    }\n\n`

    typeString += `interface RequestData${modelName} {
      ${fieldString}
    }\n`

    fileString += `interface RequestData${modelName} {
      ${fieldString}
    }\n`

    typeString += types

    fileString += `export class ${modelName}Request extends Request<RequestData${modelName}> implements ${modelName}RequestType {
      ${fieldStringInt}
      public async validate(attributes?: CustomAttributes): Promise<void> {
        if (attributes === undefined || attributes === null) {
          await validateField('${modelName}', this.all())
        } else {
          await customValidate(attributes, this.all())
        }

      }
    }

    export const ${modelName.toLocaleLowerCase()}Request = new ${modelName}Request()
    `

    const writer = requestFile.writer()

    writer.write(fileString)
  }

  typeString += `export type ModelRequest = ${importTypesString}`

  const requestWrite = requestD.writer()

  requestWrite.write(typeString)
}

export async function writeOrmActions(apiRoute: string, modelName: string, actionPath?: string): Promise<void> {
  const formattedApiRoute = apiRoute.charAt(0).toUpperCase() + apiRoute.slice(1)

  let method = 'GET'
  let actionString = `import { Action } from '@stacksjs/actions'\n`
  actionString += `import { response } from '@stacksjs/router'\n`
  let handleString = ``

  if (apiRoute === 'index') {
    handleString += `async handle() {
        const results = ${modelName}.all()

        return json.response(response)
      },`

    method = 'GET'
  }

  if (apiRoute === 'show') {
    actionString += `  import type { ${modelName}RequestType } from '@stacksjs/orm'\n\n`
    handleString += `async handle(request: ${modelName}RequestType) {
        const id = request.getParam('id')

        return await ${modelName}.findOrFail(Number(id))
      },`

    method = 'GET'
  }

  if (apiRoute === 'destroy') {
    actionString += `  import type { ${modelName}RequestType } from '@stacksjs/orm'\n\n`
    handleString += `async handle(request: ${modelName}RequestType) {
        const id = request.getParam('id')

        const model = await ${modelName}.findOrFail(Number(id))

        model.delete()

        return 'Model deleted!'
      },`

    method = 'DELETE'
  }

  if (apiRoute === 'store') {
    actionString += `  import type { ${modelName}RequestType } from '@stacksjs/orm'\n\n`
    handleString += `async handle(request: ${modelName}RequestType) {
        await request.validate()
        const model = await ${modelName}.create(request.all())

        return model
      },`

    method = 'POST'
  }

  if (apiRoute === 'update') {
    actionString += `  import type { ${modelName}RequestType } from '@stacksjs/orm'\n\n`
    handleString += `async handle(request: ${modelName}RequestType) {
        await request.validate()

        const id = request.getParam('id')
        const model = await ${modelName}.findOrFail(Number(id))

        return model.update(request.all())
      },`

    method = 'PATCH'
  }

  actionString += `export default new Action({
      name: '${modelName} ${formattedApiRoute}',
      description: '${modelName} ${formattedApiRoute} ORM Action',
      method: '${method}',
      ${handleString}
    })
  `

  const actionName = actionPath || `${modelName}${formattedApiRoute}OrmAction.ts`

  const actionFile = path.builtUserActionsPath(`src/${actionName}`)

  if (fs.existsSync(actionFile))
    return

  const file = Bun.file(actionFile)

  const writer = file.writer()

  writer.write(actionString)
}

export async function extractFields(model: Model, modelFile: string): Promise<ModelElement[]> {
  // TODO: we can improve this type
  let fields: Record<string, any> | undefined = model.attributes

  if (!fields)
    fields = {}

  const fieldKeys = Object.keys(fields)
  const rules: string[] = []
  const file = Bun.file(modelFile)
  const code = await file.text()
  const regex = /rule:.*$/gm
  let match: RegExpExecArray | null
  match = regex.exec(code)

  while (match !== null) {
    rules.push(match[0])
    match = regex.exec(code)
  }

  const input: ModelElement[] = fieldKeys.map((field, index) => {
    const fieldExist = fields[field]
    let defaultValue = null
    let uniqueValue = false

    if (fieldExist) {
      defaultValue = fieldExist || null
      uniqueValue = fieldExist.unique || false
    }

    return {
      field,
      default: defaultValue,
      unique: uniqueValue,
      fieldArray: parseRule(rules[index] ?? ''),
    }
  })

  return input
}

function parseRule(rule: string): FieldArrayElement | null {
  const parts = rule.split('rule: schema.')

  if (parts.length !== 2)
    return null
  if (!parts[1])
    parts[1] = ''

  const extractedString = parts[1].replace(/,/g, '')

  if (!extractedString)
    return null

  const extractedParts = extractedString.split('.')
  const regex = /\(([^)]+)\)/

  return (
    extractedParts.map((input) => {
      const match = regex.exec(input)
      const value = match ? match[1] : null
      const field = input.replace(regex, '').replace(/\(|\)/g, '')
      return { entity: field, charValue: value }
    })[0] || null
  )
}

export async function generateApiRoutes(modelFiles: string[]): Promise<void> {
  const file = Bun.file(path.frameworkPath(`orm/routes.ts`))
  const writer = file.writer()
  let routeString = `import { route } from '@stacksjs/router'\n\n\n`

  for (const modelFile of modelFiles) {
    log.info(`Generating API Routes for: ${italic(modelFile)}`)
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

          if (Array.isArray(apiRoutes)) {
            if (apiRoutes.length) {
              for (const apiRoute of apiRoutes) {
                if (typeof apiRoute === 'string') {
                  await writeOrmActions(apiRoute, modelName)

                  const formattedApiRoute = apiRoute.charAt(0).toUpperCase() + apiRoute.slice(1)

                  if (apiRoute === 'index')
                    routeString += `route.get('${uri}', '${modelName}${formattedApiRoute}OrmAction').middleware(['Api'])\n\n`
                  if (apiRoute === 'show')
                    routeString += `route.get('${uri}/{id}', '${modelName}${formattedApiRoute}OrmAction').middleware(['Api'])\n\n`
                  if (apiRoute === 'store')
                    routeString += `route.post('${uri}', '${modelName}${formattedApiRoute}OrmAction').middleware(['Api'])\n\n`
                  if (apiRoute === 'update')
                    routeString += `route.patch('${uri}/{id}', '${modelName}${formattedApiRoute}OrmAction').middleware(['Api'])\n\n`
                  if (apiRoute === 'destroy')
                    routeString += `route.delete('${uri}/{id}', '${modelName}${formattedApiRoute}OrmAction').middleware(['Api'])\n\n`
                }
              }
            }
          }
          else {
            if (typeof apiRoutes === 'object') {
              for (const apiRoute in apiRoutes) {
                if (Object.prototype.hasOwnProperty.call(apiRoutes, apiRoute)) {
                  const routePath = apiRoutes[apiRoute as keyof typeof apiRoutes]
                  await writeOrmActions(apiRoute, modelName, routePath)
                  if (typeof routePath !== 'string') {
                    throw new TypeError(`Invalid route path for ${apiRoute}`)
                  }
                  const pathAction = `${routePath}.ts`
                  if (apiRoute === 'index')
                    routeString += `route.get('${uri}', '${pathAction}').${middlewareString}\n\n`
                  if (apiRoute === 'show')
                    routeString += `route.get('${uri}/{id}', '${pathAction}').${middlewareString}\n\n`
                  if (apiRoute === 'store')
                    routeString += `route.post('${uri}', '${pathAction}').${middlewareString}\n\n`
                  if (apiRoute === 'update')
                    routeString += `route.patch('${uri}/{id}', '${pathAction}').${middlewareString}\n\n`
                  if (apiRoute === 'destroy')
                    routeString += `route.delete('${uri}/{id}', '${pathAction}').${middlewareString}\n\n`
                }
              }
            }
          }
        }
      }

      if (typeof model.traits.useApi === 'boolean' && model.traits?.useApi) {
        const uri = tableName

        const apiRoutes = ['index', 'show', 'store', 'update', 'destroy']

        for (const apiRoute of apiRoutes) {
          await writeOrmActions(apiRoute as string, modelName)

          const formattedApiRoute = apiRoute.charAt(0).toUpperCase() + apiRoute.slice(1)

          const pathAction = path.builtUserActionsPath(`src/${modelName}${formattedApiRoute}OrmAction.ts`, {
            relative: true,
          })

          if (apiRoute === 'index')
            routeString += `route.get('${uri}', '${pathAction}').middleware(['Api'])\n\n`
          if (apiRoute === 'show')
            routeString += `route.get('${uri}/{id}', '${pathAction}').middleware(['Api'])\n\n`
          if (apiRoute === 'store')
            routeString += `route.post('${uri}', '${pathAction}').middleware(['Api'])\n\n`
          if (apiRoute === 'update')
            routeString += `route.patch('${uri}/{id}', '${pathAction}').middleware(['Api'])\n\n`
          if (apiRoute === 'destroy')
            routeString += `route.delete('${uri}/{id}', '${pathAction}').middleware(['Api'])\n\n`
        }
      }
    }
  }

  writer.write(routeString)
  await writer.end()
}

export async function deleteExistingModels(modelStringFile?: string): Promise<void> {
  const typePath = path.frameworkPath(`orm/src/types.ts`)
  if (fs.existsSync(typePath))
    await fs.promises.unlink(typePath)

  if (modelStringFile) {
    const modelPath = path.frameworkPath(`orm/src/models/${modelStringFile}.ts`)
    if (fs.existsSync(modelPath))
      await fs.promises.unlink(modelPath)

    return
  }

  const modelPaths = globSync([path.frameworkPath(`orm/src/models/*.ts`)], { absolute: true })
  await Promise.all(
    modelPaths.map(async (modelPath) => {
      if (fs.existsSync(modelPath)) {
        log.info(`Deleting Model: ${italic(modelPath)}`)
        await fs.promises.unlink(modelPath)
        log.success(`Deleted Model: ${italic(modelPath)}`)
      }
    }),
  )
}

export async function deleteExistingOrmActions(modelStringFile?: string): Promise<void> {
  if (modelStringFile) {
    const ormPath = path.builtUserActionsPath(`src/${modelStringFile}.ts`)
    if (fs.existsSync(ormPath))
      await fs.promises.unlink(ormPath)

    return
  }

  const ormPaths = globSync([path.builtUserActionsPath('**/*.ts')], { absolute: true })

  for (const ormPath of ormPaths) {
    if (fs.existsSync(ormPath))
      await fs.promises.unlink(ormPath)
  }
}

export async function deleteExistingModelNameTypes(): Promise<void> {
  const typeFile = path.corePath('types/src/model-names.ts')
  if (fs.existsSync(typeFile))
    await fs.promises.unlink(typeFile)
}

export async function deleteExistingModelRequest(modelStringFile?: string): Promise<void> {
  const requestD = path.frameworkPath('types/requests.d.ts')
  if (fs.existsSync(requestD))
    await fs.promises.unlink(requestD)

  if (modelStringFile) {
    const requestFile = path.frameworkPath(`requests/${modelStringFile}.ts`)
    if (fs.existsSync(requestFile))
      await fs.promises.unlink(requestFile)

    return
  }

  const requestFiles = globSync([path.frameworkPath('requests/*.ts')], { absolute: true })
  for (const requestFile of requestFiles) {
    if (fs.existsSync(requestFile))
      await fs.promises.unlink(requestFile)
  }
}

export async function deleteExistingOrmRoute(): Promise<void> {
  const ormRoute = path.frameworkPath('orm/routes.ts')
  if (fs.existsSync(ormRoute))
    await fs.promises.unlink(ormRoute)
}

export async function generateKyselyTypes(): Promise<void> {
  const modelFiles = globSync([path.userModelsPath('*.ts')], { absolute: true })
  const coreModelFiles = globSync([path.storagePath('framework/defaults/models/*.ts')], { absolute: true })

  let text = ``

  for (const modelFile of modelFiles) {
    const model = (await import(modelFile)).default as Model
    const tableName = getTableName(model, modelFile)
    const modelName = getModelName(model, modelFile)
    const words = tableName.split('_')
    const pivotFormatted = `${words.map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('')}`

    text += `import type { ${pivotFormatted}Table } from '../src/models/${modelName}'\n`
  }

  for (const modelFile of coreModelFiles) {
    const model = (await import(modelFile)).default as Model
    const tableName = getTableName(model, modelFile)
    const modelName = getModelName(model, modelFile)
    const words = tableName.split('_')
    const pivotFormatted = `${words.map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('')}`

    text += `import type { ${pivotFormatted}Table } from '../src/models/${modelName}'\n`
  }

  text += `import type { Generated } from 'kysely'\n\n`

  let pivotFormatted = ''
  for (const modelFile of modelFiles) {
    const model = (await import(modelFile)).default as Model
    const modelName = getModelName(model, modelFile)
    const pivotTables = await getPivotTables(model, modelName)

    for (const pivotTable of pivotTables) {
      const words = pivotTable.table.split('_')

      pivotFormatted = `${words.map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('')}Table`

      text += `export interface ${pivotFormatted} {
        id?: number
        ${pivotTable.firstForeignKey}: number
        ${pivotTable.secondForeignKey}: number
      }\n\n`
    }
  }

  text += '\nexport interface MigrationsTable {\n'
  text += 'name: string\n timestamp: string \n }'

  text += '\nexport interface PasskeysTable {\n'
  text += '  id?: number\n'
  text += '  cred_public_key: string\n'
  text += '  user_id: number;\n'
  text += '  webauthn_user_id: string\n'
  text += '  counter: number\n'
  text += '  credential_type: string\n'
  text += '  device_type: string\n'
  text += '  backup_eligible: boolean\n'
  text += '  backup_status: boolean\n'
  text += '  transports?: string\n'
  text += '  created_at?: Date\n'
  text += '  last_used_at: string \n'
  text += '}\n\n'

  text += '\nexport interface Database {\n'

  const pushedTables: string[] = []

  for (const modelFile of modelFiles) {
    const model = (await import(modelFile)).default as Model
    const modelName = getModelName(model, modelFile)
    const tableName = getTableName(model, modelFile)
    const pivotTables = await getPivotTables(model, modelName)

    for (const pivotTable of pivotTables) {
      if (pushedTables.includes(pivotTable.table))
        continue

      text += `  ${pivotTable.table}: ${pivotFormatted}\n`
      pushedTables.push(pivotTable.table)
    }

    const words = tableName.split('_')
    const formattedTableName = `${words.map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('')}Table`

    text += `  ${tableName}: ${formattedTableName}\n`
  }

  for (const coreModelFile of coreModelFiles) {
    const model = (await import(coreModelFile)).default as Model
    const tableName = getTableName(model, coreModelFile)

    const words = tableName.split('_')
    const formattedTableName = `${words.map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('')}Table`

    text += `  ${tableName}: ${formattedTableName}\n`
  }

  text += 'passkeys: PasskeysTable\n'
  text += 'migrations: MigrationsTable\n'

  text += '}'

  const file = Bun.file(path.frameworkPath('orm/src/types.ts'))
  const writer = file.writer()

  writer.write(text)

  await writer.end()
}

export function mapEntity(attribute: ModelElement): string | undefined {
  const entity = attribute.fieldArray?.entity === 'enum' ? 'string[]' : attribute.fieldArray?.entity

  const mapEntity = entity === 'date' ? 'Date | string' : entity

  return mapEntity
}

export async function generateModelFiles(modelStringFile?: string): Promise<void> {
  try {
    log.info('Cleanup of older Models...')
    await deleteExistingModels(modelStringFile)
    log.success('Deleted Models')

    log.info('Deleting old Model Name types...')
    await deleteExistingModelNameTypes()
    log.success('Deleted Model Name types')

    log.info('Deleting old Model Requests...')
    await deleteExistingModelRequest(modelStringFile)
    log.success('Deleted Model Requests')

    log.info('Deleting old Model Routes...')
    await deleteExistingOrmRoute()
    log.success('Deleted Model Routes')

    try {
      log.info('Writing Model Names...')
      await writeModelNames()
      log.success('Wrote Model Names')
    }
    catch (error) {
      log.error(error)
      handleError('Error while writing Model Names', error)
    }

    try {
      log.info('Writing Table Names...')
      await writeTableNames()
      log.success('Wrote Table Names')
    }
    catch (error) {
      handleError('Error while writing Table Names', error)
    }

    try {
      log.info('Writing Model Requests...')
      await writeModelRequest()
      log.success('Wrote Model Requests')
    }
    catch (error) {
      handleError('Error while writing Model Requests', error)
    }

    log.info('Generating API Routes...')
    const modelFiles = globSync([path.userModelsPath('**/*.ts')], { absolute: true })
    const coreModelFiles = globSync([path.storagePath('framework/defaults/models/*.ts')], { absolute: true })
    await generateApiRoutes(modelFiles)
    await generateApiRoutes(coreModelFiles)
    log.success('Generated API Routes')

    await writeModelOrmImports([...modelFiles, ...coreModelFiles])

    for (const modelFile of modelFiles) {
      if (modelStringFile && modelStringFile !== modelFile)
        continue
      log.info(`Processing Model: ${italic(modelFile)}`)

      const model = (await import(modelFile)).default as Model
      const tableName = getTableName(model, modelFile)
      const modelName = getModelName(model, modelFile)
      const file = Bun.file(path.frameworkPath(`orm/src/models/${modelName}.ts`))
      const fields = await extractFields(model, modelFile)
      const classString = await generateModelString(tableName, modelName, model, fields)

      const writer = file.writer()
      log.info(`Writing API Endpoints for: ${italic(modelName)}`)
      writer.write(classString)
      log.success(`Wrote API endpoints for: ${italic(modelName)}`)
      await writer.end()
    }

    for (const coreModelFile of coreModelFiles) {
      if (modelStringFile && modelStringFile !== coreModelFile)
        continue
      log.info(`Processing Model: ${italic(coreModelFile)}`)

      const model = (await import(coreModelFile)).default as Model
      const tableName = getTableName(model, coreModelFile)
      const modelName = getModelName(model, coreModelFile)
      const file = Bun.file(path.frameworkPath(`orm/src/models/${modelName}.ts`))
      const fields = await extractFields(model, coreModelFile)
      const classString = await generateModelString(tableName, modelName, model, fields)

      const writer = file.writer()
      log.info(`Writing API Endpoints for: ${italic(modelName)}`)
      writer.write(classString)
      log.success(`Wrote API endpoints for: ${italic(modelName)}`)
      await writer.end()
    }

    log.info('Generating Query Builder types...')
    await generateKyselyTypes()
    log.success('Generated Query Builder types')

    // we need to lint:fix the auto-generated code, given there is a chance that
    // the codebase has lint issues unrelating to our auto-generated code, we
    // ignore the the console output
    await ensureCodeStyle()
  }
  catch (error) {
    // throw error
    handleError('Error while generating model files', error)
  }
}

async function writeModelOrmImports(modelFiles: string[]): Promise<void> {
  let ormImportString = ``
  for (const modelFile of modelFiles) {
    const model = (await import(modelFile)).default as Model

    const modelName = getModelName(model, modelFile)

    ormImportString += `export { default as ${modelName} } from './${modelName}'\n\n`
  }

  const file = Bun.file(path.frameworkPath(`orm/src/models/index.ts`))
  const writer = file.writer()

  writer.write(ormImportString)

  await writer.end()
}

export async function extractAttributesFromModel(filePath: string): Promise<Attributes> {
  // Read the TypeScript file
  const content = fs.readFileSync(filePath, 'utf8')

  // Parse the file content into an AST
  const ast = parser.parse(content, {
    sourceType: 'module',
    plugins: ['typescript', 'classProperties', 'decorators-legacy'],
  })

  let fields: Attributes | undefined
  traverse(ast, {
    ObjectExpression(path) {
      // Look for the `attributes` key in the object
      const fieldsProperty = path.node.properties.find(
        property =>
          property.type === 'ObjectProperty'
          && property.key.type === 'Identifier'
          && property.key.name === 'attributes',
      )

      if (fieldsProperty && fieldsProperty.type === 'ObjectProperty' && fieldsProperty.value) {
        // Convert the AST back to code (stringify)
        const generated = generator(fieldsProperty.value, {}, content)
        fields = generated.code as unknown as Attributes
        path.stop() // Stop traversing further once we found the fields
      }
    },
  })

  return fields as Attributes
}

async function ensureCodeStyle(): Promise<void> {
  log.info('Linting code style...')
  const proc = Bun.spawn(['bunx', '--bun', 'eslint', '.', '--fix'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: path.projectPath(),
  })

  // Consume stdout without logging
  const stdoutReader = proc.stdout.getReader()
  while (true) {
    const { done } = await stdoutReader.read()
    if (done)
      break
  }

  // Consume stderr without logging
  const stderrReader = proc.stderr.getReader()
  while (true) {
    const { done } = await stderrReader.read()
    if (done)
      break
  }

  const exitCode = await proc.exited

  if (exitCode !== 0) {
    log.debug('There was an error fixing your code style but we are ignoring it because we fixed the auto-generated code already. Run `bunx eslint . --fix` to fix the rest of the code.')
  }
  else {
    log.debug('Code style fixed successfully.')
  }
}
