import type { RawBuilder } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import type { NewWebsocket, WebsocketJsonResponse, WebsocketsTable, WebsocketUpdate } from '../types/WebsocketType'
import { sql } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'
import { dispatch } from '@stacksjs/events'
import { DB } from '@stacksjs/orm'

import { BaseOrm } from '../utils/base'

export class WebsocketModel extends BaseOrm<WebsocketModel, WebsocketsTable, WebsocketJsonResponse> {
  private readonly hidden: Array<keyof WebsocketJsonResponse> = []
  private readonly fillable: Array<keyof WebsocketJsonResponse> = ['type', 'socket', 'details', 'time']
  private readonly guarded: Array<keyof WebsocketJsonResponse> = []
  protected attributes = {} as WebsocketJsonResponse
  protected originalAttributes = {} as WebsocketJsonResponse

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

  constructor(websocket: WebsocketJsonResponse | undefined) {
    super('websockets')
    if (websocket) {
      this.attributes = { ...websocket }
      this.originalAttributes = { ...websocket }

      Object.keys(websocket).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (websocket as WebsocketJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = DB.instance.selectFrom('websockets')
    this.updateFromQuery = DB.instance.updateTable('websockets')
    this.deleteFromQuery = DB.instance.deleteFrom('websockets')
    this.hasSelect = false
  }

  protected async loadRelations(models: WebsocketJsonResponse | WebsocketJsonResponse[]): Promise<void> {
    // Handle both single model and array of models
    const modelArray = Array.isArray(models) ? models : [models]
    if (!modelArray.length)
      return

    const modelIds = modelArray.map(model => model.id)

    for (const relation of this.withRelations) {
      const relatedRecords = await DB.instance
        .selectFrom(relation)
        .where('websocket_id', 'in', modelIds)
        .selectAll()
        .execute()

      if (Array.isArray(models)) {
        models.map((model: WebsocketJsonResponse) => {
          const records = relatedRecords.filter((record: { websocket_id: number }) => {
            return record.websocket_id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      }
      else {
        const records = relatedRecords.filter((record: { websocket_id: number }) => {
          return record.websocket_id === models.id
        })

        models[relation] = records.length === 1 ? records[0] : records
      }
    }
  }

  static with(relations: string[]): WebsocketModel {
    const instance = new WebsocketModel(undefined)

    return instance.applyWith(relations)
  }

  protected mapCustomGetters(models: WebsocketJsonResponse | WebsocketJsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: WebsocketJsonResponse) => {
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

  async mapCustomSetters(model: NewWebsocket | WebsocketUpdate): Promise<void> {
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

  get type(): string | string[] | undefined {
    return this.attributes.type
  }

  get socket(): string | undefined {
    return this.attributes.socket
  }

  get details(): string | undefined {
    return this.attributes.details
  }

  get time(): number | undefined {
    return this.attributes.time
  }

  get created_at(): string | undefined {
    return this.attributes.created_at
  }

  get updated_at(): string | undefined {
    return this.attributes.updated_at
  }

  set type(value: string | string[]) {
    this.attributes.type = value
  }

  set socket(value: string) {
    this.attributes.socket = value
  }

  set details(value: string) {
    this.attributes.details = value
  }

  set time(value: number) {
    this.attributes.time = value
  }

  set updated_at(value: string) {
    this.attributes.updated_at = value
  }

  static select(params: (keyof WebsocketJsonResponse)[] | RawBuilder<string> | string): WebsocketModel {
    const instance = new WebsocketModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a Websocket by ID
  static async find(id: number): Promise<WebsocketModel | undefined> {
    const query = DB.instance.selectFrom('websockets').where('id', '=', id).selectAll()

    const model = await query.executeTakeFirst()

    if (!model)
      return undefined

    const instance = new WebsocketModel(undefined)
    return instance.createInstance(model)
  }

  static async first(): Promise<WebsocketModel | undefined> {
    const instance = new WebsocketModel(undefined)

    const model = await instance.applyFirst()

    const data = new WebsocketModel(model)

    return data
  }

  static async last(): Promise<WebsocketModel | undefined> {
    const instance = new WebsocketModel(undefined)

    const model = await instance.applyLast()

    if (!model)
      return undefined

    return new WebsocketModel(model)
  }

  static async firstOrFail(): Promise<WebsocketModel | undefined> {
    const instance = new WebsocketModel(undefined)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<WebsocketModel[]> {
    const instance = new WebsocketModel(undefined)

    const models = await DB.instance.selectFrom('websockets').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: WebsocketJsonResponse) => {
      return new WebsocketModel(model)
    }))

    return data
  }

  static async findOrFail(id: number): Promise<WebsocketModel | undefined> {
    const instance = new WebsocketModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<WebsocketModel[]> {
    const instance = new WebsocketModel(undefined)

    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: WebsocketJsonResponse) => instance.parseResult(new WebsocketModel(modelItem)))
  }

  static async latest(column: keyof WebsocketsTable = 'created_at'): Promise<WebsocketModel | undefined> {
    const instance = new WebsocketModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'desc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new WebsocketModel(model)
  }

  static async oldest(column: keyof WebsocketsTable = 'created_at'): Promise<WebsocketModel | undefined> {
    const instance = new WebsocketModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'asc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new WebsocketModel(model)
  }

  static skip(count: number): WebsocketModel {
    const instance = new WebsocketModel(undefined)

    return instance.applySkip(count)
  }

  static take(count: number): WebsocketModel {
    const instance = new WebsocketModel(undefined)

    return instance.applyTake(count)
  }

  static where<V = string>(column: keyof WebsocketsTable, ...args: [V] | [Operator, V]): WebsocketModel {
    const instance = new WebsocketModel(undefined)

    return instance.applyWhere<V>(column, ...args)
  }

  static orWhere(...conditions: [string, any][]): WebsocketModel {
    const instance = new WebsocketModel(undefined)

    return instance.applyOrWhere(...conditions)
  }

  static whereNotIn<V = number>(column: keyof WebsocketsTable, values: V[]): WebsocketModel {
    const instance = new WebsocketModel(undefined)

    return instance.applyWhereNotIn<V>(column, values)
  }

  static whereBetween<V = number>(column: keyof WebsocketsTable, range: [V, V]): WebsocketModel {
    const instance = new WebsocketModel(undefined)

    return instance.applyWhereBetween<V>(column, range)
  }

  static whereRef(column: keyof WebsocketsTable, ...args: string[]): WebsocketModel {
    const instance = new WebsocketModel(undefined)

    return instance.applyWhereRef(column, ...args)
  }

  static when(condition: boolean, callback: (query: WebsocketModel) => WebsocketModel): WebsocketModel {
    const instance = new WebsocketModel(undefined)

    return instance.applyWhen(condition, callback as any)
  }

  static whereNull(column: keyof WebsocketsTable): WebsocketModel {
    const instance = new WebsocketModel(undefined)

    return instance.applyWhereNull(column)
  }

  static whereNotNull(column: keyof WebsocketsTable): WebsocketModel {
    const instance = new WebsocketModel(undefined)

    return instance.applyWhereNotNull(column)
  }

  static whereLike(column: keyof WebsocketsTable, value: string): WebsocketModel {
    const instance = new WebsocketModel(undefined)

    return instance.applyWhereLike(column, value)
  }

  static orderBy(column: keyof WebsocketsTable, order: 'asc' | 'desc'): WebsocketModel {
    const instance = new WebsocketModel(undefined)

    return instance.applyOrderBy(column, order)
  }

  static orderByAsc(column: keyof WebsocketsTable): WebsocketModel {
    const instance = new WebsocketModel(undefined)

    return instance.applyOrderByAsc(column)
  }

  static orderByDesc(column: keyof WebsocketsTable): WebsocketModel {
    const instance = new WebsocketModel(undefined)

    return instance.applyOrderByDesc(column)
  }

  static groupBy(column: keyof WebsocketsTable): WebsocketModel {
    const instance = new WebsocketModel(undefined)

    return instance.applyGroupBy(column)
  }

  static having<V = string>(column: keyof WebsocketsTable, operator: Operator, value: V): WebsocketModel {
    const instance = new WebsocketModel(undefined)

    return instance.applyHaving<V>(column, operator, value)
  }

  static inRandomOrder(): WebsocketModel {
    const instance = new WebsocketModel(undefined)

    return instance.applyInRandomOrder()
  }

  static whereColumn(first: keyof WebsocketsTable, operator: Operator, second: keyof WebsocketsTable): WebsocketModel {
    const instance = new WebsocketModel(undefined)

    return instance.applyWhereColumn(first, operator, second)
  }

  static async max(field: keyof WebsocketsTable): Promise<number> {
    const instance = new WebsocketModel(undefined)

    return await instance.applyMax(field)
  }

  static async min(field: keyof WebsocketsTable): Promise<number> {
    const instance = new WebsocketModel(undefined)

    return await instance.applyMin(field)
  }

  static async avg(field: keyof WebsocketsTable): Promise<number> {
    const instance = new WebsocketModel(undefined)

    return await instance.applyAvg(field)
  }

  static async sum(field: keyof WebsocketsTable): Promise<number> {
    const instance = new WebsocketModel(undefined)

    return await instance.applySum(field)
  }

  static async count(): Promise<number> {
    const instance = new WebsocketModel(undefined)

    return instance.applyCount()
  }

  static async get(): Promise<WebsocketModel[]> {
    const instance = new WebsocketModel(undefined)

    const results = await instance.applyGet()

    return results.map((item: WebsocketJsonResponse) => instance.createInstance(item))
  }

  static async pluck<K extends keyof WebsocketModel>(field: K): Promise<WebsocketModel[K][]> {
    const instance = new WebsocketModel(undefined)

    return await instance.applyPluck(field)
  }

  static async chunk(size: number, callback: (models: WebsocketModel[]) => Promise<void>): Promise<void> {
    const instance = new WebsocketModel(undefined)

    await instance.applyChunk(size, async (models) => {
      const modelInstances = models.map((item: WebsocketJsonResponse) => instance.createInstance(item))
      await callback(modelInstances)
    })
  }

  static async paginate(options: { limit?: number, offset?: number, page?: number } = { limit: 10, offset: 0, page: 1 }): Promise<{
    data: WebsocketModel[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }> {
    const instance = new WebsocketModel(undefined)

    const result = await instance.applyPaginate(options)

    return {
      data: result.data.map((item: WebsocketJsonResponse) => instance.createInstance(item)),
      paging: result.paging,
      next_cursor: result.next_cursor,
    }
  }

  // Instance method for creating model instances
  createInstance(data: WebsocketJsonResponse): WebsocketModel {
    return new WebsocketModel(data)
  }

  async applyCreate(newWebsocket: NewWebsocket): Promise<WebsocketModel> {
    const filteredValues = Object.fromEntries(
      Object.entries(newWebsocket).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewWebsocket

    await this.mapCustomSetters(filteredValues)

    const result = await DB.instance.insertInto('websockets')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await DB.instance.selectFrom('websockets')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created Websocket')
    }

    if (model)
      dispatch('websocket:created', model)
    return this.createInstance(model)
  }

  async create(newWebsocket: NewWebsocket): Promise<WebsocketModel> {
    return await this.applyCreate(newWebsocket)
  }

  static async create(newWebsocket: NewWebsocket): Promise<WebsocketModel> {
    const instance = new WebsocketModel(undefined)
    return await instance.applyCreate(newWebsocket)
  }

  static async firstOrCreate(search: Partial<WebsocketsTable>, values: NewWebsocket = {} as NewWebsocket): Promise<WebsocketModel> {
    // First try to find a record matching the search criteria
    const instance = new WebsocketModel(undefined)

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
    const createData = { ...search, ...values } as NewWebsocket
    return await WebsocketModel.create(createData)
  }

  static async updateOrCreate(search: Partial<WebsocketsTable>, values: NewWebsocket = {} as NewWebsocket): Promise<WebsocketModel> {
    // First try to find a record matching the search criteria
    const instance = new WebsocketModel(undefined)

    // Apply all search conditions
    for (const [key, value] of Object.entries(search)) {
      instance.selectFromQuery = instance.selectFromQuery.where(key, '=', value)
    }

    // Try to find the record
    const existingRecord = await instance.applyFirst()

    if (existingRecord) {
      // If record exists, update it with the new values
      const model = instance.createInstance(existingRecord)
      const updatedModel = await model.update(values as WebsocketUpdate)

      // Return the updated model instance
      if (updatedModel) {
        return updatedModel
      }

      // If update didn't return a model, fetch it again to ensure we have latest data
      const refreshedModel = await instance.applyFirst()
      return instance.createInstance(refreshedModel!)
    }

    // If no record exists, create a new one with combined search criteria and values
    const createData = { ...search, ...values } as NewWebsocket
    return await WebsocketModel.create(createData)
  }

  async update(newWebsocket: WebsocketUpdate): Promise<WebsocketModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newWebsocket).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as WebsocketUpdate

    await this.mapCustomSetters(filteredValues)

    filteredValues.updated_at = new Date().toISOString()

    await DB.instance.updateTable('websockets')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('websockets')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated Websocket')
      }

      if (model)
        dispatch('websocket:updated', model)
      return this.createInstance(model)
    }

    return undefined
  }

  async forceUpdate(newWebsocket: WebsocketUpdate): Promise<WebsocketModel | undefined> {
    await DB.instance.updateTable('websockets')
      .set(newWebsocket)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('websockets')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated Websocket')
      }

      if (this)
        dispatch('websocket:updated', model)
      return this.createInstance(model)
    }

    return undefined
  }

  async save(): Promise<WebsocketModel> {
    // If the model has an ID, update it; otherwise, create a new record
    if (this.id) {
      // Update existing record
      await DB.instance.updateTable('websockets')
        .set(this.attributes as WebsocketUpdate)
        .where('id', '=', this.id)
        .executeTakeFirst()

      // Get the updated data
      const model = await DB.instance.selectFrom('websockets')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated Websocket')
      }

      if (this)
        dispatch('websocket:updated', model)
      return this.createInstance(model)
    }
    else {
      // Create new record
      const result = await DB.instance.insertInto('websockets')
        .values(this.attributes as NewWebsocket)
        .executeTakeFirst()

      // Get the created data
      const model = await DB.instance.selectFrom('websockets')
        .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve created Websocket')
      }

      if (this)
        dispatch('websocket:created', model)
      return this.createInstance(model)
    }
  }

  static async createMany(newWebsocket: NewWebsocket[]): Promise<void> {
    const instance = new WebsocketModel(undefined)

    const valuesFiltered = newWebsocket.map((newWebsocket: NewWebsocket) => {
      const filteredValues = Object.fromEntries(
        Object.entries(newWebsocket).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewWebsocket

      return filteredValues
    })

    await DB.instance.insertInto('websockets')
      .values(valuesFiltered)
      .executeTakeFirst()
  }

  static async forceCreate(newWebsocket: NewWebsocket): Promise<WebsocketModel> {
    const result = await DB.instance.insertInto('websockets')
      .values(newWebsocket)
      .executeTakeFirst()

    const instance = new WebsocketModel(undefined)
    const model = await DB.instance.selectFrom('websockets')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created Websocket')
    }

    if (model)
      dispatch('websocket:created', model)

    return instance.createInstance(model)
  }

  // Method to remove a Websocket
  async delete(): Promise<number> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()
    const model = await this.find(Number(this.id))

    if (model)
      dispatch('websocket:deleted', model)

    const deleted = await DB.instance.deleteFrom('websockets')
      .where('id', '=', this.id)
      .execute()

    return deleted.numDeletedRows
  }

  static async remove(id: number): Promise<any> {
    const instance = new WebsocketModel(undefined)

    const model = await instance.find(Number(id))

    if (model)
      dispatch('websocket:deleted', model)

    return await DB.instance.deleteFrom('websockets')
      .where('id', '=', id)
      .execute()
  }

  static whereType(value: string): WebsocketModel {
    const instance = new WebsocketModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('type', '=', value)

    return instance
  }

  static whereSocket(value: string): WebsocketModel {
    const instance = new WebsocketModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('socket', '=', value)

    return instance
  }

  static whereDetails(value: string): WebsocketModel {
    const instance = new WebsocketModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('details', '=', value)

    return instance
  }

  static whereTime(value: string): WebsocketModel {
    const instance = new WebsocketModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('time', '=', value)

    return instance
  }

  static whereIn<V = number>(column: keyof WebsocketsTable, values: V[]): WebsocketModel {
    const instance = new WebsocketModel(undefined)

    return instance.applyWhereIn<V>(column, values)
  }

  static distinct(column: keyof WebsocketJsonResponse): WebsocketModel {
    const instance = new WebsocketModel(undefined)

    return instance.applyDistinct(column)
  }

  static join(table: string, firstCol: string, secondCol: string): WebsocketModel {
    const instance = new WebsocketModel(undefined)

    return instance.applyJoin(table, firstCol, secondCol)
  }

  toJSON(): WebsocketJsonResponse {
    const output = {

      id: this.id,
      type: this.type,
      socket: this.socket,
      details: this.details,
      time: this.time,

      created_at: this.created_at,

      updated_at: this.updated_at,

      ...this.customColumns,
    }

    return output
  }

  parseResult(model: WebsocketModel): WebsocketModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof WebsocketModel]
    }

    return model
  }

  // Add a protected applyFind implementation
  protected async applyFind(id: number): Promise<WebsocketModel | undefined> {
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

export async function find(id: number): Promise<WebsocketModel | undefined> {
  const query = DB.instance.selectFrom('websockets').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  const instance = new WebsocketModel(undefined)
  return instance.createInstance(model)
}

export async function count(): Promise<number> {
  const results = await WebsocketModel.count()

  return results
}

export async function create(newWebsocket: NewWebsocket): Promise<WebsocketModel> {
  const instance = new WebsocketModel(undefined)
  return await instance.applyCreate(newWebsocket)
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(DB.instance)
}

export async function remove(id: number): Promise<void> {
  await DB.instance.deleteFrom('websockets')
    .where('id', '=', id)
    .execute()
}

export async function whereType(value: string | string[]): Promise<WebsocketModel[]> {
  const query = DB.instance.selectFrom('websockets').where('type', '=', value)
  const results: WebsocketJsonResponse = await query.execute()

  return results.map((modelItem: WebsocketJsonResponse) => new WebsocketModel(modelItem))
}

export async function whereSocket(value: string): Promise<WebsocketModel[]> {
  const query = DB.instance.selectFrom('websockets').where('socket', '=', value)
  const results: WebsocketJsonResponse = await query.execute()

  return results.map((modelItem: WebsocketJsonResponse) => new WebsocketModel(modelItem))
}

export async function whereDetails(value: string): Promise<WebsocketModel[]> {
  const query = DB.instance.selectFrom('websockets').where('details', '=', value)
  const results: WebsocketJsonResponse = await query.execute()

  return results.map((modelItem: WebsocketJsonResponse) => new WebsocketModel(modelItem))
}

export async function whereTime(value: number): Promise<WebsocketModel[]> {
  const query = DB.instance.selectFrom('websockets').where('time', '=', value)
  const results: WebsocketJsonResponse = await query.execute()

  return results.map((modelItem: WebsocketJsonResponse) => new WebsocketModel(modelItem))
}

export const Websocket = WebsocketModel

export default Websocket
