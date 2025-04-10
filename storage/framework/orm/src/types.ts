import type { PersonalAccessTokensTable } from '../src/models/AccessToken'
import type { AuthorsTable } from '../src/models/Author'
import type { CartsTable } from '../src/models/Cart'
import type { CartItemsTable } from '../src/models/CartItem'
import type { CategoriesTable } from '../src/models/Category'
import type { CommentsTable } from '../src/models/Comment'
import type { CouponsTable } from '../src/models/Coupon'
import type { CustomersTable } from '../src/models/Customer'
import type { DeliveryRoutesTable } from '../src/models/DeliveryRoute'
import type { DeploymentsTable } from '../src/models/Deployment'
import type { DigitalDeliveriesTable } from '../src/models/DigitalDelivery'
import type { DriversTable } from '../src/models/Driver'
import type { ErrorsTable } from '../src/models/Error'
import type { FailedJobsTable } from '../src/models/FailedJob'
import type { GiftCardsTable } from '../src/models/GiftCard'
import type { JobsTable } from '../src/models/Job'
import type { LicenseKeysTable } from '../src/models/LicenseKey'
import type { LogsTable } from '../src/models/Log'
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
import type { PostCategoriesTable } from '../src/models/PostCategory'
import type { PrintDevicesTable } from '../src/models/PrintDevice'
import type { ProductsTable } from '../src/models/Product'
import type { ProductItemsTable } from '../src/models/ProductItem'
import type { ProductUnitsTable } from '../src/models/ProductUnit'
import type { ProductVariantsTable } from '../src/models/ProductVariant'
import type { ProjectsTable } from '../src/models/Project'
import type { ReceiptsTable } from '../src/models/Receipt'
import type { ReleasesTable } from '../src/models/Release'
import type { RequestsTable } from '../src/models/Request'
import type { ReviewsTable } from '../src/models/Review'
import type { ShippingMethodsTable } from '../src/models/ShippingMethod'
import type { ShippingRatesTable } from '../src/models/ShippingRate'
import type { ShippingZonesTable } from '../src/models/ShippingZone'
import type { SubscribersTable } from '../src/models/Subscriber'
import type { SubscriberEmailsTable } from '../src/models/SubscriberEmail'
import type { SubscriptionsTable } from '../src/models/Subscription'
import type { TaxRatesTable } from '../src/models/TaxRate'
import type { TeamsTable } from '../src/models/Team'
import type { TransactionsTable } from '../src/models/Transaction'
import type { UsersTable } from '../src/models/User'
import type { WaitlistProductsTable } from '../src/models/WaitlistProduct'
import type { WaitlistRestaurantsTable } from '../src/models/WaitlistRestaurant'

export interface TeamsUsersTable {
  id?: number
  team_id: number
  user_id: number
}

export interface TeamsUsersTable {
  id?: number
  user_id: number
  team_id: number
}

export interface PostCategoriesPostsTable {
  id?: number
  post_category_id: number
  post_id: number
}

export interface PostCategoriesPostsTable {
  id?: number
  post_id: number
  post_category_id: number
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
  created_at?: string
  last_used_at: string
}

export interface Database {
  projects: ProjectsTable
  subscriber_emails: SubscriberEmailsTable
  personal_access_tokens: PersonalAccessTokensTable
  teams_users: PostCategoriesPostsTable
  teams: TeamsTable
  subscribers: SubscribersTable
  deployments: DeploymentsTable
  releases: ReleasesTable
  users: UsersTable
  payment_products: PaymentProductsTable
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
  product_items: ProductItemsTable
  loyalty_rewards: LoyaltyRewardsTable
  shipping_methods: ShippingMethodsTable
  shipping_rates: ShippingRatesTable
  carts: CartsTable
  delivery_routes: DeliveryRoutesTable
  cart_items: CartItemsTable
  failed_jobs: FailedJobsTable
  payment_methods: PaymentMethodsTable
  post_categories_posts: PostCategoriesPostsTable
  post_categories: PostCategoriesTable
  authors: AuthorsTable
  comments: CommentsTable
  posts: PostsTable
  payment_transactions: PaymentTransactionsTable
  requests: RequestsTable
  jobs: JobsTable
  logs: LogsTable
  subscriptions: SubscriptionsTable
  errors: ErrorsTable
  passkeys: PasskeysTable
  migrations: MigrationsTable
}
