import { dbDialect } from '@stacksjs/database'
import { Kysely } from 'kysely'

class UserModel extends Kysely<any> {
  constructor() {
    super({ dialect: dbDialect })
  }

  public async find(id: number) {
    return await this.selectFrom('users')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst()
  }

  public all() {
    return this.selectFrom('users')
      .selectAll()
  }
}

export const User = new UserModel()
