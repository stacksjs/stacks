import type { FieldContext } from '@vinejs/vine/build/src/types'
import { USD, currency } from '@stacksjs/utils'
import { validator } from './validate'

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
