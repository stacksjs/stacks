import type { Generated } from 'kysely'
import type { PersonalAccessTokensTable } from '../src/models/AccessToken'
import type { DeploymentsTable } from '../src/models/Deployment'
import type { PostsTable } from '../src/models/Post'
import type { ProjectsTable } from '../src/models/Project'
import type { ReleasesTable } from '../src/models/Release'
import type { SubscribersTable } from '../src/models/Subscriber'
import type { SubscriberEmailsTable } from '../src/models/SubscriberEmail'
import type { TeamsTable } from '../src/models/Team'
import type { UsersTable } from '../src/models/User'

export interface TeamPersonalAccessTokensTable {
  id?: Generated<number>
  team_id: number
  accesstoken_id: number
}
export interface TeamUsersTable {
  id?: Generated<number>
  team_id: number
  user_id: number
}
export interface UserTeamsTable {
  id?: Generated<number>
  user_id: number
  team_id: number
}
export interface MigrationsTable {
  name: string
  timestamp: string
}
export interface PasskeysTable {
  id: string
  cred_public_key: string
  user_id: number
  webauthn_user_id: string
  counter: number
  backup_eligible: boolean
  backup_status: boolean
  transports?: AuthenticatorTransportFuture[]
  created_at: Date
  last_used_at: string
}

export interface Database {
  projects: ProjectsTable
  subscriber_emails: SubscriberEmailsTable
  personal_access_tokens: PersonalAccessTokensTable
  team_personal_access_tokens: UserTeamsTable
  team_users: UserTeamsTable
  teams: TeamsTable
  subscribers: SubscribersTable
  deployments: DeploymentsTable
  releases: ReleasesTable
  user_teams: UserTeamsTable
  users: UsersTable
  posts: PostsTable
  passkeys: PasskeysTable
  migrations: MigrationsTable
}
