import type { Stripe } from '../src'

type Customer = Stripe.Customer
type CustomerCreateParams = Stripe.CustomerCreateParams

declare const customer: Customer
declare const params: CustomerCreateParams

export { customer, params }
