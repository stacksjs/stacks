import type { UserModel } from '../orm/src/models/User'

export interface ModelEvents {

  'user:created': Partial<UserModel>
  'user:updated': Partial<UserModel>
  'user:deleted': Partial<UserModel>

}
