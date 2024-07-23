import { log } from '@stacksjs/logging'
import { getModelName, getTableName } from '@stacksjs/orm'
import { path } from '@stacksjs/path'
import { fs, glob } from '@stacksjs/storage'
import { camelCase, pascalCase, plural, singular, snakeCase } from '@stacksjs/strings'
import type { Attributes, Model, RelationConfig } from '@stacksjs/types'
import { isString } from '@stacksjs/validation'
export interface FieldArrayElement {
  entity: string
  charValue?: string | null
  // Add other properties as needed
}

export interface ModelElement {
  field: string
  default: string | number | boolean | Date | undefined | null
  unique: boolean
  fieldArray: FieldArrayElement | null
}

await initiateModelGeneration()
await setKyselyTypes()

async function generateApiRoutes(modelFiles: string[]) {
  const file = Bun.file(path.projectStoragePath(`framework/orm/routes.ts`))
  const writer = file.writer()
  let routeString = `import { route } from '@stacksjs/router'\n\n\n`

  for (const modelFile of modelFiles) {
    log.debug(`Processing model file: ${modelFile}`)
    let middlewareString = ''
    const model = (await import(modelFile)).default as Model
    const modelName = getModelName(model, modelFile)
    const tableName = getTableName(model, modelFile)

    if (model.traits?.useApi) {
      const apiRoutes = model.traits?.useApi?.routes
      const middlewares = model.traits.useApi?.middleware
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

      if (apiRoutes?.length) {
        for (const apiRoute of apiRoutes) {
          await writeOrmActions(apiRoute as string, modelName)

          if (apiRoute === 'index')
            routeString += `await route.get('${tableName}', 'Actions/${modelName}IndexOrmAction')${middlewareString}\n\n`

          if (apiRoute === 'store')
            routeString += `await route.post('${tableName}', 'Actions/${modelName}StoreOrmAction')${middlewareString}\n\n`

          if (apiRoute === 'update')
            routeString += `await route.patch('${tableName}/{id}', 'Actions/${modelName}UpdateOrmAction')${middlewareString}\n\n`

          if (apiRoute === 'show')
            routeString += `await route.get('${tableName}/{id}', 'Actions/${modelName}ShowOrmAction')${middlewareString}\n\n`

          if (apiRoute === 'destroy')
            routeString += `await route.delete('${tableName}/{id}', 'Actions/${modelName}DestroyOrmAction')${middlewareString}\n\n`
        }
      }
    }
  }

  writer.write(routeString)
  await writer.end()
}

async function writeModelNames() {
  const modelFiles = glob.sync(path.userModelsPath('*.ts'))

  let fileString = `export type ModelNames = `

  for (let i = 0; i < modelFiles.length; i++) {
    const modeFileElement = modelFiles[i] as string

    const model = (await import(modeFileElement)).default as Model
    const modelName = getModelName(model, modeFileElement)

    const typeFile = Bun.file(path.projectStoragePath(`framework/core/types/src/model-names.ts`))

    fileString += `'${modelName}'`

    if (i < modelFiles.length - 1) {
      fileString += ' | '
    }

    const writer = typeFile.writer()

    writer.write(fileString)
  }
}

async function writeModelRequest() {
  const modelFiles = glob.sync(path.userModelsPath('*.ts'))

  const requestD = Bun.file(path.frameworkPath('types/requests.d.ts'))
  let importTypes = ``
  let importTypesString = ``
  let typeString = `import { Request } from '../core/router/src/request'\n\n`

  typeString += `interface ValidationType {
    rule: VineType;
    message: { [key: string]: string };
  }\n\n`

  typeString += `interface ValidationField {
    [key: string]: string | ValidationType;
    validation: ValidationType;
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

    const attributes = await extractFields(model, modeFileElement)

    fieldString += ` id?: number\n`
    fieldStringInt += `public id = 1\n`
    fieldStringType += `'id' |`
    let keyCounter = 0
    let keyCounterForeign = 0

    const otherModelRelations = await fetchOtherModelRelations(model, modelName)

    for (const attribute of attributes) {
      let defaultValue: any = `''`
      const entity = attribute.fieldArray?.entity === 'enum' ? 'string[]' : attribute.fieldArray?.entity

      if (attribute.fieldArray?.entity === 'boolean') defaultValue = false

      if (attribute.fieldArray?.entity === 'number') defaultValue = 0

      fieldString += ` ${attribute.field}: ${entity}\n     `

      fieldStringType += `'${attribute.field}'`
      if (keyCounter < attributes.length - 1) fieldStringType += ' |'

      fieldStringInt += `public ${attribute.field} = ${defaultValue}\n`

      keyCounter++
    }

    for (const otherModel of otherModelRelations) {
      fieldString += ` ${otherModel.foreignKey}: number\n     `

      if (keyCounter >= attributes.length - 1) fieldStringType += ' |'

      fieldStringType += `'${otherModel.foreignKey}'`

      // if (keyCounterForeign < otherModelRelations.length - 1)
      //   fieldStringType += ' |'

      fieldStringInt += `public ${otherModel.foreignKey} = 0\n`

      keyCounterForeign++
    }

    fieldStringInt += `public created_at = ''
      public updated_at = ''
      public deleted_at = ''
      `

    fieldString += `created_at?: string
      updated_at?: string
      deleted_at?: string`

    const modelLowerCase = camelCase(modelName)

    const requestFile = Bun.file(path.projectStoragePath(`framework/requests/${modelName}Request.ts`))

    importTypes = `${modelName}RequestType`
    importTypesString += `${importTypes}`

    if (i < modelFiles.length - 1) importTypesString += ` | `

    fileString += `import type { ${importTypes} } from '../types/requests'\n\n`

    fileString += `interface ValidationType {
      rule: VineType;
      message: { [key: string]: string };
    }\n\n`

    fileString += `interface ValidationField {
      [key: string]: string | ValidationType;
      validation: ValidationType;
    }\n\n`

    fileString += `interface CustomAttributes {
      [key: string]: ValidationField
    }`

    const types = `export interface ${modelName}RequestType extends Request {
      validate(attributes?: CustomAttributes): void
      get(key: ${fieldStringType}): string | number | undefined;
      ${fieldString}
    }\n\n`

    typeString += `interface RequestData${modelName} {
      ${fieldString}
    }\n`

    typeString += types

    fileString += `export class ${modelName}Request extends Request implements ${modelName}RequestType {
      ${fieldStringInt}
      public async validate(attributes?: CustomAttributes): Promise<void> {
        if (attributes === undefined || attributes === null) {
          await validateField('${modelName}', this.all())
        } else {
          await customValidate(attributes, this.all())
        }

      }
    }

    export const ${modelLowerCase}Request = new ${modelName}Request()
    `

    const writer = requestFile.writer()

    writer.write(fileString)
  }

  typeString += `export type ModelRequest = ${importTypesString}`

  const requestWrite = requestD.writer()

  requestWrite.write(typeString)
}

async function writeOrmActions(apiRoute: string, modelName: String): Promise<void> {
  const formattedApiRoute = apiRoute.charAt(0).toUpperCase() + apiRoute.slice(1)
  let method = 'GET'
  let actionString = `import { Action } from '@stacksjs/actions'\n`
  actionString += `import ${modelName} from '../src/models/${modelName}'\n`

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

        return ${modelName}.findOrFail(Number(id))
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

  const file = Bun.file(path.projectStoragePath(`framework/orm/Actions/${modelName}${formattedApiRoute}OrmAction.ts`))

  const writer = file.writer()

  writer.write(actionString)
}

async function initiateModelGeneration(): Promise<void> {
  await deleteExistingModels()
  await deleteExistingOrmActions()
  await deleteExistingModelNameTypes()
  await deleteExistingModelRequest()

  await writeModelNames()
  await writeModelRequest()

  const modelFiles = glob.sync(path.userModelsPath('*.ts'))

  await generateApiRoutes(modelFiles)

  for (const modelFile of modelFiles) {
    log.debug(`Processing model file: ${modelFile}`)

    const model = (await import(modelFile)).default as Model
    const tableName = await getTableName(model, modelFile)
    const modelName = getModelName(model, modelFile)

    const file = Bun.file(path.projectStoragePath(`framework/orm/src/models/${modelName}.ts`))
    const fields = await extractFields(model, modelFile)
    const classString = await generateModelString(tableName, modelName, model, fields)

    const writer = file.writer()
    writer.write(classString)
    await writer.end()
  }
}

async function getRelations(model: Model, modelName: string): Promise<RelationConfig[]> {
  const relationsArray = ['hasOne', 'belongsTo', 'hasMany', 'belongsToMany', 'hasOneThrough']

  const relationships = []

  for (const relation of relationsArray) {
    if (hasRelations(model, relation)) {
      for (const relationInstance of model[relation]) {
        let relationModel = relationInstance.model

        if (isString(relationInstance)) {
          relationModel = relationInstance
        }

        const modelRelationPath = path.userModelsPath(`${relationModel}.ts`)

        const modelRelation = (await import(modelRelationPath)).default as Model

        const formattedModelName = modelName.toLowerCase()

        relationships.push({
          relationship: relation,
          model: relationModel,
          table: modelRelation.table,
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

function getPivotTableName(formattedModelName: string, modelRelationTable: string): string {
  // Create an array of the model names
  const models = [formattedModelName, modelRelationTable]

  // Sort the array alphabetically
  models.sort()

  models[0] = singular(models[0] || '')

  // Join the sorted array with an underscore
  const pivotTableName = models.join('_')

  return pivotTableName
}

function hasRelations(obj: any, key: string): boolean {
  return key in obj
}

async function deleteExistingModels() {
  const modelPaths = glob.sync(path.projectStoragePath(`framework/orm/src/models/*.ts`))

  for (const modelPath of modelPaths) {
    if (fs.existsSync(modelPath)) await Bun.$`rm ${modelPath}`
  }

  const typePath = path.projectStoragePath(`framework/core/orm/src/generated/types.ts`)

  if (fs.existsSync(typePath)) await Bun.$`rm ${typePath}`
}

async function deleteExistingOrmActions() {
  const ormPaths = glob.sync(path.projectStoragePath(`framework/orm/Actions/*.ts`))
  const routes = path.projectStoragePath(`framework/orm/routes`)

  for (const ormPath of ormPaths) {
    if (fs.existsSync(ormPath)) await Bun.$`rm ${ormPath}`
  }

  if (fs.existsSync(routes)) await Bun.$`rm ${routes}`
}

async function deleteExistingModelNameTypes() {
  const typeFile = path.projectStoragePath(`framework/core/types/src/model-names.ts`)

  if (fs.existsSync(typeFile)) await Bun.$`rm ${typeFile}`
}

async function deleteExistingModelRequest() {
  const requestFiles = glob.sync(path.projectStoragePath(`framework/requests/*.ts`))
  const requestD = path.frameworkPath('types/requests.d.ts')

  for (const requestFile of requestFiles) {
    if (fs.existsSync(requestFile)) await Bun.$`rm ${requestFile}`
  }

  if (fs.existsSync(requestD)) await Bun.$`rm ${requestD}`
}

async function setKyselyTypes() {
  let text = ``
  const modelFiles = glob.sync(path.userModelsPath('*.ts'))

  for (const modelFile of modelFiles) {
    const model = (await import(modelFile)).default as Model
    const tableName = await getTableName(model, modelFile)
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

  const file = Bun.file(path.projectStoragePath(`framework/core/orm/src/generated/types.ts`))

  const writer = file.writer()

  writer.write(text)

  await writer.end()
}

async function extractFields(model: Model, modelFile: string): Promise<ModelElement[]> {
  // TODO: we can improve this type
  let fields: Record<string, any> | undefined = model.attributes

  if (!fields) fields = {}

  const fieldKeys = Object.keys(fields)

  const rules: string[] = []

  const file = Bun.file(modelFile) // Assuming Bun is imported properly

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

function getRelationType(relation: string): string {
  const belongToType = /belongs/
  const hasType = /has/
  const throughType = /Through/

  if (throughType.test(relation)) return 'throughType'

  if (belongToType.test(relation)) return 'belongsType'

  if (hasType.test(relation)) return 'hasType'

  return ''
}

function getRelationCount(relation: string): string {
  const singular = /One/
  const plural = /Many/

  if (plural.test(relation)) return 'many'

  if (singular.test(relation)) return 'one'

  return ''
}

async function getPivotTables(
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

      const firstForeignKey = belongsToManyRelation.firstForeignKey || `${modelName.toLowerCase()}_${model.primaryKey}`
      const secondForeignKey =
        belongsToManyRelation.secondForeignKey || `${modelRelation.name?.toLowerCase()}_${model.primaryKey}`

      pivotTable.push({
        table: belongsToManyRelation?.pivotTable || `${formattedModelName}_${modelRelation.table}`,
        firstForeignKey: firstForeignKey,
        secondForeignKey: secondForeignKey,
      })
    }

    return pivotTable
  }

  return []
}

export async function fetchOtherModelRelations(model: Model, modelName: string): Promise<RelationConfig[]> {
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

function getHiddenAttributes(attributes: Attributes | undefined): string[] {
  if (attributes === undefined) return []

  return Object.keys(attributes).filter((key) => {
    if (attributes === undefined) return false

    return attributes[key]?.hidden === true
  })
}

function getFillableAttributes(attributes: Attributes | undefined): string[] {
  if (attributes === undefined) return []

  return Object.keys(attributes).filter((key) => {
    if (attributes === undefined) return false

    return attributes[key]?.fillable === true
  })
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
  let declareFields = ''
  let whereStatements = ''
  let whereFunctionStatements = ''
  let relationMethods = ``
  let relationImports = ``
  let twoFactorStatements = ''

  const relations = await getRelations(model, modelName)

  for (const relationInstance of relations) {
    relationImports += `import ${relationInstance.model} from './${relationInstance.model}'\n\n`
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

  const useTwoFactor = model.traits?.useAuth?.useTwoFactor

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

  for (const attribute of attributes) {
    const entity = attribute.fieldArray?.entity === 'enum' ? 'string[]' : attribute.fieldArray?.entity

    fieldString += ` ${attribute.field}: ${entity}\n     `

    declareFields += `public ${snakeCase(attribute.field)}: ${entity} | undefined \n   `

    constructorFields += `this.${snakeCase(attribute.field)} = ${formattedModelName}?.${snakeCase(attribute.field)}\n   `

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

  const otherModelRelations = await fetchOtherModelRelations(model, modelName)

  for (const otherModelRelation of otherModelRelations) {
    fieldString += ` ${otherModelRelation.foreignKey}: number \n`

    declareFields += `public ${otherModelRelation.foreignKey}: number | undefined \n   `

    constructorFields += `this.${otherModelRelation.foreignKey} = ${formattedModelName}?.${otherModelRelation.foreignKey}\n   `
  }

  if (useTwoFactor) {
    fieldString += `two_factor_secret: string \n`
  }

  const hidden = JSON.stringify(getHiddenAttributes(model.attributes))
  const fillable = JSON.stringify(getFillableAttributes(model.attributes))

  return `import type { ColumnType, Generated, Insertable, Selectable, Updateable } from 'kysely'
    import { db } from '@stacksjs/database'
    import { sql } from '@stacksjs/database'
    import { generateTwoFactorSecret } from '@stacksjs/auth'
    import { verifyTwoFactorCode } from '@stacksjs/auth'
    ${relationImports}
    // import { Kysely, MysqlDialect, PostgresDialect } from 'kysely'
    // import { Pool } from 'pg'

    // TODO: we need an action that auto-generates these table interfaces
    export interface ${formattedTableName}Table {
      id: Generated<number>
     ${fieldString}
      created_at: ColumnType<Date, string | undefined, never>
      updated_at: ColumnType<Date, string | undefined, never>
      deleted_at: ColumnType<Date, string | undefined, never>
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
      private ${formattedModelName}: Partial<${modelName}Type> | null
      private hidden = ${hidden}
      private fillable = ${fillable}
      protected query: any
      protected hasSelect: boolean
      ${declareFields}
      constructor(${formattedModelName}: Partial<${modelName}Type> | null) {
        this.${formattedModelName} = ${formattedModelName}
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

        return this.parseResult(this)
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

      static async findOrFail(id: number, fields?: (keyof ${modelName}Type)[]): Promise<${modelName}Model> {
        let query = db.selectFrom('${tableName}').where('id', '=', id)

        const instance = new this(null)

        if (fields)
          query = query.select(fields)
        else
          query = query.selectAll()

        const model = await query.executeTakeFirst()

        if (!model)
          throw(\`No model results found for \${id}\ \`)


        return instance.parseResult(new this(model))
      }

      static async findMany(ids: number[], fields?: (keyof ${modelName}Type)[]): Promise<${modelName}Model[]> {
        let query = db.selectFrom('${tableName}').where('id', 'in', ids)

        const instance = new this(null)

        if (fields)
          query = query.select(fields)
        else
          query = query.selectAll()

        const model = await query.execute()

        instance.parseResult(new ${modelName}Model(modelItem))

        return model.map(modelItem => instance.parseResult(new ${modelName}Model(modelItem)))
      }

      // Method to get a ${modelName} by criteria
      static async fetch(criteria: Partial<${modelName}Type>, options: QueryOptions = {}): Promise<${modelName}Model[]> {
        let query = db.selectFrom('${tableName}')

        // Apply sorting from options
        if (options.sort)
          query = query.orderBy(options.sort.column, options.sort.order)

        // Apply limit and offset from options
        if (options.limit !== undefined)
          query = query.limit(options.limit)

        if (options.offset !== undefined)
          query = query.offset(options.offset)

        const model = await query.selectAll().execute()
        return model.map(modelItem => new ${modelName}Model(modelItem))
      }

      // Method to get a ${modelName} by criteria
      static async get(): Promise<${modelName}Model[]> {
        const query = db.selectFrom('${tableName}')

        const model = await query.selectAll().execute()

        return model.map(modelItem => new ${modelName}Model(modelItem))
      }

      // Method to get a ${modelName} by criteria
      async get(): Promise<${modelName}Model[]> {
        if (this.hasSelect) {
          const model = await this.query.execute()

          return model.map((modelItem: ${modelName}Model) => new ${modelName}Model(modelItem))
        }

        const model = await this.query.selectAll().execute()

        return model.map((modelItem: ${modelName}Model) => new ${modelName}Model(modelItem))
      }

      static async count(): Promise<number> {
        const instance = new this(null)

        const results = await instance.query.selectAll().execute()

        return results.length
      }

      async count(): Promise<number> {
        if (this.hasSelect) {
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

        return await find(Number(result.insertId)) as ${modelName}Model
      }

      // Method to remove a ${modelName}
      static async remove(id: number): Promise<void> {
        await db.deleteFrom('${tableName}')
          .where('id', '=', id)
          .execute()
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

        return new ${modelName}Model(model)
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
      async update(${formattedModelName}: ${modelName}Update): Promise<${modelName}Model | null> {
        if (this.id === undefined)
          throw new Error('${modelName} ID is undefined')

        const filteredValues = Object.keys(new${modelName})
            .filter(key => this.fillable.includes(key))
            .reduce((obj, key) => {
                obj[key] = new${modelName}[key];
                return obj;
            }, {});

        await db.updateTable('${tableName}')
          .set(filteredValues)
          .where('id', '=', this.id)
          .executeTakeFirst()

          return await this.find(Number(this.id))
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

      // Method to delete the ${formattedModelName} instance
      async delete(): Promise<void> {
        if (this.id === undefined)
          throw new Error('${modelName} ID is undefined')

        await db.deleteFrom('${tableName}')
          .where('id', '=', this.id)
          .execute()
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
        const output: Partial<${modelName}Type> = { ...this.${formattedModelName} }

        this.hidden.forEach((attr) => {
          if (attr in output)
            delete output[attr as keyof Partial<${modelName}Type>]
        })

        type ${modelName} = Omit<${modelName}Type, 'password'>

        return output as ${modelName}
      }

      parseResult(model: any): ${modelName}Model {
        for (const hiddenAttribute of this.hidden) {
          delete model[hiddenAttribute]
           delete model.${formattedModelName}[hiddenAttribute]
        }

        return model
      }

      ${twoFactorStatements}
    }

    async function find(id: number, fields?: (keyof ${modelName}Type)[]): Promise<${modelName}Model | null> {
      let query = db.selectFrom('${tableName}').where('id', '=', id)

      if (fields) query = query.select(fields)
      else query = query.selectAll()

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
