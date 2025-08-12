import type { RawBuilder } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import type { NewPrintDevice, PrintDeviceJsonResponse, PrintDevicesTable, PrintDeviceUpdate } from '../types/PrintDeviceType'
import type { ReceiptModel } from './Receipt'
import { randomUUIDv7 } from 'bun'
import { sql } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'
import { dispatch } from '@stacksjs/events'
import { DB } from '@stacksjs/orm'

import { BaseOrm } from '../utils/base'

export class PrintDeviceModel extends BaseOrm<PrintDeviceModel, PrintDevicesTable, PrintDeviceJsonResponse> {
  private readonly hidden: Array<keyof PrintDeviceJsonResponse> = []
  private readonly fillable: Array<keyof PrintDeviceJsonResponse> = ['name', 'mac_address', 'location', 'terminal', 'status', 'last_ping', 'print_count', 'uuid']
  private readonly guarded: Array<keyof PrintDeviceJsonResponse> = []
  protected attributes = {} as PrintDeviceJsonResponse
  protected originalAttributes = {} as PrintDeviceJsonResponse

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

  constructor(printDevice: PrintDeviceJsonResponse | undefined) {
    super('print_devices')
    if (printDevice) {
      this.attributes = { ...printDevice }
      this.originalAttributes = { ...printDevice }

      Object.keys(printDevice).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (printDevice as PrintDeviceJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = DB.instance.selectFrom('print_devices')
    this.updateFromQuery = DB.instance.updateTable('print_devices')
    this.deleteFromQuery = DB.instance.deleteFrom('print_devices')
    this.hasSelect = false
  }

  protected async loadRelations(models: PrintDeviceJsonResponse | PrintDeviceJsonResponse[]): Promise<void> {
    // Handle both single model and array of models
    const modelArray = Array.isArray(models) ? models : [models]
    if (!modelArray.length)
      return

    const modelIds = modelArray.map(model => model.id)

    for (const relation of this.withRelations) {
      const relatedRecords = await DB.instance
        .selectFrom(relation)
        .where('printDevice_id', 'in', modelIds)
        .selectAll()
        .execute()

      if (Array.isArray(models)) {
        models.map((model: PrintDeviceJsonResponse) => {
          const records = relatedRecords.filter((record: { printDevice_id: number }) => {
            return record.printDevice_id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      }
      else {
        const records = relatedRecords.filter((record: { printDevice_id: number }) => {
          return record.printDevice_id === models.id
        })

        models[relation] = records.length === 1 ? records[0] : records
      }
    }
  }

  static with(relations: string[]): PrintDeviceModel {
    const instance = new PrintDeviceModel(undefined)

    return instance.applyWith(relations)
  }

  protected mapCustomGetters(models: PrintDeviceJsonResponse | PrintDeviceJsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: PrintDeviceJsonResponse) => {
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

  async mapCustomSetters(model: NewPrintDevice): Promise<void> {
    const customSetter = {
      default: () => {
      },

    }

    for (const [key, fn] of Object.entries(customSetter)) {
      (model as any)[key] = await fn()
    }
  }

  get receipts(): ReceiptModel[] | [] {
    return this.attributes.receipts
  }

  get id(): number {
    return this.attributes.id
  }

  get uuid(): string | undefined {
    return this.attributes.uuid
  }

  get name(): string {
    return this.attributes.name
  }

  get mac_address(): string {
    return this.attributes.mac_address
  }

  get location(): string {
    return this.attributes.location
  }

  get terminal(): string {
    return this.attributes.terminal
  }

  get status(): string | string[] {
    return this.attributes.status
  }

  get last_ping(): unix {
    return this.attributes.last_ping
  }

  get print_count(): number {
    return this.attributes.print_count
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

  set name(value: string) {
    this.attributes.name = value
  }

  set mac_address(value: string) {
    this.attributes.mac_address = value
  }

  set location(value: string) {
    this.attributes.location = value
  }

  set terminal(value: string) {
    this.attributes.terminal = value
  }

  set status(value: string | string[]) {
    this.attributes.status = value
  }

  set last_ping(value: unix) {
    this.attributes.last_ping = value
  }

  set print_count(value: number) {
    this.attributes.print_count = value
  }

  set updated_at(value: string) {
    this.attributes.updated_at = value
  }

  static select(params: (keyof PrintDeviceJsonResponse)[] | RawBuilder<string> | string): PrintDeviceModel {
    const instance = new PrintDeviceModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a PrintDevice by ID
  static async find(id: number): Promise<PrintDeviceModel | undefined> {
    const query = DB.instance.selectFrom('print_devices').where('id', '=', id).selectAll()

    const model = await query.executeTakeFirst()

    if (!model)
      return undefined

    const instance = new PrintDeviceModel(undefined)
    return instance.createInstance(model)
  }

  static async first(): Promise<PrintDeviceModel | undefined> {
    const instance = new PrintDeviceModel(undefined)

    const model = await instance.applyFirst()

    const data = new PrintDeviceModel(model)

    return data
  }

  static async last(): Promise<PrintDeviceModel | undefined> {
    const instance = new PrintDeviceModel(undefined)

    const model = await instance.applyLast()

    if (!model)
      return undefined

    return new PrintDeviceModel(model)
  }

  static async firstOrFail(): Promise<PrintDeviceModel | undefined> {
    const instance = new PrintDeviceModel(undefined)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<PrintDeviceModel[]> {
    const instance = new PrintDeviceModel(undefined)

    const models = await DB.instance.selectFrom('print_devices').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: PrintDeviceJsonResponse) => {
      return new PrintDeviceModel(model)
    }))

    return data
  }

  static async findOrFail(id: number): Promise<PrintDeviceModel | undefined> {
    const instance = new PrintDeviceModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<PrintDeviceModel[]> {
    const instance = new PrintDeviceModel(undefined)

    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: PrintDeviceJsonResponse) => instance.parseResult(new PrintDeviceModel(modelItem)))
  }

  static async latest(column: keyof PrintDevicesTable = 'created_at'): Promise<PrintDeviceModel | undefined> {
    const instance = new PrintDeviceModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'desc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new PrintDeviceModel(model)
  }

  static async oldest(column: keyof PrintDevicesTable = 'created_at'): Promise<PrintDeviceModel | undefined> {
    const instance = new PrintDeviceModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'asc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new PrintDeviceModel(model)
  }

  static skip(count: number): PrintDeviceModel {
    const instance = new PrintDeviceModel(undefined)

    return instance.applySkip(count)
  }

  static take(count: number): PrintDeviceModel {
    const instance = new PrintDeviceModel(undefined)

    return instance.applyTake(count)
  }

  static where<V = string>(column: keyof PrintDevicesTable, ...args: [V] | [Operator, V]): PrintDeviceModel {
    const instance = new PrintDeviceModel(undefined)

    return instance.applyWhere<V>(column, ...args)
  }

  static orWhere(...conditions: [string, any][]): PrintDeviceModel {
    const instance = new PrintDeviceModel(undefined)

    return instance.applyOrWhere(...conditions)
  }

  static whereNotIn<V = number>(column: keyof PrintDevicesTable, values: V[]): PrintDeviceModel {
    const instance = new PrintDeviceModel(undefined)

    return instance.applyWhereNotIn<V>(column, values)
  }

  static whereBetween<V = number>(column: keyof PrintDevicesTable, range: [V, V]): PrintDeviceModel {
    const instance = new PrintDeviceModel(undefined)

    return instance.applyWhereBetween<V>(column, range)
  }

  static whereRef(column: keyof PrintDevicesTable, ...args: string[]): PrintDeviceModel {
    const instance = new PrintDeviceModel(undefined)

    return instance.applyWhereRef(column, ...args)
  }

  static when(condition: boolean, callback: (query: PrintDeviceModel) => PrintDeviceModel): PrintDeviceModel {
    const instance = new PrintDeviceModel(undefined)

    return instance.applyWhen(condition, callback as any)
  }

  static whereNull(column: keyof PrintDevicesTable): PrintDeviceModel {
    const instance = new PrintDeviceModel(undefined)

    return instance.applyWhereNull(column)
  }

  static whereNotNull(column: keyof PrintDevicesTable): PrintDeviceModel {
    const instance = new PrintDeviceModel(undefined)

    return instance.applyWhereNotNull(column)
  }

  static whereLike(column: keyof PrintDevicesTable, value: string): PrintDeviceModel {
    const instance = new PrintDeviceModel(undefined)

    return instance.applyWhereLike(column, value)
  }

  static orderBy(column: keyof PrintDevicesTable, order: 'asc' | 'desc'): PrintDeviceModel {
    const instance = new PrintDeviceModel(undefined)

    return instance.applyOrderBy(column, order)
  }

  static orderByAsc(column: keyof PrintDevicesTable): PrintDeviceModel {
    const instance = new PrintDeviceModel(undefined)

    return instance.applyOrderByAsc(column)
  }

  static orderByDesc(column: keyof PrintDevicesTable): PrintDeviceModel {
    const instance = new PrintDeviceModel(undefined)

    return instance.applyOrderByDesc(column)
  }

  static groupBy(column: keyof PrintDevicesTable): PrintDeviceModel {
    const instance = new PrintDeviceModel(undefined)

    return instance.applyGroupBy(column)
  }

  static having<V = string>(column: keyof PrintDevicesTable, operator: Operator, value: V): PrintDeviceModel {
    const instance = new PrintDeviceModel(undefined)

    return instance.applyHaving<V>(column, operator, value)
  }

  static inRandomOrder(): PrintDeviceModel {
    const instance = new PrintDeviceModel(undefined)

    return instance.applyInRandomOrder()
  }

  static whereColumn(first: keyof PrintDevicesTable, operator: Operator, second: keyof PrintDevicesTable): PrintDeviceModel {
    const instance = new PrintDeviceModel(undefined)

    return instance.applyWhereColumn(first, operator, second)
  }

  static async max(field: keyof PrintDevicesTable): Promise<number> {
    const instance = new PrintDeviceModel(undefined)

    return await instance.applyMax(field)
  }

  static async min(field: keyof PrintDevicesTable): Promise<number> {
    const instance = new PrintDeviceModel(undefined)

    return await instance.applyMin(field)
  }

  static async avg(field: keyof PrintDevicesTable): Promise<number> {
    const instance = new PrintDeviceModel(undefined)

    return await instance.applyAvg(field)
  }

  static async sum(field: keyof PrintDevicesTable): Promise<number> {
    const instance = new PrintDeviceModel(undefined)

    return await instance.applySum(field)
  }

  static async count(): Promise<number> {
    const instance = new PrintDeviceModel(undefined)

    return instance.applyCount()
  }

  static async get(): Promise<PrintDeviceModel[]> {
    const instance = new PrintDeviceModel(undefined)

    const results = await instance.applyGet()

    return results.map((item: PrintDeviceJsonResponse) => instance.createInstance(item))
  }

  static async pluck<K extends keyof PrintDeviceModel>(field: K): Promise<PrintDeviceModel[K][]> {
    const instance = new PrintDeviceModel(undefined)

    return await instance.applyPluck(field)
  }

  static async chunk(size: number, callback: (models: PrintDeviceModel[]) => Promise<void>): Promise<void> {
    const instance = new PrintDeviceModel(undefined)

    await instance.applyChunk(size, async (models) => {
      const modelInstances = models.map((item: PrintDeviceJsonResponse) => instance.createInstance(item))
      await callback(modelInstances)
    })
  }

  static async paginate(options: { limit?: number, offset?: number, page?: number } = { limit: 10, offset: 0, page: 1 }): Promise<{
    data: PrintDeviceModel[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }> {
    const instance = new PrintDeviceModel(undefined)

    const result = await instance.applyPaginate(options)

    return {
      data: result.data.map((item: PrintDeviceJsonResponse) => instance.createInstance(item)),
      paging: result.paging,
      next_cursor: result.next_cursor,
    }
  }

  // Instance method for creating model instances
  createInstance(data: PrintDeviceJsonResponse): PrintDeviceModel {
    return new PrintDeviceModel(data)
  }

  async applyCreate(newPrintDevice: NewPrintDevice): Promise<PrintDeviceModel> {
    const filteredValues = Object.fromEntries(
      Object.entries(newPrintDevice).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewPrintDevice

    await this.mapCustomSetters(filteredValues)

    filteredValues.uuid = randomUUIDv7()

    const result = await DB.instance.insertInto('print_devices')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await DB.instance.selectFrom('print_devices')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created PrintDevice')
    }

    if (model)
      dispatch('printDevice:created', model)
    return this.createInstance(model)
  }

  async create(newPrintDevice: NewPrintDevice): Promise<PrintDeviceModel> {
    return await this.applyCreate(newPrintDevice)
  }

  static async create(newPrintDevice: NewPrintDevice): Promise<PrintDeviceModel> {
    const instance = new PrintDeviceModel(undefined)
    return await instance.applyCreate(newPrintDevice)
  }

  static async firstOrCreate(search: Partial<PrintDevicesTable>, values: NewPrintDevice = {} as NewPrintDevice): Promise<PrintDeviceModel> {
    // First try to find a record matching the search criteria
    const instance = new PrintDeviceModel(undefined)

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
    const createData = { ...search, ...values } as NewPrintDevice
    return await PrintDeviceModel.create(createData)
  }

  static async updateOrCreate(search: Partial<PrintDevicesTable>, values: NewPrintDevice = {} as NewPrintDevice): Promise<PrintDeviceModel> {
    // First try to find a record matching the search criteria
    const instance = new PrintDeviceModel(undefined)

    // Apply all search conditions
    for (const [key, value] of Object.entries(search)) {
      instance.selectFromQuery = instance.selectFromQuery.where(key, '=', value)
    }

    // Try to find the record
    const existingRecord = await instance.applyFirst()

    if (existingRecord) {
      // If record exists, update it with the new values
      const model = instance.createInstance(existingRecord)
      const updatedModel = await model.update(values as PrintDeviceUpdate)

      // Return the updated model instance
      if (updatedModel) {
        return updatedModel
      }

      // If update didn't return a model, fetch it again to ensure we have latest data
      const refreshedModel = await instance.applyFirst()
      return instance.createInstance(refreshedModel!)
    }

    // If no record exists, create a new one with combined search criteria and values
    const createData = { ...search, ...values } as NewPrintDevice
    return await PrintDeviceModel.create(createData)
  }

  async update(newPrintDevice: PrintDeviceUpdate): Promise<PrintDeviceModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newPrintDevice).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as PrintDeviceUpdate

    await this.mapCustomSetters(filteredValues)

    filteredValues.updated_at = new Date().toISOString()

    await DB.instance.updateTable('print_devices')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('print_devices')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated PrintDevice')
      }

      if (model)
        dispatch('printDevice:updated', model)
      return this.createInstance(model)
    }

    return undefined
  }

  async forceUpdate(newPrintDevice: PrintDeviceUpdate): Promise<PrintDeviceModel | undefined> {
    await DB.instance.updateTable('print_devices')
      .set(newPrintDevice)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('print_devices')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated PrintDevice')
      }

      if (this)
        dispatch('printDevice:updated', model)
      return this.createInstance(model)
    }

    return undefined
  }

  async save(): Promise<PrintDeviceModel> {
    // If the model has an ID, update it; otherwise, create a new record
    if (this.id) {
      // Update existing record
      await DB.instance.updateTable('print_devices')
        .set(this.attributes as PrintDeviceUpdate)
        .where('id', '=', this.id)
        .executeTakeFirst()

      // Get the updated data
      const model = await DB.instance.selectFrom('print_devices')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated PrintDevice')
      }

      if (this)
        dispatch('printDevice:updated', model)
      return this.createInstance(model)
    }
    else {
      // Create new record
      const result = await DB.instance.insertInto('print_devices')
        .values(this.attributes as NewPrintDevice)
        .executeTakeFirst()

      // Get the created data
      const model = await DB.instance.selectFrom('print_devices')
        .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve created PrintDevice')
      }

      if (this)
        dispatch('printDevice:created', model)
      return this.createInstance(model)
    }
  }

  static async createMany(newPrintDevice: NewPrintDevice[]): Promise<void> {
    const instance = new PrintDeviceModel(undefined)

    const valuesFiltered = newPrintDevice.map((newPrintDevice: NewPrintDevice) => {
      const filteredValues = Object.fromEntries(
        Object.entries(newPrintDevice).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewPrintDevice

      filteredValues.uuid = randomUUIDv7()

      return filteredValues
    })

    await DB.instance.insertInto('print_devices')
      .values(valuesFiltered)
      .executeTakeFirst()
  }

  static async forceCreate(newPrintDevice: NewPrintDevice): Promise<PrintDeviceModel> {
    const result = await DB.instance.insertInto('print_devices')
      .values(newPrintDevice)
      .executeTakeFirst()

    const instance = new PrintDeviceModel(undefined)
    const model = await DB.instance.selectFrom('print_devices')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created PrintDevice')
    }

    if (model)
      dispatch('printDevice:created', model)

    return instance.createInstance(model)
  }

  // Method to remove a PrintDevice
  async delete(): Promise<number> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()
    const model = await this.find(Number(this.id))

    if (model)
      dispatch('printDevice:deleted', model)

    const deleted = await DB.instance.deleteFrom('print_devices')
      .where('id', '=', this.id)
      .execute()

    return deleted.numDeletedRows
  }

  static async remove(id: number): Promise<any> {
    const instance = new PrintDeviceModel(undefined)

    const model = await instance.find(Number(id))

    if (model)
      dispatch('printDevice:deleted', model)

    return await DB.instance.deleteFrom('print_devices')
      .where('id', '=', id)
      .execute()
  }

  static whereName(value: string): PrintDeviceModel {
    const instance = new PrintDeviceModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('name', '=', value)

    return instance
  }

  static whereMacAddress(value: string): PrintDeviceModel {
    const instance = new PrintDeviceModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('mac_address', '=', value)

    return instance
  }

  static whereLocation(value: string): PrintDeviceModel {
    const instance = new PrintDeviceModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('location', '=', value)

    return instance
  }

  static whereTerminal(value: string): PrintDeviceModel {
    const instance = new PrintDeviceModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('terminal', '=', value)

    return instance
  }

  static whereStatus(value: string): PrintDeviceModel {
    const instance = new PrintDeviceModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('status', '=', value)

    return instance
  }

  static whereLastPing(value: string): PrintDeviceModel {
    const instance = new PrintDeviceModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('last_ping', '=', value)

    return instance
  }

  static wherePrintCount(value: string): PrintDeviceModel {
    const instance = new PrintDeviceModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('print_count', '=', value)

    return instance
  }

  static whereIn<V = number>(column: keyof PrintDevicesTable, values: V[]): PrintDeviceModel {
    const instance = new PrintDeviceModel(undefined)

    return instance.applyWhereIn<V>(column, values)
  }

  toSearchableObject(): Partial<PrintDeviceJsonResponse> {
    return {
      id: this.id,
      name: this.name,
      mac_address: this.mac_address,
      location: this.location,
      terminal: this.terminal,
      status: this.status,
      last_ping: this.last_ping,
      print_count: this.print_count,
    }
  }

  static distinct(column: keyof PrintDeviceJsonResponse): PrintDeviceModel {
    const instance = new PrintDeviceModel(undefined)

    return instance.applyDistinct(column)
  }

  static join(table: string, firstCol: string, secondCol: string): PrintDeviceModel {
    const instance = new PrintDeviceModel(undefined)

    return instance.applyJoin(table, firstCol, secondCol)
  }

  toJSON(): PrintDeviceJsonResponse {
    const output = {

      uuid: this.uuid,

      id: this.id,
      name: this.name,
      mac_address: this.mac_address,
      location: this.location,
      terminal: this.terminal,
      status: this.status,
      last_ping: this.last_ping,
      print_count: this.print_count,

      created_at: this.created_at,

      updated_at: this.updated_at,

      receipts: this.receipts,
      ...this.customColumns,
    }

    return output
  }

  parseResult(model: PrintDeviceModel): PrintDeviceModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof PrintDeviceModel]
    }

    return model
  }

  // Add a protected applyFind implementation
  protected async applyFind(id: number): Promise<PrintDeviceModel | undefined> {
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

export async function find(id: number): Promise<PrintDeviceModel | undefined> {
  const query = DB.instance.selectFrom('print_devices').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  const instance = new PrintDeviceModel(undefined)
  return instance.createInstance(model)
}

export async function count(): Promise<number> {
  const results = await PrintDeviceModel.count()

  return results
}

export async function create(newPrintDevice: NewPrintDevice): Promise<PrintDeviceModel> {
  const instance = new PrintDeviceModel(undefined)
  return await instance.applyCreate(newPrintDevice)
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(DB.instance)
}

export async function remove(id: number): Promise<void> {
  await DB.instance.deleteFrom('print_devices')
    .where('id', '=', id)
    .execute()
}

export async function whereName(value: string): Promise<PrintDeviceModel[]> {
  const query = DB.instance.selectFrom('print_devices').where('name', '=', value)
  const results: PrintDeviceJsonResponse = await query.execute()

  return results.map((modelItem: PrintDeviceJsonResponse) => new PrintDeviceModel(modelItem))
}

export async function whereMacAddress(value: string): Promise<PrintDeviceModel[]> {
  const query = DB.instance.selectFrom('print_devices').where('mac_address', '=', value)
  const results: PrintDeviceJsonResponse = await query.execute()

  return results.map((modelItem: PrintDeviceJsonResponse) => new PrintDeviceModel(modelItem))
}

export async function whereLocation(value: string): Promise<PrintDeviceModel[]> {
  const query = DB.instance.selectFrom('print_devices').where('location', '=', value)
  const results: PrintDeviceJsonResponse = await query.execute()

  return results.map((modelItem: PrintDeviceJsonResponse) => new PrintDeviceModel(modelItem))
}

export async function whereTerminal(value: string): Promise<PrintDeviceModel[]> {
  const query = DB.instance.selectFrom('print_devices').where('terminal', '=', value)
  const results: PrintDeviceJsonResponse = await query.execute()

  return results.map((modelItem: PrintDeviceJsonResponse) => new PrintDeviceModel(modelItem))
}

export async function whereStatus(value: string | string[]): Promise<PrintDeviceModel[]> {
  const query = DB.instance.selectFrom('print_devices').where('status', '=', value)
  const results: PrintDeviceJsonResponse = await query.execute()

  return results.map((modelItem: PrintDeviceJsonResponse) => new PrintDeviceModel(modelItem))
}

export async function whereLastPing(value: unix): Promise<PrintDeviceModel[]> {
  const query = DB.instance.selectFrom('print_devices').where('last_ping', '=', value)
  const results: PrintDeviceJsonResponse = await query.execute()

  return results.map((modelItem: PrintDeviceJsonResponse) => new PrintDeviceModel(modelItem))
}

export async function wherePrintCount(value: number): Promise<PrintDeviceModel[]> {
  const query = DB.instance.selectFrom('print_devices').where('print_count', '=', value)
  const results: PrintDeviceJsonResponse = await query.execute()

  return results.map((modelItem: PrintDeviceJsonResponse) => new PrintDeviceModel(modelItem))
}

export const PrintDevice = PrintDeviceModel

export default PrintDevice
