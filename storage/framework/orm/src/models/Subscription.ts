import type { Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { UserModel } from './User'
import { randomUUIDv7 } from 'bun'
import { cache } from '@stacksjs/cache'
import { sql } from '@stacksjs/database'
import { HttpError, ModelNotFoundException } from '@stacksjs/error-handling'
import { dispatch } from '@stacksjs/events'
import { DB, SubqueryBuilder } from '@stacksjs/orm'

import User from './User'

export interface SubscriptionsTable {
  id?: number
  user_id?: number
  user?: UserModel
  type?: string
  provider_id?: string
  provider_status?: string
  unit_price?: number
  provider_type?: string
  provider_price_id?: string
  quantity?: number
  trial_ends_at?: string
  ends_at?: string
  last_used_at?: string
  uuid?: string

  created_at?: Date

  updated_at?: Date

}

interface SubscriptionResponse {
  data: SubscriptionJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface SubscriptionJsonResponse extends Omit<SubscriptionsTable, 'password'> {
  [key: string]: any
}

export type SubscriptionType = Selectable<SubscriptionsTable>
export type NewSubscription = Partial<Insertable<SubscriptionsTable>>
export type SubscriptionUpdate = Updateable<SubscriptionsTable>

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
  private readonly hidden: Array<keyof SubscriptionJsonResponse> = []
  private readonly fillable: Array<keyof SubscriptionJsonResponse> = ['type', 'provider_id', 'provider_status', 'unit_price', 'provider_type', 'provider_price_id', 'quantity', 'trial_ends_at', 'ends_at', 'last_used_at', 'uuid', 'user_id']
  private readonly guarded: Array<keyof SubscriptionJsonResponse> = []
  protected attributes: Partial<SubscriptionJsonResponse> = {}
  protected originalAttributes: Partial<SubscriptionJsonResponse> = {}

  protected selectFromQuery: any
  protected withRelations: string[]
  protected updateFromQuery: any
  protected deleteFromQuery: any
  protected hasSelect: boolean
  private hasSaved: boolean
  private customColumns: Record<string, unknown> = {}

  constructor(subscription: Partial<SubscriptionType> | null) {
    if (subscription) {
      this.attributes = { ...subscription }
      this.originalAttributes = { ...subscription }

      Object.keys(subscription).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (subscription as SubscriptionJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = DB.instance.selectFrom('subscriptions')
    this.updateFromQuery = DB.instance.updateTable('subscriptions')
    this.deleteFromQuery = DB.instance.deleteFrom('subscriptions')
    this.hasSelect = false
    this.hasSaved = false
  }

  mapCustomGetters(models: SubscriptionJsonResponse | SubscriptionJsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: SubscriptionJsonResponse) => {
        const customGetter = {
          default: () => {
          },

        }

        for (const [key, fn] of Object.entries(customGetter)) {
          model[key] = fn()
        }

        return model
      })
    }
    else {
      const model = data

      const customGetter = {
        default: () => {
        },

      }

      for (const [key, fn] of Object.entries(customGetter)) {
        model[key] = fn()
      }
    }
  }

  async mapCustomSetters(model: SubscriptionJsonResponse): Promise<void> {
    const customSetter = {
      default: () => {
      },

    }

    for (const [key, fn] of Object.entries(customSetter)) {
      model[key] = await fn()
    }
  }

  get user_id(): number | undefined {
    return this.attributes.user_id
  }

  get user(): UserModel | undefined {
    return this.attributes.user
  }

  get id(): number | undefined {
    return this.attributes.id
  }

  get uuid(): string | undefined {
    return this.attributes.uuid
  }

  get type(): string | undefined {
    return this.attributes.type
  }

  get provider_id(): string | undefined {
    return this.attributes.provider_id
  }

  get provider_status(): string | undefined {
    return this.attributes.provider_status
  }

  get unit_price(): number | undefined {
    return this.attributes.unit_price
  }

  get provider_type(): string | undefined {
    return this.attributes.provider_type
  }

  get provider_price_id(): string | undefined {
    return this.attributes.provider_price_id
  }

  get quantity(): number | undefined {
    return this.attributes.quantity
  }

  get trial_ends_at(): string | undefined {
    return this.attributes.trial_ends_at
  }

  get ends_at(): string | undefined {
    return this.attributes.ends_at
  }

  get last_used_at(): string | undefined {
    return this.attributes.last_used_at
  }

  get created_at(): Date | undefined {
    return this.attributes.created_at
  }

  get updated_at(): Date | undefined {
    return this.attributes.updated_at
  }

  set uuid(value: string) {
    this.attributes.uuid = value
  }

  set type(value: string) {
    this.attributes.type = value
  }

  set provider_id(value: string) {
    this.attributes.provider_id = value
  }

  set provider_status(value: string) {
    this.attributes.provider_status = value
  }

  set unit_price(value: number) {
    this.attributes.unit_price = value
  }

  set provider_type(value: string) {
    this.attributes.provider_type = value
  }

  set provider_price_id(value: string) {
    this.attributes.provider_price_id = value
  }

  set quantity(value: number) {
    this.attributes.quantity = value
  }

  set trial_ends_at(value: string) {
    this.attributes.trial_ends_at = value
  }

  set ends_at(value: string) {
    this.attributes.ends_at = value
  }

  set last_used_at(value: string) {
    this.attributes.last_used_at = value
  }

  set updated_at(value: Date) {
    this.attributes.updated_at = value
  }

  getOriginal(column?: keyof SubscriptionJsonResponse): Partial<SubscriptionJsonResponse> {
    if (column) {
      return this.originalAttributes[column]
    }

    return this.originalAttributes
  }

  getChanges(): Partial<SubscriptionJsonResponse> {
    return this.fillable.reduce<Partial<SubscriptionJsonResponse>>((changes, key) => {
      const currentValue = this.attributes[key as keyof SubscriptionsTable]
      const originalValue = this.originalAttributes[key as keyof SubscriptionsTable]

      if (currentValue !== originalValue) {
        changes[key] = currentValue
      }

      return changes
    }, {})
  }

  isDirty(column?: keyof SubscriptionType): boolean {
    if (column) {
      return this.attributes[column] !== this.originalAttributes[column]
    }

    return Object.entries(this.originalAttributes).some(([key, originalValue]) => {
      const currentValue = (this.attributes as any)[key]

      return currentValue !== originalValue
    })
  }

  isClean(column?: keyof SubscriptionType): boolean {
    return !this.isDirty(column)
  }

  wasChanged(column?: keyof SubscriptionType): boolean {
    return this.hasSaved && this.isDirty(column)
  }

  select(params: (keyof SubscriptionType)[] | RawBuilder<string> | string): SubscriptionModel {
    this.selectFromQuery = this.selectFromQuery.select(params)

    this.hasSelect = true

    return this
  }

  static select(params: (keyof SubscriptionType)[] | RawBuilder<string> | string): SubscriptionModel {
    const instance = new SubscriptionModel(null)

    // Initialize a query with the table name and selected fields
    instance.selectFromQuery = instance.selectFromQuery.select(params)

    instance.hasSelect = true

    return instance
  }

  async applyFind(id: number): Promise<SubscriptionModel | undefined> {
    const model = await DB.instance.selectFrom('subscriptions').where('id', '=', id).selectAll().executeTakeFirst()

    if (!model)
      return undefined

    this.mapCustomGetters(model)
    await this.loadRelations(model)

    const data = new SubscriptionModel(model as SubscriptionType)

    cache.getOrSet(`subscription:${id}`, JSON.stringify(model))

    return data
  }

  async find(id: number): Promise<SubscriptionModel | undefined> {
    return await this.applyFind(id)
  }

  // Method to find a Subscription by ID
  static async find(id: number): Promise<SubscriptionModel | undefined> {
    const instance = new SubscriptionModel(null)

    return await instance.applyFind(id)
  }

  async first(): Promise<SubscriptionModel | undefined> {
    let model: SubscriptionModel | undefined

    if (this.hasSelect) {
      model = await this.selectFromQuery.executeTakeFirst()
    }
    else {
      model = await this.selectFromQuery.selectAll().executeTakeFirst()
    }

    if (model) {
      this.mapCustomGetters(model)
      await this.loadRelations(model)
    }

    const data = new SubscriptionModel(model as SubscriptionType)

    return data
  }

  static async first(): Promise<SubscriptionModel | undefined> {
    const instance = new SubscriptionModel(null)

    const model = await DB.instance.selectFrom('subscriptions')
      .selectAll()
      .executeTakeFirst()

    instance.mapCustomGetters(model)

    const data = new SubscriptionModel(model as SubscriptionType)

    return data
  }

  async applyFirstOrFail(): Promise<SubscriptionModel | undefined> {
    const model = await this.selectFromQuery.executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, 'No SubscriptionModel results found for query')

    if (model) {
      this.mapCustomGetters(model)
      await this.loadRelations(model)
    }

    const data = new SubscriptionModel(model as SubscriptionType)

    return data
  }

  async firstOrFail(): Promise<SubscriptionModel | undefined> {
    return await this.applyFirstOrFail()
  }

  static async firstOrFail(): Promise<SubscriptionModel | undefined> {
    const instance = new SubscriptionModel(null)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<SubscriptionModel[]> {
    const instance = new SubscriptionModel(null)

    const models = await DB.instance.selectFrom('subscriptions').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: SubscriptionType) => {
      return new SubscriptionModel(model)
    }))

    return data
  }

  async applyFindOrFail(id: number): Promise<SubscriptionModel> {
    const model = await DB.instance.selectFrom('subscriptions').where('id', '=', id).selectAll().executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, `No SubscriptionModel results for ${id}`)

    cache.getOrSet(`subscription:${id}`, JSON.stringify(model))

    this.mapCustomGetters(model)
    await this.loadRelations(model)

    const data = new SubscriptionModel(model as SubscriptionType)

    return data
  }

  async findOrFail(id: number): Promise<SubscriptionModel> {
    return await this.applyFindOrFail(id)
  }

  static async findOrFail(id: number): Promise<SubscriptionModel> {
    const instance = new SubscriptionModel(null)

    return await instance.applyFindOrFail(id)
  }

  async applyFindMany(ids: number[]): Promise<SubscriptionModel[]> {
    let query = DB.instance.selectFrom('subscriptions').where('id', 'in', ids)

    const instance = new SubscriptionModel(null)

    query = query.selectAll()

    const models = await query.execute()

    instance.mapCustomGetters(models)
    await instance.loadRelations(models)

    return models.map((modelItem: SubscriptionModel) => instance.parseResult(new SubscriptionModel(modelItem)))
  }

  static async findMany(ids: number[]): Promise<SubscriptionModel[]> {
    const instance = new SubscriptionModel(null)

    return await instance.applyFindMany(ids)
  }

  async findMany(ids: number[]): Promise<SubscriptionModel[]> {
    return await this.applyFindMany(ids)
  }

  skip(count: number): SubscriptionModel {
    this.selectFromQuery = this.selectFromQuery.offset(count)

    return this
  }

  static skip(count: number): SubscriptionModel {
    const instance = new SubscriptionModel(null)

    instance.selectFromQuery = instance.selectFromQuery.offset(count)

    return instance
  }

  async applyChunk(size: number, callback: (models: SubscriptionModel[]) => Promise<void>): Promise<void> {
    let page = 1
    let hasMore = true

    while (hasMore) {
      // Get one batch
      const models = await this.selectFromQuery
        .selectAll()
        .limit(size)
        .offset((page - 1) * size)
        .execute()

      // If we got fewer results than chunk size, this is the last batch
      if (models.length < size) {
        hasMore = false
      }

      // Process this batch
      if (models.length > 0) {
        await callback(models)
      }

      page++
    }
  }

  async chunk(size: number, callback: (models: SubscriptionModel[]) => Promise<void>): Promise<void> {
    await this.applyChunk(size, callback)
  }

  static async chunk(size: number, callback: (models: SubscriptionModel[]) => Promise<void>): Promise<void> {
    const instance = new SubscriptionModel(null)

    await instance.applyChunk(size, callback)
  }

  take(count: number): SubscriptionModel {
    this.selectFromQuery = this.selectFromQuery.limit(count)

    return this
  }

  static take(count: number): SubscriptionModel {
    const instance = new SubscriptionModel(null)

    instance.selectFromQuery = instance.selectFromQuery.limit(count)

    return instance
  }

  static async pluck<K extends keyof SubscriptionModel>(field: K): Promise<SubscriptionModel[K][]> {
    const instance = new SubscriptionModel(null)

    if (instance.hasSelect) {
      const model = await instance.selectFromQuery.execute()
      return model.map((modelItem: SubscriptionModel) => modelItem[field])
    }

    const model = await instance.selectFromQuery.selectAll().execute()

    return model.map((modelItem: SubscriptionModel) => modelItem[field])
  }

  async pluck<K extends keyof SubscriptionModel>(field: K): Promise<SubscriptionModel[K][]> {
    return SubscriptionModel.pluck(field)
  }

  static async count(): Promise<number> {
    const instance = new SubscriptionModel(null)

    const result = await instance.selectFromQuery
      .select(sql`COUNT(*) as count`)
      .executeTakeFirst()

    return result.count || 0
  }

  async count(): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`COUNT(*) as count`)
      .executeTakeFirst()

    return result.count || 0
  }

  static async max(field: keyof SubscriptionModel): Promise<number> {
    const instance = new SubscriptionModel(null)

    const result = await instance.selectFromQuery
      .select(sql`MAX(${sql.raw(field as string)}) as max `)
      .executeTakeFirst()

    return result.max
  }

  async max(field: keyof SubscriptionModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`MAX(${sql.raw(field as string)}) as max`)
      .executeTakeFirst()

    return result.max
  }

  static async min(field: keyof SubscriptionModel): Promise<number> {
    const instance = new SubscriptionModel(null)

    const result = await instance.selectFromQuery
      .select(sql`MIN(${sql.raw(field as string)}) as min `)
      .executeTakeFirst()

    return result.min
  }

  async min(field: keyof SubscriptionModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`MIN(${sql.raw(field as string)}) as min `)
      .executeTakeFirst()

    return result.min
  }

  static async avg(field: keyof SubscriptionModel): Promise<number> {
    const instance = new SubscriptionModel(null)

    const result = await instance.selectFromQuery
      .select(sql`AVG(${sql.raw(field as string)}) as avg `)
      .executeTakeFirst()

    return result.avg
  }

  async avg(field: keyof SubscriptionModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`AVG(${sql.raw(field as string)}) as avg `)
      .executeTakeFirst()

    return result.avg
  }

  static async sum(field: keyof SubscriptionModel): Promise<number> {
    const instance = new SubscriptionModel(null)

    const result = await instance.selectFromQuery
      .select(sql`SUM(${sql.raw(field as string)}) as sum `)
      .executeTakeFirst()

    return result.sum
  }

  async sum(field: keyof SubscriptionModel): Promise<number> {
    const result = this.selectFromQuery
      .select(sql`SUM(${sql.raw(field as string)}) as sum `)
      .executeTakeFirst()

    return result.sum
  }

  async applyGet(): Promise<SubscriptionModel[]> {
    let models

    if (this.hasSelect) {
      models = await this.selectFromQuery.execute()
    }
    else {
      models = await this.selectFromQuery.selectAll().execute()
    }

    this.mapCustomGetters(models)
    await this.loadRelations(models)

    const data = await Promise.all(models.map(async (model: SubscriptionModel) => {
      return new SubscriptionModel(model)
    }))

    return data
  }

  async get(): Promise<SubscriptionModel[]> {
    return await this.applyGet()
  }

  static async get(): Promise<SubscriptionModel[]> {
    const instance = new SubscriptionModel(null)

    return await instance.applyGet()
  }

  has(relation: string): SubscriptionModel {
    this.selectFromQuery = this.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(
        selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.subscription_id`, '=', 'subscriptions.id'),
      ),
    )

    return this
  }

  static has(relation: string): SubscriptionModel {
    const instance = new SubscriptionModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(
        selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.subscription_id`, '=', 'subscriptions.id'),
      ),
    )

    return instance
  }

  static whereExists(callback: (qb: any) => any): SubscriptionModel {
    const instance = new SubscriptionModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(callback({ exists, selectFrom })),
    )

    return instance
  }

  applyWhereHas(
    relation: string,
    callback: (query: SubqueryBuilder) => void,
  ): SubscriptionModel {
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    this.selectFromQuery = this.selectFromQuery
      .where(({ exists, selectFrom }: any) => {
        let subquery = selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.subscription_id`, '=', 'subscriptions.id')

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

    return this
  }

  whereHas(
    relation: string,
    callback: (query: SubqueryBuilder) => void,
  ): SubscriptionModel {
    return this.applyWhereHas(relation, callback)
  }

  static whereHas(
    relation: string,
    callback: (query: SubqueryBuilder) => void,
  ): SubscriptionModel {
    const instance = new SubscriptionModel(null)

    return instance.applyWhereHas(relation, callback)
  }

  applyDoesntHave(relation: string): SubscriptionModel {
    this.selectFromQuery = this.selectFromQuery.where(({ not, exists, selectFrom }: any) =>
      not(
        exists(
          selectFrom(relation)
            .select('1')
            .whereRef(`${relation}.subscription_id`, '=', 'subscriptions.id'),
        ),
      ),
    )

    return this
  }

  doesntHave(relation: string): SubscriptionModel {
    return this.applyDoesntHave(relation)
  }

  static doesntHave(relation: string): SubscriptionModel {
    const instance = new SubscriptionModel(null)

    return instance.doesntHave(relation)
  }

  applyWhereDoesntHave(relation: string, callback: (query: SubqueryBuilder) => void): SubscriptionModel {
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    this.selectFromQuery = this.selectFromQuery
      .where(({ exists, selectFrom, not }: any) => {
        let subquery = selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.subscription_id`, '=', 'subscriptions.id')

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

    return this
  }

  whereDoesntHave(relation: string, callback: (query: SubqueryBuilder) => void): SubscriptionModel {
    return this.applyWhereDoesntHave(relation, callback)
  }

  static whereDoesntHave(
    relation: string,
    callback: (query: SubqueryBuilder) => void,
  ): SubscriptionModel {
    const instance = new SubscriptionModel(null)

    return instance.applyWhereDoesntHave(relation, callback)
  }

  async applyPaginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<SubscriptionResponse> {
    const totalRecordsResult = await DB.instance.selectFrom('subscriptions')
      .select(DB.instance.fn.count('id').as('total')) // Use 'id' or another actual column name
      .executeTakeFirst()

    const totalRecords = Number(totalRecordsResult?.total) || 0
    const totalPages = Math.ceil(totalRecords / (options.limit ?? 10))

    const subscriptionsWithExtra = await DB.instance.selectFrom('subscriptions')
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

  async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<SubscriptionResponse> {
    return await this.applyPaginate(options)
  }

  // Method to get all subscriptions
  static async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<SubscriptionResponse> {
    const instance = new SubscriptionModel(null)

    return await instance.applyPaginate(options)
  }

  async applyCreate(newSubscription: NewSubscription): Promise<SubscriptionModel> {
    const filteredValues = Object.fromEntries(
      Object.entries(newSubscription).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewSubscription

    await this.mapCustomSetters(filteredValues)

    filteredValues.uuid = randomUUIDv7()

    const result = await DB.instance.insertInto('subscriptions')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await this.find(Number(result.numInsertedOrUpdatedRows)) as SubscriptionModel

    if (model)
      dispatch('subscription:created', model)

    return model
  }

  async create(newSubscription: NewSubscription): Promise<SubscriptionModel> {
    return await this.applyCreate(newSubscription)
  }

  static async create(newSubscription: NewSubscription): Promise<SubscriptionModel> {
    const instance = new SubscriptionModel(null)

    return await instance.applyCreate(newSubscription)
  }

  static async createMany(newSubscription: NewSubscription[]): Promise<void> {
    const instance = new SubscriptionModel(null)

    const valuesFiltered = newSubscription.map((newSubscription: NewSubscription) => {
      const filteredValues = Object.fromEntries(
        Object.entries(newSubscription).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewSubscription

      filteredValues.uuid = randomUUIDv7()

      return filteredValues
    })

    await DB.instance.insertInto('subscriptions')
      .values(valuesFiltered)
      .executeTakeFirst()
  }

  static async forceCreate(newSubscription: NewSubscription): Promise<SubscriptionModel> {
    const result = await DB.instance.insertInto('subscriptions')
      .values(newSubscription)
      .executeTakeFirst()

    const model = await find(Number(result.numInsertedOrUpdatedRows)) as SubscriptionModel

    return model
  }

  // Method to remove a Subscription
  static async remove(id: number): Promise<any> {
    return await DB.instance.deleteFrom('subscriptions')
      .where('id', '=', id)
      .execute()
  }

  applyWhere(instance: SubscriptionModel, column: string, ...args: any[]): SubscriptionModel {
    const [operatorOrValue, value] = args
    const operator = value === undefined ? '=' : operatorOrValue
    const actualValue = value === undefined ? operatorOrValue : value

    instance.selectFromQuery = instance.selectFromQuery.where(column, operator, actualValue)
    instance.updateFromQuery = instance.updateFromQuery.where(column, operator, actualValue)
    instance.deleteFromQuery = instance.deleteFromQuery.where(column, operator, actualValue)

    return instance
  }

  where(column: string, ...args: any[]): SubscriptionModel {
    return this.applyWhere(this, column, ...args)
  }

  static where(column: string, ...args: any[]): SubscriptionModel {
    const instance = new SubscriptionModel(null)

    return instance.applyWhere(instance, column, ...args)
  }

  whereColumn(first: string, operator: string, second: string): SubscriptionModel {
    this.selectFromQuery = this.selectFromQuery.whereRef(first, operator, second)

    return this
  }

  static whereColumn(first: string, operator: string, second: string): SubscriptionModel {
    const instance = new SubscriptionModel(null)

    instance.selectFromQuery = instance.selectFromQuery.whereRef(first, operator, second)

    return instance
  }

  applyWhereRef(column: string, ...args: string[]): SubscriptionModel {
    const [operatorOrValue, value] = args
    const operator = value === undefined ? '=' : operatorOrValue
    const actualValue = value === undefined ? operatorOrValue : value

    const instance = new SubscriptionModel(null)
    instance.selectFromQuery = instance.selectFromQuery.whereRef(column, operator, actualValue)

    return instance
  }

  whereRef(column: string, ...args: string[]): SubscriptionModel {
    return this.applyWhereRef(column, ...args)
  }

  static whereRef(column: string, ...args: string[]): SubscriptionModel {
    const instance = new SubscriptionModel(null)

    return instance.applyWhereRef(column, ...args)
  }

  whereRaw(sqlStatement: string): SubscriptionModel {
    this.selectFromQuery = this.selectFromQuery.where(sql`${sqlStatement}`)

    return this
  }

  static whereRaw(sqlStatement: string): SubscriptionModel {
    const instance = new SubscriptionModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(sql`${sqlStatement}`)

    return instance
  }

  applyOrWhere(...conditions: [string, any][]): SubscriptionModel {
    this.selectFromQuery = this.selectFromQuery.where((eb: any) => {
      return eb.or(
        conditions.map(([column, value]) => eb(column, '=', value)),
      )
    })

    this.updateFromQuery = this.updateFromQuery.where((eb: any) => {
      return eb.or(
        conditions.map(([column, value]) => eb(column, '=', value)),
      )
    })

    this.deleteFromQuery = this.deleteFromQuery.where((eb: any) => {
      return eb.or(
        conditions.map(([column, value]) => eb(column, '=', value)),
      )
    })

    return this
  }

  orWhere(...conditions: [string, any][]): SubscriptionModel {
    return this.applyOrWhere(...conditions)
  }

  static orWhere(...conditions: [string, any][]): SubscriptionModel {
    const instance = new SubscriptionModel(null)

    return instance.applyOrWhere(...conditions)
  }

  when(
    condition: boolean,
    callback: (query: SubscriptionModel) => SubscriptionModel,
  ): SubscriptionModel {
    return SubscriptionModel.when(condition, callback)
  }

  static when(
    condition: boolean,
    callback: (query: SubscriptionModel) => SubscriptionModel,
  ): SubscriptionModel {
    let instance = new SubscriptionModel(null)

    if (condition)
      instance = callback(instance)

    return instance
  }

  whereNull(column: string): SubscriptionModel {
    return SubscriptionModel.whereNull(column)
  }

  static whereNull(column: string): SubscriptionModel {
    const instance = new SubscriptionModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    instance.updateFromQuery = instance.updateFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    return instance
  }

  static whereType(value: string): SubscriptionModel {
    const instance = new SubscriptionModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('type', '=', value)

    return instance
  }

  static whereProviderId(value: string): SubscriptionModel {
    const instance = new SubscriptionModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('providerId', '=', value)

    return instance
  }

  static whereProviderStatus(value: string): SubscriptionModel {
    const instance = new SubscriptionModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('providerStatus', '=', value)

    return instance
  }

  static whereUnitPrice(value: string): SubscriptionModel {
    const instance = new SubscriptionModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('unitPrice', '=', value)

    return instance
  }

  static whereProviderType(value: string): SubscriptionModel {
    const instance = new SubscriptionModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('providerType', '=', value)

    return instance
  }

  static whereProviderPriceId(value: string): SubscriptionModel {
    const instance = new SubscriptionModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('providerPriceId', '=', value)

    return instance
  }

  static whereQuantity(value: string): SubscriptionModel {
    const instance = new SubscriptionModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('quantity', '=', value)

    return instance
  }

  static whereTrialEndsAt(value: string): SubscriptionModel {
    const instance = new SubscriptionModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('trialEndsAt', '=', value)

    return instance
  }

  static whereEndsAt(value: string): SubscriptionModel {
    const instance = new SubscriptionModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('endsAt', '=', value)

    return instance
  }

  static whereLastUsedAt(value: string): SubscriptionModel {
    const instance = new SubscriptionModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('lastUsedAt', '=', value)

    return instance
  }

  whereIn(column: keyof SubscriptionType, values: any[]): SubscriptionModel {
    return SubscriptionModel.whereIn(column, values)
  }

  static whereIn(column: keyof SubscriptionType, values: any[]): SubscriptionModel {
    const instance = new SubscriptionModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(column, 'in', values)

    instance.updateFromQuery = instance.updateFromQuery.where(column, 'in', values)

    instance.deleteFromQuery = instance.deleteFromQuery.where(column, 'in', values)

    return instance
  }

  applyWhereBetween(column: keyof SubscriptionType, range: [any, any]): SubscriptionModel {
    if (range.length !== 2) {
      throw new HttpError(500, 'Range must have exactly two values: [min, max]')
    }

    const query = sql` ${sql.raw(column as string)} between ${range[0]} and ${range[1]} `

    this.selectFromQuery = this.selectFromQuery.where(query)
    this.updateFromQuery = this.updateFromQuery.where(query)
    this.deleteFromQuery = this.deleteFromQuery.where(query)

    return this
  }

  whereBetween(column: keyof SubscriptionType, range: [any, any]): SubscriptionModel {
    return this.applyWhereBetween(column, range)
  }

  static whereBetween(column: keyof SubscriptionType, range: [any, any]): SubscriptionModel {
    const instance = new SubscriptionModel(null)

    return instance.applyWhereBetween(column, range)
  }

  applyWhereLike(column: keyof SubscriptionType, value: string): SubscriptionModel {
    this.selectFromQuery = this.selectFromQuery.where(sql` ${sql.raw(column as string)} LIKE ${value}`)

    this.updateFromQuery = this.updateFromQuery.where(sql` ${sql.raw(column as string)} LIKE ${value}`)

    this.deleteFromQuery = this.deleteFromQuery.where(sql` ${sql.raw(column as string)} LIKE ${value}`)

    return this
  }

  whereLike(column: keyof SubscriptionType, value: string): SubscriptionModel {
    return this.applyWhereLike(column, value)
  }

  static whereLike(column: keyof SubscriptionType, value: string): SubscriptionModel {
    const instance = new SubscriptionModel(null)

    return instance.applyWhereLike(column, value)
  }

  applyWhereNotIn(column: keyof SubscriptionType, values: any[]): SubscriptionModel {
    this.selectFromQuery = this.selectFromQuery.where(column, 'not in', values)

    this.updateFromQuery = this.updateFromQuery.where(column, 'not in', values)

    this.deleteFromQuery = this.deleteFromQuery.where(column, 'not in', values)

    return this
  }

  whereNotIn(column: keyof SubscriptionType, values: any[]): SubscriptionModel {
    return this.applyWhereNotIn(column, values)
  }

  static whereNotIn(column: keyof SubscriptionType, values: any[]): SubscriptionModel {
    const instance = new SubscriptionModel(null)

    return instance.applyWhereNotIn(column, values)
  }

  async exists(): Promise<boolean> {
    let model

    if (this.hasSelect) {
      model = await this.selectFromQuery.executeTakeFirst()
    }
    else {
      model = await this.selectFromQuery.selectAll().executeTakeFirst()
    }

    return model !== null && model !== undefined
  }

  static async latest(): Promise<SubscriptionType | undefined> {
    const instance = new SubscriptionModel(null)

    const model = await DB.instance.selectFrom('subscriptions')
      .selectAll()
      .orderBy('id', 'desc')
      .executeTakeFirst()

    if (!model)
      return undefined

    instance.mapCustomGetters(model)

    const data = new SubscriptionModel(model as SubscriptionType)

    return data
  }

  static async oldest(): Promise<SubscriptionType | undefined> {
    const instance = new SubscriptionModel(null)

    const model = await DB.instance.selectFrom('subscriptions')
      .selectAll()
      .orderBy('id', 'asc')
      .executeTakeFirst()

    if (!model)
      return undefined

    instance.mapCustomGetters(model)

    const data = new SubscriptionModel(model as SubscriptionType)

    return data
  }

  static async firstOrCreate(
    condition: Partial<SubscriptionType>,
    newSubscription: NewSubscription,
  ): Promise<SubscriptionModel> {
    const instance = new SubscriptionModel(null)

    const key = Object.keys(condition)[0] as keyof SubscriptionType

    if (!key) {
      throw new HttpError(500, 'Condition must contain at least one key-value pair')
    }

    const value = condition[key]

    // Attempt to find the first record matching the condition
    const existingSubscription = await DB.instance.selectFrom('subscriptions')
      .selectAll()
      .where(key, '=', value)
      .executeTakeFirst()

    if (existingSubscription) {
      instance.mapCustomGetters(existingSubscription)
      await instance.loadRelations(existingSubscription)

      return new SubscriptionModel(existingSubscription as SubscriptionType)
    }
    else {
      return await instance.create(newSubscription)
    }
  }

  static async updateOrCreate(
    condition: Partial<SubscriptionType>,
    newSubscription: NewSubscription,
  ): Promise<SubscriptionModel> {
    const instance = new SubscriptionModel(null)

    const key = Object.keys(condition)[0] as keyof SubscriptionType

    if (!key) {
      throw new HttpError(500, 'Condition must contain at least one key-value pair')
    }

    const value = condition[key]

    // Attempt to find the first record matching the condition
    const existingSubscription = await DB.instance.selectFrom('subscriptions')
      .selectAll()
      .where(key, '=', value)
      .executeTakeFirst()

    if (existingSubscription) {
      // If found, update the existing record
      await DB.instance.updateTable('subscriptions')
        .set(newSubscription)
        .where(key, '=', value)
        .executeTakeFirstOrThrow()

      // Fetch and return the updated record
      const updatedSubscription = await DB.instance.selectFrom('subscriptions')
        .selectAll()
        .where(key, '=', value)
        .executeTakeFirst()

      if (!updatedSubscription) {
        throw new HttpError(500, 'Failed to fetch updated record')
      }

      instance.hasSaved = true

      return new SubscriptionModel(updatedSubscription as SubscriptionType)
    }
    else {
      // If not found, create a new record
      return await instance.create(newSubscription)
    }
  }

  async loadRelations(models: SubscriptionJsonResponse | SubscriptionJsonResponse[]): Promise<void> {
    // Handle both single model and array of models
    const modelArray = Array.isArray(models) ? models : [models]
    if (!modelArray.length)
      return

    const modelIds = modelArray.map(model => model.id)

    for (const relation of this.withRelations) {
      const relatedRecords = await DB.instance
        .selectFrom(relation)
        .where('subscription_id', 'in', modelIds)
        .selectAll()
        .execute()

      if (Array.isArray(models)) {
        models.map((model: SubscriptionJsonResponse) => {
          const records = relatedRecords.filter((record: { subscription_id: number }) => {
            return record.subscription_id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      }
      else {
        const records = relatedRecords.filter((record: { subscription_id: number }) => {
          return record.subscription_id === models.id
        })

        models[relation] = records.length === 1 ? records[0] : records
      }
    }
  }

  with(relations: string[]): SubscriptionModel {
    this.withRelations = relations

    return this
  }

  static with(relations: string[]): SubscriptionModel {
    const instance = new SubscriptionModel(null)

    instance.withRelations = relations

    return instance
  }

  async last(): Promise<SubscriptionType | undefined> {
    let model: SubscriptionModel | undefined

    if (this.hasSelect) {
      model = await this.selectFromQuery.executeTakeFirst()
    }
    else {
      model = await this.selectFromQuery.selectAll().orderBy('id', 'desc').executeTakeFirst()
    }

    if (model) {
      this.mapCustomGetters(model)
      await this.loadRelations(model)
    }

    const data = new SubscriptionModel(model as SubscriptionType)

    return data
  }

  static async last(): Promise<SubscriptionType | undefined> {
    const model = await DB.instance.selectFrom('subscriptions').selectAll().orderBy('id', 'desc').executeTakeFirst()

    if (!model)
      return undefined

    const data = new SubscriptionModel(model as SubscriptionType)

    return data
  }

  orderBy(column: keyof SubscriptionType, order: 'asc' | 'desc'): SubscriptionModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, order)

    return this
  }

  static orderBy(column: keyof SubscriptionType, order: 'asc' | 'desc'): SubscriptionModel {
    const instance = new SubscriptionModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, order)

    return instance
  }

  groupBy(column: keyof SubscriptionType): SubscriptionModel {
    this.selectFromQuery = this.selectFromQuery.groupBy(column)

    return this
  }

  static groupBy(column: keyof SubscriptionType): SubscriptionModel {
    const instance = new SubscriptionModel(null)

    instance.selectFromQuery = instance.selectFromQuery.groupBy(column)

    return instance
  }

  having(column: keyof SubscriptionType, operator: string, value: any): SubscriptionModel {
    this.selectFromQuery = this.selectFromQuery.having(column, operator, value)

    return this
  }

  static having(column: keyof SubscriptionType, operator: string, value: any): SubscriptionModel {
    const instance = new SubscriptionModel(null)

    instance.selectFromQuery = instance.selectFromQuery.having(column, operator, value)

    return instance
  }

  inRandomOrder(): SubscriptionModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(sql` ${sql.raw('RANDOM()')} `)

    return this
  }

  static inRandomOrder(): SubscriptionModel {
    const instance = new SubscriptionModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(sql` ${sql.raw('RANDOM()')} `)

    return instance
  }

  orderByDesc(column: keyof SubscriptionType): SubscriptionModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, 'desc')

    return this
  }

  static orderByDesc(column: keyof SubscriptionType): SubscriptionModel {
    const instance = new SubscriptionModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'desc')

    return instance
  }

  orderByAsc(column: keyof SubscriptionType): SubscriptionModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, 'asc')

    return this
  }

  static orderByAsc(column: keyof SubscriptionType): SubscriptionModel {
    const instance = new SubscriptionModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'asc')

    return instance
  }

  async update(newSubscription: SubscriptionUpdate): Promise<SubscriptionModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newSubscription).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewSubscription

    await this.mapCustomSetters(filteredValues)

    await DB.instance.updateTable('subscriptions')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      const model = await this.find(this.id)

      return model
    }

    this.hasSaved = true

    return undefined
  }

  async forceUpdate(subscription: SubscriptionUpdate): Promise<SubscriptionModel | undefined> {
    if (this.id === undefined) {
      this.updateFromQuery.set(subscription).execute()
    }

    await this.mapCustomSetters(subscription)

    await DB.instance.updateTable('subscriptions')
      .set(subscription)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      const model = await this.find(this.id)

      this.hasSaved = true

      return model
    }

    return undefined
  }

  async save(): Promise<void> {
    if (!this)
      throw new HttpError(500, 'Subscription data is undefined')

    const filteredValues = Object.fromEntries(
      Object.entries(this.attributes).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewSubscription

    await this.mapCustomSetters(filteredValues)

    if (this.id === undefined) {
      await DB.instance.insertInto('subscriptions')
        .values(filteredValues)
        .executeTakeFirstOrThrow()
    }
    else {
      await this.update(this.attributes)
    }

    this.hasSaved = true
  }

  fill(data: Partial<SubscriptionType>): SubscriptionModel {
    const filteredValues = Object.fromEntries(
      Object.entries(data).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewSubscription

    this.attributes = {
      ...this.attributes,
      ...filteredValues,
    }

    return this
  }

  forceFill(data: Partial<SubscriptionType>): SubscriptionModel {
    this.attributes = {
      ...this.attributes,
      ...data,
    }

    return this
  }

  // Method to delete (soft delete) the subscription instance
  async delete(): Promise<any> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()

    return await DB.instance.deleteFrom('subscriptions')
      .where('id', '=', this.id)
      .execute()
  }

  async userBelong(): Promise<UserModel> {
    if (this.user_id === undefined)
      throw new HttpError(500, 'Relation Error!')

    const model = await User
      .where('id', '=', this.user_id)
      .first()

    if (!model)
      throw new HttpError(500, 'Model Relation Not Found!')

    return model
  }

  distinct(column: keyof SubscriptionType): SubscriptionModel {
    this.selectFromQuery = this.selectFromQuery.select(column).distinct()

    this.hasSelect = true

    return this
  }

  static distinct(column: keyof SubscriptionType): SubscriptionModel {
    const instance = new SubscriptionModel(null)

    instance.selectFromQuery = instance.selectFromQuery.select(column).distinct()

    instance.hasSelect = true

    return instance
  }

  join(table: string, firstCol: string, secondCol: string): SubscriptionModel {
    this.selectFromQuery = this.selectFromQuery.innerJoin(table, firstCol, secondCol)

    return this
  }

  static join(table: string, firstCol: string, secondCol: string): SubscriptionModel {
    const instance = new SubscriptionModel(null)

    instance.selectFromQuery = instance.selectFromQuery.innerJoin(table, firstCol, secondCol)

    return instance
  }

  toJSON(): Partial<SubscriptionJsonResponse> {
    const output: Partial<SubscriptionJsonResponse> = {

      id: this.id,
      type: this.type,
      provider_id: this.provider_id,
      provider_status: this.provider_status,
      unit_price: this.unit_price,
      provider_type: this.provider_type,
      provider_price_id: this.provider_price_id,
      quantity: this.quantity,
      trial_ends_at: this.trial_ends_at,
      ends_at: this.ends_at,
      last_used_at: this.last_used_at,

      created_at: this.created_at,

      updated_at: this.updated_at,

      user_id: this.user_id,
      user: this.user,
      ...this.customColumns,
    }

    return output
  }

  parseResult(model: SubscriptionModel): SubscriptionModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof SubscriptionModel]
    }

    return model
  }
}

async function find(id: number): Promise<SubscriptionModel | undefined> {
  const query = DB.instance.selectFrom('subscriptions').where('id', '=', id).selectAll()

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
  const result = await DB.instance.insertInto('subscriptions')
    .values(newSubscription)
    .executeTakeFirstOrThrow()

  return await find(Number(result.numInsertedOrUpdatedRows)) as SubscriptionModel
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(DB.instance)
}

export async function remove(id: number): Promise<void> {
  await DB.instance.deleteFrom('subscriptions')
    .where('id', '=', id)
    .execute()
}

export async function whereType(value: string): Promise<SubscriptionModel[]> {
  const query = DB.instance.selectFrom('subscriptions').where('type', '=', value)
  const results = await query.execute()

  return results.map((modelItem: SubscriptionModel) => new SubscriptionModel(modelItem))
}

export async function whereProviderId(value: string): Promise<SubscriptionModel[]> {
  const query = DB.instance.selectFrom('subscriptions').where('provider_id', '=', value)
  const results = await query.execute()

  return results.map((modelItem: SubscriptionModel) => new SubscriptionModel(modelItem))
}

export async function whereProviderStatus(value: string): Promise<SubscriptionModel[]> {
  const query = DB.instance.selectFrom('subscriptions').where('provider_status', '=', value)
  const results = await query.execute()

  return results.map((modelItem: SubscriptionModel) => new SubscriptionModel(modelItem))
}

export async function whereUnitPrice(value: number): Promise<SubscriptionModel[]> {
  const query = DB.instance.selectFrom('subscriptions').where('unit_price', '=', value)
  const results = await query.execute()

  return results.map((modelItem: SubscriptionModel) => new SubscriptionModel(modelItem))
}

export async function whereProviderType(value: string): Promise<SubscriptionModel[]> {
  const query = DB.instance.selectFrom('subscriptions').where('provider_type', '=', value)
  const results = await query.execute()

  return results.map((modelItem: SubscriptionModel) => new SubscriptionModel(modelItem))
}

export async function whereProviderPriceId(value: string): Promise<SubscriptionModel[]> {
  const query = DB.instance.selectFrom('subscriptions').where('provider_price_id', '=', value)
  const results = await query.execute()

  return results.map((modelItem: SubscriptionModel) => new SubscriptionModel(modelItem))
}

export async function whereQuantity(value: number): Promise<SubscriptionModel[]> {
  const query = DB.instance.selectFrom('subscriptions').where('quantity', '=', value)
  const results = await query.execute()

  return results.map((modelItem: SubscriptionModel) => new SubscriptionModel(modelItem))
}

export async function whereTrialEndsAt(value: string): Promise<SubscriptionModel[]> {
  const query = DB.instance.selectFrom('subscriptions').where('trial_ends_at', '=', value)
  const results = await query.execute()

  return results.map((modelItem: SubscriptionModel) => new SubscriptionModel(modelItem))
}

export async function whereEndsAt(value: string): Promise<SubscriptionModel[]> {
  const query = DB.instance.selectFrom('subscriptions').where('ends_at', '=', value)
  const results = await query.execute()

  return results.map((modelItem: SubscriptionModel) => new SubscriptionModel(modelItem))
}

export async function whereLastUsedAt(value: string): Promise<SubscriptionModel[]> {
  const query = DB.instance.selectFrom('subscriptions').where('last_used_at', '=', value)
  const results = await query.execute()

  return results.map((modelItem: SubscriptionModel) => new SubscriptionModel(modelItem))
}

export const Subscription = SubscriptionModel

export default Subscription
