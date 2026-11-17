import type { upsells } from '@stacksjs/commerce'
import { db } from '@stacksjs/database/runtime'

/**
 * How the storefront takes the money for a post-purchase offer the shopper
 * accepted. Override this file at `app/Storefront/UpsellCharge.ts` to charge
 * your own way (a stored mandate, a provider of your own).
 *
 * The default follows how the order itself was paid:
 *
 * - The order has a payment a provider took (a `payments` row with a
 *   `transaction_id` and `payment_provider`): the addition is charged
 *   off-session to the customer's default saved payment method through that
 *   provider's driver, with no second checkout.
 * - It has none, as with the default storefront's mock checkout: the addition
 *   is collected the same way the order will be, and no payment is recorded.
 */
export async function storefrontUpsellCharger(order: Record<string, any>): Promise<upsells.UpsellCharger> {
  const payment = await (db as any)
    .selectFrom('payments')
    .where('order_id', '=', order.id)
    .where('transaction_id', 'is not', null)
    .where('payment_provider', 'is not', null)
    .orderBy('id', 'asc')
    .selectAll()
    .executeTakeFirst()

  if (!payment)
    return 'collect-later'

  const { paymentDriver } = await import('@stacksjs/payments')
  const { upsells: { chargeDefaultMethod } } = await import('@stacksjs/commerce')
  const customer = order.customer_id
    ? await (db as any).selectFrom('customers').where('id', '=', order.customer_id).selectAll().executeTakeFirst()
    : null
  const payer = {
    id: customer?.user_id ?? customer?.id ?? order.customer_id,
    email: customer?.email ?? null,
    name: customer?.name ?? null,
    stripe_id: customer?.stripe_id ?? null,
  }
  return chargeDefaultMethod(paymentDriver(String(payment.payment_provider)), payer)
}
