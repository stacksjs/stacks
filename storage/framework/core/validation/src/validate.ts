import schema, { Vine } from '@vinejs/vine'
import rule from 'validator'
import { MoneyValidator } from './types/money'

export { schema, rule }

// @ts-expect-error - investigate why this is not working
Vine.macro('money', () => {
  return new MoneyValidator()
})

type SchemaString = string
type SchemaNumber = number
type SchemaBoolean = boolean
type SchemaEnum = string[]

export type SchemaType = SchemaString | SchemaNumber | SchemaBoolean | SchemaEnum

export const validate = {
  string: (defaultValue = ''): SchemaString => defaultValue,
  number: (defaultValue = 1): SchemaNumber => defaultValue,
  boolean: (defaultValue = true): SchemaBoolean => defaultValue,
  enum: (values: string[]): SchemaEnum => values,
}

export type { Infer } from '@vinejs/vine/types'
export { VineString, VineBoolean, VineEnum, VineNumber } from '@vinejs/vine'
