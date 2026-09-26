import type { UserModel } from '@stacksjs/orm'
import { describe, expect, it } from 'bun:test'
import { manageInvoice, managePaymentMethod, manageSubscription } from '../src'

// The payment modules asked `user.hasStripeId()` before doing anything. No
// user record has ever had that method: the billable trait binds its own bag
// onto a model instance, and `hasStripeId` was never in it. So every one of
// these threw `TypeError: user.hasStripeId is not a function` on a real user,
// including the ones the billable instance methods (`user.paymentMethods()`,
// `user.defaultPaymentMethod()`) delegate to.
//
// A user with no Stripe customer is the cheap case to drive: each call has to
// get as far as the check and answer it, without touching Stripe or the
// database, and the answer has to be the intended error rather than the
// TypeError.

// A record as the ORM hands it over: columns and the model methods, and no
// `hasStripeId` among them.
const userWithoutStripe = { id: 1, email: 'nobody@example.com', stripe_id: null } as unknown as UserModel

describe('payments read the Stripe id off the record', () => {
  it('lists invoices only for a Stripe customer', async () => {
    await expect(manageInvoice.list(userWithoutStripe)).rejects.toThrow('Customer does not exist in Stripe')
  })

  it('lists payment methods only for a Stripe customer', async () => {
    await expect(managePaymentMethod.listPaymentMethods(userWithoutStripe)).rejects.toThrow('Customer does not exist in Stripe')
    await expect(managePaymentMethod.retrieveDefaultPaymentMethod(userWithoutStripe)).rejects.toThrow('Customer does not exist in Stripe')
  })

  it('retrieves a subscription only for a Stripe customer', async () => {
    await expect(manageSubscription.retrieve(userWithoutStripe, 'sub_123')).rejects.toThrow('Customer does not exist in Stripe')
  })
})
