import { type VineString as ValidationString } from '@vinejs/vine'
import validator, { Vine as Validator } from '@vinejs/vine'
import { MoneyValidator } from './types/money'

Validator.macro('money', () => {
  return new MoneyValidator()
})

const validate: Validator = validator
const RuleString: ValidationString = validator.string()
const RuleNumber: Validator['number'] = validator.number
const RuleBoolean: Validator['boolean'] = validator.boolean
const RuleArray: Validator['array'] = validator.array
const RuleObject: Validator['object'] = validator.object
const RuleAny: Validator['any'] = validator.any
// const email = () => validator.string().email()

export { validate, validator, Validator, RuleString, RuleNumber, RuleBoolean, RuleArray, RuleObject, RuleAny }
