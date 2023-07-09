import type { Money } from '@stacksjs/types'
import { BaseLiteralType } from '@vinejs/vine'

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
import type { FieldOptions, Validation } from '@vinejs/vine/build/src/types'
import { isMoney } from '../rules'

export class MoneyValidator extends BaseLiteralType<Money, Money> {
  constructor(options?: FieldOptions, validations?: Validation<any>[]) {
    super(options, validations || [isMoney()])
  }

  clone() {
    return new MoneyValidator(
      this.cloneOptions(),
      this.cloneValidations(),
    ) as this
  }
}
