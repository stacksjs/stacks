import schema, { SimpleMessagesProvider, errors as VineError } from '@vinejs/vine'
import rule from 'validator'

export { rule, schema, SimpleMessagesProvider, VineError }

type SchemaString = string
type SchemaNumber = number
type SchemaBoolean = boolean
type SchemaEnum = string[]

export type SchemaType = SchemaString | SchemaNumber | SchemaBoolean | SchemaEnum

export { VineBoolean, VineDate, VineEnum, VineNumber, VineString } from '@vinejs/vine'
export type { Infer } from '@vinejs/vine/types'

export const validate = {
  string: (defaultValue = ''): SchemaString => defaultValue,
  number: (defaultValue = 1): SchemaNumber => defaultValue,
  boolean: (defaultValue = true): SchemaBoolean => defaultValue,
  enum: (values: string[]): SchemaEnum => values,
}
