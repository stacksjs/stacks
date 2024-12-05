import type { Generated, Insertable, Selectable, Updateable } from 'kysely'
import { randomUUIDv7 } from 'bun'
import { cache } from '@stacksjs/cache'
import { db, sql } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'
import User from './User'

// import { Kysely, MysqlDialect, PostgresDialect } from 'kysely'
// import { Pool } from 'pg'

export interface PaymentMethodsTable {
  id?: Generated<number>
  type?: string
  last_four?: number
  expires?: string
  provider_id?: string
  uuid?: string

  created_at?: Date

  updated_at?: Date

  deleted_at?: Date

}

interface PaymenMethodResponse {
  data: PaymentMethods
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export type PaymenMethodType = Selectable<PaymentMethodsTable>
export type NewPaymenMethod = Insertable<PaymentMethodsTable>
export type PaymenMethodUpdate = Updateable<PaymentMethodsTable>
export type PaymentMethods = PaymenMethodType[]

export type PaymenMethodColumn = PaymentMethods
export type PaymenMethodColumns = Array<keyof PaymentMethods>

    type SortDirection = 'asc' | 'desc'
interface SortOptions { column: PaymenMethodType, order: SortDirection }
// Define a type for the options parameter
interface QueryOptions {
  sort?: SortOptions
  limit?: number
  offset?: number
  page?: number
}

export class PaymenMethodModel {
  private hidden = []
  private fillable = ['type', 'last_four', 'expires', 'provider_id', 'stripe_id', 'public_key', 'two_factor_secret']
  private softDeletes = false
  protected query: any
  protected hasSelect: boolean
  public id: number | undefined
  public uuid: string | undefined
  public type: string | undefined
  public last_four: number | undefined
  public expires: string | undefined
  public provider_id: string | undefined

  public created_at: Date | undefined
  public updated_at: Date | undefined

  constructor(paymenmethod: Partial<PaymenMethodType> | null) {
    this.id = paymenmethod?.id
    this.uuid = paymenmethod?.uuid
    this.type = paymenmethod?.type
    this.last_four = paymenmethod?.last_four
    this.expires = paymenmethod?.expires
    this.provider_id = paymenmethod?.provider_id

    this.created_at = paymenmethod?.created_at

    this.updated_at = paymenmethod?.updated_at

    this.query = db.selectFrom('payment_methods')
    this.hasSelect = false
  }

  // Method to find a PaymenMethod by ID
  async find(id: number): Promise<PaymenMethodModel | undefined> {
    const query = db.selectFrom('payment_methods').where('id', '=', id).selectAll()

    const model = await query.executeTakeFirst()

    if (!model)
      return undefined

    cache.getOrSet(`paymenmethod:${id}`, JSON.stringify(model))

    return this.parseResult(new PaymenMethodModel(model))
  }

  // Method to find a PaymenMethod by ID
  static async find(id: number): Promise<PaymenMethodModel | undefined> {
    const query = db.selectFrom('payment_methods').where('id', '=', id).selectAll()

    const instance = new PaymenMethodModel(null)

    const model = await query.executeTakeFirst()

    if (!model)
      return undefined

    cache.getOrSet(`paymenmethod:${id}`, JSON.stringify(model))

    return instance.parseResult(new PaymenMethodModel(model))
  }

  static async all(): Promise<PaymenMethodModel[]> {
    let query = db.selectFrom('payment_methods').selectAll()

    const instance = new PaymenMethodModel(null)

    if (instance.softDeletes) {
      query = query.where('deleted_at', 'is', null)
    }

    const results = await query.execute()

    return results.map(modelItem => instance.parseResult(new PaymenMethodModel(modelItem)))
  }

  static async findOrFail(id: number): Promise<PaymenMethodModel> {
    let query = db.selectFrom('payment_methods').where('id', '=', id)

    const instance = new PaymenMethodModel(null)

    if (instance.softDeletes) {
      query = query.where('deleted_at', 'is', null)
    }

    query = query.selectAll()

    const model = await query.executeTakeFirst()

    if (model === undefined)
      throw new HttpError(404, `No PaymenMethodModel results for ${id}`)

    cache.getOrSet(`paymenmethod:${id}`, JSON.stringify(model))

    return instance.parseResult(new PaymenMethodModel(model))
  }

  static async findMany(ids: number[]): Promise<PaymenMethodModel[]> {
    let query = db.selectFrom('payment_methods').where('id', 'in', ids)

    const instance = new PaymenMethodModel(null)

    if (instance.softDeletes) {
      query = query.where('deleted_at', 'is', null)
    }

    query = query.selectAll()

    const model = await query.execute()

    return model.map(modelItem => instance.parseResult(new PaymenMethodModel(modelItem)))
  }

  // Method to get a User by criteria
  static async get(): Promise<PaymenMethodModel[]> {
    const instance = new PaymenMethodModel(null)

    if (instance.hasSelect) {
      if (instance.softDeletes) {
        instance.query = instance.query.where('deleted_at', 'is', null)
      }

      const model = await instance.query.execute()

      return model.map((modelItem: PaymenMethodModel) => new PaymenMethodModel(modelItem))
    }

    if (instance.softDeletes) {
      instance.query = instance.query.where('deleted_at', 'is', null)
    }

    const model = await instance.query.selectAll().execute()

    return model.map((modelItem: PaymenMethodModel) => new PaymenMethodModel(modelItem))
  }

  // Method to get a PaymenMethod by criteria
  async get(): Promise<PaymenMethodModel[]> {
    if (this.hasSelect) {
      if (this.softDeletes) {
        this.query = this.query.where('deleted_at', 'is', null)
      }

      const model = await this.query.execute()

      return model.map((modelItem: PaymenMethodModel) => new PaymenMethodModel(modelItem))
    }

    if (this.softDeletes) {
      this.query = this.query.where('deleted_at', 'is', null)
    }

    const model = await this.query.selectAll().execute()

    return model.map((modelItem: PaymenMethodModel) => new PaymenMethodModel(modelItem))
  }

  static async count(): Promise<number> {
    const instance = new PaymenMethodModel(null)

    if (instance.softDeletes) {
      instance.query = instance.query.where('deleted_at', 'is', null)
    }

    const results = await instance.query.selectAll().execute()

    return results.length
  }

  async count(): Promise<number> {
    if (this.hasSelect) {
      if (this.softDeletes) {
        this.query = this.query.where('deleted_at', 'is', null)
      }

      const results = await this.query.execute()

      return results.length
    }

    const results = await this.query.selectAll().execute()

    return results.length
  }

  // Method to get all payment_methods
  static async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<PaymenMethodResponse> {
    const totalRecordsResult = await db.selectFrom('payment_methods')
      .select(db.fn.count('id').as('total')) // Use 'id' or another actual column name
      .executeTakeFirst()

    const totalRecords = Number(totalRecordsResult?.total) || 0
    const totalPages = Math.ceil(totalRecords / (options.limit ?? 10))

    const payment_methodsWithExtra = await db.selectFrom('payment_methods')
      .selectAll()
      .orderBy('id', 'asc') // Assuming 'id' is used for cursor-based pagination
      .limit((options.limit ?? 10) + 1) // Fetch one extra record
      .offset(((options.page ?? 1) - 1) * (options.limit ?? 10)) // Ensure options.page is not undefined
      .execute()

    let nextCursor = null
    if (payment_methodsWithExtra.length > (options.limit ?? 10))
      nextCursor = payment_methodsWithExtra.pop()?.id ?? null

    return {
      data: payment_methodsWithExtra,
      paging: {
        total_records: totalRecords,
        page: options.page || 1,
        total_pages: totalPages,
      },
      next_cursor: nextCursor,
    }
  }

  // Method to create a new paymenmethod
  static async create(newPaymenMethod: NewPaymenMethod): Promise<PaymenMethodModel> {
    const instance = new PaymenMethodModel(null)

    const filteredValues = Object.fromEntries(
      Object.entries(newPaymenMethod).filter(([key]) => instance.fillable.includes(key)),
    ) as NewPaymenMethod

    filteredValues.uuid = randomUUIDv7()

    const result = await db.insertInto('payment_methods')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await find(Number(result.insertId)) as PaymenMethodModel

    return model
  }

  static async forceCreate(newPaymenMethod: NewPaymenMethod): Promise<PaymenMethodModel> {
    const result = await db.insertInto('payment_methods')
      .values(newPaymenMethod)
      .executeTakeFirst()

    const model = await find(Number(result.insertId)) as PaymenMethodModel

    return model
  }

  // Method to remove a PaymenMethod
  static async remove(id: number): Promise<void> {
    const instance = new PaymenMethodModel(null)

    if (instance.softDeletes) {
      await db.updateTable('payment_methods')
        .set({
          deleted_at: sql.raw('CURRENT_TIMESTAMP'),
        })
        .where('id', '=', id)
        .execute()
    }
    else {
      await db.deleteFrom('payment_methods')
        .where('id', '=', id)
        .execute()
    }
  }

  where(...args: (string | number | boolean | undefined | null)[]): PaymenMethodModel {
    let column: any
    let operator: any
    let value: any

    if (args.length === 2) {
      [column, value] = args
      operator = '='
    }
    else if (args.length === 3) {
      [column, operator, value] = args
    }
    else {
      throw new HttpError(500, 'Invalid number of arguments')
    }

    this.query = this.query.where(column, operator, value)

    return this
  }

  static where(...args: (string | number | boolean | undefined | null)[]): PaymenMethodModel {
    let column: any
    let operator: any
    let value: any

    const instance = new PaymenMethodModel(null)

    if (args.length === 2) {
      [column, value] = args
      operator = '='
    }
    else if (args.length === 3) {
      [column, operator, value] = args
    }
    else {
      throw new HttpError(500, 'Invalid number of arguments')
    }

    instance.query = instance.query.where(column, operator, value)

    return instance
  }

  static whereType(value: string): PaymenMethodModel {
    const instance = new PaymenMethodModel(null)

    instance.query = instance.query.where('type', '=', value)

    return instance
  }

  static whereLastFour(value: string): PaymenMethodModel {
    const instance = new PaymenMethodModel(null)

    instance.query = instance.query.where('lastFour', '=', value)

    return instance
  }

  static whereExpires(value: string): PaymenMethodModel {
    const instance = new PaymenMethodModel(null)

    instance.query = instance.query.where('expires', '=', value)

    return instance
  }

  static whereProviderId(value: string): PaymenMethodModel {
    const instance = new PaymenMethodModel(null)

    instance.query = instance.query.where('providerId', '=', value)

    return instance
  }

  static whereIn(column: keyof PaymenMethodType, values: any[]): PaymenMethodModel {
    const instance = new PaymenMethodModel(null)

    instance.query = instance.query.where(column, 'in', values)

    return instance
  }

  async first(): Promise<PaymenMethodModel | undefined> {
    const model = await this.query.selectAll().executeTakeFirst()

    if (!model) {
      return undefined
    }

    return this.parseResult(new PaymenMethodModel(model))
  }

  async firstOrFail(): Promise<PaymenMethodModel | undefined> {
    const model = await this.query.selectAll().executeTakeFirst()

    if (model === undefined)
      throw new HttpError(404, 'No PaymenMethodModel results found for query')

    return this.parseResult(new PaymenMethodModel(model))
  }

  async exists(): Promise<boolean> {
    const model = await this.query.selectAll().executeTakeFirst()

    return model !== null || model !== undefined
  }

  static async first(): Promise<PaymenMethodType | undefined> {
    return await db.selectFrom('payment_methods')
      .selectAll()
      .executeTakeFirst()
  }

  async last(): Promise<PaymenMethodType | undefined> {
    return await db.selectFrom('payment_methods')
      .selectAll()
      .orderBy('id', 'desc')
      .executeTakeFirst()
  }

  static async last(): Promise<PaymenMethodType | undefined> {
    return await db.selectFrom('payment_methods').selectAll().orderBy('id', 'desc').executeTakeFirst()
  }

  static orderBy(column: keyof PaymenMethodType, order: 'asc' | 'desc'): PaymenMethodModel {
    const instance = new PaymenMethodModel(null)

    instance.query = instance.query.orderBy(column, order)

    return instance
  }

  orderBy(column: keyof PaymenMethodType, order: 'asc' | 'desc'): PaymenMethodModel {
    this.query = this.query.orderBy(column, order)

    return this
  }

  static orderByDesc(column: keyof PaymenMethodType): PaymenMethodModel {
    const instance = new PaymenMethodModel(null)

    instance.query = instance.query.orderBy(column, 'desc')

    return instance
  }

  orderByDesc(column: keyof PaymenMethodType): PaymenMethodModel {
    this.query = this.orderBy(column, 'desc')

    return this
  }

  static orderByAsc(column: keyof PaymenMethodType): PaymenMethodModel {
    const instance = new PaymenMethodModel(null)

    instance.query = instance.query.orderBy(column, 'asc')

    return instance
  }

  orderByAsc(column: keyof PaymenMethodType): PaymenMethodModel {
    this.query = this.query.orderBy(column, 'desc')

    return this
  }

  async update(paymenmethod: PaymenMethodUpdate): Promise<PaymenMethodModel | undefined> {
    if (this.id === undefined)
      throw new HttpError(500, 'PaymenMethod ID is undefined')

    const filteredValues = Object.fromEntries(
      Object.entries(paymenmethod).filter(([key]) => this.fillable.includes(key)),
    ) as NewPaymenMethod

    await db.updateTable('payment_methods')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    const model = await this.find(Number(this.id))

    return model
  }

  async forceUpdate(paymenmethod: PaymenMethodUpdate): Promise<PaymenMethodModel | undefined> {
    if (this.id === undefined)
      throw new HttpError(500, 'PaymenMethod ID is undefined')

    await db.updateTable('payment_methods')
      .set(paymenmethod)
      .where('id', '=', this.id)
      .executeTakeFirst()

    const model = await this.find(Number(this.id))

    return model
  }

  async save(): Promise<void> {
    if (!this)
      throw new HttpError(500, 'PaymenMethod data is undefined')

    if (this.id === undefined) {
      await db.insertInto('payment_methods')
        .values(this as NewPaymenMethod)
        .executeTakeFirstOrThrow()
    }
    else {
      await this.update(this)
    }
  }

  // Method to delete (soft delete) the paymenmethod instance
  async delete(): Promise<void> {
    if (this.id === undefined)
      throw new HttpError(500, 'PaymenMethod ID is undefined')

    // Check if soft deletes are enabled
    if (this.softDeletes) {
      // Update the deleted_at column with the current timestamp
      await db.updateTable('payment_methods')
        .set({
          deleted_at: sql.raw('CURRENT_TIMESTAMP'),
        })
        .where('id', '=', this.id)
        .execute()
    }
    else {
      // Perform a hard delete
      await db.deleteFrom('payment_methods')
        .where('id', '=', this.id)
        .execute()
    }
  }

  async user() {
    if (this.user_id === undefined)
      throw new HttpError(500, 'Relation Error!')

    const model = await User
      .where('id', '=', this.user_id)
      .first()

    if (!model)
      throw new HttpError(500, 'Model Relation Not Found!')

    return model
  }

  distinct(column: keyof PaymenMethodType): PaymenMethodModel {
    this.query = this.query.select(column).distinct()

    this.hasSelect = true

    return this
  }

  static distinct(column: keyof PaymenMethodType): PaymenMethodModel {
    const instance = new PaymenMethodModel(null)

    instance.query = instance.query.select(column).distinct()

    instance.hasSelect = true

    return instance
  }

  join(table: string, firstCol: string, secondCol: string): PaymenMethodModel {
    this.query = this.query.innerJoin(table, firstCol, secondCol)

    return this
  }

  static join(table: string, firstCol: string, secondCol: string): PaymenMethodModel {
    const instance = new PaymenMethodModel(null)

    instance.query = instance.query.innerJoin(table, firstCol, secondCol)

    return instance
  }

  static async rawQuery(rawQuery: string): Promise<any> {
    return await sql`${rawQuery}`.execute(db)
  }

  toJSON() {
    const output: Partial<PaymenMethodType> = {

      id: this.id,
      type: this.type,
      last_four: this.last_four,
      expires: this.expires,
      provider_id: this.provider_id,

      created_at: this.created_at,

      updated_at: this.updated_at,

    }

        type PaymenMethod = Omit<PaymenMethodType, 'password'>

        return output as PaymenMethod
  }

  parseResult(model: PaymenMethodModel): PaymenMethodModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof PaymenMethodModel]
    }

    return model
  }
}

async function find(id: number): Promise<PaymenMethodModel | undefined> {
  const query = db.selectFrom('payment_methods').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  return new PaymenMethodModel(model)
}

export async function count(): Promise<number> {
  const results = await PaymenMethodModel.count()

  return results
}

export async function create(newPaymenMethod: NewPaymenMethod): Promise<PaymenMethodModel> {
  const result = await db.insertInto('payment_methods')
    .values(newPaymenMethod)
    .executeTakeFirstOrThrow()

  return await find(Number(result.insertId)) as PaymenMethodModel
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(db)
}

export async function remove(id: number): Promise<void> {
  await db.deleteFrom('payment_methods')
    .where('id', '=', id)
    .execute()
}

export async function whereType(value: string): Promise<PaymenMethodModel[]> {
  const query = db.selectFrom('payment_methods').where('type', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new PaymenMethodModel(modelItem))
}

export async function whereLastFour(value: number): Promise<PaymenMethodModel[]> {
  const query = db.selectFrom('payment_methods').where('last_four', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new PaymenMethodModel(modelItem))
}

export async function whereExpires(value: string): Promise<PaymenMethodModel[]> {
  const query = db.selectFrom('payment_methods').where('expires', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new PaymenMethodModel(modelItem))
}

export async function whereProviderId(value: string): Promise<PaymenMethodModel[]> {
  const query = db.selectFrom('payment_methods').where('provider_id', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new PaymenMethodModel(modelItem))
}

export const PaymenMethod = PaymenMethodModel

export default PaymenMethod
