import type { Generated, Insertable, Selectable, Updateable } from 'kysely'
import { randomUUIDv7 } from 'bun'
import { cache } from '@stacksjs/cache'
import { db, sql } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'

import User from './User'

export interface PaymentMethodsTable {
  id?: Generated<number>
  type?: string
  last_four?: number
  brand?: string
  exp_month?: number
  exp_year?: number
  is_default?: boolean
  provider_id?: string
  user_id?: number
  uuid?: string

  created_at?: Date

  updated_at?: Date

  deleted_at?: Date

}

interface PaymentMethodResponse {
  data: PaymentMethods
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export type PaymentMethod = PaymentMethodsTable
export type PaymentMethodType = Selectable<PaymentMethod>
export type NewPaymentMethod = Insertable<PaymentMethod>
export type PaymentMethodUpdate = Updateable<PaymentMethod>
export type PaymentMethods = PaymentMethodType[]

export type PaymentMethodColumn = PaymentMethods
export type PaymentMethodColumns = Array<keyof PaymentMethods>

    type SortDirection = 'asc' | 'desc'
interface SortOptions { column: PaymentMethodType, order: SortDirection }
// Define a type for the options parameter
interface QueryOptions {
  sort?: SortOptions
  limit?: number
  offset?: number
  page?: number
}

export class PaymentMethodModel {
  private hidden = []
  private fillable = ['type', 'last_four', 'brand', 'exp_month', 'exp_year', 'is_default', 'provider_id', 'uuid', 'user_id']
  private softDeletes = false
  protected selectFromQuery: any
  protected updateFromQuery: any
  protected hasSelect: boolean
  public id: number | undefined
  public uuid: string | undefined
  public type: string | undefined
  public last_four: number | undefined
  public brand: string | undefined
  public exp_month: number | undefined
  public exp_year: number | undefined
  public is_default: boolean | undefined
  public provider_id: string | undefined

  public created_at: Date | undefined
  public updated_at: Date | undefined
  public user_id: number | undefined

  constructor(paymentmethod: Partial<PaymentMethodType> | null) {
    this.id = paymentmethod?.id
    this.uuid = paymentmethod?.uuid
    this.type = paymentmethod?.type
    this.last_four = paymentmethod?.last_four
    this.brand = paymentmethod?.brand
    this.exp_month = paymentmethod?.exp_month
    this.exp_year = paymentmethod?.exp_year
    this.is_default = paymentmethod?.is_default
    this.provider_id = paymentmethod?.provider_id

    this.created_at = paymentmethod?.created_at

    this.updated_at = paymentmethod?.updated_at

    this.user_id = paymentmethod?.user_id

    this.selectFromQuery = db.selectFrom('payment_methods')
    this.hasSelect = false
  }

  // Method to find a PaymentMethod by ID
  async find(id: number): Promise<PaymentMethodModel | undefined> {
    const query = db.selectFrom('payment_methods').where('id', '=', id).selectAll()

    const model = await query.executeTakeFirst()

    if (!model)
      return undefined

    cache.getOrSet(`paymentmethod:${id}`, JSON.stringify(model))

    return this.parseResult(new PaymentMethodModel(model))
  }

  // Method to find a PaymentMethod by ID
  static async find(id: number): Promise<PaymentMethodModel | undefined> {
    const query = db.selectFrom('payment_methods').where('id', '=', id).selectAll()

    const instance = new PaymentMethodModel(null)

    const model = await query.executeTakeFirst()

    if (!model)
      return undefined

    cache.getOrSet(`paymentmethod:${id}`, JSON.stringify(model))

    return instance.parseResult(new PaymentMethodModel(model))
  }

  static async all(): Promise<PaymentMethodModel[]> {
    let query = db.selectFrom('payment_methods').selectAll()

    const instance = new PaymentMethodModel(null)

    if (instance.softDeletes) {
      query = query.where('deleted_at', 'is', null)
    }

    const results = await query.execute()

    return results.map(modelItem => instance.parseResult(new PaymentMethodModel(modelItem)))
  }

  static async findOrFail(id: number): Promise<PaymentMethodModel> {
    let query = db.selectFrom('payment_methods').where('id', '=', id)

    const instance = new PaymentMethodModel(null)

    if (instance.softDeletes) {
      query = query.where('deleted_at', 'is', null)
    }

    query = query.selectAll()

    const model = await query.executeTakeFirst()

    if (model === undefined)
      throw new HttpError(404, `No PaymentMethodModel results for ${id}`)

    cache.getOrSet(`paymentmethod:${id}`, JSON.stringify(model))

    return instance.parseResult(new PaymentMethodModel(model))
  }

  static async findMany(ids: number[]): Promise<PaymentMethodModel[]> {
    let query = db.selectFrom('payment_methods').where('id', 'in', ids)

    const instance = new PaymentMethodModel(null)

    if (instance.softDeletes) {
      query = query.where('deleted_at', 'is', null)
    }

    query = query.selectAll()

    const model = await query.execute()

    return model.map(modelItem => instance.parseResult(new PaymentMethodModel(modelItem)))
  }

  // Method to get a User by criteria
  static async get(): Promise<PaymentMethodModel[]> {
    const instance = new PaymentMethodModel(null)

    if (instance.hasSelect) {
      if (instance.softDeletes) {
        instance.selectFromQuery = instance.selectFromQuery.where('deleted_at', 'is', null)
      }

      const model = await instance.selectFromQuery.execute()

      return model.map((modelItem: PaymentMethodModel) => new PaymentMethodModel(modelItem))
    }

    if (instance.softDeletes) {
      instance.selectFromQuery = instance.selectFromQuery.where('deleted_at', 'is', null)
    }

    const model = await instance.selectFromQuery.selectAll().execute()

    return model.map((modelItem: PaymentMethodModel) => new PaymentMethodModel(modelItem))
  }

  // Method to get a PaymentMethod by criteria
  async get(): Promise<PaymentMethodModel[]> {
    if (this.hasSelect) {
      if (this.softDeletes) {
        this.selectFromQuery = this.selectFromQuery.where('deleted_at', 'is', null)
      }

      const model = await this.selectFromQuery.execute()

      return model.map((modelItem: PaymentMethodModel) => new PaymentMethodModel(modelItem))
    }

    if (this.softDeletes) {
      this.selectFromQuery = this.selectFromQuery.where('deleted_at', 'is', null)
    }

    const model = await this.selectFromQuery.execute()

    return model.map((modelItem: PaymentMethodModel) => new PaymentMethodModel(modelItem))
  }

  static async count(): Promise<number> {
    const instance = new PaymentMethodModel(null)

    if (instance.softDeletes) {
      instance.selectFromQuery = instance.selectFromQuery.where('deleted_at', 'is', null)
    }

    const results = await instance.selectFromQuery.selectAll().execute()

    return results.length
  }

  async count(): Promise<number> {
    if (this.hasSelect) {
      if (this.softDeletes) {
        this.selectFromQuery = this.selectFromQuery.where('deleted_at', 'is', null)
      }

      const results = await this.selectFromQuery.execute()

      return results.length
    }

    const results = await this.selectFromQuery.execute()

    return results.length
  }

  // Method to get all payment_methods
  static async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<PaymentMethodResponse> {
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

  // Method to create a new paymentmethod
  static async create(newPaymentMethod: NewPaymentMethod): Promise<PaymentMethodModel> {
    const instance = new PaymentMethodModel(null)

    const filteredValues = Object.fromEntries(
      Object.entries(newPaymentMethod).filter(([key]) => instance.fillable.includes(key)),
    ) as NewPaymentMethod

    filteredValues.uuid = randomUUIDv7()

    const result = await db.insertInto('payment_methods')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await find(Number(result.insertId)) as PaymentMethodModel

    return model
  }

  static async createMany(newPaymentMethods: NewPaymentMethod[]): Promise<void> {
    const instance = new PaymentMethodModel(null)

    const filteredValues = newPaymentMethods.map(newUser =>
      Object.fromEntries(
        Object.entries(newUser).filter(([key]) => instance.fillable.includes(key)),
      ) as NewPaymentMethod,
    )

    filteredValues.forEach((model) => {
      model.uuid = randomUUIDv7()
    })

    await db.insertInto('payment_methods')
      .values(filteredValues)
      .executeTakeFirst()
  }

  static async forceCreate(newPaymentMethod: NewPaymentMethod): Promise<PaymentMethodModel> {
    const result = await db.insertInto('payment_methods')
      .values(newPaymentMethod)
      .executeTakeFirst()

    const model = await find(Number(result.insertId)) as PaymentMethodModel

    return model
  }

  // Method to remove a PaymentMethod
  static async remove(id: number): Promise<void> {
    const instance = new PaymentMethodModel(null)

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

  where(...args: (string | number | boolean | undefined | null)[]): PaymentMethodModel {
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

    this.selectFromQuery = this.selectFromQuery.where(column, operator, value)

    this.updateFromQuery = this.updateFromQuery.where(column, operator, value)

    return this
  }

  static where(...args: (string | number | boolean | undefined | null)[]): PaymentMethodModel {
    let column: any
    let operator: any
    let value: any

    const instance = new PaymentMethodModel(null)

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

    instance.selectFromQuery = instance.selectFromQuery.where(column, operator, value)

    instance.updateFromQuery = instance.updateFromQuery.where(column, operator, value)

    return instance
  }

  static whereNull(column: string): PaymentMethodModel {
    const instance = new PaymentMethodModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    instance.updateFromQuery = instance.updateFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    return instance
  }

  whereNull(column: string): PaymentMethodModel {
    this.selectFromQuery = this.selectFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    this.updateFromQuery = this.updateFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    return this
  }

  static whereType(value: string): PaymentMethodModel {
    const instance = new PaymentMethodModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('type', '=', value)

    return instance
  }

  static whereLastFour(value: string): PaymentMethodModel {
    const instance = new PaymentMethodModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('lastFour', '=', value)

    return instance
  }

  static whereBrand(value: string): PaymentMethodModel {
    const instance = new PaymentMethodModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('brand', '=', value)

    return instance
  }

  static whereExpMonth(value: string): PaymentMethodModel {
    const instance = new PaymentMethodModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('expMonth', '=', value)

    return instance
  }

  static whereExpYear(value: string): PaymentMethodModel {
    const instance = new PaymentMethodModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('expYear', '=', value)

    return instance
  }

  static whereIsDefault(value: string): PaymentMethodModel {
    const instance = new PaymentMethodModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('isDefault', '=', value)

    return instance
  }

  static whereProviderId(value: string): PaymentMethodModel {
    const instance = new PaymentMethodModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('providerId', '=', value)

    return instance
  }

  static whereIn(column: keyof PaymentMethodType, values: any[]): PaymentMethodModel {
    const instance = new PaymentMethodModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(column, 'in', values)

    instance.updateFromQuery = instance.updateFromQuery.where(column, 'in', values)

    return instance
  }

  async first(): Promise<PaymentMethodModel | undefined> {
    const model = await this.selectFromQuery.executeTakeFirst()

    if (!model) {
      return undefined
    }

    return this.parseResult(new PaymentMethodModel(model))
  }

  async firstOrFail(): Promise<PaymentMethodModel | undefined> {
    const model = await this.selectFromQuery.executeTakeFirst()

    if (model === undefined)
      throw new HttpError(404, 'No PaymentMethodModel results found for query')

    return this.parseResult(new PaymentMethodModel(model))
  }

  async exists(): Promise<boolean> {
    const model = await this.selectFromQuery.executeTakeFirst()

    return model !== null || model !== undefined
  }

  static async first(): Promise<PaymentMethodType | undefined> {
    return await db.selectFrom('payment_methods')
      .selectAll()
      .executeTakeFirst()
  }

  async last(): Promise<PaymentMethodType | undefined> {
    return await db.selectFrom('payment_methods')
      .selectAll()
      .orderBy('id', 'desc')
      .executeTakeFirst()
  }

  static async last(): Promise<PaymentMethodType | undefined> {
    return await db.selectFrom('payment_methods').selectAll().orderBy('id', 'desc').executeTakeFirst()
  }

  static orderBy(column: keyof PaymentMethodType, order: 'asc' | 'desc'): PaymentMethodModel {
    const instance = new PaymentMethodModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, order)

    return instance
  }

  orderBy(column: keyof PaymentMethodType, order: 'asc' | 'desc'): PaymentMethodModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, order)

    return this
  }

  static orderByDesc(column: keyof PaymentMethodType): PaymentMethodModel {
    const instance = new PaymentMethodModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'desc')

    return instance
  }

  orderByDesc(column: keyof PaymentMethodType): PaymentMethodModel {
    this.selectFromQuery = this.orderBy(column, 'desc')

    return this
  }

  static orderByAsc(column: keyof PaymentMethodType): PaymentMethodModel {
    const instance = new PaymentMethodModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'asc')

    return instance
  }

  orderByAsc(column: keyof PaymentMethodType): PaymentMethodModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, 'desc')

    return this
  }

  async update(paymentmethod: PaymentMethodUpdate): Promise<PaymentMethodModel | undefined> {
    if (this.id === undefined)
      throw new HttpError(500, 'PaymentMethod ID is undefined')

    const filteredValues = Object.fromEntries(
      Object.entries(paymentmethod).filter(([key]) => this.fillable.includes(key)),
    ) as NewPaymentMethod

    await db.updateTable('payment_methods')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    const model = await this.find(Number(this.id))

    return model
  }

  async forceUpdate(paymentmethod: PaymentMethodUpdate): Promise<PaymentMethodModel | undefined> {
    if (this.id === undefined)
      throw new HttpError(500, 'PaymentMethod ID is undefined')

    await db.updateTable('payment_methods')
      .set(paymentmethod)
      .where('id', '=', this.id)
      .executeTakeFirst()

    const model = await this.find(Number(this.id))

    return model
  }

  async save(): Promise<void> {
    if (!this)
      throw new HttpError(500, 'PaymentMethod data is undefined')

    if (this.id === undefined) {
      await db.insertInto('payment_methods')
        .values(this as NewPaymentMethod)
        .executeTakeFirstOrThrow()
    }
    else {
      await this.update(this)
    }
  }

  // Method to delete (soft delete) the paymentmethod instance
  async delete(): Promise<void> {
    if (this.id === undefined)
      throw new HttpError(500, 'PaymentMethod ID is undefined')

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

  distinct(column: keyof PaymentMethodType): PaymentMethodModel {
    this.selectFromQuery = this.selectFromQuery.select(column).distinct()

    this.hasSelect = true

    return this
  }

  static distinct(column: keyof PaymentMethodType): PaymentMethodModel {
    const instance = new PaymentMethodModel(null)

    instance.selectFromQuery = instance.selectFromQuery.select(column).distinct()

    instance.hasSelect = true

    return instance
  }

  join(table: string, firstCol: string, secondCol: string): PaymentMethodModel {
    this.selectFromQuery = this.selectFromQuery(table, firstCol, secondCol)

    return this
  }

  static join(table: string, firstCol: string, secondCol: string): PaymentMethodModel {
    const instance = new PaymentMethodModel(null)

    instance.selectFromQuery = instance.selectFromQuery.innerJoin(table, firstCol, secondCol)

    return instance
  }

  static async rawQuery(rawQuery: string): Promise<any> {
    return await sql`${rawQuery}`.execute(db)
  }

  toJSON() {
    const output: Partial<PaymentMethodType> = {

      id: this.id,
      type: this.type,
      last_four: this.last_four,
      brand: this.brand,
      exp_month: this.exp_month,
      exp_year: this.exp_year,
      is_default: this.is_default,
      provider_id: this.provider_id,

      created_at: this.created_at,

      updated_at: this.updated_at,

    }

        type PaymentMethod = Omit<PaymentMethodType, 'password'>

        return output as PaymentMethod
  }

  parseResult(model: PaymentMethodModel): PaymentMethodModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof PaymentMethodModel]
    }

    return model
  }
}

async function find(id: number): Promise<PaymentMethodModel | undefined> {
  const query = db.selectFrom('payment_methods').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  return new PaymentMethodModel(model)
}

export async function count(): Promise<number> {
  const results = await PaymentMethodModel.count()

  return results
}

export async function create(newPaymentMethod: NewPaymentMethod): Promise<PaymentMethodModel> {
  const result = await db.insertInto('payment_methods')
    .values(newPaymentMethod)
    .executeTakeFirstOrThrow()

  return await find(Number(result.insertId)) as PaymentMethodModel
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(db)
}

export async function remove(id: number): Promise<void> {
  await db.deleteFrom('payment_methods')
    .where('id', '=', id)
    .execute()
}

export async function whereType(value: string): Promise<PaymentMethodModel[]> {
  const query = db.selectFrom('payment_methods').where('type', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new PaymentMethodModel(modelItem))
}

export async function whereLastFour(value: number): Promise<PaymentMethodModel[]> {
  const query = db.selectFrom('payment_methods').where('last_four', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new PaymentMethodModel(modelItem))
}

export async function whereBrand(value: string): Promise<PaymentMethodModel[]> {
  const query = db.selectFrom('payment_methods').where('brand', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new PaymentMethodModel(modelItem))
}

export async function whereExpMonth(value: number): Promise<PaymentMethodModel[]> {
  const query = db.selectFrom('payment_methods').where('exp_month', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new PaymentMethodModel(modelItem))
}

export async function whereExpYear(value: number): Promise<PaymentMethodModel[]> {
  const query = db.selectFrom('payment_methods').where('exp_year', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new PaymentMethodModel(modelItem))
}

export async function whereIsDefault(value: boolean): Promise<PaymentMethodModel[]> {
  const query = db.selectFrom('payment_methods').where('is_default', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new PaymentMethodModel(modelItem))
}

export async function whereProviderId(value: string): Promise<PaymentMethodModel[]> {
  const query = db.selectFrom('payment_methods').where('provider_id', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new PaymentMethodModel(modelItem))
}

export const PaymentMethod = PaymentMethodModel

export default PaymentMethod
