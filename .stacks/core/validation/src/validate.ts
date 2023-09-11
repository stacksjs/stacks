import validator, { Vine as Validator } from '@vinejs/vine'
import { MoneyValidator } from './types/money'

Validator.macro('money', () => {
  return new MoneyValidator()
})

const validate: Validator = validator
const RuleString: Validator['string'] = (...args) => validator.string(...args)
const RuleNumber: Validator['number'] = (...args) => validator.number(...args)
const RuleBoolean: Validator['boolean'] = (...args) => validator.boolean(...args)
const RuleArray: Validator['array'] = (...args) => validator.array(...args)
const RuleObject: Validator['object'] = (...args) => validator.object(...args)
const RuleAny: Validator['any'] = (...args) => validator.any(...args)
// const email = () => validator.string().email()

export type { Infer } from '@vinejs/vine/types'
export { VineString, VineBoolean, VineEnum, VineNumber } from '@vinejs/vine'
export { validate, validator, Validator, RuleString, RuleNumber, RuleBoolean, RuleArray, RuleObject, RuleAny }
