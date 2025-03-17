import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import { cache } from '@stacksjs/cache'
import { sql } from '@stacksjs/database'
import { ModelNotFoundException } from '@stacksjs/error-handling'
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

    return instance.applyWith(relations)
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

  static select(params: (keyof JobJsonResponse)[] | RawBuilder<string> | string): JobModel {
    const instance = new JobModel(undefined)

    return instance.applySelect(params)
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

  static skip(count: number): JobModel {
    const instance = new JobModel(undefined)

    return instance.applySkip(count)
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

  static take(count: number): JobModel {
    const instance = new JobModel(undefined)

    return instance.applyTake(count)
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

    return instance.applyCount()
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
  async delete(): Promise<JobsTable> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()

    return await DB.instance.deleteFrom('jobs')
      .where('id', '=', this.id)
      .execute()
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

  distinct(column: keyof JobJsonResponse): JobModel {
    return this.applyDistinct(column)
  }

  static distinct(column: keyof JobJsonResponse): JobModel {
    const instance = new JobModel(undefined)

    return instance.applyDistinct(column)
  }

  join(table: string, firstCol: string, secondCol: string): JobModel {
    return this.applyJoin(table, firstCol, secondCol)
  }

  static join(table: string, firstCol: string, secondCol: string): JobModel {
    const instance = new JobModel(undefined)

    return instance.applyJoin(table, firstCol, secondCol)
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
