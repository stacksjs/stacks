import v, { Vine as Validator } from '@vinejs/vine'
import { MoneyValidator } from './types/money'

// @ts-expect-error - investigate why this is not working
Validator.macro('money', () => {
  return new MoneyValidator()
})

export const validator: Validator = v
// validator.string().email()
type SchemaString = string
type SchemaNumber = number
type SchemaBoolean = boolean
type SchemaEnum = string[]

export type SchemaType = SchemaString | SchemaNumber | SchemaBoolean | SchemaEnum

export const validate = {
  string: (defaultValue: string = ''): SchemaString => defaultValue,
  number: (defaultValue: number = 1): SchemaNumber => defaultValue,
  boolean: (defaultValue: boolean = true): SchemaBoolean => defaultValue,
  enum: (values: string[]): SchemaEnum => values,
}

export const RuleString: Validator['string'] = (...args) => validator.string(...args)
export const RuleNumber: Validator['number'] = (...args) => validator.number(...args)
export const RuleBoolean: Validator['boolean'] = (...args) => validator.boolean(...args)
export const RuleArray: Validator['array'] = (...args) => validator.array(...args)
export const RuleObject: Validator['object'] = (...args) => validator.object(...args)
export const RuleAny: Validator['any'] = (...args) => validator.any(...args)
// const email = () => validator.string().email()

export type { Infer } from '@vinejs/vine/types'
export { VineString, VineBoolean, VineEnum, VineNumber } from '@vinejs/vine'
