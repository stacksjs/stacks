import type { RawBuilder } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import type { LogJsonResponse, LogsTable, LogUpdate, NewLog } from '../types/LogType'
import { sql } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'
import { DB } from '@stacksjs/orm'

import { BaseOrm } from '../utils/base'

export class LogModel extends BaseOrm<LogModel, LogsTable, LogJsonResponse> {
  private readonly hidden: Array<keyof LogJsonResponse> = []
  private readonly fillable: Array<keyof LogJsonResponse> = ['timestamp', 'type', 'source', 'message', 'project', 'stacktrace', 'file']
  private readonly guarded: Array<keyof LogJsonResponse> = []
  protected attributes = {} as LogJsonResponse
  protected originalAttributes = {} as LogJsonResponse

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

  constructor(log: LogJsonResponse | undefined) {
    super('logs')
    if (log) {
      this.attributes = { ...log }
      this.originalAttributes = { ...log }

      Object.keys(log).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (log as LogJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = DB.instance.selectFrom('logs')
    this.updateFromQuery = DB.instance.updateTable('logs')
    this.deleteFromQuery = DB.instance.deleteFrom('logs')
    this.hasSelect = false
  }

  protected async loadRelations(models: LogJsonResponse | LogJsonResponse[]): Promise<void> {
    // Handle both single model and array of models
    const modelArray = Array.isArray(models) ? models : [models]
    if (!modelArray.length)
      return

    const modelIds = modelArray.map(model => model.id)

    for (const relation of this.withRelations) {
      const relatedRecords = await DB.instance
        .selectFrom(relation)
        .where('log_id', 'in', modelIds)
        .selectAll()
        .execute()

      if (Array.isArray(models)) {
        models.map((model: LogJsonResponse) => {
          const records = relatedRecords.filter((record: { log_id: number }) => {
            return record.log_id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      }
      else {
        const records = relatedRecords.filter((record: { log_id: number }) => {
          return record.log_id === models.id
        })

        models[relation] = records.length === 1 ? records[0] : records
      }
    }
  }

  static with(relations: string[]): LogModel {
    const instance = new LogModel(undefined)

    return instance.applyWith(relations)
  }

  protected mapCustomGetters(models: LogJsonResponse | LogJsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: LogJsonResponse) => {
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

  async mapCustomSetters(model: NewLog | LogUpdate): Promise<void> {
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

  get timestamp(): number | undefined {
    return this.attributes.timestamp
  }

  get type(): string | string[] | undefined {
    return this.attributes.type
  }

  get source(): string | string[] | undefined {
    return this.attributes.source
  }

  get message(): string | undefined {
    return this.attributes.message
  }

  get project(): string | undefined {
    return this.attributes.project
  }

  get stacktrace(): string | undefined {
    return this.attributes.stacktrace
  }

  get file(): string | undefined {
    return this.attributes.file
  }

  get created_at(): string | undefined {
    return this.attributes.created_at
  }

  get updated_at(): string | undefined {
    return this.attributes.updated_at
  }

  set timestamp(value: number) {
    this.attributes.timestamp = value
  }

  set type(value: string | string[]) {
    this.attributes.type = value
  }

  set source(value: string | string[]) {
    this.attributes.source = value
  }

  set message(value: string) {
    this.attributes.message = value
  }

  set project(value: string) {
    this.attributes.project = value
  }

  set stacktrace(value: string) {
    this.attributes.stacktrace = value
  }

  set file(value: string) {
    this.attributes.file = value
  }

  set updated_at(value: string) {
    this.attributes.updated_at = value
  }

  static select(params: (keyof LogJsonResponse)[] | RawBuilder<string> | string): LogModel {
    const instance = new LogModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a Log by ID
  static async find(id: number): Promise<LogModel | undefined> {
    const query = DB.instance.selectFrom('logs').where('id', '=', id).selectAll()

    const model = await query.executeTakeFirst()

    if (!model)
      return undefined

    const instance = new LogModel(undefined)
    return instance.createInstance(model)
  }

  static async first(): Promise<LogModel | undefined> {
    const instance = new LogModel(undefined)

    const model = await instance.applyFirst()

    const data = new LogModel(model)

    return data
  }

  static async last(): Promise<LogModel | undefined> {
    const instance = new LogModel(undefined)

    const model = await instance.applyLast()

    if (!model)
      return undefined

    return new LogModel(model)
  }

  static async firstOrFail(): Promise<LogModel | undefined> {
    const instance = new LogModel(undefined)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<LogModel[]> {
    const instance = new LogModel(undefined)

    const models = await DB.instance.selectFrom('logs').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: LogJsonResponse) => {
      return new LogModel(model)
    }))

    return data
  }

  static async findOrFail(id: number): Promise<LogModel | undefined> {
    const instance = new LogModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<LogModel[]> {
    const instance = new LogModel(undefined)

    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: LogJsonResponse) => instance.parseResult(new LogModel(modelItem)))
  }

  static async latest(column: keyof LogsTable = 'created_at'): Promise<LogModel | undefined> {
    const instance = new LogModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'desc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new LogModel(model)
  }

  static async oldest(column: keyof LogsTable = 'created_at'): Promise<LogModel | undefined> {
    const instance = new LogModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'asc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new LogModel(model)
  }

  static skip(count: number): LogModel {
    const instance = new LogModel(undefined)

    return instance.applySkip(count)
  }

  static take(count: number): LogModel {
    const instance = new LogModel(undefined)

    return instance.applyTake(count)
  }

  static where<V = string>(column: keyof LogsTable, ...args: [V] | [Operator, V]): LogModel {
    const instance = new LogModel(undefined)

    return instance.applyWhere<V>(column, ...args)
  }

  static orWhere(...conditions: [string, any][]): LogModel {
    const instance = new LogModel(undefined)

    return instance.applyOrWhere(...conditions)
  }

  static whereNotIn<V = number>(column: keyof LogsTable, values: V[]): LogModel {
    const instance = new LogModel(undefined)

    return instance.applyWhereNotIn<V>(column, values)
  }

  static whereBetween<V = number>(column: keyof LogsTable, range: [V, V]): LogModel {
    const instance = new LogModel(undefined)

    return instance.applyWhereBetween<V>(column, range)
  }

  static whereRef(column: keyof LogsTable, ...args: string[]): LogModel {
    const instance = new LogModel(undefined)

    return instance.applyWhereRef(column, ...args)
  }

  static when(condition: boolean, callback: (query: LogModel) => LogModel): LogModel {
    const instance = new LogModel(undefined)

    return instance.applyWhen(condition, callback as any)
  }

  static whereNull(column: keyof LogsTable): LogModel {
    const instance = new LogModel(undefined)

    return instance.applyWhereNull(column)
  }

  static whereNotNull(column: keyof LogsTable): LogModel {
    const instance = new LogModel(undefined)

    return instance.applyWhereNotNull(column)
  }

  static whereLike(column: keyof LogsTable, value: string): LogModel {
    const instance = new LogModel(undefined)

    return instance.applyWhereLike(column, value)
  }

  static orderBy(column: keyof LogsTable, order: 'asc' | 'desc'): LogModel {
    const instance = new LogModel(undefined)

    return instance.applyOrderBy(column, order)
  }

  static orderByAsc(column: keyof LogsTable): LogModel {
    const instance = new LogModel(undefined)

    return instance.applyOrderByAsc(column)
  }

  static orderByDesc(column: keyof LogsTable): LogModel {
    const instance = new LogModel(undefined)

    return instance.applyOrderByDesc(column)
  }

  static groupBy(column: keyof LogsTable): LogModel {
    const instance = new LogModel(undefined)

    return instance.applyGroupBy(column)
  }

  static having<V = string>(column: keyof LogsTable, operator: Operator, value: V): LogModel {
    const instance = new LogModel(undefined)

    return instance.applyHaving<V>(column, operator, value)
  }

  static inRandomOrder(): LogModel {
    const instance = new LogModel(undefined)

    return instance.applyInRandomOrder()
  }

  static whereColumn(first: keyof LogsTable, operator: Operator, second: keyof LogsTable): LogModel {
    const instance = new LogModel(undefined)

    return instance.applyWhereColumn(first, operator, second)
  }

  static async max(field: keyof LogsTable): Promise<number> {
    const instance = new LogModel(undefined)

    return await instance.applyMax(field)
  }

  static async min(field: keyof LogsTable): Promise<number> {
    const instance = new LogModel(undefined)

    return await instance.applyMin(field)
  }

  static async avg(field: keyof LogsTable): Promise<number> {
    const instance = new LogModel(undefined)

    return await instance.applyAvg(field)
  }

  static async sum(field: keyof LogsTable): Promise<number> {
    const instance = new LogModel(undefined)

    return await instance.applySum(field)
  }

  static async count(): Promise<number> {
    const instance = new LogModel(undefined)

    return instance.applyCount()
  }

  static async get(): Promise<LogModel[]> {
    const instance = new LogModel(undefined)

    const results = await instance.applyGet()

    return results.map((item: LogJsonResponse) => instance.createInstance(item))
  }

  static async pluck<K extends keyof LogModel>(field: K): Promise<LogModel[K][]> {
    const instance = new LogModel(undefined)

    return await instance.applyPluck(field)
  }

  static async chunk(size: number, callback: (models: LogModel[]) => Promise<void>): Promise<void> {
    const instance = new LogModel(undefined)

    await instance.applyChunk(size, async (models) => {
      const modelInstances = models.map((item: LogJsonResponse) => instance.createInstance(item))
      await callback(modelInstances)
    })
  }

  static async paginate(options: { limit?: number, offset?: number, page?: number } = { limit: 10, offset: 0, page: 1 }): Promise<{
    data: LogModel[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }> {
    const instance = new LogModel(undefined)

    const result = await instance.applyPaginate(options)

    return {
      data: result.data.map((item: LogJsonResponse) => instance.createInstance(item)),
      paging: result.paging,
      next_cursor: result.next_cursor,
    }
  }

  // Instance method for creating model instances
  createInstance(data: LogJsonResponse): LogModel {
    return new LogModel(data)
  }

  async applyCreate(newLog: NewLog): Promise<LogModel> {
    const filteredValues = Object.fromEntries(
      Object.entries(newLog).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewLog

    await this.mapCustomSetters(filteredValues)

    const result = await DB.instance.insertInto('logs')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await DB.instance.selectFrom('logs')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created Log')
    }

    return this.createInstance(model)
  }

  async create(newLog: NewLog): Promise<LogModel> {
    return await this.applyCreate(newLog)
  }

  static async create(newLog: NewLog): Promise<LogModel> {
    const instance = new LogModel(undefined)
    return await instance.applyCreate(newLog)
  }

  static async firstOrCreate(search: Partial<LogsTable>, values: NewLog = {} as NewLog): Promise<LogModel> {
    // First try to find a record matching the search criteria
    const instance = new LogModel(undefined)

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
    const createData = { ...search, ...values } as NewLog
    return await LogModel.create(createData)
  }

  static async updateOrCreate(search: Partial<LogsTable>, values: NewLog = {} as NewLog): Promise<LogModel> {
    // First try to find a record matching the search criteria
    const instance = new LogModel(undefined)

    // Apply all search conditions
    for (const [key, value] of Object.entries(search)) {
      instance.selectFromQuery = instance.selectFromQuery.where(key, '=', value)
    }

    // Try to find the record
    const existingRecord = await instance.applyFirst()

    if (existingRecord) {
      // If record exists, update it with the new values
      const model = instance.createInstance(existingRecord)
      const updatedModel = await model.update(values as LogUpdate)

      // Return the updated model instance
      if (updatedModel) {
        return updatedModel
      }

      // If update didn't return a model, fetch it again to ensure we have latest data
      const refreshedModel = await instance.applyFirst()
      return instance.createInstance(refreshedModel!)
    }

    // If no record exists, create a new one with combined search criteria and values
    const createData = { ...search, ...values } as NewLog
    return await LogModel.create(createData)
  }

  async update(newLog: LogUpdate): Promise<LogModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newLog).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as LogUpdate

    await this.mapCustomSetters(filteredValues)

    filteredValues.updated_at = new Date().toISOString()

    await DB.instance.updateTable('logs')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('logs')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated Log')
      }

      return this.createInstance(model)
    }

    return undefined
  }

  async forceUpdate(newLog: LogUpdate): Promise<LogModel | undefined> {
    await DB.instance.updateTable('logs')
      .set(newLog)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('logs')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated Log')
      }

      return this.createInstance(model)
    }

    return undefined
  }

  async save(): Promise<LogModel> {
    // If the model has an ID, update it; otherwise, create a new record
    if (this.id) {
      // Update existing record
      await DB.instance.updateTable('logs')
        .set(this.attributes as LogUpdate)
        .where('id', '=', this.id)
        .executeTakeFirst()

      // Get the updated data
      const model = await DB.instance.selectFrom('logs')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated Log')
      }

      return this.createInstance(model)
    }
    else {
      // Create new record
      const result = await DB.instance.insertInto('logs')
        .values(this.attributes as NewLog)
        .executeTakeFirst()

      // Get the created data
      const model = await DB.instance.selectFrom('logs')
        .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve created Log')
      }

      return this.createInstance(model)
    }
  }

  static async createMany(newLog: NewLog[]): Promise<void> {
    const instance = new LogModel(undefined)

    const valuesFiltered = newLog.map((newLog: NewLog) => {
      const filteredValues = Object.fromEntries(
        Object.entries(newLog).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewLog

      return filteredValues
    })

    await DB.instance.insertInto('logs')
      .values(valuesFiltered)
      .executeTakeFirst()
  }

  static async forceCreate(newLog: NewLog): Promise<LogModel> {
    const result = await DB.instance.insertInto('logs')
      .values(newLog)
      .executeTakeFirst()

    const instance = new LogModel(undefined)
    const model = await DB.instance.selectFrom('logs')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created Log')
    }

    return instance.createInstance(model)
  }

  // Method to remove a Log
  async delete(): Promise<number> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()

    const deleted = await DB.instance.deleteFrom('logs')
      .where('id', '=', this.id)
      .execute()

    return deleted.numDeletedRows
  }

  static async remove(id: number): Promise<any> {
    return await DB.instance.deleteFrom('logs')
      .where('id', '=', id)
      .execute()
  }

  static whereTimestamp(value: string): LogModel {
    const instance = new LogModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('timestamp', '=', value)

    return instance
  }

  static whereType(value: string): LogModel {
    const instance = new LogModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('type', '=', value)

    return instance
  }

  static whereSource(value: string): LogModel {
    const instance = new LogModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('source', '=', value)

    return instance
  }

  static whereMessage(value: string): LogModel {
    const instance = new LogModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('message', '=', value)

    return instance
  }

  static whereProject(value: string): LogModel {
    const instance = new LogModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('project', '=', value)

    return instance
  }

  static whereStacktrace(value: string): LogModel {
    const instance = new LogModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('stacktrace', '=', value)

    return instance
  }

  static whereFile(value: string): LogModel {
    const instance = new LogModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('file', '=', value)

    return instance
  }

  static whereIn<V = number>(column: keyof LogsTable, values: V[]): LogModel {
    const instance = new LogModel(undefined)

    return instance.applyWhereIn<V>(column, values)
  }

  toSearchableObject(): Partial<LogJsonResponse> {
    return {
      id: this.id,
      type: this.type,
      source: this.source,
      message: this.message,
      project: this.project,
      timestamp: this.timestamp,
    }
  }

  static distinct(column: keyof LogJsonResponse): LogModel {
    const instance = new LogModel(undefined)

    return instance.applyDistinct(column)
  }

  static join(table: string, firstCol: string, secondCol: string): LogModel {
    const instance = new LogModel(undefined)

    return instance.applyJoin(table, firstCol, secondCol)
  }

  toJSON(): LogJsonResponse {
    const output = {

      id: this.id,
      timestamp: this.timestamp,
      type: this.type,
      source: this.source,
      message: this.message,
      project: this.project,
      stacktrace: this.stacktrace,
      file: this.file,

      created_at: this.created_at,

      updated_at: this.updated_at,

      ...this.customColumns,
    }

    return output
  }

  parseResult(model: LogModel): LogModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof LogModel]
    }

    return model
  }

  // Add a protected applyFind implementation
  protected async applyFind(id: number): Promise<LogModel | undefined> {
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

export async function find(id: number): Promise<LogModel | undefined> {
  const query = DB.instance.selectFrom('logs').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  const instance = new LogModel(undefined)
  return instance.createInstance(model)
}

export async function count(): Promise<number> {
  const results = await LogModel.count()

  return results
}

export async function create(newLog: NewLog): Promise<LogModel> {
  const instance = new LogModel(undefined)
  return await instance.applyCreate(newLog)
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(DB.instance)
}

export async function remove(id: number): Promise<void> {
  await DB.instance.deleteFrom('logs')
    .where('id', '=', id)
    .execute()
}

export async function whereTimestamp(value: number): Promise<LogModel[]> {
  const query = DB.instance.selectFrom('logs').where('timestamp', '=', value)
  const results: LogJsonResponse = await query.execute()

  return results.map((modelItem: LogJsonResponse) => new LogModel(modelItem))
}

export async function whereType(value: string | string[]): Promise<LogModel[]> {
  const query = DB.instance.selectFrom('logs').where('type', '=', value)
  const results: LogJsonResponse = await query.execute()

  return results.map((modelItem: LogJsonResponse) => new LogModel(modelItem))
}

export async function whereSource(value: string | string[]): Promise<LogModel[]> {
  const query = DB.instance.selectFrom('logs').where('source', '=', value)
  const results: LogJsonResponse = await query.execute()

  return results.map((modelItem: LogJsonResponse) => new LogModel(modelItem))
}

export async function whereMessage(value: string): Promise<LogModel[]> {
  const query = DB.instance.selectFrom('logs').where('message', '=', value)
  const results: LogJsonResponse = await query.execute()

  return results.map((modelItem: LogJsonResponse) => new LogModel(modelItem))
}

export async function whereProject(value: string): Promise<LogModel[]> {
  const query = DB.instance.selectFrom('logs').where('project', '=', value)
  const results: LogJsonResponse = await query.execute()

  return results.map((modelItem: LogJsonResponse) => new LogModel(modelItem))
}

export async function whereStacktrace(value: string): Promise<LogModel[]> {
  const query = DB.instance.selectFrom('logs').where('stacktrace', '=', value)
  const results: LogJsonResponse = await query.execute()

  return results.map((modelItem: LogJsonResponse) => new LogModel(modelItem))
}

export async function whereFile(value: string): Promise<LogModel[]> {
  const query = DB.instance.selectFrom('logs').where('file', '=', value)
  const results: LogJsonResponse = await query.execute()

  return results.map((modelItem: LogJsonResponse) => new LogModel(modelItem))
}

export const Log = LogModel

export default Log
