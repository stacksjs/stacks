import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import { cache } from '@stacksjs/cache'
import { sql } from '@stacksjs/database'
import { HttpError, ModelNotFoundException } from '@stacksjs/error-handling'
import { BaseOrm, DB, SubqueryBuilder } from '@stacksjs/orm'

export interface JobsTable {
  id: Generated<number>
  queue: string
  payload: string
  attempts?: number
  available_at?: number
  reserved_at?: Date | string

  created_at?: Date

  updated_at?: Date

}

export interface JobResponse {
  data: JobJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface JobJsonResponse extends Omit<Selectable<JobsTable>, 'password'> {
  [key: string]: any
}

export type NewJob = Insertable<JobsTable>
export type JobUpdate = Updateable<JobsTable>

      type SortDirection = 'asc' | 'desc'
interface SortOptions { column: JobJsonResponse, order: SortDirection }
// Define a type for the options parameter
interface QueryOptions {
  sort?: SortOptions
  limit?: number
  offset?: number
  page?: number
}

export class JobModel extends BaseOrm<JobModel, JobsTable, JobJsonResponse> {
  private readonly hidden: Array<keyof JobJsonResponse> = []
  private readonly fillable: Array<keyof JobJsonResponse> = ['queue', 'payload', 'attempts', 'available_at', 'reserved_at', 'uuid']
  private readonly guarded: Array<keyof JobJsonResponse> = []
  protected attributes = {} as JobJsonResponse
  protected originalAttributes = {} as JobJsonResponse

  protected selectFromQuery: any
  protected updateFromQuery: any
  protected deleteFromQuery: any
  protected hasSelect: boolean
  private hasSaved: boolean
  private customColumns: Record<string, unknown> = {}

  constructor(job: JobJsonResponse | undefined) {
    super('jobs')
    if (job) {
      this.attributes = { ...job }
      this.originalAttributes = { ...job }

      Object.keys(job).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (job as JobJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = DB.instance.selectFrom('jobs')
    this.updateFromQuery = DB.instance.updateTable('jobs')
    this.deleteFromQuery = DB.instance.deleteFrom('jobs')
    this.hasSelect = false
    this.hasSaved = false
  }

  protected mapCustomGetters(models: JobJsonResponse | JobJsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: JobJsonResponse) => {
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

  async mapCustomSetters(model: NewJob | JobUpdate): Promise<void> {
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

  get queue(): string {
    return this.attributes.queue
  }

  get payload(): string {
    return this.attributes.payload
  }

  get attempts(): number | undefined {
    return this.attributes.attempts
  }

  get available_at(): number | undefined {
    return this.attributes.available_at
  }

  get reserved_at(): Date | string | undefined {
    return this.attributes.reserved_at
  }

  get created_at(): Date | undefined {
    return this.attributes.created_at
  }

  get updated_at(): Date | undefined {
    return this.attributes.updated_at
  }

  set queue(value: string) {
    this.attributes.queue = value
  }

  set payload(value: string) {
    this.attributes.payload = value
  }

  set attempts(value: number) {
    this.attributes.attempts = value
  }

  set available_at(value: number) {
    this.attributes.available_at = value
  }

  set reserved_at(value: Date | string) {
    this.attributes.reserved_at = value
  }

  set updated_at(value: Date) {
    this.attributes.updated_at = value
  }

  getOriginal(column?: keyof JobJsonResponse): Partial<JobJsonResponse> {
    if (column) {
      return this.originalAttributes[column]
    }

    return this.originalAttributes
  }

  getChanges(): Partial<JobJsonResponse> {
    return this.fillable.reduce<Partial<JobJsonResponse>>((changes, key) => {
      const currentValue = this.attributes[key as keyof JobsTable]
      const originalValue = this.originalAttributes[key as keyof JobsTable]

      if (currentValue !== originalValue) {
        changes[key] = currentValue
      }

      return changes
    }, {})
  }

  isDirty(column?: keyof JobJsonResponse): boolean {
    if (column) {
      return this.attributes[column] !== this.originalAttributes[column]
    }

    return Object.entries(this.originalAttributes).some(([key, originalValue]) => {
      const currentValue = (this.attributes as any)[key]

      return currentValue !== originalValue
    })
  }

  isClean(column?: keyof JobJsonResponse): boolean {
    return !this.isDirty(column)
  }

  wasChanged(column?: keyof JobJsonResponse): boolean {
    return this.hasSaved && this.isDirty(column)
  }

  select(params: (keyof JobJsonResponse)[] | RawBuilder<string> | string): JobModel {
    this.selectFromQuery = this.selectFromQuery.select(params)

    this.hasSelect = true

    return this
  }

  static select(params: (keyof JobJsonResponse)[] | RawBuilder<string> | string): JobModel {
    const instance = new JobModel(undefined)

    // Initialize a query with the table name and selected fields
    instance.selectFromQuery = instance.selectFromQuery.select(params)

    instance.hasSelect = true

    return instance
  }

  // Method to find a Job by ID
  static async find(id: number): Promise<JobModel | undefined> {
    const instance = new JobModel(undefined)

    return await instance.applyFind(id)
  }

  async first(): Promise<JobModel | undefined> {
    const model = await this.applyFirst()

    const data = new JobModel(model)

    return data
  }

  static async first(): Promise<JobModel | undefined> {
    const instance = new JobModel(undefined)

    const model = await instance.applyFirst()

    const data = new JobModel(model)

    return data
  }

  async applyFirstOrFail(): Promise<JobModel | undefined> {
    const model = await this.selectFromQuery.executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, 'No JobModel results found for query')

    if (model) {
      this.mapCustomGetters(model)
      await this.loadRelations(model)
    }

    const data = new JobModel(model)

    return data
  }

  async firstOrFail(): Promise<JobModel | undefined> {
    return await this.applyFirstOrFail()
  }

  static async firstOrFail(): Promise<JobModel | undefined> {
    const instance = new JobModel(undefined)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<JobModel[]> {
    const instance = new JobModel(undefined)

    const models = await DB.instance.selectFrom('jobs').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: JobJsonResponse) => {
      return new JobModel(model)
    }))

    return data
  }

  async applyFindOrFail(id: number): Promise<JobModel> {
    const model = await DB.instance.selectFrom('jobs').where('id', '=', id).selectAll().executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, `No JobModel results for ${id}`)

    cache.getOrSet(`job:${id}`, JSON.stringify(model))

    this.mapCustomGetters(model)
    await this.loadRelations(model)

    const data = new JobModel(model)

    return data
  }

  async findOrFail(id: number): Promise<JobModel> {
    return await this.applyFindOrFail(id)
  }

  static async findOrFail(id: number): Promise<JobModel> {
    const instance = new JobModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<JobModel[]> {
    const instance = new JobModel(undefined)

    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: UserJsonResponse) => instance.parseResult(new JobModel(modelItem)))
  }

  async findMany(ids: number[]): Promise<JobModel[]> {
    const models = await this.applyFindMany(ids)

    return models.map((modelItem: UserJsonResponse) => this.parseResult(new JobModel(modelItem)))
  }

  skip(count: number): JobModel {
    this.selectFromQuery = this.selectFromQuery.offset(count)

    return this
  }

  static skip(count: number): JobModel {
    const instance = new JobModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.offset(count)

    return instance
  }

  async applyChunk(size: number, callback: (models: JobModel[]) => Promise<void>): Promise<void> {
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

  async chunk(size: number, callback: (models: JobModel[]) => Promise<void>): Promise<void> {
    await this.applyChunk(size, callback)
  }

  static async chunk(size: number, callback: (models: JobModel[]) => Promise<void>): Promise<void> {
    const instance = new JobModel(undefined)

    await instance.applyChunk(size, callback)
  }

  take(count: number): JobModel {
    this.selectFromQuery = this.selectFromQuery.limit(count)

    return this
  }

  static take(count: number): JobModel {
    const instance = new JobModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.limit(count)

    return instance
  }

  static async pluck<K extends keyof JobModel>(field: K): Promise<JobModel[K][]> {
    const instance = new JobModel(undefined)

    if (instance.hasSelect) {
      const model = await instance.selectFromQuery.execute()
      return model.map((modelItem: JobModel) => modelItem[field])
    }

    const model = await instance.selectFromQuery.selectAll().execute()

    return model.map((modelItem: JobModel) => modelItem[field])
  }

  async pluck<K extends keyof JobModel>(field: K): Promise<JobModel[K][]> {
    if (this.hasSelect) {
      const model = await this.selectFromQuery.execute()
      return model.map((modelItem: JobModel) => modelItem[field])
    }

    const model = await this.selectFromQuery.selectAll().execute()

    return model.map((modelItem: JobModel) => modelItem[field])
  }

  static async count(): Promise<number> {
    const instance = new JobModel(undefined)

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

  static async max(field: keyof JobModel): Promise<number> {
    const instance = new JobModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`MAX(${sql.raw(field as string)}) as max `)
      .executeTakeFirst()

    return result.max
  }

  async max(field: keyof JobModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`MAX(${sql.raw(field as string)}) as max`)
      .executeTakeFirst()

    return result.max
  }

  static async min(field: keyof JobModel): Promise<number> {
    const instance = new JobModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`MIN(${sql.raw(field as string)}) as min `)
      .executeTakeFirst()

    return result.min
  }

  async min(field: keyof JobModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`MIN(${sql.raw(field as string)}) as min `)
      .executeTakeFirst()

    return result.min
  }

  static async avg(field: keyof JobModel): Promise<number> {
    const instance = new JobModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`AVG(${sql.raw(field as string)}) as avg `)
      .executeTakeFirst()

    return result.avg
  }

  async avg(field: keyof JobModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`AVG(${sql.raw(field as string)}) as avg `)
      .executeTakeFirst()

    return result.avg
  }

  static async sum(field: keyof JobModel): Promise<number> {
    const instance = new JobModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`SUM(${sql.raw(field as string)}) as sum `)
      .executeTakeFirst()

    return result.sum
  }

  async sum(field: keyof JobModel): Promise<number> {
    const result = this.selectFromQuery
      .select(sql`SUM(${sql.raw(field as string)}) as sum `)
      .executeTakeFirst()

    return result.sum
  }

  async applyGet(): Promise<JobModel[]> {
    let models

    if (this.hasSelect) {
      models = await this.selectFromQuery.execute()
    }
    else {
      models = await this.selectFromQuery.selectAll().execute()
    }

    this.mapCustomGetters(models)
    await this.loadRelations(models)

    const data = await Promise.all(models.map(async (model: JobJsonResponse) => {
      return new JobModel(model)
    }))

    return data
  }

  async get(): Promise<JobModel[]> {
    return await this.applyGet()
  }

  static async get(): Promise<JobModel[]> {
    const instance = new JobModel(undefined)

    return await instance.applyGet()
  }

  has(relation: string): JobModel {
    this.selectFromQuery = this.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(
        selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.job_id`, '=', 'jobs.id'),
      ),
    )

    return this
  }

  static has(relation: string): JobModel {
    const instance = new JobModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(
        selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.job_id`, '=', 'jobs.id'),
      ),
    )

    return instance
  }

  static whereExists(callback: (qb: any) => any): JobModel {
    const instance = new JobModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(callback({ exists, selectFrom })),
    )

    return instance
  }

  applyWhereHas(
    relation: string,
    callback: (query: SubqueryBuilder<keyof JobModel>) => void,
  ): JobModel {
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    this.selectFromQuery = this.selectFromQuery
      .where(({ exists, selectFrom }: any) => {
        let subquery = selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.job_id`, '=', 'jobs.id')

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
    callback: (query: SubqueryBuilder<keyof JobModel>) => void,
  ): JobModel {
    return this.applyWhereHas(relation, callback)
  }

  static whereHas(
    relation: string,
    callback: (query: SubqueryBuilder<keyof JobModel>) => void,
  ): JobModel {
    const instance = new JobModel(undefined)

    return instance.applyWhereHas(relation, callback)
  }

  applyDoesntHave(relation: string): JobModel {
    this.selectFromQuery = this.selectFromQuery.where(({ not, exists, selectFrom }: any) =>
      not(
        exists(
          selectFrom(relation)
            .select('1')
            .whereRef(`${relation}.job_id`, '=', 'jobs.id'),
        ),
      ),
    )

    return this
  }

  doesntHave(relation: string): JobModel {
    return this.applyDoesntHave(relation)
  }

  static doesntHave(relation: string): JobModel {
    const instance = new JobModel(undefined)

    return instance.applyDoesntHave(relation)
  }

  applyWhereDoesntHave(relation: string, callback: (query: SubqueryBuilder<JobsTable>) => void): JobModel {
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    this.selectFromQuery = this.selectFromQuery
      .where(({ exists, selectFrom, not }: any) => {
        const subquery = selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.job_id`, '=', 'jobs.id')

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

  whereDoesntHave(relation: string, callback: (query: SubqueryBuilder<JobsTable>) => void): JobModel {
    return this.applyWhereDoesntHave(relation, callback)
  }

  static whereDoesntHave(
    relation: string,
    callback: (query: SubqueryBuilder<JobsTable>) => void,
  ): JobModel {
    const instance = new JobModel(undefined)

    return instance.applyWhereDoesntHave(relation, callback)
  }

  async applyPaginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<JobResponse> {
    const totalRecordsResult = await DB.instance.selectFrom('jobs')
      .select(DB.instance.fn.count('id').as('total')) // Use 'id' or another actual column name
      .executeTakeFirst()

    const totalRecords = Number(totalRecordsResult?.total) || 0
    const totalPages = Math.ceil(totalRecords / (options.limit ?? 10))

    const jobsWithExtra = await DB.instance.selectFrom('jobs')
      .selectAll()
      .orderBy('id', 'asc') // Assuming 'id' is used for cursor-based pagination
      .limit((options.limit ?? 10) + 1) // Fetch one extra record
      .offset(((options.page ?? 1) - 1) * (options.limit ?? 10)) // Ensure options.page is not undefined
      .execute()

    let nextCursor = null
    if (jobsWithExtra.length > (options.limit ?? 10))
      nextCursor = jobsWithExtra.pop()?.id ?? null

    return {
      data: jobsWithExtra,
      paging: {
        total_records: totalRecords,
        page: options.page || 1,
        total_pages: totalPages,
      },
      next_cursor: nextCursor,
    }
  }

  async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<JobResponse> {
    return await this.applyPaginate(options)
  }

  // Method to get all jobs
  static async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<JobResponse> {
    const instance = new JobModel(undefined)

    return await instance.applyPaginate(options)
  }

  async applyCreate(newJob: NewJob): Promise<JobModel> {
    const filteredValues = Object.fromEntries(
      Object.entries(newJob).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewJob

    await this.mapCustomSetters(filteredValues)

    const result = await DB.instance.insertInto('jobs')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await this.find(Number(result.numInsertedOrUpdatedRows)) as JobModel

    return model
  }

  async create(newJob: NewJob): Promise<JobModel> {
    return await this.applyCreate(newJob)
  }

  static async create(newJob: NewJob): Promise<JobModel> {
    const instance = new JobModel(undefined)

    return await instance.applyCreate(newJob)
  }

  static async createMany(newJob: NewJob[]): Promise<void> {
    const instance = new JobModel(undefined)

    const valuesFiltered = newJob.map((newJob: NewJob) => {
      const filteredValues = Object.fromEntries(
        Object.entries(newJob).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewJob

      return filteredValues
    })

    await DB.instance.insertInto('jobs')
      .values(valuesFiltered)
      .executeTakeFirst()
  }

  static async forceCreate(newJob: NewJob): Promise<JobModel> {
    const result = await DB.instance.insertInto('jobs')
      .values(newJob)
      .executeTakeFirst()

    const model = await find(Number(result.numInsertedOrUpdatedRows)) as JobModel

    return model
  }

  // Method to remove a Job
  static async remove(id: number): Promise<any> {
    return await DB.instance.deleteFrom('jobs')
      .where('id', '=', id)
      .execute()
  }

  static where<V = string>(column: keyof JobsTable, ...args: [V] | [Operator, V]): JobModel {
    const instance = new JobModel(undefined)

    return instance.applyWhere<V>(column, ...args)
  }

  static whereColumn(first: keyof JobsTable, operator: Operator, second: keyof JobsTable): JobModel {
    const instance = new JobModel(undefined)

    instance.selectFromQuery = instance.applyWhereColumn(first, operator, second)

    return instance
  }

  static whereRef(column: keyof JobsTable, ...args: string[]): JobModel {
    const instance = new JobModel(undefined)

    return instance.applyWhereRef(column, ...args)
  }

  static whereRaw(sqlStatement: string): JobModel {
    const instance = new JobModel(undefined)

    instance.selectFromQuery = instance.applyWhereRaw(sqlStatement)

    return instance
  }

  static orWhere(...conditions: [string, any][]): JobModel {
    const instance = new JobModel(undefined)

    return instance.applyOrWhere(...conditions)
  }

  static when(condition: boolean, callback: (query: JobModel) => JobModel): JobModel {
    const instance = new JobModel(undefined)

    return instance.applyWhen(condition, callback)
  }

  static whereNotNull(column: keyof JobsTable): JobModel {
    const instance = new UserModel(undefined)

    return instance.applyWhereNotNull(column)
  }

  static whereNull(column: keyof JobsTable): JobModel {
    const instance = new JobModel(undefined)

    return instance.applyWhereNull(column)
  }

  static whereQueue(value: string): JobModel {
    const instance = new JobModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('queue', '=', value)

    return instance
  }

  static wherePayload(value: string): JobModel {
    const instance = new JobModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('payload', '=', value)

    return instance
  }

  static whereAttempts(value: string): JobModel {
    const instance = new JobModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('attempts', '=', value)

    return instance
  }

  static whereAvailableAt(value: string): JobModel {
    const instance = new JobModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('available_at', '=', value)

    return instance
  }

  static whereReservedAt(value: string): JobModel {
    const instance = new JobModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('reserved_at', '=', value)

    return instance
  }

  static whereIn<V = number>(column: keyof JobsTable, values: V[]): JobModel {
    const instance = new JobModel(undefined)

    return instance.applyWhereIn<V>(column, values)
  }

  static whereBetween<V = number>(column: keyof JobsTable, range: [V, V]): JobModel {
    const instance = new JobModel(undefined)

    return instance.applyWhereBetween<V>(column, range)
  }

  static whereLike(column: keyof JobsTable, value: string): JobModel {
    const instance = new JobModel(undefined)

    return instance.applyWhereLike(column, value)
  }

  static whereNotIn<V = number>(column: keyof JobsTable, values: V[]): JobModel {
    const instance = new JobModel(undefined)

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

  static async latest(): Promise<JobModel | undefined> {
    const instance = new JobModel(undefined)

    const model = await DB.instance.selectFrom('jobs')
      .selectAll()
      .orderBy('id', 'desc')
      .executeTakeFirst()

    if (!model)
      return undefined

    instance.mapCustomGetters(model)

    const data = new JobModel(model)

    return data
  }

  static async oldest(): Promise<JobModel | undefined> {
    const instance = new JobModel(undefined)

    const model = await DB.instance.selectFrom('jobs')
      .selectAll()
      .orderBy('id', 'asc')
      .executeTakeFirst()

    if (!model)
      return undefined

    instance.mapCustomGetters(model)

    const data = new JobModel(model)

    return data
  }

  static async firstOrCreate(
    condition: Partial<JobJsonResponse>,
    newJob: NewJob,
  ): Promise<JobModel> {
    const instance = new JobModel(undefined)

    const key = Object.keys(condition)[0] as keyof JobJsonResponse

    if (!key) {
      throw new HttpError(500, 'Condition must contain at least one key-value pair')
    }

    const value = condition[key]

    // Attempt to find the first record matching the condition
    const existingJob = await DB.instance.selectFrom('jobs')
      .selectAll()
      .where(key, '=', value)
      .executeTakeFirst()

    if (existingJob) {
      instance.mapCustomGetters(existingJob)
      await instance.loadRelations(existingJob)

      return new JobModel(existingJob as JobJsonResponse)
    }
    else {
      return await instance.create(newJob)
    }
  }

  static async updateOrCreate(
    condition: Partial<JobJsonResponse>,
    newJob: NewJob,
  ): Promise<JobModel> {
    const instance = new JobModel(undefined)

    const key = Object.keys(condition)[0] as keyof JobJsonResponse

    if (!key) {
      throw new HttpError(500, 'Condition must contain at least one key-value pair')
    }

    const value = condition[key]

    // Attempt to find the first record matching the condition
    const existingJob = await DB.instance.selectFrom('jobs')
      .selectAll()
      .where(key, '=', value)
      .executeTakeFirst()

    if (existingJob) {
      // If found, update the existing record
      await DB.instance.updateTable('jobs')
        .set(newJob)
        .where(key, '=', value)
        .executeTakeFirstOrThrow()

      // Fetch and return the updated record
      const updatedJob = await DB.instance.selectFrom('jobs')
        .selectAll()
        .where(key, '=', value)
        .executeTakeFirst()

      if (!updatedJob) {
        throw new HttpError(500, 'Failed to fetch updated record')
      }

      instance.hasSaved = true

      return new JobModel(updatedJob as JobJsonResponse)
    }
    else {
      // If not found, create a new record
      return await instance.create(newJob)
    }
  }

  protected async loadRelations(models: JobJsonResponse | JobJsonResponse[]): Promise<void> {
    // Handle both single model and array of models
    const modelArray = Array.isArray(models) ? models : [models]
    if (!modelArray.length)
      return

    const modelIds = modelArray.map(model => model.id)

    for (const relation of this.withRelations) {
      const relatedRecords = await DB.instance
        .selectFrom(relation)
        .where('job_id', 'in', modelIds)
        .selectAll()
        .execute()

      if (Array.isArray(models)) {
        models.map((model: JobJsonResponse) => {
          const records = relatedRecords.filter((record: { job_id: number }) => {
            return record.job_id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      }
      else {
        const records = relatedRecords.filter((record: { job_id: number }) => {
          return record.job_id === models.id
        })

        models[relation] = records.length === 1 ? records[0] : records
      }
    }
  }

  static with(relations: string[]): JobModel {
    const instance = new JobModel(undefined)

    instance.withRelations = relations

    return instance
  }

  async last(): Promise<JobModel | undefined> {
    const model = await this.applyLast()

    const data = new JobModel(model)

    return data
  }

  static async last(): Promise<JobModel | undefined> {
    const instance = new JobModel(undefined)

    const model = await instance.applyLast()

    if (!model)
      return undefined

    const data = new JobModel(model)

    return data
  }

  static orderBy(column: keyof JobsTable, order: 'asc' | 'desc'): JobModel {
    const instance = new UserModel(undefined)

    return instance.applyOrderBy(column, order)
  }

  static groupBy(column: keyof JobsTable): JobModel {
    const instance = new JobModel(undefined)

    return instance.applyGroupBy(column)
  }

  static having<V = string>(column: keyof JobsTable, operator: Operator, value: V): JobModel {
    const instance = new JobModel(undefined)

    return instance.applyHaving(column, operator, value)
  }

  static inRandomOrder(): JobModel {
    const instance = new JobModel(undefined)

    return instance.applyInRandomOrder()
  }

  static orderByDesc(column: keyof JobsTable): JobModel {
    const instance = new JobModel(undefined)

    return instance.applyOrderByDesc(column)
  }

  static orderByAsc(column: keyof JobsTable): JobModel {
    const instance = new JobModel(undefined)

    return instance.applyOrderByAsc(column)
  }

  async update(newJob: JobUpdate): Promise<JobModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newJob).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewJob

    await this.mapCustomSetters(filteredValues)

    await DB.instance.updateTable('jobs')
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

  async forceUpdate(job: JobUpdate): Promise<JobModel | undefined> {
    if (this.id === undefined) {
      this.updateFromQuery.set(job).execute()
    }

    await this.mapCustomSetters(job)

    await DB.instance.updateTable('jobs')
      .set(job)
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
      throw new HttpError(500, 'Job data is undefined')

    await this.mapCustomSetters(this.attributes)

    if (this.id === undefined) {
      await this.create(this.attributes)
    }
    else {
      await this.update(this.attributes)
    }

    this.hasSaved = true
  }

  fill(data: Partial<JobJsonResponse>): JobModel {
    const filteredValues = Object.fromEntries(
      Object.entries(data).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewJob

    this.attributes = {
      ...this.attributes,
      ...filteredValues,
    }

    return this
  }

  forceFill(data: Partial<JobJsonResponse>): JobModel {
    this.attributes = {
      ...this.attributes,
      ...data,
    }

    return this
  }

  // Method to delete (soft delete) the job instance
  async delete(): Promise<JobsTable> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()

    return await DB.instance.deleteFrom('jobs')
      .where('id', '=', this.id)
      .execute()
  }

  distinct(column: keyof JobJsonResponse): JobModel {
    this.selectFromQuery = this.selectFromQuery.select(column).distinct()

    this.hasSelect = true

    return this
  }

  static distinct(column: keyof JobJsonResponse): JobModel {
    const instance = new JobModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.select(column).distinct()

    instance.hasSelect = true

    return instance
  }

  join(table: string, firstCol: string, secondCol: string): JobModel {
    this.selectFromQuery = this.selectFromQuery.innerJoin(table, firstCol, secondCol)

    return this
  }

  static join(table: string, firstCol: string, secondCol: string): JobModel {
    const instance = new JobModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.innerJoin(table, firstCol, secondCol)

    return instance
  }

  toJSON(): JobJsonResponse {
    const output = {

      id: this.id,
      queue: this.queue,
      payload: this.payload,
      attempts: this.attempts,
      available_at: this.available_at,
      reserved_at: this.reserved_at,

      created_at: this.created_at,

      updated_at: this.updated_at,

      ...this.customColumns,
    }

    return output
  }

  parseResult(model: JobModel): JobModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof JobModel]
    }

    return model
  }
}

async function find(id: number): Promise<JobModel | undefined> {
  const query = DB.instance.selectFrom('jobs').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  return new JobModel(model)
}

export async function count(): Promise<number> {
  const results = await JobModel.count()

  return results
}

export async function create(newJob: NewJob): Promise<JobModel> {
  const result = await DB.instance.insertInto('jobs')
    .values(newJob)
    .executeTakeFirstOrThrow()

  return await find(Number(result.numInsertedOrUpdatedRows)) as JobModel
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(DB.instance)
}

export async function remove(id: number): Promise<void> {
  await DB.instance.deleteFrom('jobs')
    .where('id', '=', id)
    .execute()
}

export async function whereQueue(value: string): Promise<JobModel[]> {
  const query = DB.instance.selectFrom('jobs').where('queue', '=', value)
  const results: JobJsonResponse = await query.execute()

  return results.map((modelItem: JobJsonResponse) => new JobModel(modelItem))
}

export async function wherePayload(value: string): Promise<JobModel[]> {
  const query = DB.instance.selectFrom('jobs').where('payload', '=', value)
  const results: JobJsonResponse = await query.execute()

  return results.map((modelItem: JobJsonResponse) => new JobModel(modelItem))
}

export async function whereAttempts(value: number): Promise<JobModel[]> {
  const query = DB.instance.selectFrom('jobs').where('attempts', '=', value)
  const results: JobJsonResponse = await query.execute()

  return results.map((modelItem: JobJsonResponse) => new JobModel(modelItem))
}

export async function whereAvailableAt(value: number): Promise<JobModel[]> {
  const query = DB.instance.selectFrom('jobs').where('available_at', '=', value)
  const results: JobJsonResponse = await query.execute()

  return results.map((modelItem: JobJsonResponse) => new JobModel(modelItem))
}

export async function whereReservedAt(value: Date | string): Promise<JobModel[]> {
  const query = DB.instance.selectFrom('jobs').where('reserved_at', '=', value)
  const results: JobJsonResponse = await query.execute()

  return results.map((modelItem: JobJsonResponse) => new JobModel(modelItem))
}

export const Job = JobModel

export default Job
