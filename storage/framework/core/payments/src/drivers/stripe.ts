import Stripe from 'stripe'

const apiKey = ''

const stripe = new Stripe(apiKey, {
  apiVersion: '2023-10-16',
})

// TODO: learn about subscriptions
export const paymentIntent = (function () {
  async function create(params: Stripe.PaymentIntentCreateParams) {
    return await stripe.paymentIntents.create(params)
  }

  async function retrieve(stripeId: string) {
    return await stripe.paymentIntents.retrieve(stripeId)
  }

  async function update(stripeId: string, params: Stripe.PaymentIntentCreateParams) {
    return await stripe.paymentIntents.update(stripeId, params)
  }

  async function cancel(stripeId: string) {
    return await stripe.paymentIntents.cancel(stripeId)
  }

  return { create, retrieve, update, cancel }
}())

export const balance = (function () {
  async function retrieve() {
    return await stripe.balance.retrieve()
  }

  return { retrieve }
}())

export const customer = (function () {
  async function create(params: Stripe.CustomerCreateParams) {
    return await stripe.customers.create(params)
  };

  async function update(stripeId: string, params: Stripe.CustomerCreateParams) {
    return await stripe.customers.update(stripeId, params)
  };

  async function retrieve(stripeId: string) {
    return await stripe.customers.retrieve(stripeId)
  };

  return { create, update, retrieve }
}())

export const charge = (function () {
  async function create(params: Stripe.ChargeCreateParams) {
    return await stripe.charges.create(params)
  }

  async function update(stripeId: string, params: Stripe.ChargeCreateParams) {
    return await stripe.charges.update(stripeId, params)
  }

  async function capture(stripeId: string) {
    return await stripe.charges.capture(stripeId)
  }

  async function retrieve(stripeId: string) {
    return await stripe.charges.retrieve(stripeId)
  }

  return { create, update, retrieve, capture }
}())

export const balanceTransactions = (function () {
  async function retrieve(stripeId: string) {
    await stripe.balanceTransactions.retrieve(stripeId)
  }

  async function list(limit: number) {
    await stripe.balanceTransactions.list({ limit })
  }

  return { retrieve, list }
}())

export const dispute = (function () {
  async function retrieve(stripeId: string) {
    return await stripe.disputes.retrieve(stripeId)
  }

  async function update(stripeId: string, params: Stripe.DisputeUpdateParams) {
    return await stripe.disputes.update(stripeId, params)
  }

  async function close(stripeId: string) {
    return await stripe.disputes.close(stripeId)
  }

  async function list(limit: number) {
    return await stripe.disputes.list({ limit })
  }

  return { retrieve, update, close, list }
}())

export const events = (function () {
  async function retrieve(stripeId: string) {
    await stripe.events.retrieve(stripeId)
  }

  async function list(limit: number) {
    await stripe.events.list({ limit })
  }

  return { retrieve, list }
}())
