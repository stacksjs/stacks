import type { PersonalAccessTokensTable } from '../src/models/AccessToken'
import type { ActivitiesTable } from '../src/models/Activity'
import type { DeploymentsTable } from '../src/models/Deployment'
import type { ErrorsTable } from '../src/models/Error'
import type { FailedJobsTable } from '../src/models/FailedJob'
import type { JobsTable } from '../src/models/Job'
import type { PaymentMethodsTable } from '../src/models/PaymentMethod'
import type { PostsTable } from '../src/models/Post'
import type { ProductsTable } from '../src/models/Product'
import type { ProjectsTable } from '../src/models/Project'
import type { ReleasesTable } from '../src/models/Release'
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
  activities: ActivitiesTable
  projects: ProjectsTable
  failed_jobs: FailedJobsTable
  subscriber_emails: SubscriberEmailsTable
  products: ProductsTable
  personal_access_tokens: PersonalAccessTokensTable
  payment_methods: PaymentMethodsTable
  team_users: TeamUsersTable
  teams: TeamsTable
  subscribers: SubscribersTable
  transactions: TransactionsTable
  jobs: JobsTable
  subscriptions: SubscriptionsTable
  deployments: DeploymentsTable
  errors: ErrorsTable
  releases: ReleasesTable
  users: UsersTable
  posts: PostsTable
  passkeys: PasskeysTable
  migrations: MigrationsTable
}
