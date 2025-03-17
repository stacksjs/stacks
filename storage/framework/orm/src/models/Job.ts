import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import { sql } from '@stacksjs/database'
import { BaseOrm, DB } from '@stacksjs/orm'

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

  static select(params: (keyof JobJsonResponse)[] | RawBuilder<string> | string): JobModel {
    const instance = new JobModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a Job by ID
  static async find(id: number): Promise<JobModel | undefined> {
    const instance = new JobModel(undefined)

    return await instance.applyFind(id)
  }

  static async first(): Promise<JobModel | undefined> {
    const instance = new JobModel(undefined)

    const model = await instance.applyFirst()

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

  static async findOrFail(id: number): Promise<JobModel | undefined> {
    const instance = new JobModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<JobModel[]> {
    const instance = new JobModel(undefined)

    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: UserJsonResponse) => instance.parseResult(new JobModel(modelItem)))
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
      data: result.data.map((item: JobJsonResponse) => new JobModel(item)),
      paging: result.paging,
      next_cursor: result.next_cursor,
    }
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

  async update(newJob: JobUpdate): Promise<JobModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newJob).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as JobUpdate

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

  async forceUpdate(newJob: JobUpdate): Promise<JobModel | undefined> {
    await DB.instance.updateTable('jobs')
      .set(newJob)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      const model = await this.find(this.id)

      return model
    }

    return undefined
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
