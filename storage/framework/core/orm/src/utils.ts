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
import { path } from '@stacksjs/path'
import { fs, globSync } from '@stacksjs/storage'
import { plural, singular, snakeCase } from '@stacksjs/strings'
import { isString } from '@stacksjs/validation'

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
    relationships.push(await processMorphOne(model.morphOne, model, modelName, 'morphOne'))
  }

  return relationships
}

async function loadModels(modelName: string, relationModel: string): Promise<{ modelRelation: Model, modelPath: string, modelRelationPath: string }> {
  const modelRelationPath = findUserModel(`${relationModel}.ts`)
  const userModelPath = findUserModel(`${modelName}.ts`)
  const coreModelPath = findCoreModel(`${modelName}.ts`)
  const coreModelRelationPath = findCoreModel(`${relationModel}.ts`)

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
  const singularRe = /One/
  const pluralRe = /Many/

  if (pluralRe.test(relation))
    return 'many'

  if (singularRe.test(relation))
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

    const relation = relations.find((relation: any) => relation.model === modelName)

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
    .map((attribute: any) => snakeCase(attribute))
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

  const foreignKeys = otherModelRelations.map((otherModelRelation: any) => otherModelRelation.foreignKey).filter((relation: any) => relation)

  return [
    ...Object.keys(attributes)
      .filter((key) => {
        if (attributes === undefined)
          return false

        return attributes[key]?.fillable === true
      })
      .map((attribute: any) => snakeCase(attribute)),
    ...additionalCols,
    ...foreignKeys,
  ]
}

export async function extractFields(model: Model, modelFile: string): Promise<ModelElement[]> {
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

  const input = fieldKeys.map((field: any, index: any) => {
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
  }) as unknown as ModelElement[]

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
    ImportDeclaration(path: any) {
      const generated = generator(path.node, {}, content)
      imports.push(generated.code)
    },
  })

  return imports
}

export async function extractAttributesFromModel(filePath: string): Promise<AttributesElements> {
  const content = fs.readFileSync(filePath, 'utf8')

  const ast = parser.parse(content, {
    sourceType: 'module',
    plugins: ['typescript', 'classProperties', 'decorators-legacy'],
  })

  let fields: AttributesElements | undefined
  traverse(ast, {
    ObjectExpression(path: any) {
      const fieldsProperty = path.node.properties.find(
        (property: any) =>
          property.type === 'ObjectProperty'
          && property.key.type === 'Identifier'
          && property.key.name === 'attributes',
      )

      if (fieldsProperty && fieldsProperty.type === 'ObjectProperty' && fieldsProperty.value) {
        const generated = generator(fieldsProperty.value, {}, content)
        fields = generated.code as unknown as AttributesElements
        path.stop()
      }
    },
  })

  return fields as AttributesElements
}

export function findCoreModel(modelName: string): string {
  const rootPath = path.join(path.storagePath('framework/defaults/models'), '/')

  const directPath = path.join(rootPath, modelName)
  if (fs.existsSync(directPath))
    return directPath

  const matches = globSync(`${rootPath}**/${modelName}`, {
    absolute: true,
  })

  return matches[0] ?? ''
}

export function findUserModel(modelName: string): string {
  const rootPath = path.join(path.userModelsPath('/'), '/')

  const directPath = path.join(rootPath, modelName)
  if (fs.existsSync(directPath))
    return directPath

  const matches = globSync(`${rootPath}**/${modelName}`, {
    absolute: true,
  })

  return matches[0] ?? ''
}

export function formatDate(date: Date | number | string): string {
  const d = typeof date === 'number' ? new Date(date) : typeof date === 'string' ? new Date(date) : date
  return d.toISOString().replace('T', ' ').split('.')[0]
}

export function extractDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

export function toTimestamp(date: Date): number {
  return date.getTime()
}
