import type { Generated } from 'kysely'
import type { AuthorsTable } from '../src/types/AuthorType'
import type { CartItemsTable } from '../src/types/CartItemType'
import type { CartsTable } from '../src/types/CartType'
import type { CategoriesTable } from '../src/types/CategoryType'
import type { CouponsTable } from '../src/types/CouponType'
import type { CustomersTable } from '../src/types/CustomerType'
import type { DeliveryRoutesTable } from '../src/types/DeliveryRouteType'
import type { DeploymentsTable } from '../src/types/DeploymentType'
import type { DigitalDeliveriesTable } from '../src/types/DigitalDeliveryType'
import type { DriversTable } from '../src/types/DriverType'
import type { ErrorsTable } from '../src/types/ErrorType'
import type { FailedJobsTable } from '../src/types/FailedJobType'
import type { GiftCardsTable } from '../src/types/GiftCardType'
import type { JobsTable } from '../src/types/JobType'
import type { LicenseKeysTable } from '../src/types/LicenseKeyType'
import type { LogsTable } from '../src/types/LogType'
import type { LoyaltyPointsTable } from '../src/types/LoyaltyPointType'
import type { LoyaltyRewardsTable } from '../src/types/LoyaltyRewardType'
import type { ManufacturersTable } from '../src/types/ManufacturerType'
import type { OauthAccessTokensTable } from '../src/types/OauthAccessTokenType'
import type { OauthClientsTable } from '../src/types/OauthClientType'
import type { OrderItemsTable } from '../src/types/OrderItemType'
import type { OrdersTable } from '../src/types/OrderType'
import type { PagesTable } from '../src/types/PageType'
import type { PaymentMethodsTable } from '../src/types/PaymentMethodType'
import type { PaymentProductsTable } from '../src/types/PaymentProductType'
import type { PaymentTransactionsTable } from '../src/types/PaymentTransactionType'
import type { PaymentsTable } from '../src/types/PaymentType'
import type { PersonalAccessTokensTable } from '../src/types/PersonalAccessTokenType'
import type { PostsTable } from '../src/types/PostType'
import type { PrintDevicesTable } from '../src/types/PrintDeviceType'
import type { ProductsTable } from '../src/types/ProductType'
import type { ProductUnitsTable } from '../src/types/ProductUnitType'
import type { ProductVariantsTable } from '../src/types/ProductVariantType'
import type { ProjectsTable } from '../src/types/ProjectType'
import type { ReceiptsTable } from '../src/types/ReceiptType'
import type { ReleasesTable } from '../src/types/ReleaseType'
import type { RequestsTable } from '../src/types/RequestType'
import type { ReviewsTable } from '../src/types/ReviewType'
import type { ShippingMethodsTable } from '../src/types/ShippingMethodType'
import type { ShippingRatesTable } from '../src/types/ShippingRateType'
import type { ShippingZonesTable } from '../src/types/ShippingZoneType'
import type { SubscriberEmailsTable } from '../src/types/SubscriberEmailType'
import type { SubscribersTable } from '../src/types/SubscriberType'
import type { SubscriptionsTable } from '../src/types/SubscriptionType'
import type { TaxRatesTable } from '../src/types/TaxRateType'
import type { TeamsTable } from '../src/types/TeamType'
import type { TransactionsTable } from '../src/types/TransactionType'
import type { UsersTable } from '../src/types/UserType'
import type { WaitlistProductsTable } from '../src/types/WaitlistProductType'
import type { WaitlistRestaurantsTable } from '../src/types/WaitlistRestaurantType'
import type { WebsocketsTable } from '../src/types/WebsocketType'

export interface TeamsUsersTable {
  id: Generated<number>
  team_id: number
  user_id: number
}

export interface TeamsUsersTable {
  id: Generated<number>
  user_id: number
  team_id: number
}

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
  projects: ProjectsTable
  subscriber_emails: SubscriberEmailsTable
  oauth_access_tokens: OauthAccessTokensTable
  oauth_clients: OauthClientsTable
  teams_users: TeamsUsersTable
  teams: TeamsTable
  subscribers: SubscribersTable
  deployments: DeploymentsTable
  releases: ReleasesTable
  users: UsersTable
  personal_access_tokens: PersonalAccessTokensTable
  print_devices: PrintDevicesTable
  categories: CategoriesTable
  payments: PaymentsTable
  drivers: DriversTable
  waitlist_products: WaitlistProductsTable
  digital_deliveries: DigitalDeliveriesTable
  manufacturers: ManufacturersTable
  order_items: OrderItemsTable
  shipping_zones: ShippingZonesTable
  customers: CustomersTable
  products: ProductsTable
  receipts: ReceiptsTable
  product_variants: ProductVariantsTable
  license_keys: LicenseKeysTable
  waitlist_restaurants: WaitlistRestaurantsTable
  reviews: ReviewsTable
  product_units: ProductUnitsTable
  gift_cards: GiftCardsTable
  orders: OrdersTable
  coupons: CouponsTable
  tax_rates: TaxRatesTable
  transactions: TransactionsTable
  loyalty_points: LoyaltyPointsTable
  loyalty_rewards: LoyaltyRewardsTable
  shipping_methods: ShippingMethodsTable
  shipping_rates: ShippingRatesTable
  carts: CartsTable
  delivery_routes: DeliveryRoutesTable
  cart_items: CartItemsTable
  payment_products: PaymentProductsTable
  failed_jobs: FailedJobsTable
  payment_methods: PaymentMethodsTable
  pages: PagesTable
  authors: AuthorsTable
  posts: PostsTable
  payment_transactions: PaymentTransactionsTable
  websockets: WebsocketsTable
  requests: RequestsTable
  jobs: JobsTable
  logs: LogsTable
  subscriptions: SubscriptionsTable
  errors: ErrorsTable
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
