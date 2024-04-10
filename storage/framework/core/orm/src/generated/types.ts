import type { SubscribersTable } from '../../../../orm/SubscriberModel'
import type { UsersTable } from '../../../../orm/UserModel'
import type { PostsTable } from '../../../../orm/PostModel'

export interface Database {
  subscribers: SubscribersTable
  users: UsersTable
  posts: PostsTable
}