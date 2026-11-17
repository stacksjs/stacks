import type { RejectedCodeReason } from '@stacksjs/commerce/discounts/engine'

/** Why a discount code did nothing, in the shopper's words. */
export const DISCOUNT_CODE_MESSAGES: Record<RejectedCodeReason, string> = {
  'not-found': 'That discount code does not exist.',
  'inactive': 'That discount code is not active yet.',
  'expired': 'That discount code has expired.',
  'exhausted': 'That discount code has been used up.',
  'requirements-not-met': 'Your cart does not meet that code\'s requirements yet.',
  'no-eligible-items': 'That discount code does not apply to anything in your cart.',
  'not-combinable': 'That discount code cannot be combined with the discount already applied.',
}
