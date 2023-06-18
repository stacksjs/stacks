import type { FieldOptions, Validation } from '@vinejs/vine/build/src/types'
import type { Money } from '@stacksjs/types'
import { BaseLiteralType } from '@vinejs/vine'
import { isMoney } from '../is'

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
