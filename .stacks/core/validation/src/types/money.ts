import type { FieldContext, FieldOptions, Validation } from '@vinejs/vine/build/src/types'
import type { Dinero } from '@stacksjs/utils'
import { USD, currency } from '@stacksjs/utils'
import { BaseLiteralType } from '@vinejs/vine'
import { validator } from '../'

export const isMoney = validator.createRule((value: unknown, _, field: FieldContext) => {
  /**
   * Convert string representation of a number to a JavaScript
   * Number data type.
   */
  const numericValue = validator.helpers.asNumber(value)

  /**
   * Report error, if the value is NaN post-conversion
   */
  if (Number.isNaN(numericValue)) {
    field.report(
      'The {{ field }} field value must be a number',
      'money',
      field,
    )
    return
  }

  /**
   * Create amount type
   */
  const amount = currency({ amount: numericValue, currency: USD })

  /**
   * Mutate the field's value
   */
  field.mutate(amount, field)
})

export type Money = Dinero<number>

export class ValidatorMoney extends BaseLiteralType<Money, Money> {
  constructor(options?: FieldOptions, validations?: Validation<any>[]) {
    super(options, validations || [isMoney()])
  }

  clone() {
    return new ValidatorMoney(
      this.cloneOptions(),
      this.cloneValidations(),
    ) as this
  }
}
