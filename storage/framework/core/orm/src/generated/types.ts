import type { ProjectsTable } from '../../../../orm/src/models/Project'
import type { SubscriberEmailsTable } from '../../../../orm/src/models/SubscriberEmail'
import type { PersonalAccessTokensTable } from '../../../../orm/src/models/AccessToken'
import type { TeamsTable } from '../../../../orm/src/models/Team'
import type { SubscribersTable } from '../../../../orm/src/models/Subscriber'
import type { DeploymentsTable } from '../../../../orm/src/models/Deployment'
import type { ReleasesTable } from '../../../../orm/src/models/Release'
import type { UsersTable } from '../../../../orm/src/models/User'
import type { PostsTable } from '../../../../orm/src/models/Post'
import type { Generated } from 'kysely'

export interface TeamPersonalAccessTokensTable {
        id: Generated<number>
        team_id: number
        accesstoken_id: number
      }export interface TeamUsersTable {
        id: Generated<number>
        team_id: number
        user_id: number
      }export interface UserTeamsTable {
        id: Generated<number>
        user_id: number
        team_id: number
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
}