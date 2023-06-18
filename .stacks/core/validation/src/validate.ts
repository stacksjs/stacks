import validator, { Vine as Validator } from '@vinejs/vine'
import { MoneyValidator } from './types/money'

Validator.macro('money', () => {
  return new MoneyValidator()
})

/**
 * Informing TypeScript about the newly added method
 */
declare module '@stacksjs/validation' {
  interface Validator {
    money(): MoneyValidator
  }
}

const validate = validator.validate
export { validate, validator, Validator }
