import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { PaymentTransaction, User } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

interface SettledBillingRead {
  label: string
  result: PromiseSettledResult<unknown>
}

export function billingReadFailures(reads: SettledBillingRead[]): string[] {
  return reads
    .filter((read): read is SettledBillingRead & { result: PromiseRejectedResult } => read.result.status === 'rejected')
    .map((read) => {
      const reason = read.result.reason
      const detail = reason instanceof Error ? reason.message : String(reason || '')
      return detail ? `${read.label}: ${detail}` : read.label
    })
}

export function serializeBillingTransaction(transaction: any): Record<string, unknown> {
  return {
    id: transaction.get('id'),
    uuid: transaction.get('uuid'),
    name: transaction.get('name'),
    description: transaction.get('description'),
    amount: transaction.get('amount'),
    type: transaction.get('type'),
    provider_id: transaction.get('provider_id'),
    payment_method_id: transaction.get('payment_method_id'),
  }
}

export async function settleBillableRead(user: any, methodName: string): Promise<PromiseSettledResult<unknown>> {
  const method = user?.[methodName]
  if (typeof method !== 'function') {
    return {
      status: 'rejected',
      reason: new Error('Enable the billable trait on app/Models/User.ts to use provider billing.'),
    }
  }

  try {
    return { status: 'fulfilled', value: await method.call(user) }
  }
  catch (reason) {
    return { status: 'rejected', reason }
  }
}

/**
 * One authenticated read for the Billing settings screen.
 *
 * The dashboard server only delegates `/api/*` routes to the Stacks router.
 * Keeping the aggregation here makes `buddy dev --dashboard` self-contained
 * and prevents the browser from depending on a separately running API port.
 */
export default new Action({
  name: 'BillingShowAction',
  description: 'Returns the authenticated user billing overview for the dashboard.',
  method: 'GET',
  apiResponse: true,
  async handle(request: RequestInstance) {
    const authenticatedUser = await request.user()
    if (!authenticatedUser)
      return response.unauthorized('Authentication required')

    const user = await User.find(authenticatedUser.id)
    if (!user)
      return response.unauthorized('Authentication required')

    const [subscription, paymentMethods, defaultPaymentMethod, transactions] = await Promise.all([
      settleBillableRead(user, 'activeSubscription'),
      settleBillableRead(user, 'paymentMethods'),
      settleBillableRead(user, 'defaultPaymentMethod'),
      PaymentTransaction.where('user_id', authenticatedUser.id).orderByDesc('id').get(),
    ])

    const providerReads: SettledBillingRead[] = [
      { label: 'Active plan', result: subscription },
      { label: 'Payment methods', result: paymentMethods },
      { label: 'Default payment method', result: defaultPaymentMethod },
    ]

    return {
      subscription: subscription.status === 'fulfilled' ? subscription.value : null,
      paymentMethods: paymentMethods.status === 'fulfilled' ? paymentMethods.value : [],
      defaultPaymentMethod: defaultPaymentMethod.status === 'fulfilled' ? defaultPaymentMethod.value : null,
      transactions: transactions.map(serializeBillingTransaction),
      unavailable: billingReadFailures(providerReads),
    }
  },
})
