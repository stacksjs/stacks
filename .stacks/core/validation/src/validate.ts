import validator, { Vine as Validator } from '@vinejs/vine'
import { MoneyValidator } from './types/money'

Validator.macro('money', () => {
  return new MoneyValidator()
})

const validate = validator.validate
const string = validator.string
const number = validator.number
const boolean = validator.boolean
const array = validator.array
const object = validator.object
const any = validator.any
const email = () => validator.string().email()

export { validate, validator, Validator, string, number, boolean, array, object, any, email }
