import type { Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import { randomUUIDv7 } from 'bun'
import { cache } from '@stacksjs/cache'
import { db, sql } from '@stacksjs/database'
import { HttpError, ModelNotFoundException } from '@stacksjs/error-handling'
import { dispatch } from '@stacksjs/events'
import { DB, SubqueryBuilder } from '@stacksjs/orm'

export interface FailedJobsTable {
  id?: number
  connection?: string
  queue?: string
  payload?: string
  exception?: string
  failed_at?: Date | string

  created_at?: Date

  updated_at?: Date

}

interface FailedJobResponse {
  data: FailedJobJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface FailedJobJsonResponse extends Omit<FailedJobsTable, 'password'> {
  [key: string]: any
}

export type FailedJobType = Selectable<FailedJobsTable>
export type NewFailedJob = Partial<Insertable<FailedJobsTable>>
export type FailedJobUpdate = Updateable<FailedJobsTable>

      type SortDirection = 'asc' | 'desc'
interface SortOptions { column: FailedJobType, order: SortDirection }
// Define a type for the options parameter
interface QueryOptions {
  sort?: SortOptions
  limit?: number
  offset?: number
  page?: number
}

export class FailedJobModel {
  private readonly hidden: Array<keyof FailedJobJsonResponse> = []
  private readonly fillable: Array<keyof FailedJobJsonResponse> = ['connection', 'queue', 'payload', 'exception', 'failed_at', 'uuid']
  private readonly guarded: Array<keyof FailedJobJsonResponse> = []

  protected selectFromQuery: any
  protected withRelations: string[]
  protected updateFromQuery: any
  protected deleteFromQuery: any
  protected hasSelect: boolean
  private customColumns: Record<string, unknown> = {}
  public id: number | undefined
  public connection: string | undefined
  public queue: string | undefined
  public payload: string | undefined
  public exception: string | undefined
  public failed_at: Date | string | undefined

  public created_at: Date | undefined
  public updated_at: Date | undefined

  constructor(failedjob: Partial<FailedJobType> | null) {
    if (failedjob) {
      this.id = failedjob?.id || 1
      this.connection = failedjob?.connection
      this.queue = failedjob?.queue
      this.payload = failedjob?.payload
      this.exception = failedjob?.exception
      this.failed_at = failedjob?.failed_at

      this.created_at = failedjob?.created_at

      this.updated_at = failedjob?.updated_at

      Object.keys(failedjob).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (failedjob as FailedJobJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = DB.instance.selectFrom('failed_jobs')
    this.updateFromQuery = DB.instance.updateTable('failed_jobs')
    this.deleteFromQuery = DB.instance.deleteFrom('failed_jobs')
    this.hasSelect = false
  }

  select(params: (keyof FailedJobType)[] | RawBuilder<string> | string): FailedJobModel {
    return FailedJobModel.select(params)
  }

  static select(params: (keyof FailedJobType)[] | RawBuilder<string> | string): FailedJobModel {
    const instance = new FailedJobModel(null)

    // Initialize a query with the table name and selected fields
    instance.selectFromQuery = instance.selectFromQuery.select(params)

    instance.hasSelect = true

    return instance
  }

  async find(id: number): Promise<FailedJobModel | undefined> {
    return await FailedJobModel.find(id)
  }

  // Method to find a FailedJob by ID
  static async find(id: number): Promise<FailedJobModel | undefined> {
    const model = await db.selectFrom('failed_jobs').where('id', '=', id).selectAll().executeTakeFirst()

    if (!model)
      return undefined

    const instance = new FailedJobModel(null)

    const result = await instance.mapWith(model)

    const data = new FailedJobModel(result as FailedJobType)

    cache.getOrSet(`failedjob:${id}`, JSON.stringify(model))

    return data
  }

  async first(): Promise<FailedJobModel | undefined> {
    return await FailedJobModel.first()
  }

  static async first(): Promise<FailedJobModel | undefined> {
    const model = await db.selectFrom('failed_jobs')
      .selectAll()
      .executeTakeFirst()

    if (!model)
      return undefined

    const instance = new FailedJobModel(null)

    const result = await instance.mapWith(model)

    const data = new FailedJobModel(result as FailedJobType)

    return data
  }

  async firstOrFail(): Promise<FailedJobModel | undefined> {
    return await FailedJobModel.firstOrFail()
  }

  static async firstOrFail(): Promise<FailedJobModel | undefined> {
    const instance = new FailedJobModel(null)

    const model = await instance.selectFromQuery.executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, 'No FailedJobModel results found for query')

    const result = await instance.mapWith(model)

    const data = new FailedJobModel(result as FailedJobType)

    return data
  }

  async mapWith(model: FailedJobType): Promise<FailedJobType> {
    return model
  }

  static async all(): Promise<FailedJobModel[]> {
    const models = await db.selectFrom('failed_jobs').selectAll().execute()

    const data = await Promise.all(models.map(async (model: FailedJobType) => {
      const instance = new FailedJobModel(model)

      const results = await instance.mapWith(model)

      return new FailedJobModel(results)
    }))

    return data
  }

  async findOrFail(id: number): Promise<FailedJobModel> {
    return await FailedJobModel.findOrFail(id)
  }

  static async findOrFail(id: number): Promise<FailedJobModel> {
    const model = await db.selectFrom('failed_jobs').where('id', '=', id).selectAll().executeTakeFirst()

    const instance = new FailedJobModel(null)

    if (model === undefined)
      throw new ModelNotFoundException(404, `No FailedJobModel results for ${id}`)

    cache.getOrSet(`failedjob:${id}`, JSON.stringify(model))

    const result = await instance.mapWith(model)

    const data = new FailedJobModel(result as FailedJobType)

    return data
  }

  static async findMany(ids: number[]): Promise<FailedJobModel[]> {
    let query = db.selectFrom('failed_jobs').where('id', 'in', ids)

    const instance = new FailedJobModel(null)

    query = query.selectAll()

    const model = await query.execute()

    return model.map(modelItem => instance.parseResult(new FailedJobModel(modelItem)))
  }

  skip(count: number): FailedJobModel {
    return FailedJobModel.skip(count)
  }

  static skip(count: number): FailedJobModel {
    const instance = new FailedJobModel(null)

    instance.selectFromQuery = instance.selectFromQuery.offset(count)

    return instance
  }

  take(count: number): FailedJobModel {
    return FailedJobModel.take(count)
  }

  static take(count: number): FailedJobModel {
    const instance = new FailedJobModel(null)

    instance.selectFromQuery = instance.selectFromQuery.limit(count)

    return instance
  }

  static async pluck<K extends keyof FailedJobModel>(field: K): Promise<FailedJobModel[K][]> {
    const instance = new FailedJobModel(null)

    if (instance.hasSelect) {
      const model = await instance.selectFromQuery.execute()
      return model.map((modelItem: FailedJobModel) => modelItem[field])
    }

    const model = await instance.selectFromQuery.selectAll().execute()

    return model.map((modelItem: FailedJobModel) => modelItem[field])
  }

  async pluck<K extends keyof FailedJobModel>(field: K): Promise<FailedJobModel[K][]> {
    return FailedJobModel.pluck(field)
  }

  static async count(): Promise<number> {
    const instance = new FailedJobModel(null)

    return instance.selectFromQuery
      .select(sql`COUNT(*) as count`)
      .executeTakeFirst()
  }

  async count(): Promise<number> {
    return FailedJobModel.count()
  }

  async max(field: keyof FailedJobModel): Promise<number> {
    return await this.selectFromQuery
      .select(sql`MAX(${sql.raw(field as string)}) `)
      .executeTakeFirst()
  }

  async min(field: keyof FailedJobModel): Promise<number> {
    return await this.selectFromQuery
      .select(sql`MIN(${sql.raw(field as string)}) `)
      .executeTakeFirst()
  }

  async avg(field: keyof FailedJobModel): Promise<number> {
    return this.selectFromQuery
      .select(sql`AVG(${sql.raw(field as string)})`)
      .executeTakeFirst()
  }

  async sum(field: keyof FailedJobModel): Promise<number> {
    return this.selectFromQuery
      .select(sql`SUM(${sql.raw(field as string)})`)
      .executeTakeFirst()
  }

  async get(): Promise<FailedJobModel[]> {
    return FailedJobModel.get()
  }

  static async get(): Promise<FailedJobModel[]> {
    const instance = new FailedJobModel(null)

    let models

    if (instance.hasSelect) {
      models = await instance.selectFromQuery.execute()
    }
    else {
      models = await instance.selectFromQuery.selectAll().execute()
    }

    const data = await Promise.all(models.map(async (model: FailedJobModel) => {
      const instance = new FailedJobModel(model)

      const results = await instance.mapWith(model)

      return new FailedJobModel(results)
    }))

    return data
  }

  has(relation: string): FailedJobModel {
    return FailedJobModel.has(relation)
  }

  static has(relation: string): FailedJobModel {
    const instance = new FailedJobModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(
        selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.failedjob_id`, '=', 'failed_jobs.id'),
      ),
    )

    return instance
  }

  whereHas(
    relation: string,
    callback: (query: SubqueryBuilder) => void,
  ): FailedJobModel {
    return FailedJobModel.whereHas(relation, callback)
  }

  static whereHas(
    relation: string,
    callback: (query: SubqueryBuilder) => void,
  ): FailedJobModel {
    const instance = new FailedJobModel(null)
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    instance.selectFromQuery = instance.selectFromQuery
      .where(({ exists, selectFrom }: any) => {
        let subquery = selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.failedjob_id`, '=', 'failed_jobs.id')

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

  doesntHave(relation: string): FailedJobModel {
    return FailedJobModel.doesntHave(relation)
  }

  static doesntHave(relation: string): FailedJobModel {
    const instance = new FailedJobModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(({ not, exists, selectFrom }: any) =>
      not(
        exists(
          selectFrom(relation)
            .select('1')
            .whereRef(`${relation}.failedjob_id`, '=', 'failed_jobs.id'),
        ),
      ),
    )

    return instance
  }

  whereDoesntHave(relation: string, callback: (query: SubqueryBuilder) => void): FailedJobModel {
    return FailedJobModel.whereDoesntHave(relation, callback)
  }

  static whereDoesntHave(
    relation: string,
    callback: (query: SubqueryBuilder) => void,
  ): FailedJobModel {
    const instance = new FailedJobModel(null)
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    instance.selectFromQuery = instance.selectFromQuery
      .where(({ exists, selectFrom, not }: any) => {
        let subquery = selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.failedjob_id`, '=', 'failed_jobs.id')

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

  async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<FailedJobResponse> {
    return FailedJobModel.paginate(options)
  }

  // Method to get all failed_jobs
  static async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<FailedJobResponse> {
    const totalRecordsResult = await db.selectFrom('failed_jobs')
      .select(db.fn.count('id').as('total')) // Use 'id' or another actual column name
      .executeTakeFirst()

    const totalRecords = Number(totalRecordsResult?.total) || 0
    const totalPages = Math.ceil(totalRecords / (options.limit ?? 10))

    const failed_jobsWithExtra = await db.selectFrom('failed_jobs')
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

  static async create(newFailedJob: NewFailedJob): Promise<FailedJobModel> {
    const instance = new FailedJobModel(null)

    const filteredValues = Object.fromEntries(
      Object.entries(newFailedJob).filter(([key]) =>
        !instance.guarded.includes(key) && instance.fillable.includes(key),
      ),
    ) as NewFailedJob

    const result = await DB.instance.insertInto('failed_jobs')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await instance.find(Number(result.numInsertedOrUpdatedRows)) as FailedJobModel

    if (model)
      dispatch('FailedJobs:created', model)

    return model
  }

  static async createMany(newFailedJob: NewFailedJob[]): Promise<void> {
    const instance = new FailedJobModel(null)

    const filteredValues = newFailedJob.map((newFailedJob: NewFailedJob) => {
      const filtered = Object.fromEntries(
        Object.entries(newFailedJob).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewFailedJob

      filtered.uuid = randomUUIDv7()
      return filtered
    })

    await DB.instance.insertInto('failed_jobs')
      .values(filteredValues)
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
    return await Db.instance.deleteFrom('failed_jobs')
      .where('id', '=', id)
      .execute()
  }

  private static applyWhere(instance: FailedJobModel, column: string, operator: string, value: any): FailedJobModel {
    instance.selectFromQuery = instance.selectFromQuery.where(column, operator, value)
    instance.updateFromQuery = instance.updateFromQuery.where(column, operator, value)
    instance.deleteFromQuery = instance.deleteFromQuery.where(column, operator, value)

    return instance
  }

  where(column: string, operator: string, value: any): FailedJobModel {
    return FailedJobModel.applyWhere(this, column, operator, value)
  }

  static where(column: string, operator: string, value: any): FailedJobModel {
    const instance = new FailedJobModel(null)

    return FailedJobModel.applyWhere(instance, column, operator, value)
  }

  whereRef(column: string, operator: string, value: string): FailedJobModel {
    return FailedJobModel.whereRef(column, operator, value)
  }

  static whereRef(column: string, operator: string, value: string): FailedJobModel {
    const instance = new FailedJobModel(null)

    instance.selectFromQuery = instance.selectFromQuery.whereRef(column, operator, value)

    return instance
  }

  orWhere(...args: Array<[string, string, any]>): FailedJobModel {
    return FailedJobModel.orWhere(...args)
  }

  static orWhere(...args: Array<[string, string, any]>): FailedJobModel {
    const instance = new FailedJobModel(null)

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
    callback: (query: FailedJobModel) => FailedJobModel,
  ): FailedJobModel {
    return FailedJobModel.when(condition, callback)
  }

  static when(
    condition: boolean,
    callback: (query: FailedJobModel) => FailedJobModel,
  ): FailedJobModel {
    let instance = new FailedJobModel(null)

    if (condition)
      instance = callback(instance)

    return instance
  }

  whereNull(column: string): FailedJobModel {
    return FailedJobModel.whereNull(column)
  }

  static whereNull(column: string): FailedJobModel {
    const instance = new FailedJobModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    instance.updateFromQuery = instance.updateFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    return instance
  }

  static whereConnection(value: string): FailedJobModel {
    const instance = new FailedJobModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('connection', '=', value)

    return instance
  }

  static whereQueue(value: string): FailedJobModel {
    const instance = new FailedJobModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('queue', '=', value)

    return instance
  }

  static wherePayload(value: string): FailedJobModel {
    const instance = new FailedJobModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('payload', '=', value)

    return instance
  }

  static whereException(value: string): FailedJobModel {
    const instance = new FailedJobModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('exception', '=', value)

    return instance
  }

  static whereFailedAt(value: string): FailedJobModel {
    const instance = new FailedJobModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('failed_at', '=', value)

    return instance
  }

  whereIn(column: keyof FailedJobType, values: any[]): FailedJobModel {
    return FailedJobModel.whereIn(column, values)
  }

  static whereIn(column: keyof FailedJobType, values: any[]): FailedJobModel {
    const instance = new FailedJobModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(column, 'in', values)

    instance.updateFromQuery = instance.updateFromQuery.where(column, 'in', values)

    instance.deleteFromQuery = instance.deleteFromQuery.where(column, 'in', values)

    return instance
  }

  whereBetween(column: keyof FailedJobType, range: [any, any]): FailedJobModel {
    return FailedJobModel.whereBetween(column, range)
  }

  static whereBetween(column: keyof FailedJobType, range: [any, any]): FailedJobModel {
    if (range.length !== 2) {
      throw new HttpError(500, 'Range must have exactly two values: [min, max]')
    }

    const instance = new FailedJobModel(null)

    const query = sql` ${sql.raw(column as string)} between ${range[0]} and ${range[1]} `

    instance.selectFromQuery = instance.selectFromQuery.where(query)
    instance.updateFromQuery = instance.updateFromQuery.where(query)
    instance.deleteFromQuery = instance.deleteFromQuery.where(query)

    return instance
  }

  whereNotIn(column: keyof FailedJobType, values: any[]): FailedJobModel {
    return FailedJobModel.whereNotIn(column, values)
  }

  static whereNotIn(column: keyof FailedJobType, values: any[]): FailedJobModel {
    const instance = new FailedJobModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(column, 'not in', values)

    instance.updateFromQuery = instance.updateFromQuery.where(column, 'not in', values)

    instance.deleteFromQuery = instance.deleteFromQuery.where(column, 'not in', values)

    return instance
  }

  async exists(): Promise<boolean> {
    const model = await this.selectFromQuery.executeTakeFirst()

    return model !== null || model !== undefined
  }

  static async latest(): Promise<FailedJobType | undefined> {
    const model = await db.selectFrom('failed_jobs')
      .selectAll()
      .orderBy('created_at', 'desc')
      .executeTakeFirst()

    if (!model)
      return undefined

    const instance = new FailedJobModel(null)
    const result = await instance.mapWith(model)
    const data = new FailedJobModel(result as FailedJobType)

    return data
  }

  static async oldest(): Promise<FailedJobType | undefined> {
    const model = await db.selectFrom('failed_jobs')
      .selectAll()
      .orderBy('created_at', 'asc')
      .executeTakeFirst()

    if (!model)
      return undefined

    const instance = new FailedJobModel(null)
    const result = await instance.mapWith(model)
    const data = new FailedJobModel(result as FailedJobType)

    return data
  }

  static async firstOrCreate(
    condition: Partial<FailedJobType>,
    newFailedJob: NewFailedJob,
  ): Promise<FailedJobModel> {
    // Get the key and value from the condition object
    const key = Object.keys(condition)[0] as keyof FailedJobType

    if (!key) {
      throw new HttpError(500, 'Condition must contain at least one key-value pair')
    }

    const value = condition[key]

    // Attempt to find the first record matching the condition
    const existingFailedJob = await db.selectFrom('failed_jobs')
      .selectAll()
      .where(key, '=', value)
      .executeTakeFirst()

    if (existingFailedJob) {
      const instance = new FailedJobModel(null)
      const result = await instance.mapWith(existingFailedJob)
      return new FailedJobModel(result as FailedJobType)
    }
    else {
      return await this.create(newFailedJob)
    }
  }

  static async updateOrCreate(
    condition: Partial<FailedJobType>,
    newFailedJob: NewFailedJob,
  ): Promise<FailedJobModel> {
    const key = Object.keys(condition)[0] as keyof FailedJobType

    if (!key) {
      throw new HttpError(500, 'Condition must contain at least one key-value pair')
    }

    const value = condition[key]

    // Attempt to find the first record matching the condition
    const existingFailedJob = await db.selectFrom('failed_jobs')
      .selectAll()
      .where(key, '=', value)
      .executeTakeFirst()

    if (existingFailedJob) {
      // If found, update the existing record
      await db.updateTable('failed_jobs')
        .set(newFailedJob)
        .where(key, '=', value)
        .executeTakeFirstOrThrow()

      // Fetch and return the updated record
      const updatedFailedJob = await db.selectFrom('failed_jobs')
        .selectAll()
        .where(key, '=', value)
        .executeTakeFirst()

      if (!updatedFailedJob) {
        throw new HttpError(500, 'Failed to fetch updated record')
      }

      const instance = new FailedJobModel(null)
      const result = await instance.mapWith(updatedFailedJob)
      return new FailedJobModel(result as FailedJobType)
    }
    else {
      // If not found, create a new record
      return await this.create(newFailedJob)
    }
  }

  with(relations: string[]): FailedJobModel {
    return FailedJobModel.with(relations)
  }

  static with(relations: string[]): FailedJobModel {
    const instance = new FailedJobModel(null)

    instance.withRelations = relations

    return instance
  }

  async last(): Promise<FailedJobType | undefined> {
    return await db.selectFrom('failed_jobs')
      .selectAll()
      .orderBy('id', 'desc')
      .executeTakeFirst()
  }

  static async last(): Promise<FailedJobType | undefined> {
    const model = await db.selectFrom('failed_jobs').selectAll().orderBy('id', 'desc').executeTakeFirst()

    if (!model)
      return undefined

    const instance = new FailedJobModel(null)

    const result = await instance.mapWith(model)

    const data = new FailedJobModel(result as FailedJobType)

    return data
  }

  orderBy(column: keyof FailedJobType, order: 'asc' | 'desc'): FailedJobModel {
    return FailedJobModel.orderBy(column, order)
  }

  static orderBy(column: keyof FailedJobType, order: 'asc' | 'desc'): FailedJobModel {
    const instance = new FailedJobModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, order)

    return instance
  }

  groupBy(column: keyof FailedJobType): FailedJobModel {
    return FailedJobModel.groupBy(column)
  }

  static groupBy(column: keyof FailedJobType): FailedJobModel {
    const instance = new FailedJobModel(null)

    instance.selectFromQuery = instance.selectFromQuery.groupBy(column)

    return instance
  }

  having(column: keyof FailedJobType, operator: string, value: any): FailedJobModel {
    return FailedJobModel.having(column, operator, value)
  }

  static having(column: keyof FailedJobType, operator: string, value: any): FailedJobModel {
    const instance = new FailedJobModel(null)

    instance.selectFromQuery = instance.selectFromQuery.having(column, operator, value)

    return instance
  }

  inRandomOrder(): FailedJobModel {
    return FailedJobModel.inRandomOrder()
  }

  static inRandomOrder(): FailedJobModel {
    const instance = new FailedJobModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(sql` ${sql.raw('RANDOM()')} `)

    return instance
  }

  orderByDesc(column: keyof FailedJobType): FailedJobModel {
    return FailedJobModel.orderByDesc(column)
  }

  static orderByDesc(column: keyof FailedJobType): FailedJobModel {
    const instance = new FailedJobModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'desc')

    return instance
  }

  orderByAsc(column: keyof FailedJobType): FailedJobModel {
    return FailedJobModel.orderByAsc(column)
  }

  static orderByAsc(column: keyof FailedJobType): FailedJobModel {
    const instance = new FailedJobModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'asc')

    return instance
  }

  async update(newFailedJob: FailedJobUpdate): Promise<FailedJobModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newFailedJob).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewFailedJob

    await db.updateTable('failed_jobs')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      const model = await this.find(this.id)

      return model
    }

    return undefined
  }

  async forceUpdate(failedjob: FailedJobUpdate): Promise<FailedJobModel | undefined> {
    if (this.id === undefined) {
      this.updateFromQuery.set(failedjob).execute()
    }

    await db.updateTable('failed_jobs')
      .set(failedjob)
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
      throw new HttpError(500, 'FailedJob data is undefined')

    if (this.id === undefined) {
      await DB.instance.insertInto('failed_jobs')
        .values(this as NewFailedJob)
        .executeTakeFirstOrThrow()
    }
    else {
      await this.update(this)
    }
  }

  // Method to delete (soft delete) the failedjob instance
  async delete(): Promise<any> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()

    return await Db.instance.deleteFrom('failed_jobs')
      .where('id', '=', this.id)
      .execute()
  }

  distinct(column: keyof FailedJobType): FailedJobModel {
    return FailedJobModel.distinct(column)
  }

  static distinct(column: keyof FailedJobType): FailedJobModel {
    const instance = new FailedJobModel(null)

    instance.selectFromQuery = instance.selectFromQuery.select(column).distinct()

    instance.hasSelect = true

    return instance
  }

  join(table: string, firstCol: string, secondCol: string): FailedJobModel {
    return FailedJobModel.join(table, firstCol, secondCol)
  }

  static join(table: string, firstCol: string, secondCol: string): FailedJobModel {
    const instance = new FailedJobModel(null)

    instance.selectFromQuery = instance.selectFromQuery.innerJoin(table, firstCol, secondCol)

    return instance
  }

  static async rawQuery(rawQuery: string): Promise<any> {
    return await sql`${rawQuery}`.execute(db)
  }

  toJSON(): Partial<FailedJobJsonResponse> {
    const output: Partial<FailedJobJsonResponse> = {

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
  const query = db.selectFrom('failed_jobs').where('id', '=', id).selectAll()

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
  return await sql`${rawQuery}`.execute(db)
}

export async function remove(id: number): Promise<void> {
  await Db.instance.deleteFrom('failed_jobs')
    .where('id', '=', id)
    .execute()
}

export async function whereConnection(value: string): Promise<FailedJobModel[]> {
  const query = db.selectFrom('failed_jobs').where('connection', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new FailedJobModel(modelItem))
}

export async function whereQueue(value: string): Promise<FailedJobModel[]> {
  const query = db.selectFrom('failed_jobs').where('queue', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new FailedJobModel(modelItem))
}

export async function wherePayload(value: string): Promise<FailedJobModel[]> {
  const query = db.selectFrom('failed_jobs').where('payload', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new FailedJobModel(modelItem))
}

export async function whereException(value: string): Promise<FailedJobModel[]> {
  const query = db.selectFrom('failed_jobs').where('exception', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new FailedJobModel(modelItem))
}

export async function whereFailedAt(value: Date | string): Promise<FailedJobModel[]> {
  const query = db.selectFrom('failed_jobs').where('failed_at', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new FailedJobModel(modelItem))
}

export const FailedJob = FailedJobModel

export default FailedJob
