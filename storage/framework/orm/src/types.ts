import type { ProjectsTable } from '../src/models/Project'
import type { SubscriberEmailsTable } from '../src/models/SubscriberEmail'
import type { PersonalAccessTokensTable } from '../src/models/AccessToken'
import type { TeamsTable } from '../src/models/Team'
import type { SubscribersTable } from '../src/models/Subscriber'
import type { DeploymentsTable } from '../src/models/Deployment'
import type { ReleasesTable } from '../src/models/Release'
import type { UsersTable } from '../src/models/User'
import type { PaymentProductsTable } from '../src/models/PaymentProduct'
import type { PrintDevicesTable } from '../src/models/PrintDevice'
import type { CategoriesTable } from '../src/models/Category'
import type { PaymentsTable } from '../src/models/Payment'
import type { DriversTable } from '../src/models/Driver'
import type { WaitlistProductsTable } from '../src/models/WaitlistProduct'
import type { DigitalDeliveriesTable } from '../src/models/DigitalDelivery'
import type { ManufacturersTable } from '../src/models/Manufacturer'
import type { OrderItemsTable } from '../src/models/OrderItem'
import type { ShippingZonesTable } from '../src/models/ShippingZone'
import type { CustomersTable } from '../src/models/Customer'
import type { ProductsTable } from '../src/models/Product'
import type { ReceiptsTable } from '../src/models/Receipt'
import type { ProductVariantsTable } from '../src/models/ProductVariant'
import type { LicenseKeysTable } from '../src/models/LicenseKey'
import type { WaitlistRestaurantsTable } from '../src/models/WaitlistRestaurant'
import type { ReviewsTable } from '../src/models/Review'
import type { ProductUnitsTable } from '../src/models/ProductUnit'
import type { GiftCardsTable } from '../src/models/GiftCard'
import type { OrdersTable } from '../src/models/Order'
import type { CouponsTable } from '../src/models/Coupon'
import type { TaxRatesTable } from '../src/models/TaxRate'
import type { TransactionsTable } from '../src/models/Transaction'
import type { LoyaltyPointsTable } from '../src/models/LoyaltyPoint'
import type { ProductItemsTable } from '../src/models/ProductItem'
import type { LoyaltyRewardsTable } from '../src/models/LoyaltyReward'
import type { ShippingMethodsTable } from '../src/models/ShippingMethod'
import type { ShippingRatesTable } from '../src/models/ShippingRate'
import type { CartsTable } from '../src/models/Cart'
import type { DeliveryRoutesTable } from '../src/models/DeliveryRoute'
import type { CartItemsTable } from '../src/models/CartItem'
import type { FailedJobsTable } from '../src/models/FailedJob'
import type { PaymentMethodsTable } from '../src/models/PaymentMethod'
import type { AuthorsTable } from '../src/models/Author'
import type { PostsTable } from '../src/models/Post'
import type { PaymentTransactionsTable } from '../src/models/PaymentTransaction'
import type { RequestsTable } from '../src/models/Request'
import type { JobsTable } from '../src/models/Job'
import type { LogsTable } from '../src/models/Log'
import type { SubscriptionsTable } from '../src/models/Subscription'
import type { ErrorsTable } from '../src/models/Error'
import type { Generated } from 'kysely'

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
  updated_at?: string
  last_used_at: string
}

export interface commentablesTable {
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

export interface CommenteableUpvotesTable {
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
    categorizable_id: number
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
    taggable_id: number
    taggable_type: string
    created_at?: string
    updated_at?: string
  }

  export interface TaggableModelsTable {
    id?: number
    tag_id: number
    taggable_id: number
    taggable_type: string
    created_at?: string
    updated_at?: string
  }

  export interface CategorizableModelsTable {
    id?: number
    category_id: number
    categorizable_id: number
    categorizable_type: string
    created_at?: string
    updated_at?: string
  }
export interface Database {
  projects: ProjectsTable
  subscriber_emails: SubscriberEmailsTable
  personal_access_tokens: PersonalAccessTokensTable
  teams_users: TeamsUsersTable
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
  authors: AuthorsTable
  posts: PostsTable
  payment_transactions: PaymentTransactionsTable
  requests: RequestsTable
  jobs: JobsTable
  logs: LogsTable
  subscriptions: SubscriptionsTable
  errors: ErrorsTable
  migrations: MigrationsTable
  passkeys: PasskeysTable
  commentables: commentablesTable
  taggable: TaggableTable
  comment_upvotes: CommenteableUpvotesTable
  categorizable: CategorizableTable
  categorizable_models: CategorizableModelsTable
  taggable_models: TaggableModelsTable
}
