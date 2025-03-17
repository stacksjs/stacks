import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import { cache } from '@stacksjs/cache'
import { sql } from '@stacksjs/database'
import { ModelNotFoundException } from '@stacksjs/error-handling'
import { BaseOrm, DB, SubqueryBuilder } from '@stacksjs/orm'

export interface SubscribersTable {
  id: Generated<number>
  subscribed: boolean

  created_at?: Date

  updated_at?: Date

}

export interface SubscriberResponse {
  data: SubscriberJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface SubscriberJsonResponse extends Omit<Selectable<SubscribersTable>, 'password'> {
  [key: string]: any
}

export type NewSubscriber = Insertable<SubscribersTable>
export type SubscriberUpdate = Updateable<SubscribersTable>

      type SortDirection = 'asc' | 'desc'
interface SortOptions { column: SubscriberJsonResponse, order: SortDirection }
// Define a type for the options parameter
interface QueryOptions {
  sort?: SortOptions
  limit?: number
  offset?: number
  page?: number
}

export class SubscriberModel extends BaseOrm<SubscriberModel, SubscribersTable, SubscriberJsonResponse> {
  private readonly hidden: Array<keyof SubscriberJsonResponse> = []
  private readonly fillable: Array<keyof SubscriberJsonResponse> = ['subscribed', 'uuid', 'user_id']
  private readonly guarded: Array<keyof SubscriberJsonResponse> = []
  protected attributes = {} as SubscriberJsonResponse
  protected originalAttributes = {} as SubscriberJsonResponse

  protected selectFromQuery: any
  protected updateFromQuery: any
  protected deleteFromQuery: any
  protected hasSelect: boolean
  private hasSaved: boolean
  private customColumns: Record<string, unknown> = {}

  constructor(subscriber: SubscriberJsonResponse | undefined) {
    super('subscribers')
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

  protected mapCustomGetters(models: SubscriberJsonResponse | SubscriberJsonResponse[]): void {
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

  async mapCustomSetters(model: NewSubscriber | SubscriberUpdate): Promise<void> {
    const customSetter = {
      default: () => {
      },

    }

    for (const [key, fn] of Object.entries(customSetter)) {
      model[key] = await fn()
    }
  }

  get id(): number {
    return this.attributes.id
  }

  get subscribed(): boolean {
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

  isDirty(column?: keyof SubscriberJsonResponse): boolean {
    if (column) {
      return this.attributes[column] !== this.originalAttributes[column]
    }

    return Object.entries(this.originalAttributes).some(([key, originalValue]) => {
      const currentValue = (this.attributes as any)[key]

      return currentValue !== originalValue
    })
  }

  isClean(column?: keyof SubscriberJsonResponse): boolean {
    return !this.isDirty(column)
  }

  wasChanged(column?: keyof SubscriberJsonResponse): boolean {
    return this.hasSaved && this.isDirty(column)
  }

  static select(params: (keyof SubscriberJsonResponse)[] | RawBuilder<string> | string): SubscriberModel {
    const instance = new SubscriberModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a Subscriber by ID
  static async find(id: number): Promise<SubscriberModel | undefined> {
    const instance = new SubscriberModel(undefined)

    return await instance.applyFind(id)
  }

  async first(): Promise<SubscriberModel | undefined> {
    const model = await this.applyFirst()

    const data = new SubscriberModel(model)

    return data
  }

  static async first(): Promise<SubscriberModel | undefined> {
    const instance = new SubscriberModel(undefined)

    const model = await instance.applyFirst()

    const data = new SubscriberModel(model)

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

    const data = new SubscriberModel(model)

    return data
  }

  async firstOrFail(): Promise<SubscriberModel | undefined> {
    return await this.applyFirstOrFail()
  }

  static async firstOrFail(): Promise<SubscriberModel | undefined> {
    const instance = new SubscriberModel(undefined)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<SubscriberModel[]> {
    const instance = new SubscriberModel(undefined)

    const models = await DB.instance.selectFrom('subscribers').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: SubscriberJsonResponse) => {
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

    const data = new SubscriberModel(model)

    return data
  }

  async findOrFail(id: number): Promise<SubscriberModel> {
    return await this.applyFindOrFail(id)
  }

  static async findOrFail(id: number): Promise<SubscriberModel> {
    const instance = new SubscriberModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<SubscriberModel[]> {
    const instance = new SubscriberModel(undefined)

    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: UserJsonResponse) => instance.parseResult(new SubscriberModel(modelItem)))
  }

  async findMany(ids: number[]): Promise<SubscriberModel[]> {
    const models = await this.applyFindMany(ids)

    return models.map((modelItem: UserJsonResponse) => this.parseResult(new SubscriberModel(modelItem)))
  }

  skip(count: number): SubscriberModel {
    this.selectFromQuery = this.selectFromQuery.offset(count)

    return this
  }

  static skip(count: number): SubscriberModel {
    const instance = new SubscriberModel(undefined)

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
    const instance = new SubscriberModel(undefined)

    await instance.applyChunk(size, callback)
  }

  static take(count: number): SubscriberModel {
    const instance = new SubscriberModel(undefined)

    return instance.applyTake(count)
  }

  static async pluck<K extends keyof SubscriberModel>(field: K): Promise<SubscriberModel[K][]> {
    const instance = new SubscriberModel(undefined)

    if (instance.hasSelect) {
      const model = await instance.selectFromQuery.execute()
      return model.map((modelItem: SubscriberModel) => modelItem[field])
    }

    const model = await instance.selectFromQuery.selectAll().execute()

    return model.map((modelItem: SubscriberModel) => modelItem[field])
  }

  async pluck<K extends keyof SubscriberModel>(field: K): Promise<SubscriberModel[K][]> {
    if (this.hasSelect) {
      const model = await this.selectFromQuery.execute()
      return model.map((modelItem: SubscriberModel) => modelItem[field])
    }

    const model = await this.selectFromQuery.selectAll().execute()

    return model.map((modelItem: SubscriberModel) => modelItem[field])
  }

  static async count(): Promise<number> {
    const instance = new SubscriberModel(undefined)

    return instance.applyCount()
  }

  static async max(field: keyof SubscriberModel): Promise<number> {
    const instance = new SubscriberModel(undefined)

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
    const instance = new SubscriberModel(undefined)

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
    const instance = new SubscriberModel(undefined)

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
    const instance = new SubscriberModel(undefined)

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

    const data = await Promise.all(models.map(async (model: SubscriberJsonResponse) => {
      return new SubscriberModel(model)
    }))

    return data
  }

  async get(): Promise<SubscriberModel[]> {
    return await this.applyGet()
  }

  static async get(): Promise<SubscriberModel[]> {
    const instance = new SubscriberModel(undefined)

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
    const instance = new SubscriberModel(undefined)

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
    const instance = new SubscriberModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(callback({ exists, selectFrom })),
    )

    return instance
  }

  applyWhereHas(
    relation: string,
    callback: (query: SubqueryBuilder<keyof SubscriberModel>) => void,
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
              if (condition.operator === 'is not') {
                subquery = subquery.whereNotIn(condition.column, condition.values)
              }
              else {
                subquery = subquery.whereIn(condition.column, condition.values)
              }

              break

            case 'whereNull':
              subquery = subquery.whereNull(condition.column)
              break

            case 'whereNotNull':
              subquery = subquery.whereNotNull(condition.column)
              break

            case 'whereBetween':
              subquery = subquery.whereBetween(condition.column, condition.values)
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
    callback: (query: SubqueryBuilder<keyof SubscriberModel>) => void,
  ): SubscriberModel {
    return this.applyWhereHas(relation, callback)
  }

  static whereHas(
    relation: string,
    callback: (query: SubqueryBuilder<keyof SubscriberModel>) => void,
  ): SubscriberModel {
    const instance = new SubscriberModel(undefined)

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
    const instance = new SubscriberModel(undefined)

    return instance.applyDoesntHave(relation)
  }

  applyWhereDoesntHave(relation: string, callback: (query: SubqueryBuilder<SubscribersTable>) => void): SubscriberModel {
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
            this.where(condition.column, condition.operator!, condition.value || [])
          }
          break

        case 'whereIn':
          if (condition.operator === 'is not') {
            this.whereNotIn(condition.column, condition.values || [])
          }
          else {
            this.whereIn(condition.column, condition.values || [])
          }

          break

        case 'whereNull':
          this.whereNull(condition.column)
          break

        case 'whereNotNull':
          this.whereNotNull(condition.column)
          break

        case 'whereBetween':
          this.whereBetween(condition.column, condition.range || [0, 0])
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

  whereDoesntHave(relation: string, callback: (query: SubqueryBuilder<SubscribersTable>) => void): SubscriberModel {
    return this.applyWhereDoesntHave(relation, callback)
  }

  static whereDoesntHave(
    relation: string,
    callback: (query: SubqueryBuilder<SubscribersTable>) => void,
  ): SubscriberModel {
    const instance = new SubscriberModel(undefined)

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
    const instance = new SubscriberModel(undefined)

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
    const instance = new SubscriberModel(undefined)

    return await instance.applyCreate(newSubscriber)
  }

  static async createMany(newSubscriber: NewSubscriber[]): Promise<void> {
    const instance = new SubscriberModel(undefined)

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
  async delete(): Promise<SubscribersTable> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()

    return await DB.instance.deleteFrom('subscribers')
      .where('id', '=', this.id)
      .execute()
  }

  distinct(column: keyof SubscriberJsonResponse): SubscriberModel {
    return this.applyDistinct(column)
  }

  static distinct(column: keyof SubscriberJsonResponse): SubscriberModel {
    const instance = new SubscriberModel(undefined)

    return instance.applyDistinct(column)
  }

  join(table: string, firstCol: string, secondCol: string): SubscriberModel {
    return this.applyJoin(table, firstCol, secondCol)
  }

  static join(table: string, firstCol: string, secondCol: string): SubscriberModel {
    const instance = new SubscriberModel(undefined)

    return instance.applyJoin(table, firstCol, secondCol)
  }

  toJSON(): SubscriberJsonResponse {
    const output = {

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
  const results: SubscriberJsonResponse = await query.execute()

  return results.map((modelItem: SubscriberJsonResponse) => new SubscriberModel(modelItem))
}

export const Subscriber = SubscriberModel

export default Subscriber
