import type { RawBuilder } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import type { NewReceipt, ReceiptJsonResponse, ReceiptsTable, ReceiptUpdate } from '../types/ReceiptType'
import type { PrintDeviceModel } from './PrintDevice'
import { randomUUIDv7 } from 'bun'
import { sql } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'
import { dispatch } from '@stacksjs/events'
import { DB } from '@stacksjs/orm'

import { BaseOrm } from '../utils/base'

export class ReceiptModel extends BaseOrm<ReceiptModel, ReceiptsTable, ReceiptJsonResponse> {
  private readonly hidden: Array<keyof ReceiptJsonResponse> = []
  private readonly fillable: Array<keyof ReceiptJsonResponse> = ['printer', 'document', 'timestamp', 'status', 'size', 'pages', 'duration', 'metadata', 'uuid', 'print_device_id']
  private readonly guarded: Array<keyof ReceiptJsonResponse> = []
  protected attributes = {} as ReceiptJsonResponse
  protected originalAttributes = {} as ReceiptJsonResponse

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

  constructor(receipt: ReceiptJsonResponse | undefined) {
    super('receipts')
    if (receipt) {
      this.attributes = { ...receipt }
      this.originalAttributes = { ...receipt }

      Object.keys(receipt).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (receipt as ReceiptJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = DB.instance.selectFrom('receipts')
    this.updateFromQuery = DB.instance.updateTable('receipts')
    this.deleteFromQuery = DB.instance.deleteFrom('receipts')
    this.hasSelect = false
  }

  protected async loadRelations(models: ReceiptJsonResponse | ReceiptJsonResponse[]): Promise<void> {
    // Handle both single model and array of models
    const modelArray = Array.isArray(models) ? models : [models]
    if (!modelArray.length)
      return

    const modelIds = modelArray.map(model => model.id)

    for (const relation of this.withRelations) {
      const relatedRecords = await DB.instance
        .selectFrom(relation)
        .where('receipt_id', 'in', modelIds)
        .selectAll()
        .execute()

      if (Array.isArray(models)) {
        models.map((model: ReceiptJsonResponse) => {
          const records = relatedRecords.filter((record: { receipt_id: number }) => {
            return record.receipt_id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      }
      else {
        const records = relatedRecords.filter((record: { receipt_id: number }) => {
          return record.receipt_id === models.id
        })

        models[relation] = records.length === 1 ? records[0] : records
      }
    }
  }

  static with(relations: string[]): ReceiptModel {
    const instance = new ReceiptModel(undefined)

    return instance.applyWith(relations)
  }

  protected mapCustomGetters(models: ReceiptJsonResponse | ReceiptJsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: ReceiptJsonResponse) => {
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

  async mapCustomSetters(model: NewReceipt): Promise<void> {
    const customSetter = {
      default: () => {
      },

    }

    for (const [key, fn] of Object.entries(customSetter)) {
      (model as any)[key] = await fn()
    }
  }

  get print_device_id(): number {
    return this.attributes.print_device_id
  }

  get print_device(): PrintDeviceModel | undefined {
    return this.attributes.print_device
  }

  get id(): number {
    return this.attributes.id
  }

  get uuid(): string | undefined {
    return this.attributes.uuid
  }

  get printer(): string | undefined {
    return this.attributes.printer
  }

  get document(): string {
    return this.attributes.document
  }

  get timestamp(): Date | string {
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

  get metadata(): string | undefined {
    return this.attributes.metadata
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

  set timestamp(value: Date | string) {
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

  set metadata(value: string) {
    this.attributes.metadata = value
  }

  set updated_at(value: string) {
    this.attributes.updated_at = value
  }

  static select(params: (keyof ReceiptJsonResponse)[] | RawBuilder<string> | string): ReceiptModel {
    const instance = new ReceiptModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a Receipt by ID
  static async find(id: number): Promise<ReceiptModel | undefined> {
    const query = DB.instance.selectFrom('receipts').where('id', '=', id).selectAll()

    const model = await query.executeTakeFirst()

    if (!model)
      return undefined

    const instance = new ReceiptModel(undefined)
    return instance.createInstance(model)
  }

  static async first(): Promise<ReceiptModel | undefined> {
    const instance = new ReceiptModel(undefined)

    const model = await instance.applyFirst()

    const data = new ReceiptModel(model)

    return data
  }

  static async last(): Promise<ReceiptModel | undefined> {
    const instance = new ReceiptModel(undefined)

    const model = await instance.applyLast()

    if (!model)
      return undefined

    return new ReceiptModel(model)
  }

  static async firstOrFail(): Promise<ReceiptModel | undefined> {
    const instance = new ReceiptModel(undefined)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<ReceiptModel[]> {
    const instance = new ReceiptModel(undefined)

    const models = await DB.instance.selectFrom('receipts').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: ReceiptJsonResponse) => {
      return new ReceiptModel(model)
    }))

    return data
  }

  static async findOrFail(id: number): Promise<ReceiptModel | undefined> {
    const instance = new ReceiptModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<ReceiptModel[]> {
    const instance = new ReceiptModel(undefined)

    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: ReceiptJsonResponse) => instance.parseResult(new ReceiptModel(modelItem)))
  }

  static async latest(column: keyof ReceiptsTable = 'created_at'): Promise<ReceiptModel | undefined> {
    const instance = new ReceiptModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'desc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new ReceiptModel(model)
  }

  static async oldest(column: keyof ReceiptsTable = 'created_at'): Promise<ReceiptModel | undefined> {
    const instance = new ReceiptModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'asc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new ReceiptModel(model)
  }

  static skip(count: number): ReceiptModel {
    const instance = new ReceiptModel(undefined)

    return instance.applySkip(count)
  }

  static take(count: number): ReceiptModel {
    const instance = new ReceiptModel(undefined)

    return instance.applyTake(count)
  }

  static where<V = string>(column: keyof ReceiptsTable, ...args: [V] | [Operator, V]): ReceiptModel {
    const instance = new ReceiptModel(undefined)

    return instance.applyWhere<V>(column, ...args)
  }

  static orWhere(...conditions: [string, any][]): ReceiptModel {
    const instance = new ReceiptModel(undefined)

    return instance.applyOrWhere(...conditions)
  }

  static whereNotIn<V = number>(column: keyof ReceiptsTable, values: V[]): ReceiptModel {
    const instance = new ReceiptModel(undefined)

    return instance.applyWhereNotIn<V>(column, values)
  }

  static whereBetween<V = number>(column: keyof ReceiptsTable, range: [V, V]): ReceiptModel {
    const instance = new ReceiptModel(undefined)

    return instance.applyWhereBetween<V>(column, range)
  }

  static whereRef(column: keyof ReceiptsTable, ...args: string[]): ReceiptModel {
    const instance = new ReceiptModel(undefined)

    return instance.applyWhereRef(column, ...args)
  }

  static when(condition: boolean, callback: (query: ReceiptModel) => ReceiptModel): ReceiptModel {
    const instance = new ReceiptModel(undefined)

    return instance.applyWhen(condition, callback as any)
  }

  static whereNull(column: keyof ReceiptsTable): ReceiptModel {
    const instance = new ReceiptModel(undefined)

    return instance.applyWhereNull(column)
  }

  static whereNotNull(column: keyof ReceiptsTable): ReceiptModel {
    const instance = new ReceiptModel(undefined)

    return instance.applyWhereNotNull(column)
  }

  static whereLike(column: keyof ReceiptsTable, value: string): ReceiptModel {
    const instance = new ReceiptModel(undefined)

    return instance.applyWhereLike(column, value)
  }

  static orderBy(column: keyof ReceiptsTable, order: 'asc' | 'desc'): ReceiptModel {
    const instance = new ReceiptModel(undefined)

    return instance.applyOrderBy(column, order)
  }

  static orderByAsc(column: keyof ReceiptsTable): ReceiptModel {
    const instance = new ReceiptModel(undefined)

    return instance.applyOrderByAsc(column)
  }

  static orderByDesc(column: keyof ReceiptsTable): ReceiptModel {
    const instance = new ReceiptModel(undefined)

    return instance.applyOrderByDesc(column)
  }

  static groupBy(column: keyof ReceiptsTable): ReceiptModel {
    const instance = new ReceiptModel(undefined)

    return instance.applyGroupBy(column)
  }

  static having<V = string>(column: keyof ReceiptsTable, operator: Operator, value: V): ReceiptModel {
    const instance = new ReceiptModel(undefined)

    return instance.applyHaving<V>(column, operator, value)
  }

  static inRandomOrder(): ReceiptModel {
    const instance = new ReceiptModel(undefined)

    return instance.applyInRandomOrder()
  }

  static whereColumn(first: keyof ReceiptsTable, operator: Operator, second: keyof ReceiptsTable): ReceiptModel {
    const instance = new ReceiptModel(undefined)

    return instance.applyWhereColumn(first, operator, second)
  }

  static async max(field: keyof ReceiptsTable): Promise<number> {
    const instance = new ReceiptModel(undefined)

    return await instance.applyMax(field)
  }

  static async min(field: keyof ReceiptsTable): Promise<number> {
    const instance = new ReceiptModel(undefined)

    return await instance.applyMin(field)
  }

  static async avg(field: keyof ReceiptsTable): Promise<number> {
    const instance = new ReceiptModel(undefined)

    return await instance.applyAvg(field)
  }

  static async sum(field: keyof ReceiptsTable): Promise<number> {
    const instance = new ReceiptModel(undefined)

    return await instance.applySum(field)
  }

  static async count(): Promise<number> {
    const instance = new ReceiptModel(undefined)

    return instance.applyCount()
  }

  static async get(): Promise<ReceiptModel[]> {
    const instance = new ReceiptModel(undefined)

    const results = await instance.applyGet()

    return results.map((item: ReceiptJsonResponse) => instance.createInstance(item))
  }

  static async pluck<K extends keyof ReceiptModel>(field: K): Promise<ReceiptModel[K][]> {
    const instance = new ReceiptModel(undefined)

    return await instance.applyPluck(field)
  }

  static async chunk(size: number, callback: (models: ReceiptModel[]) => Promise<void>): Promise<void> {
    const instance = new ReceiptModel(undefined)

    await instance.applyChunk(size, async (models) => {
      const modelInstances = models.map((item: ReceiptJsonResponse) => instance.createInstance(item))
      await callback(modelInstances)
    })
  }

  static async paginate(options: { limit?: number, offset?: number, page?: number } = { limit: 10, offset: 0, page: 1 }): Promise<{
    data: ReceiptModel[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }> {
    const instance = new ReceiptModel(undefined)

    const result = await instance.applyPaginate(options)

    return {
      data: result.data.map((item: ReceiptJsonResponse) => instance.createInstance(item)),
      paging: result.paging,
      next_cursor: result.next_cursor,
    }
  }

  // Instance method for creating model instances
  createInstance(data: ReceiptJsonResponse): ReceiptModel {
    return new ReceiptModel(data)
  }

  async applyCreate(newReceipt: NewReceipt): Promise<ReceiptModel> {
    const filteredValues = Object.fromEntries(
      Object.entries(newReceipt).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewReceipt

    await this.mapCustomSetters(filteredValues)

    filteredValues.uuid = randomUUIDv7()

    const result = await DB.instance.insertInto('receipts')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await DB.instance.selectFrom('receipts')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created Receipt')
    }

    if (model)
      dispatch('receipt:created', model)
    return this.createInstance(model)
  }

  async create(newReceipt: NewReceipt): Promise<ReceiptModel> {
    return await this.applyCreate(newReceipt)
  }

  static async create(newReceipt: NewReceipt): Promise<ReceiptModel> {
    const instance = new ReceiptModel(undefined)
    return await instance.applyCreate(newReceipt)
  }

  static async firstOrCreate(search: Partial<ReceiptsTable>, values: NewReceipt = {} as NewReceipt): Promise<ReceiptModel> {
    // First try to find a record matching the search criteria
    const instance = new ReceiptModel(undefined)

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
    const createData = { ...search, ...values } as NewReceipt
    return await ReceiptModel.create(createData)
  }

  static async updateOrCreate(search: Partial<ReceiptsTable>, values: NewReceipt = {} as NewReceipt): Promise<ReceiptModel> {
    // First try to find a record matching the search criteria
    const instance = new ReceiptModel(undefined)

    // Apply all search conditions
    for (const [key, value] of Object.entries(search)) {
      instance.selectFromQuery = instance.selectFromQuery.where(key, '=', value)
    }

    // Try to find the record
    const existingRecord = await instance.applyFirst()

    if (existingRecord) {
      // If record exists, update it with the new values
      const model = instance.createInstance(existingRecord)
      const updatedModel = await model.update(values as ReceiptUpdate)

      // Return the updated model instance
      if (updatedModel) {
        return updatedModel
      }

      // If update didn't return a model, fetch it again to ensure we have latest data
      const refreshedModel = await instance.applyFirst()
      return instance.createInstance(refreshedModel!)
    }

    // If no record exists, create a new one with combined search criteria and values
    const createData = { ...search, ...values } as NewReceipt
    return await ReceiptModel.create(createData)
  }

  async update(newReceipt: ReceiptUpdate): Promise<ReceiptModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newReceipt).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as ReceiptUpdate

    await this.mapCustomSetters(filteredValues)

    filteredValues.updated_at = new Date().toISOString()

    await DB.instance.updateTable('receipts')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('receipts')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated Receipt')
      }

      if (model)
        dispatch('receipt:updated', model)
      return this.createInstance(model)
    }

    return undefined
  }

  async forceUpdate(newReceipt: ReceiptUpdate): Promise<ReceiptModel | undefined> {
    await DB.instance.updateTable('receipts')
      .set(newReceipt)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('receipts')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated Receipt')
      }

      if (this)
        dispatch('receipt:updated', model)
      return this.createInstance(model)
    }

    return undefined
  }

  async save(): Promise<ReceiptModel> {
    // If the model has an ID, update it; otherwise, create a new record
    if (this.id) {
      // Update existing record
      await DB.instance.updateTable('receipts')
        .set(this.attributes as ReceiptUpdate)
        .where('id', '=', this.id)
        .executeTakeFirst()

      // Get the updated data
      const model = await DB.instance.selectFrom('receipts')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated Receipt')
      }

      if (this)
        dispatch('receipt:updated', model)
      return this.createInstance(model)
    }
    else {
      // Create new record
      const result = await DB.instance.insertInto('receipts')
        .values(this.attributes as NewReceipt)
        .executeTakeFirst()

      // Get the created data
      const model = await DB.instance.selectFrom('receipts')
        .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve created Receipt')
      }

      if (this)
        dispatch('receipt:created', model)
      return this.createInstance(model)
    }
  }

  static async createMany(newReceipt: NewReceipt[]): Promise<void> {
    const instance = new ReceiptModel(undefined)

    const valuesFiltered = newReceipt.map((newReceipt: NewReceipt) => {
      const filteredValues = Object.fromEntries(
        Object.entries(newReceipt).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewReceipt

      filteredValues.uuid = randomUUIDv7()

      return filteredValues
    })

    await DB.instance.insertInto('receipts')
      .values(valuesFiltered)
      .executeTakeFirst()
  }

  static async forceCreate(newReceipt: NewReceipt): Promise<ReceiptModel> {
    const result = await DB.instance.insertInto('receipts')
      .values(newReceipt)
      .executeTakeFirst()

    const instance = new ReceiptModel(undefined)
    const model = await DB.instance.selectFrom('receipts')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created Receipt')
    }

    if (model)
      dispatch('receipt:created', model)

    return instance.createInstance(model)
  }

  // Method to remove a Receipt
  async delete(): Promise<number> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()
    const model = await this.find(Number(this.id))

    if (model)
      dispatch('receipt:deleted', model)

    const deleted = await DB.instance.deleteFrom('receipts')
      .where('id', '=', this.id)
      .execute()

    return deleted.numDeletedRows
  }

  static async remove(id: number): Promise<any> {
    const instance = new ReceiptModel(undefined)

    const model = await instance.find(Number(id))

    if (model)
      dispatch('receipt:deleted', model)

    return await DB.instance.deleteFrom('receipts')
      .where('id', '=', id)
      .execute()
  }

  static wherePrinter(value: string): ReceiptModel {
    const instance = new ReceiptModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('printer', '=', value)

    return instance
  }

  static whereDocument(value: string): ReceiptModel {
    const instance = new ReceiptModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('document', '=', value)

    return instance
  }

  static whereTimestamp(value: string): ReceiptModel {
    const instance = new ReceiptModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('timestamp', '=', value)

    return instance
  }

  static whereStatus(value: string): ReceiptModel {
    const instance = new ReceiptModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('status', '=', value)

    return instance
  }

  static whereSize(value: string): ReceiptModel {
    const instance = new ReceiptModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('size', '=', value)

    return instance
  }

  static wherePages(value: string): ReceiptModel {
    const instance = new ReceiptModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('pages', '=', value)

    return instance
  }

  static whereDuration(value: string): ReceiptModel {
    const instance = new ReceiptModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('duration', '=', value)

    return instance
  }

  static whereMetadata(value: string): ReceiptModel {
    const instance = new ReceiptModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('metadata', '=', value)

    return instance
  }

  static whereIn<V = number>(column: keyof ReceiptsTable, values: V[]): ReceiptModel {
    const instance = new ReceiptModel(undefined)

    return instance.applyWhereIn<V>(column, values)
  }

  async printDeviceBelong(): Promise<PrintDeviceModel> {
    if (this.print_device_id === undefined)
      throw new HttpError(500, 'Relation Error!')

    const model = await PrintDevice
      .where('id', '=', this.print_device_id)
      .first()

    if (!model)
      throw new HttpError(500, 'Model Relation Not Found!')

    return model
  }

  toSearchableObject(): Partial<ReceiptJsonResponse> {
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

  static distinct(column: keyof ReceiptJsonResponse): ReceiptModel {
    const instance = new ReceiptModel(undefined)

    return instance.applyDistinct(column)
  }

  static join(table: string, firstCol: string, secondCol: string): ReceiptModel {
    const instance = new ReceiptModel(undefined)

    return instance.applyJoin(table, firstCol, secondCol)
  }

  toJSON(): ReceiptJsonResponse {
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
      metadata: this.metadata,

      created_at: this.created_at,

      updated_at: this.updated_at,

      print_device_id: this.print_device_id,
      print_device: this.print_device,
      ...this.customColumns,
    }

    return output
  }

  parseResult(model: ReceiptModel): ReceiptModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof ReceiptModel]
    }

    return model
  }

  // Add a protected applyFind implementation
  protected async applyFind(id: number): Promise<ReceiptModel | undefined> {
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

export async function find(id: number): Promise<ReceiptModel | undefined> {
  const query = DB.instance.selectFrom('receipts').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  const instance = new ReceiptModel(undefined)
  return instance.createInstance(model)
}

export async function count(): Promise<number> {
  const results = await ReceiptModel.count()

  return results
}

export async function create(newReceipt: NewReceipt): Promise<ReceiptModel> {
  const instance = new ReceiptModel(undefined)
  return await instance.applyCreate(newReceipt)
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(DB.instance)
}

export async function remove(id: number): Promise<void> {
  await DB.instance.deleteFrom('receipts')
    .where('id', '=', id)
    .execute()
}

export async function wherePrinter(value: string): Promise<ReceiptModel[]> {
  const query = DB.instance.selectFrom('receipts').where('printer', '=', value)
  const results: ReceiptJsonResponse = await query.execute()

  return results.map((modelItem: ReceiptJsonResponse) => new ReceiptModel(modelItem))
}

export async function whereDocument(value: string): Promise<ReceiptModel[]> {
  const query = DB.instance.selectFrom('receipts').where('document', '=', value)
  const results: ReceiptJsonResponse = await query.execute()

  return results.map((modelItem: ReceiptJsonResponse) => new ReceiptModel(modelItem))
}

export async function whereTimestamp(value: Date | string): Promise<ReceiptModel[]> {
  const query = DB.instance.selectFrom('receipts').where('timestamp', '=', value)
  const results: ReceiptJsonResponse = await query.execute()

  return results.map((modelItem: ReceiptJsonResponse) => new ReceiptModel(modelItem))
}

export async function whereStatus(value: string | string[]): Promise<ReceiptModel[]> {
  const query = DB.instance.selectFrom('receipts').where('status', '=', value)
  const results: ReceiptJsonResponse = await query.execute()

  return results.map((modelItem: ReceiptJsonResponse) => new ReceiptModel(modelItem))
}

export async function whereSize(value: number): Promise<ReceiptModel[]> {
  const query = DB.instance.selectFrom('receipts').where('size', '=', value)
  const results: ReceiptJsonResponse = await query.execute()

  return results.map((modelItem: ReceiptJsonResponse) => new ReceiptModel(modelItem))
}

export async function wherePages(value: number): Promise<ReceiptModel[]> {
  const query = DB.instance.selectFrom('receipts').where('pages', '=', value)
  const results: ReceiptJsonResponse = await query.execute()

  return results.map((modelItem: ReceiptJsonResponse) => new ReceiptModel(modelItem))
}

export async function whereDuration(value: number): Promise<ReceiptModel[]> {
  const query = DB.instance.selectFrom('receipts').where('duration', '=', value)
  const results: ReceiptJsonResponse = await query.execute()

  return results.map((modelItem: ReceiptJsonResponse) => new ReceiptModel(modelItem))
}

export async function whereMetadata(value: string): Promise<ReceiptModel[]> {
  const query = DB.instance.selectFrom('receipts').where('metadata', '=', value)
  const results: ReceiptJsonResponse = await query.execute()

  return results.map((modelItem: ReceiptJsonResponse) => new ReceiptModel(modelItem))
}

export const Receipt = ReceiptModel

export default Receipt
