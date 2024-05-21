import { db } from '@stacksjs/database'
import type { Result } from '@stacksjs/error-handling'
import { err, handleError, ok } from '@stacksjs/error-handling'
import type { ColumnType, Generated, Insertable, Selectable, Updateable } from 'kysely'

// import { Kysely, MysqlDialect, PostgresDialect } from 'kysely'
// import { Pool } from 'pg'

// TODO: we need an action that auto-generates these table interfaces
export interface SubscribersTable {
  id: Generated<number>
  subscribed: boolean

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
  private subscriber: Partial<SubscriberType>
  private results: Partial<SubscriberType>[]
  private hidden = ['password'] // TODO: this hidden functionality needs to be implemented still

  constructor(subscriber: Partial<SubscriberType>) {
    this.subscriber = subscriber
  }

  // Method to find a subscriber by ID
  static async find(id: number, fields?: (keyof SubscriberType)[]) {
    let query = db.selectFrom('subscribers').where('id', '=', id)

    if (fields) query = query.select(fields)
    else query = query.selectAll()

    const model = await query.executeTakeFirst()

    if (!model) return null

    return new SubscriberModel(model)
  }

  static async findMany(ids: number[], fields?: (keyof SubscriberType)[]) {
    let query = db.selectFrom('subscribers').where('id', 'in', ids)

    if (fields) query = query.select(fields)
    else query = query.selectAll()

    const model = await query.execute()

    return model.map((modelItem) => new SubscriberModel(modelItem))
  }

  // Method to get a subscriber by criteria
  static async get(criteria: Partial<SubscriberType>, options: QueryOptions = {}): Promise<SubscriberModel[]> {
    let query = db.selectFrom('subscribers')

    // Apply sorting from options
    if (options.sort) query = query.orderBy(options.sort.column, options.sort.order)

    // Apply limit and offset from options
    if (options.limit !== undefined) query = query.limit(options.limit)

    if (options.offset !== undefined) query = query.offset(options.offset)

    const model = await query.selectAll().execute()
    return model.map((modelItem) => new SubscriberModel(modelItem))
  }

  // Method to get all subscribers
  static async all(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<SubscriberResponse> {
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
      .offset((options.page! - 1) * (options.limit ?? 10))
      .execute()

    let nextCursor = null
    if (subscribersWithExtra.length > (options.limit ?? 10)) nextCursor = subscribersWithExtra.pop()?.id // Use the ID of the extra record as the next cursor

    return {
      data: subscribersWithExtra,
      paging: {
        total_records: totalRecords,
        page: options.page!,
        total_pages: totalPages,
      },
      next_cursor: nextCursor,
    }
  }

  // Method to create a new subscriber
  static async create(newSubscriber: NewSubscriber): Promise<SubscriberModel> {
    const model = await db.insertInto('subscribers').values(newSubscriber).returningAll().executeTakeFirstOrThrow()

    return new SubscriberModel(model)
  }

  // Method to update a subscriber
  static async update(id: number, subscriberUpdate: SubscriberUpdate): Promise<SubscriberModel> {
    const model = await db
      .updateTable('subscribers')
      .set(subscriberUpdate)
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow()

    return new SubscriberModel(model)
  }

  // Method to remove a subscriber
  static async remove(id: number): Promise<SubscriberModel> {
    const model = await db.deleteFrom('subscribers').where('id', '=', id).returningAll().executeTakeFirstOrThrow()

    return new SubscriberModel(model)
  }

  async where(column: string, operator, value: any) {
    let query = db.selectFrom('subscribers')

    query = query.where(column, operator, value)

    return await query.selectAll().execute()
  }

  async whereIs(criteria: Partial<SubscriberType>, options: QueryOptions = {}) {
    let query = db.selectFrom('subscribers')

    // Existing criteria checks
    if (criteria.id) query = query.where('id', '=', criteria.id) // Kysely is immutable, we must re-assign

    if (criteria.email) query = query.where('email', '=', criteria.email)

    if (criteria.name !== undefined) {
      query = query.where('name', criteria.name === null ? 'is' : '=', criteria.name)
    }

    if (criteria.password) query = query.where('password', '=', criteria.password)

    if (criteria.created_at) query = query.where('created_at', '=', criteria.created_at)

    if (criteria.updated_at) query = query.where('updated_at', '=', criteria.updated_at)

    if (criteria.deleted_at) query = query.where('deleted_at', '=', criteria.deleted_at)

    // Apply sorting from options
    if (options.sort) query = query.orderBy(options.sort.column, options.sort.order)

    // Apply pagination from options
    if (options.limit !== undefined) query = query.limit(options.limit)

    if (options.offset !== undefined) query = query.offset(options.offset)

    return await query.selectAll().execute()
  }

  async whereIn(column: keyof SubscriberType, values: any[], options: QueryOptions = {}) {
    let query = db.selectFrom('subscribers')

    query = query.where(column, 'in', values)

    // Apply sorting from options
    if (options.sort) query = query.orderBy(options.sort.column, options.sort.order)

    // Apply pagination from options
    if (options.limit !== undefined) query = query.limit(options.limit)

    if (options.offset !== undefined) query = query.offset(options.offset)

    return await query.selectAll().execute()
  }

  async first() {
    return await db.selectFrom('subscribers').selectAll().executeTakeFirst()
  }

  async last() {
    return await db.selectFrom('subscribers').selectAll().orderBy('id', 'desc').executeTakeFirst()
  }

  async orderBy(column: keyof SubscriberType, order: 'asc' | 'desc') {
    return await db.selectFrom('subscribers').selectAll().orderBy(column, order).execute()
  }

  async orderByDesc(column: keyof SubscriberType) {
    return await db.selectFrom('subscribers').selectAll().orderBy(column, 'desc').execute()
  }

  async orderByAsc(column: keyof SubscriberType) {
    return await db.selectFrom('subscribers').selectAll().orderBy(column, 'asc').execute()
  }

  // Method to get the subscriber instance itself
  self() {
    return this
  }

  // Method to get the subscriber instance data
  get() {
    return this.subscriber
  }

  // Method to update the subscriber instance
  async update(subscriber: SubscriberUpdate): Promise<Result<SubscriberType, Error>> {
    if (this.subscriber.id === undefined) return err(handleError('Subscriber ID is undefined'))

    const updatedModel = await db
      .updateTable('subscribers')
      .set(subscriber)
      .where('id', '=', this.subscriber.id)
      .returningAll()
      .executeTakeFirst()

    if (!updatedModel) return err(handleError('Subscriber not found'))

    this.subscriber = updatedModel

    return ok(updatedModel)
  }

  // Method to save (insert or update) the subscriber instance
  async save(): Promise<void> {
    if (!this.subscriber) throw new Error('Subscriber data is undefined')

    if (this.subscriber.id === undefined) {
      // Insert new subscriber
      const newModel = await db
        .insertInto('subscribers')
        .values(this.subscriber as NewSubscriber)
        .returningAll()
        .executeTakeFirstOrThrow()
      this.subscriber = newModel
    } else {
      // Update existing subscriber
      await this.update(this.subscriber)
    }
  }

  // Method to delete the subscriber instance
  async delete(): Promise<void> {
    if (this.subscriber.id === undefined) throw new Error('Subscriber ID is undefined')

    await db.deleteFrom('subscribers').where('id', '=', this.subscriber.id).execute()

    this.subscriber = {}
  }

  // Method to refresh the subscriber instance data from the database
  async refresh(): Promise<void> {
    if (this.subscriber.id === undefined) throw new Error('Subscriber ID is undefined')

    const refreshedModel = await db
      .selectFrom('subscribers')
      .where('id', '=', this.subscriber.id)
      .selectAll()
      .executeTakeFirst()

    if (!refreshedModel) throw new Error('Subscriber not found')

    this.subscriber = refreshedModel
  }

  toJSON() {
    const output: Partial<SubscriberType> = { ...this.subscriber }

    this.hidden.forEach((attr) => {
      if (attr in output) delete output[attr as keyof Partial<SubscriberType>]
    })

    type Subscriber = Omit<SubscriberType, 'password'>

    return output as Subscriber
  }
}

const Model = SubscriberModel

// starting here, ORM functions
export async function find(id: number, fields?: (keyof SubscriberType)[]) {
  let query = db.selectFrom('subscribers').where('id', '=', id)

  if (fields) query = query.select(fields)
  else query = query.selectAll()

  const model = await query.executeTakeFirst()

  if (!model) return null

  this.subscriber = model
  return new SubscriberModel(model)
}

export async function findMany(ids: number[], fields?: (keyof SubscriberType)[]) {
  let query = db.selectFrom('subscribers').where('id', 'in', ids)

  if (fields) query = query.select(fields)
  else query = query.selectAll()

  const model = await query.execute()

  return model.map((modelItem) => new SubscriberModel(modelItem))
}

export async function count() {
  const results = await db.selectFrom('subscribers').selectAll().execute()

  return results.length
}

export async function get(
  criteria: Partial<SubscriberType>,
  sort: { column: keyof SubscriberType; order: 'asc' | 'desc' } = { column: 'created_at', order: 'desc' },
) {
  let query = db.selectFrom('subscribers')

  if (criteria.id) query = query.where('id', '=', criteria.id) // Kysely is immutable, we must re-assign

  if (criteria.email) query = query.where('email', '=', criteria.email)

  if (criteria.name !== undefined) {
    query = query.where('name', criteria.name === null ? 'is' : '=', criteria.name)
  }

  if (criteria.password) query = query.where('password', '=', criteria.password)

  if (criteria.created_at) query = query.where('created_at', '=', criteria.created_at)

  if (criteria.updated_at) query = query.where('updated_at', '=', criteria.updated_at)

  if (criteria.deleted_at) query = query.where('deleted_at', '=', criteria.deleted_at)

  // Apply sorting based on the 'sort' parameter
  query = query.orderBy(sort.column, sort.order)

  return await query.selectAll().execute()
}

export async function all(limit = 10, offset = 0) {
  return await db
    .selectFrom('subscribers')
    .selectAll()
    .orderBy('created_at', 'desc')
    .limit(limit)
    .offset(offset)
    .execute()
}

export async function create(newSubscriber: NewSubscriber) {
  return await db.insertInto('subscribers').values(newSubscriber).returningAll().executeTakeFirstOrThrow()
}

export async function first() {
  return await db.selectFrom('subscribers').selectAll().executeTakeFirst()
}

export async function last() {
  return await db.selectFrom('subscribers').selectAll().orderBy('id', 'desc').executeTakeFirst()
}

export async function update(id: number, subscriberUpdate: SubscriberUpdate) {
  return await db.updateTable('subscribers').set(subscriberUpdate).where('id', '=', id).execute()
}

export async function remove(id: number) {
  return await db.deleteFrom('subscribers').where('id', '=', id).returningAll().executeTakeFirst()
}

export async function where(column: string, operator, value: any) {
  let query = db.selectFrom('subscribers')

  query = query.where(column, operator, value)

  return await query.selectAll().execute()
}

export async function whereIs(criteria: Partial<SubscriberType>, options: QueryOptions = {}) {
  let query = db.selectFrom('subscribers')

  // Apply criteria
  if (criteria.id) query = query.where('id', '=', criteria.id)

  if (criteria.email) query = query.where('email', '=', criteria.email)

  if (criteria.name !== undefined) {
    query = query.where('name', criteria.name === null ? 'is' : '=', criteria.name)
  }

  if (criteria.password) query = query.where('password', '=', criteria.password)

  if (criteria.created_at) query = query.where('created_at', '=', criteria.created_at)

  if (criteria.updated_at) query = query.where('updated_at', '=', criteria.updated_at)

  if (criteria.deleted_at) query = query.where('deleted_at', '=', criteria.deleted_at)

  // Apply sorting from options
  if (options.sort) query = query.orderBy(options.sort.column, options.sort.order)

  // Apply pagination from options
  if (options.limit !== undefined) query = query.limit(options.limit)

  if (options.offset !== undefined) query = query.offset(options.offset)

  return await query.selectAll().execute()
}

export async function whereIn(column: keyof SubscriberType, values: any[], options: QueryOptions = {}) {
  let query = db.selectFrom('subscribers')

  query = query.where(column, 'in', values)

  // Apply sorting from options
  if (options.sort) query = query.orderBy(options.sort.column, options.sort.order)

  // Apply pagination from options
  if (options.limit !== undefined) query = query.limit(options.limit)

  if (options.offset !== undefined) query = query.offset(options.offset)

  return await query.selectAll().execute()
}

export const Subscriber = {
  find,
  findMany,
  get,
  count,
  all,
  create,
  update,
  remove,
  Model,
  first,
  last,
  where,
  whereIn,
  model: SubscriberModel,
}

export default Subscriber
