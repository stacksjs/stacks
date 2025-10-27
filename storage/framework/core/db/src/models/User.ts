import { db2 } from '../db'

class UserModel {
  private query: any

  constructor() {
    this.query = db2.selectFrom('users')
  }

  // Static method to create a new query instance
  static query() {
    return new UserModel()
  }

  // Find by ID
  static async find(id: number) {
    return await db2.selectFrom('users').where('id', '=', id).executeTakeFirst()
  }

  // Get all records
  static async all() {
    return await db2.selectFrom('users').execute()
  }

  // Get the first record
  async first() {
    return await this.query.executeTakeFirst()
  }

  // Get all records from the query
  async get() {
    return await this.query.execute()
  }

  // Chainable where clause
  where(column: string, operator: any, value?: any) {
    if (value === undefined) {
      this.query = this.query.where(column, '=', operator)
    } else {
      this.query = this.query.where(column, operator, value)
    }
    return this
  }

  // Chainable select clause
  select(...columns: string[]) {
    this.query = this.query.select(columns as any)
    return this
  }

  // Chainable orderBy clause
  orderBy(column: string, direction: 'asc' | 'desc' = 'asc') {
    this.query = this.query.orderBy(column, direction)
    return this
  }

  // Chainable limit clause
  limit(count: number) {
    this.query = this.query.limit(count)
    return this
  }
}

export default UserModel