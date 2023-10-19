import { db } from '@stacksjs/database'

class UserModel {
  // constructor() {
  //   super({ dialect: dbDialect })
  // }

  public async find(id: number) {
    return await db.selectFrom('users')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst()
  }

  public all() {
    return db.selectFrom('users')
      .selectAll()
  }

  public get() {
    return db.execute()
  }
}

export const User = new UserModel()

User.all().get()
