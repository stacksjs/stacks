import type { VineType } from '@stacksjs/types'
import type { Request } from '../core/router/src/request'

interface ValidationField {
  rule: VineType
  message: Record<string, string>
}

interface CustomAttributes {
  [key: string]: ValidationField
}

interface RequestDataProduct {
  id: number
  name: string
  description: number
  key: number
  unit_price: number
  status: string
  image: string
  provider_id: string
  created_at?: Date
  updated_at?: Date
  deleted_at?: Date
}
export interface ProductRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: ((key: 'id') => number) & ((key: 'name' | 'status' | 'image' | 'provider_id') => string) & ((key: 'description' | 'key' | 'unit_price') => number)

  all: () => RequestDataProduct
  id: number
  name: string
  description: number
  key: number
  unit_price: number
  status: string
  image: string
  provider_id: string
  created_at?: Date
  updated_at?: Date
  deleted_at?: Date
}

interface RequestDataPaymentMethod {
  id: number
  type: string
  last_four: number
  brand: string
  exp_month: number
  exp_year: number
  is_default: boolean
  provider_id: string
  user_id: number
  transaction_id: number
  created_at?: Date
  updated_at?: Date
  deleted_at?: Date
}
export interface PaymentMethodRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: ((key: 'id') => number) & ((key: 'type' | 'brand' | 'provider_id') => string) & ((key: 'last_four' | 'exp_month' | 'exp_year') => number) & ((key: 'is_default') => boolean) & ((key: 'user_id') => string) & ((key: 'transaction_id') => string)

  all: () => RequestDataPaymentMethod
  id: number
  type: string
  last_four: number
  brand: string
  exp_month: number
  exp_year: number
  is_default: boolean
  provider_id: string
  user_id: number
  transaction_id: number
  created_at?: Date
  updated_at?: Date
  deleted_at?: Date
}

interface RequestDataTransaction {
  id: number
  name: string
  description: string
  amount: number
  brand: string
  type: string
  provider_id: string
  user_id: number
  paymentmethod_id: number
  created_at?: Date
  updated_at?: Date
  deleted_at?: Date
}
export interface TransactionRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: ((key: 'id') => number) & ((key: 'name' | 'description' | 'brand' | 'type' | 'provider_id') => string) & ((key: 'amount') => number) & ((key: 'user_id') => string) & ((key: 'paymentmethod_id') => string)

  all: () => RequestDataTransaction
  id: number
  name: string
  description: string
  amount: number
  brand: string
  type: string
  provider_id: string
  user_id: number
  paymentmethod_id: number
  created_at?: Date
  updated_at?: Date
  deleted_at?: Date
}

interface RequestDataSubscription {
  id: number
  type: string
  provider_id: string
  provider_status: string
  unit_price: number
  provider_type: string
  provider_price_id: string
  quantity: number
  trial_ends_at: string
  ends_at: string
  last_used_at: string
  user_id: number
  created_at?: Date
  updated_at?: Date
  deleted_at?: Date
}
export interface SubscriptionRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: ((key: 'id') => number) & ((key: 'type' | 'provider_id' | 'provider_status' | 'provider_type' | 'provider_price_id' | 'trial_ends_at' | 'ends_at' | 'last_used_at') => string) & ((key: 'unit_price' | 'quantity') => number) & ((key: 'user_id') => string)

  all: () => RequestDataSubscription
  id: number
  type: string
  provider_id: string
  provider_status: string
  unit_price: number
  provider_type: string
  provider_price_id: string
  quantity: number
  trial_ends_at: string
  ends_at: string
  last_used_at: string
  user_id: number
  created_at?: Date
  updated_at?: Date
  deleted_at?: Date
}

interface RequestDataError {
  id: number
  created_at?: Date
  updated_at?: Date
  deleted_at?: Date
}
export interface ErrorRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: (key: 'id') => number

  all: () => RequestDataError
  id: number
  created_at?: Date
  updated_at?: Date
  deleted_at?: Date
}

interface RequestDataProduct {
  id: number
  name: string
  description: number
  key: number
  unit_price: number
  status: string
  image: string
  provider_id: string
  created_at?: Date
  updated_at?: Date
  deleted_at?: Date
}
export interface ProductRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: ((key: 'id') => number) & ((key: 'name' | 'status' | 'image' | 'provider_id') => string) & ((key: 'description' | 'key' | 'unit_price') => number)

  all: () => RequestDataProduct
  id: number
  name: string
  description: number
  key: number
  unit_price: number
  status: string
  image: string
  provider_id: string
  created_at?: Date
  updated_at?: Date
  deleted_at?: Date
}

interface RequestDataPaymentMethod {
  id: number
  type: string
  last_four: number
  brand: string
  exp_month: number
  exp_year: number
  is_default: boolean
  provider_id: string
  user_id: number
  transaction_id: number
  created_at?: Date
  updated_at?: Date
  deleted_at?: Date
}
export interface PaymentMethodRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: ((key: 'id') => number) & ((key: 'type' | 'brand' | 'provider_id') => string) & ((key: 'last_four' | 'exp_month' | 'exp_year') => number) & ((key: 'is_default') => boolean) & ((key: 'user_id') => string) & ((key: 'transaction_id') => string)

  all: () => RequestDataPaymentMethod
  id: number
  type: string
  last_four: number
  brand: string
  exp_month: number
  exp_year: number
  is_default: boolean
  provider_id: string
  user_id: number
  transaction_id: number
  created_at?: Date
  updated_at?: Date
  deleted_at?: Date
}

interface RequestDataTransaction {
  id: number
  name: string
  description: string
  amount: number
  brand: string
  type: string
  provider_id: string
  user_id: number
  paymentmethod_id: number
  created_at?: Date
  updated_at?: Date
  deleted_at?: Date
}
export interface TransactionRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: ((key: 'id') => number) & ((key: 'name' | 'description' | 'brand' | 'type' | 'provider_id') => string) & ((key: 'amount') => number) & ((key: 'user_id') => string) & ((key: 'paymentmethod_id') => string)

  all: () => RequestDataTransaction
  id: number
  name: string
  description: string
  amount: number
  brand: string
  type: string
  provider_id: string
  user_id: number
  paymentmethod_id: number
  created_at?: Date
  updated_at?: Date
  deleted_at?: Date
}

interface RequestDataSubscription {
  id: number
  type: string
  provider_id: string
  provider_status: string
  unit_price: number
  provider_type: string
  provider_price_id: string
  quantity: number
  trial_ends_at: string
  ends_at: string
  last_used_at: string
  user_id: number
  created_at?: Date
  updated_at?: Date
  deleted_at?: Date
}
export interface SubscriptionRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: ((key: 'id') => number) & ((key: 'type' | 'provider_id' | 'provider_status' | 'provider_type' | 'provider_price_id' | 'trial_ends_at' | 'ends_at' | 'last_used_at') => string) & ((key: 'unit_price' | 'quantity') => number) & ((key: 'user_id') => string)

  all: () => RequestDataSubscription
  id: number
  type: string
  provider_id: string
  provider_status: string
  unit_price: number
  provider_type: string
  provider_price_id: string
  quantity: number
  trial_ends_at: string
  ends_at: string
  last_used_at: string
  user_id: number
  created_at?: Date
  updated_at?: Date
  deleted_at?: Date
}

interface RequestDataError {
  id: number
  created_at?: Date
  updated_at?: Date
  deleted_at?: Date
}
export interface ErrorRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: (key: 'id') => number

  all: () => RequestDataError
  id: number
  created_at?: Date
  updated_at?: Date
  deleted_at?: Date
}

export type ModelRequest = ProductRequestType | PaymentMethodRequestType | TransactionRequestType | SubscriptionRequestType | ErrorRequestType | ProductRequestType | PaymentMethodRequestType | TransactionRequestType | SubscriptionRequestTypeErrorRequestType
