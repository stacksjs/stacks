import { generateTwoFactorSecret } from '@stacksjs/auth'
import { verifyTwoFactorCode } from '@stacksjs/auth'
import { db } from '@stacksjs/database'
import { sql } from '@stacksjs/database'
import type { ColumnType, Generated, Insertable, Selectable, Updateable } from 'kysely'

// import { Kysely, MysqlDialect, PostgresDialect } from 'kysely'
// import { Pool } from 'pg'

// TODO: we need an action that auto-generates these table interfaces
export interface SubscribersTable {
  id: Generated<number>
  subscribed: boolean
  user_id: number

  created_at: ColumnType<Date, string | undefined, never>
  updated_at: ColumnType<Date, string | undefined, never>
  deleted_at: ColumnType<Date, string | undefined, never>
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

export type SubscriberType = Selectable<SubscribersTable>
export type NewSubscriber = Insertable<SubscribersTable>
export type SubscriberUpdate = Updateable<SubscribersTable>
export type Subscribers = SubscriberType[]

export type SubscriberColumn = Subscribers
export type SubscriberColumns = Array<keyof Subscribers>

type SortDirection = 'asc' | 'desc'
interface SortOptions {
  column: SubscriberType
  order: SortDirection
}
// Define a type for the options parameter
interface QueryOptions {
  sort?: SortOptions
  limit?: number
  offset?: number
  page?: number
}

export class SubscriberModel {
  private subscriber: Partial<SubscriberType> | null
  private hidden = []
  private fillable = []
  protected query: any
  protected hasSelect: boolean
  public id: number | undefined
  public subscribed: boolean | undefined
  public user_id: number | undefined

  constructor(subscriber: Partial<SubscriberType> | null) {
    this.subscriber = subscriber
    this.id = subscriber?.id
    this.subscribed = subscriber?.subscribed
    this.user_id = subscriber?.user_id

    this.query = db.selectFrom('subscribers')
    this.hasSelect = false
  }

  // Method to find a Subscriber by ID
  async find(id: number, fields?: (keyof SubscriberType)[]): Promise<SubscriberModel | undefined> {
    let query = db.selectFrom('subscribers').where('id', '=', id)

    if (fields) query = query.select(fields)
    else query = query.selectAll()

    const model = await query.executeTakeFirst()

    if (!model) return undefined

    return this.parseResult(new SubscriberModel(model))
  }

  // Method to find a Subscriber by ID
  static async find(id: number, fields?: (keyof SubscriberType)[]): Promise<SubscriberModel | undefined> {
    let query = db.selectFrom('subscribers').where('id', '=', id)

    const instance = new this(null)

    if (fields) query = query.select(fields)
    else query = query.selectAll()

    const model = await query.executeTakeFirst()

    if (!model) return undefined

    return instance.parseResult(new this(model))
  }

  static async findOrFail(id: number, fields?: (keyof SubscriberType)[]): Promise<SubscriberModel> {
    let query = db.selectFrom('subscribers').where('id', '=', id)

    const instance = new this(null)

    if (fields) query = query.select(fields)
    else query = query.selectAll()

    const model = await query.executeTakeFirst()

    if (!model) throw `No model results found for ${id} `

    return instance.parseResult(new this(model))
  }

  static async findMany(ids: number[], fields?: (keyof SubscriberType)[]): Promise<SubscriberModel[]> {
    let query = db.selectFrom('subscribers').where('id', 'in', ids)

    const instance = new this(null)

    if (fields) query = query.select(fields)
    else query = query.selectAll()

    const model = await query.execute()

    instance.parseResult(new SubscriberModel(modelItem))

    return model.map((modelItem) => instance.parseResult(new SubscriberModel(modelItem)))
  }

  // Method to get a Subscriber by criteria
  static async fetch(criteria: Partial<SubscriberType>, options: QueryOptions = {}): Promise<SubscriberModel[]> {
    let query = db.selectFrom('subscribers')

    // Apply sorting from options
    if (options.sort) query = query.orderBy(options.sort.column, options.sort.order)

    // Apply limit and offset from options
    if (options.limit !== undefined) query = query.limit(options.limit)

    if (options.offset !== undefined) query = query.offset(options.offset)

    const model = await query.selectAll().execute()
    return model.map((modelItem) => new SubscriberModel(modelItem))
  }

  // Method to get a Subscriber by criteria
  static async get(): Promise<SubscriberModel[]> {
    const query = db.selectFrom('subscribers')

    const model = await query.selectAll().execute()

    return model.map((modelItem) => new SubscriberModel(modelItem))
  }

  // Method to get a Subscriber by criteria
  async get(): Promise<SubscriberModel[]> {
    if (this.hasSelect) {
      const model = await this.query.execute()

      return model.map((modelItem: SubscriberModel) => new SubscriberModel(modelItem))
    }

    const model = await this.query.selectAll().execute()

    return model.map((modelItem: SubscriberModel) => new SubscriberModel(modelItem))
  }

  static async count(): Promise<number> {
    const instance = new this(null)

    const results = await instance.query.selectAll().execute()

    return results.length
  }

  async count(): Promise<number> {
    if (this.hasSelect) {
      const results = await this.query.execute()

      return results.length
    }

    const results = await this.query.selectAll().execute()

    return results.length
  }

  // Method to get all subscribers
  static async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<SubscriberResponse> {
    const totalRecordsResult = await db
      .selectFrom('subscribers')
      .select(db.fn.count('id').as('total')) // Use 'id' or another actual column name
      .executeTakeFirst()

    const totalRecords = Number(totalRecordsResult?.total) || 0
    const totalPages = Math.ceil(totalRecords / (options.limit ?? 10))

    const subscribersWithExtra = await db
      .selectFrom('subscribers')
      .selectAll()
      .orderBy('id', 'asc') // Assuming 'id' is used for cursor-based pagination
      .limit((options.limit ?? 10) + 1) // Fetch one extra record
      .offset(((options.page ?? 1) - 1) * (options.limit ?? 10)) // Ensure options.page is not undefined
      .execute()

    let nextCursor = null
    if (subscribersWithExtra.length > (options.limit ?? 10)) nextCursor = subscribersWithExtra.pop()!.id // Use the ID of the extra record as the next cursor

    return {
      data: subscribersWithExtra,
      paging: {
        total_records: totalRecords,
        page: options.page,
        total_pages: totalPages,
      },
      next_cursor: nextCursor,
    }
  }

  // Method to create a new subscriber
  static async create(newSubscriber: NewSubscriber): Promise<SubscriberModel | undefined> {
    const instance = new this(null)
    const filteredValues = Object.keys(newSubscriber)
      .filter((key) => instance.fillable.includes(key))
      .reduce((obj: any, key) => {
        obj[key] = newSubscriber[key]
        return obj
      }, {})

    if (Object.keys(filteredValues).length === 0) {
      return undefined
    }

    const result = await db.insertInto('subscribers').values(filteredValues).executeTakeFirstOrThrow()

    return (await find(Number(result.insertId))) as SubscriberModel
  }

  // Method to remove a Subscriber
  static async remove(id: number): Promise<void> {
    await db.deleteFrom('subscribers').where('id', '=', id).execute()
  }

  where(...args: (string | number | boolean | undefined | null)[]): SubscriberModel {
    let column: any
    let operator: any
    let value: any

    if (args.length === 2) {
      ;[column, value] = args
      operator = '='
    } else if (args.length === 3) {
      ;[column, operator, value] = args
    } else {
      throw new Error('Invalid number of arguments')
    }

    this.query = this.query.where(column, operator, value)

    return this
  }

  static where(...args: (string | number | boolean | undefined | null)[]): SubscriberModel {
    let column: any
    let operator: any
    let value: any

    const instance = new this(null)

    if (args.length === 2) {
      ;[column, value] = args
      operator = '='
    } else if (args.length === 3) {
      ;[column, operator, value] = args
    } else {
      throw new Error('Invalid number of arguments')
    }

    instance.query = instance.query.where(column, operator, value)

    return instance
  }

  static whereSubscribed(value: string | number | boolean | undefined | null): SubscriberModel {
    const instance = new this(null)

    instance.query = instance.query.where('subscribed', '=', value)

    return instance
  }

  static whereIn(column: keyof SubscriberType, values: any[]): SubscriberModel {
    const instance = new this(null)

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

  async exists(): Promise<boolean> {
    const model = await this.query.selectAll().executeTakeFirst()

    return model !== null || model !== undefined
  }

  static async first(): Promise<SubscriberType | undefined> {
    return await db.selectFrom('subscribers').selectAll().executeTakeFirst()
  }

  async last(): Promise<SubscriberType | undefined> {
    return await db.selectFrom('subscribers').selectAll().orderBy('id', 'desc').executeTakeFirst()
  }

  static orderBy(column: keyof SubscriberType, order: 'asc' | 'desc'): SubscriberModel {
    const instance = new this(null)

    instance.query = instance.orderBy(column, order)

    return instance
  }

  orderBy(column: keyof SubscriberType, order: 'asc' | 'desc'): SubscriberModel {
    this.query = this.query.orderBy(column, order)

    return this
  }

  static orderByDesc(column: keyof SubscriberType): SubscriberModel {
    const instance = new this(null)

    instance.query = instance.query.orderBy(column, 'desc')

    return instance
  }

  orderByDesc(column: keyof SubscriberType): SubscriberModel {
    this.query = this.orderBy(column, 'desc')

    return this
  }

  static orderByAsc(column: keyof SubscriberType): SubscriberModel {
    const instance = new this(null)

    instance.query = instance.query.orderBy(column, 'desc')

    return instance
  }

  orderByAsc(column: keyof SubscriberType): SubscriberModel {
    this.query = this.query.orderBy(column, 'desc')

    return this
  }

  // Method to update the subscribers instance
  async update(subscriber: SubscriberUpdate): Promise<SubscriberModel | null> {
    if (this.id === undefined) throw new Error('Subscriber ID is undefined')

    const filteredValues = Object.keys(newSubscriber)
      .filter((key) => this.fillable.includes(key))
      .reduce((obj, key) => {
        obj[key] = newSubscriber[key]
        return obj
      }, {})

    await db.updateTable('subscribers').set(filteredValues).where('id', '=', this.id).executeTakeFirst()

    return await this.find(Number(this.id))
  }

  // Method to save (insert or update) the subscriber instance
  async save(): Promise<void> {
    if (!this.subscriber) throw new Error('Subscriber data is undefined')

    if (this.subscriber.id === undefined) {
      // Insert new subscriber
      const newModel = await db
        .insertInto('subscribers')
        .values(this.subscriber as NewSubscriber)
        .executeTakeFirstOrThrow()
    } else {
      // Update existing subscriber
      await this.update(this.subscriber)
    }
  }

  // Method to delete the subscriber instance
  async delete(): Promise<void> {
    if (this.id === undefined) throw new Error('Subscriber ID is undefined')

    await db.deleteFrom('subscribers').where('id', '=', this.id).execute()
  }

  distinct(column: keyof SubscriberType): SubscriberModel {
    this.query = this.query.distinctOn(column)

    return this
  }

  static distinct(column: keyof SubscriberType): SubscriberModel {
    const instance = new this(null)

    instance.query = instance.query.distinctOn(column)

    return instance
  }

  join(table: string, firstCol: string, secondCol: string): SubscriberModel {
    this.query = this.query.innerJoin(table, firstCol, secondCol)

    return this
  }

  static join(table: string, firstCol: string, secondCol: string): SubscriberModel {
    const instance = new this(null)

    instance.query = instance.query.innerJoin(table, firstCol, secondCol)

    return instance
  }

  static async rawQuery(rawQuery: string): Promise<any> {
    return await sql`${rawQuery}`.execute(db)
  }

  toJSON() {
    const output: Partial<SubscriberType> = { ...this.subscriber }

    this.hidden.forEach((attr) => {
      if (attr in output) delete output[attr as keyof Partial<SubscriberType>]
    })

    type Subscriber = Omit<SubscriberType, 'password'>

    return output as Subscriber
  }

  parseResult(model: SubscriberModel): SubscriberModel {
    delete model['query']
    delete model['fillable']
    delete model['two_factor_secret']
    delete model['hasSelect']

    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute]
      delete model.subscriber[hiddenAttribute]
    }

    return model
  }
}

async function find(id: number, fields?: (keyof SubscriberType)[]): Promise<SubscriberModel | null> {
  let query = db.selectFrom('subscribers').where('id', '=', id)

  if (fields) query = query.select(fields)
  else query = query.selectAll()

  const model = await query.executeTakeFirst()

  if (!model) return null

  return new SubscriberModel(model)
}

export async function count(): Promise<number> {
  const results = await SubscriberModel.count()

  return results
}

export async function create(newSubscriber: NewSubscriber): Promise<SubscriberModel> {
  const result = await db.insertInto('subscribers').values(newSubscriber).executeTakeFirstOrThrow()

  return (await find(Number(result.insertId))) as SubscriberModel
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(db)
}

export async function remove(id: number): Promise<void> {
  await db.deleteFrom('subscribers').where('id', '=', id).execute()
}

export async function whereSubscribed(value: string | number | boolean | undefined | null): Promise<SubscriberModel[]> {
  const query = db.selectFrom('subscribers').where('subscribed', '=', value)

  const results = await query.execute()

  return results.map((modelItem) => new SubscriberModel(modelItem))
}

const Subscriber = SubscriberModel

export default Subscriber
