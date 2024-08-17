import schema from '@vinejs/vine'
import { SimpleMessagesProvider, errors as VineError } from '@vinejs/vine'
import rule from 'validator'

export { schema, rule, SimpleMessagesProvider, VineError }

type SchemaString = string
type SchemaNumber = number
type SchemaBoolean = boolean
type SchemaEnum = string[]

export type SchemaType = SchemaString | SchemaNumber | SchemaBoolean | SchemaEnum

export type { Infer } from '@vinejs/vine/types'
export { VineString, VineBoolean, VineEnum, VineNumber, VineDate } from '@vinejs/vine'

export const validate = {
  string: (defaultValue = ''): SchemaString => defaultValue,
  number: (defaultValue = 1): SchemaNumber => defaultValue,
  boolean: (defaultValue = true): SchemaBoolean => defaultValue,
  enum: (values: string[]): SchemaEnum => values,
}
