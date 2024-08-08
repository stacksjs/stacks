import { path } from '@stacksjs/path'
import { snakeCase } from '@stacksjs/strings'
import type { Model } from '@stacksjs/types'
import type { VineType } from '@stacksjs/types'
import type { SchemaTypes } from '@vinejs/vine/types'
import { SimpleMessagesProvider, VineError, reportError, schema } from './'

interface RequestData {
  [key: string]: string | number | null | undefined | boolean
}

interface ValidationType {
  rule: VineType
  message: { [key: string]: string }
}

interface ValidationField {
  [key: string]: string | ValidationType
  validation: ValidationType
}

interface CustomAttributes {
  [key: string]: ValidationField
}

export async function validateField(modelFile: string, params: RequestData): Promise<any> {
  const model = (await import(/* @vite-ignore */ path.userModelsPath(`${modelFile}.ts`))).default as Model
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
      ruleObject[key] = attributes[key]?.validation?.rule
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
