import type { Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import { cache } from '@stacksjs/cache'
import { db, sql } from '@stacksjs/database'
import { HttpError, ModelNotFoundException } from '@stacksjs/error-handling'
import { SubqueryBuilder } from '@stacksjs/orm'

export interface SubscribersTable {
  id?: number
  subscribed?: boolean

  created_at?: Date

  updated_at?: Date

}

interface SubscriberResponse {
  data: SubscriberJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface SubscriberJsonResponse extends Omit<SubscribersTable, 'password'> {
  [key: string]: any
}

export type SubscriberType = Selectable<SubscribersTable>
export type NewSubscriber = Partial<Insertable<SubscribersTable>>
export type SubscriberUpdate = Updateable<SubscribersTable>

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
  private readonly hidden: Array<keyof SubscriberJsonResponse> = []
  private readonly fillable: Array<keyof SubscriberJsonResponse> = ['subscribed', 'uuid', 'user_id']

  protected selectFromQuery: any
  protected withRelations: string[]
  protected updateFromQuery: any
  protected deleteFromQuery: any
  protected hasSelect: boolean
  private customColumns: Record<string, unknown> = {}
  public id: number | undefined
  public subscribed: boolean | undefined

  public created_at: Date | undefined
  public updated_at: Date | undefined

  constructor(subscriber: Partial<SubscriberType> | null) {
    if (subscriber) {
      this.id = subscriber?.id || 1
      this.subscribed = subscriber?.subscribed

      this.created_at = subscriber?.created_at

      this.updated_at = subscriber?.updated_at

      Object.keys(subscriber).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (subscriber as SubscriberJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = db.selectFrom('subscribers')
    this.updateFromQuery = db.updateTable('subscribers')
    this.deleteFromQuery = db.deleteFrom('subscribers')
    this.hasSelect = false
  }

  select(params: (keyof SubscriberType)[] | RawBuilder<string> | string): SubscriberModel {
    this.selectFromQuery = this.selectFromQuery.select(params)

    this.hasSelect = true

    return this
  }

  static select(params: (keyof SubscriberType)[] | RawBuilder<string> | string): SubscriberModel {
    const instance = new SubscriberModel(null)

    // Initialize a query with the table name and selected fields
    instance.selectFromQuery = instance.selectFromQuery.select(params)

    instance.hasSelect = true

    return instance
  }

  async find(id: number): Promise<SubscriberModel | undefined> {
    return SubscriberModel.find(id)
  }

  // Method to find a Subscriber by ID
  static async find(id: number): Promise<SubscriberModel | undefined> {
    const model = await db.selectFrom('subscribers').where('id', '=', id).selectAll().executeTakeFirst()

    if (!model)
      return undefined

    const instance = new SubscriberModel(null)

    const result = await instance.mapWith(model)

    const data = new SubscriberModel(result as SubscriberType)

    cache.getOrSet(`subscriber:${id}`, JSON.stringify(model))

    return data
  }

  async first(): Promise<SubscriberModel | undefined> {
    return SubscriberModel.first()
  }

  static async first(): Promise<SubscriberType | undefined> {
    const model = await db.selectFrom('subscribers')
      .selectAll()
      .executeTakeFirst()

    if (!model)
      return undefined

    const instance = new SubscriberModel(null)

    const result = await instance.mapWith(model)

    const data = new SubscriberModel(result as SubscriberType)

    return data
  }

  async firstOrFail(): Promise<SubscriberModel | undefined> {
    return this.firstOrFail()
  }

  static async firstOrFail(): Promise<SubscriberModel | undefined> {
    const instance = new SubscriberModel(null)

    const model = await instance.selectFromQuery.executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, 'No SubscriberModel results found for query')

    const result = await instance.mapWith(model)

    const data = new SubscriberModel(result as SubscriberType)

    return data
  }

  async mapWith(model: SubscriberType): Promise<SubscriberType> {
    return model
  }

  static async all(): Promise<SubscriberModel[]> {
    const models = await db.selectFrom('subscribers').selectAll().execute()

    const data = await Promise.all(models.map(async (model: SubscriberType) => {
      const instance = new SubscriberModel(model)

      const results = await instance.mapWith(model)

      return new SubscriberModel(results)
    }))

    return data
  }

  async findOrFail(id: number): Promise<SubscriberModel> {
    return SubscriberModel.findOrFail(id)
  }

  static async findOrFail(id: number): Promise<SubscriberModel> {
    const model = await db.selectFrom('subscribers').where('id', '=', id).selectAll().executeTakeFirst()

    const instance = new SubscriberModel(null)

    if (model === undefined)
      throw new ModelNotFoundException(404, `No SubscriberModel results for ${id}`)

    cache.getOrSet(`subscriber:${id}`, JSON.stringify(model))

    const result = await instance.mapWith(model)

    const data = new SubscriberModel(result as SubscriberType)

    return data
  }

  static async findMany(ids: number[]): Promise<SubscriberModel[]> {
    let query = db.selectFrom('subscribers').where('id', 'in', ids)

    const instance = new SubscriberModel(null)

    query = query.selectAll()

    const model = await query.execute()

    return model.map(modelItem => instance.parseResult(new SubscriberModel(modelItem)))
  }

  skip(count: number): SubscriberModel {
    return SubscriberModel.skip(count)
  }

  static skip(count: number): SubscriberModel {
    const instance = new SubscriberModel(null)

    instance.selectFromQuery = instance.selectFromQuery.offset(count)

    return instance
  }

  take(count: number): SubscriberModel {
    return SubscriberModel.take(count)
  }

  static take(count: number): SubscriberModel {
    const instance = new SubscriberModel(null)

    instance.selectFromQuery = instance.selectFromQuery.limit(count)

    return instance
  }

  static async pluck<K extends keyof SubscriberModel>(field: K): Promise<SubscriberModel[K][]> {
    const instance = new SubscriberModel(null)

    if (instance.hasSelect) {
      const model = await instance.selectFromQuery.execute()
      return model.map((modelItem: SubscriberModel) => modelItem[field])
    }

    const model = await instance.selectFromQuery.selectAll().execute()

    return model.map((modelItem: SubscriberModel) => modelItem[field])
  }

  async pluck<K extends keyof SubscriberModel>(field: K): Promise<SubscriberModel[K][]> {
    return SubscriberModel.pluck(field)
  }

  static async count(): Promise<number> {
    const instance = new SubscriberModel(null)

    return instance.selectFromQuery
      .select(sql`COUNT(*) as count`)
      .executeTakeFirst()
  }

  async count(): Promise<number> {
    return SubscriberModel.count()
  }

  async max(field: keyof SubscriberModel): Promise<number> {
    return await this.selectFromQuery
      .select(sql`MAX(${sql.raw(field as string)}) `)
      .executeTakeFirst()
  }

  async min(field: keyof SubscriberModel): Promise<number> {
    return await this.selectFromQuery
      .select(sql`MIN(${sql.raw(field as string)}) `)
      .executeTakeFirst()
  }

  async avg(field: keyof SubscriberModel): Promise<number> {
    return this.selectFromQuery
      .select(sql`AVG(${sql.raw(field as string)})`)
      .executeTakeFirst()
  }

  async sum(field: keyof SubscriberModel): Promise<number> {
    return this.selectFromQuery
      .select(sql`SUM(${sql.raw(field as string)})`)
      .executeTakeFirst()
  }

  async get(): Promise<SubscriberModel[]> {
    return SubscriberModel.get()
  }

  static async get(): Promise<SubscriberModel[]> {
    const instance = new SubscriberModel(null)

    let models

    if (instance.hasSelect) {
      models = await instance.selectFromQuery.execute()
    }
    else {
      models = await instance.selectFromQuery.selectAll().execute()
    }

    const data = await Promise.all(models.map(async (model: SubscriberModel) => {
      const instance = new SubscriberModel(model)

      const results = await instance.mapWith(model)

      return new SubscriberModel(results)
    }))

    return data
  }

  has(relation: string): SubscriberModel {
    return SubscriberModel.has(relation)
  }

  static has(relation: string): SubscriberModel {
    const instance = new SubscriberModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(
        selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.subscriber_id`, '=', 'subscribers.id'),
      ),
    )

    return instance
  }

  whereHas(
    relation: string,
    callback: (query: SubqueryBuilder) => void,
  ): SubscriberModel {
    return SubscriberModel.whereHas(relation, callback)
  }

  static whereHas(
    relation: string,
    callback: (query: SubqueryBuilder) => void,
  ): SubscriberModel {
    const instance = new SubscriberModel(null)
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    instance.selectFromQuery = instance.selectFromQuery
      .where(({ exists, selectFrom }: any) => {
        let subquery = selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.subscriber_id`, '=', 'subscribers.id')

        conditions.forEach((condition) => {
          switch (condition.method) {
            case 'where':
              if (condition.type === 'and') {
                subquery = subquery.where(condition.column, condition.operator!, condition.value)
              }
              else {
                subquery = subquery.orWhere(condition.column, condition.operator!, condition.value)
              }
              break

            case 'whereIn':
              if (condition.operator === 'not') {
                subquery = subquery.whereNotIn(condition.column, condition.values!)
              }
              else {
                subquery = subquery.whereIn(condition.column, condition.values!)
              }

              break

            case 'whereNull':
              subquery = subquery.whereNull(condition.column)
              break

            case 'whereNotNull':
              subquery = subquery.whereNotNull(condition.column)
              break

            case 'whereBetween':
              subquery = subquery.whereBetween(condition.column, condition.values!)
              break

            case 'whereExists': {
              const nestedBuilder = new SubqueryBuilder()
              condition.callback!(nestedBuilder)
              break
            }
          }
        })

        return exists(subquery)
      })

    return instance
  }

  doesntHave(relation: string): SubscriberModel {
    return SubscriberModel.doesntHave(relation)
  }

  static doesntHave(relation: string): SubscriberModel {
    const instance = new SubscriberModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(({ not, exists, selectFrom }: any) =>
      not(
        exists(
          selectFrom(relation)
            .select('1')
            .whereRef(`${relation}.subscriber_id`, '=', 'subscribers.id'),
        ),
      ),
    )

    return instance
  }

  whereDoesntHave(relation: string): SubscriberModel {
    return SubscriberModel.whereDoesntHave(relation)
  }

  static whereDoesntHave(
    relation: string,
    callback: (query: SubqueryBuilder) => void,
  ): SubscriberModel {
    const instance = new SubscriberModel(null)
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    instance.selectFromQuery = instance.selectFromQuery
      .where(({ exists, selectFrom, not }: any) => {
        let subquery = selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.subscriber_id`, '=', 'subscribers.id')

        conditions.forEach((condition) => {
          switch (condition.method) {
            case 'where':
              if (condition.type === 'and') {
                subquery = subquery.where(condition.column, condition.operator!, condition.value)
              }
              else {
                subquery = subquery.orWhere(condition.column, condition.operator!, condition.value)
              }
              break

            case 'whereIn':
              if (condition.operator === 'not') {
                subquery = subquery.whereNotIn(condition.column, condition.values!)
              }
              else {
                subquery = subquery.whereIn(condition.column, condition.values!)
              }

              break

            case 'whereNull':
              subquery = subquery.whereNull(condition.column)
              break

            case 'whereNotNull':
              subquery = subquery.whereNotNull(condition.column)
              break

            case 'whereBetween':
              subquery = subquery.whereBetween(condition.column, condition.values!)
              break

            case 'whereExists': {
              const nestedBuilder = new SubqueryBuilder()
              condition.callback!(nestedBuilder)
              break
            }
          }
        })

        return not(exists(subquery))
      })

    return instance
  }

  async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<SubscriberResponse> {
    return SubscriberModel.paginate(options)
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

    const model = await find(Number(result.numInsertedOrUpdatedRows)) as SubscriberModel

    return model
  }

  static async createMany(newSubscribers: NewSubscriber[]): Promise<void> {
    const instance = new SubscriberModel(null)

    const filteredValues = newSubscribers.map(newUser =>
      Object.fromEntries(
        Object.entries(newUser).filter(([key]) => instance.fillable.includes(key)),
      ) as NewSubscriber,
    )

    await db.insertInto('subscribers')
      .values(filteredValues)
      .executeTakeFirst()
  }

  static async forceCreate(newSubscriber: NewSubscriber): Promise<SubscriberModel> {
    const result = await db.insertInto('subscribers')
      .values(newSubscriber)
      .executeTakeFirst()

    const model = await find(Number(result.numInsertedOrUpdatedRows)) as SubscriberModel

    return model
  }

  // Method to remove a Subscriber
  static async remove(id: number): Promise<any> {
    return await db.deleteFrom('subscribers')
      .where('id', '=', id)
      .execute()
  }

  private static applyWhere(instance: SubscriberModel, column: string, operator: string, value: any): SubscriberModel {
    instance.selectFromQuery = instance.selectFromQuery.where(column, operator, value)
    instance.updateFromQuery = instance.updateFromQuery.where(column, operator, value)
    instance.deleteFromQuery = instance.deleteFromQuery.where(column, operator, value)

    return instance
  }

  where(column: string, operator: string, value: any): SubscriberModel {
    return SubscriberModel.applyWhere(this, column, operator, value)
  }

  static where(column: string, operator: string, value: any): SubscriberModel {
    const instance = new SubscriberModel(null)

    return SubscriberModel.applyWhere(instance, column, operator, value)
  }

  whereRef(column: string, operator: string, value: string): SubscriberModel {
    return SubscriberModel.whereRef(column, operator, value)
  }

  static whereRef(column: string, operator: string, value: string): SubscriberModel {
    const instance = new SubscriberModel(null)

    instance.selectFromQuery = instance.selectFromQuery.whereRef(column, operator, value)

    return instance
  }

  orWhere(...args: Array<[string, string, any]>): SubscriberModel {
    return SubscriberModel.orWhere(...args)
  }

  static orWhere(...args: Array<[string, string, any]>): SubscriberModel {
    const instance = new SubscriberModel(null)

    if (args.length === 0) {
      throw new HttpError(500, 'At least one condition must be provided')
    }

    // Use the expression builder to append the OR conditions
    instance.selectFromQuery = instance.selectFromQuery.where((eb: any) =>
      eb.or(
        args.map(([column, operator, value]) => eb(column, operator, value)),
      ),
    )

    instance.updateFromQuery = instance.updateFromQuery.where((eb: any) =>
      eb.or(
        args.map(([column, operator, value]) => eb(column, operator, value)),
      ),
    )

    instance.deleteFromQuery = instance.deleteFromQuery.where((eb: any) =>
      eb.or(
        args.map(([column, operator, value]) => eb(column, operator, value)),
      ),
    )

    return instance
  }

  when(
    condition: boolean,
    callback: (query: SubscriberModel) => SubscriberModel,
  ): SubscriberModel {
    return SubscriberModel.when(condition, callback)
  }

  static when(
    condition: boolean,
    callback: (query: SubscriberModel) => SubscriberModel,
  ): SubscriberModel {
    let instance = new SubscriberModel(null)

    if (condition)
      instance = callback(instance)

    return instance
  }

  whereNull(column: string): SubscriberModel {
    return SubscriberModel.whereNull(column)
  }

  static whereNull(column: string): SubscriberModel {
    const instance = new SubscriberModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    instance.updateFromQuery = instance.updateFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    return instance
  }

  static whereSubscribed(value: string): SubscriberModel {
    const instance = new SubscriberModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('subscribed', '=', value)

    return instance
  }

  whereIn(column: keyof SubscriberType, values: any[]): SubscriberModel {
    return SubscriberModel.whereIn(column, values)
  }

  static whereIn(column: keyof SubscriberType, values: any[]): SubscriberModel {
    const instance = new SubscriberModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(column, 'in', values)

    instance.updateFromQuery = instance.updateFromQuery.where(column, 'in', values)

    instance.deleteFromQuery = instance.deleteFromQuery.where(column, 'in', values)

    return instance
  }

  whereBetween(column: keyof SubscriberType, range: [any, any]): SubscriberModel {
    return SubscriberModel.whereBetween(column, range)
  }

  static whereBetween(column: keyof SubscriberType, range: [any, any]): SubscriberModel {
    if (range.length !== 2) {
      throw new HttpError(500, 'Range must have exactly two values: [min, max]')
    }

    const instance = new SubscriberModel(null)

    const query = sql` ${sql.raw(column as string)} between ${range[0]} and ${range[1]} `

    instance.selectFromQuery = instance.selectFromQuery.where(query)
    instance.updateFromQuery = instance.updateFromQuery.where(query)
    instance.deleteFromQuery = instance.deleteFromQuery.where(query)

    return instance
  }

  whereNotIn(column: keyof SubscriberType, values: any[]): SubscriberModel {
    return SubscriberModel.whereNotIn(column, values)
  }

  static whereNotIn(column: keyof SubscriberType, values: any[]): SubscriberModel {
    const instance = new SubscriberModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(column, 'not in', values)

    instance.updateFromQuery = instance.updateFromQuery.where(column, 'not in', values)

    instance.deleteFromQuery = instance.deleteFromQuery.where(column, 'not in', values)

    return instance
  }

  async exists(): Promise<boolean> {
    const model = await this.selectFromQuery.executeTakeFirst()

    return model !== null || model !== undefined
  }

  static async latest(): Promise<SubscriberType | undefined> {
    const model = await db.selectFrom('subscribers')
      .selectAll()
      .orderBy('created_at', 'desc')
      .executeTakeFirst()

    if (!model)
      return undefined

    const instance = new SubscriberModel(null)
    const result = await instance.mapWith(model)
    const data = new SubscriberModel(result as SubscriberType)

    return data
  }

  static async oldest(): Promise<SubscriberType | undefined> {
    const model = await db.selectFrom('subscribers')
      .selectAll()
      .orderBy('created_at', 'asc')
      .executeTakeFirst()

    if (!model)
      return undefined

    const instance = new SubscriberModel(null)
    const result = await instance.mapWith(model)
    const data = new SubscriberModel(result as SubscriberType)

    return data
  }

  static async firstOrCreate(
    condition: Partial<SubscriberType>,
    newSubscriber: NewSubscriber,
  ): Promise<SubscriberModel> {
    // Get the key and value from the condition object
    const key = Object.keys(condition)[0] as keyof SubscriberType

    if (!key) {
      throw new HttpError(500, 'Condition must contain at least one key-value pair')
    }

    const value = condition[key]

    // Attempt to find the first record matching the condition
    const existingSubscriber = await db.selectFrom('subscribers')
      .selectAll()
      .where(key, '=', value)
      .executeTakeFirst()

    if (existingSubscriber) {
      const instance = new SubscriberModel(null)
      const result = await instance.mapWith(existingSubscriber)
      return new SubscriberModel(result as SubscriberType)
    }
    else {
      // If not found, create a new user
      return await this.create(newSubscriber)
    }
  }

  static async updateOrCreate(
    condition: Partial<SubscriberType>,
    newSubscriber: NewSubscriber,
  ): Promise<SubscriberModel> {
    const key = Object.keys(condition)[0] as keyof SubscriberType

    if (!key) {
      throw new HttpError(500, 'Condition must contain at least one key-value pair')
    }

    const value = condition[key]

    // Attempt to find the first record matching the condition
    const existingSubscriber = await db.selectFrom('subscribers')
      .selectAll()
      .where(key, '=', value)
      .executeTakeFirst()

    if (existingSubscriber) {
      // If found, update the existing record
      await db.updateTable('subscribers')
        .set(newSubscriber)
        .where(key, '=', value)
        .executeTakeFirstOrThrow()

      // Fetch and return the updated record
      const updatedSubscriber = await db.selectFrom('subscribers')
        .selectAll()
        .where(key, '=', value)
        .executeTakeFirst()

      if (!updatedSubscriber) {
        throw new HttpError(500, 'Failed to fetch updated record')
      }

      const instance = new SubscriberModel(null)
      const result = await instance.mapWith(updatedSubscriber)
      return new SubscriberModel(result as SubscriberType)
    }
    else {
      // If not found, create a new record
      return await this.create(newSubscriber)
    }
  }

  with(relations: string[]): SubscriberModel {
    return SubscriberModel.with(relations)
  }

  static with(relations: string[]): SubscriberModel {
    const instance = new SubscriberModel(null)

    instance.withRelations = relations

    return instance
  }

  async last(): Promise<SubscriberType | undefined> {
    return await db.selectFrom('subscribers')
      .selectAll()
      .orderBy('id', 'desc')
      .executeTakeFirst()
  }

  static async last(): Promise<SubscriberType | undefined> {
    const model = await db.selectFrom('subscribers').selectAll().orderBy('id', 'desc').executeTakeFirst()

    if (!model)
      return undefined

    const instance = new SubscriberModel(null)

    const result = await instance.mapWith(model)

    const data = new SubscriberModel(result as SubscriberType)

    return data
  }

  orderBy(column: keyof SubscriberType, order: 'asc' | 'desc'): SubscriberModel {
    return SubscriberModel.orderBy(column, order)
  }

  static orderBy(column: keyof SubscriberType, order: 'asc' | 'desc'): SubscriberModel {
    const instance = new SubscriberModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, order)

    return instance
  }

  groupBy(column: keyof SubscriberType): SubscriberModel {
    return SubscriberModel.groupBy(column)
  }

  static groupBy(column: keyof SubscriberType): SubscriberModel {
    const instance = new SubscriberModel(null)

    instance.selectFromQuery = instance.selectFromQuery.groupBy(column)

    return instance
  }

  having(column: keyof SubscriberType, operator: string, value: any): SubscriberModel {
    return SubscriberModel.having(column, operator)
  }

  static having(column: keyof SubscriberType, operator: string, value: any): SubscriberModel {
    const instance = new SubscriberModel(null)

    instance.selectFromQuery = instance.selectFromQuery.having(column, operator, value)

    return instance
  }

  inRandomOrder(): SubscriberModel {
    return SubscriberModel.inRandomOrder()
  }

  static inRandomOrder(): SubscriberModel {
    const instance = new SubscriberModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(sql` ${sql.raw('RANDOM()')} `)

    return instance
  }

  orderByDesc(column: keyof SubscriberType): SubscriberModel {
    return SubscriberModel.orderByDesc(column)
  }

  static orderByDesc(column: keyof SubscriberType): SubscriberModel {
    const instance = new SubscriberModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'desc')

    return instance
  }

  orderByAsc(column: keyof SubscriberType): SubscriberModel {
    return SubscriberModel.orderByAsc(column)
  }

  static orderByAsc(column: keyof SubscriberType): SubscriberModel {
    const instance = new SubscriberModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'asc')

    return instance
  }

  async update(subscriber: SubscriberUpdate): Promise<SubscriberModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(subscriber).filter(([key]) => this.fillable.includes(key)),
    ) as NewSubscriber

    await db.updateTable('subscribers')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      const model = await this.find(this.id)

      return model
    }

    return undefined
  }

  async forceUpdate(subscriber: SubscriberUpdate): Promise<SubscriberModel | undefined> {
    if (this.id === undefined) {
      this.updateFromQuery.set(subscriber).execute()
    }

    await db.updateTable('subscribers')
      .set(subscriber)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      const model = await this.find(this.id)

      return model
    }

    return undefined
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
  async delete(): Promise<any> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()

    return await db.deleteFrom('subscribers')
      .where('id', '=', this.id)
      .execute()
  }

  distinct(column: keyof SubscriberType): SubscriberModel {
    return SubscriberModel.distinct(column)
  }

  static distinct(column: keyof SubscriberType): SubscriberModel {
    const instance = new SubscriberModel(null)

    instance.selectFromQuery = instance.selectFromQuery.select(column).distinct()

    instance.hasSelect = true

    return instance
  }

  join(table: string, firstCol: string, secondCol: string): SubscriberModel {
    return SubscriberModel.join(table, firstCol, secondCol)
  }

  static join(table: string, firstCol: string, secondCol: string): SubscriberModel {
    const instance = new SubscriberModel(null)

    instance.selectFromQuery = instance.selectFromQuery.innerJoin(table, firstCol, secondCol)

    return instance
  }

  static async rawQuery(rawQuery: string): Promise<any> {
    return await sql`${rawQuery}`.execute(db)
  }

  toJSON(): Partial<SubscriberJsonResponse> {
    const output: Partial<SubscriberJsonResponse> = {

      id: this.id,
      subscribed: this.subscribed,

      created_at: this.created_at,

      updated_at: this.updated_at,

      ...this.customColumns,
    }

    return output
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

  return await find(Number(result.numInsertedOrUpdatedRows)) as SubscriberModel
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
