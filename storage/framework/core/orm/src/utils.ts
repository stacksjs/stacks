import type { Validator } from '@stacksjs/ts-validation'
import type {
  Attribute,
  AttributesElements,
  BaseBelongsToMany,
  BaseHasOneThrough,
  FieldArrayElement,
  Model,
  ModelElement,
  ModelNames,
  MorphOne,
  Relation,
  RelationConfig,
  TableNames,
} from '@stacksjs/types'
import { generator, parser, traverse } from '@stacksjs/build'
import { italic, log } from '@stacksjs/cli'
import { getTraitTables } from '@stacksjs/database'
import { handleError } from '@stacksjs/error-handling'
import { path } from '@stacksjs/path'
import { fs } from '@stacksjs/storage'
import { camelCase, kebabCase, pascalCase, plural, singular, slugify, snakeCase } from '@stacksjs/strings'
import { isString } from '@stacksjs/validation'
import { globSync } from 'tinyglobby'
import { generateModelString } from './generate'
import { generateTraitRequestTypes, generateTraitTableInterfaces, traitInterfaces } from './generated/table-traits'

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

export function getTableName(model: Model, modelPath: string): TableNames {
  if (model.table)
    return model.table as TableNames

  return snakeCase(plural(getModelName(model, modelPath))) as TableNames
}

export function getPivotTableName(formattedModelName: string, modelRelationTable: string): string {
  const tables = [formattedModelName, modelRelationTable]
  tables.sort()
  return tables.join('_')
}

export function hasRelations(obj: any, key: string): boolean {
  return key in obj
}

export async function getRelations(model: Model, modelName: string): Promise<RelationConfig[]> {
  const relationships = []

  if (model.hasOne) {
    for (const relationInstance of model.hasOne) {
      relationships.push(await processHasOneAndMany(relationInstance, model, modelName, 'hasOne'))
    }
  }

  if (model.hasMany) {
    for (const relationInstance of model.hasMany) {
      relationships.push(await processHasOneAndMany(relationInstance, model, modelName, 'hasMany'))
    }
  }

  if (model.belongsTo) {
    for (const relationInstance of model.belongsTo) {
      relationships.push(await processHasOneAndMany(relationInstance, model, modelName, 'belongsTo'))
    }
  }

  if (model.hasOneThrough) {
    for (const relationInstance of model.hasOneThrough) {
      relationships.push(await processHasThrough(relationInstance, model, modelName, 'hasOneThrough'))
    }
  }

  if (model.belongsToMany) {
    for (const relationInstance of model.belongsToMany) {
      relationships.push(await processBelongsToMany(relationInstance, model, modelName, 'belongsToMany'))
    }
  }

  if (model.morphOne) {
    relationships.push(await processMorphOne(model.morphOne, model, modelName, 'belongsToMany'))
  }

  return relationships
}

async function loadModels(modelName: string, relationModel: string): Promise<{ modelRelation: Model, modelPath: string, modelRelationPath: string }> {
  const modelRelationPath = findUserModel(`${relationModel}.ts`)
  const userModelPath = findUserModel(`${modelName}.ts`)
  const coreModelPath = findCoreModel(`${modelName}.ts`)
  const coreModelRelationPath = findCoreModel(`${relationModel}.ts`)

  // Check if any model paths exist
  if (!modelRelationPath && !coreModelRelationPath)
    throw new Error(`Model not found: ${relationModel}`)

  if (!userModelPath && !coreModelPath)
    throw new Error(`Model not found: ${modelName}`)

  let modelRelation: Model
  try {
    if (fs.existsSync(modelRelationPath))
      modelRelation = (await import(modelRelationPath)).default as Model
    else
      modelRelation = (await import(coreModelRelationPath)).default as Model
  }
  catch (error: any) {
    throw new Error(`Failed to load model: ${relationModel}. Error: ${error?.message || 'Unknown error'}`)
  }

  const modelPath = fs.existsSync(userModelPath) ? userModelPath : coreModelPath

  return {
    modelRelation,
    modelPath,
    modelRelationPath: fs.existsSync(modelRelationPath) ? modelRelationPath : coreModelRelationPath,
  }
}

async function processHasThrough(relationInstance: ModelNames | BaseHasOneThrough<ModelNames>, model: Model, modelName: string, relation: string) {
  let relationModel = ''
  let relationName = ''
  let throughModel = ''
  let throughForeignKey = ''

  if (isString(relationInstance)) {
    relationModel = relationInstance
  }
  else {
    relationModel = relationInstance.model
    relationName = relationInstance.relationName || ''
    throughModel = relationInstance.through
    throughForeignKey = relationInstance.throughForeignKey || ''
  }

  const { modelRelation, modelPath, modelRelationPath } = await loadModels(modelName, relationModel)

  const modelRelationTable = getTableName(modelRelation, modelRelationPath)
  const table = getTableName(model, modelPath)
  const modelRelationName = snakeCase(getModelName(modelRelation, modelRelationPath))
  const formattedModelName = snakeCase(modelName)

  const relationshipData: RelationConfig = {
    relationship: relation,
    model: relationModel,
    table: modelRelationTable as TableNames,
    relationTable: table as TableNames,
    foreignKey: `${formattedModelName}_id`,
    modelKey: `${modelRelationName}_id`,
    relationName,
    relationModel: modelName,
    throughModel,
    throughForeignKey,
    pivotForeign: `${formattedModelName}_id`,
    pivotKey: `${modelRelationName}_id`,
    pivotTable: table as TableNames,
  }

  return relationshipData
}

async function processBelongsToMany(relationInstance: ModelNames | BaseBelongsToMany<ModelNames>, model: Model, modelName: string, relation: string) {
  let relationModel = ''
  let pivotTable = ''
  let pivotForeign = ''

  const formattedModelName = snakeCase(modelName)

  if (isString(relationInstance)) {
    relationModel = relationInstance
  }
  else {
    relationModel = relationInstance.model
    pivotTable = relationInstance.pivotTable || ''
    pivotForeign = relationInstance.firstForeignKey || `${formattedModelName}_id`
  }

  const { modelRelation, modelPath, modelRelationPath } = await loadModels(modelName, relationModel)

  const modelRelationTable = getTableName(modelRelation, modelRelationPath)
  const table = getTableName(model, modelPath)
  const modelRelationName = snakeCase(getModelName(modelRelation, modelRelationPath))

  const relationshipData: RelationConfig = {
    relationship: relation,
    model: relationModel,
    table: modelRelationTable as TableNames,
    relationTable: table as TableNames,
    foreignKey: typeof relationInstance === 'string' ? `${formattedModelName}_id` : relationInstance.firstForeignKey || `${formattedModelName}_id`,
    modelKey: typeof relationInstance === 'string' ? `${modelRelationName}_id` : relationInstance.secondForeignKey || `${modelRelationName}_id`,
    relationName: '',
    relationModel: modelName,
    throughModel: '',
    throughForeignKey: '',
    pivotForeign,
    pivotKey: `${modelRelationName}_id`,
    pivotTable: pivotTable as TableNames,
  }

  return relationshipData
}

async function processMorphOne(relationInstance: ModelNames | MorphOne<ModelNames>, model: Model, modelName: string, relation: string): Promise<RelationConfig> {
  let relationModel = ''
  let morphName = ''
  let typeColumn = ''
  let idColumn = ''

  if (isString(relationInstance)) {
    relationModel = relationInstance
    morphName = `${snakeCase(modelName)}able`
  }
  else {
    relationModel = relationInstance.model
    morphName = relationInstance.morphName || `${snakeCase(modelName)}able`
    typeColumn = relationInstance.type || `${morphName}_type`
    idColumn = relationInstance.id || `${morphName}_id`
  }

  const { modelRelation, modelPath, modelRelationPath } = await loadModels(modelName, relationModel)

  const modelRelationTable = getTableName(modelRelation, modelRelationPath)
  const table = getTableName(model, modelPath)

  const relationshipData: RelationConfig = {
    relationship: relation,
    model: relationModel,
    table: modelRelationTable as TableNames,
    relationTable: table as TableNames,
    foreignKey: idColumn || `${morphName}_id`,
    modelKey: typeColumn || `${morphName}_type`,
    relationName: morphName,
    relationModel: modelName,
    throughModel: '',
    throughForeignKey: '',
    pivotForeign: '',
    pivotKey: '',
    pivotTable: table as TableNames,
  }

  return relationshipData
}

async function processHasOneAndMany(relationInstance: ModelNames | Relation<ModelNames>, model: Model, modelName: string, relation: string) {
  let relationModel = ''
  let relationName = ''

  if (isString(relationInstance)) {
    relationModel = relationInstance
  }
  else {
    relationModel = relationInstance.model
    relationName = relationInstance.relationName || ''
  }

  const { modelRelation, modelPath, modelRelationPath } = await loadModels(modelName, relationModel)

  const modelRelationTable = getTableName(modelRelation, modelRelationPath)
  const table = getTableName(model, modelPath)
  const modelRelationName = snakeCase(getModelName(modelRelation, modelRelationPath))
  const formattedModelName = snakeCase(modelName)

  const relationshipData: RelationConfig = {
    relationship: relation,
    model: relationModel,
    table: modelRelationTable as TableNames,
    relationTable: table as TableNames,
    foreignKey: typeof relationInstance === 'string' ? `${formattedModelName}_id` : relationInstance.foreignKey || `${formattedModelName}_id`,
    modelKey: `${modelRelationName}_id`,
    relationName,
    relationModel: modelName,
    throughModel: '',
    throughForeignKey: '',
    pivotForeign: `${formattedModelName}_id`,
    pivotKey: `${modelRelationName}_id`,
    pivotTable: table as TableNames,
  }

  if (relation === 'belongsTo')
    relationshipData.foreignKey = ''

  return relationshipData
}

export function getRelationType(relation: string): string {
  const belongToType = /belongs/
  const hasType = /has/
  const throughType = /Through/
  const morphType = /morph/

  if (throughType.test(relation))
    return 'throughType'

  if (belongToType.test(relation))
    return 'belongsType'

  if (hasType.test(relation))
    return 'hasType'

  if (morphType.test(relation))
    return 'morphType'

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
      let modelRelation: Model
      let relationModelName: string

      if (typeof belongsToManyRelation === 'string') {
        relationModelName = belongsToManyRelation
      }
      else {
        relationModelName = belongsToManyRelation.model
      }

      const modelRelationPath = findUserModel(`${relationModelName}.ts`)
      const coreModelRelationPath = findCoreModel(`${relationModelName}.ts`)

      if (fs.existsSync(modelRelationPath))
        modelRelation = (await import(modelRelationPath)).default as Model
      else
        modelRelation = (await import(coreModelRelationPath)).default as Model

      const modelRelationTableName = getTableName(modelRelation, modelRelationPath)
      const tableName = getTableName(model, modelPath)

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
            : undefined) ?? getPivotTableName(tableName, modelRelationTableName),
        firstForeignKey,
        secondForeignKey,
      })
    }

    return pivotTable
  }

  return []
}

export async function fetchOtherModelRelations(modelName?: string): Promise<RelationConfig[]> {
  const modelFiles = globSync([path.userModelsPath('*.ts'), path.storagePath('framework/defaults/models/**/*.ts')], { absolute: true })

  const modelRelations = []

  for (let i = 0; i < modelFiles.length; i++) {
    const modelFileElement = modelFiles[i] as string

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

export function getHiddenAttributes(attributes: AttributesElements | undefined): string[] {
  if (attributes === undefined)
    return []

  return Object.keys(attributes).filter((key) => {
    if (attributes === undefined)
      return false

    return attributes[key]?.hidden === true
  })
}

export function getGuardedAttributes(model: Model): string[] {
  const attributes = model.attributes

  if (attributes === undefined)
    return []

  return Object.keys(attributes)
    .filter((key) => {
      if (attributes === undefined)
        return false

      return attributes[key]?.guarded === true
    })
    .map(attribute => snakeCase(attribute))
}

export function getFillableAttributes(model: Model, otherModelRelations: RelationConfig[]): string[] {
  const attributes = model.attributes

  const additionalCols = []

  if (attributes === undefined)
    return []

  const useBillable = typeof model.traits?.billable === 'object' || typeof model.traits?.billable === 'boolean'
  const usePasskey = typeof model.traits?.useAuth === 'object' ? model.traits?.useAuth.usePasskey : false
  const useUuid = model.traits?.useUuid || false

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
  const models = globSync([path.userModelsPath('**/*.ts'), path.storagePath('framework/defaults/models/**/*.ts')], { absolute: true })
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

  // Ensure the directory exists
  const typesDir = path.dirname(path.typesPath(`src/model-names.ts`))
  await fs.promises.mkdir(typesDir, { recursive: true })

  // Write to the file
  const typeFilePath = path.typesPath(`src/model-names.ts`)
  await fs.promises.writeFile(typeFilePath, fileString, 'utf8')
}

export async function writeTableNames(): Promise<void> {
  const models = globSync([path.userModelsPath('**/*.ts'), path.storagePath('framework/defaults/models/**/*.ts')], { absolute: true })
  const traitTables = getTraitTables()

  let fileString = `export type TableNames = `

  // Add trait tables first, only once
  for (const trait of traitTables) {
    fileString += `'${trait}' | `
  }

  for (let i = 0; i < models.length; i++) {
    const modelPath = models[i] as string
    const model = (await import(modelPath)).default as Model
    const tableName = getTableName(model, modelPath)

    const pivotTables = await getPivotTables(model, modelPath)

    for (const pivot of pivotTables) {
      fileString += `'${pivot.table}' | `
    }

    fileString += `'${tableName}'`

    if (i < models.length - 1) {
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

export async function writeModelAttributes(): Promise<void> {
  const modelFiles = globSync([path.userModelsPath('**/*.ts'), path.storagePath('framework/defaults/models/**/*.ts')], { absolute: true })
  let fieldString = `export interface Attributes { \n`
  const attributesTypeFile = path.frameworkPath('types/attributes.ts')

  const processedFields = new Set<string>()

  for (let i = 0; i < modelFiles.length; i++) {
    const modelPath = modelFiles[i] as string
    const model = (await import(modelPath)).default as Model
    const modeFileElement = modelFiles[i] as string

    const attributes = await extractFields(model, modeFileElement)

    for (const attribute of attributes) {
      const fieldName = snakeCase(attribute.field)

      // Skip if field already exists
      if (processedFields.has(fieldName)) {
        continue
      }

      const entity = mapEntity(attribute)

      fieldString += ` ${fieldName}: ${entity}\n     `

      // Add to processed fields
      processedFields.add(fieldName)
    }
  }

  fieldString += '} \n'

  await fs.writeFile(attributesTypeFile, fieldString)
}

export async function writeModelEvents(): Promise<void> {
  const modelFiles = globSync([path.userModelsPath('**/*.ts'), path.storagePath('framework/defaults/models/**/*.ts')], { absolute: true })
  let eventString = ``
  let observerString = ``
  let observerImports = ``
  const attributesTypeFile = Bun.file(path.frameworkPath('types/events.ts'))

  for (let i = 0; i < modelFiles.length; i++) {
    const modelPath = modelFiles[i] as string
    const model = (await import(modelPath)).default as Model

    const modelName = getModelName(model, modelPath)

    const formattedModelName = slugify(modelName)

    const observer = model?.traits?.observe

    if (typeof observer === 'boolean') {
      if (observer) {
        observerString += `'${kebabCase(formattedModelName)}:created': ${modelName}Model\n`
        observerString += `'${kebabCase(formattedModelName)}:updated': ${modelName}Model\n`
        observerString += `'${kebabCase(formattedModelName)}:deleted': ${modelName}Model\n`

        observerImports += `import type { ${modelName}Model } from '../orm/src/models/${modelName}'\n`
      }
    }
  }

  eventString += `
  ${observerImports} \n\n

  export interface ModelEvents {\n 
    ${observerString}
  }`

  const writer = attributesTypeFile.writer()

  writer.write(eventString)
}

export async function writeModelRequest(): Promise<void> {
  const modelFiles = globSync([path.userModelsPath('**/*.ts'), path.storagePath('framework/defaults/models/**/*.ts')], { absolute: true })

  let importTypes = ``
  let importTypesString = ``
  let typeString = `import { Request } from '../core/router/src/request'\nimport type { VineType, CustomAttributes } from '@stacksjs/types'\n\n`

  // Generate trait request files
  for (const trait of traitInterfaces) {
    let fieldString = ''
    let fieldStringInt = ''
    let fileString = `import { Request } from '@stacksjs/router'\nimport { validateField, customValidate, type schema } from '@stacksjs/validation'\n`

    // Add fields to the interface
    for (const [field, type] of Object.entries(trait.fields)) {
      fieldString += ` ${field}: ${type}\n     `
      let defaultValue = `''`

      if (type === 'boolean')
        defaultValue = 'false'
      if (type === 'number')
        defaultValue = '0'
      if (type === 'number | null')
        defaultValue = 'null'
      if (type === 'string | null')
        defaultValue = 'null'

      fieldStringInt += `public ${field} = ${defaultValue}\n`
    }

    const fieldStringType = `get: <T = string>(element: string, defaultValue?: T) => T`

    const requestFile = Bun.file(path.frameworkPath(`requests/${trait.name}Request.ts`))

    importTypes = `${trait.name}RequestType`
    importTypesString += `${importTypes}`

    if (trait !== traitInterfaces[traitInterfaces.length - 1])
      importTypesString += ` | `

    fileString += `import type { ${importTypes} } from '../types/requests'\n\n`
    fileString += `interface ValidationField {
      rule: ReturnType<typeof schema.string>
      message: Record<string, string>
    }\n\n`
    fileString += `interface CustomAttributes {
      [key: string]: ValidationField
    }\n`

    const types = `export interface ${trait.name}RequestType extends Request {
      validate(attributes?: CustomAttributes): Promise<void>
      ${fieldStringType}
      all(): RequestData${trait.name}
      ${fieldString}
    }\n\n`

    typeString += `interface RequestData${trait.name} {
      ${fieldString}
    }\n`

    fileString += `interface RequestData${trait.name} {
      ${fieldString}
    }\n`

    typeString += types

    fileString += `export class ${trait.name}Request extends Request<RequestData${trait.name}> implements ${trait.name}RequestType {
      ${fieldStringInt}
      public async validate(attributes?: CustomAttributes): Promise<void> {
        if (attributes === undefined || attributes === null) {
          await validateField('${trait.name}', this.all())
        } else {
          await customValidate(attributes, this.all())
        }
      }
    }

    export const ${camelCase(trait.name)}Request = new ${trait.name}Request()
    `

    const writer = requestFile.writer()
    writer.write(fileString)
  }

  // Generate model request files
  for (let i = 0; i < modelFiles.length; i++) {
    let fieldStringType = ``
    let fieldString = ``
    let fieldStringInt = ``
    let fileString = `import { Request } from '@stacksjs/router'\nimport { validateField, customValidate, type schema } from '@stacksjs/validation'\n`

    const modeFileElement = modelFiles[i] as string

    const model = (await import(modeFileElement)).default as Model

    const modelName = getModelName(model, modeFileElement)
    const useTimestamps = model?.traits?.useTimestamps ?? model?.traits?.timestampable ?? true
    const useUuid = model?.traits?.useUuid || false
    const useSoftDeletes = model?.traits?.useSoftDeletes ?? model?.traits?.softDeletable ?? false
    const attributes = await extractFields(model, modeFileElement)

    fieldString += ` id: number\n`
    fieldStringInt += `public id = 1\n`

    const entityGroups: Record<string, string[]> = {}

    // Group attributes by their entity type
    for (const attribute of attributes) {
      const entity = attribute.fieldArray?.entity === 'enum' ? 'string[] | string' : attribute.fieldArray?.entity
      let defaultValue: string | boolean | number | string[] = `''`

      if (attribute.fieldArray?.entity === 'boolean')
        defaultValue = false
      if (attribute.fieldArray?.entity === 'number')
        defaultValue = 0
      if (attribute.fieldArray?.entity === 'enum')
        defaultValue = '[]'

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

    fieldStringType += ` get: <T = string>(element: string, defaultValue?: T) => T`

    const otherModelRelations = await fetchOtherModelRelations(modelName)

    for (const otherModel of otherModelRelations) {
      if (!otherModel.foreignKey)
        continue

      fieldString += ` ${otherModel.foreignKey}: number\n     `
      fieldStringInt += `public ${otherModel.foreignKey} = 0\n`
    }

    if (useTimestamps) {
      fieldStringInt += `public created_at = ''
        public updated_at = ''
      `
    }

    if (useUuid)
      fieldStringInt += `public uuid = ''`

    if (useSoftDeletes) {
      fieldStringInt += `
        public deleted_at = ''
      `

      fieldString += `deleted_at?: string\n`
    }

    fieldString += `created_at?: string
      updated_at?: string`

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
      validate(attributes?: CustomAttributes): Promise<void>
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

    export const ${camelCase(modelName)}Request = new ${modelName}Request()
    `

    const writer = requestFile.writer()
    writer.write(fileString)
  }

  typeString += `export type ModelRequest = ${importTypesString}`

  const requestD = path.frameworkPath('types/requests.d.ts')

  await fs.writeFile(requestD, typeString)
}

export async function writeOrmActions(apiRoute: string, modelName: string, actionPath?: string): Promise<void> {
  const formattedApiRoute = apiRoute.charAt(0).toUpperCase() + apiRoute.slice(1)

  let method = 'GET'
  let actionString = `import { Action } from '@stacksjs/actions'\n import { response } from '@stacksjs/router'\n\n`
  let handleString = ``

  if (apiRoute === 'index') {
    handleString += `async handle() {
        const results = await ${modelName}.all()

        return response.json(results)
      },`

    method = 'GET'
  }

  if (apiRoute === 'show') {
    actionString += `  import type { ${modelName}RequestType } from '@stacksjs/orm'\n import { ${modelName} } from '@stacksjs/orm'\n import { response } from '@stacksjs/router'\n\n`
    handleString += `async handle(request: ${modelName}RequestType) {
        const id = request.getParam('id')

        const model = await ${modelName}.findOrFail(id)

        return response.json(model)
      },`

    method = 'GET'
  }

  if (apiRoute === 'destroy') {
    actionString += `  import type { ${modelName}RequestType } from '@stacksjs/orm'\n import { ${modelName} } from '@stacksjs/orm'\n import { response } from '@stacksjs/router'\n\n`
    handleString += `async handle(request: ${modelName}RequestType) {
        const id = request.getParam('id')

        const model = await ${modelName}.findOrFail(id)

        model?.delete()

        return response.json({ message: 'Model deleted!' })
      },`

    method = 'DELETE'
  }

  if (apiRoute === 'store') {
    actionString += `  import type { ${modelName}RequestType } from '@stacksjs/orm'\n import { ${modelName} } from '@stacksjs/orm'\n import { response } from '@stacksjs/router'\n\n`
    handleString += `async handle(request: ${modelName}RequestType) {
        await request.validate()
        const model = await ${modelName}.create(request.all())

        return response.json(model)
      },`

    method = 'POST'
  }

  if (apiRoute === 'update') {
    actionString += `  import type { ${modelName}RequestType } from '@stacksjs/orm'\n  import { ${modelName} } from '@stacksjs/orm'\n import { response } from '@stacksjs/router'\n\n`
    handleString += `async handle(request: ${modelName}RequestType) {
        await request.validate()

        const id = request.getParam('id')
        const model = await ${modelName}.findOrFail(id)

        const result = model?.update(request.all())

        return response.json(result)
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

  const input = fieldKeys.map((field, index) => {
    const fieldExist: Attribute = fields[field]
    let defaultValue = null
    let uniqueValue = false
    let hiddenValue = false
    let fillableValue = false
    let requiredValue = false

    if (fieldExist) {
      defaultValue = fieldExist || null
      uniqueValue = fieldExist.unique || false
      hiddenValue = fieldExist.hidden || false
      fillableValue = fieldExist.fillable || false
    }

    // Check if the field is required by parsing the validation rule
    const rule = rules[index] ?? ''

    requiredValue = (fieldExist.validation?.rule as Validator<any>).isRequired ?? false

    return {
      field,
      default: defaultValue,
      unique: uniqueValue,
      hidden: hiddenValue,
      fillable: fillableValue,
      required: requiredValue,
      fieldArray: parseRule(rule),
    }
  }) as ModelElement[]

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
                    routeString += `route.get('${uri}', '${modelName}${formattedApiRoute}OrmAction')\n\n`
                  if (apiRoute === 'show')
                    routeString += `route.get('${uri}/{id}', '${modelName}${formattedApiRoute}OrmAction')\n\n`
                  if (apiRoute === 'store')
                    routeString += `route.post('${uri}', '${modelName}${formattedApiRoute}OrmAction')\n\n`
                  if (apiRoute === 'update')
                    routeString += `route.patch('${uri}/{id}', '${modelName}${formattedApiRoute}OrmAction')\n\n`
                  if (apiRoute === 'destroy')
                    routeString += `route.delete('${uri}/{id}', '${modelName}${formattedApiRoute}OrmAction')\n\n`
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
            routeString += `route.get('${uri}', '${pathAction}')\n\n`
          if (apiRoute === 'show')
            routeString += `route.get('${uri}/{id}', '${pathAction}')\n\n`
          if (apiRoute === 'store')
            routeString += `route.post('${uri}', '${pathAction}')\n\n`
          if (apiRoute === 'update')
            routeString += `route.patch('${uri}/{id}', '${pathAction}')\n\n`
          if (apiRoute === 'destroy')
            routeString += `route.delete('${uri}/{id}', '${pathAction}')\n\n`
        }
      }
    }
  }

  writer.write(routeString)
  await writer.end()
}

export async function deleteExistingTypes(): Promise<void> {
  try {
    const typeFiles = globSync(path.frameworkPath('orm/src/types/*Type.ts'))
    for (const file of typeFiles) {
      await Bun.write(file, '')
      log.info('Deleted type file:', file)
    }
  }
  catch (error) {
    handleError(error)
  }
}

export async function deleteExistingModels(modelStringFile?: string): Promise<void> {
  try {
    const typePath = path.frameworkPath(`orm/src/types.ts`)

    await fs.writeFile(typePath, '')

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

    await deleteExistingTypes()
    await deleteExistingOrmActions(modelStringFile)
    await deleteExistingModelNameTypes()
    await deleteAttributeTypes()
    await deleteModelEvents()
    await deleteOrmImports()
    await deleteExistingModelRequest(modelStringFile)
    await deleteExistingOrmRoute()
  }
  catch (error) {
    handleError(error)
  }
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
  await fs.writeFile(typeFile, '')
}

export async function deleteAttributeTypes(): Promise<void> {
  const typeFile = path.frameworkPath('types/attributes.ts')

  await fs.writeFile(typeFile, '')
}

export async function deleteModelEvents(): Promise<void> {
  const eventFile = path.frameworkPath('types/events.ts')

  await fs.writeFile(eventFile, '')
}

export async function deleteOrmImports(): Promise<void> {
  const ormImportFile = path.frameworkPath(`orm/src/index.ts`)

  await fs.writeFile(ormImportFile, '')
}

export async function deleteExistingModelRequest(modelStringFile?: string): Promise<void> {
  const requestD = path.frameworkPath('types/requests.d.ts')
  await fs.writeFile(requestD, '')

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
  await fs.writeFile(ormRoute, '')
}

export function generateTraitBasedTables(): string {
  let text = ''
  text += '  migrations: MigrationsTable\n'
  text += '  passkeys: PasskeysTable\n'
  text += '  commentables: CommentablesTable\n'
  text += '  comments: CommentsTable\n'
  text += '  tags: TagsTable\n'
  text += '  taggables: TaggableTable\n'
  text += '  commentable_upvotes: CommentableUpvotesTable\n'
  text += '  categorizables: CategorizableTable\n'
  text += '  categorizable_models: CategorizableModelsTable\n'
  text += '  taggable_models: TaggableModelsTable\n'
  text += '  password_resets: PasswordResetsTable\n'
  text += '  query_logs: QueryLogsTable\n'
  return text
}

export async function generateKyselyTypes(): Promise<void> {
  const modelFiles = globSync([path.userModelsPath('**/*.ts'), path.storagePath('framework/defaults/models/**/*.ts')], { absolute: true })

  let text = ``

  for (const modelFile of modelFiles) {
    const model = (await import(modelFile)).default as Model
    const tableName = getTableName(model, modelFile)
    const modelName = getModelName(model, modelFile)
    const words = tableName.split('_')
    const pivotFormatted = `${words.map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('')}`

    text += `import type { ${pivotFormatted}Table } from '../src/types/${modelName}Type'\n`
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
        id: Generated<number>
        ${pivotTable.firstForeignKey}: number
        ${pivotTable.secondForeignKey}: number
      }\n\n`
    }
  }

  text += generateTraitTableInterfaces()

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

    if (!pushedTables.includes(tableName)) {
      text += `  ${tableName}: ${formattedTableName}\n`
      pushedTables.push(tableName)
    }
  }

  // Add trait-based tables
  text += generateTraitBasedTables()
  text += '}\n'

  const file = Bun.file(path.frameworkPath('orm/src/types.ts'))

  const writer = file.writer()

  writer.write(text)

  await writer.end()
}

export function mapEntity(attribute: ModelElement): string | undefined {
  const entity = attribute.fieldArray?.entity

  switch (entity) {
    case 'enum':
      return 'string | string[]'
    case 'date':
      return 'Date | string'
    case 'timestamp':
      return 'Date | string'
    case 'datetime':
      return 'Date | string'
    case 'float':
      return 'number'
    case 'double':
      return 'number'
    case 'decimal':
      return 'number'
    case 'integer':
      return 'number'
    case 'bigint':
      return 'number'
    default:
      return entity
  }
}

export function extractImports(filePath: string): string[] {
  const content = fs.readFileSync(filePath, 'utf8')
  const ast = parser.parse(content, {
    sourceType: 'module',
    plugins: ['typescript', 'classProperties', 'decorators-legacy'],
  })

  const imports: string[] = []

  traverse(ast, {
    ImportDeclaration(path) {
      // Convert the import node back to code
      const generated = generator(path.node, {}, content)
      imports.push(generated.code)
    },
  })

  return imports
}

export async function generateModelFiles(modelStringFile?: string): Promise<void> {
  try {
    log.info('Cleanup of older Models...')
    await deleteExistingModels(modelStringFile)
    log.success('Deleted Models')

    log.info('Deleting old Model Name types...')
    await deleteExistingModelNameTypes()
    log.success('Deleted Model Name types')

    log.info('Deleting old attribute types...')
    await deleteAttributeTypes()
    log.success('Deleted old attribute types')

    log.info('Deleting old model events...')
    await deleteModelEvents()
    log.success('Deleted old model events')

    log.info('Deleting old orm imports...')
    await deleteOrmImports()
    log.success('Deleted old orm imports')

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

    try {
      log.info('Writing Model Attributes...')
      await writeModelAttributes()
      await generateTraitRequestTypes()
      log.success('Wrote Model Attributes')
    }
    catch (error) {
      handleError('Error while writing Model Attributes', error)
    }

    try {
      log.info('Writing Model Events...')
      await writeModelEvents()
      log.success('Wrote Model Events')
    }
    catch (error) {
      handleError('Error while writing Model Events', error)
    }

    log.info('Generating API Routes...')
    const modelFiles = globSync([path.userModelsPath('**/*.ts'), path.storagePath('framework/defaults/models/**/*.ts')], { absolute: true })
    await generateApiRoutes(modelFiles)
    log.success('Generated API Routes')

    for (const modelFile of modelFiles) {
      if (modelStringFile && modelStringFile !== modelFile)
        continue
      log.info(`Processing Model: ${italic(modelFile)}`)

      const model = (await import(modelFile)).default as Model
      const tableName = getTableName(model, modelFile)
      const modelName = getModelName(model, modelFile)
      const file = Bun.file(path.frameworkPath(`orm/src/models/${modelName}.ts`))
      const fields = await extractFields(model, modelFile)

      // Extract imports from the original model file
      const imports = extractImports(modelFile)
      const classString = await generateModelString(tableName, modelName, model, fields, imports)

      await writeTypeFile(tableName, modelName, model, fields)

      const writer = file.writer()
      log.info(`Writing Model: ${italic(modelName)}`)
      writer.write(classString)
      log.success(`Wrote Model: ${italic(modelName)}`)
      await writer.end()
    }

    log.info('Generating Query Builder types...')
    await generateKyselyTypes()
    log.success('Generated Query Builder types')

    log.info('Writing Model Orm Imports...')
    await writeModelOrmImports(modelFiles)
    log.success('Wrote Model Orm Imports')

    // we need to lint:fix the auto-generated code, given there is a chance that
    // the codebase has lint issues unrelating to our auto-generated code, we
    // ignore the the console output
    await ensureCodeStyle()
  }
  catch (error) {
    handleError('Error while generating model files', error)
  }
}

async function writeModelOrmImports(modelFiles: string[]): Promise<void> {
  let ormImportString = ``
  for (const modelFile of modelFiles) {
    const model = (await import(modelFile)).default as Model

    const modelName = getModelName(model, modelFile)
    const tableName = getTableName(model, modelFile)

    ormImportString += `export { type ${modelName}JsonResponse, type ${pascalCase(tableName)}Table, type New${modelName}, type ${modelName}ModelType, type ${modelName}Update } from './types/${modelName}Type'\n\n`
    ormImportString += `export { default as ${modelName}, ${modelName}Model } from './models/${modelName}'\n\n`
  }

  const file = Bun.file(path.frameworkPath(`orm/src/index.ts`))
  const writer = file.writer()

  writer.write(ormImportString)

  await writer.end()
}

export async function extractAttributesFromModel(filePath: string): Promise<AttributesElements> {
  // Read the TypeScript file
  const content = fs.readFileSync(filePath, 'utf8')

  // Parse the file content into an AST
  const ast = parser.parse(content, {
    sourceType: 'module',
    plugins: ['typescript', 'classProperties', 'decorators-legacy'],
  })

  let fields: AttributesElements | undefined
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
        fields = generated.code as unknown as AttributesElements
        path.stop() // Stop traversing further once we found the fields
      }
    },
  })

  return fields as AttributesElements
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

export function findCoreModel(modelName: string): string {
  const rootPath = path.join(path.storagePath('framework/defaults/models'), '/')

  const matches = globSync(`${rootPath}**/${modelName}`, {
    absolute: true,
  })

  return matches[0] ?? ''
}

export function findUserModel(modelName: string): string {
  const rootPath = path.join(path.userModelsPath('/'), '/')

  const matches = globSync(`${rootPath}**/${modelName}`, {
    absolute: true,
  })

  return matches[0] ?? ''
}

/**
 * Format a date to ISO string and remove milliseconds
 * @param date The date to format
 * @returns Formatted date string in format: YYYY-MM-DD HH:mm:ss
 */
export function formatDate(date: Date): string {
  return date.toISOString().replace('T', ' ').split('.')[0]
}

export function extractDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

/**
 * Format a date to ISO string and remove milliseconds
 * @param date The date to format
 * @returns Formatted date string in format: YYYY-MM-DD HH:mm:ss
 */
export function toTimestamp(date: Date): number {
  return date.getTime()
}

export async function generateTypeString(
  tableName: string,
  modelName: string,
  model: Model,
  attributes: ModelElement[],
): Promise<string> {
  const formattedTableName = pascalCase(tableName)
  const formattedModelName = camelCase(modelName)

  const useUuid = model.traits?.useUuid
  const useTimestamps = model.traits?.useTimestamps
  const billable = model.traits?.billable

  // Get relations for this model
  const relations = await getRelations(model, modelName)

  let relationImports = ``

  for (const relation of relations) {
    const modelRelation = relation.model
    relationImports += `import type { ${modelRelation}ModelType } from './${modelRelation}Type'\n`
  }

  // Generate base table interface
  let typeString = `import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
${relationImports}

export interface ${formattedTableName}Table {
  id: Generated<number>
`

  // Add attributes to the table interface
  for (const attribute of attributes) {
    const entity = mapEntity(attribute)
    const optionalIndicator = attribute.required === false ? '?' : ''
    typeString += `  ${snakeCase(attribute.field)}${optionalIndicator}: ${entity}\n`
  }

  // Add relation foreign keys to the table interface
  // for (const relation of relations) {
  //   const relationType = getRelationType(relation.relationship)
  //   const relationCount = getRelationCount(relation.relationship)

  //   if (relationType === 'belongsType' && !relationCount) {
  //     typeString += `  ${relation.modelKey}: number\n`
  //   }
  // }

  if (useUuid) {
    typeString += `  uuid?: string\n`
  }

  if (useTimestamps) {
    typeString += `  created_at?: string\n`
    typeString += `  updated_at?: string\n`
  }

  if (billable) {
    typeString += `  stripe_id?: string\n`
  }

  typeString += `}`

  // Generate the model type interface
  let modelTypeInterface = `export interface ${modelName}ModelType {
  // Properties
  readonly id: number
`

  // Add getters and setters for each attribute
  for (const attribute of attributes) {
    const fieldName = camelCase(attribute.field)
    const entity = mapEntity(attribute)
    const optionalIndicator = attribute.required === false ? ' | undefined' : ''

    modelTypeInterface += `  get ${fieldName}(): ${entity}${optionalIndicator}
  set ${fieldName}(value: ${entity})
`
  }

  // Add relation getters and setters
  for (const relation of relations) {
    const modelRelation = relation.model
    const formattedModelRelation = camelCase(modelRelation)
    const relationType = getRelationType(relation.relationship)
    const relationCount = getRelationCount(relation.relationship)

    if (relationType === 'hasType' && relationCount === 'many') {
      const relationName = relation.relationName || formattedModelRelation
      modelTypeInterface += `  get ${snakeCase(relationName)}(): ${modelRelation}ModelType[] | []
`
    }

    if (relationType === 'morphType' && relationCount === 'one') {
      const morphName = relation.relationName || `${formattedModelName}able`
      modelTypeInterface += `  get ${snakeCase(morphName)}(): ${modelRelation}ModelType | undefined
`
    }

    if (relationType === 'morphType' && relationCount === 'many') {
      const morphName = relation.relationName || `${formattedModelName}able`
      modelTypeInterface += `  get ${snakeCase(morphName)}(): ${modelRelation}ModelType[] | []
`
    }

    if (relationType === 'belongsType' && !relationCount) {
      const relationName = camelCase(relation.relationName || formattedModelRelation)
      modelTypeInterface += `  get ${snakeCase(relationName)}(): ${modelRelation}ModelType | undefined 
      `
    }

    if (relationType === 'belongsType' && relationCount === 'many') {
      const relationName = relation.relationName || formattedModelName + plural(pascalCase(modelRelation))
      modelTypeInterface += `  get ${snakeCase(relationName)}(): ${modelRelation}ModelType[] | []
      `
    }
  }

  if (useUuid) {
    modelTypeInterface += `
  get uuid(): string | undefined
  set uuid(value: string)
`
  }

  if (useTimestamps) {
    modelTypeInterface += `
  get created_at(): string | undefined
  get updated_at(): string | undefined
  set updated_at(value: string)
`
  }

  if (billable) {
    modelTypeInterface += `
  get stripe_id(): string | undefined
  set stripe_id(value: string)
`
  }

  // Add common getters and setters
  modelTypeInterface += `
  // Static methods
  with: (relations: string[]) => ${modelName}ModelType
  select: (params: (keyof ${modelName}JsonResponse)[] | RawBuilder<string> | string) => ${modelName}ModelType
  find: (id: number) => Promise<${modelName}ModelType | undefined>
  first: () => Promise<${modelName}ModelType | undefined>
  last: () => Promise<${modelName}ModelType | undefined>
  firstOrFail: () => Promise<${modelName}ModelType | undefined>
  all: () => Promise<${modelName}ModelType[]>
  findOrFail: (id: number) => Promise<${modelName}ModelType | undefined>
  findMany: (ids: number[]) => Promise<${modelName}ModelType[]>
  latest: (column?: keyof ${formattedTableName}Table) => Promise<${modelName}ModelType | undefined>
  oldest: (column?: keyof ${formattedTableName}Table) => Promise<${modelName}ModelType | undefined>
  skip: (count: number) => ${modelName}ModelType
  take: (count: number) => ${modelName}ModelType
  where: <V = string>(column: keyof ${formattedTableName}Table, ...args: [V] | [Operator, V]) => ${modelName}ModelType
  orWhere: (...conditions: [string, any][]) => ${modelName}ModelType
  whereNotIn: <V = number>(column: keyof ${formattedTableName}Table, values: V[]) => ${modelName}ModelType
  whereBetween: <V = number>(column: keyof ${formattedTableName}Table, range: [V, V]) => ${modelName}ModelType
  whereRef: (column: keyof ${formattedTableName}Table, ...args: string[]) => ${modelName}ModelType
  when: (condition: boolean, callback: (query: ${modelName}ModelType) => ${modelName}ModelType) => ${modelName}ModelType
  whereNull: (column: keyof ${formattedTableName}Table) => ${modelName}ModelType
  whereNotNull: (column: keyof ${formattedTableName}Table) => ${modelName}ModelType
  whereLike: (column: keyof ${formattedTableName}Table, value: string) => ${modelName}ModelType
  orderBy: (column: keyof ${formattedTableName}Table, order: 'asc' | 'desc') => ${modelName}ModelType
  orderByAsc: (column: keyof ${formattedTableName}Table) => ${modelName}ModelType
  orderByDesc: (column: keyof ${formattedTableName}Table) => ${modelName}ModelType
  groupBy: (column: keyof ${formattedTableName}Table) => ${modelName}ModelType
  having: <V = string>(column: keyof ${formattedTableName}Table, operator: Operator, value: V) => ${modelName}ModelType
  inRandomOrder: () => ${modelName}ModelType
  whereColumn: (first: keyof ${formattedTableName}Table, operator: Operator, second: keyof ${formattedTableName}Table) => ${modelName}ModelType
  max: (field: keyof ${formattedTableName}Table) => Promise<number>
  min: (field: keyof ${formattedTableName}Table) => Promise<number>
  avg: (field: keyof ${formattedTableName}Table) => Promise<number>
  sum: (field: keyof ${formattedTableName}Table) => Promise<number>
  count: () => Promise<number>
  get: () => Promise<${modelName}ModelType[]>
  pluck: <K extends keyof ${modelName}ModelType>(field: K) => Promise<${modelName}ModelType[K][]>
  chunk: (size: number, callback: (models: ${modelName}ModelType[]) => Promise<void>) => Promise<void>
  paginate: (options?: { limit?: number, offset?: number, page?: number }) => Promise<{
    data: ${modelName}ModelType[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }>
  create: (new${modelName}: New${modelName}) => Promise<${modelName}ModelType>
  firstOrCreate: (search: Partial<${formattedTableName}Table>, values?: New${modelName}) => Promise<${modelName}ModelType>
  updateOrCreate: (search: Partial<${formattedTableName}Table>, values?: New${modelName}) => Promise<${modelName}ModelType>
  createMany: (new${modelName}: New${modelName}[]) => Promise<void>
  forceCreate: (new${modelName}: New${modelName}) => Promise<${modelName}ModelType>
  remove: (id: number) => Promise<any>
  whereIn: <V = number>(column: keyof ${formattedTableName}Table, values: V[]) => ${modelName}ModelType
  distinct: (column: keyof ${modelName}JsonResponse) => ${modelName}ModelType
  join: (table: string, firstCol: string, secondCol: string) => ${modelName}ModelType

  // Instance methods
  createInstance: (data: ${modelName}JsonResponse) => ${modelName}ModelType
  update: (new${modelName}: ${modelName}Update) => Promise<${modelName}ModelType | undefined>
  forceUpdate: (new${modelName}: ${modelName}Update) => Promise<${modelName}ModelType | undefined>
  save: () => Promise<${modelName}ModelType>
  delete: () => Promise<number>
  toSearchableObject: () => Partial<${modelName}JsonResponse>
  toJSON: () => ${modelName}JsonResponse
  parseResult: (model: ${modelName}ModelType) => ${modelName}ModelType
`

  // Add relation methods to the interface
  for (const relation of relations) {
    const modelRelation = relation.model
    const formattedModelRelation = camelCase(modelRelation)
    const relationType = getRelationType(relation.relationship)
    const relationCount = getRelationCount(relation.relationship)

    if (relationType === 'throughType') {
      const relationName = relation.relationName || formattedModelName + modelRelation
      if (relation.throughModel !== undefined) {
        modelTypeInterface += `
  ${relationName}: () => Promise<${modelRelation}ModelType | undefined>`
      }
    }

    if (relationType === 'morphType' && relationCount === 'one') {
      const morphName = relation.relationName || `${formattedModelName}able`
      modelTypeInterface += `
  ${morphName}: () => Promise<${modelRelation}ModelType | undefined>`
    }

    if (relationType === 'morphType' && relationCount === 'many') {
      const morphName = relation.relationName || `${formattedModelName}able`
      modelTypeInterface += `
  ${morphName}: () => Promise<${modelRelation}ModelType[]>`
    }

    if (relationType === 'belongsType' && !relationCount) {
      const relationName = camelCase(relation.relationName || formattedModelRelation)
      modelTypeInterface += `
    ${relationName}Belong: () => Promise<${modelRelation}ModelType>`
    }

    if (relationType === 'belongsType' && relationCount === 'many') {
      const relationName = relation.relationName || formattedModelName + plural(pascalCase(modelRelation))
      modelTypeInterface += `
    ${relationName}: () => Promise<${modelRelation}ModelType[]>`
    }
  }

  modelTypeInterface += `
}`

  // Generate the response types
  const responseTypes = `export type ${modelName}Read = ${formattedTableName}Table

export type ${modelName}Write = Omit<${formattedTableName}Table, 'created_at'> & {
  created_at?: string
}

export interface ${modelName}Response {
  data: ${modelName}JsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface ${modelName}JsonResponse extends Omit<Selectable<${modelName}Read>, 'password'> {
  [key: string]: any
}

export type New${modelName} = Insertable<${modelName}Write>
export type ${modelName}Update = Updateable<${modelName}Write>`

  // Combine all the generated code
  return `${typeString}

${responseTypes}

${modelTypeInterface}`
}

export async function writeTypeFile(
  tableName: string,
  modelName: string,
  model: Model,
  attributes: ModelElement[],
): Promise<void> {
  log.info('Writing type file for', modelName)
  const typeString = await generateTypeString(tableName, modelName, model, attributes)
  const typeFilePath = path.frameworkPath(`orm/src/types/${modelName}Type.ts`)

  await Bun.write(typeFilePath, typeString)
}
