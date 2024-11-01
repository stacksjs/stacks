import type { Generated, Insertable, Selectable, Updateable } from 'kysely'
import { cache } from '@stacksjs/cache'
import { db, sql } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'

// import { Kysely, MysqlDialect, PostgresDialect } from 'kysely'
// import { Pool } from 'pg'

export interface SubscriptionsTable {
  id: Generated<number>
  user_id?: undefined
  type?: undefined
  stripe_id?: undefined
  stripe_status?: undefined
  stripe_price?: undefined
  quantity?: undefined
  trial_ends_at?: undefined
  ends_at?: undefined
  last_used_at?: undefined

  created_at?: Date

  updated_at?: Date

  deleted_at?: Date

}

interface SubscriptionResponse {
  data: Subscriptions
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export type SubscriptionType = Selectable<SubscriptionsTable>
export type NewSubscription = Insertable<SubscriptionsTable>
export type SubscriptionUpdate = Updateable<SubscriptionsTable>
export type Subscriptions = SubscriptionType[]

export type SubscriptionColumn = Subscriptions
export type SubscriptionColumns = Array<keyof Subscriptions>

    type SortDirection = 'asc' | 'desc'
interface SortOptions { column: SubscriptionType, order: SortDirection }
// Define a type for the options parameter
interface QueryOptions {
  sort?: SortOptions
  limit?: number
  offset?: number
  page?: number
}

export class SubscriptionModel {
  private hidden = []
  private fillable = ['user_id', 'type', 'stripe_id', 'stripe_status', 'stripe_price', 'quantity', 'trial_ends_at', 'ends_at', 'last_used_at', 'stripe_id', 'public_key', 'two_factor_secret']
  private softDeletes = false
  protected query: any
  protected hasSelect: boolean
  public id: number | undefined
  public user_id: undefined | undefined
  public type: undefined | undefined
  public stripe_id: undefined | undefined
  public stripe_status: undefined | undefined
  public stripe_price: undefined | undefined
  public quantity: undefined | undefined
  public trial_ends_at: undefined | undefined
  public ends_at: undefined | undefined
  public last_used_at: undefined | undefined

  public created_at: Date | undefined
  public updated_at: Date | undefined

  constructor(subscription: Partial<SubscriptionType> | null) {
    this.id = subscription?.id
    this.user_id = subscription?.user_id
    this.type = subscription?.type
    this.stripe_id = subscription?.stripe_id
    this.stripe_status = subscription?.stripe_status
    this.stripe_price = subscription?.stripe_price
    this.quantity = subscription?.quantity
    this.trial_ends_at = subscription?.trial_ends_at
    this.ends_at = subscription?.ends_at
    this.last_used_at = subscription?.last_used_at

    this.created_at = subscription?.created_at

    this.updated_at = subscription?.updated_at

    this.query = db.selectFrom('subscriptions')
    this.hasSelect = false
  }

  // Method to find a Subscription by ID
  async find(id: number): Promise<SubscriptionModel | undefined> {
    const query = db.selectFrom('subscriptions').where('id', '=', id).selectAll()

    const model = await query.executeTakeFirst()

    if (!model)
      return undefined

    cache.getOrSet(`subscription:${id}`, JSON.stringify(model))

    return this.parseResult(new SubscriptionModel(model))
  }

  // Method to find a Subscription by ID
  static async find(id: number): Promise<SubscriptionModel | undefined> {
    const query = db.selectFrom('subscriptions').where('id', '=', id).selectAll()

    const instance = new SubscriptionModel(null)

    const model = await query.executeTakeFirst()

    if (!model)
      return undefined

    cache.getOrSet(`subscription:${id}`, JSON.stringify(model))

    return instance.parseResult(new SubscriptionModel(model))
  }

  static async all(): Promise<SubscriptionModel[]> {
    let query = db.selectFrom('subscriptions').selectAll()

    const instance = new SubscriptionModel(null)

    if (instance.softDeletes) {
      query = query.where('deleted_at', 'is', null)
    }

    const results = await query.execute()

    return results.map(modelItem => instance.parseResult(new SubscriptionModel(modelItem)))
  }

  static async findOrFail(id: number): Promise<SubscriptionModel> {
    let query = db.selectFrom('subscriptions').where('id', '=', id)

    const instance = new SubscriptionModel(null)

    if (instance.softDeletes) {
      query = query.where('deleted_at', 'is', null)
    }

    query = query.selectAll()

    const model = await query.executeTakeFirst()

    if (model === undefined)
      throw new HttpError(404, `No SubscriptionModel results for ${id}`)

    cache.getOrSet(`subscription:${id}`, JSON.stringify(model))

    return instance.parseResult(new SubscriptionModel(model))
  }

  static async findMany(ids: number[]): Promise<SubscriptionModel[]> {
    let query = db.selectFrom('subscriptions').where('id', 'in', ids)

    const instance = new SubscriptionModel(null)

    if (instance.softDeletes) {
      query = query.where('deleted_at', 'is', null)
    }

    query = query.selectAll()

    const model = await query.execute()

    return model.map(modelItem => instance.parseResult(new SubscriptionModel(modelItem)))
  }

  // Method to get a User by criteria
  static async get(): Promise<UserModel[]> {
    const instance = new SubscriptionModel(null)

    if (instance.hasSelect) {
      if (instance.softDeletes) {
        instance.query = instance.query.where('deleted_at', 'is', null)
      }

      const model = await instance.query.execute()

      return model.map((modelItem: SubscriptionModel) => new SubscriptionModel(modelItem))
    }

    if (instance.softDeletes) {
      instance.query = instance.query.where('deleted_at', 'is', null)
    }

    const model = await instance.query.selectAll().execute()

    return model.map((modelItem: SubscriptionModel) => new SubscriptionModel(modelItem))
  }

  // Method to get a Subscription by criteria
  async get(): Promise<SubscriptionModel[]> {
    if (this.hasSelect) {
      if (this.softDeletes) {
        this.query = this.query.where('deleted_at', 'is', null)
      }

      const model = await this.query.execute()

      return model.map((modelItem: SubscriptionModel) => new SubscriptionModel(modelItem))
    }

    if (this.softDeletes) {
      this.query = this.query.where('deleted_at', 'is', null)
    }

    const model = await this.query.selectAll().execute()

    return model.map((modelItem: SubscriptionModel) => new SubscriptionModel(modelItem))
  }

  static async count(): Promise<number> {
    const instance = new SubscriptionModel(null)

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

  // Method to get all subscriptions
  static async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<SubscriptionResponse> {
    const totalRecordsResult = await db.selectFrom('subscriptions')
      .select(db.fn.count('id').as('total')) // Use 'id' or another actual column name
      .executeTakeFirst()

    const totalRecords = Number(totalRecordsResult?.total) || 0
    const totalPages = Math.ceil(totalRecords / (options.limit ?? 10))

    const subscriptionsWithExtra = await db.selectFrom('subscriptions')
      .selectAll()
      .orderBy('id', 'asc') // Assuming 'id' is used for cursor-based pagination
      .limit((options.limit ?? 10) + 1) // Fetch one extra record
      .offset(((options.page ?? 1) - 1) * (options.limit ?? 10)) // Ensure options.page is not undefined
      .execute()

    let nextCursor = null
    if (subscriptionsWithExtra.length > (options.limit ?? 10))
      nextCursor = subscriptionsWithExtra.pop()?.id ?? null

    return {
      data: subscriptionsWithExtra,
      paging: {
        total_records: totalRecords,
        page: options.page || 1,
        total_pages: totalPages,
      },
      next_cursor: nextCursor,
    }
  }

  // Method to create a new subscription
  static async create(newSubscription: NewSubscription): Promise<SubscriptionModel> {
    const instance = new SubscriptionModel(null)

    const filteredValues = Object.fromEntries(
      Object.entries(newSubscription).filter(([key]) => instance.fillable.includes(key)),
    ) as NewSubscription

    const result = await db.insertInto('subscriptions')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await find(Number(result.insertId)) as SubscriptionModel

    return model
  }

  static async forceCreate(newSubscription: NewSubscription): Promise<SubscriptionModel> {
    const result = await db.insertInto('subscriptions')
      .values(newSubscription)
      .executeTakeFirst()

    const model = await find(Number(result.insertId)) as SubscriptionModel

    return model
  }

  // Method to remove a Subscription
  static async remove(id: number): Promise<void> {
    const instance = new SubscriptionModel(null)

    if (instance.softDeletes) {
      await db.updateTable('subscriptions')
        .set({
          deleted_at: sql.raw('CURRENT_TIMESTAMP'),
        })
        .where('id', '=', id)
        .execute()
    }
    else {
      await db.deleteFrom('subscriptions')
        .where('id', '=', id)
        .execute()
    }
  }

  where(...args: (string | number | boolean | undefined | null)[]): SubscriptionModel {
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

  static where(...args: (string | number | boolean | undefined | null)[]): SubscriptionModel {
    let column: any
    let operator: any
    let value: any

    const instance = new SubscriptionModel(null)

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

  static whereUserId(value: string): SubscriptionModel {
    const instance = new SubscriptionModel(null)

    instance.query = instance.query.where('user_id', '=', value)

    return instance
  }

  static whereType(value: string): SubscriptionModel {
    const instance = new SubscriptionModel(null)

    instance.query = instance.query.where('type', '=', value)

    return instance
  }

  static whereStripeId(value: string): SubscriptionModel {
    const instance = new SubscriptionModel(null)

    instance.query = instance.query.where('stripe_id', '=', value)

    return instance
  }

  static whereStripeStatus(value: string): SubscriptionModel {
    const instance = new SubscriptionModel(null)

    instance.query = instance.query.where('stripe_status', '=', value)

    return instance
  }

  static whereStripePrice(value: string): SubscriptionModel {
    const instance = new SubscriptionModel(null)

    instance.query = instance.query.where('stripe_price', '=', value)

    return instance
  }

  static whereQuantity(value: string): SubscriptionModel {
    const instance = new SubscriptionModel(null)

    instance.query = instance.query.where('quantity', '=', value)

    return instance
  }

  static whereTrialEndsAt(value: string): SubscriptionModel {
    const instance = new SubscriptionModel(null)

    instance.query = instance.query.where('trial_ends_at', '=', value)

    return instance
  }

  static whereEndsAt(value: string): SubscriptionModel {
    const instance = new SubscriptionModel(null)

    instance.query = instance.query.where('ends_at', '=', value)

    return instance
  }

  static whereLastUsedAt(value: string): SubscriptionModel {
    const instance = new SubscriptionModel(null)

    instance.query = instance.query.where('last_used_at', '=', value)

    return instance
  }

  static whereIn(column: keyof SubscriptionType, values: any[]): SubscriptionModel {
    const instance = new SubscriptionModel(null)

    instance.query = instance.query.where(column, 'in', values)

    return instance
  }

  async first(): Promise<SubscriptionModel | undefined> {
    const model = await this.query.selectAll().executeTakeFirst()

    if (!model) {
      return undefined
    }

    return this.parseResult(new SubscriptionModel(model))
  }

  async firstOrFail(): Promise<SubscriptionModel | undefined> {
    const model = await this.query.selectAll().executeTakeFirst()

    if (model === undefined)
      throw new HttpError(404, 'No SubscriptionModel results found for query')

    return this.parseResult(new SubscriptionModel(model))
  }

  async exists(): Promise<boolean> {
    const model = await this.query.selectAll().executeTakeFirst()

    return model !== null || model !== undefined
  }

  static async first(): Promise<SubscriptionType | undefined> {
    return await db.selectFrom('subscriptions')
      .selectAll()
      .executeTakeFirst()
  }

  async last(): Promise<SubscriptionType | undefined> {
    return await db.selectFrom('subscriptions')
      .selectAll()
      .orderBy('id', 'desc')
      .executeTakeFirst()
  }

  static async last(): Promise<SubscriptionType | undefined> {
    return await db.selectFrom('subscriptions').selectAll().orderBy('id', 'desc').executeTakeFirst()
  }

  static orderBy(column: keyof SubscriptionType, order: 'asc' | 'desc'): SubscriptionModel {
    const instance = new SubscriptionModel(null)

    instance.query = instance.query.orderBy(column, order)

    return instance
  }

  orderBy(column: keyof SubscriptionType, order: 'asc' | 'desc'): SubscriptionModel {
    this.query = this.query.orderBy(column, order)

    return this
  }

  static orderByDesc(column: keyof SubscriptionType): SubscriptionModel {
    const instance = new SubscriptionModel(null)

    instance.query = instance.query.orderBy(column, 'desc')

    return instance
  }

  orderByDesc(column: keyof SubscriptionType): SubscriptionModel {
    this.query = this.orderBy(column, 'desc')

    return this
  }

  static orderByAsc(column: keyof SubscriptionType): SubscriptionModel {
    const instance = new SubscriptionModel(null)

    instance.query = instance.query.orderBy(column, 'asc')

    return instance
  }

  orderByAsc(column: keyof SubscriptionType): SubscriptionModel {
    this.query = this.query.orderBy(column, 'desc')

    return this
  }

  async update(subscription: SubscriptionUpdate): Promise<SubscriptionModel | undefined> {
    if (this.id === undefined)
      throw new HttpError(500, 'Subscription ID is undefined')

    const filteredValues = Object.fromEntries(
      Object.entries(subscription).filter(([key]) => this.fillable.includes(key)),
    ) as NewSubscription

    await db.updateTable('subscriptions')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    const model = await this.find(Number(this.id))

    return model
  }

  async forceUpdate(subscription: SubscriptionUpdate): Promise<SubscriptionModel | undefined> {
    if (this.id === undefined)
      throw new HttpError(500, 'Subscription ID is undefined')

    await db.updateTable('subscriptions')
      .set(subscription)
      .where('id', '=', this.id)
      .executeTakeFirst()

    const model = await this.find(Number(this.id))

    return model
  }

  async save(): Promise<void> {
    if (!this)
      throw new HttpError(500, 'Subscription data is undefined')

    if (this.id === undefined) {
      await db.insertInto('subscriptions')
        .values(this as NewSubscription)
        .executeTakeFirstOrThrow()
    }
    else {
      await this.update(this)
    }
  }

  // Method to delete (soft delete) the subscription instance
  async delete(): Promise<void> {
    if (this.id === undefined)
      throw new HttpError(500, 'Subscription ID is undefined')

    // Check if soft deletes are enabled
    if (this.softDeletes) {
      // Update the deleted_at column with the current timestamp
      await db.updateTable('subscriptions')
        .set({
          deleted_at: sql.raw('CURRENT_TIMESTAMP'),
        })
        .where('id', '=', this.id)
        .execute()
    }
    else {
      // Perform a hard delete
      await db.deleteFrom('subscriptions')
        .where('id', '=', this.id)
        .execute()
    }
  }

  distinct(column: keyof SubscriptionType): SubscriptionModel {
    this.query = this.query.select(column).distinct()

    this.hasSelect = true

    return this
  }

  static distinct(column: keyof SubscriptionType): SubscriptionModel {
    const instance = new SubscriptionModel(null)

    instance.query = instance.query.select(column).distinct()

    instance.hasSelect = true

    return instance
  }

  join(table: string, firstCol: string, secondCol: string): SubscriptionModel {
    this.query = this.query.innerJoin(table, firstCol, secondCol)

    return this
  }

  static join(table: string, firstCol: string, secondCol: string): SubscriptionModel {
    const instance = new SubscriptionModel(null)

    instance.query = instance.query.innerJoin(table, firstCol, secondCol)

    return instance
  }

  static async rawQuery(rawQuery: string): Promise<any> {
    return await sql`${rawQuery}`.execute(db)
  }

  toJSON() {
    const output: Partial<SubscriptionType> = {

      id: this.id,
      user_id: this.user_id,
      type: this.type,
      stripe_id: this.stripe_id,
      stripe_status: this.stripe_status,
      stripe_price: this.stripe_price,
      quantity: this.quantity,
      trial_ends_at: this.trial_ends_at,
      ends_at: this.ends_at,
      last_used_at: this.last_used_at,

      created_at: this.created_at,

      updated_at: this.updated_at,

    }

        type Subscription = Omit<SubscriptionType, 'password'>

        return output as Subscription
  }

  parseResult(model: SubscriptionModel): SubscriptionModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof SubscriptionModel]
    }

    return model
  }
}

async function find(id: number): Promise<SubscriptionModel | undefined> {
  const query = db.selectFrom('subscriptions').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  return new SubscriptionModel(model)
}

export async function count(): Promise<number> {
  const results = await SubscriptionModel.count()

  return results
}

export async function create(newSubscription: NewSubscription): Promise<SubscriptionModel> {
  const result = await db.insertInto('subscriptions')
    .values(newSubscription)
    .executeTakeFirstOrThrow()

  return await find(Number(result.insertId)) as SubscriptionModel
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(db)
}

export async function remove(id: number): Promise<void> {
  await db.deleteFrom('subscriptions')
    .where('id', '=', id)
    .execute()
}

export async function whereUserId(value: undefined): Promise<SubscriptionModel[]> {
  const query = db.selectFrom('subscriptions').where('user_id', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new SubscriptionModel(modelItem))
}

export async function whereType(value: undefined): Promise<SubscriptionModel[]> {
  const query = db.selectFrom('subscriptions').where('type', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new SubscriptionModel(modelItem))
}

export async function whereStripeId(value: undefined): Promise<SubscriptionModel[]> {
  const query = db.selectFrom('subscriptions').where('stripe_id', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new SubscriptionModel(modelItem))
}

export async function whereStripeStatus(value: undefined): Promise<SubscriptionModel[]> {
  const query = db.selectFrom('subscriptions').where('stripe_status', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new SubscriptionModel(modelItem))
}

export async function whereStripePrice(value: undefined): Promise<SubscriptionModel[]> {
  const query = db.selectFrom('subscriptions').where('stripe_price', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new SubscriptionModel(modelItem))
}

export async function whereQuantity(value: undefined): Promise<SubscriptionModel[]> {
  const query = db.selectFrom('subscriptions').where('quantity', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new SubscriptionModel(modelItem))
}

export async function whereTrialEndsAt(value: undefined): Promise<SubscriptionModel[]> {
  const query = db.selectFrom('subscriptions').where('trial_ends_at', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new SubscriptionModel(modelItem))
}

export async function whereEndsAt(value: undefined): Promise<SubscriptionModel[]> {
  const query = db.selectFrom('subscriptions').where('ends_at', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new SubscriptionModel(modelItem))
}

export async function whereLastUsedAt(value: undefined): Promise<SubscriptionModel[]> {
  const query = db.selectFrom('subscriptions').where('last_used_at', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new SubscriptionModel(modelItem))
}

export const Subscription = SubscriptionModel

export default Subscription
