import type { PersonalAccessTokensTable } from '../src/models/AccessToken'
import type { CouponsTable } from '../src/models/Coupon'
import type { CustomersTable } from '../src/models/Customer'
import type { DeploymentsTable } from '../src/models/Deployment'
import type { ErrorsTable } from '../src/models/Error'
import type { FailedJobsTable } from '../src/models/FailedJob'
import type { GiftCardsTable } from '../src/models/GiftCard'
import type { JobsTable } from '../src/models/Job'
import type { LoyaltyPointsTable } from '../src/models/LoyaltyPoint'
import type { LoyaltyRewardsTable } from '../src/models/LoyaltyReward'
import type { ManufacturersTable } from '../src/models/Manufacturer'
import type { OrdersTable } from '../src/models/Order'
import type { OrderItemsTable } from '../src/models/OrderItem'
import type { PaymentsTable } from '../src/models/Payment'
import type { PaymentMethodsTable } from '../src/models/PaymentMethod'
import type { PaymentProductsTable } from '../src/models/PaymentProduct'
import type { PaymentTransactionsTable } from '../src/models/PaymentTransaction'
import type { PostsTable } from '../src/models/Post'
import type { ProductsTable } from '../src/models/Product'
import type { ProductCategoriesTable } from '../src/models/ProductCategory'
import type { ProductItemsTable } from '../src/models/ProductItem'
import type { ProductUnitsTable } from '../src/models/ProductUnit'
import type { ProductVariantsTable } from '../src/models/ProductVariant'
import type { ProjectsTable } from '../src/models/Project'
import type { ReleasesTable } from '../src/models/Release'
import type { RequestsTable } from '../src/models/Request'
import type { ReviewsTable } from '../src/models/Review'
import type { SubscribersTable } from '../src/models/Subscriber'
import type { SubscriberEmailsTable } from '../src/models/SubscriberEmail'
import type { SubscriptionsTable } from '../src/models/Subscription'
import type { TeamsTable } from '../src/models/Team'
import type { TransactionsTable } from '../src/models/Transaction'
import type { UsersTable } from '../src/models/User'

export interface TeamUsersTable {
  id?: number
  team_id: number
  user_id: number
}

export interface TeamUsersTable {
  id?: number
  user_id: number
  team_id: number
}

export interface MigrationsTable {
  name: string
  timestamp: string
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
  created_at?: Date
  last_used_at: string
}

export interface Database {
  projects: ProjectsTable
  subscriber_emails: SubscriberEmailsTable
  personal_access_tokens: PersonalAccessTokensTable
  team_users: TeamUsersTable
  teams: TeamsTable
  subscribers: SubscribersTable
  deployments: DeploymentsTable
  releases: ReleasesTable
  users: UsersTable
  posts: PostsTable
  payments: PaymentsTable
  manufacturers: ManufacturersTable
  order_items: OrderItemsTable
  customers: CustomersTable
  products: ProductsTable
  product_variants: ProductVariantsTable
  reviews: ReviewsTable
  product_units: ProductUnitsTable
  gift_cards: GiftCardsTable
  orders: OrdersTable
  coupons: CouponsTable
  transactions: TransactionsTable
  loyalty_points: LoyaltyPointsTable
  product_items: ProductItemsTable
  loyalty_rewards: LoyaltyRewardsTable
  product_categories: ProductCategoriesTable
  failed_jobs: FailedJobsTable
  payment_methods: PaymentMethodsTable
  payment_transactions: PaymentTransactionsTable
  requests: RequestsTable
  jobs: JobsTable
  subscriptions: SubscriptionsTable
  payment_products: PaymentProductsTable
  errors: ErrorsTable
  passkeys: PasskeysTable
  migrations: MigrationsTable
}
