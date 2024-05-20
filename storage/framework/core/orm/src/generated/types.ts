import type { ProjectsTable } from '../../../../orm/Project'
import type { Access_tokensTable } from '../../../../orm/AccessToken'
import type { TeamsTable } from '../../../../orm/Team'
import type { SubscribersTable } from '../../../../orm/Subscriber'
import type { DeploymentsTable } from '../../../../orm/Deployment'
import type { UsersTable } from '../../../../orm/User'
import type { PostsTable } from '../../../../orm/Post'
import type { Generated } from 'kysely'

export interface TeamAccessTokensTable {
        id: Generated<number>
        undefined: number
        undefined: number
      }
export interface Database {
  projects: ProjectsTable
  access_tokens: Access_tokensTable
  team_access_tokens: TeamAccessTokensTable
  teams: TeamsTable
  subscribers: SubscribersTable
  deployments: DeploymentsTable
  users: UsersTable
  posts: PostsTable
}