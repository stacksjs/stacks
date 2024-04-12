import type { SubscribersTable } from '../../../../orm/Subscriber'
import type { UsersTable } from '../../../../orm/User'

export interface Database {
  subscribers: SubscribersTable
  users: UsersTable
}