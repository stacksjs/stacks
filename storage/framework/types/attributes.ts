export interface Attributes {
  name: string
  description: string
  url: string
  status: string
  email: string
  token: string
  plain_text_token: string
  abilities: string[]
  last_used_at: Date | string
  expires_at: Date | string
  revoked_at: Date | string
  ip_address: string
  device_name: string
  is_single_use: boolean
  company_name: string
  billing_email: string
  path: string
  is_personal: boolean
  subscribed: boolean
  commit_sha: string
  commit_message: string
  branch: string
  execution_time: number
  deploy_script: string
  terminal_output: string
  version: string
  job_title: string
  password: string
  title: string
  body: string
  connection: string
  queue: string
  payload: string
  exception: string
  failed_at: Date | string
  type: string
  last_four: number
  brand: string
  exp_month: number
  exp_year: number
  is_default: boolean
  provider_id: string
  amount: number
  method: string[]
  status_code: number
  duration_ms: number
  memory_usage: number
  user_agent: string
  error_message: string
  attempts: number
  available_at: number
  reserved_at: Date | string
  provider_status: string
  unit_price: number
  provider_type: string
  provider_price_id: string
  quantity: number
  trial_ends_at: string
  ends_at: string
  key: number
  image: string
  message: string
  stack: string
  additional_info: string
}
