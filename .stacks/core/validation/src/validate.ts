import type { VineString as ValidationString } from '@vinejs/vine'
import validator, { Vine as Validator } from '@vinejs/vine'
import { MoneyValidator } from './types/money'

Validator.macro('money', () => {
  return new MoneyValidator()
})

const validate: Validator['validate'] = () => validator.validate()

const string: ValidationString = validator.string()
const number: Validator['number'] = validator.number
const boolean: Validator['boolean'] = validator.boolean
const array: Validator['array'] = validator.array
const object: Validator['object'] = validator.object
const any: Validator['any'] = validator.any
// const email = () => validator.string().email()

export { validate, validator, Validator, string, number, boolean, array, object, any }
