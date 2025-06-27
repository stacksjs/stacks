import type { RawBuilder } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import type { JobJsonResponse, JobsTable, JobUpdate, NewJob } from '../types/JobType'
import { sql } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'
import { DB } from '@stacksjs/orm'

import { BaseOrm } from '../utils/base'

export class JobModel extends BaseOrm<JobModel, JobsTable, JobJsonResponse> {
  private readonly hidden: Array<keyof JobJsonResponse> = []
  private readonly fillable: Array<keyof JobJsonResponse> = ['queue', 'payload', 'attempts', 'available_at', 'reserved_at']
  private readonly guarded: Array<keyof JobJsonResponse> = []
  protected attributes = {} as JobJsonResponse
  protected originalAttributes = {} as JobJsonResponse

  protected selectFromQuery: any
  protected updateFromQuery: any
  protected deleteFromQuery: any
  protected hasSelect: boolean
  private customColumns: Record<string, unknown> = {}

  /**
   * This model inherits many query methods from BaseOrm:
   * - pluck, chunk, whereExists, has, doesntHave, whereHas, whereDoesntHave
   * - inRandomOrder, max, min, avg, paginate, get, and more
   *
   * See BaseOrm class for the full list of inherited methods.
   */

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
          (model as any)[key] = fn()
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
        (model as any)[key] = fn()
      }
    }
  }

  async mapCustomSetters(model: NewJob | JobUpdate): Promise<void> {
    const customSetter = {
      default: () => {
      },

    }

    for (const [key, fn] of Object.entries(customSetter)) {
      (model as any)[key] = await fn()
    }
  }

  get id(): number {
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

  get created_at(): string | undefined {
    return this.attributes.created_at
  }

  get updated_at(): string | undefined {
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

  set updated_at(value: string) {
    this.attributes.updated_at = value
  }

  static select(params: (keyof JobJsonResponse)[] | RawBuilder<string> | string): JobModel {
    const instance = new JobModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a Job by ID
  static async find(id: number): Promise<JobModel | undefined> {
    const query = DB.instance.selectFrom('jobs').where('id', '=', id).selectAll()

    const model = await query.executeTakeFirst()

    if (!model)
      return undefined

    const instance = new JobModel(undefined)
    return instance.createInstance(model)
  }

  static async first(): Promise<JobModel | undefined> {
    const instance = new JobModel(undefined)

    const model = await instance.applyFirst()

    const data = new JobModel(model)

    return data
  }

  static async last(): Promise<JobModel | undefined> {
    const instance = new JobModel(undefined)

    const model = await instance.applyLast()

    if (!model)
      return undefined

    return new JobModel(model)
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

  static async findOrFail(id: number): Promise<JobModel | undefined> {
    const instance = new JobModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<JobModel[]> {
    const instance = new JobModel(undefined)

    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: JobJsonResponse) => instance.parseResult(new JobModel(modelItem)))
  }

  static async latest(column: keyof JobsTable = 'created_at'): Promise<JobModel | undefined> {
    const instance = new JobModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'desc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new JobModel(model)
  }

  static async oldest(column: keyof JobsTable = 'created_at'): Promise<JobModel | undefined> {
    const instance = new JobModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'asc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new JobModel(model)
  }

  static skip(count: number): JobModel {
    const instance = new JobModel(undefined)

    return instance.applySkip(count)
  }

  static take(count: number): JobModel {
    const instance = new JobModel(undefined)

    return instance.applyTake(count)
  }

  static where<V = string>(column: keyof JobsTable, ...args: [V] | [Operator, V]): JobModel {
    const instance = new JobModel(undefined)

    return instance.applyWhere<V>(column, ...args)
  }

  static orWhere(...conditions: [string, any][]): JobModel {
    const instance = new JobModel(undefined)

    return instance.applyOrWhere(...conditions)
  }

  static whereNotIn<V = number>(column: keyof JobsTable, values: V[]): JobModel {
    const instance = new JobModel(undefined)

    return instance.applyWhereNotIn<V>(column, values)
  }

  static whereBetween<V = number>(column: keyof JobsTable, range: [V, V]): JobModel {
    const instance = new JobModel(undefined)

    return instance.applyWhereBetween<V>(column, range)
  }

  static whereRef(column: keyof JobsTable, ...args: string[]): JobModel {
    const instance = new JobModel(undefined)

    return instance.applyWhereRef(column, ...args)
  }

  static when(condition: boolean, callback: (query: JobModel) => JobModel): JobModel {
    const instance = new JobModel(undefined)

    return instance.applyWhen(condition, callback as any)
  }

  static whereNull(column: keyof JobsTable): JobModel {
    const instance = new JobModel(undefined)

    return instance.applyWhereNull(column)
  }

  static whereNotNull(column: keyof JobsTable): JobModel {
    const instance = new JobModel(undefined)

    return instance.applyWhereNotNull(column)
  }

  static whereLike(column: keyof JobsTable, value: string): JobModel {
    const instance = new JobModel(undefined)

    return instance.applyWhereLike(column, value)
  }

  static orderBy(column: keyof JobsTable, order: 'asc' | 'desc'): JobModel {
    const instance = new JobModel(undefined)

    return instance.applyOrderBy(column, order)
  }

  static orderByAsc(column: keyof JobsTable): JobModel {
    const instance = new JobModel(undefined)

    return instance.applyOrderByAsc(column)
  }

  static orderByDesc(column: keyof JobsTable): JobModel {
    const instance = new JobModel(undefined)

    return instance.applyOrderByDesc(column)
  }

  static groupBy(column: keyof JobsTable): JobModel {
    const instance = new JobModel(undefined)

    return instance.applyGroupBy(column)
  }

  static having<V = string>(column: keyof JobsTable, operator: Operator, value: V): JobModel {
    const instance = new JobModel(undefined)

    return instance.applyHaving<V>(column, operator, value)
  }

  static inRandomOrder(): JobModel {
    const instance = new JobModel(undefined)

    return instance.applyInRandomOrder()
  }

  static whereColumn(first: keyof JobsTable, operator: Operator, second: keyof JobsTable): JobModel {
    const instance = new JobModel(undefined)

    return instance.applyWhereColumn(first, operator, second)
  }

  static async max(field: keyof JobsTable): Promise<number> {
    const instance = new JobModel(undefined)

    return await instance.applyMax(field)
  }

  static async min(field: keyof JobsTable): Promise<number> {
    const instance = new JobModel(undefined)

    return await instance.applyMin(field)
  }

  static async avg(field: keyof JobsTable): Promise<number> {
    const instance = new JobModel(undefined)

    return await instance.applyAvg(field)
  }

  static async sum(field: keyof JobsTable): Promise<number> {
    const instance = new JobModel(undefined)

    return await instance.applySum(field)
  }

  static async count(): Promise<number> {
    const instance = new JobModel(undefined)

    return instance.applyCount()
  }

  static async get(): Promise<JobModel[]> {
    const instance = new JobModel(undefined)

    const results = await instance.applyGet()

    return results.map((item: JobJsonResponse) => instance.createInstance(item))
  }

  static async pluck<K extends keyof JobModel>(field: K): Promise<JobModel[K][]> {
    const instance = new JobModel(undefined)

    return await instance.applyPluck(field)
  }

  static async chunk(size: number, callback: (models: JobModel[]) => Promise<void>): Promise<void> {
    const instance = new JobModel(undefined)

    await instance.applyChunk(size, async (models) => {
      const modelInstances = models.map((item: JobJsonResponse) => instance.createInstance(item))
      await callback(modelInstances)
    })
  }

  static async paginate(options: { limit?: number, offset?: number, page?: number } = { limit: 10, offset: 0, page: 1 }): Promise<{
    data: JobModel[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }> {
    const instance = new JobModel(undefined)

    const result = await instance.applyPaginate(options)

    return {
      data: result.data.map((item: JobJsonResponse) => instance.createInstance(item)),
      paging: result.paging,
      next_cursor: result.next_cursor,
    }
  }

  // Instance method for creating model instances
  createInstance(data: JobJsonResponse): JobModel {
    return new JobModel(data)
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

    const model = await DB.instance.selectFrom('jobs')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created Job')
    }

    return this.createInstance(model)
  }

  async create(newJob: NewJob): Promise<JobModel> {
    return await this.applyCreate(newJob)
  }

  static async create(newJob: NewJob): Promise<JobModel> {
    const instance = new JobModel(undefined)
    return await instance.applyCreate(newJob)
  }

  static async firstOrCreate(search: Partial<JobsTable>, values: NewJob = {} as NewJob): Promise<JobModel> {
    // First try to find a record matching the search criteria
    const instance = new JobModel(undefined)

    // Apply all search conditions
    for (const [key, value] of Object.entries(search)) {
      instance.selectFromQuery = instance.selectFromQuery.where(key, '=', value)
    }

    // Try to find the record
    const existingRecord = await instance.applyFirst()

    if (existingRecord) {
      return instance.createInstance(existingRecord)
    }

    // If no record exists, create a new one with combined search criteria and values
    const createData = { ...search, ...values } as NewJob
    return await JobModel.create(createData)
  }

  static async updateOrCreate(search: Partial<JobsTable>, values: NewJob = {} as NewJob): Promise<JobModel> {
    // First try to find a record matching the search criteria
    const instance = new JobModel(undefined)

    // Apply all search conditions
    for (const [key, value] of Object.entries(search)) {
      instance.selectFromQuery = instance.selectFromQuery.where(key, '=', value)
    }

    // Try to find the record
    const existingRecord = await instance.applyFirst()

    if (existingRecord) {
      // If record exists, update it with the new values
      const model = instance.createInstance(existingRecord)
      const updatedModel = await model.update(values as JobUpdate)

      // Return the updated model instance
      if (updatedModel) {
        return updatedModel
      }

      // If update didn't return a model, fetch it again to ensure we have latest data
      const refreshedModel = await instance.applyFirst()
      return instance.createInstance(refreshedModel!)
    }

    // If no record exists, create a new one with combined search criteria and values
    const createData = { ...search, ...values } as NewJob
    return await JobModel.create(createData)
  }

  async update(newJob: JobUpdate): Promise<JobModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newJob).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as JobUpdate

    await this.mapCustomSetters(filteredValues)

    filteredValues.updated_at = new Date().toISOString()

    await DB.instance.updateTable('jobs')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('jobs')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated Job')
      }

      return this.createInstance(model)
    }

    return undefined
  }

  async forceUpdate(newJob: JobUpdate): Promise<JobModel | undefined> {
    await DB.instance.updateTable('jobs')
      .set(newJob)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('jobs')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated Job')
      }

      return this.createInstance(model)
    }

    return undefined
  }

  async save(): Promise<JobModel> {
    // If the model has an ID, update it; otherwise, create a new record
    if (this.id) {
      // Update existing record
      await DB.instance.updateTable('jobs')
        .set(this.attributes as JobUpdate)
        .where('id', '=', this.id)
        .executeTakeFirst()

      // Get the updated data
      const model = await DB.instance.selectFrom('jobs')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated Job')
      }

      return this.createInstance(model)
    }
    else {
      // Create new record
      const result = await DB.instance.insertInto('jobs')
        .values(this.attributes as NewJob)
        .executeTakeFirst()

      // Get the created data
      const model = await DB.instance.selectFrom('jobs')
        .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve created Job')
      }

      return this.createInstance(model)
    }
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

    const instance = new JobModel(undefined)
    const model = await DB.instance.selectFrom('jobs')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created Job')
    }

    return instance.createInstance(model)
  }

  // Method to remove a Job
  async delete(): Promise<number> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()

    const deleted = await DB.instance.deleteFrom('jobs')
      .where('id', '=', this.id)
      .execute()

    return deleted.numDeletedRows
  }

  static async remove(id: number): Promise<any> {
    return await DB.instance.deleteFrom('jobs')
      .where('id', '=', id)
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

  static whereIn<V = number>(column: keyof JobsTable, values: V[]): JobModel {
    const instance = new JobModel(undefined)

    return instance.applyWhereIn<V>(column, values)
  }

  static distinct(column: keyof JobJsonResponse): JobModel {
    const instance = new JobModel(undefined)

    return instance.applyDistinct(column)
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

  // Add a protected applyFind implementation
  protected async applyFind(id: number): Promise<JobModel | undefined> {
    const model = await DB.instance.selectFrom(this.tableName)
      .where('id', '=', id)
      .selectAll()
      .executeTakeFirst()

    if (!model)
      return undefined

    this.mapCustomGetters(model)

    await this.loadRelations(model)

    // Return a proper instance using the factory method
    return this.createInstance(model)
  }
}

export async function find(id: number): Promise<JobModel | undefined> {
  const query = DB.instance.selectFrom('jobs').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  const instance = new JobModel(undefined)
  return instance.createInstance(model)
}

export async function count(): Promise<number> {
  const results = await JobModel.count()

  return results
}

export async function create(newJob: NewJob): Promise<JobModel> {
  const instance = new JobModel(undefined)
  return await instance.applyCreate(newJob)
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
