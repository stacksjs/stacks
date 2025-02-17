import type { UserModel } from '../orm/src/models/User'

export interface ModelEvents {

  'user:created': UserModel
  'user:updated': UserModel
  'user:deleted': UserModel

}
