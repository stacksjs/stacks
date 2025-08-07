import type { RawBuilder } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import type { DeliveryRouteJsonResponse, DeliveryRoutesTable, DeliveryRouteUpdate, NewDeliveryRoute } from '../types/DeliveryRouteType'
import { randomUUIDv7 } from 'bun'
import { sql } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'
import { dispatch } from '@stacksjs/events'
import { DB } from '@stacksjs/orm'

import { BaseOrm } from '../utils/base'

export class DeliveryRouteModel extends BaseOrm<DeliveryRouteModel, DeliveryRoutesTable, DeliveryRouteJsonResponse> {
  private readonly hidden: Array<keyof DeliveryRouteJsonResponse> = []
  private readonly fillable: Array<keyof DeliveryRouteJsonResponse> = ['driver', 'vehicle', 'stops', 'delivery_time', 'total_distance', 'last_active', 'uuid', 'driver_id']
  private readonly guarded: Array<keyof DeliveryRouteJsonResponse> = []
  protected attributes = {} as DeliveryRouteJsonResponse
  protected originalAttributes = {} as DeliveryRouteJsonResponse

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

  constructor(deliveryRoute: DeliveryRouteJsonResponse | undefined) {
    super('delivery_routes')
    if (deliveryRoute) {
      this.attributes = { ...deliveryRoute }
      this.originalAttributes = { ...deliveryRoute }

      Object.keys(deliveryRoute).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (deliveryRoute as DeliveryRouteJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = DB.instance.selectFrom('delivery_routes')
    this.updateFromQuery = DB.instance.updateTable('delivery_routes')
    this.deleteFromQuery = DB.instance.deleteFrom('delivery_routes')
    this.hasSelect = false
  }

  protected async loadRelations(models: DeliveryRouteJsonResponse | DeliveryRouteJsonResponse[]): Promise<void> {
    // Handle both single model and array of models
    const modelArray = Array.isArray(models) ? models : [models]
    if (!modelArray.length)
      return

    const modelIds = modelArray.map(model => model.id)

    for (const relation of this.withRelations) {
      const relatedRecords = await DB.instance
        .selectFrom(relation)
        .where('deliveryRoute_id', 'in', modelIds)
        .selectAll()
        .execute()

      if (Array.isArray(models)) {
        models.map((model: DeliveryRouteJsonResponse) => {
          const records = relatedRecords.filter((record: { deliveryRoute_id: number }) => {
            return record.deliveryRoute_id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      }
      else {
        const records = relatedRecords.filter((record: { deliveryRoute_id: number }) => {
          return record.deliveryRoute_id === models.id
        })

        models[relation] = records.length === 1 ? records[0] : records
      }
    }
  }

  static with(relations: string[]): DeliveryRouteModel {
    const instance = new DeliveryRouteModel(undefined)

    return instance.applyWith(relations)
  }

  protected mapCustomGetters(models: DeliveryRouteJsonResponse | DeliveryRouteJsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: DeliveryRouteJsonResponse) => {
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

  async mapCustomSetters(model: NewDeliveryRoute | DeliveryRouteUpdate): Promise<void> {
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

  get driver(): string {
    return this.attributes.driver
  }

  get vehicle(): string {
    return this.attributes.vehicle
  }

  get stops(): number {
    return this.attributes.stops
  }

  get delivery_time(): number {
    return this.attributes.delivery_time
  }

  get total_distance(): number {
    return this.attributes.total_distance
  }

  get last_active(): Date | string {
    return this.attributes.last_active
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

  set driver(value: string) {
    this.attributes.driver = value
  }

  set vehicle(value: string) {
    this.attributes.vehicle = value
  }

  set stops(value: number) {
    this.attributes.stops = value
  }

  set delivery_time(value: number) {
    this.attributes.delivery_time = value
  }

  set total_distance(value: number) {
    this.attributes.total_distance = value
  }

  set last_active(value: Date | string) {
    this.attributes.last_active = value
  }

  set updated_at(value: string) {
    this.attributes.updated_at = value
  }

  static select(params: (keyof DeliveryRouteJsonResponse)[] | RawBuilder<string> | string): DeliveryRouteModel {
    const instance = new DeliveryRouteModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a DeliveryRoute by ID
  static async find(id: number): Promise<DeliveryRouteModel | undefined> {
    const query = DB.instance.selectFrom('delivery_routes').where('id', '=', id).selectAll()

    const model = await query.executeTakeFirst()

    if (!model)
      return undefined

    const instance = new DeliveryRouteModel(undefined)
    return instance.createInstance(model)
  }

  static async first(): Promise<DeliveryRouteModel | undefined> {
    const instance = new DeliveryRouteModel(undefined)

    const model = await instance.applyFirst()

    const data = new DeliveryRouteModel(model)

    return data
  }

  static async last(): Promise<DeliveryRouteModel | undefined> {
    const instance = new DeliveryRouteModel(undefined)

    const model = await instance.applyLast()

    if (!model)
      return undefined

    return new DeliveryRouteModel(model)
  }

  static async firstOrFail(): Promise<DeliveryRouteModel | undefined> {
    const instance = new DeliveryRouteModel(undefined)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<DeliveryRouteModel[]> {
    const instance = new DeliveryRouteModel(undefined)

    const models = await DB.instance.selectFrom('delivery_routes').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: DeliveryRouteJsonResponse) => {
      return new DeliveryRouteModel(model)
    }))

    return data
  }

  static async findOrFail(id: number): Promise<DeliveryRouteModel | undefined> {
    const instance = new DeliveryRouteModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<DeliveryRouteModel[]> {
    const instance = new DeliveryRouteModel(undefined)

    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: DeliveryRouteJsonResponse) => instance.parseResult(new DeliveryRouteModel(modelItem)))
  }

  static async latest(column: keyof DeliveryRoutesTable = 'created_at'): Promise<DeliveryRouteModel | undefined> {
    const instance = new DeliveryRouteModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'desc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new DeliveryRouteModel(model)
  }

  static async oldest(column: keyof DeliveryRoutesTable = 'created_at'): Promise<DeliveryRouteModel | undefined> {
    const instance = new DeliveryRouteModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'asc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new DeliveryRouteModel(model)
  }

  static skip(count: number): DeliveryRouteModel {
    const instance = new DeliveryRouteModel(undefined)

    return instance.applySkip(count)
  }

  static take(count: number): DeliveryRouteModel {
    const instance = new DeliveryRouteModel(undefined)

    return instance.applyTake(count)
  }

  static where<V = string>(column: keyof DeliveryRoutesTable, ...args: [V] | [Operator, V]): DeliveryRouteModel {
    const instance = new DeliveryRouteModel(undefined)

    return instance.applyWhere<V>(column, ...args)
  }

  static orWhere(...conditions: [string, any][]): DeliveryRouteModel {
    const instance = new DeliveryRouteModel(undefined)

    return instance.applyOrWhere(...conditions)
  }

  static whereNotIn<V = number>(column: keyof DeliveryRoutesTable, values: V[]): DeliveryRouteModel {
    const instance = new DeliveryRouteModel(undefined)

    return instance.applyWhereNotIn<V>(column, values)
  }

  static whereBetween<V = number>(column: keyof DeliveryRoutesTable, range: [V, V]): DeliveryRouteModel {
    const instance = new DeliveryRouteModel(undefined)

    return instance.applyWhereBetween<V>(column, range)
  }

  static whereRef(column: keyof DeliveryRoutesTable, ...args: string[]): DeliveryRouteModel {
    const instance = new DeliveryRouteModel(undefined)

    return instance.applyWhereRef(column, ...args)
  }

  static when(condition: boolean, callback: (query: DeliveryRouteModel) => DeliveryRouteModel): DeliveryRouteModel {
    const instance = new DeliveryRouteModel(undefined)

    return instance.applyWhen(condition, callback as any)
  }

  static whereNull(column: keyof DeliveryRoutesTable): DeliveryRouteModel {
    const instance = new DeliveryRouteModel(undefined)

    return instance.applyWhereNull(column)
  }

  static whereNotNull(column: keyof DeliveryRoutesTable): DeliveryRouteModel {
    const instance = new DeliveryRouteModel(undefined)

    return instance.applyWhereNotNull(column)
  }

  static whereLike(column: keyof DeliveryRoutesTable, value: string): DeliveryRouteModel {
    const instance = new DeliveryRouteModel(undefined)

    return instance.applyWhereLike(column, value)
  }

  static orderBy(column: keyof DeliveryRoutesTable, order: 'asc' | 'desc'): DeliveryRouteModel {
    const instance = new DeliveryRouteModel(undefined)

    return instance.applyOrderBy(column, order)
  }

  static orderByAsc(column: keyof DeliveryRoutesTable): DeliveryRouteModel {
    const instance = new DeliveryRouteModel(undefined)

    return instance.applyOrderByAsc(column)
  }

  static orderByDesc(column: keyof DeliveryRoutesTable): DeliveryRouteModel {
    const instance = new DeliveryRouteModel(undefined)

    return instance.applyOrderByDesc(column)
  }

  static groupBy(column: keyof DeliveryRoutesTable): DeliveryRouteModel {
    const instance = new DeliveryRouteModel(undefined)

    return instance.applyGroupBy(column)
  }

  static having<V = string>(column: keyof DeliveryRoutesTable, operator: Operator, value: V): DeliveryRouteModel {
    const instance = new DeliveryRouteModel(undefined)

    return instance.applyHaving<V>(column, operator, value)
  }

  static inRandomOrder(): DeliveryRouteModel {
    const instance = new DeliveryRouteModel(undefined)

    return instance.applyInRandomOrder()
  }

  static whereColumn(first: keyof DeliveryRoutesTable, operator: Operator, second: keyof DeliveryRoutesTable): DeliveryRouteModel {
    const instance = new DeliveryRouteModel(undefined)

    return instance.applyWhereColumn(first, operator, second)
  }

  static async max(field: keyof DeliveryRoutesTable): Promise<number> {
    const instance = new DeliveryRouteModel(undefined)

    return await instance.applyMax(field)
  }

  static async min(field: keyof DeliveryRoutesTable): Promise<number> {
    const instance = new DeliveryRouteModel(undefined)

    return await instance.applyMin(field)
  }

  static async avg(field: keyof DeliveryRoutesTable): Promise<number> {
    const instance = new DeliveryRouteModel(undefined)

    return await instance.applyAvg(field)
  }

  static async sum(field: keyof DeliveryRoutesTable): Promise<number> {
    const instance = new DeliveryRouteModel(undefined)

    return await instance.applySum(field)
  }

  static async count(): Promise<number> {
    const instance = new DeliveryRouteModel(undefined)

    return instance.applyCount()
  }

  static async get(): Promise<DeliveryRouteModel[]> {
    const instance = new DeliveryRouteModel(undefined)

    const results = await instance.applyGet()

    return results.map((item: DeliveryRouteJsonResponse) => instance.createInstance(item))
  }

  static async pluck<K extends keyof DeliveryRouteModel>(field: K): Promise<DeliveryRouteModel[K][]> {
    const instance = new DeliveryRouteModel(undefined)

    return await instance.applyPluck(field)
  }

  static async chunk(size: number, callback: (models: DeliveryRouteModel[]) => Promise<void>): Promise<void> {
    const instance = new DeliveryRouteModel(undefined)

    await instance.applyChunk(size, async (models) => {
      const modelInstances = models.map((item: DeliveryRouteJsonResponse) => instance.createInstance(item))
      await callback(modelInstances)
    })
  }

  static async paginate(options: { limit?: number, offset?: number, page?: number } = { limit: 10, offset: 0, page: 1 }): Promise<{
    data: DeliveryRouteModel[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }> {
    const instance = new DeliveryRouteModel(undefined)

    const result = await instance.applyPaginate(options)

    return {
      data: result.data.map((item: DeliveryRouteJsonResponse) => instance.createInstance(item)),
      paging: result.paging,
      next_cursor: result.next_cursor,
    }
  }

  // Instance method for creating model instances
  createInstance(data: DeliveryRouteJsonResponse): DeliveryRouteModel {
    return new DeliveryRouteModel(data)
  }

  async applyCreate(newDeliveryRoute: NewDeliveryRoute): Promise<DeliveryRouteModel> {
    const filteredValues = Object.fromEntries(
      Object.entries(newDeliveryRoute).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewDeliveryRoute

    await this.mapCustomSetters(filteredValues)

    filteredValues.uuid = randomUUIDv7()

    const result = await DB.instance.insertInto('delivery_routes')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await DB.instance.selectFrom('delivery_routes')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created DeliveryRoute')
    }

    if (model)
      dispatch('deliveryRoute:created', model)
    return this.createInstance(model)
  }

  async create(newDeliveryRoute: NewDeliveryRoute): Promise<DeliveryRouteModel> {
    return await this.applyCreate(newDeliveryRoute)
  }

  static async create(newDeliveryRoute: NewDeliveryRoute): Promise<DeliveryRouteModel> {
    const instance = new DeliveryRouteModel(undefined)
    return await instance.applyCreate(newDeliveryRoute)
  }

  static async firstOrCreate(search: Partial<DeliveryRoutesTable>, values: NewDeliveryRoute = {} as NewDeliveryRoute): Promise<DeliveryRouteModel> {
    // First try to find a record matching the search criteria
    const instance = new DeliveryRouteModel(undefined)

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
    const createData = { ...search, ...values } as NewDeliveryRoute
    return await DeliveryRouteModel.create(createData)
  }

  static async updateOrCreate(search: Partial<DeliveryRoutesTable>, values: NewDeliveryRoute = {} as NewDeliveryRoute): Promise<DeliveryRouteModel> {
    // First try to find a record matching the search criteria
    const instance = new DeliveryRouteModel(undefined)

    // Apply all search conditions
    for (const [key, value] of Object.entries(search)) {
      instance.selectFromQuery = instance.selectFromQuery.where(key, '=', value)
    }

    // Try to find the record
    const existingRecord = await instance.applyFirst()

    if (existingRecord) {
      // If record exists, update it with the new values
      const model = instance.createInstance(existingRecord)
      const updatedModel = await model.update(values as DeliveryRouteUpdate)

      // Return the updated model instance
      if (updatedModel) {
        return updatedModel
      }

      // If update didn't return a model, fetch it again to ensure we have latest data
      const refreshedModel = await instance.applyFirst()
      return instance.createInstance(refreshedModel!)
    }

    // If no record exists, create a new one with combined search criteria and values
    const createData = { ...search, ...values } as NewDeliveryRoute
    return await DeliveryRouteModel.create(createData)
  }

  async update(newDeliveryRoute: DeliveryRouteUpdate): Promise<DeliveryRouteModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newDeliveryRoute).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as DeliveryRouteUpdate

    await this.mapCustomSetters(filteredValues)

    filteredValues.updated_at = new Date().toISOString()

    await DB.instance.updateTable('delivery_routes')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('delivery_routes')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated DeliveryRoute')
      }

      if (model)
        dispatch('deliveryRoute:updated', model)
      return this.createInstance(model)
    }

    return undefined
  }

  async forceUpdate(newDeliveryRoute: DeliveryRouteUpdate): Promise<DeliveryRouteModel | undefined> {
    await DB.instance.updateTable('delivery_routes')
      .set(newDeliveryRoute)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('delivery_routes')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated DeliveryRoute')
      }

      if (this)
        dispatch('deliveryRoute:updated', model)
      return this.createInstance(model)
    }

    return undefined
  }

  async save(): Promise<DeliveryRouteModel> {
    // If the model has an ID, update it; otherwise, create a new record
    if (this.id) {
      // Update existing record
      await DB.instance.updateTable('delivery_routes')
        .set(this.attributes as DeliveryRouteUpdate)
        .where('id', '=', this.id)
        .executeTakeFirst()

      // Get the updated data
      const model = await DB.instance.selectFrom('delivery_routes')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated DeliveryRoute')
      }

      if (this)
        dispatch('deliveryRoute:updated', model)
      return this.createInstance(model)
    }
    else {
      // Create new record
      const result = await DB.instance.insertInto('delivery_routes')
        .values(this.attributes as NewDeliveryRoute)
        .executeTakeFirst()

      // Get the created data
      const model = await DB.instance.selectFrom('delivery_routes')
        .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve created DeliveryRoute')
      }

      if (this)
        dispatch('deliveryRoute:created', model)
      return this.createInstance(model)
    }
  }

  static async createMany(newDeliveryRoute: NewDeliveryRoute[]): Promise<void> {
    const instance = new DeliveryRouteModel(undefined)

    const valuesFiltered = newDeliveryRoute.map((newDeliveryRoute: NewDeliveryRoute) => {
      const filteredValues = Object.fromEntries(
        Object.entries(newDeliveryRoute).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewDeliveryRoute

      filteredValues.uuid = randomUUIDv7()

      return filteredValues
    })

    await DB.instance.insertInto('delivery_routes')
      .values(valuesFiltered)
      .executeTakeFirst()
  }

  static async forceCreate(newDeliveryRoute: NewDeliveryRoute): Promise<DeliveryRouteModel> {
    const result = await DB.instance.insertInto('delivery_routes')
      .values(newDeliveryRoute)
      .executeTakeFirst()

    const instance = new DeliveryRouteModel(undefined)
    const model = await DB.instance.selectFrom('delivery_routes')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created DeliveryRoute')
    }

    if (model)
      dispatch('deliveryRoute:created', model)

    return instance.createInstance(model)
  }

  // Method to remove a DeliveryRoute
  async delete(): Promise<number> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()
    const model = await this.find(Number(this.id))

    if (model)
      dispatch('deliveryRoute:deleted', model)

    const deleted = await DB.instance.deleteFrom('delivery_routes')
      .where('id', '=', this.id)
      .execute()

    return deleted.numDeletedRows
  }

  static async remove(id: number): Promise<any> {
    const instance = new DeliveryRouteModel(undefined)

    const model = await instance.find(Number(id))

    if (model)
      dispatch('deliveryRoute:deleted', model)

    return await DB.instance.deleteFrom('delivery_routes')
      .where('id', '=', id)
      .execute()
  }

  static whereDriver(value: string): DeliveryRouteModel {
    const instance = new DeliveryRouteModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('driver', '=', value)

    return instance
  }

  static whereVehicle(value: string): DeliveryRouteModel {
    const instance = new DeliveryRouteModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('vehicle', '=', value)

    return instance
  }

  static whereStops(value: string): DeliveryRouteModel {
    const instance = new DeliveryRouteModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('stops', '=', value)

    return instance
  }

  static whereDeliveryTime(value: string): DeliveryRouteModel {
    const instance = new DeliveryRouteModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('delivery_time', '=', value)

    return instance
  }

  static whereTotalDistance(value: string): DeliveryRouteModel {
    const instance = new DeliveryRouteModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('total_distance', '=', value)

    return instance
  }

  static whereLastActive(value: string): DeliveryRouteModel {
    const instance = new DeliveryRouteModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('last_active', '=', value)

    return instance
  }

  static whereIn<V = number>(column: keyof DeliveryRoutesTable, values: V[]): DeliveryRouteModel {
    const instance = new DeliveryRouteModel(undefined)

    return instance.applyWhereIn<V>(column, values)
  }

  toSearchableObject(): Partial<DeliveryRouteJsonResponse> {
    return {
      id: this.id,
      driver: this.driver,
      vehicle: this.vehicle,
      stops: this.stops,
      delivery_time: this.delivery_time,
      total_distance: this.total_distance,
      last_active: this.last_active,
    }
  }

  static distinct(column: keyof DeliveryRouteJsonResponse): DeliveryRouteModel {
    const instance = new DeliveryRouteModel(undefined)

    return instance.applyDistinct(column)
  }

  static join(table: string, firstCol: string, secondCol: string): DeliveryRouteModel {
    const instance = new DeliveryRouteModel(undefined)

    return instance.applyJoin(table, firstCol, secondCol)
  }

  toJSON(): DeliveryRouteJsonResponse {
    const output = {

      uuid: this.uuid,

      id: this.id,
      driver: this.driver,
      vehicle: this.vehicle,
      stops: this.stops,
      delivery_time: this.delivery_time,
      total_distance: this.total_distance,
      last_active: this.last_active,

      created_at: this.created_at,

      updated_at: this.updated_at,

      ...this.customColumns,
    }

    return output
  }

  parseResult(model: DeliveryRouteModel): DeliveryRouteModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof DeliveryRouteModel]
    }

    return model
  }

  // Add a protected applyFind implementation
  protected async applyFind(id: number): Promise<DeliveryRouteModel | undefined> {
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

export async function find(id: number): Promise<DeliveryRouteModel | undefined> {
  const query = DB.instance.selectFrom('delivery_routes').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  const instance = new DeliveryRouteModel(undefined)
  return instance.createInstance(model)
}

export async function count(): Promise<number> {
  const results = await DeliveryRouteModel.count()

  return results
}

export async function create(newDeliveryRoute: NewDeliveryRoute): Promise<DeliveryRouteModel> {
  const instance = new DeliveryRouteModel(undefined)
  return await instance.applyCreate(newDeliveryRoute)
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(DB.instance)
}

export async function remove(id: number): Promise<void> {
  await DB.instance.deleteFrom('delivery_routes')
    .where('id', '=', id)
    .execute()
}

export async function whereDriver(value: string): Promise<DeliveryRouteModel[]> {
  const query = DB.instance.selectFrom('delivery_routes').where('driver', '=', value)
  const results: DeliveryRouteJsonResponse = await query.execute()

  return results.map((modelItem: DeliveryRouteJsonResponse) => new DeliveryRouteModel(modelItem))
}

export async function whereVehicle(value: string): Promise<DeliveryRouteModel[]> {
  const query = DB.instance.selectFrom('delivery_routes').where('vehicle', '=', value)
  const results: DeliveryRouteJsonResponse = await query.execute()

  return results.map((modelItem: DeliveryRouteJsonResponse) => new DeliveryRouteModel(modelItem))
}

export async function whereStops(value: number): Promise<DeliveryRouteModel[]> {
  const query = DB.instance.selectFrom('delivery_routes').where('stops', '=', value)
  const results: DeliveryRouteJsonResponse = await query.execute()

  return results.map((modelItem: DeliveryRouteJsonResponse) => new DeliveryRouteModel(modelItem))
}

export async function whereDeliveryTime(value: number): Promise<DeliveryRouteModel[]> {
  const query = DB.instance.selectFrom('delivery_routes').where('delivery_time', '=', value)
  const results: DeliveryRouteJsonResponse = await query.execute()

  return results.map((modelItem: DeliveryRouteJsonResponse) => new DeliveryRouteModel(modelItem))
}

export async function whereTotalDistance(value: number): Promise<DeliveryRouteModel[]> {
  const query = DB.instance.selectFrom('delivery_routes').where('total_distance', '=', value)
  const results: DeliveryRouteJsonResponse = await query.execute()

  return results.map((modelItem: DeliveryRouteJsonResponse) => new DeliveryRouteModel(modelItem))
}

export async function whereLastActive(value: Date | string): Promise<DeliveryRouteModel[]> {
  const query = DB.instance.selectFrom('delivery_routes').where('last_active', '=', value)
  const results: DeliveryRouteJsonResponse = await query.execute()

  return results.map((modelItem: DeliveryRouteJsonResponse) => new DeliveryRouteModel(modelItem))
}

export const DeliveryRoute = DeliveryRouteModel

export default DeliveryRoute
