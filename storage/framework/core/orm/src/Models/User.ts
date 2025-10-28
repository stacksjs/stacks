import { db2 } from '../../db'

class UserModel {
  private readonly hidden: string[] = ['password']
  private readonly fillable: string[] = ['name', 'email', 'password', 'uuid', 'two_factor_secret', 'public_key']
  private readonly guarded: string[] = []
  protected attributes: Record<string, any> = {}
  private query: any

  constructor(data?: Record<string, any>) {
    if (data) {
      this.attributes = { ...data }
    }
    this.query = db2.selectFrom('users')
  }

  // Static method to create a new query instance
  static query() {
    return new UserModel()
  }

  // Find by ID
  static async find(id: number) {
    const result = await db2.selectFrom('users').where('id', '=', id).executeTakeFirst()
    return result ? new UserModel(result) : undefined
  }

  // Get all records
  static async all() {
    const results = await db2.selectFrom('users').execute()
    return results.map((result: any) => new UserModel(result))
  }

  // Get the first record
  async first() {
    const result = await this.query.executeTakeFirst()
    return result ? new UserModel(result) : undefined
  }

  // Get all records from the query
  async get() {
    const results = await this.query.execute()
    return results.map((result: any) => new UserModel(result))
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

  // Create a new record
  static async create(data: Record<string, any>) {
    const instance = new UserModel()
    
    // Filter based on fillable and guarded
    const filteredData = Object.fromEntries(
      Object.entries(data).filter(([key]) =>
        !instance.guarded.includes(key) && instance.fillable.includes(key)
      )
    )

    const result = await db2.insertInto('users')
      .values(filteredData)
      .execute()

    // Fetch the created record
    const created = await db2.selectFrom('users')
      .where('id', '=', Number((result as any).insertId))
      .executeTakeFirst()

    return created ? new UserModel(created) : undefined
  }

  // Update the current record
  async update(data: Record<string, any>) {
    if (!this.attributes.id) {
      throw new Error('Cannot update a model without an ID')
    }

    // Filter based on fillable and guarded
    const filteredData = Object.fromEntries(
      Object.entries(data).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key)
      )
    )

    await (db2 as any).updateTable('users')
      .set(filteredData)
      .where('id', '=', this.attributes.id)
      .execute()

    // Fetch the updated record
    const updated = await db2.selectFrom('users')
      .where('id', '=', this.attributes.id)
      .executeTakeFirst()

    if (updated) {
      this.attributes = { ...updated }
    }

    return this
  }

  // Delete the current record
  async delete() {
    if (!this.attributes.id) {
      throw new Error('Cannot delete a model without an ID')
    }

    await (db2 as any).deleteFrom('users')
      .where('id', '=', this.attributes.id)
      .execute()

    return true
  }

  // Convert to JSON (excluding hidden fields)
  toJSON() {
    const json = { ...this.attributes }
    
    for (const field of this.hidden) {
      delete json[field]
    }
    
    return json
  }
}

export default UserModel