import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import { sql } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'
import { DB } from '@stacksjs/orm'
import { BaseOrm } from '../utils/base'

export interface JobsTable {
  id: Generated<number>
  queue: string
  payload: string
  attempts?: number
  available_at?: number
  reserved_at?: Date | string

  created_at?: string

  updated_at?: string

}

// Type for reading model data (created_at is required)
export type JobsRead = JobsTable

// Type for creating/updating model data (created_at is optional)
export type JobsWrite = Omit<JobsTable, 'created_at'> & {
  created_at?: string
}

export interface JobsResponse {
  data: JobsJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface JobsJsonResponse extends Omit<Selectable<JobsRead>, 'password'> {
  [key: string]: any
}

export type NewJobs = Insertable<JobsWrite>
export type JobsUpdate = Updateable<JobsWrite>

export class JobsModel extends BaseOrm<JobsModel, JobsTable, JobsJsonResponse> {
  private readonly hidden: Array<keyof JobsJsonResponse> = []
  private readonly fillable: Array<keyof JobsJsonResponse> = ['queue', 'payload', 'attempts', 'available_at', 'reserved_at', 'uuid']
  private readonly guarded: Array<keyof JobsJsonResponse> = []
  protected attributes = {} as JobsJsonResponse
  protected originalAttributes = {} as JobsJsonResponse

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

  constructor(jobs: JobsJsonResponse | undefined) {
    super('jobs')
    if (jobs) {
      this.attributes = { ...jobs }
      this.originalAttributes = { ...jobs }

      Object.keys(jobs).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (jobs as JobsJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = DB.instance.selectFrom('jobs')
    this.updateFromQuery = DB.instance.updateTable('jobs')
    this.deleteFromQuery = DB.instance.deleteFrom('jobs')
    this.hasSelect = false
  }

  protected async loadRelations(models: JobsJsonResponse | JobsJsonResponse[]): Promise<void> {
    // Handle both single model and array of models
    const modelArray = Array.isArray(models) ? models : [models]
    if (!modelArray.length)
      return

    const modelIds = modelArray.map(model => model.id)

    for (const relation of this.withRelations) {
      const relatedRecords = await DB.instance
        .selectFrom(relation)
        .where('jobs_id', 'in', modelIds)
        .selectAll()
        .execute()

      if (Array.isArray(models)) {
        models.map((model: JobsJsonResponse) => {
          const records = relatedRecords.filter((record: { jobs_id: number }) => {
            return record.jobs_id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      }
      else {
        const records = relatedRecords.filter((record: { jobs_id: number }) => {
          return record.jobs_id === models.id
        })

        models[relation] = records.length === 1 ? records[0] : records
      }
    }
  }

  static with(relations: string[]): JobsModel {
    const instance = new JobsModel(undefined)

    return instance.applyWith(relations)
  }

  protected mapCustomGetters(models: JobsJsonResponse | JobsJsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: JobsJsonResponse) => {
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

  async mapCustomSetters(model: NewJobs | JobsUpdate): Promise<void> {
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

  static select(params: (keyof JobsJsonResponse)[] | RawBuilder<string> | string): JobsModel {
    const instance = new JobsModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a Jobs by ID
  static async find(id: number): Promise<JobsModel | undefined> {
    const query = DB.instance.selectFrom('jobs').where('id', '=', id).selectAll()

    const model = await query.executeTakeFirst()

    if (!model)
      return undefined

    const instance = new JobsModel(undefined)
    return instance.createInstance(model)
  }

  static async first(): Promise<JobsModel | undefined> {
    const instance = new JobsModel(undefined)

    const model = await instance.applyFirst()

    const data = new JobsModel(model)

    return data
  }

  static async last(): Promise<JobsModel | undefined> {
    const instance = new JobsModel(undefined)

    const model = await instance.applyLast()

    if (!model)
      return undefined

    return new JobsModel(model)
  }

  static async firstOrFail(): Promise<JobsModel | undefined> {
    const instance = new JobsModel(undefined)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<JobsModel[]> {
    const instance = new JobsModel(undefined)

    const models = await DB.instance.selectFrom('jobs').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: JobsJsonResponse) => {
      return new JobsModel(model)
    }))

    return data
  }

  static async findOrFail(id: number): Promise<JobsModel | undefined> {
    const instance = new JobsModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<JobsModel[]> {
    const instance = new JobsModel(undefined)

    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: JobsJsonResponse) => instance.parseResult(new JobsModel(modelItem)))
  }

  static async latest(column: keyof JobsTable = 'created_at'): Promise<JobsModel | undefined> {
    const instance = new JobsModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'desc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new JobsModel(model)
  }

  static async oldest(column: keyof JobsTable = 'created_at'): Promise<JobsModel | undefined> {
    const instance = new JobsModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'asc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new JobsModel(model)
  }

  static skip(count: number): JobsModel {
    const instance = new JobsModel(undefined)

    return instance.applySkip(count)
  }

  static take(count: number): JobsModel {
    const instance = new JobsModel(undefined)

    return instance.applyTake(count)
  }

  static where<V = string>(column: keyof JobsTable, ...args: [V] | [Operator, V]): JobsModel {
    const instance = new JobsModel(undefined)

    return instance.applyWhere<V>(column, ...args)
  }

  static orWhere(...conditions: [string, any][]): JobsModel {
    const instance = new JobsModel(undefined)

    return instance.applyOrWhere(...conditions)
  }

  static whereNotIn<V = number>(column: keyof JobsTable, values: V[]): JobsModel {
    const instance = new JobsModel(undefined)

    return instance.applyWhereNotIn<V>(column, values)
  }

  static whereBetween<V = number>(column: keyof JobsTable, range: [V, V]): JobsModel {
    const instance = new JobsModel(undefined)

    return instance.applyWhereBetween<V>(column, range)
  }

  static whereRef(column: keyof JobsTable, ...args: string[]): JobsModel {
    const instance = new JobsModel(undefined)

    return instance.applyWhereRef(column, ...args)
  }

  static when(condition: boolean, callback: (query: JobsModel) => JobsModel): JobsModel {
    const instance = new JobsModel(undefined)

    return instance.applyWhen(condition, callback as any)
  }

  static whereNull(column: keyof JobsTable): JobsModel {
    const instance = new JobsModel(undefined)

    return instance.applyWhereNull(column)
  }

  static whereNotNull(column: keyof JobsTable): JobsModel {
    const instance = new JobsModel(undefined)

    return instance.applyWhereNotNull(column)
  }

  static whereLike(column: keyof JobsTable, value: string): JobsModel {
    const instance = new JobsModel(undefined)

    return instance.applyWhereLike(column, value)
  }

  static orderBy(column: keyof JobsTable, order: 'asc' | 'desc'): JobsModel {
    const instance = new JobsModel(undefined)

    return instance.applyOrderBy(column, order)
  }

  static orderByAsc(column: keyof JobsTable): JobsModel {
    const instance = new JobsModel(undefined)

    return instance.applyOrderByAsc(column)
  }

  static orderByDesc(column: keyof JobsTable): JobsModel {
    const instance = new JobsModel(undefined)

    return instance.applyOrderByDesc(column)
  }

  static groupBy(column: keyof JobsTable): JobsModel {
    const instance = new JobsModel(undefined)

    return instance.applyGroupBy(column)
  }

  static having<V = string>(column: keyof JobsTable, operator: Operator, value: V): JobsModel {
    const instance = new JobsModel(undefined)

    return instance.applyHaving<V>(column, operator, value)
  }

  static inRandomOrder(): JobsModel {
    const instance = new JobsModel(undefined)

    return instance.applyInRandomOrder()
  }

  static whereColumn(first: keyof JobsTable, operator: Operator, second: keyof JobsTable): JobsModel {
    const instance = new JobsModel(undefined)

    return instance.applyWhereColumn(first, operator, second)
  }

  static async max(field: keyof JobsTable): Promise<number> {
    const instance = new JobsModel(undefined)

    return await instance.applyMax(field)
  }

  static async min(field: keyof JobsTable): Promise<number> {
    const instance = new JobsModel(undefined)

    return await instance.applyMin(field)
  }

  static async avg(field: keyof JobsTable): Promise<number> {
    const instance = new JobsModel(undefined)

    return await instance.applyAvg(field)
  }

  static async sum(field: keyof JobsTable): Promise<number> {
    const instance = new JobsModel(undefined)

    return await instance.applySum(field)
  }

  static async count(): Promise<number> {
    const instance = new JobsModel(undefined)

    return instance.applyCount()
  }

  static async get(): Promise<JobsModel[]> {
    const instance = new JobsModel(undefined)

    const results = await instance.applyGet()

    return results.map((item: JobsJsonResponse) => instance.createInstance(item))
  }

  static async pluck<K extends keyof JobsModel>(field: K): Promise<JobsModel[K][]> {
    const instance = new JobsModel(undefined)

    return await instance.applyPluck(field)
  }

  static async chunk(size: number, callback: (models: JobsModel[]) => Promise<void>): Promise<void> {
    const instance = new JobsModel(undefined)

    await instance.applyChunk(size, async (models) => {
      const modelInstances = models.map((item: JobsJsonResponse) => instance.createInstance(item))
      await callback(modelInstances)
    })
  }

  static async paginate(options: { limit?: number, offset?: number, page?: number } = { limit: 10, offset: 0, page: 1 }): Promise<{
    data: JobsModel[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }> {
    const instance = new JobsModel(undefined)

    const result = await instance.applyPaginate(options)

    return {
      data: result.data.map((item: JobsJsonResponse) => instance.createInstance(item)),
      paging: result.paging,
      next_cursor: result.next_cursor,
    }
  }

  // Instance method for creating model instances
  createInstance(data: JobsJsonResponse): JobsModel {
    return new JobsModel(data)
  }

  async applyCreate(newJobs: NewJobs): Promise<JobsModel> {
    const filteredValues = Object.fromEntries(
      Object.entries(newJobs).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewJobs

    await this.mapCustomSetters(filteredValues)

    const result = await DB.instance.insertInto('jobs')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await DB.instance.selectFrom('jobs')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created Jobs')
    }

    return this.createInstance(model)
  }

  async create(newJobs: NewJobs): Promise<JobsModel> {
    return await this.applyCreate(newJobs)
  }

  static async create(newJobs: NewJobs): Promise<JobsModel> {
    const instance = new JobsModel(undefined)
    return await instance.applyCreate(newJobs)
  }

  static async firstOrCreate(search: Partial<JobsTable>, values: NewJobs = {} as NewJobs): Promise<JobsModel> {
    // First try to find a record matching the search criteria
    const instance = new JobsModel(undefined)

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
    const createData = { ...search, ...values } as NewJobs
    return await JobsModel.create(createData)
  }

  static async updateOrCreate(search: Partial<JobsTable>, values: NewJobs = {} as NewJobs): Promise<JobsModel> {
    // First try to find a record matching the search criteria
    const instance = new JobsModel(undefined)

    // Apply all search conditions
    for (const [key, value] of Object.entries(search)) {
      instance.selectFromQuery = instance.selectFromQuery.where(key, '=', value)
    }

    // Try to find the record
    const existingRecord = await instance.applyFirst()

    if (existingRecord) {
      // If record exists, update it with the new values
      const model = instance.createInstance(existingRecord)
      const updatedModel = await model.update(values as JobsUpdate)

      // Return the updated model instance
      if (updatedModel) {
        return updatedModel
      }

      // If update didn't return a model, fetch it again to ensure we have latest data
      const refreshedModel = await instance.applyFirst()
      return instance.createInstance(refreshedModel!)
    }

    // If no record exists, create a new one with combined search criteria and values
    const createData = { ...search, ...values } as NewJobs
    return await JobsModel.create(createData)
  }

  async update(newJobs: JobsUpdate): Promise<JobsModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newJobs).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as JobsUpdate

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
        throw new HttpError(500, 'Failed to retrieve updated Jobs')
      }

      return this.createInstance(model)
    }

    return undefined
  }

  async forceUpdate(newJobs: JobsUpdate): Promise<JobsModel | undefined> {
    await DB.instance.updateTable('jobs')
      .set(newJobs)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('jobs')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated Jobs')
      }

      return this.createInstance(model)
    }

    return undefined
  }

  async save(): Promise<JobsModel> {
    // If the model has an ID, update it; otherwise, create a new record
    if (this.id) {
      // Update existing record
      await DB.instance.updateTable('jobs')
        .set(this.attributes as JobsUpdate)
        .where('id', '=', this.id)
        .executeTakeFirst()

      // Get the updated data
      const model = await DB.instance.selectFrom('jobs')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated Jobs')
      }

      return this.createInstance(model)
    }
    else {
      // Create new record
      const result = await DB.instance.insertInto('jobs')
        .values(this.attributes as NewJobs)
        .executeTakeFirst()

      // Get the created data
      const model = await DB.instance.selectFrom('jobs')
        .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve created Jobs')
      }

      return this.createInstance(model)
    }
  }

  static async createMany(newJobs: NewJobs[]): Promise<void> {
    const instance = new JobsModel(undefined)

    const valuesFiltered = newJobs.map((newJobs: NewJobs) => {
      const filteredValues = Object.fromEntries(
        Object.entries(newJobs).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewJobs

      return filteredValues
    })

    await DB.instance.insertInto('jobs')
      .values(valuesFiltered)
      .executeTakeFirst()
  }

  static async forceCreate(newJobs: NewJobs): Promise<JobsModel> {
    const result = await DB.instance.insertInto('jobs')
      .values(newJobs)
      .executeTakeFirst()

    const instance = new JobsModel(undefined)
    const model = await DB.instance.selectFrom('jobs')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created Jobs')
    }

    return instance.createInstance(model)
  }

  // Method to remove a Jobs
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

  static whereQueue(value: string): JobsModel {
    const instance = new JobsModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('queue', '=', value)

    return instance
  }

  static wherePayload(value: string): JobsModel {
    const instance = new JobsModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('payload', '=', value)

    return instance
  }

  static whereAttempts(value: string): JobsModel {
    const instance = new JobsModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('attempts', '=', value)

    return instance
  }

  static whereAvailableAt(value: string): JobsModel {
    const instance = new JobsModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('available_at', '=', value)

    return instance
  }

  static whereReservedAt(value: string): JobsModel {
    const instance = new JobsModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('reserved_at', '=', value)

    return instance
  }

  static whereIn<V = number>(column: keyof JobsTable, values: V[]): JobsModel {
    const instance = new JobsModel(undefined)

    return instance.applyWhereIn<V>(column, values)
  }

  static distinct(column: keyof JobsJsonResponse): JobsModel {
    const instance = new JobsModel(undefined)

    return instance.applyDistinct(column)
  }

  static join(table: string, firstCol: string, secondCol: string): JobsModel {
    const instance = new JobsModel(undefined)

    return instance.applyJoin(table, firstCol, secondCol)
  }

  toJSON(): JobsJsonResponse {
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

  parseResult(model: JobsModel): JobsModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof JobsModel]
    }

    return model
  }

  // Add a protected applyFind implementation
  protected async applyFind(id: number): Promise<JobsModel | undefined> {
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

export async function find(id: number): Promise<JobsModel | undefined> {
  const query = DB.instance.selectFrom('jobs').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  const instance = new JobsModel(undefined)
  return instance.createInstance(model)
}

export async function count(): Promise<number> {
  const results = await JobsModel.count()

  return results
}

export async function create(newJobs: NewJobs): Promise<JobsModel> {
  const instance = new JobsModel(undefined)
  return await instance.applyCreate(newJobs)
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(DB.instance)
}

export async function remove(id: number): Promise<void> {
  await DB.instance.deleteFrom('jobs')
    .where('id', '=', id)
    .execute()
}

export async function whereQueue(value: string): Promise<JobsModel[]> {
  const query = DB.instance.selectFrom('jobs').where('queue', '=', value)
  const results: JobsJsonResponse = await query.execute()

  return results.map((modelItem: JobsJsonResponse) => new JobsModel(modelItem))
}

export async function wherePayload(value: string): Promise<JobsModel[]> {
  const query = DB.instance.selectFrom('jobs').where('payload', '=', value)
  const results: JobsJsonResponse = await query.execute()

  return results.map((modelItem: JobsJsonResponse) => new JobsModel(modelItem))
}

export async function whereAttempts(value: number): Promise<JobsModel[]> {
  const query = DB.instance.selectFrom('jobs').where('attempts', '=', value)
  const results: JobsJsonResponse = await query.execute()

  return results.map((modelItem: JobsJsonResponse) => new JobsModel(modelItem))
}

export async function whereAvailableAt(value: number): Promise<JobsModel[]> {
  const query = DB.instance.selectFrom('jobs').where('available_at', '=', value)
  const results: JobsJsonResponse = await query.execute()

  return results.map((modelItem: JobsJsonResponse) => new JobsModel(modelItem))
}

export async function whereReservedAt(value: Date | string): Promise<JobsModel[]> {
  const query = DB.instance.selectFrom('jobs').where('reserved_at', '=', value)
  const results: JobsJsonResponse = await query.execute()

  return results.map((modelItem: JobsJsonResponse) => new JobsModel(modelItem))
}

export const Jobs = JobsModel

export default Jobs
