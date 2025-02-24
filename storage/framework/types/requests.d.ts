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
}

interface RequestDataSubscriberEmail {
  id: number
  email: string
  deleted_at?: Date
  created_at?: Date
  updated_at?: Date
}
export interface SubscriberEmailRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: ((key: 'id') => number) & ((key: 'email') => string)

  all: () => RequestDataSubscriberEmail
  id: number
  email: string
  deleted_at?: Date
  created_at?: Date
  updated_at?: Date
}

interface RequestDataAccessToken {
  id: number
  name: string
  token: string
  plain_text_token: string
  abilities: string[]
  last_used_at: date
  expires_at: date
  revoked_at: date
  ip_address: string
  device_name: string
  is_single_use: boolean
  team_id: number
  created_at?: Date
  updated_at?: Date
}
export interface AccessTokenRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: ((key: 'id') => number) & ((key: 'name' | 'token' | 'plain_text_token' | 'ip_address' | 'device_name') => string) & ((key: 'abilities') => string[]) & ((key: 'last_used_at' | 'expires_at' | 'revoked_at') => date) & ((key: 'is_single_use') => boolean) & ((key: 'team_id') => string)

  all: () => RequestDataAccessToken
  id: number
  name: string
  token: string
  plain_text_token: string
  abilities: string[]
  last_used_at: date
  expires_at: date
  revoked_at: date
  ip_address: string
  device_name: string
  is_single_use: boolean
  team_id: number
  created_at?: Date
  updated_at?: Date
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
  created_at?: Date
  updated_at?: Date
}
export interface TeamRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: ((key: 'id') => number) & ((key: 'name' | 'company_name' | 'email' | 'billing_email' | 'status' | 'description' | 'path') => string) & ((key: 'is_personal') => boolean)

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
  created_at?: Date
  updated_at?: Date
}

interface RequestDataRequest {
  id: number
  method: string[]
  path: string
  status_code: number
  duration_ms: number
  ip_address: string
  memory_usage: number
  user_agent: string
  error_message: string
  deleted_at?: Date
  created_at?: Date
  updated_at?: Date
}
export interface RequestRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: ((key: 'id') => number) & ((key: 'method') => string[]) & ((key: 'path' | 'ip_address' | 'user_agent' | 'error_message') => string) & ((key: 'status_code' | 'duration_ms' | 'memory_usage') => number)

  all: () => RequestDataRequest
  id: number
  method: string[]
  path: string
  status_code: number
  duration_ms: number
  ip_address: string
  memory_usage: number
  user_agent: string
  error_message: string
  deleted_at?: Date
  created_at?: Date
  updated_at?: Date
}

interface RequestDataActivity {
  id: number
  title: string
  description: string
  address: string
  latlng: string
  info_source: string[]
  were_detained: boolean
  deleted_at?: Date
  created_at?: Date
  updated_at?: Date
}
export interface ActivityRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: ((key: 'id') => number) & ((key: 'title' | 'description' | 'address' | 'latlng') => string) & ((key: 'info_source') => string[]) & ((key: 'were_detained') => boolean)

  all: () => RequestDataActivity
  id: number
  title: string
  description: string
  address: string
  latlng: string
  info_source: string[]
  were_detained: boolean
  deleted_at?: Date
  created_at?: Date
  updated_at?: Date
}

interface RequestDataSubscriber {
  id: number
  subscribed: boolean
  user_id: number
  created_at?: Date
  updated_at?: Date
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
}

interface RequestDataRelease {
  id: number
  version: string
  created_at?: Date
  updated_at?: Date
}
export interface ReleaseRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: ((key: 'id') => number) & ((key: 'version') => string)

  all: () => RequestDataRelease
  id: number
  version: string
  created_at?: Date
  updated_at?: Date
}

interface RequestDataUser {
  id: number
  name: string
  email: string
  job_title: string
  password: string
  created_at?: Date
  updated_at?: Date
}
export interface UserRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: ((key: 'id') => number) & ((key: 'name' | 'email' | 'job_title' | 'password') => string)

  all: () => RequestDataUser
  id: number
  name: string
  email: string
  job_title: string
  password: string
  created_at?: Date
  updated_at?: Date
}

interface RequestDataPost {
  id: number
  title: string
  body: string
  user_id: number
  created_at?: Date
  updated_at?: Date
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
}

interface RequestDataFailedJob {
  id: number
  connection: string
  queue: string
  payload: string
  exception: string
  failed_at: date
  created_at?: Date
  updated_at?: Date
}
export interface FailedJobRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: ((key: 'id') => number) & ((key: 'connection' | 'queue' | 'payload' | 'exception') => string) & ((key: 'failed_at') => date)

  all: () => RequestDataFailedJob
  id: number
  connection: string
  queue: string
  payload: string
  exception: string
  failed_at: date
  created_at?: Date
  updated_at?: Date
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
  created_at?: Date
  updated_at?: Date
}
export interface PaymentMethodRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: ((key: 'id') => number) & ((key: 'type' | 'brand' | 'provider_id') => string) & ((key: 'last_four' | 'exp_month' | 'exp_year') => number) & ((key: 'is_default') => boolean) & ((key: 'user_id') => string)

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
  created_at?: Date
  updated_at?: Date
}

interface RequestDataPaymentTransaction {
  id: number
  name: string
  description: string
  amount: number
  type: string
  provider_id: string
  user_id: number
  payment_method_id: number
  created_at?: Date
  updated_at?: Date
}
export interface PaymentTransactionRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: ((key: 'id') => number) & ((key: 'name' | 'description' | 'type' | 'provider_id') => string) & ((key: 'amount') => number) & ((key: 'user_id') => string) & ((key: 'payment_method_id') => string)

  all: () => RequestDataPaymentTransaction
  id: number
  name: string
  description: string
  amount: number
  type: string
  provider_id: string
  user_id: number
  payment_method_id: number
  created_at?: Date
  updated_at?: Date
}

interface RequestDataRequest {
  id: number
  method: string[]
  path: string
  status_code: number
  duration_ms: number
  ip_address: string
  memory_usage: number
  user_agent: string
  error_message: string
  deleted_at?: Date
  created_at?: Date
  updated_at?: Date
}
export interface RequestRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: ((key: 'id') => number) & ((key: 'method') => string[]) & ((key: 'path' | 'ip_address' | 'user_agent' | 'error_message') => string) & ((key: 'status_code' | 'duration_ms' | 'memory_usage') => number)

  all: () => RequestDataRequest
  id: number
  method: string[]
  path: string
  status_code: number
  duration_ms: number
  ip_address: string
  memory_usage: number
  user_agent: string
  error_message: string
  deleted_at?: Date
  created_at?: Date
  updated_at?: Date
}

interface RequestDataJob {
  id: number
  queue: string
  payload: string
  attempts: number
  available_at: number
  reserved_at: date
  created_at?: Date
  updated_at?: Date
}
export interface JobRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: ((key: 'id') => number) & ((key: 'queue' | 'payload') => string) & ((key: 'attempts' | 'available_at') => number) & ((key: 'reserved_at') => date)

  all: () => RequestDataJob
  id: number
  queue: string
  payload: string
  attempts: number
  available_at: number
  reserved_at: date
  created_at?: Date
  updated_at?: Date
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
}

interface RequestDataPaymentProduct {
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
}
export interface PaymentProductRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: ((key: 'id') => number) & ((key: 'name' | 'status' | 'image' | 'provider_id') => string) & ((key: 'description' | 'key' | 'unit_price') => number)

  all: () => RequestDataPaymentProduct
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
}

interface RequestDataError {
  id: number
  type: string
  message: string
  stack: string
  status: number
  additional_info: string
  created_at?: Date
  updated_at?: Date
}
export interface ErrorRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: ((key: 'id') => number) & ((key: 'type' | 'message' | 'stack' | 'additional_info') => string) & ((key: 'status') => number)

  all: () => RequestDataError
  id: number
  type: string
  message: string
  stack: string
  status: number
  additional_info: string
  created_at?: Date
  updated_at?: Date
}

export type ModelRequest = ProjectRequestType | SubscriberEmailRequestType | AccessTokenRequestType | TeamRequestType | RequestRequestType | ActivityRequestType | SubscriberRequestType | DeploymentRequestType | ReleaseRequestType | UserRequestType | PostRequestType | FailedJobRequestType | PaymentMethodRequestType | PaymentTransactionRequestType | RequestRequestType | JobRequestType | SubscriptionRequestType | PaymentProductRequestType | ErrorRequestType
