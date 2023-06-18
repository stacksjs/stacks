import validator, { Vine as Validator } from '@vinejs/vine'
import { ValidatorMoney } from './types/money'

Validator.macro('money', () => {
  return new ValidatorMoney()
})

/**
 * Informing TypeScript about the newly added method
 */
declare module '@stacksjs/validation' {
  interface Validator {
    money(): ValidatorMoney
  }
}

export const validate = validator.validate
export { validator, Validator, ValidatorMoney }
