import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import { sql } from '@stacksjs/database'
import { BaseOrm, DB } from '@stacksjs/orm'

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

  /**
   * This model inherits many query methods from BaseOrm:
   * - pluck, chunk, whereExists, has, doesntHave, whereHas, whereDoesntHave
   * - inRandomOrder, max, min, avg, paginate, get, and more
   *
   * See BaseOrm class for the full list of inherited methods.
   */

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

    return instance.applyWith(relations)
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

  async mapCustomSetters(model: NewFailedJob | FailedJobUpdate): Promise<void> {
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

  static select(params: (keyof FailedJobJsonResponse)[] | RawBuilder<string> | string): FailedJobModel {
    const instance = new FailedJobModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a FailedJob by ID
  static async find(id: number): Promise<FailedJobModel | undefined> {
    const instance = new FailedJobModel(undefined)

    return await instance.applyFind(id)
  }

  static async first(): Promise<FailedJobModel | undefined> {
    const instance = new FailedJobModel(undefined)

    const model = await instance.applyFirst()

    const data = new FailedJobModel(model)

    return data
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

  static async findOrFail(id: number): Promise<FailedJobModel | undefined> {
    const instance = new FailedJobModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<FailedJobModel[]> {
    const instance = new FailedJobModel(undefined)

    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: UserJsonResponse) => instance.parseResult(new FailedJobModel(modelItem)))
  }

  static skip(count: number): FailedJobModel {
    const instance = new FailedJobModel(undefined)

    return instance.applySkip(count)
  }

  static take(count: number): FailedJobModel {
    const instance = new FailedJobModel(undefined)

    return instance.applyTake(count)
  }

  static where<V = string>(column: keyof FailedJobsTable, ...args: [V] | [Operator, V]): FailedJobModel {
    const instance = new FailedJobModel(undefined)

    return instance.applyWhere<V>(column, ...args)
  }

  static orWhere(...conditions: [string, any][]): FailedJobModel {
    const instance = new FailedJobModel(undefined)

    return instance.applyOrWhere(...conditions)
  }

  static whereNotIn<V = number>(column: keyof FailedJobsTable, values: V[]): FailedJobModel {
    const instance = new FailedJobModel(undefined)

    return instance.applyWhereNotIn<V>(column, values)
  }

  static whereLike(column: keyof FailedJobsTable, value: string): FailedJobModel {
    const instance = new FailedJobModel(undefined)

    return instance.applyWhereLike(column, value)
  }

  static orderBy(column: keyof FailedJobsTable, order: 'asc' | 'desc'): FailedJobModel {
    const instance = new FailedJobModel(undefined)

    return instance.applyOrderBy(column, order)
  }

  static orderByAsc(column: keyof FailedJobsTable): FailedJobModel {
    const instance = new FailedJobModel(undefined)

    return instance.applyOrderByAsc(column)
  }

  static orderByDesc(column: keyof FailedJobsTable): FailedJobModel {
    const instance = new FailedJobModel(undefined)

    return instance.applyOrderByDesc(column)
  }

  static async max(field: keyof FailedJobsTable): Promise<number> {
    const instance = new FailedJobModel(undefined)

    return await instance.applyMax(field)
  }

  static async min(field: keyof FailedJobsTable): Promise<number> {
    const instance = new FailedJobModel(undefined)

    return await instance.applyMin(field)
  }

  static async avg(field: keyof FailedJobsTable): Promise<number> {
    const instance = new FailedJobModel(undefined)

    return await instance.applyAvg(field)
  }

  static async sum(field: keyof FailedJobsTable): Promise<number> {
    const instance = new FailedJobModel(undefined)

    return await instance.applySum(field)
  }

  static async count(): Promise<number> {
    const instance = new FailedJobModel(undefined)

    return instance.applyCount()
  }

  static async paginate(options: { limit?: number, offset?: number, page?: number } = { limit: 10, offset: 0, page: 1 }): Promise<{
    data: FailedJobModel[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }> {
    const instance = new FailedJobModel(undefined)

    const result = await instance.applyPaginate(options)

    return {
      data: result.data.map((item: FailedJobJsonResponse) => new FailedJobModel(item)),
      paging: result.paging,
      next_cursor: result.next_cursor,
    }
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

  async update(newFailedJob: FailedJobUpdate): Promise<FailedJobModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newFailedJob).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as FailedJobUpdate

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

  async forceUpdate(newFailedJob: FailedJobUpdate): Promise<FailedJobModel | undefined> {
    await DB.instance.updateTable('failed_jobs')
      .set(newFailedJob)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      const model = await this.find(this.id)

      return model
    }

    return undefined
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
  async delete(): Promise<number> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()

    const deleted = await DB.instance.deleteFrom('failed_jobs')
      .where('id', '=', this.id)
      .execute()

    return deleted.numDeletedRows
  }

  static async remove(id: number): Promise<any> {
    return await DB.instance.deleteFrom('failed_jobs')
      .where('id', '=', id)
      .execute()
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

  static distinct(column: keyof FailedJobJsonResponse): FailedJobModel {
    const instance = new FailedJobModel(undefined)

    return instance.applyDistinct(column)
  }

  static join(table: string, firstCol: string, secondCol: string): FailedJobModel {
    const instance = new FailedJobModel(undefined)

    return instance.applyJoin(table, firstCol, secondCol)
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
