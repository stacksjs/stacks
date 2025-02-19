import type { Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import { cache } from '@stacksjs/cache'
import { sql } from '@stacksjs/database'
import { HttpError, ModelNotFoundException } from '@stacksjs/error-handling'
import { DB, SubqueryBuilder } from '@stacksjs/orm'

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
  private readonly guarded: Array<keyof SubscriberJsonResponse> = []
  protected attributes: Partial<SubscriberJsonResponse> = {}
  protected originalAttributes: Partial<SubscriberJsonResponse> = {}

  protected selectFromQuery: any
  protected withRelations: string[]
  protected updateFromQuery: any
  protected deleteFromQuery: any
  protected hasSelect: boolean
  private hasSaved: boolean
  private customColumns: Record<string, unknown> = {}

  constructor(subscriber: Partial<SubscriberType> | null) {
    if (subscriber) {
      this.attributes = { ...subscriber }
      this.originalAttributes = { ...subscriber }

      Object.keys(subscriber).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (subscriber as SubscriberJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = DB.instance.selectFrom('subscribers')
    this.updateFromQuery = DB.instance.updateTable('subscribers')
    this.deleteFromQuery = DB.instance.deleteFrom('subscribers')
    this.hasSelect = false
    this.hasSaved = false
  }

  mapCustomGetters(models: SubscriberJsonResponse | SubscriberJsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: SubscriberJsonResponse) => {
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

  async mapCustomSetters(model: SubscriberJsonResponse): Promise<void> {
    const customSetter = {
      default: () => {
      },

    }

    for (const [key, fn] of Object.entries(customSetter)) {
      model[key] = await fn()
    }
  }

  get id(): number | undefined {
    return this.attributes.id
  }

  get subscribed(): boolean | undefined {
    return this.attributes.subscribed
  }

  get created_at(): Date | undefined {
    return this.attributes.created_at
  }

  get updated_at(): Date | undefined {
    return this.attributes.updated_at
  }

  set subscribed(value: boolean) {
    this.attributes.subscribed = value
  }

  set updated_at(value: Date) {
    this.attributes.updated_at = value
  }

  getOriginal(column?: keyof SubscriberJsonResponse): Partial<SubscriberJsonResponse> {
    if (column) {
      return this.originalAttributes[column]
    }

    return this.originalAttributes
  }

  getChanges(): Partial<SubscriberJsonResponse> {
    return this.fillable.reduce<Partial<SubscriberJsonResponse>>((changes, key) => {
      const currentValue = this.attributes[key as keyof SubscribersTable]
      const originalValue = this.originalAttributes[key as keyof SubscribersTable]

      if (currentValue !== originalValue) {
        changes[key] = currentValue
      }

      return changes
    }, {})
  }

  isDirty(column?: keyof SubscriberType): boolean {
    if (column) {
      return this.attributes[column] !== this.originalAttributes[column]
    }

    return Object.entries(this.originalAttributes).some(([key, originalValue]) => {
      const currentValue = (this.attributes as any)[key]

      return currentValue !== originalValue
    })
  }

  isClean(column?: keyof SubscriberType): boolean {
    return !this.isDirty(column)
  }

  wasChanged(column?: keyof SubscriberType): boolean {
    return this.hasSaved && this.isDirty(column)
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

  async applyFind(id: number): Promise<SubscriberModel | undefined> {
    const model = await DB.instance.selectFrom('subscribers').where('id', '=', id).selectAll().executeTakeFirst()

    if (!model)
      return undefined

    this.mapCustomGetters(model)
    await this.loadRelations(model)

    const data = new SubscriberModel(model as SubscriberType)

    cache.getOrSet(`subscriber:${id}`, JSON.stringify(model))

    return data
  }

  async find(id: number): Promise<SubscriberModel | undefined> {
    return await this.applyFind(id)
  }

  // Method to find a Subscriber by ID
  static async find(id: number): Promise<SubscriberModel | undefined> {
    const instance = new SubscriberModel(null)

    return await instance.applyFind(id)
  }

  async first(): Promise<SubscriberModel | undefined> {
    let model: SubscriberModel | undefined

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

    const data = new SubscriberModel(model as SubscriberType)

    return data
  }

  static async first(): Promise<SubscriberModel | undefined> {
    const instance = new SubscriberModel(null)

    const model = await DB.instance.selectFrom('subscribers')
      .selectAll()
      .executeTakeFirst()

    instance.mapCustomGetters(model)

    const data = new SubscriberModel(model as SubscriberType)

    return data
  }

  async applyFirstOrFail(): Promise<SubscriberModel | undefined> {
    const model = await this.selectFromQuery.executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, 'No SubscriberModel results found for query')

    if (model) {
      this.mapCustomGetters(model)
      await this.loadRelations(model)
    }

    const data = new SubscriberModel(model as SubscriberType)

    return data
  }

  async firstOrFail(): Promise<SubscriberModel | undefined> {
    return await this.applyFirstOrFail()
  }

  static async firstOrFail(): Promise<SubscriberModel | undefined> {
    const instance = new SubscriberModel(null)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<SubscriberModel[]> {
    const instance = new SubscriberModel(null)

    const models = await DB.instance.selectFrom('subscribers').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: SubscriberType) => {
      return new SubscriberModel(model)
    }))

    return data
  }

  async applyFindOrFail(id: number): Promise<SubscriberModel> {
    const model = await DB.instance.selectFrom('subscribers').where('id', '=', id).selectAll().executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, `No SubscriberModel results for ${id}`)

    cache.getOrSet(`subscriber:${id}`, JSON.stringify(model))

    this.mapCustomGetters(model)
    await this.loadRelations(model)

    const data = new SubscriberModel(model as SubscriberType)

    return data
  }

  async findOrFail(id: number): Promise<SubscriberModel> {
    return await this.applyFindOrFail(id)
  }

  static async findOrFail(id: number): Promise<SubscriberModel> {
    const instance = new SubscriberModel(null)

    return await instance.applyFindOrFail(id)
  }

  async applyFindMany(ids: number[]): Promise<SubscriberModel[]> {
    let query = DB.instance.selectFrom('subscribers').where('id', 'in', ids)

    const instance = new SubscriberModel(null)

    query = query.selectAll()

    const models = await query.execute()

    instance.mapCustomGetters(models)
    await instance.loadRelations(models)

    return models.map((modelItem: SubscriberModel) => instance.parseResult(new SubscriberModel(modelItem)))
  }

  static async findMany(ids: number[]): Promise<SubscriberModel[]> {
    const instance = new SubscriberModel(null)

    return await instance.applyFindMany(ids)
  }

  async findMany(ids: number[]): Promise<SubscriberModel[]> {
    return await this.applyFindMany(ids)
  }

  skip(count: number): SubscriberModel {
    this.selectFromQuery = this.selectFromQuery.offset(count)

    return this
  }

  static skip(count: number): SubscriberModel {
    const instance = new SubscriberModel(null)

    instance.selectFromQuery = instance.selectFromQuery.offset(count)

    return instance
  }

  async applyChunk(size: number, callback: (models: SubscriberModel[]) => Promise<void>): Promise<void> {
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

  async chunk(size: number, callback: (models: SubscriberModel[]) => Promise<void>): Promise<void> {
    await this.applyChunk(size, callback)
  }

  static async chunk(size: number, callback: (models: SubscriberModel[]) => Promise<void>): Promise<void> {
    const instance = new SubscriberModel(null)

    await instance.applyChunk(size, callback)
  }

  take(count: number): SubscriberModel {
    this.selectFromQuery = this.selectFromQuery.limit(count)

    return this
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

  static async max(field: keyof SubscriberModel): Promise<number> {
    const instance = new SubscriberModel(null)

    const result = await instance.selectFromQuery
      .select(sql`MAX(${sql.raw(field as string)}) as max `)
      .executeTakeFirst()

    return result.max
  }

  async max(field: keyof SubscriberModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`MAX(${sql.raw(field as string)}) as max`)
      .executeTakeFirst()

    return result.max
  }

  static async min(field: keyof SubscriberModel): Promise<number> {
    const instance = new SubscriberModel(null)

    const result = await instance.selectFromQuery
      .select(sql`MIN(${sql.raw(field as string)}) as min `)
      .executeTakeFirst()

    return result.min
  }

  async min(field: keyof SubscriberModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`MIN(${sql.raw(field as string)}) as min `)
      .executeTakeFirst()

    return result.min
  }

  static async avg(field: keyof SubscriberModel): Promise<number> {
    const instance = new SubscriberModel(null)

    const result = await instance.selectFromQuery
      .select(sql`AVG(${sql.raw(field as string)}) as avg `)
      .executeTakeFirst()

    return result.avg
  }

  async avg(field: keyof SubscriberModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`AVG(${sql.raw(field as string)}) as avg `)
      .executeTakeFirst()

    return result.avg
  }

  static async sum(field: keyof SubscriberModel): Promise<number> {
    const instance = new SubscriberModel(null)

    const result = await instance.selectFromQuery
      .select(sql`SUM(${sql.raw(field as string)}) as sum `)
      .executeTakeFirst()

    return result.sum
  }

  async sum(field: keyof SubscriberModel): Promise<number> {
    const result = this.selectFromQuery
      .select(sql`SUM(${sql.raw(field as string)}) as sum `)
      .executeTakeFirst()

    return result.sum
  }

  async applyGet(): Promise<SubscriberModel[]> {
    let models

    if (this.hasSelect) {
      models = await this.selectFromQuery.execute()
    }
    else {
      models = await this.selectFromQuery.selectAll().execute()
    }

    this.mapCustomGetters(models)
    await this.loadRelations(models)

    const data = await Promise.all(models.map(async (model: SubscriberModel) => {
      return new SubscriberModel(model)
    }))

    return data
  }

  async get(): Promise<SubscriberModel[]> {
    return await this.applyGet()
  }

  static async get(): Promise<SubscriberModel[]> {
    const instance = new SubscriberModel(null)

    return await instance.applyGet()
  }

  has(relation: string): SubscriberModel {
    this.selectFromQuery = this.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(
        selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.subscriber_id`, '=', 'subscribers.id'),
      ),
    )

    return this
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

  static whereExists(callback: (qb: any) => any): SubscriberModel {
    const instance = new SubscriberModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(callback({ exists, selectFrom })),
    )

    return instance
  }

  applyWhereHas(
    relation: string,
    callback: (query: SubqueryBuilder) => void,
  ): SubscriberModel {
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    this.selectFromQuery = this.selectFromQuery
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

    return this
  }

  whereHas(
    relation: string,
    callback: (query: SubqueryBuilder) => void,
  ): SubscriberModel {
    return this.applyWhereHas(relation, callback)
  }

  static whereHas(
    relation: string,
    callback: (query: SubqueryBuilder) => void,
  ): SubscriberModel {
    const instance = new SubscriberModel(null)

    return instance.applyWhereHas(relation, callback)
  }

  applyDoesntHave(relation: string): SubscriberModel {
    this.selectFromQuery = this.selectFromQuery.where(({ not, exists, selectFrom }: any) =>
      not(
        exists(
          selectFrom(relation)
            .select('1')
            .whereRef(`${relation}.subscriber_id`, '=', 'subscribers.id'),
        ),
      ),
    )

    return this
  }

  doesntHave(relation: string): SubscriberModel {
    return this.applyDoesntHave(relation)
  }

  static doesntHave(relation: string): SubscriberModel {
    const instance = new SubscriberModel(null)

    return instance.applyDoesntHave(relation)
  }

  applyWhereDoesntHave(relation: string, callback: (query: SubqueryBuilder) => void): SubscriberModel {
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    this.selectFromQuery = this.selectFromQuery
      .where(({ exists, selectFrom, not }: any) => {
        const subquery = selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.subscriber_id`, '=', 'subscribers.id')

        return not(exists(subquery))
      })

    conditions.forEach((condition) => {
      switch (condition.method) {
        case 'where':
          if (condition.type === 'and') {
            this.where(condition.column, condition.operator!, condition.value)
          }
          break

        case 'whereIn':
          if (condition.operator === 'not') {
            this.whereNotIn(condition.column, condition.values!)
          }
          else {
            this.whereIn(condition.column, condition.values!)
          }

          break

        case 'whereNull':
          this.whereNull(condition.column)
          break

        case 'whereNotNull':
          this.whereNotNull(condition.column)
          break

        case 'whereBetween':
          this.whereBetween(condition.column, condition.values!)
          break

        case 'whereExists': {
          const nestedBuilder = new SubqueryBuilder()
          condition.callback!(nestedBuilder)
          break
        }
      }
    })

    return this
  }

  whereDoesntHave(relation: string, callback: (query: SubqueryBuilder) => void): SubscriberModel {
    return this.applyWhereDoesntHave(relation, callback)
  }

  static whereDoesntHave(
    relation: string,
    callback: (query: SubqueryBuilder) => void,
  ): SubscriberModel {
    const instance = new SubscriberModel(null)

    return instance.applyWhereDoesntHave(relation, callback)
  }

  async applyPaginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<SubscriberResponse> {
    const totalRecordsResult = await DB.instance.selectFrom('subscribers')
      .select(DB.instance.fn.count('id').as('total')) // Use 'id' or another actual column name
      .executeTakeFirst()

    const totalRecords = Number(totalRecordsResult?.total) || 0
    const totalPages = Math.ceil(totalRecords / (options.limit ?? 10))

    const subscribersWithExtra = await DB.instance.selectFrom('subscribers')
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

  async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<SubscriberResponse> {
    return await this.applyPaginate(options)
  }

  // Method to get all subscribers
  static async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<SubscriberResponse> {
    const instance = new SubscriberModel(null)

    return await instance.applyPaginate(options)
  }

  async applyCreate(newSubscriber: NewSubscriber): Promise<SubscriberModel> {
    const filteredValues = Object.fromEntries(
      Object.entries(newSubscriber).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewSubscriber

    await this.mapCustomSetters(filteredValues)

    const result = await DB.instance.insertInto('subscribers')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await this.find(Number(result.numInsertedOrUpdatedRows)) as SubscriberModel

    return model
  }

  async create(newSubscriber: NewSubscriber): Promise<SubscriberModel> {
    return await this.applyCreate(newSubscriber)
  }

  static async create(newSubscriber: NewSubscriber): Promise<SubscriberModel> {
    const instance = new SubscriberModel(null)

    return await instance.applyCreate(newSubscriber)
  }

  static async createMany(newSubscriber: NewSubscriber[]): Promise<void> {
    const instance = new SubscriberModel(null)

    const valuesFiltered = newSubscriber.map((newSubscriber: NewSubscriber) => {
      const filteredValues = Object.fromEntries(
        Object.entries(newSubscriber).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewSubscriber

      return filteredValues
    })

    await DB.instance.insertInto('subscribers')
      .values(valuesFiltered)
      .executeTakeFirst()
  }

  static async forceCreate(newSubscriber: NewSubscriber): Promise<SubscriberModel> {
    const result = await DB.instance.insertInto('subscribers')
      .values(newSubscriber)
      .executeTakeFirst()

    const model = await find(Number(result.numInsertedOrUpdatedRows)) as SubscriberModel

    return model
  }

  // Method to remove a Subscriber
  static async remove(id: number): Promise<any> {
    return await DB.instance.deleteFrom('subscribers')
      .where('id', '=', id)
      .execute()
  }

  applyWhere(instance: SubscriberModel, column: keyof SubscribersTable, ...args: any[]): SubscriberModel {
    const [operatorOrValue, value] = args
    const operator = value === undefined ? '=' : operatorOrValue
    const actualValue = value === undefined ? operatorOrValue : value

    instance.selectFromQuery = instance.selectFromQuery.where(column, operator, actualValue)
    instance.updateFromQuery = instance.updateFromQuery.where(column, operator, actualValue)
    instance.deleteFromQuery = instance.deleteFromQuery.where(column, operator, actualValue)

    return instance
  }

  where(column: keyof SubscribersTable, ...args: any[]): SubscriberModel {
    return this.applyWhere(this, column, ...args)
  }

  static where(column: keyof SubscribersTable, ...args: any[]): SubscriberModel {
    const instance = new SubscriberModel(null)

    return instance.applyWhere(instance, column, ...args)
  }

  whereColumn(first: keyof SubscribersTable, operator: string, second: keyof SubscribersTable): SubscriberModel {
    this.selectFromQuery = this.selectFromQuery.whereRef(first, operator, second)

    return this
  }

  static whereColumn(first: keyof SubscribersTable, operator: string, second: keyof SubscribersTable): SubscriberModel {
    const instance = new SubscriberModel(null)

    instance.selectFromQuery = instance.selectFromQuery.whereRef(first, operator, second)

    return instance
  }

  applyWhereRef(column: keyof SubscribersTable, ...args: string[]): SubscriberModel {
    const [operatorOrValue, value] = args
    const operator = value === undefined ? '=' : operatorOrValue
    const actualValue = value === undefined ? operatorOrValue : value

    const instance = new SubscriberModel(null)
    instance.selectFromQuery = instance.selectFromQuery.whereRef(column, operator, actualValue)

    return instance
  }

  whereRef(column: keyof SubscribersTable, ...args: string[]): SubscriberModel {
    return this.applyWhereRef(column, ...args)
  }

  static whereRef(column: keyof SubscribersTable, ...args: string[]): SubscriberModel {
    const instance = new SubscriberModel(null)

    return instance.applyWhereRef(column, ...args)
  }

  whereRaw(sqlStatement: string): SubscriberModel {
    this.selectFromQuery = this.selectFromQuery.where(sql`${sqlStatement}`)

    return this
  }

  static whereRaw(sqlStatement: string): SubscriberModel {
    const instance = new SubscriberModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(sql`${sqlStatement}`)

    return instance
  }

  applyOrWhere(...conditions: [string, any][]): SubscriberModel {
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

  orWhere(...conditions: [string, any][]): SubscriberModel {
    return this.applyOrWhere(...conditions)
  }

  static orWhere(...conditions: [string, any][]): SubscriberModel {
    const instance = new SubscriberModel(null)

    return instance.applyOrWhere(...conditions)
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
    this.selectFromQuery = this.selectFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    this.updateFromQuery = this.updateFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    this.deleteFromQuery = this.deleteFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    return this
  }

  static whereNull(column: string): SubscriberModel {
    const instance = new SubscriberModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    instance.updateFromQuery = instance.updateFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    instance.deleteFromQuery = instance.deleteFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    return instance
  }

  static whereSubscribed(value: string): SubscriberModel {
    const instance = new SubscriberModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('subscribed', '=', value)

    return instance
  }

  whereIn(column: keyof SubscribersTable, values: any[]): SubscriberModel {
    return SubscriberModel.whereIn(column, values)
  }

  static whereIn(column: keyof SubscribersTable, values: any[]): SubscriberModel {
    const instance = new SubscriberModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(column, 'in', values)

    instance.updateFromQuery = instance.updateFromQuery.where(column, 'in', values)

    instance.deleteFromQuery = instance.deleteFromQuery.where(column, 'in', values)

    return instance
  }

  applyWhereBetween(column: keyof SubscribersTable, range: [any, any]): SubscriberModel {
    if (range.length !== 2) {
      throw new HttpError(500, 'Range must have exactly two values: [min, max]')
    }

    const query = sql` ${sql.raw(column as string)} between ${range[0]} and ${range[1]} `

    this.selectFromQuery = this.selectFromQuery.where(query)
    this.updateFromQuery = this.updateFromQuery.where(query)
    this.deleteFromQuery = this.deleteFromQuery.where(query)

    return this
  }

  whereBetween(column: keyof SubscribersTable, range: [any, any]): SubscriberModel {
    return this.applyWhereBetween(column, range)
  }

  static whereBetween(column: keyof SubscribersTable, range: [any, any]): SubscriberModel {
    const instance = new SubscriberModel(null)

    return instance.applyWhereBetween(column, range)
  }

  applyWhereLike(column: keyof SubscriberType, value: string): SubscriberModel {
    this.selectFromQuery = this.selectFromQuery.where(sql` ${sql.raw(column as string)} LIKE ${value}`)

    this.updateFromQuery = this.updateFromQuery.where(sql` ${sql.raw(column as string)} LIKE ${value}`)

    this.deleteFromQuery = this.deleteFromQuery.where(sql` ${sql.raw(column as string)} LIKE ${value}`)

    return this
  }

  whereLike(column: keyof SubscriberType, value: string): SubscriberModel {
    return this.applyWhereLike(column, value)
  }

  static whereLike(column: keyof SubscriberType, value: string): SubscriberModel {
    const instance = new SubscriberModel(null)

    return instance.applyWhereLike(column, value)
  }

  applyWhereNotIn(column: keyof SubscriberType, values: any[]): SubscriberModel {
    this.selectFromQuery = this.selectFromQuery.where(column, 'not in', values)

    this.updateFromQuery = this.updateFromQuery.where(column, 'not in', values)

    this.deleteFromQuery = this.deleteFromQuery.where(column, 'not in', values)

    return this
  }

  whereNotIn(column: keyof SubscriberType, values: any[]): SubscriberModel {
    return this.applyWhereNotIn(column, values)
  }

  static whereNotIn(column: keyof SubscriberType, values: any[]): SubscriberModel {
    const instance = new SubscriberModel(null)

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

  static async latest(): Promise<SubscriberType | undefined> {
    const instance = new SubscriberModel(null)

    const model = await DB.instance.selectFrom('subscribers')
      .selectAll()
      .orderBy('id', 'desc')
      .executeTakeFirst()

    if (!model)
      return undefined

    instance.mapCustomGetters(model)

    const data = new SubscriberModel(model as SubscriberType)

    return data
  }

  static async oldest(): Promise<SubscriberType | undefined> {
    const instance = new SubscriberModel(null)

    const model = await DB.instance.selectFrom('subscribers')
      .selectAll()
      .orderBy('id', 'asc')
      .executeTakeFirst()

    if (!model)
      return undefined

    instance.mapCustomGetters(model)

    const data = new SubscriberModel(model as SubscriberType)

    return data
  }

  static async firstOrCreate(
    condition: Partial<SubscriberType>,
    newSubscriber: NewSubscriber,
  ): Promise<SubscriberModel> {
    const instance = new SubscriberModel(null)

    const key = Object.keys(condition)[0] as keyof SubscriberType

    if (!key) {
      throw new HttpError(500, 'Condition must contain at least one key-value pair')
    }

    const value = condition[key]

    // Attempt to find the first record matching the condition
    const existingSubscriber = await DB.instance.selectFrom('subscribers')
      .selectAll()
      .where(key, '=', value)
      .executeTakeFirst()

    if (existingSubscriber) {
      instance.mapCustomGetters(existingSubscriber)
      await instance.loadRelations(existingSubscriber)

      return new SubscriberModel(existingSubscriber as SubscriberType)
    }
    else {
      return await instance.create(newSubscriber)
    }
  }

  static async updateOrCreate(
    condition: Partial<SubscriberType>,
    newSubscriber: NewSubscriber,
  ): Promise<SubscriberModel> {
    const instance = new SubscriberModel(null)

    const key = Object.keys(condition)[0] as keyof SubscriberType

    if (!key) {
      throw new HttpError(500, 'Condition must contain at least one key-value pair')
    }

    const value = condition[key]

    // Attempt to find the first record matching the condition
    const existingSubscriber = await DB.instance.selectFrom('subscribers')
      .selectAll()
      .where(key, '=', value)
      .executeTakeFirst()

    if (existingSubscriber) {
      // If found, update the existing record
      await DB.instance.updateTable('subscribers')
        .set(newSubscriber)
        .where(key, '=', value)
        .executeTakeFirstOrThrow()

      // Fetch and return the updated record
      const updatedSubscriber = await DB.instance.selectFrom('subscribers')
        .selectAll()
        .where(key, '=', value)
        .executeTakeFirst()

      if (!updatedSubscriber) {
        throw new HttpError(500, 'Failed to fetch updated record')
      }

      instance.hasSaved = true

      return new SubscriberModel(updatedSubscriber as SubscriberType)
    }
    else {
      // If not found, create a new record
      return await instance.create(newSubscriber)
    }
  }

  async loadRelations(models: SubscriberJsonResponse | SubscriberJsonResponse[]): Promise<void> {
    // Handle both single model and array of models
    const modelArray = Array.isArray(models) ? models : [models]
    if (!modelArray.length)
      return

    const modelIds = modelArray.map(model => model.id)

    for (const relation of this.withRelations) {
      const relatedRecords = await DB.instance
        .selectFrom(relation)
        .where('subscriber_id', 'in', modelIds)
        .selectAll()
        .execute()

      if (Array.isArray(models)) {
        models.map((model: SubscriberJsonResponse) => {
          const records = relatedRecords.filter((record: { subscriber_id: number }) => {
            return record.subscriber_id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      }
      else {
        const records = relatedRecords.filter((record: { subscriber_id: number }) => {
          return record.subscriber_id === models.id
        })

        models[relation] = records.length === 1 ? records[0] : records
      }
    }
  }

  with(relations: string[]): SubscriberModel {
    this.withRelations = relations

    return this
  }

  static with(relations: string[]): SubscriberModel {
    const instance = new SubscriberModel(null)

    instance.withRelations = relations

    return instance
  }

  async last(): Promise<SubscriberType | undefined> {
    let model: SubscriberModel | undefined

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

    const data = new SubscriberModel(model as SubscriberType)

    return data
  }

  static async last(): Promise<SubscriberType | undefined> {
    const model = await DB.instance.selectFrom('subscribers').selectAll().orderBy('id', 'desc').executeTakeFirst()

    if (!model)
      return undefined

    const data = new SubscriberModel(model as SubscriberType)

    return data
  }

  orderBy(column: keyof SubscribersTable, order: 'asc' | 'desc'): SubscriberModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, order)

    return this
  }

  static orderBy(column: keyof SubscribersTable, order: 'asc' | 'desc'): SubscriberModel {
    const instance = new SubscriberModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, order)

    return instance
  }

  groupBy(column: keyof SubscribersTable): SubscriberModel {
    this.selectFromQuery = this.selectFromQuery.groupBy(column)

    return this
  }

  static groupBy(column: keyof SubscribersTable): SubscriberModel {
    const instance = new SubscriberModel(null)

    instance.selectFromQuery = instance.selectFromQuery.groupBy(column)

    return instance
  }

  having(column: keyof SubscriberType, operator: string, value: any): SubscriberModel {
    this.selectFromQuery = this.selectFromQuery.having(column, operator, value)

    return this
  }

  static having(column: keyof SubscriberType, operator: string, value: any): SubscriberModel {
    const instance = new SubscriberModel(null)

    instance.selectFromQuery = instance.selectFromQuery.having(column, operator, value)

    return instance
  }

  inRandomOrder(): SubscriberModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(sql` ${sql.raw('RANDOM()')} `)

    return this
  }

  static inRandomOrder(): SubscriberModel {
    const instance = new SubscriberModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(sql` ${sql.raw('RANDOM()')} `)

    return instance
  }

  orderByDesc(column: keyof SubscriberType): SubscriberModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, 'desc')

    return this
  }

  static orderByDesc(column: keyof SubscriberType): SubscriberModel {
    const instance = new SubscriberModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'desc')

    return instance
  }

  orderByAsc(column: keyof SubscriberType): SubscriberModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, 'asc')

    return this
  }

  static orderByAsc(column: keyof SubscriberType): SubscriberModel {
    const instance = new SubscriberModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'asc')

    return instance
  }

  async update(newSubscriber: SubscriberUpdate): Promise<SubscriberModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newSubscriber).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewSubscriber

    await this.mapCustomSetters(filteredValues)

    await DB.instance.updateTable('subscribers')
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

  async forceUpdate(subscriber: SubscriberUpdate): Promise<SubscriberModel | undefined> {
    if (this.id === undefined) {
      this.updateFromQuery.set(subscriber).execute()
    }

    await this.mapCustomSetters(subscriber)

    await DB.instance.updateTable('subscribers')
      .set(subscriber)
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
      throw new HttpError(500, 'Subscriber data is undefined')

    await this.mapCustomSetters(this.attributes)

    if (this.id === undefined) {
      await this.create(this.attributes)
    }
    else {
      await this.update(this.attributes)
    }

    this.hasSaved = true
  }

  fill(data: Partial<SubscriberType>): SubscriberModel {
    const filteredValues = Object.fromEntries(
      Object.entries(data).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewSubscriber

    this.attributes = {
      ...this.attributes,
      ...filteredValues,
    }

    return this
  }

  forceFill(data: Partial<SubscriberType>): SubscriberModel {
    this.attributes = {
      ...this.attributes,
      ...data,
    }

    return this
  }

  // Method to delete (soft delete) the subscriber instance
  async delete(): Promise<any> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()

    return await DB.instance.deleteFrom('subscribers')
      .where('id', '=', this.id)
      .execute()
  }

  distinct(column: keyof SubscriberType): SubscriberModel {
    this.selectFromQuery = this.selectFromQuery.select(column).distinct()

    this.hasSelect = true

    return this
  }

  static distinct(column: keyof SubscriberType): SubscriberModel {
    const instance = new SubscriberModel(null)

    instance.selectFromQuery = instance.selectFromQuery.select(column).distinct()

    instance.hasSelect = true

    return instance
  }

  join(table: string, firstCol: string, secondCol: string): SubscriberModel {
    this.selectFromQuery = this.selectFromQuery.innerJoin(table, firstCol, secondCol)

    return this
  }

  static join(table: string, firstCol: string, secondCol: string): SubscriberModel {
    const instance = new SubscriberModel(null)

    instance.selectFromQuery = instance.selectFromQuery.innerJoin(table, firstCol, secondCol)

    return instance
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
  const query = DB.instance.selectFrom('subscribers').where('id', '=', id).selectAll()

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
  const result = await DB.instance.insertInto('subscribers')
    .values(newSubscriber)
    .executeTakeFirstOrThrow()

  return await find(Number(result.numInsertedOrUpdatedRows)) as SubscriberModel
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(DB.instance)
}

export async function remove(id: number): Promise<void> {
  await DB.instance.deleteFrom('subscribers')
    .where('id', '=', id)
    .execute()
}

export async function whereSubscribed(value: boolean): Promise<SubscriberModel[]> {
  const query = DB.instance.selectFrom('subscribers').where('subscribed', '=', value)
  const results = await query.execute()

  return results.map((modelItem: SubscriberModel) => new SubscriberModel(modelItem))
}

export const Subscriber = SubscriberModel

export default Subscriber
