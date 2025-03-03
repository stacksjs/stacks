import type { PersonalAccessTokensTable } from '../src/models/AccessToken'
import type { DeploymentsTable } from '../src/models/Deployment'
import type { ErrorsTable } from '../src/models/Error'
import type { FailedJobsTable } from '../src/models/FailedJob'
import type { JobsTable } from '../src/models/Job'
import type { PaymentMethodsTable } from '../src/models/PaymentMethod'
import type { PaymentProductsTable } from '../src/models/PaymentProduct'
import type { PaymentTransactionsTable } from '../src/models/PaymentTransaction'
import type { PostsTable } from '../src/models/Post'
import type { ProjectsTable } from '../src/models/Project'
import type { ReleasesTable } from '../src/models/Release'
import type { RequestsTable } from '../src/models/Request'
import type { SubscribersTable } from '../src/models/Subscriber'
import type { SubscriberEmailsTable } from '../src/models/SubscriberEmail'
import type { SubscriptionsTable } from '../src/models/Subscription'
import type { TeamsTable } from '../src/models/Team'
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
