import process from 'node:process'
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

export interface Price {
  retrieve: (priceId: string, params: Stripe.PriceRetrieveParams) => Promise<Stripe.Response<Stripe.Price>>
  list: (params: Stripe.PriceListParams) => Promise<Stripe.ApiListPromise<Stripe.Price>>
  create: (params: Stripe.PriceCreateParams) => Promise<Stripe.Response<Stripe.Price>>
  update: (priceId: string, params: Stripe.PriceUpdateParams) => Promise<Stripe.Response<Stripe.Price>>
}

export const price: Price = (() => {
  async function retrieve(priceId: string, params: Stripe.PriceRetrieveParams): Promise<Stripe.Response<Stripe.Price>> {
    return await client.prices.retrieve(priceId, params)
  }

  async function list(params: Stripe.PriceListParams): Promise<Stripe.ApiListPromise<Stripe.Price>> {
    return await client.prices.list(params)
  }

  async function create(params: Stripe.PriceCreateParams): Promise<Stripe.Response<Stripe.Price>> {
    return await client.prices.create(params)
  }

  async function update(priceId: string, params: Stripe.PriceUpdateParams): Promise<Stripe.Response<Stripe.Price>> {
    return await client.prices.update(priceId, params)
  }

  return { retrieve, list, create, update }
})()

export interface Product {
  create: (params: Stripe.ProductCreateParams) => Promise<Stripe.Response<Stripe.Product>>
  retrieve: (productId: string, params?: Stripe.ProductRetrieveParams) => Promise<Stripe.Response<Stripe.Product>>
  update: (productId: string, params: Stripe.ProductUpdateParams) => Promise<Stripe.Response<Stripe.Product>>
  delete: (productId: string) => Promise<Stripe.Response<Stripe.DeletedProduct>>
  list: (params?: Stripe.ProductListParams) => Promise<Stripe.ApiListPromise<Stripe.Product>>
}

export const product: Product = (() => {
  async function create(params: Stripe.ProductCreateParams): Promise<Stripe.Response<Stripe.Product>> {
    return await client.products.create(params)
  }

  async function retrieve(productId: string, params?: Stripe.ProductRetrieveParams): Promise<Stripe.Response<Stripe.Product>> {
    return await client.products.retrieve(productId, params)
  }

  async function update(productId: string, params: Stripe.ProductUpdateParams): Promise<Stripe.Response<Stripe.Product>> {
    return await client.products.update(productId, params)
  }

  async function deleteProduct(productId: string): Promise<Stripe.Response<Stripe.DeletedProduct>> {
    return await client.products.del(productId)
  }

  async function list(params?: Stripe.ProductListParams): Promise<Stripe.ApiListPromise<Stripe.Product>> {
    return await client.products.list(params)
  }

  return { create, retrieve, update, delete: deleteProduct, list }
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

export interface Tax {
  retrieve: (taxId: string) => Promise<Stripe.Response<Stripe.Tax.Calculation>>
  create: (params: Stripe.Tax.CalculationCreateParams) => Promise<Stripe.Response<Stripe.Tax.Calculation>>
  listTaxCodes: (params?: Stripe.TaxCodeListParams) => Promise<Stripe.Response<Stripe.ApiList<Stripe.TaxCode>>>
  retrieveTaxCode: (taxCodeId: string) => Promise<Stripe.Response<Stripe.TaxCode>>
}

export const tax: Tax = (() => {
  async function retrieve(taxId: string): Promise<Stripe.Response<Stripe.Tax.Calculation>> {
    return await client.tax.calculations.retrieve(taxId)
  }

  async function create(params: Stripe.Tax.CalculationCreateParams): Promise<Stripe.Response<Stripe.Tax.Calculation>> {
    return await client.tax.calculations.create(params)
  }

  async function listTaxCodes(params?: Stripe.TaxCodeListParams): Promise<Stripe.Response<Stripe.ApiList<Stripe.TaxCode>>> {
    return await client.taxCodes.list(params)
  }

  async function retrieveTaxCode(taxCodeId: string): Promise<Stripe.Response<Stripe.TaxCode>> {
    return await client.taxCodes.retrieve(taxCodeId)
  }

  return { retrieve, create, listTaxCodes, retrieveTaxCode }
})()

export interface Promotion {
  createCoupon: (params: Stripe.CouponCreateParams) => Promise<Stripe.Response<Stripe.Coupon>>
  retrieveCoupon: (couponId: string) => Promise<Stripe.Response<Stripe.Coupon>>
  updateCoupon: (couponId: string, params: Stripe.CouponUpdateParams) => Promise<Stripe.Response<Stripe.Coupon>>
  deleteCoupon: (couponId: string) => Promise<Stripe.Response<Stripe.DeletedCoupon>>
  listCoupons: (params?: Stripe.CouponListParams) => Promise<Stripe.Response<Stripe.ApiList<Stripe.Coupon>>>
  createPromoCode: (params: Stripe.PromotionCodeCreateParams) => Promise<Stripe.Response<Stripe.PromotionCode>>
  retrievePromoCode: (promoCodeId: string) => Promise<Stripe.Response<Stripe.PromotionCode>>
  updatePromoCode: (promoCodeId: string, params: Stripe.PromotionCodeUpdateParams) => Promise<Stripe.Response<Stripe.PromotionCode>>
  listPromoCodes: (params?: Stripe.PromotionCodeListParams) => Promise<Stripe.Response<Stripe.ApiList<Stripe.PromotionCode>>>
}

export const promotion: Promotion = (() => {
  async function createCoupon(params: Stripe.CouponCreateParams): Promise<Stripe.Response<Stripe.Coupon>> {
    return await client.coupons.create(params)
  }

  async function retrieveCoupon(couponId: string): Promise<Stripe.Response<Stripe.Coupon>> {
    return await client.coupons.retrieve(couponId)
  }

  async function updateCoupon(couponId: string, params: Stripe.CouponUpdateParams): Promise<Stripe.Response<Stripe.Coupon>> {
    return await client.coupons.update(couponId, params)
  }

  async function deleteCoupon(couponId: string): Promise<Stripe.Response<Stripe.DeletedCoupon>> {
    return await client.coupons.del(couponId)
  }

  async function listCoupons(params?: Stripe.CouponListParams): Promise<Stripe.Response<Stripe.ApiList<Stripe.Coupon>>> {
    return await client.coupons.list(params)
  }

  async function createPromoCode(params: Stripe.PromotionCodeCreateParams): Promise<Stripe.Response<Stripe.PromotionCode>> {
    return await client.promotionCodes.create(params)
  }

  async function retrievePromoCode(promoCodeId: string): Promise<Stripe.Response<Stripe.PromotionCode>> {
    return await client.promotionCodes.retrieve(promoCodeId)
  }

  async function updatePromoCode(promoCodeId: string, params: Stripe.PromotionCodeUpdateParams): Promise<Stripe.Response<Stripe.PromotionCode>> {
    return await client.promotionCodes.update(promoCodeId, params)
  }

  async function listPromoCodes(params?: Stripe.PromotionCodeListParams): Promise<Stripe.Response<Stripe.ApiList<Stripe.PromotionCode>>> {
    return await client.promotionCodes.list(params)
  }

  return {
    createCoupon,
    retrieveCoupon,
    updateCoupon,
    deleteCoupon,
    listCoupons,
    createPromoCode,
    retrievePromoCode,
    updatePromoCode,
    listPromoCodes,
  }
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
