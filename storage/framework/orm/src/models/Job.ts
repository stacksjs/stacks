import type { Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import { randomUUIDv7 } from 'bun'
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
  protected attributes: Partial<JobType> = {}
  protected originalAttributes: Partial<JobType> = {}

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

  getOriginal(column?: keyof JobType): Partial<UserType> | any {
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

  wasChanged(column?: keyof JobType): boolean {
    return this.hasSaved && this.isDirty(column)
  }

  select(params: (keyof JobType)[] | RawBuilder<string> | string): JobModel {
    return JobModel.select(params)
  }

  static select(params: (keyof JobType)[] | RawBuilder<string> | string): JobModel {
    const instance = new JobModel(null)

    // Initialize a query with the table name and selected fields
    instance.selectFromQuery = instance.selectFromQuery.select(params)

    instance.hasSelect = true

    return instance
  }

  async find(id: number): Promise<JobModel | undefined> {
    return await JobModel.find(id)
  }

  // Method to find a Job by ID
  static async find(id: number): Promise<JobModel | undefined> {
    const model = await DB.instance.selectFrom('jobs').where('id', '=', id).selectAll().executeTakeFirst()

    if (!model)
      return undefined

    const instance = new JobModel(null)

    const result = await instance.mapWith(model)

    const data = new JobModel(result as JobType)

    cache.getOrSet(`job:${id}`, JSON.stringify(model))

    return data
  }

  async first(): Promise<JobModel | undefined> {
    return await JobModel.first()
  }

  static async first(): Promise<JobModel | undefined> {
    const model = await DB.instance.selectFrom('jobs')
      .selectAll()
      .executeTakeFirst()

    if (!model)
      return undefined

    const instance = new JobModel(null)

    const result = await instance.mapWith(model)

    const data = new JobModel(result as JobType)

    return data
  }

  async firstOrFail(): Promise<JobModel | undefined> {
    return await JobModel.firstOrFail()
  }

  static async firstOrFail(): Promise<JobModel | undefined> {
    const instance = new JobModel(null)

    const model = await instance.selectFromQuery.executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, 'No JobModel results found for query')

    const result = await instance.mapWith(model)

    const data = new JobModel(result as JobType)

    return data
  }

  async mapWith(model: JobType): Promise<JobType> {
    return model
  }

  static async all(): Promise<JobModel[]> {
    const models = await DB.instance.selectFrom('jobs').selectAll().execute()

    const data = await Promise.all(models.map(async (model: JobType) => {
      const instance = new JobModel(model)

      const results = await instance.mapWith(model)

      return new JobModel(results)
    }))

    return data
  }

  async findOrFail(id: number): Promise<JobModel> {
    return await JobModel.findOrFail(id)
  }

  static async findOrFail(id: number): Promise<JobModel> {
    const model = await DB.instance.selectFrom('jobs').where('id', '=', id).selectAll().executeTakeFirst()

    const instance = new JobModel(null)

    if (model === undefined)
      throw new ModelNotFoundException(404, `No JobModel results for ${id}`)

    cache.getOrSet(`job:${id}`, JSON.stringify(model))

    const result = await instance.mapWith(model)

    const data = new JobModel(result as JobType)

    return data
  }

  static async findMany(ids: number[]): Promise<JobModel[]> {
    let query = DB.instance.selectFrom('jobs').where('id', 'in', ids)

    const instance = new JobModel(null)

    query = query.selectAll()

    const model = await query.execute()

    return model.map((modelItem: JobModel) => instance.parseResult(new JobModel(modelItem)))
  }

  skip(count: number): JobModel {
    return JobModel.skip(count)
  }

  static skip(count: number): JobModel {
    const instance = new JobModel(null)

    instance.selectFromQuery = instance.selectFromQuery.offset(count)

    return instance
  }

  take(count: number): JobModel {
    return JobModel.take(count)
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

    return instance.selectFromQuery
      .select(sql`COUNT(*) as count`)
      .executeTakeFirst()
  }

  async count(): Promise<number> {
    return JobModel.count()
  }

  async max(field: keyof JobModel): Promise<number> {
    return await this.selectFromQuery
      .select(sql`MAX(${sql.raw(field as string)}) `)
      .executeTakeFirst()
  }

  async min(field: keyof JobModel): Promise<number> {
    return await this.selectFromQuery
      .select(sql`MIN(${sql.raw(field as string)}) `)
      .executeTakeFirst()
  }

  async avg(field: keyof JobModel): Promise<number> {
    return this.selectFromQuery
      .select(sql`AVG(${sql.raw(field as string)})`)
      .executeTakeFirst()
  }

  async sum(field: keyof JobModel): Promise<number> {
    return this.selectFromQuery
      .select(sql`SUM(${sql.raw(field as string)})`)
      .executeTakeFirst()
  }

  async get(): Promise<JobModel[]> {
    return JobModel.get()
  }

  static async get(): Promise<JobModel[]> {
    const instance = new JobModel(null)

    let models

    if (instance.hasSelect) {
      models = await instance.selectFromQuery.execute()
    }
    else {
      models = await instance.selectFromQuery.selectAll().execute()
    }

    const data = await Promise.all(models.map(async (model: JobModel) => {
      const instance = new JobModel(model)

      const results = await instance.mapWith(model)

      return new JobModel(results)
    }))

    return data
  }

  has(relation: string): JobModel {
    return JobModel.has(relation)
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

  whereHas(
    relation: string,
    callback: (query: SubqueryBuilder) => void,
  ): JobModel {
    return JobModel.whereHas(relation, callback)
  }

  static whereHas(
    relation: string,
    callback: (query: SubqueryBuilder) => void,
  ): JobModel {
    const instance = new JobModel(null)
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    instance.selectFromQuery = instance.selectFromQuery
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

    return instance
  }

  doesntHave(relation: string): JobModel {
    return JobModel.doesntHave(relation)
  }

  static doesntHave(relation: string): JobModel {
    const instance = new JobModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(({ not, exists, selectFrom }: any) =>
      not(
        exists(
          selectFrom(relation)
            .select('1')
            .whereRef(`${relation}.job_id`, '=', 'jobs.id'),
        ),
      ),
    )

    return instance
  }

  whereDoesntHave(relation: string, callback: (query: SubqueryBuilder) => void): JobModel {
    return JobModel.whereDoesntHave(relation, callback)
  }

  static whereDoesntHave(
    relation: string,
    callback: (query: SubqueryBuilder) => void,
  ): JobModel {
    const instance = new JobModel(null)
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    instance.selectFromQuery = instance.selectFromQuery
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

    return instance
  }

  async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<JobResponse> {
    return JobModel.paginate(options)
  }

  // Method to get all jobs
  static async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<JobResponse> {
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

  static async create(newJob: NewJob): Promise<JobModel> {
    const instance = new JobModel(null)

    const filteredValues = Object.fromEntries(
      Object.entries(newJob).filter(([key]) =>
        !instance.guarded.includes(key) && instance.fillable.includes(key),
      ),
    ) as NewJob

    const result = await DB.instance.insertInto('jobs')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await instance.find(Number(result.numInsertedOrUpdatedRows)) as JobModel

    if (model)
      dispatch('Jobs:created', model)

    return model
  }

  static async createMany(newJob: NewJob[]): Promise<void> {
    const instance = new JobModel(null)

    const filteredValues = newJob.map((newJob: NewJob) => {
      const filtered = Object.fromEntries(
        Object.entries(newJob).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewJob

      filtered.uuid = randomUUIDv7()
      return filtered
    })

    await DB.instance.insertInto('jobs')
      .values(filteredValues)
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

  private static applyWhere(instance: JobModel, column: string, operator: string, value: any): JobModel {
    instance.selectFromQuery = instance.selectFromQuery.where(column, operator, value)
    instance.updateFromQuery = instance.updateFromQuery.where(column, operator, value)
    instance.deleteFromQuery = instance.deleteFromQuery.where(column, operator, value)

    return instance
  }

  where(column: string, operator: string, value: any): JobModel {
    return JobModel.applyWhere(this, column, operator, value)
  }

  static where(column: string, operator: string, value: any): JobModel {
    const instance = new JobModel(null)

    return JobModel.applyWhere(instance, column, operator, value)
  }

  whereRef(column: string, operator: string, value: string): JobModel {
    return JobModel.whereRef(column, operator, value)
  }

  static whereRef(column: string, operator: string, value: string): JobModel {
    const instance = new JobModel(null)

    instance.selectFromQuery = instance.selectFromQuery.whereRef(column, operator, value)

    return instance
  }

  orWhere(...args: Array<[string, string, any]>): JobModel {
    return JobModel.orWhere(...args)
  }

  static orWhere(...args: Array<[string, string, any]>): JobModel {
    const instance = new JobModel(null)

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

  whereBetween(column: keyof JobType, range: [any, any]): JobModel {
    return JobModel.whereBetween(column, range)
  }

  static whereBetween(column: keyof JobType, range: [any, any]): JobModel {
    if (range.length !== 2) {
      throw new HttpError(500, 'Range must have exactly two values: [min, max]')
    }

    const instance = new JobModel(null)

    const query = sql` ${sql.raw(column as string)} between ${range[0]} and ${range[1]} `

    instance.selectFromQuery = instance.selectFromQuery.where(query)
    instance.updateFromQuery = instance.updateFromQuery.where(query)
    instance.deleteFromQuery = instance.deleteFromQuery.where(query)

    return instance
  }

  whereNotIn(column: keyof JobType, values: any[]): JobModel {
    return JobModel.whereNotIn(column, values)
  }

  static whereNotIn(column: keyof JobType, values: any[]): JobModel {
    const instance = new JobModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(column, 'not in', values)

    instance.updateFromQuery = instance.updateFromQuery.where(column, 'not in', values)

    instance.deleteFromQuery = instance.deleteFromQuery.where(column, 'not in', values)

    return instance
  }

  async exists(): Promise<boolean> {
    const model = await this.selectFromQuery.executeTakeFirst()

    return model !== null || model !== undefined
  }

  static async latest(): Promise<JobType | undefined> {
    const model = await DB.instance.selectFrom('jobs')
      .selectAll()
      .orderBy('created_at', 'desc')
      .executeTakeFirst()

    if (!model)
      return undefined

    const instance = new JobModel(null)
    const result = await instance.mapWith(model)
    const data = new JobModel(result as JobType)

    return data
  }

  static async oldest(): Promise<JobType | undefined> {
    const model = await DB.instance.selectFrom('jobs')
      .selectAll()
      .orderBy('created_at', 'asc')
      .executeTakeFirst()

    if (!model)
      return undefined

    const instance = new JobModel(null)
    const result = await instance.mapWith(model)
    const data = new JobModel(result as JobType)

    return data
  }

  static async firstOrCreate(
    condition: Partial<JobType>,
    newJob: NewJob,
  ): Promise<JobModel> {
    // Get the key and value from the condition object
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
      const instance = new JobModel(null)
      const result = await instance.mapWith(existingJob)
      return new JobModel(result as JobType)
    }
    else {
      return await this.create(newJob)
    }
  }

  static async updateOrCreate(
    condition: Partial<JobType>,
    newJob: NewJob,
  ): Promise<JobModel> {
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

      const instance = new JobModel(null)
      const result = await instance.mapWith(updatedJob)
      return new JobModel(result as JobType)
    }
    else {
      // If not found, create a new record
      return await this.create(newJob)
    }
  }

  with(relations: string[]): JobModel {
    return JobModel.with(relations)
  }

  static with(relations: string[]): JobModel {
    const instance = new JobModel(null)

    instance.withRelations = relations

    return instance
  }

  async last(): Promise<JobType | undefined> {
    return await DB.instance.selectFrom('jobs')
      .selectAll()
      .orderBy('id', 'desc')
      .executeTakeFirst()
  }

  static async last(): Promise<JobType | undefined> {
    const model = await DB.instance.selectFrom('jobs').selectAll().orderBy('id', 'desc').executeTakeFirst()

    if (!model)
      return undefined

    const instance = new JobModel(null)

    const result = await instance.mapWith(model)

    const data = new JobModel(result as JobType)

    return data
  }

  orderBy(column: keyof JobType, order: 'asc' | 'desc'): JobModel {
    return JobModel.orderBy(column, order)
  }

  static orderBy(column: keyof JobType, order: 'asc' | 'desc'): JobModel {
    const instance = new JobModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, order)

    return instance
  }

  groupBy(column: keyof JobType): JobModel {
    return JobModel.groupBy(column)
  }

  static groupBy(column: keyof JobType): JobModel {
    const instance = new JobModel(null)

    instance.selectFromQuery = instance.selectFromQuery.groupBy(column)

    return instance
  }

  having(column: keyof JobType, operator: string, value: any): JobModel {
    return JobModel.having(column, operator, value)
  }

  static having(column: keyof JobType, operator: string, value: any): JobModel {
    const instance = new JobModel(null)

    instance.selectFromQuery = instance.selectFromQuery.having(column, operator, value)

    return instance
  }

  inRandomOrder(): JobModel {
    return JobModel.inRandomOrder()
  }

  static inRandomOrder(): JobModel {
    const instance = new JobModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(sql` ${sql.raw('RANDOM()')} `)

    return instance
  }

  orderByDesc(column: keyof JobType): JobModel {
    return JobModel.orderByDesc(column)
  }

  static orderByDesc(column: keyof JobType): JobModel {
    const instance = new JobModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'desc')

    return instance
  }

  orderByAsc(column: keyof JobType): JobModel {
    return JobModel.orderByAsc(column)
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

      return model
    }

    return undefined
  }

  async save(): Promise<void> {
    if (!this)
      throw new HttpError(500, 'Job data is undefined')

    const filteredValues = Object.fromEntries(
      Object.entries(this).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewJob

    if (this.id === undefined) {
      await DB.instance.insertInto('jobs')
        .values(filteredValues)
        .executeTakeFirstOrThrow()
    }
    else {
      await this.update(this)
    }
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
    return JobModel.distinct(column)
  }

  static distinct(column: keyof JobType): JobModel {
    const instance = new JobModel(null)

    instance.selectFromQuery = instance.selectFromQuery.select(column).distinct()

    instance.hasSelect = true

    return instance
  }

  join(table: string, firstCol: string, secondCol: string): JobModel {
    return JobModel.join(table, firstCol, secondCol)
  }

  static join(table: string, firstCol: string, secondCol: string): JobModel {
    const instance = new JobModel(null)

    instance.selectFromQuery = instance.selectFromQuery.innerJoin(table, firstCol, secondCol)

    return instance
  }

  static async rawQuery(rawQuery: string): Promise<any> {
    return await sql`${rawQuery}`.execute(DB.instance)
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
