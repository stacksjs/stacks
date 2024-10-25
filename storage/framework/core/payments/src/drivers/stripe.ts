import Stripe from 'stripe'

const apiKey = process.env.STRIPE_SECRET_KEY || ''

const client = new Stripe(apiKey, {
  apiVersion: '2024-09-30.acacia',
})

// TODO: learn about subscriptions
export interface PaymentIntent {
  create: (params: Stripe.PaymentIntentCreateParams) => Promise<Stripe.Response<Stripe.PaymentIntent>>
  retrieve: (stripeId: string) => Promise<Stripe.Response<Stripe.PaymentIntent>>
  update: (stripeId: string, params: Stripe.PaymentIntentCreateParams) => Promise<Stripe.Response<Stripe.PaymentIntent>>
  cancel: (stripeId: string) => Promise<Stripe.Response<Stripe.PaymentIntent>>
}

export const paymentIntent: PaymentIntent = (() => {
  async function create(params: Stripe.PaymentIntentCreateParams) {
    return await client.paymentIntents.create(params)
  }

  async function retrieve(stripeId: string) {
    return await client.paymentIntents.retrieve(stripeId)
  }

  async function update(stripeId: string, params: Stripe.PaymentIntentCreateParams) {
    return await client.paymentIntents.update(stripeId, params)
  }

  async function cancel(stripeId: string) {
    return await client.paymentIntents.cancel(stripeId)
  }

  return { create, retrieve, update, cancel }
})()

export interface Balance {
  retrieve: () => Promise<Stripe.Response<Stripe.Balance>>
}

export const balance: Balance = (() => {
  async function retrieve() {
    return await client.balance.retrieve()
  }

  return { retrieve }
})()

export interface Customer {
  create: (params: Stripe.CustomerCreateParams) => Promise<Stripe.Response<Stripe.Customer>>
  update: (stripeId: string, params: Stripe.CustomerCreateParams) => Promise<Stripe.Response<Stripe.Customer>>
  del: (stripeId: string) => Promise<Stripe.Response<Stripe.DeletedCustomer>>
  retrieve: (stripeId: string) => Promise<Stripe.Response<Stripe.Customer | Stripe.DeletedCustomer>>
}

export const customer: Customer = (() => {
  async function create(params: Stripe.CustomerCreateParams): Promise<Stripe.Response<Stripe.Customer>> {
    return await client.customers.create(params)
  }

  async function update(stripeId: string, params: Stripe.CustomerCreateParams): Promise<Stripe.Response<Stripe.Customer>> {
    return await client.customers.update(stripeId, params)
  }

  async function del(stripeId: string): Promise<Stripe.Response<Stripe.DeletedCustomer>> {
    return await client.customers.del(stripeId)
  }

  async function retrieve(stripeId: string): Promise<Stripe.Response<Stripe.Customer | Stripe.DeletedCustomer>> {
    return await client.customers.retrieve(stripeId)
  }

  return { create, update, retrieve, del }
})()

export interface Charge {
  create: (params: Stripe.ChargeCreateParams) => Promise<Stripe.Response<Stripe.Charge>>
  update: (stripeId: string, params: Stripe.ChargeCreateParams) => Promise<Stripe.Response<Stripe.Charge>>
  capture: (stripeId: string) => Promise<Stripe.Response<Stripe.Charge>>
  retrieve: (stripeId: string) => Promise<Stripe.Response<Stripe.Charge>>
}

export const charge: Charge = (() => {
  async function create(params: Stripe.ChargeCreateParams): Promise<Stripe.Response<Stripe.Charge>> {
    return await client.charges.create(params)
  }

  async function update(stripeId: string, params: Stripe.ChargeCreateParams): Promise<Stripe.Response<Stripe.Charge>> {
    return await client.charges.update(stripeId, params)
  }

  async function capture(stripeId: string): Promise<Stripe.Response<Stripe.Charge>> {
    return await client.charges.capture(stripeId)
  }

  async function retrieve(stripeId: string): Promise<Stripe.Response<Stripe.Charge>> {
    return await client.charges.retrieve(stripeId)
  }

  return { create, update, retrieve, capture }
})()

export interface Subscription {
  create: (params: Stripe.SubscriptionCreateParams) => Promise<Stripe.Response<Stripe.Subscription>>
}

export const subscription: Subscription = (() => {
  async function create(params: Stripe.SubscriptionCreateParams): Promise<Stripe.Response<Stripe.Subscription>> {
    return await client.subscriptions.create(params)
  }

  return { create }
})()


export interface Refund {
  create: (params: Stripe.RefundCreateParams) => Promise<Stripe.Response<Stripe.Refund>>
  retrieve: (refundId: string) => Promise<Stripe.Response<Stripe.Refund>>
  update: (refundId: string, params: Stripe.RefundUpdateParams) => Promise<Stripe.Response<Stripe.Refund>>
  list: (params: Stripe.RefundListParams) => Promise<Stripe.Response<Stripe.ApiList<Stripe.Refund>>>
}

export const refund: Refund = (() => {
  async function create(params: Stripe.RefundCreateParams): Promise<Stripe.Response<Stripe.Refund>> {
    return await client.refunds.create(params)
  }

  async function retrieve(refundId: string): Promise<Stripe.Response<Stripe.Refund>> {
    return await client.refunds.retrieve(refundId)
  }

  async function update(refundId: string, params: Stripe.RefundUpdateParams): Promise<Stripe.Response<Stripe.Refund>> {
    return await client.refunds.update(refundId, params)
  }

  async function list(params: Stripe.RefundListParams): Promise<Stripe.Response<Stripe.ApiList<Stripe.Refund>>> {
    return await client.refunds.list(params)
  }

  return { create, retrieve, update, list }
})()

export interface PaymentMethod {
  create: (params: Stripe.PaymentMethodCreateParams) => Promise<Stripe.Response<Stripe.PaymentMethod>>
  retrieve: (paymentMethodId: string) => Promise<Stripe.Response<Stripe.PaymentMethod>>
  update: (paymentMethodId: string, params: Stripe.PaymentMethodUpdateParams) => Promise<Stripe.Response<Stripe.PaymentMethod>>
  list: (params: Stripe.PaymentMethodListParams) => Promise<Stripe.Response<Stripe.ApiList<Stripe.PaymentMethod>>>
  attach: (paymentMethodId: string, params: Stripe.PaymentMethodAttachParams) => Promise<Stripe.Response<Stripe.PaymentMethod>>
  detach: (paymentMethodId: string) => Promise<Stripe.Response<Stripe.PaymentMethod>>
}

export const paymentMethod: PaymentMethod = (() => {
  async function create(params: Stripe.PaymentMethodCreateParams): Promise<Stripe.Response<Stripe.PaymentMethod>> {
    return await client.paymentMethods.create(params)
  }

  async function retrieve(paymentMethodId: string): Promise<Stripe.Response<Stripe.PaymentMethod>> {
    return await client.paymentMethods.retrieve(paymentMethodId)
  }

  async function update(paymentMethodId: string, params: Stripe.PaymentMethodUpdateParams): Promise<Stripe.Response<Stripe.PaymentMethod>> {
    return await client.paymentMethods.update(paymentMethodId, params)
  }

  async function list(params: Stripe.PaymentMethodListParams): Promise<Stripe.Response<Stripe.ApiList<Stripe.PaymentMethod>>> {
    return await client.paymentMethods.list(params)
  }

  async function attach(paymentMethodId: string, params: Stripe.PaymentMethodAttachParams): Promise<Stripe.Response<Stripe.PaymentMethod>> {
    return await client.paymentMethods.attach(paymentMethodId, params)
  }

  async function detach(paymentMethodId: string): Promise<Stripe.Response<Stripe.PaymentMethod>> {
    return await client.paymentMethods.detach(paymentMethodId)
  }

  return { create, retrieve, update, list, attach, detach }
})()


export interface BalanceTransactions {
  retrieve: (stripeId: string) => Promise<Stripe.Response<Stripe.BalanceTransaction>>
  list: (limit: number) => Promise<Stripe.Response<Stripe.ApiList<Stripe.BalanceTransaction>>>
}

export const balanceTransactions: BalanceTransactions = (() => {
  async function retrieve(stripeId: string): Promise<Stripe.Response<Stripe.BalanceTransaction>> {
    return await client.balanceTransactions.retrieve(stripeId)
  }

  async function list(limit: number): Promise<Stripe.Response<Stripe.ApiList<Stripe.BalanceTransaction>>> {
    return await client.balanceTransactions.list({ limit })
  }

  return { retrieve, list }
})()

export interface Checkout {
  create: (params: Stripe.Checkout.SessionCreateParams) => Promise<Stripe.Response<Stripe.Checkout.Session>>
  retrieve: (sessionId: string) => Promise<Stripe.Response<Stripe.Checkout.Session>>
  expire: (sessionId: string) => Promise<Stripe.Response<Stripe.Checkout.Session>>
  list: (params: Stripe.Checkout.SessionListParams) => Promise<Stripe.Response<Stripe.ApiList<Stripe.Checkout.Session>>>
  listLineItems: (sessionId: string, params?: Stripe.Checkout.SessionListLineItemsParams) => Promise<Stripe.Response<Stripe.ApiList<Stripe.LineItem>>>
}

export const checkout: Checkout = (() => {
  async function create(params: Stripe.Checkout.SessionCreateParams): Promise<Stripe.Response<Stripe.Checkout.Session>> {
    return await client.checkout.sessions.create(params)
  }

  async function retrieve(sessionId: string): Promise<Stripe.Response<Stripe.Checkout.Session>> {
    return await client.checkout.sessions.retrieve(sessionId)
  }

  async function expire(sessionId: string): Promise<Stripe.Response<Stripe.Checkout.Session>> {
    return await client.checkout.sessions.expire(sessionId)
  }

  async function list(params: Stripe.Checkout.SessionListParams): Promise<Stripe.Response<Stripe.ApiList<Stripe.Checkout.Session>>> {
    return await client.checkout.sessions.list(params)
  }

  async function listLineItems(sessionId: string, params?: Stripe.Checkout.SessionListLineItemsParams): Promise<Stripe.Response<Stripe.ApiList<Stripe.LineItem>>> {
    return await client.checkout.sessions.listLineItems(sessionId, params)
  }

  return { create, retrieve, expire, list, listLineItems }
})()


export interface Dispute {
  retrieve: (stripeId: string) => Promise<Stripe.Response<Stripe.Dispute>>
  update: (stripeId: string, params: Stripe.DisputeUpdateParams) => Promise<Stripe.Response<Stripe.Dispute>>
  close: (stripeId: string) => Promise<Stripe.Response<Stripe.Dispute>>
  list: (limit: number) => Promise<Stripe.Response<Stripe.ApiList<Stripe.Dispute>>>
}

export const dispute: Dispute = (() => {
  async function retrieve(stripeId: string): Promise<Stripe.Response<Stripe.Dispute>> {
    return await client.disputes.retrieve(stripeId)
  }

  async function update(stripeId: string, params: Stripe.DisputeUpdateParams): Promise<Stripe.Response<Stripe.Dispute>> {
    return await client.disputes.update(stripeId, params)
  }

  async function close(stripeId: string): Promise<Stripe.Response<Stripe.Dispute>> {
    return await client.disputes.close(stripeId)
  }

  async function list(limit: number): Promise<Stripe.Response<Stripe.ApiList<Stripe.Dispute>>> {
    return await client.disputes.list({ limit })
  }

  return { retrieve, update, close, list }
})()

export interface PaymentEvents {
  retrieve: (stripeId: string) => Promise<Stripe.Response<Stripe.Event>>
  list: (limit: number) => Promise<Stripe.Response<Stripe.ApiList<Stripe.Event>>>
}

export const events: PaymentEvents = (() => {
  async function retrieve(stripeId: string): Promise<Stripe.Response<Stripe.Event>> {
    return await client.events.retrieve(stripeId)
  }

  async function list(limit: number): Promise<Stripe.Response<Stripe.ApiList<Stripe.Event>>> {
    return await client.events.list({ limit })
  }

  return { retrieve, list }
})()
