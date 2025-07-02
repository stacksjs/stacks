import type { ValidationType, Validator } from '@stacksjs/ts-validation'
import type { Model } from '@stacksjs/types'
import { HttpError } from '@stacksjs/error-handling'
import { path } from '@stacksjs/path'
import { globSync } from '@stacksjs/storage'
import { snakeCase } from '@stacksjs/strings'
import { MessageProvider, setCustomMessages } from '@stacksjs/ts-validation'
import { reportError, schema } from './'

interface RequestData {
  [key: string]: any
}

interface ValidationField {
  rule: ValidationType
  message: Record<string, string>
}

interface CustomAttributes {
  [key: string]: ValidationField
}

export function isObjectNotEmpty(obj: object | undefined): boolean {
  if (obj === undefined)
    return false

  return Object.keys(obj).length > 0
}

export async function validateField(modelFile: string, params: RequestData): Promise<any> {
  const modelFiles = globSync([path.userModelsPath('*.ts'), path.storagePath('framework/defaults/models/**/*.ts')], { absolute: true })
  const modelPath = modelFiles.find(file => file.endsWith(`${modelFile}.ts`))

  if (!modelPath)
    throw new HttpError(500, `Model ${modelFile} not found`)

  const model = (await import(modelPath)).default as Model
  const attributes = model.attributes

  const ruleObject: Record<string, Validator<any>> = {}
  const messageObject: Record<string, string> = {}

  for (const key in attributes) {
    if (Object.prototype.hasOwnProperty.call(attributes, key)) {
      const attributeKey = attributes[key]

      const isRequired = 'isRequired' in (attributeKey.validation?.rule ?? {})
        ? (attributeKey.validation?.rule as Validator<any>).isRequired
        : false

      // Skip validation if the attribute has a default value or is required
      if (attributeKey.default !== undefined || isRequired === false)
        continue

      ruleObject[snakeCase(key)] = attributeKey.validation?.rule as Validator<any>

      const validatorMessages = attributes[key]?.validation?.message

      if (validatorMessages) {
        for (const validatorMessageKey in validatorMessages) {
          const validatorMessageString = `${key}.${validatorMessageKey}`
          messageObject[validatorMessageString] = validatorMessages[validatorMessageKey] || ''
        }
      }
    }
  }

  try {
    setCustomMessages(new MessageProvider(messageObject))

    const validator = schema.object(ruleObject)
    const result = await validator.validate(params)

    if (!result.valid) {
      reportError(result.errors)
      throw new HttpError(422, JSON.stringify(result.errors))
    }

    return result
  }
  catch (error: any) {
    if (error instanceof HttpError)
      throw error
  }
}

export async function customValidate(attributes: CustomAttributes, params: RequestData): Promise<any> {
  const ruleObject: Record<string, Validator<any>> = {}
  const messageObject: Record<string, string> = {}

  for (const key in attributes) {
    if (Object.prototype.hasOwnProperty.call(attributes, key)) {
      const rule = attributes[key]?.rule
      if (rule)
        ruleObject[key] = rule as Validator<any>

      const validatorMessages = attributes[key]?.message

      for (const validatorMessageKey in validatorMessages) {
        const validatorMessageString = `${key}.${validatorMessageKey}`
        messageObject[validatorMessageString] = attributes[key]?.message[validatorMessageKey] || ''
      }
    }
  }

  try {
    const validator = schema.object().shape(ruleObject)
    const result = await validator.validate(params)

    if (!result.valid)
      throw new HttpError(422, JSON.stringify(result.errors))

    return result
  }
  catch (error: any) {
    if (error instanceof HttpError)
      throw error
  }
}
