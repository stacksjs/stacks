import type { Generated } from 'kysely'
import type { SubscribersTable } from '../../../../orm/Subscriber'
import type { UsersTable } from '../../../../orm/User'
import type { PostsTable } from '../../../../orm/Post'

export interface UserSubscribersTable {
  id: Generated<number>
  user_id: number
  subscriber_id: number
}
export interface Database {
  subscribers: SubscribersTable
  user_subscribers: UserSubscribersTable
  users: UsersTable
  posts: PostsTable
}
