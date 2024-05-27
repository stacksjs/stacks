import type { ProjectsTable } from '../../../../orm/src/models/Project'
import type { SubscriberEmailsTable } from '../../../../orm/src/models/SubscriberEmail'
import type { AccessTokensTable } from '../../../../orm/src/models/AccessToken'
import type { TeamsTable } from '../../../../orm/src/models/Team'
import type { SubscribersTable } from '../../../../orm/src/models/Subscriber'
import type { DeploymentsTable } from '../../../../orm/src/models/Deployment'
import type { UsersTable } from '../../../../orm/src/models/User'
import type { PostsTable } from '../../../../orm/src/models/Post'
import type { Generated } from 'kysely'

export interface TeamAccessTokensTable {
        id: Generated<number>
        team_id: number
        accesstoken_id: number
      }
export interface Database {
  projects: ProjectsTable
  subscriber_emails: SubscriberEmailsTable
  access_tokens: AccessTokensTable
  team_access_tokens: TeamAccessTokensTable
  teams: TeamsTable
  subscribers: SubscribersTable
  deployments: DeploymentsTable
  users: UsersTable
  posts: PostsTable
}