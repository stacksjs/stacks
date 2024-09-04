import { generator, parser, traverse } from '@stacksjs/build'
import { italic, log } from '@stacksjs/cli'
import { path } from '@stacksjs/path'
import { fs, glob } from '@stacksjs/storage'
import { pascalCase, plural, singular, snakeCase } from '@stacksjs/strings'
import type {
  Attributes,
  FieldArrayElement,
  GeneratorOptions,
  Model,
  ModelElement,
  RelationConfig,
} from '@stacksjs/types'
import { ExitCode } from '@stacksjs/types'
import { isString } from '@stacksjs/validation'

type ModelPath = string

export async function modelTableName(model: Model | ModelPath): Promise<string> {
  if (typeof model === 'string') {
    model = (await import(model)).default as Model
  }

  return model.table ?? snakeCase(plural(model?.name || ''))
}

export function getModelName(model: Model, modelPath: string): string {
  if (model.name) return model.name

  const baseName = path.basename(modelPath)

  return baseName.replace(/\.ts$/, '')
}

export function getTableName(model: Model, modelPath: string): string {
  if (model.table) return model.table

  return snakeCase(plural(getModelName(model, modelPath)))
}

export async function extractAttributesFromModel(filePath: string) {
  // Read the TypeScript file
  const content = fs.readFileSync(filePath, 'utf8')

  // Parse the file content into an AST
  const ast = parser.parse(content, {
    sourceType: 'module',
    plugins: ['typescript', 'classProperties', 'decorators-legacy'],
  })

  let fields: Attributes | undefined

  // Traverse the AST to find the `fields` object
  traverse(ast, {
    ObjectExpression(path) {
      // Look for the `fields` key in the object
      const fieldsProperty = path.node.properties.find((property) => property.key?.name === 'attributes')

      if (fieldsProperty?.value) {
        // Convert the AST back to code (stringify)
        const generated = generator(fieldsProperty.value, {}, content)
        fields = generated.code
        path.stop() // Stop traversing further once we found the fields
      }
    },
  })

  return fields
}

export function userModels() {
  return import.meta.glob<{ default: Model }>(path.userModelsPath('*.ts'))
}

export function getPivotTableName(formattedModelName: string, modelRelationTable: string): string {
  // Create an array of the model names
  const models = [formattedModelName, modelRelationTable]

  // Sort the array alphabetically
  models.sort()

  models[0] = singular(models[0] || '')

  // Join the sorted array with an underscore
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
      for (const relationInstance of (model[relation as keyof Model] as any[]) || []) {
        let relationModel = relationInstance.model

        if (isString(relationInstance)) {
          relationModel = relationInstance
        }

        const modelRelationPath = path.userModelsPath(`${relationModel}.ts`)
        const modelRelation = (await import(modelRelationPath)).default as Model
        const modelRelationTable = getTableName(modelRelation, modelRelationPath)
        const formattedModelName = modelName.toLowerCase()

        relationships.push({
          relationship: relation,
          model: relationModel,
          table: modelRelationTable,
          foreignKey: relationInstance.foreignKey || `${formattedModelName}_id`,
          relationName: relationInstance.relationName || '',
          throughModel: relationInstance.through || '',
          throughForeignKey: relationInstance.throughForeignKey || '',
          pivotTable:
            relationInstance?.pivotTable ||
            getPivotTableName(plural(formattedModelName), plural(modelRelation.table || '')),
        })
      }
    }
  }

  return relationships
}

export function getRelationType(relation: string): string {
  const belongToType = /belongs/
  const hasType = /has/
  const throughType = /Through/

  if (throughType.test(relation)) return 'throughType'

  if (belongToType.test(relation)) return 'belongsType'

  if (hasType.test(relation)) return 'hasType'

  return ''
}

export function getRelationCount(relation: string): string {
  const singular = /One/
  const plural = /Many/

  if (plural.test(relation)) return 'many'

  if (singular.test(relation)) return 'one'

  return ''
}

export async function getPivotTables(
  model: Model,
  modelName: string,
): Promise<{ table: string; firstForeignKey?: string; secondForeignKey?: string }[]> {
  const pivotTable = []

  if ('belongsToMany' in model) {
    const belongsToManyArr = model.belongsToMany || []
    for (const belongsToManyRelation of belongsToManyArr) {
      const modelRelationPath = path.userModelsPath(`${belongsToManyRelation}.ts`)
      const modelRelation = (await import(modelRelationPath)).default as Model
      const formattedModelName = modelName.toLowerCase()

      const firstForeignKey =
        typeof belongsToManyRelation === 'object' && 'firstForeignKey' in belongsToManyRelation
          ? belongsToManyRelation.firstForeignKey
          : `${modelName.toLowerCase()}_${model.primaryKey}`

      const secondForeignKey =
        typeof belongsToManyRelation === 'object' && 'secondForeignKey' in belongsToManyRelation
          ? belongsToManyRelation.secondForeignKey
          : `${modelRelation.name?.toLowerCase()}_${model.primaryKey}`

      pivotTable.push({
        table:
          (typeof belongsToManyRelation === 'object' && 'pivotTable' in belongsToManyRelation
            ? belongsToManyRelation.pivotTable
            : undefined) ?? `${formattedModelName}_${modelRelation.table}`,
        firstForeignKey,
        secondForeignKey,
      })
    }

    return pivotTable
  }

  return []
}

export async function fetchOtherModelRelations(model: Model, modelName?: string): Promise<RelationConfig[]> {
  const modelFiles = glob.sync(path.userModelsPath('*.ts'))
  const modelRelations = []

  for (let i = 0; i < modelFiles.length; i++) {
    const modelFileElement = modelFiles[i] as string
    const modelFile = await import(modelFileElement)

    if (modelName === modelFile.default.name) continue

    const otherModelName = getModelName(modelFile, modelFileElement)
    const relations = await getRelations(modelFile.default, otherModelName)

    if (!relations.length) continue

    const relation = relations.find((relation) => relation.model === modelName)

    if (relation) modelRelations.push(relation)
  }

  return modelRelations
}

export function getHiddenAttributes(attributes: Attributes | undefined): string[] {
  if (attributes === undefined) return []

  return Object.keys(attributes).filter((key) => {
    if (attributes === undefined) return false

    return attributes[key]?.hidden === true
  })
}

export function getFillableAttributes(attributes: Attributes | undefined): string[] {
  if (attributes === undefined) return []

  return Object.keys(attributes)
    .filter((key) => {
      if (attributes === undefined) return false

      return attributes[key]?.fillable === true
    })
    .map((attribute) => snakeCase(attribute))
}

export async function writeModelNames() {
  const modelFiles = glob.sync(path.userModelsPath('*.ts'))
  let fileString = `export type ModelNames = `

  for (let i = 0; i < modelFiles.length; i++) {
    const modeFileElement = modelFiles[i] as string
    const model = (await import(modeFileElement)).default as Model
    const modelName = getModelName(model, modeFileElement)
    const typeFile = Bun.file(path.corePath(`types/src/model-names.ts`))

    fileString += `'${modelName}'`

    if (i < modelFiles.length - 1) {
      fileString += ' | '
    }

    const writer = typeFile.writer()

    writer.write(fileString)
  }
}

export async function writeModelRequest() {
  const modelFiles = glob.sync(path.userModelsPath('*.ts'))
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

  for (let i = 0; i < modelFiles.length; i++) {
    let fieldStringType = ``
    let fieldString = ``
    let fieldStringInt = ``
    let fileString = `import { Request } from '@stacksjs/router'\nimport type { VineType } from '@stacksjs/types'\nimport { validateField } from '@stacksjs/validation'\nimport { customValidate } from '@stacksjs/validation'\n\n`

    const modeFileElement = modelFiles[i] as string
    const model = (await import(modeFileElement)).default as Model
    const modelName = getModelName(model, modeFileElement)
    const useTimestamps = model?.traits?.useTimestamps ?? model?.traits?.timestampable ?? true
    const useSoftDeletes = model?.traits?.useSoftDeletes ?? model?.traits?.softDeletable ?? false
    const attributes = await extractFields(model, modeFileElement)

    fieldString += ` id?: number\n`
    fieldStringInt += `public id = 1\n`

    let keyCounter = 0
    let keyCounterForeign = 0
    fieldStringType += ` get(key: 'id'): number\n`

    const entityGroups: Record<string, string[]> = {}

    // Group attributes by their entity type
    for (const attribute of attributes) {
      const entity = attribute.fieldArray?.entity === 'enum' ? 'string[]' : attribute.fieldArray?.entity
      let defaultValue: any = `''`

      if (attribute.fieldArray?.entity === 'boolean') defaultValue = false
      if (attribute.fieldArray?.entity === 'number') defaultValue = 0

      // Convert the field name to snake_case
      const snakeField = snakeCase(attribute.field)

      if (typeof entity === 'string') {
        if (entityGroups[entity]) {
          entityGroups[entity].push(`'${snakeField}'`)
        } else {
          entityGroups[entity] = [`'${snakeField}'`]
        }

        fieldString += ` ${snakeCase(attribute.field)}: ${entity}\n     `
        fieldStringInt += `public ${snakeField} = ${defaultValue}\n`
        keyCounter++
      }
    }

    // Generate fieldStringType with grouped fields
    for (const [entity, fields] of Object.entries(entityGroups)) {
      const concatenatedFields = fields.join(' | ')
      fieldStringType += ` get(key: ${concatenatedFields}): ${entity}\n`
    }

    const otherModelRelations = await fetchOtherModelRelations(model, modelName)
    for (const otherModel of otherModelRelations) {
      fieldString += ` ${otherModel.foreignKey}: number\n     `
      fieldStringType += ` get(key: '${otherModel.foreignKey}'): string \n`
      fieldStringInt += `public ${otherModel.foreignKey} = 0\n`
      keyCounterForeign++
    }

    if (useTimestamps) {
      fieldStringInt += `public created_at = ''
        public updated_at = ''
      `
    }

    if (useSoftDeletes) {
      fieldStringInt += `
        public deleted_at = ''
      `
    }

    fieldString += `created_at?: string
      updated_at?: string
      deleted_at?: string`

    const requestFile = Bun.file(path.frameworkPath(`requests/${modelName}Request.ts`))

    importTypes = `${modelName}RequestType`
    importTypesString += `${importTypes}`

    if (i < modelFiles.length - 1) importTypesString += ` | `

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

    export const request = new ${modelName}Request()
    `

    const writer = requestFile.writer()

    writer.write(fileString)
  }

  typeString += `export type ModelRequest = ${importTypesString}`

  const requestWrite = requestD.writer()

  requestWrite.write(typeString)
}

export async function writeOrmActions(apiRoute: string, modelName: String, actionPath?: string): Promise<void> {
  const formattedApiRoute = apiRoute.charAt(0).toUpperCase() + apiRoute.slice(1)

  let method = 'GET'
  let actionString = `import { Action } from '@stacksjs/actions'\n`
  actionString += `import ${modelName} from '../../orm/src/models/${modelName}'\n`
  let handleString = ``
  actionString += `  import type { ${modelName}RequestType } from '../../types/requests'\n\n`

  if (apiRoute === 'index') {
    handleString += `async handle(request: ${modelName}RequestType) {
        return await ${modelName}.all()
      },`

    method = 'GET'
  }

  if (apiRoute === 'show') {
    handleString += `async handle(request: ${modelName}RequestType) {
        const id = await request.getParam('id')

        return await ${modelName}.findOrFail(Number(id))
      },`

    method = 'GET'
  }

  if (apiRoute === 'destroy') {
    handleString += `async handle(request: ${modelName}RequestType) {
        const id = request.getParam('id')

        const model = await ${modelName}.findOrFail(Number(id))

        model.delete()

        return 'Model deleted!'
      },`

    method = 'DELETE'
  }

  if (apiRoute === 'store') {
    handleString += `async handle(request: ${modelName}RequestType) {
        await request.validate()
        const model = await ${modelName}.create(request.all())

        return model
      },`

    method = 'POST'
  }

  if (apiRoute === 'update') {
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

  if (fs.existsSync(actionFile)) return

  const file = Bun.file(actionFile)

  const writer = file.writer()

  writer.write(actionString)
}

export async function extractFields(model: Model, modelFile: string): Promise<ModelElement[]> {
  // TODO: we can improve this type
  let fields: Record<string, any> | undefined = model.attributes

  if (!fields) fields = {}

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

  if (parts.length !== 2) return null
  if (!parts[1]) parts[1] = ''

  const extractedString = parts[1].replace(/,/g, '')

  if (!extractedString) return null

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

export async function generateApiRoutes(modelFiles: string[]) {
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
          } else {
            if (typeof apiRoutes === 'object') {
              for (const apiRoute in apiRoutes) {
                if (Object.prototype.hasOwnProperty.call(apiRoutes, apiRoute)) {
                  const routePath = apiRoutes[apiRoute as keyof typeof apiRoutes]
                  await writeOrmActions(apiRoute, modelName, routePath)
                  if (typeof routePath !== 'string') {
                    throw new Error(`Invalid route path for ${apiRoute}`)
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

          if (apiRoute === 'index') routeString += `route.get('${uri}', '${pathAction}').middleware(['Api'])\n\n`
          if (apiRoute === 'show') routeString += `route.get('${uri}/{id}', '${pathAction}').middleware(['Api'])\n\n`
          if (apiRoute === 'store') routeString += `route.post('${uri}', '${pathAction}').middleware(['Api'])\n\n`
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

export async function deleteExistingModels(modelStringFile?: string) {
  const typePath = path.frameworkPath(`orm/src/types.ts`)
  if (fs.existsSync(typePath)) await fs.promises.unlink(typePath)

  if (modelStringFile) {
    const modelPath = path.frameworkPath(`orm/src/models/${modelStringFile}.ts`)
    if (fs.existsSync(modelPath)) await fs.promises.unlink(modelPath)

    return
  }

  const modelPaths = glob.sync(path.frameworkPath(`orm/src/models/*.ts`)).sort() // handle them alphabetically
  await Promise.all(
    modelPaths.map(async (modelPath) => {
      if (fs.existsSync(modelPath)) {
        log.info(`Deleting Model: ${italic(modelPath)}`)
        await fs.promises.unlink(modelPath)
        log.success(`Deleted Model: ${italic(modelPath)}`)
      }
    }),
  )

  return
}

export async function deleteExistingOrmActions(modelStringFile?: string) {
  if (modelStringFile) {
    const ormPath = path.builtUserActionsPath(`src/${modelStringFile}.ts`)
    if (fs.existsSync(ormPath)) await fs.promises.unlink(ormPath)

    return
  }

  const ormPaths = glob.sync(path.builtUserActionsPath(`**/*.ts`))

  for (const ormPath of ormPaths) {
    if (fs.existsSync(ormPath)) await fs.promises.unlink(ormPath)
  }
}

export async function deleteExistingModelNameTypes() {
  const typeFile = path.corePath(`types/src/model-names.ts`)
  if (fs.existsSync(typeFile)) await fs.promises.unlink(typeFile)
}

export async function deleteExistingModelRequest(modelStringFile?: string) {
  const requestD = path.frameworkPath('types/requests.d.ts')
  if (fs.existsSync(requestD)) await fs.promises.unlink(requestD)

  if (modelStringFile) {
    const requestFile = path.frameworkPath(`requests/${modelStringFile}.ts`)
    if (fs.existsSync(requestFile)) await fs.promises.unlink(requestFile)

    return
  }

  const requestFiles = glob.sync(path.frameworkPath(`requests/*.ts`))
  for (const requestFile of requestFiles) {
    if (fs.existsSync(requestFile)) await fs.promises.unlink(requestFile)
  }
}

export async function deleteExistingOrmRoute() {
  const ormRoute = path.frameworkPath('orm/routes.ts')
  if (fs.existsSync(ormRoute)) await fs.promises.unlink(ormRoute)
}

export async function generateKyselyTypes() {
  const modelFiles = glob.sync(path.userModelsPath('*.ts'))
  let text = ``

  for (const modelFile of modelFiles) {
    const model = (await import(modelFile)).default as Model
    const tableName = getTableName(model, modelFile)
    const modelName = getModelName(model, modelFile)
    const words = tableName.split('_')
    const pivotFormatted = `${words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join('')}`

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
    const tableName = getTableName(model, modelFile)
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

export async function generateModelString(
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
      mittDeleteStatement += `dispatch('${formattedModelName}:deleted', model)`
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
      created_at: Date\n
      updated_at: Date
    `
  }

  if (useSoftDeletes) {
    fieldString += `
      deleted_at: Date
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
      async find(id: number): Promise<${modelName}Model | undefined> {
        let query = db.selectFrom('${tableName}').where('id', '=', id).selectAll()

        const model = await query.executeTakeFirst()

        if (!model)
          return undefined

        return this.parseResult(new ${modelName}Model(model))
      }

      // Method to find a ${modelName} by ID
      static async find(id: number): Promise<${modelName}Model | undefined> {
        let query = db.selectFrom('${tableName}').where('id', '=', id).selectAll()

        const instance = new this(null)

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
          if (${tableName}WithExtra.length > (options.limit ?? 10)) nextCursor = ${tableName}WithExtra.pop()?.id ?? null

        return {
          data: ${tableName}WithExtra,
          paging: {
            total_records: totalRecords,
            page: options.page || 1,
            total_pages: totalPages,
          },
          next_cursor: nextCursor,
        }
      }

      // Method to create a new ${formattedModelName}
      static async create(new${modelName}: New${modelName}): Promise<${modelName}Model | undefined> {
        const instance = new this(null)

         const filteredValues = Object.fromEntries(
          Object.entries(newUser).filter(([key]) => instance.fillable.includes(key)),
        ) as New${modelName}

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

        parseResult(model: UserModel): UserModel {
          for (const hiddenAttribute of this.hidden) {
            delete model[hiddenAttribute as keyof UserModel]
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

export async function generateModelFiles(modelStringFile?: string, options?: GeneratorOptions): Promise<void> {
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

    log.info('Writing Model Names...')
    await writeModelNames()
    log.success('Wrote Model Names')

    log.info('Writing Model Requests...')
    await writeModelRequest()
    log.success('Wrote Model Requests')

    log.info('Generating API Routes...')
    const modelFiles = glob.sync(path.userModelsPath('**/*.ts'))
    await generateApiRoutes(modelFiles)
    log.success('Generated API Routes')

    for (const modelFile of modelFiles) {
      if (modelStringFile && modelStringFile !== modelFile) continue
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

    log.info('Generating Query Builder types...')
    await generateKyselyTypes()
    log.success('Generated Query Builder types')

    log.info('Ensuring Code Style...')
    try {
      // we run this in background in background, because we simply need to lint:fix the auto-generated code
      // the reason we run it in background is because we don't care whether it fails or not, given there
      // is a chance that the codebase has lint issues unrelating to our auto-generated code
      const process = Bun.spawn(['bunx', 'biome', 'check', '--fix'], {
        stdio: ['pipe', 'pipe', 'pipe'],
      })

      const reader = process.stdout.getReader()
      let output = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        output += new TextDecoder().decode(value)
      }

      const stderrReader = process.stderr.getReader()
      while (true) {
        const { done, value } = await stderrReader.read()
        if (done) break
        // Collect stderr output but do not log it
        output += new TextDecoder().decode(value)
      }

      const exitCode = await process.exited

      if (exitCode !== 0) {
        log.debug(
          'There was an error fixing your code style but we are ignoring it because we fixed the auto-generated code already.',
        )
      } else {
        log.success('Code style fixed successfully.')
      }
    } catch (error) {
      log.error('There was an error fixing your code style.')
      process.exit(ExitCode.FatalError)
    }

    log.success('Linted')
  } catch (error) {
    log.error('There was an error generating your model files', error)
    process.exit(ExitCode.FatalError)
  }
}
