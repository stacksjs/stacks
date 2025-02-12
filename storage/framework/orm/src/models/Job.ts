import type { Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import { cache } from '@stacksjs/cache'
import { sql } from '@stacksjs/database'
import { HttpError, ModelNotFoundException } from '@stacksjs/error-handling'
import { dispatch } from '@stacksjs/events'
import { DB, SubqueryBuilder } from '@stacksjs/orm'

export interface JobsTable {
  id?: number
  queue?: string
  payload?: string
  attempts?: number
  available_at?: number
  reserved_at?: Date | string

  created_at?: Date

  updated_at?: Date

}

interface JobResponse {
  data: JobJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface JobJsonResponse extends Omit<JobsTable, 'password'> {
  [key: string]: any
}

export type JobType = Selectable<JobsTable>
export type NewJob = Partial<Insertable<JobsTable>>
export type JobUpdate = Updateable<JobsTable>

      type SortDirection = 'asc' | 'desc'
interface SortOptions { column: JobType, order: SortDirection }
// Define a type for the options parameter
interface QueryOptions {
  sort?: SortOptions
  limit?: number
  offset?: number
  page?: number
}

export class JobModel {
  private readonly hidden: Array<keyof JobJsonResponse> = []
  private readonly fillable: Array<keyof JobJsonResponse> = ['queue', 'payload', 'attempts', 'available_at', 'reserved_at', 'uuid']
  private readonly guarded: Array<keyof JobJsonResponse> = []
  protected attributes: Partial<JobJsonResponse> = {}
  protected originalAttributes: Partial<JobJsonResponse> = {}

  protected selectFromQuery: any
  protected withRelations: string[]
  protected updateFromQuery: any
  protected deleteFromQuery: any
  protected hasSelect: boolean
  private hasSaved: boolean
  private customColumns: Record<string, unknown> = {}

  constructor(job: Partial<JobType> | null) {
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

  mapCustomGetters(models: JobJsonResponse | JobJsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: JobJsonResponse) => {
        const customGetter = {

        }

        return model
      })
    }
    else {
      const model = data

      const customGetter = {

      }
    }
  }

  async mapCustomSetters(model: JobJsonResponse): Promise<void> {
    const customSetter = {

    }
  }

  get id(): number | undefined {
    return this.attributes.id
  }

  get queue(): string | undefined {
    return this.attributes.queue
  }

  get payload(): string | undefined {
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

  getOriginal(column?: keyof JobType): Partial<JobType> {
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

  isDirty(column?: keyof JobType): boolean {
    if (column) {
      return this.attributes[column] !== this.originalAttributes[column]
    }

    return Object.entries(this.originalAttributes).some(([key, originalValue]) => {
      const currentValue = (this.attributes as any)[key]

      return currentValue !== originalValue
    })
  }

  isClean(column?: keyof JobType): boolean {
    return !this.isDirty(column)
  }

  wasChanged(column?: keyof JobType): boolean {
    return this.hasSaved && this.isDirty(column)
  }

  select(params: (keyof JobType)[] | RawBuilder<string> | string): JobModel {
    this.selectFromQuery = this.selectFromQuery.select(params)

    this.hasSelect = true

    return this
  }

  static select(params: (keyof JobType)[] | RawBuilder<string> | string): JobModel {
    const instance = new JobModel(null)

    // Initialize a query with the table name and selected fields
    instance.selectFromQuery = instance.selectFromQuery.select(params)

    instance.hasSelect = true

    return instance
  }

  async applyFind(id: number): Promise<JobModel | undefined> {
    const model = await DB.instance.selectFrom('jobs').where('id', '=', id).selectAll().executeTakeFirst()

    if (!model)
      return undefined

    this.mapCustomGetters(model)
    await this.loadRelations(model)

    const data = new JobModel(model as JobType)

    cache.getOrSet(`job:${id}`, JSON.stringify(model))

    return data
  }

  async find(id: number): Promise<JobModel | undefined> {
    return await this.applyFind(id)
  }

  // Method to find a Job by ID
  static async find(id: number): Promise<JobModel | undefined> {
    const instance = new JobModel(null)

    return await instance.applyFind(id)
  }

  async first(): Promise<JobModel | undefined> {
    let model: JobModel | undefined

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

    const data = new JobModel(model as JobType)

    return data
  }

  static async first(): Promise<JobModel | undefined> {
    const instance = new JobModel(null)

    const model = await DB.instance.selectFrom('jobs')
      .selectAll()
      .executeTakeFirst()

    instance.mapCustomGetters(model)

    const data = new JobModel(model as JobType)

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

    const data = new JobModel(model as JobType)

    return data
  }

  async firstOrFail(): Promise<JobModel | undefined> {
    return await this.applyFirstOrFail()
  }

  static async firstOrFail(): Promise<JobModel | undefined> {
    const instance = new JobModel(null)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<JobModel[]> {
    const instance = new JobModel(null)

    const models = await DB.instance.selectFrom('jobs').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: JobType) => {
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

    const data = new JobModel(model as JobType)

    return data
  }

  async findOrFail(id: number): Promise<JobModel> {
    return await this.applyFindOrFail(id)
  }

  static async findOrFail(id: number): Promise<JobModel> {
    const instance = new JobModel(null)

    return await instance.applyFindOrFail(id)
  }

  async applyFindMany(ids: number[]): Promise<JobModel[]> {
    let query = DB.instance.selectFrom('jobs').where('id', 'in', ids)

    const instance = new JobModel(null)

    query = query.selectAll()

    const models = await query.execute()

    instance.mapCustomGetters(models)
    await instance.loadRelations(models)

    return models.map((modelItem: JobModel) => instance.parseResult(new JobModel(modelItem)))
  }

  static async findMany(ids: number[]): Promise<JobModel[]> {
    const instance = new JobModel(null)

    return await instance.applyFindMany(ids)
  }

  async findMany(ids: number[]): Promise<JobModel[]> {
    return await this.applyFindMany(ids)
  }

  skip(count: number): JobModel {
    this.selectFromQuery = this.selectFromQuery.offset(count)

    return this
  }

  static skip(count: number): JobModel {
    const instance = new JobModel(null)

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
    const instance = new JobModel(null)

    await instance.applyChunk(size, callback)
  }

  take(count: number): JobModel {
    this.selectFromQuery = this.selectFromQuery.limit(count)

    return this
  }

  static take(count: number): JobModel {
    const instance = new JobModel(null)

    instance.selectFromQuery = instance.selectFromQuery.limit(count)

    return instance
  }

  static async pluck<K extends keyof JobModel>(field: K): Promise<JobModel[K][]> {
    const instance = new JobModel(null)

    if (instance.hasSelect) {
      const model = await instance.selectFromQuery.execute()
      return model.map((modelItem: JobModel) => modelItem[field])
    }

    const model = await instance.selectFromQuery.selectAll().execute()

    return model.map((modelItem: JobModel) => modelItem[field])
  }

  async pluck<K extends keyof JobModel>(field: K): Promise<JobModel[K][]> {
    return JobModel.pluck(field)
  }

  static async count(): Promise<number> {
    const instance = new JobModel(null)

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
    const instance = new JobModel(null)

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
    const instance = new JobModel(null)

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
    const instance = new JobModel(null)

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
    const instance = new JobModel(null)

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

    const data = await Promise.all(models.map(async (model: JobModel) => {
      return new JobModel(model)
    }))

    return data
  }

  async get(): Promise<JobModel[]> {
    return await this.applyGet()
  }

  static async get(): Promise<JobModel[]> {
    const instance = new JobModel(null)

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
    const instance = new JobModel(null)

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
    const instance = new JobModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(callback({ exists, selectFrom })),
    )

    return instance
  }

  applyWhereHas(
    relation: string,
    callback: (query: SubqueryBuilder) => void,
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
  ): JobModel {
    return this.applyWhereHas(relation, callback)
  }

  static whereHas(
    relation: string,
    callback: (query: SubqueryBuilder) => void,
  ): JobModel {
    const instance = new JobModel(null)

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
    const instance = new JobModel(null)

    return instance.doesntHave(relation)
  }

  applyWhereDoesntHave(relation: string, callback: (query: SubqueryBuilder) => void): JobModel {
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    this.selectFromQuery = this.selectFromQuery
      .where(({ exists, selectFrom, not }: any) => {
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

  whereDoesntHave(relation: string, callback: (query: SubqueryBuilder) => void): JobModel {
    return this.applyWhereDoesntHave(relation, callback)
  }

  static whereDoesntHave(
    relation: string,
    callback: (query: SubqueryBuilder) => void,
  ): JobModel {
    const instance = new JobModel(null)

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
    const instance = new JobModel(null)

    return await instance.applyPaginate(options)
  }

  async applyCreate(newJob: NewJob): Promise<JobModel> {
    const filteredValues = Object.fromEntries(
      Object.entries(newJob).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewJob

    const result = await DB.instance.insertInto('jobs')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await this.find(Number(result.numInsertedOrUpdatedRows)) as JobModel

    if (model)
      dispatch('job:created', model)

    return model
  }

  async create(newJob: NewJob): Promise<JobModel> {
    return await this.applyCreate(newJob)
  }

  static async create(newJob: NewJob): Promise<JobModel> {
    const instance = new JobModel(null)

    return await instance.applyCreate(newJob)
  }

  static async createMany(newJob: NewJob[]): Promise<void> {
    const instance = new JobModel(null)

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

  applyWhere(instance: JobModel, column: string, ...args: any[]): JobModel {
    const [operatorOrValue, value] = args
    const operator = value === undefined ? '=' : operatorOrValue
    const actualValue = value === undefined ? operatorOrValue : value

    instance.selectFromQuery = instance.selectFromQuery.where(column, operator, actualValue)
    instance.updateFromQuery = instance.updateFromQuery.where(column, operator, actualValue)
    instance.deleteFromQuery = instance.deleteFromQuery.where(column, operator, actualValue)

    return instance
  }

  where(column: string, ...args: any[]): JobModel {
    return this.applyWhere(this, column, ...args)
  }

  static where(column: string, ...args: any[]): JobModel {
    const instance = new JobModel(null)

    return instance.applyWhere(instance, column, ...args)
  }

  whereColumn(first: string, operator: string, second: string): JobModel {
    this.selectFromQuery = this.selectFromQuery.whereRef(first, operator, second)

    return this
  }

  static whereColumn(first: string, operator: string, second: string): JobModel {
    const instance = new JobModel(null)

    instance.selectFromQuery = instance.selectFromQuery.whereRef(first, operator, second)

    return instance
  }

  applyWhereRef(column: string, ...args: string[]): JobModel {
    const [operatorOrValue, value] = args
    const operator = value === undefined ? '=' : operatorOrValue
    const actualValue = value === undefined ? operatorOrValue : value

    const instance = new JobModel(null)
    instance.selectFromQuery = instance.selectFromQuery.whereRef(column, operator, actualValue)

    return instance
  }

  whereRef(column: string, ...args: string[]): JobModel {
    return this.applyWhereRef(column, ...args)
  }

  static whereRef(column: string, ...args: string[]): JobModel {
    const instance = new JobModel(null)

    return instance.applyWhereRef(column, ...args)
  }

  whereRaw(sqlStatement: string): JobModel {
    this.selectFromQuery = this.selectFromQuery.where(sql`${sqlStatement}`)

    return this
  }

  static whereRaw(sqlStatement: string): JobModel {
    const instance = new JobModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(sql`${sqlStatement}`)

    return instance
  }

  applyOrWhere(...conditions: [string, any][]): JobModel {
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

  orWhere(...conditions: [string, any][]): JobModel {
    return this.applyOrWhere(...conditions)
  }

  static orWhere(...conditions: [string, any][]): JobModel {
    const instance = new JobModel(null)

    return instance.applyOrWhere(...conditions)
  }

  when(
    condition: boolean,
    callback: (query: JobModel) => JobModel,
  ): JobModel {
    return JobModel.when(condition, callback)
  }

  static when(
    condition: boolean,
    callback: (query: JobModel) => JobModel,
  ): JobModel {
    let instance = new JobModel(null)

    if (condition)
      instance = callback(instance)

    return instance
  }

  whereNull(column: string): JobModel {
    return JobModel.whereNull(column)
  }

  static whereNull(column: string): JobModel {
    const instance = new JobModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    instance.updateFromQuery = instance.updateFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    return instance
  }

  static whereQueue(value: string): JobModel {
    const instance = new JobModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('queue', '=', value)

    return instance
  }

  static wherePayload(value: string): JobModel {
    const instance = new JobModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('payload', '=', value)

    return instance
  }

  static whereAttempts(value: string): JobModel {
    const instance = new JobModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('attempts', '=', value)

    return instance
  }

  static whereAvailableAt(value: string): JobModel {
    const instance = new JobModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('available_at', '=', value)

    return instance
  }

  static whereReservedAt(value: string): JobModel {
    const instance = new JobModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('reserved_at', '=', value)

    return instance
  }

  whereIn(column: keyof JobType, values: any[]): JobModel {
    return JobModel.whereIn(column, values)
  }

  static whereIn(column: keyof JobType, values: any[]): JobModel {
    const instance = new JobModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(column, 'in', values)

    instance.updateFromQuery = instance.updateFromQuery.where(column, 'in', values)

    instance.deleteFromQuery = instance.deleteFromQuery.where(column, 'in', values)

    return instance
  }

  applyWhereBetween(column: keyof JobType, range: [any, any]): JobModel {
    if (range.length !== 2) {
      throw new HttpError(500, 'Range must have exactly two values: [min, max]')
    }

    const query = sql` ${sql.raw(column as string)} between ${range[0]} and ${range[1]} `

    this.selectFromQuery = this.selectFromQuery.where(query)
    this.updateFromQuery = this.updateFromQuery.where(query)
    this.deleteFromQuery = this.deleteFromQuery.where(query)

    return this
  }

  whereBetween(column: keyof JobType, range: [any, any]): JobModel {
    return this.applyWhereBetween(column, range)
  }

  static whereBetween(column: keyof JobType, range: [any, any]): JobModel {
    const instance = new JobModel(null)

    return instance.applyWhereBetween(column, range)
  }

  applyWhereLike(column: keyof JobType, value: string): JobModel {
    this.selectFromQuery = this.selectFromQuery.where(sql` ${sql.raw(column as string)} LIKE ${value}`)

    this.updateFromQuery = this.updateFromQuery.where(sql` ${sql.raw(column as string)} LIKE ${value}`)

    this.deleteFromQuery = this.deleteFromQuery.where(sql` ${sql.raw(column as string)} LIKE ${value}`)

    return this
  }

  whereLike(column: keyof JobType, value: string): JobModel {
    return this.applyWhereLike(column, value)
  }

  static whereLike(column: keyof JobType, value: string): JobModel {
    const instance = new JobModel(null)

    return instance.applyWhereLike(column, value)
  }

  applyWhereNotIn(column: keyof JobType, values: any[]): JobModel {
    this.selectFromQuery = this.selectFromQuery.where(column, 'not in', values)

    this.updateFromQuery = this.updateFromQuery.where(column, 'not in', values)

    this.deleteFromQuery = this.deleteFromQuery.where(column, 'not in', values)

    return this
  }

  whereNotIn(column: keyof JobType, values: any[]): JobModel {
    return this.applyWhereNotIn(column, values)
  }

  static whereNotIn(column: keyof JobType, values: any[]): JobModel {
    const instance = new JobModel(null)

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

  static async latest(): Promise<JobType | undefined> {
    const instance = new JobModel(null)

    const model = await DB.instance.selectFrom('jobs')
      .selectAll()
      .orderBy('id', 'desc')
      .executeTakeFirst()

    if (!model)
      return undefined

    instance.mapCustomGetters(model)

    const data = new JobModel(model as JobType)

    return data
  }

  static async oldest(): Promise<JobType | undefined> {
    const instance = new JobModel(null)

    const model = await DB.instance.selectFrom('jobs')
      .selectAll()
      .orderBy('id', 'asc')
      .executeTakeFirst()

    if (!model)
      return undefined

    instance.mapCustomGetters(model)

    const data = new JobModel(model as JobType)

    return data
  }

  static async firstOrCreate(
    condition: Partial<JobType>,
    newJob: NewJob,
  ): Promise<JobModel> {
    const instance = new JobModel(null)

    const key = Object.keys(condition)[0] as keyof JobType

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

      return new JobModel(existingJob as JobType)
    }
    else {
      return await instance.create(newJob)
    }
  }

  static async updateOrCreate(
    condition: Partial<JobType>,
    newJob: NewJob,
  ): Promise<JobModel> {
    const instance = new JobModel(null)

    const key = Object.keys(condition)[0] as keyof JobType

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

      return new JobModel(updatedJob as JobType)
    }
    else {
      // If not found, create a new record
      return await instance.create(newJob)
    }
  }

  async loadRelations(models: JobJsonResponse | JobJsonResponse[]): Promise<void> {
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

  with(relations: string[]): JobModel {
    this.withRelations = relations

    return this
  }

  static with(relations: string[]): JobModel {
    const instance = new JobModel(null)

    instance.withRelations = relations

    return instance
  }

  async last(): Promise<JobType | undefined> {
    let model: JobModel | undefined

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

    const data = new JobModel(model as JobType)

    return data
  }

  static async last(): Promise<JobType | undefined> {
    const model = await DB.instance.selectFrom('jobs').selectAll().orderBy('id', 'desc').executeTakeFirst()

    if (!model)
      return undefined

    const data = new JobModel(model as JobType)

    return data
  }

  orderBy(column: keyof JobType, order: 'asc' | 'desc'): JobModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, order)

    return this
  }

  static orderBy(column: keyof JobType, order: 'asc' | 'desc'): JobModel {
    const instance = new JobModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, order)

    return instance
  }

  groupBy(column: keyof JobType): JobModel {
    this.selectFromQuery = this.selectFromQuery.groupBy(column)

    return this
  }

  static groupBy(column: keyof JobType): JobModel {
    const instance = new JobModel(null)

    instance.selectFromQuery = instance.selectFromQuery.groupBy(column)

    return instance
  }

  having(column: keyof JobType, operator: string, value: any): JobModel {
    this.selectFromQuery = this.selectFromQuery.having(column, operator, value)

    return this
  }

  static having(column: keyof JobType, operator: string, value: any): JobModel {
    const instance = new JobModel(null)

    instance.selectFromQuery = instance.selectFromQuery.having(column, operator, value)

    return instance
  }

  inRandomOrder(): JobModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(sql` ${sql.raw('RANDOM()')} `)

    return this
  }

  static inRandomOrder(): JobModel {
    const instance = new JobModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(sql` ${sql.raw('RANDOM()')} `)

    return instance
  }

  orderByDesc(column: keyof JobType): JobModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, 'desc')

    return this
  }

  static orderByDesc(column: keyof JobType): JobModel {
    const instance = new JobModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'desc')

    return instance
  }

  orderByAsc(column: keyof JobType): JobModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, 'asc')

    return this
  }

  static orderByAsc(column: keyof JobType): JobModel {
    const instance = new JobModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'asc')

    return instance
  }

  async update(newJob: JobUpdate): Promise<JobModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newJob).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewJob

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

    const filteredValues = Object.fromEntries(
      Object.entries(this.attributes).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewJob

    if (this.id === undefined) {
      await DB.instance.insertInto('jobs')
        .values(filteredValues)
        .executeTakeFirstOrThrow()
    }
    else {
      await this.update(this.attributes)
    }

    this.hasSaved = true
  }

  fill(data: Partial<JobType>): JobModel {
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

  forceFill(data: Partial<JobType>): JobModel {
    this.attributes = {
      ...this.attributes,
      ...data,
    }

    return this
  }

  // Method to delete (soft delete) the job instance
  async delete(): Promise<any> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()

    return await DB.instance.deleteFrom('jobs')
      .where('id', '=', this.id)
      .execute()
  }

  distinct(column: keyof JobType): JobModel {
    this.selectFromQuery = this.selectFromQuery.select(column).distinct()

    this.hasSelect = true

    return this
  }

  static distinct(column: keyof JobType): JobModel {
    const instance = new JobModel(null)

    instance.selectFromQuery = instance.selectFromQuery.select(column).distinct()

    instance.hasSelect = true

    return instance
  }

  join(table: string, firstCol: string, secondCol: string): JobModel {
    this.selectFromQuery = this.selectFromQuery.innerJoin(table, firstCol, secondCol)

    return this
  }

  static join(table: string, firstCol: string, secondCol: string): JobModel {
    const instance = new JobModel(null)

    instance.selectFromQuery = instance.selectFromQuery.innerJoin(table, firstCol, secondCol)

    return instance
  }

  toJSON(): Partial<JobJsonResponse> {
    const output: Partial<JobJsonResponse> = {

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
  const results = await query.execute()

  return results.map((modelItem: JobModel) => new JobModel(modelItem))
}

export async function wherePayload(value: string): Promise<JobModel[]> {
  const query = DB.instance.selectFrom('jobs').where('payload', '=', value)
  const results = await query.execute()

  return results.map((modelItem: JobModel) => new JobModel(modelItem))
}

export async function whereAttempts(value: number): Promise<JobModel[]> {
  const query = DB.instance.selectFrom('jobs').where('attempts', '=', value)
  const results = await query.execute()

  return results.map((modelItem: JobModel) => new JobModel(modelItem))
}

export async function whereAvailableAt(value: number): Promise<JobModel[]> {
  const query = DB.instance.selectFrom('jobs').where('available_at', '=', value)
  const results = await query.execute()

  return results.map((modelItem: JobModel) => new JobModel(modelItem))
}

export async function whereReservedAt(value: Date | string): Promise<JobModel[]> {
  const query = DB.instance.selectFrom('jobs').where('reserved_at', '=', value)
  const results = await query.execute()

  return results.map((modelItem: JobModel) => new JobModel(modelItem))
}

export const Job = JobModel

export default Job
