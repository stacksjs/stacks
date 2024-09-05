import { path } from '@stacksjs/path'
import { snakeCase } from '@stacksjs/strings'
import type { Model } from '@stacksjs/types'
import type { VineType } from '@stacksjs/types'
import type { SchemaTypes } from '@vinejs/vine/types'
import { SimpleMessagesProvider, VineError, reportError, schema } from './'

interface RequestData {
  [key: string]: any
}

interface ValidationField {
  rule: VineType
  message: Record<string, string>
}

interface CustomAttributes {
  [key: string]: ValidationField
}

export function isObjectNotEmpty(obj: object): boolean {
  return Object.keys(obj).length > 0
}

export async function validateField(modelFile: string, params: RequestData): Promise<any> {
  const model = (await import(path.userModelsPath(`${modelFile}.ts`))).default as Model
  const attributes = model.attributes

  const ruleObject: Record<string, SchemaTypes> = {}
  const messageObject: Record<string, string> = {}

  for (const key in attributes) {
    if (Object.prototype.hasOwnProperty.call(attributes, key)) {
      ruleObject[snakeCase(key)] = attributes[key]?.validation?.rule
      const validatorMessages = attributes[key]?.validation?.message

      for (const validatorMessageKey in validatorMessages) {
        const validatorMessageString = `${key}.${validatorMessageKey}`
        messageObject[validatorMessageString] = attributes[key]?.validation?.message[validatorMessageKey] || ''
      }
    }
  }

  schema.messagesProvider = new SimpleMessagesProvider(messageObject)

  try {
    const vineSchema = schema.object(ruleObject)
    const validator = schema.compile(vineSchema)
    await validator.validate(params)
  } catch (error: any) {
    if (error instanceof VineError.E_VALIDATION_ERROR) reportError(error.messages)

    throw { status: 422, errors: error.messages }
  }
}

export async function customValidate(attributes: CustomAttributes, params: RequestData): Promise<any> {
  const ruleObject: Record<string, SchemaTypes> = {}
  const messageObject: Record<string, string> = {}

  for (const key in attributes) {
    if (Object.prototype.hasOwnProperty.call(attributes, key)) {
      const rule = attributes[key]?.rule
      if (rule) ruleObject[key] = rule as SchemaTypes

      const validatorMessages = attributes[key]?.message

      for (const validatorMessageKey in validatorMessages) {
        const validatorMessageString = `${key}.${validatorMessageKey}`
        messageObject[validatorMessageString] = attributes[key]?.message[validatorMessageKey] || ''
      }
    }
  }

  schema.messagesProvider = new SimpleMessagesProvider(messageObject)

  try {
    const vineSchema = schema.object(ruleObject)
    const validator = schema.compile(vineSchema)
    await validator.validate(params)
  } catch (error: any) {
    if (error instanceof VineError.E_VALIDATION_ERROR) reportError(error.messages)

    throw { status: 422, errors: error.messages }
  }
}
