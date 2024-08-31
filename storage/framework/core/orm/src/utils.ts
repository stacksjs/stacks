import { generator, parser, traverse } from '@stacksjs/build'
import { path } from '@stacksjs/path'
import { fs } from '@stacksjs/storage'
import { plural, singular, snakeCase } from '@stacksjs/strings'
import type { Attributes, FieldArrayElement, Model, ModelElement, RelationConfig } from '@stacksjs/types'

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

    for (const attribute of attributes) {
      const entity = attribute.fieldArray?.entity === 'enum' ? 'string[]' : attribute.fieldArray?.entity
      let defaultValue: any = `''`

      if (attribute.fieldArray?.entity === 'boolean') defaultValue = false
      if (attribute.fieldArray?.entity === 'number') defaultValue = 0

      fieldString += ` ${attribute.field}: ${entity}\n     `
      fieldStringType += ` get(key: '${attribute.field}'): ${entity}\n`
      fieldStringInt += `public ${attribute.field} = ${defaultValue}\n`
      keyCounter++
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

export async function writeOrmActions(apiRoute: string, modelName: String): Promise<void> {
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

  const file = Bun.file(path.builtUserActionsPath(`src/${modelName}${formattedApiRoute}OrmAction.ts`))

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
