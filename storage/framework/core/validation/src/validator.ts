import { log } from '@stacksjs/cli'
import { path } from '@stacksjs/path'
import { Model } from '@stacksjs/types'
import { SimpleMessagesProvider, VineError, reportError, schema } from '@stacksjs/validation'
import type { SchemaTypes } from '@vinejs/vine/types'

interface RequestData {
  [key: string]: string | number | null | undefined | boolean
}

export async function validateField(modelFile: string, params: RequestData): Promise<any> {
  const model = (await import(/* @vite-ignore */path.userModelsPath(`${modelFile}.ts`))).default as Model
  const attributes = model.attributes

  const ruleObject: Record<string, SchemaTypes> = {}
  const messageObject: Record<string, string> = {}

  for (const key in attributes) {
    if (attributes.hasOwnProperty(key)) {
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

      throw { status: 422, errors: error.messages };
  }
}
