import type { RawBuilder } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import type { DriverJsonResponse, DriversTable, DriverUpdate, NewDriver } from '../types/DriverType'
import type { DeliveryRouteModel } from './DeliveryRoute'
import type { UserModel } from './User'
import { randomUUIDv7 } from 'bun'
import { sql } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'
import { dispatch } from '@stacksjs/events'
import { DB } from '@stacksjs/orm'

import { BaseOrm } from '../utils/base'

export class DriverModel extends BaseOrm<DriverModel, DriversTable, DriverJsonResponse> {
  private readonly hidden: Array<keyof DriverJsonResponse> = []
  private readonly fillable: Array<keyof DriverJsonResponse> = ['name', 'phone', 'vehicle_number', 'license', 'status', 'uuid', 'user_id']
  private readonly guarded: Array<keyof DriverJsonResponse> = []
  protected attributes = {} as DriverJsonResponse
  protected originalAttributes = {} as DriverJsonResponse

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

  constructor(driver: DriverJsonResponse | undefined) {
    super('drivers')
    if (driver) {
      this.attributes = { ...driver }
      this.originalAttributes = { ...driver }

      Object.keys(driver).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (driver as DriverJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = DB.instance.selectFrom('drivers')
    this.updateFromQuery = DB.instance.updateTable('drivers')
    this.deleteFromQuery = DB.instance.deleteFrom('drivers')
    this.hasSelect = false
  }

  protected async loadRelations(models: DriverJsonResponse | DriverJsonResponse[]): Promise<void> {
    // Handle both single model and array of models
    const modelArray = Array.isArray(models) ? models : [models]
    if (!modelArray.length)
      return

    const modelIds = modelArray.map(model => model.id)

    for (const relation of this.withRelations) {
      const relatedRecords = await DB.instance
        .selectFrom(relation)
        .where('driver_id', 'in', modelIds)
        .selectAll()
        .execute()

      if (Array.isArray(models)) {
        models.map((model: DriverJsonResponse) => {
          const records = relatedRecords.filter((record: { driver_id: number }) => {
            return record.driver_id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      }
      else {
        const records = relatedRecords.filter((record: { driver_id: number }) => {
          return record.driver_id === models.id
        })

        models[relation] = records.length === 1 ? records[0] : records
      }
    }
  }

  static with(relations: string[]): DriverModel {
    const instance = new DriverModel(undefined)

    return instance.applyWith(relations)
  }

  protected mapCustomGetters(models: DriverJsonResponse | DriverJsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: DriverJsonResponse) => {
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

  async mapCustomSetters(model: NewDriver | DriverUpdate): Promise<void> {
    const customSetter = {
      default: () => {
      },

    }

    for (const [key, fn] of Object.entries(customSetter)) {
      (model as any)[key] = await fn()
    }
  }

  get delivery_routes(): DeliveryRouteModel[] | [] {
    return this.attributes.delivery_routes
  }

  get user_id(): number {
    return this.attributes.user_id
  }

  get user(): UserModel | undefined {
    return this.attributes.user
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

  get phone(): string {
    return this.attributes.phone
  }

  get vehicle_number(): string {
    return this.attributes.vehicle_number
  }

  get license(): string {
    return this.attributes.license
  }

  get status(): string | string[] | undefined {
    return this.attributes.status
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

  set phone(value: string) {
    this.attributes.phone = value
  }

  set vehicle_number(value: string) {
    this.attributes.vehicle_number = value
  }

  set license(value: string) {
    this.attributes.license = value
  }

  set status(value: string | string[]) {
    this.attributes.status = value
  }

  set updated_at(value: string) {
    this.attributes.updated_at = value
  }

  static select(params: (keyof DriverJsonResponse)[] | RawBuilder<string> | string): DriverModel {
    const instance = new DriverModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a Driver by ID
  static async find(id: number): Promise<DriverModel | undefined> {
    const query = DB.instance.selectFrom('drivers').where('id', '=', id).selectAll()

    const model = await query.executeTakeFirst()

    if (!model)
      return undefined

    const instance = new DriverModel(undefined)
    return instance.createInstance(model)
  }

  static async first(): Promise<DriverModel | undefined> {
    const instance = new DriverModel(undefined)

    const model = await instance.applyFirst()

    const data = new DriverModel(model)

    return data
  }

  static async last(): Promise<DriverModel | undefined> {
    const instance = new DriverModel(undefined)

    const model = await instance.applyLast()

    if (!model)
      return undefined

    return new DriverModel(model)
  }

  static async firstOrFail(): Promise<DriverModel | undefined> {
    const instance = new DriverModel(undefined)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<DriverModel[]> {
    const instance = new DriverModel(undefined)

    const models = await DB.instance.selectFrom('drivers').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: DriverJsonResponse) => {
      return new DriverModel(model)
    }))

    return data
  }

  static async findOrFail(id: number): Promise<DriverModel | undefined> {
    const instance = new DriverModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<DriverModel[]> {
    const instance = new DriverModel(undefined)

    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: DriverJsonResponse) => instance.parseResult(new DriverModel(modelItem)))
  }

  static async latest(column: keyof DriversTable = 'created_at'): Promise<DriverModel | undefined> {
    const instance = new DriverModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'desc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new DriverModel(model)
  }

  static async oldest(column: keyof DriversTable = 'created_at'): Promise<DriverModel | undefined> {
    const instance = new DriverModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'asc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new DriverModel(model)
  }

  static skip(count: number): DriverModel {
    const instance = new DriverModel(undefined)

    return instance.applySkip(count)
  }

  static take(count: number): DriverModel {
    const instance = new DriverModel(undefined)

    return instance.applyTake(count)
  }

  static where<V = string>(column: keyof DriversTable, ...args: [V] | [Operator, V]): DriverModel {
    const instance = new DriverModel(undefined)

    return instance.applyWhere<V>(column, ...args)
  }

  static orWhere(...conditions: [string, any][]): DriverModel {
    const instance = new DriverModel(undefined)

    return instance.applyOrWhere(...conditions)
  }

  static whereNotIn<V = number>(column: keyof DriversTable, values: V[]): DriverModel {
    const instance = new DriverModel(undefined)

    return instance.applyWhereNotIn<V>(column, values)
  }

  static whereBetween<V = number>(column: keyof DriversTable, range: [V, V]): DriverModel {
    const instance = new DriverModel(undefined)

    return instance.applyWhereBetween<V>(column, range)
  }

  static whereRef(column: keyof DriversTable, ...args: string[]): DriverModel {
    const instance = new DriverModel(undefined)

    return instance.applyWhereRef(column, ...args)
  }

  static when(condition: boolean, callback: (query: DriverModel) => DriverModel): DriverModel {
    const instance = new DriverModel(undefined)

    return instance.applyWhen(condition, callback as any)
  }

  static whereNull(column: keyof DriversTable): DriverModel {
    const instance = new DriverModel(undefined)

    return instance.applyWhereNull(column)
  }

  static whereNotNull(column: keyof DriversTable): DriverModel {
    const instance = new DriverModel(undefined)

    return instance.applyWhereNotNull(column)
  }

  static whereLike(column: keyof DriversTable, value: string): DriverModel {
    const instance = new DriverModel(undefined)

    return instance.applyWhereLike(column, value)
  }

  static orderBy(column: keyof DriversTable, order: 'asc' | 'desc'): DriverModel {
    const instance = new DriverModel(undefined)

    return instance.applyOrderBy(column, order)
  }

  static orderByAsc(column: keyof DriversTable): DriverModel {
    const instance = new DriverModel(undefined)

    return instance.applyOrderByAsc(column)
  }

  static orderByDesc(column: keyof DriversTable): DriverModel {
    const instance = new DriverModel(undefined)

    return instance.applyOrderByDesc(column)
  }

  static groupBy(column: keyof DriversTable): DriverModel {
    const instance = new DriverModel(undefined)

    return instance.applyGroupBy(column)
  }

  static having<V = string>(column: keyof DriversTable, operator: Operator, value: V): DriverModel {
    const instance = new DriverModel(undefined)

    return instance.applyHaving<V>(column, operator, value)
  }

  static inRandomOrder(): DriverModel {
    const instance = new DriverModel(undefined)

    return instance.applyInRandomOrder()
  }

  static whereColumn(first: keyof DriversTable, operator: Operator, second: keyof DriversTable): DriverModel {
    const instance = new DriverModel(undefined)

    return instance.applyWhereColumn(first, operator, second)
  }

  static async max(field: keyof DriversTable): Promise<number> {
    const instance = new DriverModel(undefined)

    return await instance.applyMax(field)
  }

  static async min(field: keyof DriversTable): Promise<number> {
    const instance = new DriverModel(undefined)

    return await instance.applyMin(field)
  }

  static async avg(field: keyof DriversTable): Promise<number> {
    const instance = new DriverModel(undefined)

    return await instance.applyAvg(field)
  }

  static async sum(field: keyof DriversTable): Promise<number> {
    const instance = new DriverModel(undefined)

    return await instance.applySum(field)
  }

  static async count(): Promise<number> {
    const instance = new DriverModel(undefined)

    return instance.applyCount()
  }

  static async get(): Promise<DriverModel[]> {
    const instance = new DriverModel(undefined)

    const results = await instance.applyGet()

    return results.map((item: DriverJsonResponse) => instance.createInstance(item))
  }

  static async pluck<K extends keyof DriverModel>(field: K): Promise<DriverModel[K][]> {
    const instance = new DriverModel(undefined)

    return await instance.applyPluck(field)
  }

  static async chunk(size: number, callback: (models: DriverModel[]) => Promise<void>): Promise<void> {
    const instance = new DriverModel(undefined)

    await instance.applyChunk(size, async (models) => {
      const modelInstances = models.map((item: DriverJsonResponse) => instance.createInstance(item))
      await callback(modelInstances)
    })
  }

  static async paginate(options: { limit?: number, offset?: number, page?: number } = { limit: 10, offset: 0, page: 1 }): Promise<{
    data: DriverModel[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }> {
    const instance = new DriverModel(undefined)

    const result = await instance.applyPaginate(options)

    return {
      data: result.data.map((item: DriverJsonResponse) => instance.createInstance(item)),
      paging: result.paging,
      next_cursor: result.next_cursor,
    }
  }

  // Instance method for creating model instances
  createInstance(data: DriverJsonResponse): DriverModel {
    return new DriverModel(data)
  }

  async applyCreate(newDriver: NewDriver): Promise<DriverModel> {
    const filteredValues = Object.fromEntries(
      Object.entries(newDriver).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewDriver

    await this.mapCustomSetters(filteredValues)

    filteredValues.uuid = randomUUIDv7()

    const result = await DB.instance.insertInto('drivers')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await DB.instance.selectFrom('drivers')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created Driver')
    }

    if (model)
      dispatch('driver:created', model)
    return this.createInstance(model)
  }

  async create(newDriver: NewDriver): Promise<DriverModel> {
    return await this.applyCreate(newDriver)
  }

  static async create(newDriver: NewDriver): Promise<DriverModel> {
    const instance = new DriverModel(undefined)
    return await instance.applyCreate(newDriver)
  }

  static async firstOrCreate(search: Partial<DriversTable>, values: NewDriver = {} as NewDriver): Promise<DriverModel> {
    // First try to find a record matching the search criteria
    const instance = new DriverModel(undefined)

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
    const createData = { ...search, ...values } as NewDriver
    return await DriverModel.create(createData)
  }

  static async updateOrCreate(search: Partial<DriversTable>, values: NewDriver = {} as NewDriver): Promise<DriverModel> {
    // First try to find a record matching the search criteria
    const instance = new DriverModel(undefined)

    // Apply all search conditions
    for (const [key, value] of Object.entries(search)) {
      instance.selectFromQuery = instance.selectFromQuery.where(key, '=', value)
    }

    // Try to find the record
    const existingRecord = await instance.applyFirst()

    if (existingRecord) {
      // If record exists, update it with the new values
      const model = instance.createInstance(existingRecord)
      const updatedModel = await model.update(values as DriverUpdate)

      // Return the updated model instance
      if (updatedModel) {
        return updatedModel
      }

      // If update didn't return a model, fetch it again to ensure we have latest data
      const refreshedModel = await instance.applyFirst()
      return instance.createInstance(refreshedModel!)
    }

    // If no record exists, create a new one with combined search criteria and values
    const createData = { ...search, ...values } as NewDriver
    return await DriverModel.create(createData)
  }

  async update(newDriver: DriverUpdate): Promise<DriverModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newDriver).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as DriverUpdate

    await this.mapCustomSetters(filteredValues)

    filteredValues.updated_at = new Date().toISOString()

    await DB.instance.updateTable('drivers')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('drivers')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated Driver')
      }

      if (model)
        dispatch('driver:updated', model)
      return this.createInstance(model)
    }

    return undefined
  }

  async forceUpdate(newDriver: DriverUpdate): Promise<DriverModel | undefined> {
    await DB.instance.updateTable('drivers')
      .set(newDriver)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('drivers')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated Driver')
      }

      if (this)
        dispatch('driver:updated', model)
      return this.createInstance(model)
    }

    return undefined
  }

  async save(): Promise<DriverModel> {
    // If the model has an ID, update it; otherwise, create a new record
    if (this.id) {
      // Update existing record
      await DB.instance.updateTable('drivers')
        .set(this.attributes as DriverUpdate)
        .where('id', '=', this.id)
        .executeTakeFirst()

      // Get the updated data
      const model = await DB.instance.selectFrom('drivers')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated Driver')
      }

      if (this)
        dispatch('driver:updated', model)
      return this.createInstance(model)
    }
    else {
      // Create new record
      const result = await DB.instance.insertInto('drivers')
        .values(this.attributes as NewDriver)
        .executeTakeFirst()

      // Get the created data
      const model = await DB.instance.selectFrom('drivers')
        .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve created Driver')
      }

      if (this)
        dispatch('driver:created', model)
      return this.createInstance(model)
    }
  }

  static async createMany(newDriver: NewDriver[]): Promise<void> {
    const instance = new DriverModel(undefined)

    const valuesFiltered = newDriver.map((newDriver: NewDriver) => {
      const filteredValues = Object.fromEntries(
        Object.entries(newDriver).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewDriver

      filteredValues.uuid = randomUUIDv7()

      return filteredValues
    })

    await DB.instance.insertInto('drivers')
      .values(valuesFiltered)
      .executeTakeFirst()
  }

  static async forceCreate(newDriver: NewDriver): Promise<DriverModel> {
    const result = await DB.instance.insertInto('drivers')
      .values(newDriver)
      .executeTakeFirst()

    const instance = new DriverModel(undefined)
    const model = await DB.instance.selectFrom('drivers')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created Driver')
    }

    if (model)
      dispatch('driver:created', model)

    return instance.createInstance(model)
  }

  // Method to remove a Driver
  async delete(): Promise<number> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()
    const model = await this.find(Number(this.id))

    if (model)
      dispatch('driver:deleted', model)

    const deleted = await DB.instance.deleteFrom('drivers')
      .where('id', '=', this.id)
      .execute()

    return deleted.numDeletedRows
  }

  static async remove(id: number): Promise<any> {
    const instance = new DriverModel(undefined)

    const model = await instance.find(Number(id))

    if (model)
      dispatch('driver:deleted', model)

    return await DB.instance.deleteFrom('drivers')
      .where('id', '=', id)
      .execute()
  }

  static whereName(value: string): DriverModel {
    const instance = new DriverModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('name', '=', value)

    return instance
  }

  static wherePhone(value: string): DriverModel {
    const instance = new DriverModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('phone', '=', value)

    return instance
  }

  static whereVehicleNumber(value: string): DriverModel {
    const instance = new DriverModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('vehicle_number', '=', value)

    return instance
  }

  static whereLicense(value: string): DriverModel {
    const instance = new DriverModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('license', '=', value)

    return instance
  }

  static whereStatus(value: string): DriverModel {
    const instance = new DriverModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('status', '=', value)

    return instance
  }

  static whereIn<V = number>(column: keyof DriversTable, values: V[]): DriverModel {
    const instance = new DriverModel(undefined)

    return instance.applyWhereIn<V>(column, values)
  }

  async userBelong(): Promise<UserModel> {
    if (this.user_id === undefined)
      throw new HttpError(500, 'Relation Error!')

    const model = await User
      .where('id', '=', this.user_id)
      .first()

    if (!model)
      throw new HttpError(500, 'Model Relation Not Found!')

    return model
  }

  toSearchableObject(): Partial<DriverJsonResponse> {
    return {
      id: this.id,
      name: this.name,
      phone: this.phone,
      vehicle_number: this.vehicle_number,
      license: this.license,
      status: this.status,
    }
  }

  static distinct(column: keyof DriverJsonResponse): DriverModel {
    const instance = new DriverModel(undefined)

    return instance.applyDistinct(column)
  }

  static join(table: string, firstCol: string, secondCol: string): DriverModel {
    const instance = new DriverModel(undefined)

    return instance.applyJoin(table, firstCol, secondCol)
  }

  toJSON(): DriverJsonResponse {
    const output = {

      uuid: this.uuid,

      id: this.id,
      name: this.name,
      phone: this.phone,
      vehicle_number: this.vehicle_number,
      license: this.license,
      status: this.status,

      created_at: this.created_at,

      updated_at: this.updated_at,

      delivery_routes: this.delivery_routes,
      user_id: this.user_id,
      user: this.user,
      ...this.customColumns,
    }

    return output
  }

  parseResult(model: DriverModel): DriverModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof DriverModel]
    }

    return model
  }

  // Add a protected applyFind implementation
  protected async applyFind(id: number): Promise<DriverModel | undefined> {
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

export async function find(id: number): Promise<DriverModel | undefined> {
  const query = DB.instance.selectFrom('drivers').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  const instance = new DriverModel(undefined)
  return instance.createInstance(model)
}

export async function count(): Promise<number> {
  const results = await DriverModel.count()

  return results
}

export async function create(newDriver: NewDriver): Promise<DriverModel> {
  const instance = new DriverModel(undefined)
  return await instance.applyCreate(newDriver)
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(DB.instance)
}

export async function remove(id: number): Promise<void> {
  await DB.instance.deleteFrom('drivers')
    .where('id', '=', id)
    .execute()
}

export async function whereName(value: string): Promise<DriverModel[]> {
  const query = DB.instance.selectFrom('drivers').where('name', '=', value)
  const results: DriverJsonResponse = await query.execute()

  return results.map((modelItem: DriverJsonResponse) => new DriverModel(modelItem))
}

export async function wherePhone(value: string): Promise<DriverModel[]> {
  const query = DB.instance.selectFrom('drivers').where('phone', '=', value)
  const results: DriverJsonResponse = await query.execute()

  return results.map((modelItem: DriverJsonResponse) => new DriverModel(modelItem))
}

export async function whereVehicleNumber(value: string): Promise<DriverModel[]> {
  const query = DB.instance.selectFrom('drivers').where('vehicle_number', '=', value)
  const results: DriverJsonResponse = await query.execute()

  return results.map((modelItem: DriverJsonResponse) => new DriverModel(modelItem))
}

export async function whereLicense(value: string): Promise<DriverModel[]> {
  const query = DB.instance.selectFrom('drivers').where('license', '=', value)
  const results: DriverJsonResponse = await query.execute()

  return results.map((modelItem: DriverJsonResponse) => new DriverModel(modelItem))
}

export async function whereStatus(value: string | string[]): Promise<DriverModel[]> {
  const query = DB.instance.selectFrom('drivers').where('status', '=', value)
  const results: DriverJsonResponse = await query.execute()

  return results.map((modelItem: DriverJsonResponse) => new DriverModel(modelItem))
}

export const Driver = DriverModel

export default Driver
