import type { VineType } from '@stacksjs/types'
import type { Request } from '../core/router/src/request'

interface ValidationField {
  rule: VineType
  message: Record<string, string>
}

interface CustomAttributes {
  [key: string]: ValidationField
}

interface RequestDataProject {
  id: number
  name: string
  description: string
  url: string
  status: string
  created_at?: Date
  updated_at?: Date
  deleted_at?: Date
}
export interface ProjectRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: ((key: 'id') => number) & ((key: 'name' | 'description' | 'url' | 'status') => string)

  all: () => RequestDataProject
  id: number
  name: string
  description: string
  url: string
  status: string
  created_at?: Date
  updated_at?: Date
  deleted_at?: Date
}

interface RequestDataSubscriberEmail {
  id: number
  email: string
  created_at?: Date
  updated_at?: Date
  deleted_at?: Date
}
export interface SubscriberEmailRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: ((key: 'id') => number) & ((key: 'email') => string)

  all: () => RequestDataSubscriberEmail
  id: number
  email: string
  created_at?: Date
  updated_at?: Date
  deleted_at?: Date
}

interface RequestDataAccessToken {
  id: number
  name: string
  token: string
  plain_text_token: string
  abilities: string[]
  team_id: number
  created_at?: Date
  updated_at?: Date
  deleted_at?: Date
}
export interface AccessTokenRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: ((key: 'id') => number) & ((key: 'name' | 'token' | 'plain_text_token') => string) & ((key: 'abilities') => string[]) & ((key: 'team_id') => string)

  all: () => RequestDataAccessToken
  id: number
  name: string
  token: string
  plain_text_token: string
  abilities: string[]
  team_id: number
  created_at?: Date
  updated_at?: Date
  deleted_at?: Date
}

interface RequestDataTeam {
  id: number
  name: string
  company_name: string
  email: string
  billing_email: string
  status: string
  description: string
  path: string
  is_personal: boolean
  accesstoken_id: number
  user_id: number
  created_at?: Date
  updated_at?: Date
  deleted_at?: Date
}
export interface TeamRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: ((key: 'id') => number) & ((key: 'name' | 'company_name' | 'email' | 'billing_email' | 'status' | 'description' | 'path') => string) & ((key: 'is_personal') => boolean) & ((key: 'accesstoken_id') => string) & ((key: 'user_id') => string)

  all: () => RequestDataTeam
  id: number
  name: string
  company_name: string
  email: string
  billing_email: string
  status: string
  description: string
  path: string
  is_personal: boolean
  accesstoken_id: number
  user_id: number
  created_at?: Date
  updated_at?: Date
  deleted_at?: Date
}

interface RequestDataSubscriber {
  id: number
  subscribed: boolean
  user_id: number
  created_at?: Date
  updated_at?: Date
  deleted_at?: Date
}
export interface SubscriberRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: ((key: 'id') => number) & ((key: 'subscribed') => boolean) & ((key: 'user_id') => string)

  all: () => RequestDataSubscriber
  id: number
  subscribed: boolean
  user_id: number
  created_at?: Date
  updated_at?: Date
  deleted_at?: Date
}

interface RequestDataDeployment {
  id: number
  commit_sha: string
  commit_message: string
  branch: string
  status: string
  execution_time: number
  deploy_script: string
  terminal_output: string
  user_id: number
  created_at?: Date
  updated_at?: Date
  deleted_at?: Date
}
export interface DeploymentRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: ((key: 'id') => number) & ((key: 'commit_sha' | 'commit_message' | 'branch' | 'status' | 'deploy_script' | 'terminal_output') => string) & ((key: 'execution_time') => number) & ((key: 'user_id') => string)

  all: () => RequestDataDeployment
  id: number
  commit_sha: string
  commit_message: string
  branch: string
  status: string
  execution_time: number
  deploy_script: string
  terminal_output: string
  user_id: number
  created_at?: Date
  updated_at?: Date
  deleted_at?: Date
}

interface RequestDataRelease {
  id: number
  version: string
  created_at?: Date
  updated_at?: Date
  deleted_at?: Date
}
export interface ReleaseRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: ((key: 'id') => number) & ((key: 'version') => string)

  all: () => RequestDataRelease
  id: number
  version: string
  created_at?: Date
  updated_at?: Date
  deleted_at?: Date
}

interface RequestDataUser {
  id: number
  name: string
  email: string
  job_title: string
  password: string
  team_id: number
  deployment_id: number
  post_id: number
  paymentmethod_id: number
  transaction_id: number
  subscription_id: number
  created_at?: Date
  updated_at?: Date
  deleted_at?: Date
}
export interface UserRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: ((key: 'id') => number) & ((key: 'name' | 'email' | 'job_title' | 'password') => string) & ((key: 'team_id') => string) & ((key: 'deployment_id') => string) & ((key: 'post_id') => string) & ((key: 'paymentmethod_id') => string) & ((key: 'transaction_id') => string) & ((key: 'subscription_id') => string)

  all: () => RequestDataUser
  id: number
  name: string
  email: string
  job_title: string
  password: string
  team_id: number
  deployment_id: number
  post_id: number
  paymentmethod_id: number
  transaction_id: number
  subscription_id: number
  created_at?: Date
  updated_at?: Date
  deleted_at?: Date
}

interface RequestDataPost {
  id: number
  title: string
  body: string
  user_id: number
  created_at?: Date
  updated_at?: Date
  deleted_at?: Date
}
export interface PostRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: ((key: 'id') => number) & ((key: 'title' | 'body') => string) & ((key: 'user_id') => string)

  all: () => RequestDataPost
  id: number
  title: string
  body: string
  user_id: number
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
  get: ((key: 'id') => number) & ((key: 'name' | 'description' | 'type' | 'provider_id') => string) & ((key: 'amount') => number) & ((key: 'user_id') => string) & ((key: 'paymentmethod_id') => string)

  all: () => RequestDataTransaction
  id: number
  name: string
  description: string
  amount: number
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

export type ModelRequest = ProjectRequestType | SubscriberEmailRequestType | AccessTokenRequestType | TeamRequestType | SubscriberRequestType | DeploymentRequestType | ReleaseRequestType | UserRequestType | PostRequestTypeProductRequestTypePaymentMethodRequestTypeTransactionRequestTypeSubscriptionRequestTypeErrorRequestType
