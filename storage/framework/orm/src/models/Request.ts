import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import { cache } from '@stacksjs/cache'
import { sql } from '@stacksjs/database'
import { HttpError, ModelNotFoundException } from '@stacksjs/error-handling'
import { BaseOrm, DB, SubqueryBuilder } from '@stacksjs/orm'

export interface RequestsTable {
  id: Generated<number>
  method?: string | string[]
  path?: string
  status_code?: number
  duration_ms?: number
  ip_address?: string
  memory_usage?: number
  user_agent?: string
  error_message?: string

  created_at?: Date

  updated_at?: Date

  deleted_at?: Date

}

export interface RequestResponse {
  data: RequestJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface RequestJsonResponse extends Omit<Selectable<RequestsTable>, 'password'> {
  [key: string]: any
}

export type NewRequest = Insertable<RequestsTable>
export type RequestUpdate = Updateable<RequestsTable>

      type SortDirection = 'asc' | 'desc'
interface SortOptions { column: RequestJsonResponse, order: SortDirection }
// Define a type for the options parameter
interface QueryOptions {
  sort?: SortOptions
  limit?: number
  offset?: number
  page?: number
}

export class RequestModel extends BaseOrm<RequestModel, RequestsTable> {
  private readonly hidden: Array<keyof RequestJsonResponse> = []
  private readonly fillable: Array<keyof RequestJsonResponse> = ['method', 'path', 'status_code', 'duration_ms', 'ip_address', 'memory_usage', 'user_agent', 'error_message', 'uuid']
  private readonly guarded: Array<keyof RequestJsonResponse> = []
  protected attributes = {} as RequestJsonResponse
  protected originalAttributes = {} as RequestJsonResponse
  private softDeletes = false
  protected selectFromQuery: any
  protected withRelations: string[]
  protected updateFromQuery: any
  protected deleteFromQuery: any
  protected hasSelect: boolean
  private hasSaved: boolean
  private customColumns: Record<string, unknown> = {}

  constructor(request: RequestJsonResponse | undefined) {
    super('requests')
    if (request) {
      this.attributes = { ...request }
      this.originalAttributes = { ...request }

      Object.keys(request).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (request as RequestJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = DB.instance.selectFrom('requests')
    this.updateFromQuery = DB.instance.updateTable('requests')
    this.deleteFromQuery = DB.instance.deleteFrom('requests')
    this.hasSelect = false
    this.hasSaved = false
  }

  protected mapCustomGetters(models: RequestJsonResponse | RequestJsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: RequestJsonResponse) => {
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

  async mapCustomSetters(model: NewRequest | RequestUpdate): Promise<void> {
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

  get method(): string | string[] | undefined {
    return this.attributes.method
  }

  get path(): string | undefined {
    return this.attributes.path
  }

  get status_code(): number | undefined {
    return this.attributes.status_code
  }

  get duration_ms(): number | undefined {
    return this.attributes.duration_ms
  }

  get ip_address(): string | undefined {
    return this.attributes.ip_address
  }

  get memory_usage(): number | undefined {
    return this.attributes.memory_usage
  }

  get user_agent(): string | undefined {
    return this.attributes.user_agent
  }

  get error_message(): string | undefined {
    return this.attributes.error_message
  }

  get created_at(): Date | undefined {
    return this.attributes.created_at
  }

  get updated_at(): Date | undefined {
    return this.attributes.updated_at
  }

  get deleted_at(): Date | undefined {
    return this.attributes.deleted_at
  }

  set method(value: string | string[]) {
    this.attributes.method = value
  }

  set path(value: string) {
    this.attributes.path = value
  }

  set status_code(value: number) {
    this.attributes.status_code = value
  }

  set duration_ms(value: number) {
    this.attributes.duration_ms = value
  }

  set ip_address(value: string) {
    this.attributes.ip_address = value
  }

  set memory_usage(value: number) {
    this.attributes.memory_usage = value
  }

  set user_agent(value: string) {
    this.attributes.user_agent = value
  }

  set error_message(value: string) {
    this.attributes.error_message = value
  }

  set updated_at(value: Date) {
    this.attributes.updated_at = value
  }

  set deleted_at(value: Date) {
    this.attributes.deleted_at = value
  }

  getOriginal(column?: keyof RequestJsonResponse): Partial<RequestJsonResponse> {
    if (column) {
      return this.originalAttributes[column]
    }

    return this.originalAttributes
  }

  getChanges(): Partial<RequestJsonResponse> {
    return this.fillable.reduce<Partial<RequestJsonResponse>>((changes, key) => {
      const currentValue = this.attributes[key as keyof RequestsTable]
      const originalValue = this.originalAttributes[key as keyof RequestsTable]

      if (currentValue !== originalValue) {
        changes[key] = currentValue
      }

      return changes
    }, {})
  }

  isDirty(column?: keyof RequestJsonResponse): boolean {
    if (column) {
      return this.attributes[column] !== this.originalAttributes[column]
    }

    return Object.entries(this.originalAttributes).some(([key, originalValue]) => {
      const currentValue = (this.attributes as any)[key]

      return currentValue !== originalValue
    })
  }

  isClean(column?: keyof RequestJsonResponse): boolean {
    return !this.isDirty(column)
  }

  wasChanged(column?: keyof RequestJsonResponse): boolean {
    return this.hasSaved && this.isDirty(column)
  }

  select(params: (keyof RequestJsonResponse)[] | RawBuilder<string> | string): RequestModel {
    this.selectFromQuery = this.selectFromQuery.select(params)

    this.hasSelect = true

    return this
  }

  static select(params: (keyof RequestJsonResponse)[] | RawBuilder<string> | string): RequestModel {
    const instance = new RequestModel(undefined)

    // Initialize a query with the table name and selected fields
    instance.selectFromQuery = instance.selectFromQuery.select(params)

    instance.hasSelect = true

    return instance
  }

  // Method to find a Request by ID
  static async find(id: number): Promise<RequestModel | undefined> {
    const instance = new RequestModel(undefined)

    return await instance.applyFind(id)
  }

  async first(): Promise<RequestModel | undefined> {
    const model = await this.applyFirst()

    const data = new RequestModel(model)

    return data
  }

  static async first(): Promise<RequestModel | undefined> {
    const instance = new RequestModel(undefined)

    const model = await instance.applyFirst()

    const data = new RequestModel(model)

    return data
  }

  async applyFirstOrFail(): Promise<RequestModel | undefined> {
    const model = await this.selectFromQuery.executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, 'No RequestModel results found for query')

    if (model) {
      this.mapCustomGetters(model)
      await this.loadRelations(model)
    }

    const data = new RequestModel(model)

    return data
  }

  async firstOrFail(): Promise<RequestModel | undefined> {
    return await this.applyFirstOrFail()
  }

  static async firstOrFail(): Promise<RequestModel | undefined> {
    const instance = new RequestModel(undefined)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<RequestModel[]> {
    const instance = new RequestModel(undefined)

    const models = await DB.instance.selectFrom('requests').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: RequestJsonResponse) => {
      return new RequestModel(model)
    }))

    return data
  }

  async applyFindOrFail(id: number): Promise<RequestModel> {
    const model = await DB.instance.selectFrom('requests').where('id', '=', id).selectAll().executeTakeFirst()

    if (instance.softDeletes) {
      instance.selectFromQuery = instance.selectFromQuery.where('deleted_at', 'is', null)
    }

    if (model === undefined)
      throw new ModelNotFoundException(404, `No RequestModel results for ${id}`)

    cache.getOrSet(`request:${id}`, JSON.stringify(model))

    this.mapCustomGetters(model)
    await this.loadRelations(model)

    const data = new RequestModel(model)

    return data
  }

  async findOrFail(id: number): Promise<RequestModel> {
    return await this.applyFindOrFail(id)
  }

  static async findOrFail(id: number): Promise<RequestModel> {
    const instance = new RequestModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  async applyFindMany(ids: number[]): Promise<RequestModel[]> {
    let query = DB.instance.selectFrom('requests').where('id', 'in', ids)

    const instance = new RequestModel(undefined)

    if (instance.softDeletes) {
      query = query.where('deleted_at', 'is', null)
    }

    query = query.selectAll()

    const models = await query.execute()

    instance.mapCustomGetters(models)
    await instance.loadRelations(models)

    return models.map((modelItem: RequestJsonResponse) => instance.parseResult(new RequestModel(modelItem)))
  }

  static async findMany(ids: number[]): Promise<RequestModel[]> {
    const instance = new RequestModel(undefined)

    return await instance.applyFindMany(ids)
  }

  async findMany(ids: number[]): Promise<RequestModel[]> {
    return await this.applyFindMany(ids)
  }

  skip(count: number): RequestModel {
    this.selectFromQuery = this.selectFromQuery.offset(count)

    return this
  }

  static skip(count: number): RequestModel {
    const instance = new RequestModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.offset(count)

    return instance
  }

  async applyChunk(size: number, callback: (models: RequestModel[]) => Promise<void>): Promise<void> {
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

  async chunk(size: number, callback: (models: RequestModel[]) => Promise<void>): Promise<void> {
    await this.applyChunk(size, callback)
  }

  static async chunk(size: number, callback: (models: RequestModel[]) => Promise<void>): Promise<void> {
    const instance = new RequestModel(undefined)

    await instance.applyChunk(size, callback)
  }

  take(count: number): RequestModel {
    this.selectFromQuery = this.selectFromQuery.limit(count)

    return this
  }

  static take(count: number): RequestModel {
    const instance = new RequestModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.limit(count)

    return instance
  }

  static async pluck<K extends keyof RequestModel>(field: K): Promise<RequestModel[K][]> {
    const instance = new RequestModel(undefined)

    if (instance.hasSelect) {
      const model = await instance.selectFromQuery.execute()
      return model.map((modelItem: RequestModel) => modelItem[field])
    }

    const model = await instance.selectFromQuery.selectAll().execute()

    return model.map((modelItem: RequestModel) => modelItem[field])
  }

  async pluck<K extends keyof RequestModel>(field: K): Promise<RequestModel[K][]> {
    if (this.hasSelect) {
      const model = await this.selectFromQuery.execute()
      return model.map((modelItem: RequestModel) => modelItem[field])
    }

    const model = await this.selectFromQuery.selectAll().execute()

    return model.map((modelItem: RequestModel) => modelItem[field])
  }

  static async count(): Promise<number> {
    const instance = new RequestModel(undefined)

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

  static async max(field: keyof RequestModel): Promise<number> {
    const instance = new RequestModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`MAX(${sql.raw(field as string)}) as max `)
      .executeTakeFirst()

    return result.max
  }

  async max(field: keyof RequestModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`MAX(${sql.raw(field as string)}) as max`)
      .executeTakeFirst()

    return result.max
  }

  static async min(field: keyof RequestModel): Promise<number> {
    const instance = new RequestModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`MIN(${sql.raw(field as string)}) as min `)
      .executeTakeFirst()

    return result.min
  }

  async min(field: keyof RequestModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`MIN(${sql.raw(field as string)}) as min `)
      .executeTakeFirst()

    return result.min
  }

  static async avg(field: keyof RequestModel): Promise<number> {
    const instance = new RequestModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`AVG(${sql.raw(field as string)}) as avg `)
      .executeTakeFirst()

    return result.avg
  }

  async avg(field: keyof RequestModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`AVG(${sql.raw(field as string)}) as avg `)
      .executeTakeFirst()

    return result.avg
  }

  static async sum(field: keyof RequestModel): Promise<number> {
    const instance = new RequestModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`SUM(${sql.raw(field as string)}) as sum `)
      .executeTakeFirst()

    return result.sum
  }

  async sum(field: keyof RequestModel): Promise<number> {
    const result = this.selectFromQuery
      .select(sql`SUM(${sql.raw(field as string)}) as sum `)
      .executeTakeFirst()

    return result.sum
  }

  async applyGet(): Promise<RequestModel[]> {
    let models

    if (this.hasSelect) {
      models = await this.selectFromQuery.execute()
    }
    else {
      models = await this.selectFromQuery.selectAll().execute()
    }

    this.mapCustomGetters(models)
    await this.loadRelations(models)

    const data = await Promise.all(models.map(async (model: RequestJsonResponse) => {
      return new RequestModel(model)
    }))

    return data
  }

  async get(): Promise<RequestModel[]> {
    return await this.applyGet()
  }

  static async get(): Promise<RequestModel[]> {
    const instance = new RequestModel(undefined)

    return await instance.applyGet()
  }

  has(relation: string): RequestModel {
    this.selectFromQuery = this.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(
        selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.request_id`, '=', 'requests.id'),
      ),
    )

    return this
  }

  static has(relation: string): RequestModel {
    const instance = new RequestModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(
        selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.request_id`, '=', 'requests.id'),
      ),
    )

    return instance
  }

  static whereExists(callback: (qb: any) => any): RequestModel {
    const instance = new RequestModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(callback({ exists, selectFrom })),
    )

    return instance
  }

  applyWhereHas(
    relation: string,
    callback: (query: SubqueryBuilder<keyof RequestModel>) => void,
  ): RequestModel {
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    this.selectFromQuery = this.selectFromQuery
      .where(({ exists, selectFrom }: any) => {
        let subquery = selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.request_id`, '=', 'requests.id')

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
    callback: (query: SubqueryBuilder<keyof RequestModel>) => void,
  ): RequestModel {
    return this.applyWhereHas(relation, callback)
  }

  static whereHas(
    relation: string,
    callback: (query: SubqueryBuilder<keyof RequestModel>) => void,
  ): RequestModel {
    const instance = new RequestModel(undefined)

    return instance.applyWhereHas(relation, callback)
  }

  applyDoesntHave(relation: string): RequestModel {
    this.selectFromQuery = this.selectFromQuery.where(({ not, exists, selectFrom }: any) =>
      not(
        exists(
          selectFrom(relation)
            .select('1')
            .whereRef(`${relation}.request_id`, '=', 'requests.id'),
        ),
      ),
    )

    return this
  }

  doesntHave(relation: string): RequestModel {
    return this.applyDoesntHave(relation)
  }

  static doesntHave(relation: string): RequestModel {
    const instance = new RequestModel(undefined)

    return instance.applyDoesntHave(relation)
  }

  applyWhereDoesntHave(relation: string, callback: (query: SubqueryBuilder<RequestsTable>) => void): RequestModel {
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    this.selectFromQuery = this.selectFromQuery
      .where(({ exists, selectFrom, not }: any) => {
        const subquery = selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.request_id`, '=', 'requests.id')

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

  whereDoesntHave(relation: string, callback: (query: SubqueryBuilder<RequestsTable>) => void): RequestModel {
    return this.applyWhereDoesntHave(relation, callback)
  }

  static whereDoesntHave(
    relation: string,
    callback: (query: SubqueryBuilder<RequestsTable>) => void,
  ): RequestModel {
    const instance = new RequestModel(undefined)

    return instance.applyWhereDoesntHave(relation, callback)
  }

  async applyPaginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<RequestResponse> {
    const totalRecordsResult = await DB.instance.selectFrom('requests')
      .select(DB.instance.fn.count('id').as('total')) // Use 'id' or another actual column name
      .executeTakeFirst()

    const totalRecords = Number(totalRecordsResult?.total) || 0
    const totalPages = Math.ceil(totalRecords / (options.limit ?? 10))

    const requestsWithExtra = await DB.instance.selectFrom('requests')
      .selectAll()
      .orderBy('id', 'asc') // Assuming 'id' is used for cursor-based pagination
      .limit((options.limit ?? 10) + 1) // Fetch one extra record
      .offset(((options.page ?? 1) - 1) * (options.limit ?? 10)) // Ensure options.page is not undefined
      .execute()

    let nextCursor = null
    if (requestsWithExtra.length > (options.limit ?? 10))
      nextCursor = requestsWithExtra.pop()?.id ?? null

    return {
      data: requestsWithExtra,
      paging: {
        total_records: totalRecords,
        page: options.page || 1,
        total_pages: totalPages,
      },
      next_cursor: nextCursor,
    }
  }

  async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<RequestResponse> {
    return await this.applyPaginate(options)
  }

  // Method to get all requests
  static async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<RequestResponse> {
    const instance = new RequestModel(undefined)

    return await instance.applyPaginate(options)
  }

  async applyCreate(newRequest: NewRequest): Promise<RequestModel> {
    const filteredValues = Object.fromEntries(
      Object.entries(newRequest).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewRequest

    await this.mapCustomSetters(filteredValues)

    const result = await DB.instance.insertInto('requests')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await this.find(Number(result.numInsertedOrUpdatedRows)) as RequestModel

    return model
  }

  async create(newRequest: NewRequest): Promise<RequestModel> {
    return await this.applyCreate(newRequest)
  }

  static async create(newRequest: NewRequest): Promise<RequestModel> {
    const instance = new RequestModel(undefined)

    return await instance.applyCreate(newRequest)
  }

  static async createMany(newRequest: NewRequest[]): Promise<void> {
    const instance = new RequestModel(undefined)

    const valuesFiltered = newRequest.map((newRequest: NewRequest) => {
      const filteredValues = Object.fromEntries(
        Object.entries(newRequest).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewRequest

      return filteredValues
    })

    await DB.instance.insertInto('requests')
      .values(valuesFiltered)
      .executeTakeFirst()
  }

  static async forceCreate(newRequest: NewRequest): Promise<RequestModel> {
    const result = await DB.instance.insertInto('requests')
      .values(newRequest)
      .executeTakeFirst()

    const model = await find(Number(result.numInsertedOrUpdatedRows)) as RequestModel

    return model
  }

  // Method to remove a Request
  static async remove(id: number): Promise<any> {
    const instance = new RequestModel(undefined)

    if (instance.softDeletes) {
      return await DB.instance.updateTable('requests')
        .set({
          deleted_at: sql.raw('CURRENT_TIMESTAMP'),
        })
        .where('id', '=', id)
        .execute()
    }

    return await DB.instance.deleteFrom('requests')
      .where('id', '=', id)
      .execute()
  }

  static where<V = string>(column: keyof RequestsTable, ...args: [V] | [Operator, V]): RequestModel {
    const instance = new RequestModel(undefined)

    return instance.applyWhere<V>(column, ...args)
  }

  static whereColumn(first: keyof RequestsTable, operator: Operator, second: keyof RequestsTable): RequestModel {
    const instance = new RequestModel(undefined)

    instance.selectFromQuery = instance.applyWhereColumn(first, operator, second)

    return instance
  }

  static whereRef(column: keyof RequestsTable, ...args: string[]): RequestModel {
    const instance = new RequestModel(undefined)

    return instance.applyWhereRef(column, ...args)
  }

  static whereRaw(sqlStatement: string): RequestModel {
    const instance = new RequestModel(undefined)

    instance.selectFromQuery = instance.applyWhereRaw(sqlStatement)

    return instance
  }

  applyOrWhere(...conditions: [string, any][]): RequestModel {
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

  orWhere(...conditions: [string, any][]): RequestModel {
    return this.applyOrWhere(...conditions)
  }

  static orWhere(...conditions: [string, any][]): RequestModel {
    const instance = new RequestModel(undefined)

    return instance.applyOrWhere(...conditions)
  }

  when(
    condition: boolean,
    callback: (query: RequestModel) => RequestModel,
  ): RequestModel {
    return RequestModel.when(condition, callback)
  }

  static when(
    condition: boolean,
    callback: (query: RequestModel) => RequestModel,
  ): RequestModel {
    let instance = new RequestModel(undefined)

    if (condition)
      instance = callback(instance)

    return instance
  }

  whereNotNull(column: keyof RequestsTable): RequestModel {
    this.selectFromQuery = this.selectFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is not', null),
    )

    this.updateFromQuery = this.updateFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is not', null),
    )

    this.deleteFromQuery = this.deleteFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is not', null),
    )

    return this
  }

  static whereNotNull(column: keyof RequestsTable): RequestModel {
    const instance = new RequestModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is not', null),
    )

    instance.updateFromQuery = instance.updateFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is not', null),
    )

    instance.deleteFromQuery = instance.deleteFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is not', null),
    )

    return instance
  }

  whereNull(column: keyof RequestsTable): RequestModel {
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

  static whereNull(column: keyof RequestsTable): RequestModel {
    const instance = new RequestModel(undefined)

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

  static whereMethod(value: string): RequestModel {
    const instance = new RequestModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('method', '=', value)

    return instance
  }

  static wherePath(value: string): RequestModel {
    const instance = new RequestModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('path', '=', value)

    return instance
  }

  static whereStatusCode(value: string): RequestModel {
    const instance = new RequestModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('status_code', '=', value)

    return instance
  }

  static whereDurationMs(value: string): RequestModel {
    const instance = new RequestModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('duration_ms', '=', value)

    return instance
  }

  static whereIpAddress(value: string): RequestModel {
    const instance = new RequestModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('ip_address', '=', value)

    return instance
  }

  static whereMemoryUsage(value: string): RequestModel {
    const instance = new RequestModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('memory_usage', '=', value)

    return instance
  }

  static whereUserAgent(value: string): RequestModel {
    const instance = new RequestModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('user_agent', '=', value)

    return instance
  }

  static whereErrorMessage(value: string): RequestModel {
    const instance = new RequestModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('error_message', '=', value)

    return instance
  }

  applyWhereIn<V>(column: keyof RequestsTable, values: V[]) {
    this.selectFromQuery = this.selectFromQuery.where(column, 'in', values)

    this.updateFromQuery = this.updateFromQuery.where(column, 'in', values)

    this.deleteFromQuery = this.deleteFromQuery.where(column, 'in', values)

    return this
  }

  whereIn<V = number>(column: keyof RequestsTable, values: V[]): RequestModel {
    return this.applyWhereIn<V>(column, values)
  }

  static whereIn<V = number>(column: keyof RequestsTable, values: V[]): RequestModel {
    const instance = new RequestModel(undefined)

    return instance.applyWhereIn<V>(column, values)
  }

  applyWhereBetween<V>(column: keyof RequestsTable, range: [V, V]): RequestModel {
    if (range.length !== 2) {
      throw new HttpError(500, 'Range must have exactly two values: [min, max]')
    }

    const query = sql` ${sql.raw(column as string)} between ${range[0]} and ${range[1]} `

    this.selectFromQuery = this.selectFromQuery.where(query)
    this.updateFromQuery = this.updateFromQuery.where(query)
    this.deleteFromQuery = this.deleteFromQuery.where(query)

    return this
  }

  whereBetween<V = number>(column: keyof RequestsTable, range: [V, V]): RequestModel {
    return this.applyWhereBetween<V>(column, range)
  }

  static whereBetween<V = number>(column: keyof RequestsTable, range: [V, V]): RequestModel {
    const instance = new RequestModel(undefined)

    return instance.applyWhereBetween<V>(column, range)
  }

  applyWhereLike(column: keyof RequestsTable, value: string): RequestModel {
    this.selectFromQuery = this.selectFromQuery.where(sql` ${sql.raw(column as string)} LIKE ${value}`)

    this.updateFromQuery = this.updateFromQuery.where(sql` ${sql.raw(column as string)} LIKE ${value}`)

    this.deleteFromQuery = this.deleteFromQuery.where(sql` ${sql.raw(column as string)} LIKE ${value}`)

    return this
  }

  whereLike(column: keyof RequestsTable, value: string): RequestModel {
    return this.applyWhereLike(column, value)
  }

  static whereLike(column: keyof RequestsTable, value: string): RequestModel {
    const instance = new RequestModel(undefined)

    return instance.applyWhereLike(column, value)
  }

  applyWhereNotIn<V>(column: keyof RequestsTable, values: V[]): RequestModel {
    this.selectFromQuery = this.selectFromQuery.where(column, 'not in', values)

    this.updateFromQuery = this.updateFromQuery.where(column, 'not in', values)

    this.deleteFromQuery = this.deleteFromQuery.where(column, 'not in', values)

    return this
  }

  whereNotIn<V>(column: keyof RequestsTable, values: V[]): RequestModel {
    return this.applyWhereNotIn<V>(column, values)
  }

  static whereNotIn<V = number>(column: keyof RequestsTable, values: V[]): RequestModel {
    const instance = new RequestModel(undefined)

    return instance.applyWhereNotIn<V>(column, values)
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

  static async latest(): Promise<RequestModel | undefined> {
    const instance = new RequestModel(undefined)

    const model = await DB.instance.selectFrom('requests')
      .selectAll()
      .orderBy('id', 'desc')
      .executeTakeFirst()

    if (!model)
      return undefined

    instance.mapCustomGetters(model)

    const data = new RequestModel(model)

    return data
  }

  static async oldest(): Promise<RequestModel | undefined> {
    const instance = new RequestModel(undefined)

    const model = await DB.instance.selectFrom('requests')
      .selectAll()
      .orderBy('id', 'asc')
      .executeTakeFirst()

    if (!model)
      return undefined

    instance.mapCustomGetters(model)

    const data = new RequestModel(model)

    return data
  }

  static async firstOrCreate(
    condition: Partial<RequestJsonResponse>,
    newRequest: NewRequest,
  ): Promise<RequestModel> {
    const instance = new RequestModel(undefined)

    const key = Object.keys(condition)[0] as keyof RequestJsonResponse

    if (!key) {
      throw new HttpError(500, 'Condition must contain at least one key-value pair')
    }

    const value = condition[key]

    // Attempt to find the first record matching the condition
    const existingRequest = await DB.instance.selectFrom('requests')
      .selectAll()
      .where(key, '=', value)
      .executeTakeFirst()

    if (existingRequest) {
      instance.mapCustomGetters(existingRequest)
      await instance.loadRelations(existingRequest)

      return new RequestModel(existingRequest as RequestJsonResponse)
    }
    else {
      return await instance.create(newRequest)
    }
  }

  static async updateOrCreate(
    condition: Partial<RequestJsonResponse>,
    newRequest: NewRequest,
  ): Promise<RequestModel> {
    const instance = new RequestModel(undefined)

    const key = Object.keys(condition)[0] as keyof RequestJsonResponse

    if (!key) {
      throw new HttpError(500, 'Condition must contain at least one key-value pair')
    }

    const value = condition[key]

    // Attempt to find the first record matching the condition
    const existingRequest = await DB.instance.selectFrom('requests')
      .selectAll()
      .where(key, '=', value)
      .executeTakeFirst()

    if (existingRequest) {
      // If found, update the existing record
      await DB.instance.updateTable('requests')
        .set(newRequest)
        .where(key, '=', value)
        .executeTakeFirstOrThrow()

      // Fetch and return the updated record
      const updatedRequest = await DB.instance.selectFrom('requests')
        .selectAll()
        .where(key, '=', value)
        .executeTakeFirst()

      if (!updatedRequest) {
        throw new HttpError(500, 'Failed to fetch updated record')
      }

      instance.hasSaved = true

      return new RequestModel(updatedRequest as RequestJsonResponse)
    }
    else {
      // If not found, create a new record
      return await instance.create(newRequest)
    }
  }

  protected async loadRelations(models: RequestJsonResponse | RequestJsonResponse[]): Promise<void> {
    // Handle both single model and array of models
    const modelArray = Array.isArray(models) ? models : [models]
    if (!modelArray.length)
      return

    const modelIds = modelArray.map(model => model.id)

    for (const relation of this.withRelations) {
      const relatedRecords = await DB.instance
        .selectFrom(relation)
        .where('request_id', 'in', modelIds)
        .selectAll()
        .execute()

      if (Array.isArray(models)) {
        models.map((model: RequestJsonResponse) => {
          const records = relatedRecords.filter((record: { request_id: number }) => {
            return record.request_id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      }
      else {
        const records = relatedRecords.filter((record: { request_id: number }) => {
          return record.request_id === models.id
        })

        models[relation] = records.length === 1 ? records[0] : records
      }
    }
  }

  with(relations: string[]): RequestModel {
    this.withRelations = relations

    return this
  }

  static with(relations: string[]): RequestModel {
    const instance = new RequestModel(undefined)

    instance.withRelations = relations

    return instance
  }

  async last(): Promise<RequestModel | undefined> {
    let model: RequestJsonResponse | undefined

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

    const data = new RequestModel(model)

    return data
  }

  static async last(): Promise<RequestModel | undefined> {
    const model = await DB.instance.selectFrom('requests').selectAll().orderBy('id', 'desc').executeTakeFirst()

    if (!model)
      return undefined

    const data = new RequestModel(model)

    return data
  }

  orderBy(column: keyof RequestsTable, order: 'asc' | 'desc'): RequestModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, order)

    return this
  }

  static orderBy(column: keyof RequestsTable, order: 'asc' | 'desc'): RequestModel {
    const instance = new RequestModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, order)

    return instance
  }

  groupBy(column: keyof RequestsTable): RequestModel {
    this.selectFromQuery = this.selectFromQuery.groupBy(column)

    return this
  }

  static groupBy(column: keyof RequestsTable): RequestModel {
    const instance = new RequestModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.groupBy(column)

    return instance
  }

  having<V = string>(column: keyof RequestsTable, operator: Operator, value: V): RequestModel {
    this.selectFromQuery = this.selectFromQuery.having(column, operator, value)

    return this
  }

  static having<V = string>(column: keyof RequestsTable, operator: Operator, value: V): RequestModel {
    const instance = new RequestModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.having(column, operator, value)

    return instance
  }

  inRandomOrder(): RequestModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(sql` ${sql.raw('RANDOM()')} `)

    return this
  }

  static inRandomOrder(): RequestModel {
    const instance = new RequestModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(sql` ${sql.raw('RANDOM()')} `)

    return instance
  }

  orderByDesc(column: keyof RequestsTable): RequestModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, 'desc')

    return this
  }

  static orderByDesc(column: keyof RequestsTable): RequestModel {
    const instance = new RequestModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'desc')

    return instance
  }

  orderByAsc(column: keyof RequestsTable): RequestModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, 'asc')

    return this
  }

  static orderByAsc(column: keyof RequestsTable): RequestModel {
    const instance = new RequestModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'asc')

    return instance
  }

  async update(newRequest: RequestUpdate): Promise<RequestModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newRequest).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewRequest

    await this.mapCustomSetters(filteredValues)

    await DB.instance.updateTable('requests')
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

  async forceUpdate(request: RequestUpdate): Promise<RequestModel | undefined> {
    if (this.id === undefined) {
      this.updateFromQuery.set(request).execute()
    }

    await this.mapCustomSetters(request)

    await DB.instance.updateTable('requests')
      .set(request)
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
      throw new HttpError(500, 'Request data is undefined')

    await this.mapCustomSetters(this.attributes)

    if (this.id === undefined) {
      await this.create(this.attributes)
    }
    else {
      await this.update(this.attributes)
    }

    this.hasSaved = true
  }

  fill(data: Partial<RequestJsonResponse>): RequestModel {
    const filteredValues = Object.fromEntries(
      Object.entries(data).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewRequest

    this.attributes = {
      ...this.attributes,
      ...filteredValues,
    }

    return this
  }

  forceFill(data: Partial<RequestJsonResponse>): RequestModel {
    this.attributes = {
      ...this.attributes,
      ...data,
    }

    return this
  }

  // Method to delete (soft delete) the request instance
  async delete(): Promise<RequestsTable> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()

    if (this.softDeletes) {
      return await DB.instance.updateTable('requests')
        .set({
          deleted_at: sql.raw('CURRENT_TIMESTAMP'),
        })
        .where('id', '=', this.id)
        .execute()
    }

    return await DB.instance.deleteFrom('requests')
      .where('id', '=', this.id)
      .execute()
  }

  distinct(column: keyof RequestJsonResponse): RequestModel {
    this.selectFromQuery = this.selectFromQuery.select(column).distinct()

    this.hasSelect = true

    return this
  }

  static distinct(column: keyof RequestJsonResponse): RequestModel {
    const instance = new RequestModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.select(column).distinct()

    instance.hasSelect = true

    return instance
  }

  join(table: string, firstCol: string, secondCol: string): RequestModel {
    this.selectFromQuery = this.selectFromQuery.innerJoin(table, firstCol, secondCol)

    return this
  }

  static join(table: string, firstCol: string, secondCol: string): RequestModel {
    const instance = new RequestModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.innerJoin(table, firstCol, secondCol)

    return instance
  }

  toJSON(): RequestJsonResponse {
    const output = {

      id: this.id,
      method: this.method,
      path: this.path,
      status_code: this.status_code,
      duration_ms: this.duration_ms,
      ip_address: this.ip_address,
      memory_usage: this.memory_usage,
      user_agent: this.user_agent,
      error_message: this.error_message,

      created_at: this.created_at,

      updated_at: this.updated_at,

      deleted_at: this.deleted_at,

      ...this.customColumns,
    }

    return output
  }

  parseResult(model: RequestModel): RequestModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof RequestModel]
    }

    return model
  }
}

async function find(id: number): Promise<RequestModel | undefined> {
  const query = DB.instance.selectFrom('requests').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  return new RequestModel(model)
}

export async function count(): Promise<number> {
  const results = await RequestModel.count()

  return results
}

export async function create(newRequest: NewRequest): Promise<RequestModel> {
  const result = await DB.instance.insertInto('requests')
    .values(newRequest)
    .executeTakeFirstOrThrow()

  return await find(Number(result.numInsertedOrUpdatedRows)) as RequestModel
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(DB.instance)
}

export async function remove(id: number): Promise<void> {
  await DB.instance.deleteFrom('requests')
    .where('id', '=', id)
    .execute()
}

export async function whereMethod(value: string | string[]): Promise<RequestModel[]> {
  const query = DB.instance.selectFrom('requests').where('method', '=', value)
  const results: RequestJsonResponse = await query.execute()

  return results.map((modelItem: RequestJsonResponse) => new RequestModel(modelItem))
}

export async function wherePath(value: string): Promise<RequestModel[]> {
  const query = DB.instance.selectFrom('requests').where('path', '=', value)
  const results: RequestJsonResponse = await query.execute()

  return results.map((modelItem: RequestJsonResponse) => new RequestModel(modelItem))
}

export async function whereStatusCode(value: number): Promise<RequestModel[]> {
  const query = DB.instance.selectFrom('requests').where('status_code', '=', value)
  const results: RequestJsonResponse = await query.execute()

  return results.map((modelItem: RequestJsonResponse) => new RequestModel(modelItem))
}

export async function whereDurationMs(value: number): Promise<RequestModel[]> {
  const query = DB.instance.selectFrom('requests').where('duration_ms', '=', value)
  const results: RequestJsonResponse = await query.execute()

  return results.map((modelItem: RequestJsonResponse) => new RequestModel(modelItem))
}

export async function whereIpAddress(value: string): Promise<RequestModel[]> {
  const query = DB.instance.selectFrom('requests').where('ip_address', '=', value)
  const results: RequestJsonResponse = await query.execute()

  return results.map((modelItem: RequestJsonResponse) => new RequestModel(modelItem))
}

export async function whereMemoryUsage(value: number): Promise<RequestModel[]> {
  const query = DB.instance.selectFrom('requests').where('memory_usage', '=', value)
  const results: RequestJsonResponse = await query.execute()

  return results.map((modelItem: RequestJsonResponse) => new RequestModel(modelItem))
}

export async function whereUserAgent(value: string): Promise<RequestModel[]> {
  const query = DB.instance.selectFrom('requests').where('user_agent', '=', value)
  const results: RequestJsonResponse = await query.execute()

  return results.map((modelItem: RequestJsonResponse) => new RequestModel(modelItem))
}

export async function whereErrorMessage(value: string): Promise<RequestModel[]> {
  const query = DB.instance.selectFrom('requests').where('error_message', '=', value)
  const results: RequestJsonResponse = await query.execute()

  return results.map((modelItem: RequestJsonResponse) => new RequestModel(modelItem))
}

export const Request = RequestModel

export default Request
