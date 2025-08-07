import type { RawBuilder } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import type { NewShippingMethod, ShippingMethodJsonResponse, ShippingMethodsTable, ShippingMethodUpdate } from '../types/ShippingMethodType'
import type { ShippingRateModel } from './ShippingRate'
import type { ShippingZoneModel } from './ShippingZone'
import { randomUUIDv7 } from 'bun'
import { sql } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'
import { dispatch } from '@stacksjs/events'
import { DB } from '@stacksjs/orm'

import { BaseOrm } from '../utils/base'

export class ShippingMethodModel extends BaseOrm<ShippingMethodModel, ShippingMethodsTable, ShippingMethodJsonResponse> {
  private readonly hidden: Array<keyof ShippingMethodJsonResponse> = []
  private readonly fillable: Array<keyof ShippingMethodJsonResponse> = ['name', 'description', 'base_rate', 'free_shipping', 'status', 'uuid']
  private readonly guarded: Array<keyof ShippingMethodJsonResponse> = []
  protected attributes = {} as ShippingMethodJsonResponse
  protected originalAttributes = {} as ShippingMethodJsonResponse

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

  constructor(shippingMethod: ShippingMethodJsonResponse | undefined) {
    super('shipping_methods')
    if (shippingMethod) {
      this.attributes = { ...shippingMethod }
      this.originalAttributes = { ...shippingMethod }

      Object.keys(shippingMethod).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (shippingMethod as ShippingMethodJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = DB.instance.selectFrom('shipping_methods')
    this.updateFromQuery = DB.instance.updateTable('shipping_methods')
    this.deleteFromQuery = DB.instance.deleteFrom('shipping_methods')
    this.hasSelect = false
  }

  protected async loadRelations(models: ShippingMethodJsonResponse | ShippingMethodJsonResponse[]): Promise<void> {
    // Handle both single model and array of models
    const modelArray = Array.isArray(models) ? models : [models]
    if (!modelArray.length)
      return

    const modelIds = modelArray.map(model => model.id)

    for (const relation of this.withRelations) {
      const relatedRecords = await DB.instance
        .selectFrom(relation)
        .where('shippingMethod_id', 'in', modelIds)
        .selectAll()
        .execute()

      if (Array.isArray(models)) {
        models.map((model: ShippingMethodJsonResponse) => {
          const records = relatedRecords.filter((record: { shippingMethod_id: number }) => {
            return record.shippingMethod_id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      }
      else {
        const records = relatedRecords.filter((record: { shippingMethod_id: number }) => {
          return record.shippingMethod_id === models.id
        })

        models[relation] = records.length === 1 ? records[0] : records
      }
    }
  }

  static with(relations: string[]): ShippingMethodModel {
    const instance = new ShippingMethodModel(undefined)

    return instance.applyWith(relations)
  }

  protected mapCustomGetters(models: ShippingMethodJsonResponse | ShippingMethodJsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: ShippingMethodJsonResponse) => {
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

  async mapCustomSetters(model: NewShippingMethod | ShippingMethodUpdate): Promise<void> {
    const customSetter = {
      default: () => {
      },

    }

    for (const [key, fn] of Object.entries(customSetter)) {
      (model as any)[key] = await fn()
    }
  }

  get shipping_zones(): ShippingZoneModel[] | [] {
    return this.attributes.shipping_zones
  }

  get shipping_rates(): ShippingRateModel[] | [] {
    return this.attributes.shipping_rates
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

  get description(): string | undefined {
    return this.attributes.description
  }

  get base_rate(): number {
    return this.attributes.base_rate
  }

  get free_shipping(): number | undefined {
    return this.attributes.free_shipping
  }

  get status(): string | string[] {
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

  set description(value: string) {
    this.attributes.description = value
  }

  set base_rate(value: number) {
    this.attributes.base_rate = value
  }

  set free_shipping(value: number) {
    this.attributes.free_shipping = value
  }

  set status(value: string | string[]) {
    this.attributes.status = value
  }

  set updated_at(value: string) {
    this.attributes.updated_at = value
  }

  static select(params: (keyof ShippingMethodJsonResponse)[] | RawBuilder<string> | string): ShippingMethodModel {
    const instance = new ShippingMethodModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a ShippingMethod by ID
  static async find(id: number): Promise<ShippingMethodModel | undefined> {
    const query = DB.instance.selectFrom('shipping_methods').where('id', '=', id).selectAll()

    const model = await query.executeTakeFirst()

    if (!model)
      return undefined

    const instance = new ShippingMethodModel(undefined)
    return instance.createInstance(model)
  }

  static async first(): Promise<ShippingMethodModel | undefined> {
    const instance = new ShippingMethodModel(undefined)

    const model = await instance.applyFirst()

    const data = new ShippingMethodModel(model)

    return data
  }

  static async last(): Promise<ShippingMethodModel | undefined> {
    const instance = new ShippingMethodModel(undefined)

    const model = await instance.applyLast()

    if (!model)
      return undefined

    return new ShippingMethodModel(model)
  }

  static async firstOrFail(): Promise<ShippingMethodModel | undefined> {
    const instance = new ShippingMethodModel(undefined)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<ShippingMethodModel[]> {
    const instance = new ShippingMethodModel(undefined)

    const models = await DB.instance.selectFrom('shipping_methods').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: ShippingMethodJsonResponse) => {
      return new ShippingMethodModel(model)
    }))

    return data
  }

  static async findOrFail(id: number): Promise<ShippingMethodModel | undefined> {
    const instance = new ShippingMethodModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<ShippingMethodModel[]> {
    const instance = new ShippingMethodModel(undefined)

    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: ShippingMethodJsonResponse) => instance.parseResult(new ShippingMethodModel(modelItem)))
  }

  static async latest(column: keyof ShippingMethodsTable = 'created_at'): Promise<ShippingMethodModel | undefined> {
    const instance = new ShippingMethodModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'desc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new ShippingMethodModel(model)
  }

  static async oldest(column: keyof ShippingMethodsTable = 'created_at'): Promise<ShippingMethodModel | undefined> {
    const instance = new ShippingMethodModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'asc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new ShippingMethodModel(model)
  }

  static skip(count: number): ShippingMethodModel {
    const instance = new ShippingMethodModel(undefined)

    return instance.applySkip(count)
  }

  static take(count: number): ShippingMethodModel {
    const instance = new ShippingMethodModel(undefined)

    return instance.applyTake(count)
  }

  static where<V = string>(column: keyof ShippingMethodsTable, ...args: [V] | [Operator, V]): ShippingMethodModel {
    const instance = new ShippingMethodModel(undefined)

    return instance.applyWhere<V>(column, ...args)
  }

  static orWhere(...conditions: [string, any][]): ShippingMethodModel {
    const instance = new ShippingMethodModel(undefined)

    return instance.applyOrWhere(...conditions)
  }

  static whereNotIn<V = number>(column: keyof ShippingMethodsTable, values: V[]): ShippingMethodModel {
    const instance = new ShippingMethodModel(undefined)

    return instance.applyWhereNotIn<V>(column, values)
  }

  static whereBetween<V = number>(column: keyof ShippingMethodsTable, range: [V, V]): ShippingMethodModel {
    const instance = new ShippingMethodModel(undefined)

    return instance.applyWhereBetween<V>(column, range)
  }

  static whereRef(column: keyof ShippingMethodsTable, ...args: string[]): ShippingMethodModel {
    const instance = new ShippingMethodModel(undefined)

    return instance.applyWhereRef(column, ...args)
  }

  static when(condition: boolean, callback: (query: ShippingMethodModel) => ShippingMethodModel): ShippingMethodModel {
    const instance = new ShippingMethodModel(undefined)

    return instance.applyWhen(condition, callback as any)
  }

  static whereNull(column: keyof ShippingMethodsTable): ShippingMethodModel {
    const instance = new ShippingMethodModel(undefined)

    return instance.applyWhereNull(column)
  }

  static whereNotNull(column: keyof ShippingMethodsTable): ShippingMethodModel {
    const instance = new ShippingMethodModel(undefined)

    return instance.applyWhereNotNull(column)
  }

  static whereLike(column: keyof ShippingMethodsTable, value: string): ShippingMethodModel {
    const instance = new ShippingMethodModel(undefined)

    return instance.applyWhereLike(column, value)
  }

  static orderBy(column: keyof ShippingMethodsTable, order: 'asc' | 'desc'): ShippingMethodModel {
    const instance = new ShippingMethodModel(undefined)

    return instance.applyOrderBy(column, order)
  }

  static orderByAsc(column: keyof ShippingMethodsTable): ShippingMethodModel {
    const instance = new ShippingMethodModel(undefined)

    return instance.applyOrderByAsc(column)
  }

  static orderByDesc(column: keyof ShippingMethodsTable): ShippingMethodModel {
    const instance = new ShippingMethodModel(undefined)

    return instance.applyOrderByDesc(column)
  }

  static groupBy(column: keyof ShippingMethodsTable): ShippingMethodModel {
    const instance = new ShippingMethodModel(undefined)

    return instance.applyGroupBy(column)
  }

  static having<V = string>(column: keyof ShippingMethodsTable, operator: Operator, value: V): ShippingMethodModel {
    const instance = new ShippingMethodModel(undefined)

    return instance.applyHaving<V>(column, operator, value)
  }

  static inRandomOrder(): ShippingMethodModel {
    const instance = new ShippingMethodModel(undefined)

    return instance.applyInRandomOrder()
  }

  static whereColumn(first: keyof ShippingMethodsTable, operator: Operator, second: keyof ShippingMethodsTable): ShippingMethodModel {
    const instance = new ShippingMethodModel(undefined)

    return instance.applyWhereColumn(first, operator, second)
  }

  static async max(field: keyof ShippingMethodsTable): Promise<number> {
    const instance = new ShippingMethodModel(undefined)

    return await instance.applyMax(field)
  }

  static async min(field: keyof ShippingMethodsTable): Promise<number> {
    const instance = new ShippingMethodModel(undefined)

    return await instance.applyMin(field)
  }

  static async avg(field: keyof ShippingMethodsTable): Promise<number> {
    const instance = new ShippingMethodModel(undefined)

    return await instance.applyAvg(field)
  }

  static async sum(field: keyof ShippingMethodsTable): Promise<number> {
    const instance = new ShippingMethodModel(undefined)

    return await instance.applySum(field)
  }

  static async count(): Promise<number> {
    const instance = new ShippingMethodModel(undefined)

    return instance.applyCount()
  }

  static async get(): Promise<ShippingMethodModel[]> {
    const instance = new ShippingMethodModel(undefined)

    const results = await instance.applyGet()

    return results.map((item: ShippingMethodJsonResponse) => instance.createInstance(item))
  }

  static async pluck<K extends keyof ShippingMethodModel>(field: K): Promise<ShippingMethodModel[K][]> {
    const instance = new ShippingMethodModel(undefined)

    return await instance.applyPluck(field)
  }

  static async chunk(size: number, callback: (models: ShippingMethodModel[]) => Promise<void>): Promise<void> {
    const instance = new ShippingMethodModel(undefined)

    await instance.applyChunk(size, async (models) => {
      const modelInstances = models.map((item: ShippingMethodJsonResponse) => instance.createInstance(item))
      await callback(modelInstances)
    })
  }

  static async paginate(options: { limit?: number, offset?: number, page?: number } = { limit: 10, offset: 0, page: 1 }): Promise<{
    data: ShippingMethodModel[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }> {
    const instance = new ShippingMethodModel(undefined)

    const result = await instance.applyPaginate(options)

    return {
      data: result.data.map((item: ShippingMethodJsonResponse) => instance.createInstance(item)),
      paging: result.paging,
      next_cursor: result.next_cursor,
    }
  }

  // Instance method for creating model instances
  createInstance(data: ShippingMethodJsonResponse): ShippingMethodModel {
    return new ShippingMethodModel(data)
  }

  async applyCreate(newShippingMethod: NewShippingMethod): Promise<ShippingMethodModel> {
    const filteredValues = Object.fromEntries(
      Object.entries(newShippingMethod).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewShippingMethod

    await this.mapCustomSetters(filteredValues)

    filteredValues.uuid = randomUUIDv7()

    const result = await DB.instance.insertInto('shipping_methods')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await DB.instance.selectFrom('shipping_methods')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created ShippingMethod')
    }

    if (model)
      dispatch('shippingMethod:created', model)
    return this.createInstance(model)
  }

  async create(newShippingMethod: NewShippingMethod): Promise<ShippingMethodModel> {
    return await this.applyCreate(newShippingMethod)
  }

  static async create(newShippingMethod: NewShippingMethod): Promise<ShippingMethodModel> {
    const instance = new ShippingMethodModel(undefined)
    return await instance.applyCreate(newShippingMethod)
  }

  static async firstOrCreate(search: Partial<ShippingMethodsTable>, values: NewShippingMethod = {} as NewShippingMethod): Promise<ShippingMethodModel> {
    // First try to find a record matching the search criteria
    const instance = new ShippingMethodModel(undefined)

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
    const createData = { ...search, ...values } as NewShippingMethod
    return await ShippingMethodModel.create(createData)
  }

  static async updateOrCreate(search: Partial<ShippingMethodsTable>, values: NewShippingMethod = {} as NewShippingMethod): Promise<ShippingMethodModel> {
    // First try to find a record matching the search criteria
    const instance = new ShippingMethodModel(undefined)

    // Apply all search conditions
    for (const [key, value] of Object.entries(search)) {
      instance.selectFromQuery = instance.selectFromQuery.where(key, '=', value)
    }

    // Try to find the record
    const existingRecord = await instance.applyFirst()

    if (existingRecord) {
      // If record exists, update it with the new values
      const model = instance.createInstance(existingRecord)
      const updatedModel = await model.update(values as ShippingMethodUpdate)

      // Return the updated model instance
      if (updatedModel) {
        return updatedModel
      }

      // If update didn't return a model, fetch it again to ensure we have latest data
      const refreshedModel = await instance.applyFirst()
      return instance.createInstance(refreshedModel!)
    }

    // If no record exists, create a new one with combined search criteria and values
    const createData = { ...search, ...values } as NewShippingMethod
    return await ShippingMethodModel.create(createData)
  }

  async update(newShippingMethod: ShippingMethodUpdate): Promise<ShippingMethodModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newShippingMethod).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as ShippingMethodUpdate

    await this.mapCustomSetters(filteredValues)

    filteredValues.updated_at = new Date().toISOString()

    await DB.instance.updateTable('shipping_methods')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('shipping_methods')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated ShippingMethod')
      }

      if (model)
        dispatch('shippingMethod:updated', model)
      return this.createInstance(model)
    }

    return undefined
  }

  async forceUpdate(newShippingMethod: ShippingMethodUpdate): Promise<ShippingMethodModel | undefined> {
    await DB.instance.updateTable('shipping_methods')
      .set(newShippingMethod)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('shipping_methods')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated ShippingMethod')
      }

      if (this)
        dispatch('shippingMethod:updated', model)
      return this.createInstance(model)
    }

    return undefined
  }

  async save(): Promise<ShippingMethodModel> {
    // If the model has an ID, update it; otherwise, create a new record
    if (this.id) {
      // Update existing record
      await DB.instance.updateTable('shipping_methods')
        .set(this.attributes as ShippingMethodUpdate)
        .where('id', '=', this.id)
        .executeTakeFirst()

      // Get the updated data
      const model = await DB.instance.selectFrom('shipping_methods')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated ShippingMethod')
      }

      if (this)
        dispatch('shippingMethod:updated', model)
      return this.createInstance(model)
    }
    else {
      // Create new record
      const result = await DB.instance.insertInto('shipping_methods')
        .values(this.attributes as NewShippingMethod)
        .executeTakeFirst()

      // Get the created data
      const model = await DB.instance.selectFrom('shipping_methods')
        .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve created ShippingMethod')
      }

      if (this)
        dispatch('shippingMethod:created', model)
      return this.createInstance(model)
    }
  }

  static async createMany(newShippingMethod: NewShippingMethod[]): Promise<void> {
    const instance = new ShippingMethodModel(undefined)

    const valuesFiltered = newShippingMethod.map((newShippingMethod: NewShippingMethod) => {
      const filteredValues = Object.fromEntries(
        Object.entries(newShippingMethod).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewShippingMethod

      filteredValues.uuid = randomUUIDv7()

      return filteredValues
    })

    await DB.instance.insertInto('shipping_methods')
      .values(valuesFiltered)
      .executeTakeFirst()
  }

  static async forceCreate(newShippingMethod: NewShippingMethod): Promise<ShippingMethodModel> {
    const result = await DB.instance.insertInto('shipping_methods')
      .values(newShippingMethod)
      .executeTakeFirst()

    const instance = new ShippingMethodModel(undefined)
    const model = await DB.instance.selectFrom('shipping_methods')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created ShippingMethod')
    }

    if (model)
      dispatch('shippingMethod:created', model)

    return instance.createInstance(model)
  }

  // Method to remove a ShippingMethod
  async delete(): Promise<number> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()
    const model = await this.find(Number(this.id))

    if (model)
      dispatch('shippingMethod:deleted', model)

    const deleted = await DB.instance.deleteFrom('shipping_methods')
      .where('id', '=', this.id)
      .execute()

    return deleted.numDeletedRows
  }

  static async remove(id: number): Promise<any> {
    const instance = new ShippingMethodModel(undefined)

    const model = await instance.find(Number(id))

    if (model)
      dispatch('shippingMethod:deleted', model)

    return await DB.instance.deleteFrom('shipping_methods')
      .where('id', '=', id)
      .execute()
  }

  static whereName(value: string): ShippingMethodModel {
    const instance = new ShippingMethodModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('name', '=', value)

    return instance
  }

  static whereDescription(value: string): ShippingMethodModel {
    const instance = new ShippingMethodModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('description', '=', value)

    return instance
  }

  static whereBaseRate(value: string): ShippingMethodModel {
    const instance = new ShippingMethodModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('base_rate', '=', value)

    return instance
  }

  static whereFreeShipping(value: string): ShippingMethodModel {
    const instance = new ShippingMethodModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('free_shipping', '=', value)

    return instance
  }

  static whereStatus(value: string): ShippingMethodModel {
    const instance = new ShippingMethodModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('status', '=', value)

    return instance
  }

  static whereIn<V = number>(column: keyof ShippingMethodsTable, values: V[]): ShippingMethodModel {
    const instance = new ShippingMethodModel(undefined)

    return instance.applyWhereIn<V>(column, values)
  }

  toSearchableObject(): Partial<ShippingMethodJsonResponse> {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      base_rate: this.base_rate,
      free_shipping: this.free_shipping,
      status: this.status,
    }
  }

  static distinct(column: keyof ShippingMethodJsonResponse): ShippingMethodModel {
    const instance = new ShippingMethodModel(undefined)

    return instance.applyDistinct(column)
  }

  static join(table: string, firstCol: string, secondCol: string): ShippingMethodModel {
    const instance = new ShippingMethodModel(undefined)

    return instance.applyJoin(table, firstCol, secondCol)
  }

  toJSON(): ShippingMethodJsonResponse {
    const output = {

      uuid: this.uuid,

      id: this.id,
      name: this.name,
      description: this.description,
      base_rate: this.base_rate,
      free_shipping: this.free_shipping,
      status: this.status,

      created_at: this.created_at,

      updated_at: this.updated_at,

      shipping_zones: this.shipping_zones,
      shipping_rates: this.shipping_rates,
      ...this.customColumns,
    }

    return output
  }

  parseResult(model: ShippingMethodModel): ShippingMethodModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof ShippingMethodModel]
    }

    return model
  }

  // Add a protected applyFind implementation
  protected async applyFind(id: number): Promise<ShippingMethodModel | undefined> {
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

export async function find(id: number): Promise<ShippingMethodModel | undefined> {
  const query = DB.instance.selectFrom('shipping_methods').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  const instance = new ShippingMethodModel(undefined)
  return instance.createInstance(model)
}

export async function count(): Promise<number> {
  const results = await ShippingMethodModel.count()

  return results
}

export async function create(newShippingMethod: NewShippingMethod): Promise<ShippingMethodModel> {
  const instance = new ShippingMethodModel(undefined)
  return await instance.applyCreate(newShippingMethod)
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(DB.instance)
}

export async function remove(id: number): Promise<void> {
  await DB.instance.deleteFrom('shipping_methods')
    .where('id', '=', id)
    .execute()
}

export async function whereName(value: string): Promise<ShippingMethodModel[]> {
  const query = DB.instance.selectFrom('shipping_methods').where('name', '=', value)
  const results: ShippingMethodJsonResponse = await query.execute()

  return results.map((modelItem: ShippingMethodJsonResponse) => new ShippingMethodModel(modelItem))
}

export async function whereDescription(value: string): Promise<ShippingMethodModel[]> {
  const query = DB.instance.selectFrom('shipping_methods').where('description', '=', value)
  const results: ShippingMethodJsonResponse = await query.execute()

  return results.map((modelItem: ShippingMethodJsonResponse) => new ShippingMethodModel(modelItem))
}

export async function whereBaseRate(value: number): Promise<ShippingMethodModel[]> {
  const query = DB.instance.selectFrom('shipping_methods').where('base_rate', '=', value)
  const results: ShippingMethodJsonResponse = await query.execute()

  return results.map((modelItem: ShippingMethodJsonResponse) => new ShippingMethodModel(modelItem))
}

export async function whereFreeShipping(value: number): Promise<ShippingMethodModel[]> {
  const query = DB.instance.selectFrom('shipping_methods').where('free_shipping', '=', value)
  const results: ShippingMethodJsonResponse = await query.execute()

  return results.map((modelItem: ShippingMethodJsonResponse) => new ShippingMethodModel(modelItem))
}

export async function whereStatus(value: string | string[]): Promise<ShippingMethodModel[]> {
  const query = DB.instance.selectFrom('shipping_methods').where('status', '=', value)
  const results: ShippingMethodJsonResponse = await query.execute()

  return results.map((modelItem: ShippingMethodJsonResponse) => new ShippingMethodModel(modelItem))
}

export const ShippingMethod = ShippingMethodModel

export default ShippingMethod
