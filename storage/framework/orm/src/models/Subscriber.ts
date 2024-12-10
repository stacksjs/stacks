import type { Generated, Insertable, Selectable, Updateable } from 'kysely'
import { randomUUIDv7 } from 'bun'
import { cache } from '@stacksjs/cache'
import { db, sql } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'

export interface SubscribersTable {
  id?: Generated<number>
  subscribed?: boolean
  user_id?: number

  created_at?: Date

  updated_at?: Date

  deleted_at?: Date

}

interface SubscriberResponse {
  data: Subscribers
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export type Subscriber = SubscribersTable
export type SubscriberType = Selectable<Subscriber>
export type NewSubscriber = Insertable<Subscriber>
export type SubscriberUpdate = Updateable<Subscriber>
export type Subscribers = SubscriberType[]

export type SubscriberColumn = Subscribers
export type SubscriberColumns = Array<keyof Subscribers>

    type SortDirection = 'asc' | 'desc'
interface SortOptions { column: SubscriberType, order: SortDirection }
// Define a type for the options parameter
interface QueryOptions {
  sort?: SortOptions
  limit?: number
  offset?: number
  page?: number
}

export class SubscriberModel {
  private hidden = []
  private fillable = ['subscribed', 'uuid', 'user_id']
  private softDeletes = false
  protected query: any
  protected hasSelect: boolean
  public id: number | undefined
  public subscribed: boolean | undefined

  public created_at: Date | undefined
  public updated_at: Date | undefined
  public user_id: number | undefined

  constructor(subscriber: Partial<SubscriberType> | null) {
    this.id = subscriber?.id
    this.subscribed = subscriber?.subscribed

    this.created_at = subscriber?.created_at

    this.updated_at = subscriber?.updated_at

    this.user_id = subscriber?.user_id

    this.query = db.selectFrom('subscribers')
    this.hasSelect = false
  }

  // Method to find a Subscriber by ID
  async find(id: number): Promise<SubscriberModel | undefined> {
    const query = db.selectFrom('subscribers').where('id', '=', id).selectAll()

    const model = await query.executeTakeFirst()

    if (!model)
      return undefined

    cache.getOrSet(`subscriber:${id}`, JSON.stringify(model))

    return this.parseResult(new SubscriberModel(model))
  }

  // Method to find a Subscriber by ID
  static async find(id: number): Promise<SubscriberModel | undefined> {
    const query = db.selectFrom('subscribers').where('id', '=', id).selectAll()

    const instance = new SubscriberModel(null)

    const model = await query.executeTakeFirst()

    if (!model)
      return undefined

    cache.getOrSet(`subscriber:${id}`, JSON.stringify(model))

    return instance.parseResult(new SubscriberModel(model))
  }

  static async all(): Promise<SubscriberModel[]> {
    let query = db.selectFrom('subscribers').selectAll()

    const instance = new SubscriberModel(null)

    if (instance.softDeletes) {
      query = query.where('deleted_at', 'is', null)
    }

    const results = await query.execute()

    return results.map(modelItem => instance.parseResult(new SubscriberModel(modelItem)))
  }

  static async findOrFail(id: number): Promise<SubscriberModel> {
    let query = db.selectFrom('subscribers').where('id', '=', id)

    const instance = new SubscriberModel(null)

    if (instance.softDeletes) {
      query = query.where('deleted_at', 'is', null)
    }

    query = query.selectAll()

    const model = await query.executeTakeFirst()

    if (model === undefined)
      throw new HttpError(404, `No SubscriberModel results for ${id}`)

    cache.getOrSet(`subscriber:${id}`, JSON.stringify(model))

    return instance.parseResult(new SubscriberModel(model))
  }

  static async findMany(ids: number[]): Promise<SubscriberModel[]> {
    let query = db.selectFrom('subscribers').where('id', 'in', ids)

    const instance = new SubscriberModel(null)

    if (instance.softDeletes) {
      query = query.where('deleted_at', 'is', null)
    }

    query = query.selectAll()

    const model = await query.execute()

    return model.map(modelItem => instance.parseResult(new SubscriberModel(modelItem)))
  }

  // Method to get a User by criteria
  static async get(): Promise<SubscriberModel[]> {
    const instance = new SubscriberModel(null)

    if (instance.hasSelect) {
      if (instance.softDeletes) {
        instance.query = instance.query.where('deleted_at', 'is', null)
      }

      const model = await instance.query.execute()

      return model.map((modelItem: SubscriberModel) => new SubscriberModel(modelItem))
    }

    if (instance.softDeletes) {
      instance.query = instance.query.where('deleted_at', 'is', null)
    }

    const model = await instance.query.selectAll().execute()

    return model.map((modelItem: SubscriberModel) => new SubscriberModel(modelItem))
  }

  // Method to get a Subscriber by criteria
  async get(): Promise<SubscriberModel[]> {
    if (this.hasSelect) {
      if (this.softDeletes) {
        this.query = this.query.where('deleted_at', 'is', null)
      }

      const model = await this.query.execute()

      return model.map((modelItem: SubscriberModel) => new SubscriberModel(modelItem))
    }

    if (this.softDeletes) {
      this.query = this.query.where('deleted_at', 'is', null)
    }

    const model = await this.query.selectAll().execute()

    return model.map((modelItem: SubscriberModel) => new SubscriberModel(modelItem))
  }

  static async count(): Promise<number> {
    const instance = new SubscriberModel(null)

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

  // Method to get all subscribers
  static async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<SubscriberResponse> {
    const totalRecordsResult = await db.selectFrom('subscribers')
      .select(db.fn.count('id').as('total')) // Use 'id' or another actual column name
      .executeTakeFirst()

    const totalRecords = Number(totalRecordsResult?.total) || 0
    const totalPages = Math.ceil(totalRecords / (options.limit ?? 10))

    const subscribersWithExtra = await db.selectFrom('subscribers')
      .selectAll()
      .orderBy('id', 'asc') // Assuming 'id' is used for cursor-based pagination
      .limit((options.limit ?? 10) + 1) // Fetch one extra record
      .offset(((options.page ?? 1) - 1) * (options.limit ?? 10)) // Ensure options.page is not undefined
      .execute()

    let nextCursor = null
    if (subscribersWithExtra.length > (options.limit ?? 10))
      nextCursor = subscribersWithExtra.pop()?.id ?? null

    return {
      data: subscribersWithExtra,
      paging: {
        total_records: totalRecords,
        page: options.page || 1,
        total_pages: totalPages,
      },
      next_cursor: nextCursor,
    }
  }

  // Method to create a new subscriber
  static async create(newSubscriber: NewSubscriber): Promise<SubscriberModel> {
    const instance = new SubscriberModel(null)

    const filteredValues = Object.fromEntries(
      Object.entries(newSubscriber).filter(([key]) => instance.fillable.includes(key)),
    ) as NewSubscriber

    const result = await db.insertInto('subscribers')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await find(Number(result.insertId)) as SubscriberModel

    return model
  }

  static async createMany(newSubscribers: NewUser[]): Promise<void> {
    const instance = new SubscriberModel(null)

    const filteredValues = newSubscribers.map(newUser =>
      Object.fromEntries(
        Object.entries(newUser).filter(([key]) => instance.fillable.includes(key)),
      ) as NewSubscriber,
    )

    filteredValues.forEach((model) => {
      model.uuid = randomUUIDv7()
    })

    await db.insertInto('subscribers')
      .values(filteredValues)
      .executeTakeFirst()
  }

  static async forceCreate(newSubscriber: NewSubscriber): Promise<SubscriberModel> {
    const result = await db.insertInto('subscribers')
      .values(newSubscriber)
      .executeTakeFirst()

    const model = await find(Number(result.insertId)) as SubscriberModel

    return model
  }

  // Method to remove a Subscriber
  static async remove(id: number): Promise<void> {
    const instance = new SubscriberModel(null)

    if (instance.softDeletes) {
      await db.updateTable('subscribers')
        .set({
          deleted_at: sql.raw('CURRENT_TIMESTAMP'),
        })
        .where('id', '=', id)
        .execute()
    }
    else {
      await db.deleteFrom('subscribers')
        .where('id', '=', id)
        .execute()
    }
  }

  where(...args: (string | number | boolean | undefined | null)[]): SubscriberModel {
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

  static where(...args: (string | number | boolean | undefined | null)[]): SubscriberModel {
    let column: any
    let operator: any
    let value: any

    const instance = new SubscriberModel(null)

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

  static whereNull(column: string): SubscriberModel {
    const instance = new SubscriberModel(null)

    instance.query = instance.query.where(column, 'is', null)

    return instance
  }

  whereNull(column: string): SubscriberModel {
    this.query = this.query.where(column, 'is', null)

    return this
  }

  static whereSubscribed(value: string): SubscriberModel {
    const instance = new SubscriberModel(null)

    instance.query = instance.query.where('subscribed', '=', value)

    return instance
  }

  static whereIn(column: keyof SubscriberType, values: any[]): SubscriberModel {
    const instance = new SubscriberModel(null)

    instance.query = instance.query.where(column, 'in', values)

    return instance
  }

  async first(): Promise<SubscriberModel | undefined> {
    const model = await this.query.selectAll().executeTakeFirst()

    if (!model) {
      return undefined
    }

    return this.parseResult(new SubscriberModel(model))
  }

  async firstOrFail(): Promise<SubscriberModel | undefined> {
    const model = await this.query.selectAll().executeTakeFirst()

    if (model === undefined)
      throw new HttpError(404, 'No SubscriberModel results found for query')

    return this.parseResult(new SubscriberModel(model))
  }

  async exists(): Promise<boolean> {
    const model = await this.query.selectAll().executeTakeFirst()

    return model !== null || model !== undefined
  }

  static async first(): Promise<SubscriberType | undefined> {
    return await db.selectFrom('subscribers')
      .selectAll()
      .executeTakeFirst()
  }

  async last(): Promise<SubscriberType | undefined> {
    return await db.selectFrom('subscribers')
      .selectAll()
      .orderBy('id', 'desc')
      .executeTakeFirst()
  }

  static async last(): Promise<SubscriberType | undefined> {
    return await db.selectFrom('subscribers').selectAll().orderBy('id', 'desc').executeTakeFirst()
  }

  static orderBy(column: keyof SubscriberType, order: 'asc' | 'desc'): SubscriberModel {
    const instance = new SubscriberModel(null)

    instance.query = instance.query.orderBy(column, order)

    return instance
  }

  orderBy(column: keyof SubscriberType, order: 'asc' | 'desc'): SubscriberModel {
    this.query = this.query.orderBy(column, order)

    return this
  }

  static orderByDesc(column: keyof SubscriberType): SubscriberModel {
    const instance = new SubscriberModel(null)

    instance.query = instance.query.orderBy(column, 'desc')

    return instance
  }

  orderByDesc(column: keyof SubscriberType): SubscriberModel {
    this.query = this.orderBy(column, 'desc')

    return this
  }

  static orderByAsc(column: keyof SubscriberType): SubscriberModel {
    const instance = new SubscriberModel(null)

    instance.query = instance.query.orderBy(column, 'asc')

    return instance
  }

  orderByAsc(column: keyof SubscriberType): SubscriberModel {
    this.query = this.query.orderBy(column, 'desc')

    return this
  }

  async update(subscriber: SubscriberUpdate): Promise<SubscriberModel | undefined> {
    if (this.id === undefined)
      throw new HttpError(500, 'Subscriber ID is undefined')

    const filteredValues = Object.fromEntries(
      Object.entries(subscriber).filter(([key]) => this.fillable.includes(key)),
    ) as NewSubscriber

    await db.updateTable('subscribers')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    const model = await this.find(Number(this.id))

    return model
  }

  async forceUpdate(subscriber: SubscriberUpdate): Promise<SubscriberModel | undefined> {
    if (this.id === undefined)
      throw new HttpError(500, 'Subscriber ID is undefined')

    await db.updateTable('subscribers')
      .set(subscriber)
      .where('id', '=', this.id)
      .executeTakeFirst()

    const model = await this.find(Number(this.id))

    return model
  }

  async save(): Promise<void> {
    if (!this)
      throw new HttpError(500, 'Subscriber data is undefined')

    if (this.id === undefined) {
      await db.insertInto('subscribers')
        .values(this as NewSubscriber)
        .executeTakeFirstOrThrow()
    }
    else {
      await this.update(this)
    }
  }

  // Method to delete (soft delete) the subscriber instance
  async delete(): Promise<void> {
    if (this.id === undefined)
      throw new HttpError(500, 'Subscriber ID is undefined')

    // Check if soft deletes are enabled
    if (this.softDeletes) {
      // Update the deleted_at column with the current timestamp
      await db.updateTable('subscribers')
        .set({
          deleted_at: sql.raw('CURRENT_TIMESTAMP'),
        })
        .where('id', '=', this.id)
        .execute()
    }
    else {
      // Perform a hard delete
      await db.deleteFrom('subscribers')
        .where('id', '=', this.id)
        .execute()
    }
  }

  distinct(column: keyof SubscriberType): SubscriberModel {
    this.query = this.query.select(column).distinct()

    this.hasSelect = true

    return this
  }

  static distinct(column: keyof SubscriberType): SubscriberModel {
    const instance = new SubscriberModel(null)

    instance.query = instance.query.select(column).distinct()

    instance.hasSelect = true

    return instance
  }

  join(table: string, firstCol: string, secondCol: string): SubscriberModel {
    this.query = this.query.innerJoin(table, firstCol, secondCol)

    return this
  }

  static join(table: string, firstCol: string, secondCol: string): SubscriberModel {
    const instance = new SubscriberModel(null)

    instance.query = instance.query.innerJoin(table, firstCol, secondCol)

    return instance
  }

  static async rawQuery(rawQuery: string): Promise<any> {
    return await sql`${rawQuery}`.execute(db)
  }

  toJSON() {
    const output: Partial<SubscriberType> = {

      id: this.id,
      subscribed: this.subscribed,

      created_at: this.created_at,

      updated_at: this.updated_at,

    }

        type Subscriber = Omit<SubscriberType, 'password'>

        return output as Subscriber
  }

  parseResult(model: SubscriberModel): SubscriberModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof SubscriberModel]
    }

    return model
  }
}

async function find(id: number): Promise<SubscriberModel | undefined> {
  const query = db.selectFrom('subscribers').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  return new SubscriberModel(model)
}

export async function count(): Promise<number> {
  const results = await SubscriberModel.count()

  return results
}

export async function create(newSubscriber: NewSubscriber): Promise<SubscriberModel> {
  const result = await db.insertInto('subscribers')
    .values(newSubscriber)
    .executeTakeFirstOrThrow()

  return await find(Number(result.insertId)) as SubscriberModel
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(db)
}

export async function remove(id: number): Promise<void> {
  await db.deleteFrom('subscribers')
    .where('id', '=', id)
    .execute()
}

export async function whereSubscribed(value: boolean): Promise<SubscriberModel[]> {
  const query = db.selectFrom('subscribers').where('subscribed', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new SubscriberModel(modelItem))
}

export const Subscriber = SubscriberModel

export default Subscriber
