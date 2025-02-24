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
  method: string[]
  status_code: number
  duration_ms: number
  memory_usage: number
  user_agent: string
  error_message: string
  title: string
  address: string
  latlng: string
  info_source: string[]
  were_detained: boolean
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
  body: string
  connection: string
  queue: string
  payload: string
  exception: string
  failed_at: Date | string
  key: number
  unit_price: number
  image: string
  provider_id: string
  type: string
  last_four: number
  brand: string
  exp_month: number
  exp_year: number
  is_default: boolean
  amount: number
  attempts: number
  available_at: number
  reserved_at: Date | string
  provider_status: string
  provider_type: string
  provider_price_id: string
  quantity: number
  trial_ends_at: string
  ends_at: string
  message: string
  stack: string
  additional_info: string
}
