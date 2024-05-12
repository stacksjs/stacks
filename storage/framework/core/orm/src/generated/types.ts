import type { SubscribersTable } from '../../../../orm/Subscriber'
import type { UsersTable } from '../../../../orm/User'
import type { PostsTable } from '../../../../orm/Post'
import type { Generated } from 'kysely'


export interface Database {
  subscribers: SubscribersTable
  users: UsersTable
  posts: PostsTable
}