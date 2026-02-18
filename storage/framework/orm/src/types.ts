/**
 * Database table type mappings for the query builder.
 *
 * With the defineModel() approach, column types are inferred from model definitions
 * at the model level. These table interfaces provide the Database mapping needed
 * by the underlying query builder (Kysely).
 */

export interface MigrationsTable {
  name: string
  timestamp: string
}

export interface PasswordResetsTable {
  email: string
  token: string
  created_at?: string
}

export interface PasskeysTable {
  id?: number
  cred_public_key: string
  user_id: number
  webauthn_user_id: string
  counter: number
  credential_type: string
  device_type: string
  backup_eligible: boolean
  backup_status: boolean
  transports?: string
  created_at?: string
  updated_at?: string
  last_used_at: string
}

export interface CommentablesTable {
  id?: number
  title: string
  body: string
  status: string
  approved_at: number | null
  rejected_at: number | null
  commentables_id: number
  commentables_type: string
  user_id: number | null
  created_at?: string
  updated_at?: string | null
}

export interface CommentableUpvotesTable {
  id?: number
  user_id: number
  upvoteable_id: number
  upvoteable_type: string
  created_at?: string
}

export interface CategorizableTable {
  id?: number
  name: string
  slug: string
  description?: string
  is_active: boolean
  categorizable_type: string
  created_at?: string
  updated_at?: string
}

export interface TaggableTable {
  id?: number
  name: string
  slug: string
  description?: string
  is_active: boolean
  taggable_type: string
  created_at?: string
  updated_at?: string
}

export interface TaggableModelsTable {
  id?: number
  tag_id: number
  taggable_type: string
  created_at?: string
  updated_at?: string
}

export interface CategorizableModelsTable {
  id?: number
  category_id: number
  categorizable_type: string
  categorizable_id: number
  created_at?: string
  updated_at?: string
}

export interface QueryLogsTable {
  id?: number
  query: string
  normalized_query: string
  duration: number
  connection: string
  status: 'completed' | 'failed' | 'slow'
  error?: string
  executed_at?: string
  bindings?: string
  trace?: string
  model?: string
  method?: string
  file?: string
  line?: number
  memory_usage?: number
  rows_affected?: number
  transaction_id?: string
  tags?: string
  affected_tables?: string
  indexes_used?: string
  missing_indexes?: string
  explain_plan?: string
  optimization_suggestions?: string
}

export interface Database {
  tags: Record<string, any>
  payment_products: Record<string, any>
  failed_jobs: Record<string, any>
  social_posts: Record<string, any>
  payment_methods: Record<string, any>
  campaigns: Record<string, any>
  payment_transactions: Record<string, any>
  requests: Record<string, any>
  activities: Record<string, any>
  email_lists: Record<string, any>
  notifications: Record<string, any>
  jobs: Record<string, any>
  logs: Record<string, any>
  subscriptions: Record<string, any>
  errors: Record<string, any>
  comments: Record<string, any>
  users: Record<string, any>
  websockets: Record<string, any>
  pages: Record<string, any>
  authors: Record<string, any>
  posts: Record<string, any>
  print_devices: Record<string, any>
  categories: Record<string, any>
  payments: Record<string, any>
  drivers: Record<string, any>
  waitlist_products: Record<string, any>
  digital_deliveries: Record<string, any>
  manufacturers: Record<string, any>
  order_items: Record<string, any>
  shipping_zones: Record<string, any>
  customers: Record<string, any>
  products: Record<string, any>
  receipts: Record<string, any>
  product_variants: Record<string, any>
  license_keys: Record<string, any>
  waitlist_restaurants: Record<string, any>
  reviews: Record<string, any>
  product_units: Record<string, any>
  gift_cards: Record<string, any>
  orders: Record<string, any>
  coupons: Record<string, any>
  tax_rates: Record<string, any>
  transactions: Record<string, any>
  loyalty_points: Record<string, any>
  loyalty_rewards: Record<string, any>
  shipping_methods: Record<string, any>
  shipping_rates: Record<string, any>
  carts: Record<string, any>
  delivery_routes: Record<string, any>
  cart_items: Record<string, any>
  migrations: MigrationsTable
  passkeys: PasskeysTable
  commentables: CommentablesTable
  taggables: TaggableTable
  commentable_upvotes: CommentableUpvotesTable
  categorizables: CategorizableTable
  categorizable_models: CategorizableModelsTable
  taggable_models: TaggableModelsTable
  password_resets: PasswordResetsTable
  query_logs: QueryLogsTable
}
