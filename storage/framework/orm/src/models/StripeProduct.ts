import type { Generated, Insertable, Selectable, Updateable } from 'kysely'
import { cache } from '@stacksjs/cache'
import { db, sql } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'

// import { Kysely, MysqlDialect, PostgresDialect } from 'kysely'
// import { Pool } from 'pg'

export interface StripeProductsTable {
  id: Generated<number>
  type?: undefined
  message?: undefined
  stack?: undefined
  status?: undefined
  user_id?: undefined
  additional_info?: undefined

  created_at?: Date

  updated_at?: Date

  deleted_at?: Date

}

interface StripeProductResponse {
  data: StripeProducts
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export type StripeProductType = Selectable<StripeProductsTable>
export type NewStripeProduct = Insertable<StripeProductsTable>
export type StripeProductUpdate = Updateable<StripeProductsTable>
export type StripeProducts = StripeProductType[]

export type StripeProductColumn = StripeProducts
export type StripeProductColumns = Array<keyof StripeProducts>

    type SortDirection = 'asc' | 'desc'
interface SortOptions { column: StripeProductType, order: SortDirection }
// Define a type for the options parameter
interface QueryOptions {
  sort?: SortOptions
  limit?: number
  offset?: number
  page?: number
}

export class StripeProductModel {
  private hidden = []
  private fillable = ['type', 'message', 'stack', 'status', 'user_id', 'additional_info', 'stripe_id', 'public_key', 'two_factor_secret']
  private softDeletes = false
  protected query: any
  protected hasSelect: boolean
  public id: number | undefined
  public type: undefined | undefined
  public message: undefined | undefined
  public stack: undefined | undefined
  public status: undefined | undefined
  public user_id: undefined | undefined
  public additional_info: undefined | undefined

  public created_at: Date | undefined
  public updated_at: Date | undefined

  constructor(stripeproduct: Partial<StripeProductType> | null) {
    this.id = stripeproduct?.id
    this.type = stripeproduct?.type
    this.message = stripeproduct?.message
    this.stack = stripeproduct?.stack
    this.status = stripeproduct?.status
    this.user_id = stripeproduct?.user_id
    this.additional_info = stripeproduct?.additional_info

    this.created_at = stripeproduct?.created_at

    this.updated_at = stripeproduct?.updated_at

    this.query = db.selectFrom('stripe_products')
    this.hasSelect = false
  }

  // Method to find a StripeProduct by ID
  async find(id: number): Promise<StripeProductModel | undefined> {
    const query = db.selectFrom('stripe_products').where('id', '=', id).selectAll()

    const model = await query.executeTakeFirst()

    if (!model)
      return undefined

    cache.getOrSet(`stripeproduct:${id}`, JSON.stringify(model))

    return this.parseResult(new StripeProductModel(model))
  }

  // Method to find a StripeProduct by ID
  static async find(id: number): Promise<StripeProductModel | undefined> {
    const query = db.selectFrom('stripe_products').where('id', '=', id).selectAll()

    const instance = new StripeProductModel(null)

    const model = await query.executeTakeFirst()

    if (!model)
      return undefined

    cache.getOrSet(`stripeproduct:${id}`, JSON.stringify(model))

    return instance.parseResult(new StripeProductModel(model))
  }

  static async all(): Promise<StripeProductModel[]> {
    let query = db.selectFrom('stripe_products').selectAll()

    const instance = new StripeProductModel(null)

    if (instance.softDeletes) {
      query = query.where('deleted_at', 'is', null)
    }

    const results = await query.execute()

    return results.map(modelItem => instance.parseResult(new StripeProductModel(modelItem)))
  }

  static async findOrFail(id: number): Promise<StripeProductModel> {
    let query = db.selectFrom('stripe_products').where('id', '=', id)

    const instance = new StripeProductModel(null)

    if (instance.softDeletes) {
      query = query.where('deleted_at', 'is', null)
    }

    query = query.selectAll()

    const model = await query.executeTakeFirst()

    if (model === undefined)
      throw new HttpError(404, `No StripeProductModel results for ${id}`)

    cache.getOrSet(`stripeproduct:${id}`, JSON.stringify(model))

    return instance.parseResult(new StripeProductModel(model))
  }

  static async findMany(ids: number[]): Promise<StripeProductModel[]> {
    let query = db.selectFrom('stripe_products').where('id', 'in', ids)

    const instance = new StripeProductModel(null)

    if (instance.softDeletes) {
      query = query.where('deleted_at', 'is', null)
    }

    query = query.selectAll()

    const model = await query.execute()

    return model.map(modelItem => instance.parseResult(new StripeProductModel(modelItem)))
  }

  // Method to get a User by criteria
  static async get(): Promise<StripeProductModel[]> {
    const instance = new StripeProductModel(null)

    if (instance.hasSelect) {
      if (instance.softDeletes) {
        instance.query = instance.query.where('deleted_at', 'is', null)
      }

      const model = await instance.query.execute()

      return model.map((modelItem: StripeProductModel) => new StripeProductModel(modelItem))
    }

    if (instance.softDeletes) {
      instance.query = instance.query.where('deleted_at', 'is', null)
    }

    const model = await instance.query.selectAll().execute()

    return model.map((modelItem: StripeProductModel) => new StripeProductModel(modelItem))
  }

  // Method to get a StripeProduct by criteria
  async get(): Promise<StripeProductModel[]> {
    if (this.hasSelect) {
      if (this.softDeletes) {
        this.query = this.query.where('deleted_at', 'is', null)
      }

      const model = await this.query.execute()

      return model.map((modelItem: StripeProductModel) => new StripeProductModel(modelItem))
    }

    if (this.softDeletes) {
      this.query = this.query.where('deleted_at', 'is', null)
    }

    const model = await this.query.selectAll().execute()

    return model.map((modelItem: StripeProductModel) => new StripeProductModel(modelItem))
  }

  static async count(): Promise<number> {
    const instance = new StripeProductModel(null)

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

  // Method to get all stripe_products
  static async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<StripeProductResponse> {
    const totalRecordsResult = await db.selectFrom('stripe_products')
      .select(db.fn.count('id').as('total')) // Use 'id' or another actual column name
      .executeTakeFirst()

    const totalRecords = Number(totalRecordsResult?.total) || 0
    const totalPages = Math.ceil(totalRecords / (options.limit ?? 10))

    const stripe_productsWithExtra = await db.selectFrom('stripe_products')
      .selectAll()
      .orderBy('id', 'asc') // Assuming 'id' is used for cursor-based pagination
      .limit((options.limit ?? 10) + 1) // Fetch one extra record
      .offset(((options.page ?? 1) - 1) * (options.limit ?? 10)) // Ensure options.page is not undefined
      .execute()

    let nextCursor = null
    if (stripe_productsWithExtra.length > (options.limit ?? 10))
      nextCursor = stripe_productsWithExtra.pop()?.id ?? null

    return {
      data: stripe_productsWithExtra,
      paging: {
        total_records: totalRecords,
        page: options.page || 1,
        total_pages: totalPages,
      },
      next_cursor: nextCursor,
    }
  }

  // Method to create a new stripeproduct
  static async create(newStripeProduct: NewStripeProduct): Promise<StripeProductModel> {
    const instance = new StripeProductModel(null)

    const filteredValues = Object.fromEntries(
      Object.entries(newStripeProduct).filter(([key]) => instance.fillable.includes(key)),
    ) as NewStripeProduct

    const result = await db.insertInto('stripe_products')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await find(Number(result.insertId)) as StripeProductModel

    return model
  }

  static async forceCreate(newStripeProduct: NewStripeProduct): Promise<StripeProductModel> {
    const result = await db.insertInto('stripe_products')
      .values(newStripeProduct)
      .executeTakeFirst()

    const model = await find(Number(result.insertId)) as StripeProductModel

    return model
  }

  // Method to remove a StripeProduct
  static async remove(id: number): Promise<void> {
    const instance = new StripeProductModel(null)

    if (instance.softDeletes) {
      await db.updateTable('stripe_products')
        .set({
          deleted_at: sql.raw('CURRENT_TIMESTAMP'),
        })
        .where('id', '=', id)
        .execute()
    }
    else {
      await db.deleteFrom('stripe_products')
        .where('id', '=', id)
        .execute()
    }
  }

  where(...args: (string | number | boolean | undefined | null)[]): StripeProductModel {
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

  static where(...args: (string | number | boolean | undefined | null)[]): StripeProductModel {
    let column: any
    let operator: any
    let value: any

    const instance = new StripeProductModel(null)

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

  static whereType(value: string): StripeProductModel {
    const instance = new StripeProductModel(null)

    instance.query = instance.query.where('type', '=', value)

    return instance
  }

  static whereMessage(value: string): StripeProductModel {
    const instance = new StripeProductModel(null)

    instance.query = instance.query.where('message', '=', value)

    return instance
  }

  static whereStack(value: string): StripeProductModel {
    const instance = new StripeProductModel(null)

    instance.query = instance.query.where('stack', '=', value)

    return instance
  }

  static whereStatus(value: string): StripeProductModel {
    const instance = new StripeProductModel(null)

    instance.query = instance.query.where('status', '=', value)

    return instance
  }

  static whereUserId(value: string): StripeProductModel {
    const instance = new StripeProductModel(null)

    instance.query = instance.query.where('user_id', '=', value)

    return instance
  }

  static whereAdditionalInfo(value: string): StripeProductModel {
    const instance = new StripeProductModel(null)

    instance.query = instance.query.where('additional_info', '=', value)

    return instance
  }

  static whereIn(column: keyof StripeProductType, values: any[]): StripeProductModel {
    const instance = new StripeProductModel(null)

    instance.query = instance.query.where(column, 'in', values)

    return instance
  }

  async first(): Promise<StripeProductModel | undefined> {
    const model = await this.query.selectAll().executeTakeFirst()

    if (!model) {
      return undefined
    }

    return this.parseResult(new StripeProductModel(model))
  }

  async firstOrFail(): Promise<StripeProductModel | undefined> {
    const model = await this.query.selectAll().executeTakeFirst()

    if (model === undefined)
      throw new HttpError(404, 'No StripeProductModel results found for query')

    return this.parseResult(new StripeProductModel(model))
  }

  async exists(): Promise<boolean> {
    const model = await this.query.selectAll().executeTakeFirst()

    return model !== null || model !== undefined
  }

  static async first(): Promise<StripeProductType | undefined> {
    return await db.selectFrom('stripe_products')
      .selectAll()
      .executeTakeFirst()
  }

  async last(): Promise<StripeProductType | undefined> {
    return await db.selectFrom('stripe_products')
      .selectAll()
      .orderBy('id', 'desc')
      .executeTakeFirst()
  }

  static async last(): Promise<StripeProductType | undefined> {
    return await db.selectFrom('stripe_products').selectAll().orderBy('id', 'desc').executeTakeFirst()
  }

  static orderBy(column: keyof StripeProductType, order: 'asc' | 'desc'): StripeProductModel {
    const instance = new StripeProductModel(null)

    instance.query = instance.query.orderBy(column, order)

    return instance
  }

  orderBy(column: keyof StripeProductType, order: 'asc' | 'desc'): StripeProductModel {
    this.query = this.query.orderBy(column, order)

    return this
  }

  static orderByDesc(column: keyof StripeProductType): StripeProductModel {
    const instance = new StripeProductModel(null)

    instance.query = instance.query.orderBy(column, 'desc')

    return instance
  }

  orderByDesc(column: keyof StripeProductType): StripeProductModel {
    this.query = this.orderBy(column, 'desc')

    return this
  }

  static orderByAsc(column: keyof StripeProductType): StripeProductModel {
    const instance = new StripeProductModel(null)

    instance.query = instance.query.orderBy(column, 'asc')

    return instance
  }

  orderByAsc(column: keyof StripeProductType): StripeProductModel {
    this.query = this.query.orderBy(column, 'desc')

    return this
  }

  async update(stripeproduct: StripeProductUpdate): Promise<StripeProductModel | undefined> {
    if (this.id === undefined)
      throw new HttpError(500, 'StripeProduct ID is undefined')

    const filteredValues = Object.fromEntries(
      Object.entries(stripeproduct).filter(([key]) => this.fillable.includes(key)),
    ) as NewStripeProduct

    await db.updateTable('stripe_products')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    const model = await this.find(Number(this.id))

    return model
  }

  async forceUpdate(stripeproduct: StripeProductUpdate): Promise<StripeProductModel | undefined> {
    if (this.id === undefined)
      throw new HttpError(500, 'StripeProduct ID is undefined')

    await db.updateTable('stripe_products')
      .set(stripeproduct)
      .where('id', '=', this.id)
      .executeTakeFirst()

    const model = await this.find(Number(this.id))

    return model
  }

  async save(): Promise<void> {
    if (!this)
      throw new HttpError(500, 'StripeProduct data is undefined')

    if (this.id === undefined) {
      await db.insertInto('stripe_products')
        .values(this as NewStripeProduct)
        .executeTakeFirstOrThrow()
    }
    else {
      await this.update(this)
    }
  }

  // Method to delete (soft delete) the stripeproduct instance
  async delete(): Promise<void> {
    if (this.id === undefined)
      throw new HttpError(500, 'StripeProduct ID is undefined')

    // Check if soft deletes are enabled
    if (this.softDeletes) {
      // Update the deleted_at column with the current timestamp
      await db.updateTable('stripe_products')
        .set({
          deleted_at: sql.raw('CURRENT_TIMESTAMP'),
        })
        .where('id', '=', this.id)
        .execute()
    }
    else {
      // Perform a hard delete
      await db.deleteFrom('stripe_products')
        .where('id', '=', this.id)
        .execute()
    }
  }

  distinct(column: keyof StripeProductType): StripeProductModel {
    this.query = this.query.select(column).distinct()

    this.hasSelect = true

    return this
  }

  static distinct(column: keyof StripeProductType): StripeProductModel {
    const instance = new StripeProductModel(null)

    instance.query = instance.query.select(column).distinct()

    instance.hasSelect = true

    return instance
  }

  join(table: string, firstCol: string, secondCol: string): StripeProductModel {
    this.query = this.query.innerJoin(table, firstCol, secondCol)

    return this
  }

  static join(table: string, firstCol: string, secondCol: string): StripeProductModel {
    const instance = new StripeProductModel(null)

    instance.query = instance.query.innerJoin(table, firstCol, secondCol)

    return instance
  }

  static async rawQuery(rawQuery: string): Promise<any> {
    return await sql`${rawQuery}`.execute(db)
  }

  toJSON() {
    const output: Partial<StripeProductType> = {

      id: this.id,
      type: this.type,
      message: this.message,
      stack: this.stack,
      status: this.status,
      user_id: this.user_id,
      additional_info: this.additional_info,

      created_at: this.created_at,

      updated_at: this.updated_at,

    }

        type StripeProduct = Omit<StripeProductType, 'password'>

        return output as StripeProduct
  }

  parseResult(model: StripeProductModel): StripeProductModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof StripeProductModel]
    }

    return model
  }
}

async function find(id: number): Promise<StripeProductModel | undefined> {
  const query = db.selectFrom('stripe_products').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  return new StripeProductModel(model)
}

export async function count(): Promise<number> {
  const results = await StripeProductModel.count()

  return results
}

export async function create(newStripeProduct: NewStripeProduct): Promise<StripeProductModel> {
  const result = await db.insertInto('stripe_products')
    .values(newStripeProduct)
    .executeTakeFirstOrThrow()

  return await find(Number(result.insertId)) as StripeProductModel
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(db)
}

export async function remove(id: number): Promise<void> {
  await db.deleteFrom('stripe_products')
    .where('id', '=', id)
    .execute()
}

export async function whereType(value: undefined): Promise<StripeProductModel[]> {
  const query = db.selectFrom('stripe_products').where('type', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new StripeProductModel(modelItem))
}

export async function whereMessage(value: undefined): Promise<StripeProductModel[]> {
  const query = db.selectFrom('stripe_products').where('message', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new StripeProductModel(modelItem))
}

export async function whereStack(value: undefined): Promise<StripeProductModel[]> {
  const query = db.selectFrom('stripe_products').where('stack', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new StripeProductModel(modelItem))
}

export async function whereStatus(value: undefined): Promise<StripeProductModel[]> {
  const query = db.selectFrom('stripe_products').where('status', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new StripeProductModel(modelItem))
}

export async function whereUserId(value: undefined): Promise<StripeProductModel[]> {
  const query = db.selectFrom('stripe_products').where('user_id', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new StripeProductModel(modelItem))
}

export async function whereAdditionalInfo(value: undefined): Promise<StripeProductModel[]> {
  const query = db.selectFrom('stripe_products').where('additional_info', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new StripeProductModel(modelItem))
}

export const StripeProduct = StripeProductModel

export default StripeProduct
