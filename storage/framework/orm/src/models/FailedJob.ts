import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import { cache } from '@stacksjs/cache'
import { sql } from '@stacksjs/database'
import { HttpError, ModelNotFoundException } from '@stacksjs/error-handling'
import { BaseOrm, DB, SubqueryBuilder } from '@stacksjs/orm'

export interface FailedJobsTable {
  id: Generated<number>
  connection: string
  queue: string
  payload: string
  exception: string
  failed_at?: Date | string

  created_at?: Date

  updated_at?: Date

}

export interface FailedJobResponse {
  data: FailedJobJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface FailedJobJsonResponse extends Omit<Selectable<FailedJobsTable>, 'password'> {
  [key: string]: any
}

export type NewFailedJob = Insertable<FailedJobsTable>
export type FailedJobUpdate = Updateable<FailedJobsTable>

      type SortDirection = 'asc' | 'desc'
interface SortOptions { column: FailedJobJsonResponse, order: SortDirection }
// Define a type for the options parameter
interface QueryOptions {
  sort?: SortOptions
  limit?: number
  offset?: number
  page?: number
}

export class FailedJobModel extends BaseOrm<FailedJobModel, FailedJobsTable, FailedJobJsonResponse> {
  private readonly hidden: Array<keyof FailedJobJsonResponse> = []
  private readonly fillable: Array<keyof FailedJobJsonResponse> = ['connection', 'queue', 'payload', 'exception', 'failed_at', 'uuid']
  private readonly guarded: Array<keyof FailedJobJsonResponse> = []
  protected attributes = {} as FailedJobJsonResponse
  protected originalAttributes = {} as FailedJobJsonResponse

  protected selectFromQuery: any
  protected updateFromQuery: any
  protected deleteFromQuery: any
  protected hasSelect: boolean
  private hasSaved: boolean
  private customColumns: Record<string, unknown> = {}

  constructor(failedJob: FailedJobJsonResponse | undefined) {
    super('failed_jobs')
    if (failedJob) {
      this.attributes = { ...failedJob }
      this.originalAttributes = { ...failedJob }

      Object.keys(failedJob).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (failedJob as FailedJobJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = DB.instance.selectFrom('failed_jobs')
    this.updateFromQuery = DB.instance.updateTable('failed_jobs')
    this.deleteFromQuery = DB.instance.deleteFrom('failed_jobs')
    this.hasSelect = false
    this.hasSaved = false
  }

  protected mapCustomGetters(models: FailedJobJsonResponse | FailedJobJsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: FailedJobJsonResponse) => {
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

  async mapCustomSetters(model: NewFailedJob | FailedJobUpdate): Promise<void> {
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

  get connection(): string {
    return this.attributes.connection
  }

  get queue(): string {
    return this.attributes.queue
  }

  get payload(): string {
    return this.attributes.payload
  }

  get exception(): string {
    return this.attributes.exception
  }

  get failed_at(): Date | string | undefined {
    return this.attributes.failed_at
  }

  get created_at(): Date | undefined {
    return this.attributes.created_at
  }

  get updated_at(): Date | undefined {
    return this.attributes.updated_at
  }

  set connection(value: string) {
    this.attributes.connection = value
  }

  set queue(value: string) {
    this.attributes.queue = value
  }

  set payload(value: string) {
    this.attributes.payload = value
  }

  set exception(value: string) {
    this.attributes.exception = value
  }

  set failed_at(value: Date | string) {
    this.attributes.failed_at = value
  }

  set updated_at(value: Date) {
    this.attributes.updated_at = value
  }

  getOriginal(column?: keyof FailedJobJsonResponse): Partial<FailedJobJsonResponse> {
    if (column) {
      return this.originalAttributes[column]
    }

    return this.originalAttributes
  }

  getChanges(): Partial<FailedJobJsonResponse> {
    return this.fillable.reduce<Partial<FailedJobJsonResponse>>((changes, key) => {
      const currentValue = this.attributes[key as keyof FailedJobsTable]
      const originalValue = this.originalAttributes[key as keyof FailedJobsTable]

      if (currentValue !== originalValue) {
        changes[key] = currentValue
      }

      return changes
    }, {})
  }

  isDirty(column?: keyof FailedJobJsonResponse): boolean {
    if (column) {
      return this.attributes[column] !== this.originalAttributes[column]
    }

    return Object.entries(this.originalAttributes).some(([key, originalValue]) => {
      const currentValue = (this.attributes as any)[key]

      return currentValue !== originalValue
    })
  }

  isClean(column?: keyof FailedJobJsonResponse): boolean {
    return !this.isDirty(column)
  }

  wasChanged(column?: keyof FailedJobJsonResponse): boolean {
    return this.hasSaved && this.isDirty(column)
  }

  static select(params: (keyof FailedJobJsonResponse)[] | RawBuilder<string> | string): FailedJobModel {
    const instance = new FailedJobModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a FailedJob by ID
  static async find(id: number): Promise<FailedJobModel | undefined> {
    const instance = new FailedJobModel(undefined)

    return await instance.applyFind(id)
  }

  async first(): Promise<FailedJobModel | undefined> {
    const model = await this.applyFirst()

    const data = new FailedJobModel(model)

    return data
  }

  static async first(): Promise<FailedJobModel | undefined> {
    const instance = new FailedJobModel(undefined)

    const model = await instance.applyFirst()

    const data = new FailedJobModel(model)

    return data
  }

  async applyFirstOrFail(): Promise<FailedJobModel | undefined> {
    const model = await this.selectFromQuery.executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, 'No FailedJobModel results found for query')

    if (model) {
      this.mapCustomGetters(model)
      await this.loadRelations(model)
    }

    const data = new FailedJobModel(model)

    return data
  }

  async firstOrFail(): Promise<FailedJobModel | undefined> {
    return await this.applyFirstOrFail()
  }

  static async firstOrFail(): Promise<FailedJobModel | undefined> {
    const instance = new FailedJobModel(undefined)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<FailedJobModel[]> {
    const instance = new FailedJobModel(undefined)

    const models = await DB.instance.selectFrom('failed_jobs').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: FailedJobJsonResponse) => {
      return new FailedJobModel(model)
    }))

    return data
  }

  async applyFindOrFail(id: number): Promise<FailedJobModel> {
    const model = await DB.instance.selectFrom('failed_jobs').where('id', '=', id).selectAll().executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, `No FailedJobModel results for ${id}`)

    cache.getOrSet(`failedJob:${id}`, JSON.stringify(model))

    this.mapCustomGetters(model)
    await this.loadRelations(model)

    const data = new FailedJobModel(model)

    return data
  }

  async findOrFail(id: number): Promise<FailedJobModel> {
    return await this.applyFindOrFail(id)
  }

  static async findOrFail(id: number): Promise<FailedJobModel> {
    const instance = new FailedJobModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<FailedJobModel[]> {
    const instance = new FailedJobModel(undefined)

    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: UserJsonResponse) => instance.parseResult(new FailedJobModel(modelItem)))
  }

  async findMany(ids: number[]): Promise<FailedJobModel[]> {
    const models = await this.applyFindMany(ids)

    return models.map((modelItem: UserJsonResponse) => this.parseResult(new FailedJobModel(modelItem)))
  }

  skip(count: number): FailedJobModel {
    this.selectFromQuery = this.selectFromQuery.offset(count)

    return this
  }

  static skip(count: number): FailedJobModel {
    const instance = new FailedJobModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.offset(count)

    return instance
  }

  async applyChunk(size: number, callback: (models: FailedJobModel[]) => Promise<void>): Promise<void> {
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

  async chunk(size: number, callback: (models: FailedJobModel[]) => Promise<void>): Promise<void> {
    await this.applyChunk(size, callback)
  }

  static async chunk(size: number, callback: (models: FailedJobModel[]) => Promise<void>): Promise<void> {
    const instance = new FailedJobModel(undefined)

    await instance.applyChunk(size, callback)
  }

  static take(count: number): FailedJobModel {
    const instance = new FailedJobModel(undefined)

    return instance.applyTake(count)
  }

  static async pluck<K extends keyof FailedJobModel>(field: K): Promise<FailedJobModel[K][]> {
    const instance = new FailedJobModel(undefined)

    if (instance.hasSelect) {
      const model = await instance.selectFromQuery.execute()
      return model.map((modelItem: FailedJobModel) => modelItem[field])
    }

    const model = await instance.selectFromQuery.selectAll().execute()

    return model.map((modelItem: FailedJobModel) => modelItem[field])
  }

  async pluck<K extends keyof FailedJobModel>(field: K): Promise<FailedJobModel[K][]> {
    if (this.hasSelect) {
      const model = await this.selectFromQuery.execute()
      return model.map((modelItem: FailedJobModel) => modelItem[field])
    }

    const model = await this.selectFromQuery.selectAll().execute()

    return model.map((modelItem: FailedJobModel) => modelItem[field])
  }

  static async count(): Promise<number> {
    const instance = new FailedJobModel(undefined)

    return instance.applyCount()
  }

  static async max(field: keyof FailedJobModel): Promise<number> {
    const instance = new FailedJobModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`MAX(${sql.raw(field as string)}) as max `)
      .executeTakeFirst()

    return result.max
  }

  async max(field: keyof FailedJobModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`MAX(${sql.raw(field as string)}) as max`)
      .executeTakeFirst()

    return result.max
  }

  static async min(field: keyof FailedJobModel): Promise<number> {
    const instance = new FailedJobModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`MIN(${sql.raw(field as string)}) as min `)
      .executeTakeFirst()

    return result.min
  }

  async min(field: keyof FailedJobModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`MIN(${sql.raw(field as string)}) as min `)
      .executeTakeFirst()

    return result.min
  }

  static async avg(field: keyof FailedJobModel): Promise<number> {
    const instance = new FailedJobModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`AVG(${sql.raw(field as string)}) as avg `)
      .executeTakeFirst()

    return result.avg
  }

  async avg(field: keyof FailedJobModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`AVG(${sql.raw(field as string)}) as avg `)
      .executeTakeFirst()

    return result.avg
  }

  static async sum(field: keyof FailedJobModel): Promise<number> {
    const instance = new FailedJobModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`SUM(${sql.raw(field as string)}) as sum `)
      .executeTakeFirst()

    return result.sum
  }

  async sum(field: keyof FailedJobModel): Promise<number> {
    const result = this.selectFromQuery
      .select(sql`SUM(${sql.raw(field as string)}) as sum `)
      .executeTakeFirst()

    return result.sum
  }

  async applyGet(): Promise<FailedJobModel[]> {
    let models

    if (this.hasSelect) {
      models = await this.selectFromQuery.execute()
    }
    else {
      models = await this.selectFromQuery.selectAll().execute()
    }

    this.mapCustomGetters(models)
    await this.loadRelations(models)

    const data = await Promise.all(models.map(async (model: FailedJobJsonResponse) => {
      return new FailedJobModel(model)
    }))

    return data
  }

  async get(): Promise<FailedJobModel[]> {
    return await this.applyGet()
  }

  static async get(): Promise<FailedJobModel[]> {
    const instance = new FailedJobModel(undefined)

    return await instance.applyGet()
  }

  has(relation: string): FailedJobModel {
    this.selectFromQuery = this.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(
        selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.failedJob_id`, '=', 'failed_jobs.id'),
      ),
    )

    return this
  }

  static has(relation: string): FailedJobModel {
    const instance = new FailedJobModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(
        selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.failedJob_id`, '=', 'failed_jobs.id'),
      ),
    )

    return instance
  }

  static whereExists(callback: (qb: any) => any): FailedJobModel {
    const instance = new FailedJobModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(callback({ exists, selectFrom })),
    )

    return instance
  }

  applyWhereHas(
    relation: string,
    callback: (query: SubqueryBuilder<keyof FailedJobModel>) => void,
  ): FailedJobModel {
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    this.selectFromQuery = this.selectFromQuery
      .where(({ exists, selectFrom }: any) => {
        let subquery = selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.failedJob_id`, '=', 'failed_jobs.id')

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
    callback: (query: SubqueryBuilder<keyof FailedJobModel>) => void,
  ): FailedJobModel {
    return this.applyWhereHas(relation, callback)
  }

  static whereHas(
    relation: string,
    callback: (query: SubqueryBuilder<keyof FailedJobModel>) => void,
  ): FailedJobModel {
    const instance = new FailedJobModel(undefined)

    return instance.applyWhereHas(relation, callback)
  }

  applyDoesntHave(relation: string): FailedJobModel {
    this.selectFromQuery = this.selectFromQuery.where(({ not, exists, selectFrom }: any) =>
      not(
        exists(
          selectFrom(relation)
            .select('1')
            .whereRef(`${relation}.failedJob_id`, '=', 'failed_jobs.id'),
        ),
      ),
    )

    return this
  }

  doesntHave(relation: string): FailedJobModel {
    return this.applyDoesntHave(relation)
  }

  static doesntHave(relation: string): FailedJobModel {
    const instance = new FailedJobModel(undefined)

    return instance.applyDoesntHave(relation)
  }

  applyWhereDoesntHave(relation: string, callback: (query: SubqueryBuilder<FailedJobsTable>) => void): FailedJobModel {
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    this.selectFromQuery = this.selectFromQuery
      .where(({ exists, selectFrom, not }: any) => {
        const subquery = selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.failedJob_id`, '=', 'failed_jobs.id')

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

  whereDoesntHave(relation: string, callback: (query: SubqueryBuilder<FailedJobsTable>) => void): FailedJobModel {
    return this.applyWhereDoesntHave(relation, callback)
  }

  static whereDoesntHave(
    relation: string,
    callback: (query: SubqueryBuilder<FailedJobsTable>) => void,
  ): FailedJobModel {
    const instance = new FailedJobModel(undefined)

    return instance.applyWhereDoesntHave(relation, callback)
  }

  async applyPaginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<FailedJobResponse> {
    const totalRecordsResult = await DB.instance.selectFrom('failed_jobs')
      .select(DB.instance.fn.count('id').as('total')) // Use 'id' or another actual column name
      .executeTakeFirst()

    const totalRecords = Number(totalRecordsResult?.total) || 0
    const totalPages = Math.ceil(totalRecords / (options.limit ?? 10))

    const failed_jobsWithExtra = await DB.instance.selectFrom('failed_jobs')
      .selectAll()
      .orderBy('id', 'asc') // Assuming 'id' is used for cursor-based pagination
      .limit((options.limit ?? 10) + 1) // Fetch one extra record
      .offset(((options.page ?? 1) - 1) * (options.limit ?? 10)) // Ensure options.page is not undefined
      .execute()

    let nextCursor = null
    if (failed_jobsWithExtra.length > (options.limit ?? 10))
      nextCursor = failed_jobsWithExtra.pop()?.id ?? null

    return {
      data: failed_jobsWithExtra,
      paging: {
        total_records: totalRecords,
        page: options.page || 1,
        total_pages: totalPages,
      },
      next_cursor: nextCursor,
    }
  }

  async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<FailedJobResponse> {
    return await this.applyPaginate(options)
  }

  // Method to get all failed_jobs
  static async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<FailedJobResponse> {
    const instance = new FailedJobModel(undefined)

    return await instance.applyPaginate(options)
  }

  async applyCreate(newFailedJob: NewFailedJob): Promise<FailedJobModel> {
    const filteredValues = Object.fromEntries(
      Object.entries(newFailedJob).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewFailedJob

    await this.mapCustomSetters(filteredValues)

    const result = await DB.instance.insertInto('failed_jobs')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await this.find(Number(result.numInsertedOrUpdatedRows)) as FailedJobModel

    return model
  }

  async create(newFailedJob: NewFailedJob): Promise<FailedJobModel> {
    return await this.applyCreate(newFailedJob)
  }

  static async create(newFailedJob: NewFailedJob): Promise<FailedJobModel> {
    const instance = new FailedJobModel(undefined)

    return await instance.applyCreate(newFailedJob)
  }

  static async createMany(newFailedJob: NewFailedJob[]): Promise<void> {
    const instance = new FailedJobModel(undefined)

    const valuesFiltered = newFailedJob.map((newFailedJob: NewFailedJob) => {
      const filteredValues = Object.fromEntries(
        Object.entries(newFailedJob).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewFailedJob

      return filteredValues
    })

    await DB.instance.insertInto('failed_jobs')
      .values(valuesFiltered)
      .executeTakeFirst()
  }

  static async forceCreate(newFailedJob: NewFailedJob): Promise<FailedJobModel> {
    const result = await DB.instance.insertInto('failed_jobs')
      .values(newFailedJob)
      .executeTakeFirst()

    const model = await find(Number(result.numInsertedOrUpdatedRows)) as FailedJobModel

    return model
  }

  // Method to remove a FailedJob
  static async remove(id: number): Promise<any> {
    return await DB.instance.deleteFrom('failed_jobs')
      .where('id', '=', id)
      .execute()
  }

  static where<V = string>(column: keyof FailedJobsTable, ...args: [V] | [Operator, V]): FailedJobModel {
    const instance = new FailedJobModel(undefined)

    return instance.applyWhere<V>(column, ...args)
  }

  static whereColumn(first: keyof FailedJobsTable, operator: Operator, second: keyof FailedJobsTable): FailedJobModel {
    const instance = new FailedJobModel(undefined)

    instance.selectFromQuery = instance.applyWhereColumn(first, operator, second)

    return instance
  }

  static whereRef(column: keyof FailedJobsTable, ...args: string[]): FailedJobModel {
    const instance = new FailedJobModel(undefined)

    return instance.applyWhereRef(column, ...args)
  }

  static whereRaw(sqlStatement: string): FailedJobModel {
    const instance = new FailedJobModel(undefined)

    instance.selectFromQuery = instance.applyWhereRaw(sqlStatement)

    return instance
  }

  static orWhere(...conditions: [string, any][]): FailedJobModel {
    const instance = new FailedJobModel(undefined)

    return instance.applyOrWhere(...conditions)
  }

  static when(condition: boolean, callback: (query: FailedJobModel) => FailedJobModel): FailedJobModel {
    const instance = new FailedJobModel(undefined)

    return instance.applyWhen(condition, callback)
  }

  static whereNotNull(column: keyof FailedJobsTable): FailedJobModel {
    const instance = new UserModel(undefined)

    return instance.applyWhereNotNull(column)
  }

  static whereNull(column: keyof FailedJobsTable): FailedJobModel {
    const instance = new FailedJobModel(undefined)

    return instance.applyWhereNull(column)
  }

  static whereConnection(value: string): FailedJobModel {
    const instance = new FailedJobModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('connection', '=', value)

    return instance
  }

  static whereQueue(value: string): FailedJobModel {
    const instance = new FailedJobModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('queue', '=', value)

    return instance
  }

  static wherePayload(value: string): FailedJobModel {
    const instance = new FailedJobModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('payload', '=', value)

    return instance
  }

  static whereException(value: string): FailedJobModel {
    const instance = new FailedJobModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('exception', '=', value)

    return instance
  }

  static whereFailedAt(value: string): FailedJobModel {
    const instance = new FailedJobModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('failed_at', '=', value)

    return instance
  }

  static whereIn<V = number>(column: keyof FailedJobsTable, values: V[]): FailedJobModel {
    const instance = new FailedJobModel(undefined)

    return instance.applyWhereIn<V>(column, values)
  }

  static whereBetween<V = number>(column: keyof FailedJobsTable, range: [V, V]): FailedJobModel {
    const instance = new FailedJobModel(undefined)

    return instance.applyWhereBetween<V>(column, range)
  }

  static whereLike(column: keyof FailedJobsTable, value: string): FailedJobModel {
    const instance = new FailedJobModel(undefined)

    return instance.applyWhereLike(column, value)
  }

  static whereNotIn<V = number>(column: keyof FailedJobsTable, values: V[]): FailedJobModel {
    const instance = new FailedJobModel(undefined)

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

  static async latest(): Promise<FailedJobModel | undefined> {
    const instance = new FailedJobModel(undefined)

    const model = await DB.instance.selectFrom('failed_jobs')
      .selectAll()
      .orderBy('id', 'desc')
      .executeTakeFirst()

    if (!model)
      return undefined

    instance.mapCustomGetters(model)

    const data = new FailedJobModel(model)

    return data
  }

  static async oldest(): Promise<FailedJobModel | undefined> {
    const instance = new FailedJobModel(undefined)

    const model = await DB.instance.selectFrom('failed_jobs')
      .selectAll()
      .orderBy('id', 'asc')
      .executeTakeFirst()

    if (!model)
      return undefined

    instance.mapCustomGetters(model)

    const data = new FailedJobModel(model)

    return data
  }

  static async firstOrCreate(
    condition: Partial<FailedJobJsonResponse>,
    newFailedJob: NewFailedJob,
  ): Promise<FailedJobModel> {
    const instance = new FailedJobModel(undefined)

    const key = Object.keys(condition)[0] as keyof FailedJobJsonResponse

    if (!key) {
      throw new HttpError(500, 'Condition must contain at least one key-value pair')
    }

    const value = condition[key]

    // Attempt to find the first record matching the condition
    const existingFailedJob = await DB.instance.selectFrom('failed_jobs')
      .selectAll()
      .where(key, '=', value)
      .executeTakeFirst()

    if (existingFailedJob) {
      instance.mapCustomGetters(existingFailedJob)
      await instance.loadRelations(existingFailedJob)

      return new FailedJobModel(existingFailedJob as FailedJobJsonResponse)
    }
    else {
      return await instance.create(newFailedJob)
    }
  }

  static async updateOrCreate(
    condition: Partial<FailedJobJsonResponse>,
    newFailedJob: NewFailedJob,
  ): Promise<FailedJobModel> {
    const instance = new FailedJobModel(undefined)

    const key = Object.keys(condition)[0] as keyof FailedJobJsonResponse

    if (!key) {
      throw new HttpError(500, 'Condition must contain at least one key-value pair')
    }

    const value = condition[key]

    // Attempt to find the first record matching the condition
    const existingFailedJob = await DB.instance.selectFrom('failed_jobs')
      .selectAll()
      .where(key, '=', value)
      .executeTakeFirst()

    if (existingFailedJob) {
      // If found, update the existing record
      await DB.instance.updateTable('failed_jobs')
        .set(newFailedJob)
        .where(key, '=', value)
        .executeTakeFirstOrThrow()

      // Fetch and return the updated record
      const updatedFailedJob = await DB.instance.selectFrom('failed_jobs')
        .selectAll()
        .where(key, '=', value)
        .executeTakeFirst()

      if (!updatedFailedJob) {
        throw new HttpError(500, 'Failed to fetch updated record')
      }

      instance.hasSaved = true

      return new FailedJobModel(updatedFailedJob as FailedJobJsonResponse)
    }
    else {
      // If not found, create a new record
      return await instance.create(newFailedJob)
    }
  }

  protected async loadRelations(models: FailedJobJsonResponse | FailedJobJsonResponse[]): Promise<void> {
    // Handle both single model and array of models
    const modelArray = Array.isArray(models) ? models : [models]
    if (!modelArray.length)
      return

    const modelIds = modelArray.map(model => model.id)

    for (const relation of this.withRelations) {
      const relatedRecords = await DB.instance
        .selectFrom(relation)
        .where('failedJob_id', 'in', modelIds)
        .selectAll()
        .execute()

      if (Array.isArray(models)) {
        models.map((model: FailedJobJsonResponse) => {
          const records = relatedRecords.filter((record: { failedJob_id: number }) => {
            return record.failedJob_id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      }
      else {
        const records = relatedRecords.filter((record: { failedJob_id: number }) => {
          return record.failedJob_id === models.id
        })

        models[relation] = records.length === 1 ? records[0] : records
      }
    }
  }

  static with(relations: string[]): FailedJobModel {
    const instance = new FailedJobModel(undefined)

    instance.withRelations = relations

    return instance
  }

  async last(): Promise<FailedJobModel | undefined> {
    const model = await this.applyLast()

    const data = new FailedJobModel(model)

    return data
  }

  static async last(): Promise<FailedJobModel | undefined> {
    const instance = new FailedJobModel(undefined)

    const model = await instance.applyLast()

    if (!model)
      return undefined

    const data = new FailedJobModel(model)

    return data
  }

  static orderBy(column: keyof FailedJobsTable, order: 'asc' | 'desc'): FailedJobModel {
    const instance = new UserModel(undefined)

    return instance.applyOrderBy(column, order)
  }

  static groupBy(column: keyof FailedJobsTable): FailedJobModel {
    const instance = new FailedJobModel(undefined)

    return instance.applyGroupBy(column)
  }

  static having<V = string>(column: keyof FailedJobsTable, operator: Operator, value: V): FailedJobModel {
    const instance = new FailedJobModel(undefined)

    return instance.applyHaving(column, operator, value)
  }

  static inRandomOrder(): FailedJobModel {
    const instance = new FailedJobModel(undefined)

    return instance.applyInRandomOrder()
  }

  static orderByDesc(column: keyof FailedJobsTable): FailedJobModel {
    const instance = new FailedJobModel(undefined)

    return instance.applyOrderByDesc(column)
  }

  static orderByAsc(column: keyof FailedJobsTable): FailedJobModel {
    const instance = new FailedJobModel(undefined)

    return instance.applyOrderByAsc(column)
  }

  async update(newFailedJob: FailedJobUpdate): Promise<FailedJobModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newFailedJob).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewFailedJob

    await this.mapCustomSetters(filteredValues)

    await DB.instance.updateTable('failed_jobs')
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

  async forceUpdate(failedJob: FailedJobUpdate): Promise<FailedJobModel | undefined> {
    if (this.id === undefined) {
      this.updateFromQuery.set(failedJob).execute()
    }

    await this.mapCustomSetters(failedJob)

    await DB.instance.updateTable('failed_jobs')
      .set(failedJob)
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
      throw new HttpError(500, 'FailedJob data is undefined')

    await this.mapCustomSetters(this.attributes)

    if (this.id === undefined) {
      await this.create(this.attributes)
    }
    else {
      await this.update(this.attributes)
    }

    this.hasSaved = true
  }

  fill(data: Partial<FailedJobJsonResponse>): FailedJobModel {
    const filteredValues = Object.fromEntries(
      Object.entries(data).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewFailedJob

    this.attributes = {
      ...this.attributes,
      ...filteredValues,
    }

    return this
  }

  forceFill(data: Partial<FailedJobJsonResponse>): FailedJobModel {
    this.attributes = {
      ...this.attributes,
      ...data,
    }

    return this
  }

  // Method to delete (soft delete) the failedJob instance
  async delete(): Promise<FailedJobsTable> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()

    return await DB.instance.deleteFrom('failed_jobs')
      .where('id', '=', this.id)
      .execute()
  }

  distinct(column: keyof FailedJobJsonResponse): FailedJobModel {
    this.selectFromQuery = this.selectFromQuery.select(column).distinct()

    this.hasSelect = true

    return this
  }

  static distinct(column: keyof FailedJobJsonResponse): FailedJobModel {
    const instance = new FailedJobModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.select(column).distinct()

    instance.hasSelect = true

    return instance
  }

  join(table: string, firstCol: string, secondCol: string): FailedJobModel {
    this.selectFromQuery = this.selectFromQuery.innerJoin(table, firstCol, secondCol)

    return this
  }

  static join(table: string, firstCol: string, secondCol: string): FailedJobModel {
    const instance = new FailedJobModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.innerJoin(table, firstCol, secondCol)

    return instance
  }

  toJSON(): FailedJobJsonResponse {
    const output = {

      id: this.id,
      connection: this.connection,
      queue: this.queue,
      payload: this.payload,
      exception: this.exception,
      failed_at: this.failed_at,

      created_at: this.created_at,

      updated_at: this.updated_at,

      ...this.customColumns,
    }

    return output
  }

  parseResult(model: FailedJobModel): FailedJobModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof FailedJobModel]
    }

    return model
  }
}

async function find(id: number): Promise<FailedJobModel | undefined> {
  const query = DB.instance.selectFrom('failed_jobs').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  return new FailedJobModel(model)
}

export async function count(): Promise<number> {
  const results = await FailedJobModel.count()

  return results
}

export async function create(newFailedJob: NewFailedJob): Promise<FailedJobModel> {
  const result = await DB.instance.insertInto('failed_jobs')
    .values(newFailedJob)
    .executeTakeFirstOrThrow()

  return await find(Number(result.numInsertedOrUpdatedRows)) as FailedJobModel
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(DB.instance)
}

export async function remove(id: number): Promise<void> {
  await DB.instance.deleteFrom('failed_jobs')
    .where('id', '=', id)
    .execute()
}

export async function whereConnection(value: string): Promise<FailedJobModel[]> {
  const query = DB.instance.selectFrom('failed_jobs').where('connection', '=', value)
  const results: FailedJobJsonResponse = await query.execute()

  return results.map((modelItem: FailedJobJsonResponse) => new FailedJobModel(modelItem))
}

export async function whereQueue(value: string): Promise<FailedJobModel[]> {
  const query = DB.instance.selectFrom('failed_jobs').where('queue', '=', value)
  const results: FailedJobJsonResponse = await query.execute()

  return results.map((modelItem: FailedJobJsonResponse) => new FailedJobModel(modelItem))
}

export async function wherePayload(value: string): Promise<FailedJobModel[]> {
  const query = DB.instance.selectFrom('failed_jobs').where('payload', '=', value)
  const results: FailedJobJsonResponse = await query.execute()

  return results.map((modelItem: FailedJobJsonResponse) => new FailedJobModel(modelItem))
}

export async function whereException(value: string): Promise<FailedJobModel[]> {
  const query = DB.instance.selectFrom('failed_jobs').where('exception', '=', value)
  const results: FailedJobJsonResponse = await query.execute()

  return results.map((modelItem: FailedJobJsonResponse) => new FailedJobModel(modelItem))
}

export async function whereFailedAt(value: Date | string): Promise<FailedJobModel[]> {
  const query = DB.instance.selectFrom('failed_jobs').where('failed_at', '=', value)
  const results: FailedJobJsonResponse = await query.execute()

  return results.map((modelItem: FailedJobJsonResponse) => new FailedJobModel(modelItem))
}

export const FailedJob = FailedJobModel

export default FailedJob
