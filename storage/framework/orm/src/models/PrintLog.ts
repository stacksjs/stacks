import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import { randomUUIDv7 } from 'bun'
import { sql } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'
import { dispatch } from '@stacksjs/events'
import { DB } from '@stacksjs/orm'
import { BaseOrm } from '../utils/base'

export interface PrintLogsTable {
  id: Generated<number>
  printer: string
  document: string
  timestamp: number
  status: string | string[]
  size?: number
  pages?: number
  duration?: number
  uuid?: string

  created_at?: string

  updated_at?: string

}

export interface PrintLogResponse {
  data: PrintLogJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface PrintLogJsonResponse extends Omit<Selectable<PrintLogsTable>, 'password'> {
  [key: string]: any
}

export type NewPrintLog = Insertable<PrintLogsTable>
export type PrintLogUpdate = Updateable<PrintLogsTable>

export class PrintLogModel extends BaseOrm<PrintLogModel, PrintLogsTable, PrintLogJsonResponse> {
  private readonly hidden: Array<keyof PrintLogJsonResponse> = []
  private readonly fillable: Array<keyof PrintLogJsonResponse> = ['printer', 'document', 'timestamp', 'status', 'size', 'pages', 'duration', 'uuid']
  private readonly guarded: Array<keyof PrintLogJsonResponse> = []
  protected attributes = {} as PrintLogJsonResponse
  protected originalAttributes = {} as PrintLogJsonResponse

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

  constructor(printLog: PrintLogJsonResponse | undefined) {
    super('print_logs')
    if (printLog) {
      this.attributes = { ...printLog }
      this.originalAttributes = { ...printLog }

      Object.keys(printLog).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (printLog as PrintLogJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = DB.instance.selectFrom('print_logs')
    this.updateFromQuery = DB.instance.updateTable('print_logs')
    this.deleteFromQuery = DB.instance.deleteFrom('print_logs')
    this.hasSelect = false
    this.hasSaved = false
  }

  protected async loadRelations(models: PrintLogJsonResponse | PrintLogJsonResponse[]): Promise<void> {
    // Handle both single model and array of models
    const modelArray = Array.isArray(models) ? models : [models]
    if (!modelArray.length)
      return

    const modelIds = modelArray.map(model => model.id)

    for (const relation of this.withRelations) {
      const relatedRecords = await DB.instance
        .selectFrom(relation)
        .where('printLog_id', 'in', modelIds)
        .selectAll()
        .execute()

      if (Array.isArray(models)) {
        models.map((model: PrintLogJsonResponse) => {
          const records = relatedRecords.filter((record: { printLog_id: number }) => {
            return record.printLog_id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      }
      else {
        const records = relatedRecords.filter((record: { printLog_id: number }) => {
          return record.printLog_id === models.id
        })

        models[relation] = records.length === 1 ? records[0] : records
      }
    }
  }

  static with(relations: string[]): PrintLogModel {
    const instance = new PrintLogModel(undefined)

    return instance.applyWith(relations)
  }

  protected mapCustomGetters(models: PrintLogJsonResponse | PrintLogJsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: PrintLogJsonResponse) => {
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

  async mapCustomSetters(model: NewPrintLog | PrintLogUpdate): Promise<void> {
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

  get uuid(): string | undefined {
    return this.attributes.uuid
  }

  get printer(): string {
    return this.attributes.printer
  }

  get document(): string {
    return this.attributes.document
  }

  get timestamp(): number {
    return this.attributes.timestamp
  }

  get status(): string | string[] {
    return this.attributes.status
  }

  get size(): number | undefined {
    return this.attributes.size
  }

  get pages(): number | undefined {
    return this.attributes.pages
  }

  get duration(): number | undefined {
    return this.attributes.duration
  }

  get created_at(): string | undefined {
    return this.attributes.created_at
  }

  get updated_at(): string | undefined {
    return this.attributes.updated_at
  }

  set uuid(value: string) {
    this.attributes.uuid = value
  }

  set printer(value: string) {
    this.attributes.printer = value
  }

  set document(value: string) {
    this.attributes.document = value
  }

  set timestamp(value: number) {
    this.attributes.timestamp = value
  }

  set status(value: string | string[]) {
    this.attributes.status = value
  }

  set size(value: number) {
    this.attributes.size = value
  }

  set pages(value: number) {
    this.attributes.pages = value
  }

  set duration(value: number) {
    this.attributes.duration = value
  }

  set updated_at(value: string) {
    this.attributes.updated_at = value
  }

  static select(params: (keyof PrintLogJsonResponse)[] | RawBuilder<string> | string): PrintLogModel {
    const instance = new PrintLogModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a PrintLog by ID
  static async find(id: number): Promise<PrintLogModel | undefined> {
    const query = DB.instance.selectFrom('print_logs').where('id', '=', id).selectAll()

    const model = await query.executeTakeFirst()

    if (!model)
      return undefined

    const instance = new PrintLogModel(undefined)
    return instance.createInstance(model)
  }

  static async first(): Promise<PrintLogModel | undefined> {
    const instance = new PrintLogModel(undefined)

    const model = await instance.applyFirst()

    const data = new PrintLogModel(model)

    return data
  }

  static async last(): Promise<PrintLogModel | undefined> {
    const instance = new PrintLogModel(undefined)

    const model = await instance.applyLast()

    if (!model)
      return undefined

    return new PrintLogModel(model)
  }

  static async firstOrFail(): Promise<PrintLogModel | undefined> {
    const instance = new PrintLogModel(undefined)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<PrintLogModel[]> {
    const instance = new PrintLogModel(undefined)

    const models = await DB.instance.selectFrom('print_logs').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: PrintLogJsonResponse) => {
      return new PrintLogModel(model)
    }))

    return data
  }

  static async findOrFail(id: number): Promise<PrintLogModel | undefined> {
    const instance = new PrintLogModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<PrintLogModel[]> {
    const instance = new PrintLogModel(undefined)

    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: PrintLogJsonResponse) => instance.parseResult(new PrintLogModel(modelItem)))
  }

  static async latest(column: keyof PrintLogsTable = 'created_at'): Promise<PrintLogModel | undefined> {
    const instance = new PrintLogModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'desc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new PrintLogModel(model)
  }

  static async oldest(column: keyof PrintLogsTable = 'created_at'): Promise<PrintLogModel | undefined> {
    const instance = new PrintLogModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'asc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new PrintLogModel(model)
  }

  static skip(count: number): PrintLogModel {
    const instance = new PrintLogModel(undefined)

    return instance.applySkip(count)
  }

  static take(count: number): PrintLogModel {
    const instance = new PrintLogModel(undefined)

    return instance.applyTake(count)
  }

  static where<V = string>(column: keyof PrintLogsTable, ...args: [V] | [Operator, V]): PrintLogModel {
    const instance = new PrintLogModel(undefined)

    return instance.applyWhere<V>(column, ...args)
  }

  static orWhere(...conditions: [string, any][]): PrintLogModel {
    const instance = new PrintLogModel(undefined)

    return instance.applyOrWhere(...conditions)
  }

  static whereNotIn<V = number>(column: keyof PrintLogsTable, values: V[]): PrintLogModel {
    const instance = new PrintLogModel(undefined)

    return instance.applyWhereNotIn<V>(column, values)
  }

  static whereBetween<V = number>(column: keyof PrintLogsTable, range: [V, V]): PrintLogModel {
    const instance = new PrintLogModel(undefined)

    return instance.applyWhereBetween<V>(column, range)
  }

  static whereRef(column: keyof PrintLogsTable, ...args: string[]): PrintLogModel {
    const instance = new PrintLogModel(undefined)

    return instance.applyWhereRef(column, ...args)
  }

  static when(condition: boolean, callback: (query: PrintLogModel) => PrintLogModel): PrintLogModel {
    const instance = new PrintLogModel(undefined)

    return instance.applyWhen(condition, callback as any)
  }

  static whereNull(column: keyof PrintLogsTable): PrintLogModel {
    const instance = new PrintLogModel(undefined)

    return instance.applyWhereNull(column)
  }

  static whereNotNull(column: keyof PrintLogsTable): PrintLogModel {
    const instance = new PrintLogModel(undefined)

    return instance.applyWhereNotNull(column)
  }

  static whereLike(column: keyof PrintLogsTable, value: string): PrintLogModel {
    const instance = new PrintLogModel(undefined)

    return instance.applyWhereLike(column, value)
  }

  static orderBy(column: keyof PrintLogsTable, order: 'asc' | 'desc'): PrintLogModel {
    const instance = new PrintLogModel(undefined)

    return instance.applyOrderBy(column, order)
  }

  static orderByAsc(column: keyof PrintLogsTable): PrintLogModel {
    const instance = new PrintLogModel(undefined)

    return instance.applyOrderByAsc(column)
  }

  static orderByDesc(column: keyof PrintLogsTable): PrintLogModel {
    const instance = new PrintLogModel(undefined)

    return instance.applyOrderByDesc(column)
  }

  static groupBy(column: keyof PrintLogsTable): PrintLogModel {
    const instance = new PrintLogModel(undefined)

    return instance.applyGroupBy(column)
  }

  static having<V = string>(column: keyof PrintLogsTable, operator: Operator, value: V): PrintLogModel {
    const instance = new PrintLogModel(undefined)

    return instance.applyHaving<V>(column, operator, value)
  }

  static inRandomOrder(): PrintLogModel {
    const instance = new PrintLogModel(undefined)

    return instance.applyInRandomOrder()
  }

  static whereColumn(first: keyof PrintLogsTable, operator: Operator, second: keyof PrintLogsTable): PrintLogModel {
    const instance = new PrintLogModel(undefined)

    return instance.applyWhereColumn(first, operator, second)
  }

  static async max(field: keyof PrintLogsTable): Promise<number> {
    const instance = new PrintLogModel(undefined)

    return await instance.applyMax(field)
  }

  static async min(field: keyof PrintLogsTable): Promise<number> {
    const instance = new PrintLogModel(undefined)

    return await instance.applyMin(field)
  }

  static async avg(field: keyof PrintLogsTable): Promise<number> {
    const instance = new PrintLogModel(undefined)

    return await instance.applyAvg(field)
  }

  static async sum(field: keyof PrintLogsTable): Promise<number> {
    const instance = new PrintLogModel(undefined)

    return await instance.applySum(field)
  }

  static async count(): Promise<number> {
    const instance = new PrintLogModel(undefined)

    return instance.applyCount()
  }

  static async get(): Promise<PrintLogModel[]> {
    const instance = new PrintLogModel(undefined)

    const results = await instance.applyGet()

    return results.map((item: PrintLogJsonResponse) => instance.createInstance(item))
  }

  static async pluck<K extends keyof PrintLogModel>(field: K): Promise<PrintLogModel[K][]> {
    const instance = new PrintLogModel(undefined)

    return await instance.applyPluck(field)
  }

  static async chunk(size: number, callback: (models: PrintLogModel[]) => Promise<void>): Promise<void> {
    const instance = new PrintLogModel(undefined)

    await instance.applyChunk(size, async (models) => {
      const modelInstances = models.map((item: PrintLogJsonResponse) => instance.createInstance(item))
      await callback(modelInstances)
    })
  }

  static async paginate(options: { limit?: number, offset?: number, page?: number } = { limit: 10, offset: 0, page: 1 }): Promise<{
    data: PrintLogModel[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }> {
    const instance = new PrintLogModel(undefined)

    const result = await instance.applyPaginate(options)

    return {
      data: result.data.map((item: PrintLogJsonResponse) => instance.createInstance(item)),
      paging: result.paging,
      next_cursor: result.next_cursor,
    }
  }

  // Instance method for creating model instances
  createInstance(data: PrintLogJsonResponse): PrintLogModel {
    return new PrintLogModel(data)
  }

  async applyCreate(newPrintLog: NewPrintLog): Promise<PrintLogModel> {
    const filteredValues = Object.fromEntries(
      Object.entries(newPrintLog).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewPrintLog

    await this.mapCustomSetters(filteredValues)

    filteredValues.uuid = randomUUIDv7()

    const result = await DB.instance.insertInto('print_logs')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await DB.instance.selectFrom('print_logs')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created PrintLog')
    }

    if (model)
      dispatch('printLog:created', model)
    return this.createInstance(model)
  }

  async create(newPrintLog: NewPrintLog): Promise<PrintLogModel> {
    return await this.applyCreate(newPrintLog)
  }

  static async create(newPrintLog: NewPrintLog): Promise<PrintLogModel> {
    const instance = new PrintLogModel(undefined)
    return await instance.applyCreate(newPrintLog)
  }

  static async firstOrCreate(search: Partial<PrintLogsTable>, values: NewPrintLog = {} as NewPrintLog): Promise<PrintLogModel> {
    // First try to find a record matching the search criteria
    const instance = new PrintLogModel(undefined)

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
    const createData = { ...search, ...values } as NewPrintLog
    return await PrintLogModel.create(createData)
  }

  static async updateOrCreate(search: Partial<PrintLogsTable>, values: NewPrintLog = {} as NewPrintLog): Promise<PrintLogModel> {
    // First try to find a record matching the search criteria
    const instance = new PrintLogModel(undefined)

    // Apply all search conditions
    for (const [key, value] of Object.entries(search)) {
      instance.selectFromQuery = instance.selectFromQuery.where(key, '=', value)
    }

    // Try to find the record
    const existingRecord = await instance.applyFirst()

    if (existingRecord) {
      // If record exists, update it with the new values
      const model = instance.createInstance(existingRecord)
      const updatedModel = await model.update(values as PrintLogUpdate)

      // Return the updated model instance
      if (updatedModel) {
        return updatedModel
      }

      // If update didn't return a model, fetch it again to ensure we have latest data
      const refreshedModel = await instance.applyFirst()
      return instance.createInstance(refreshedModel!)
    }

    // If no record exists, create a new one with combined search criteria and values
    const createData = { ...search, ...values } as NewPrintLog
    return await PrintLogModel.create(createData)
  }

  async update(newPrintLog: PrintLogUpdate): Promise<PrintLogModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newPrintLog).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as PrintLogUpdate

    await this.mapCustomSetters(filteredValues)

    filteredValues.updated_at = new Date().toISOString()

    await DB.instance.updateTable('print_logs')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('print_logs')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated PrintLog')
      }

      if (model)
        dispatch('printLog:updated', model)
      return this.createInstance(model)
    }

    this.hasSaved = true

    return undefined
  }

  async forceUpdate(newPrintLog: PrintLogUpdate): Promise<PrintLogModel | undefined> {
    await DB.instance.updateTable('print_logs')
      .set(newPrintLog)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('print_logs')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated PrintLog')
      }

      if (this)
        dispatch('printLog:updated', model)
      return this.createInstance(model)
    }

    return undefined
  }

  async save(): Promise<PrintLogModel> {
    // If the model has an ID, update it; otherwise, create a new record
    if (this.id) {
      // Update existing record
      await DB.instance.updateTable('print_logs')
        .set(this.attributes as PrintLogUpdate)
        .where('id', '=', this.id)
        .executeTakeFirst()

      // Get the updated data
      const model = await DB.instance.selectFrom('print_logs')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated PrintLog')
      }

      if (this)
        dispatch('printLog:updated', model)
      return this.createInstance(model)
    }
    else {
      // Create new record
      const result = await DB.instance.insertInto('print_logs')
        .values(this.attributes as NewPrintLog)
        .executeTakeFirst()

      // Get the created data
      const model = await DB.instance.selectFrom('print_logs')
        .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve created PrintLog')
      }

      if (this)
        dispatch('printLog:created', model)
      return this.createInstance(model)
    }
  }

  static async createMany(newPrintLog: NewPrintLog[]): Promise<void> {
    const instance = new PrintLogModel(undefined)

    const valuesFiltered = newPrintLog.map((newPrintLog: NewPrintLog) => {
      const filteredValues = Object.fromEntries(
        Object.entries(newPrintLog).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewPrintLog

      filteredValues.uuid = randomUUIDv7()

      return filteredValues
    })

    await DB.instance.insertInto('print_logs')
      .values(valuesFiltered)
      .executeTakeFirst()
  }

  static async forceCreate(newPrintLog: NewPrintLog): Promise<PrintLogModel> {
    const result = await DB.instance.insertInto('print_logs')
      .values(newPrintLog)
      .executeTakeFirst()

    const instance = new PrintLogModel(undefined)
    const model = await DB.instance.selectFrom('print_logs')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created PrintLog')
    }

    if (model)
      dispatch('printLog:created', model)

    return instance.createInstance(model)
  }

  // Method to remove a PrintLog
  async delete(): Promise<number> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()
    const model = await this.find(Number(this.id))

    if (model)
      dispatch('printLog:deleted', model)

    const deleted = await DB.instance.deleteFrom('print_logs')
      .where('id', '=', this.id)
      .execute()

    return deleted.numDeletedRows
  }

  static async remove(id: number): Promise<any> {
    const instance = new PrintLogModel(undefined)

    const model = await instance.find(Number(id))

    if (model)
      dispatch('printLog:deleted', model)

    return await DB.instance.deleteFrom('print_logs')
      .where('id', '=', id)
      .execute()
  }

  static wherePrinter(value: string): PrintLogModel {
    const instance = new PrintLogModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('printer', '=', value)

    return instance
  }

  static whereDocument(value: string): PrintLogModel {
    const instance = new PrintLogModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('document', '=', value)

    return instance
  }

  static whereTimestamp(value: string): PrintLogModel {
    const instance = new PrintLogModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('timestamp', '=', value)

    return instance
  }

  static whereStatus(value: string): PrintLogModel {
    const instance = new PrintLogModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('status', '=', value)

    return instance
  }

  static whereSize(value: string): PrintLogModel {
    const instance = new PrintLogModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('size', '=', value)

    return instance
  }

  static wherePages(value: string): PrintLogModel {
    const instance = new PrintLogModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('pages', '=', value)

    return instance
  }

  static whereDuration(value: string): PrintLogModel {
    const instance = new PrintLogModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('duration', '=', value)

    return instance
  }

  static whereIn<V = number>(column: keyof PrintLogsTable, values: V[]): PrintLogModel {
    const instance = new PrintLogModel(undefined)

    return instance.applyWhereIn<V>(column, values)
  }

  toSearchableObject(): Partial<PrintLogJsonResponse> {
    return {
      id: this.id,
      printer: this.printer,
      document: this.document,
      timestamp: this.timestamp,
      status: this.status,
      size: this.size,
      pages: this.pages,
      duration: this.duration,
    }
  }

  static distinct(column: keyof PrintLogJsonResponse): PrintLogModel {
    const instance = new PrintLogModel(undefined)

    return instance.applyDistinct(column)
  }

  static join(table: string, firstCol: string, secondCol: string): PrintLogModel {
    const instance = new PrintLogModel(undefined)

    return instance.applyJoin(table, firstCol, secondCol)
  }

  toJSON(): PrintLogJsonResponse {
    const output = {

      uuid: this.uuid,

      id: this.id,
      printer: this.printer,
      document: this.document,
      timestamp: this.timestamp,
      status: this.status,
      size: this.size,
      pages: this.pages,
      duration: this.duration,

      created_at: this.created_at,

      updated_at: this.updated_at,

      ...this.customColumns,
    }

    return output
  }

  parseResult(model: PrintLogModel): PrintLogModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof PrintLogModel]
    }

    return model
  }

  // Add a protected applyFind implementation
  protected async applyFind(id: number): Promise<PrintLogModel | undefined> {
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

export async function find(id: number): Promise<PrintLogModel | undefined> {
  const query = DB.instance.selectFrom('print_logs').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  const instance = new PrintLogModel(undefined)
  return instance.createInstance(model)
}

export async function count(): Promise<number> {
  const results = await PrintLogModel.count()

  return results
}

export async function create(newPrintLog: NewPrintLog): Promise<PrintLogModel> {
  const instance = new PrintLogModel(undefined)
  return await instance.applyCreate(newPrintLog)
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(DB.instance)
}

export async function remove(id: number): Promise<void> {
  await DB.instance.deleteFrom('print_logs')
    .where('id', '=', id)
    .execute()
}

export async function wherePrinter(value: string): Promise<PrintLogModel[]> {
  const query = DB.instance.selectFrom('print_logs').where('printer', '=', value)
  const results: PrintLogJsonResponse = await query.execute()

  return results.map((modelItem: PrintLogJsonResponse) => new PrintLogModel(modelItem))
}

export async function whereDocument(value: string): Promise<PrintLogModel[]> {
  const query = DB.instance.selectFrom('print_logs').where('document', '=', value)
  const results: PrintLogJsonResponse = await query.execute()

  return results.map((modelItem: PrintLogJsonResponse) => new PrintLogModel(modelItem))
}

export async function whereTimestamp(value: number): Promise<PrintLogModel[]> {
  const query = DB.instance.selectFrom('print_logs').where('timestamp', '=', value)
  const results: PrintLogJsonResponse = await query.execute()

  return results.map((modelItem: PrintLogJsonResponse) => new PrintLogModel(modelItem))
}

export async function whereStatus(value: string | string[]): Promise<PrintLogModel[]> {
  const query = DB.instance.selectFrom('print_logs').where('status', '=', value)
  const results: PrintLogJsonResponse = await query.execute()

  return results.map((modelItem: PrintLogJsonResponse) => new PrintLogModel(modelItem))
}

export async function whereSize(value: number): Promise<PrintLogModel[]> {
  const query = DB.instance.selectFrom('print_logs').where('size', '=', value)
  const results: PrintLogJsonResponse = await query.execute()

  return results.map((modelItem: PrintLogJsonResponse) => new PrintLogModel(modelItem))
}

export async function wherePages(value: number): Promise<PrintLogModel[]> {
  const query = DB.instance.selectFrom('print_logs').where('pages', '=', value)
  const results: PrintLogJsonResponse = await query.execute()

  return results.map((modelItem: PrintLogJsonResponse) => new PrintLogModel(modelItem))
}

export async function whereDuration(value: number): Promise<PrintLogModel[]> {
  const query = DB.instance.selectFrom('print_logs').where('duration', '=', value)
  const results: PrintLogJsonResponse = await query.execute()

  return results.map((modelItem: PrintLogJsonResponse) => new PrintLogModel(modelItem))
}

export const PrintLog = PrintLogModel

export default PrintLog
