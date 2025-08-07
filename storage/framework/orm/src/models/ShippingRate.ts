import type { RawBuilder } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import type { NewShippingRate, ShippingRateJsonResponse, ShippingRatesTable, ShippingRateUpdate } from '../types/ShippingRateType'
import type { ShippingMethodModel } from './ShippingMethod'
import type { ShippingZoneModel } from './ShippingZone'
import { randomUUIDv7 } from 'bun'
import { sql } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'
import { dispatch } from '@stacksjs/events'
import { DB } from '@stacksjs/orm'

import { BaseOrm } from '../utils/base'

export class ShippingRateModel extends BaseOrm<ShippingRateModel, ShippingRatesTable, ShippingRateJsonResponse> {
  private readonly hidden: Array<keyof ShippingRateJsonResponse> = []
  private readonly fillable: Array<keyof ShippingRateJsonResponse> = ['weight_from', 'weight_to', 'rate', 'uuid', 'shipping_zone_id', 'shipping_method_id']
  private readonly guarded: Array<keyof ShippingRateJsonResponse> = []
  protected attributes = {} as ShippingRateJsonResponse
  protected originalAttributes = {} as ShippingRateJsonResponse

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

  constructor(shippingRate: ShippingRateJsonResponse | undefined) {
    super('shipping_rates')
    if (shippingRate) {
      this.attributes = { ...shippingRate }
      this.originalAttributes = { ...shippingRate }

      Object.keys(shippingRate).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (shippingRate as ShippingRateJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = DB.instance.selectFrom('shipping_rates')
    this.updateFromQuery = DB.instance.updateTable('shipping_rates')
    this.deleteFromQuery = DB.instance.deleteFrom('shipping_rates')
    this.hasSelect = false
  }

  protected async loadRelations(models: ShippingRateJsonResponse | ShippingRateJsonResponse[]): Promise<void> {
    // Handle both single model and array of models
    const modelArray = Array.isArray(models) ? models : [models]
    if (!modelArray.length)
      return

    const modelIds = modelArray.map(model => model.id)

    for (const relation of this.withRelations) {
      const relatedRecords = await DB.instance
        .selectFrom(relation)
        .where('shippingRate_id', 'in', modelIds)
        .selectAll()
        .execute()

      if (Array.isArray(models)) {
        models.map((model: ShippingRateJsonResponse) => {
          const records = relatedRecords.filter((record: { shippingRate_id: number }) => {
            return record.shippingRate_id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      }
      else {
        const records = relatedRecords.filter((record: { shippingRate_id: number }) => {
          return record.shippingRate_id === models.id
        })

        models[relation] = records.length === 1 ? records[0] : records
      }
    }
  }

  static with(relations: string[]): ShippingRateModel {
    const instance = new ShippingRateModel(undefined)

    return instance.applyWith(relations)
  }

  protected mapCustomGetters(models: ShippingRateJsonResponse | ShippingRateJsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: ShippingRateJsonResponse) => {
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

  async mapCustomSetters(model: NewShippingRate | ShippingRateUpdate): Promise<void> {
    const customSetter = {
      default: () => {
      },

    }

    for (const [key, fn] of Object.entries(customSetter)) {
      (model as any)[key] = await fn()
    }
  }

  get shipping_method_id(): number {
    return this.attributes.shipping_method_id
  }

  get shipping_method(): ShippingMethodModel | undefined {
    return this.attributes.shipping_method
  }

  get shipping_zone_id(): number {
    return this.attributes.shipping_zone_id
  }

  get shipping_zone(): ShippingZoneModel | undefined {
    return this.attributes.shipping_zone
  }

  get id(): number {
    return this.attributes.id
  }

  get uuid(): string | undefined {
    return this.attributes.uuid
  }

  get weight_from(): number {
    return this.attributes.weight_from
  }

  get weight_to(): number {
    return this.attributes.weight_to
  }

  get rate(): number {
    return this.attributes.rate
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

  set weight_from(value: number) {
    this.attributes.weight_from = value
  }

  set weight_to(value: number) {
    this.attributes.weight_to = value
  }

  set rate(value: number) {
    this.attributes.rate = value
  }

  set updated_at(value: string) {
    this.attributes.updated_at = value
  }

  static select(params: (keyof ShippingRateJsonResponse)[] | RawBuilder<string> | string): ShippingRateModel {
    const instance = new ShippingRateModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a ShippingRate by ID
  static async find(id: number): Promise<ShippingRateModel | undefined> {
    const query = DB.instance.selectFrom('shipping_rates').where('id', '=', id).selectAll()

    const model = await query.executeTakeFirst()

    if (!model)
      return undefined

    const instance = new ShippingRateModel(undefined)
    return instance.createInstance(model)
  }

  static async first(): Promise<ShippingRateModel | undefined> {
    const instance = new ShippingRateModel(undefined)

    const model = await instance.applyFirst()

    const data = new ShippingRateModel(model)

    return data
  }

  static async last(): Promise<ShippingRateModel | undefined> {
    const instance = new ShippingRateModel(undefined)

    const model = await instance.applyLast()

    if (!model)
      return undefined

    return new ShippingRateModel(model)
  }

  static async firstOrFail(): Promise<ShippingRateModel | undefined> {
    const instance = new ShippingRateModel(undefined)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<ShippingRateModel[]> {
    const instance = new ShippingRateModel(undefined)

    const models = await DB.instance.selectFrom('shipping_rates').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: ShippingRateJsonResponse) => {
      return new ShippingRateModel(model)
    }))

    return data
  }

  static async findOrFail(id: number): Promise<ShippingRateModel | undefined> {
    const instance = new ShippingRateModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<ShippingRateModel[]> {
    const instance = new ShippingRateModel(undefined)

    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: ShippingRateJsonResponse) => instance.parseResult(new ShippingRateModel(modelItem)))
  }

  static async latest(column: keyof ShippingRatesTable = 'created_at'): Promise<ShippingRateModel | undefined> {
    const instance = new ShippingRateModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'desc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new ShippingRateModel(model)
  }

  static async oldest(column: keyof ShippingRatesTable = 'created_at'): Promise<ShippingRateModel | undefined> {
    const instance = new ShippingRateModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'asc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new ShippingRateModel(model)
  }

  static skip(count: number): ShippingRateModel {
    const instance = new ShippingRateModel(undefined)

    return instance.applySkip(count)
  }

  static take(count: number): ShippingRateModel {
    const instance = new ShippingRateModel(undefined)

    return instance.applyTake(count)
  }

  static where<V = string>(column: keyof ShippingRatesTable, ...args: [V] | [Operator, V]): ShippingRateModel {
    const instance = new ShippingRateModel(undefined)

    return instance.applyWhere<V>(column, ...args)
  }

  static orWhere(...conditions: [string, any][]): ShippingRateModel {
    const instance = new ShippingRateModel(undefined)

    return instance.applyOrWhere(...conditions)
  }

  static whereNotIn<V = number>(column: keyof ShippingRatesTable, values: V[]): ShippingRateModel {
    const instance = new ShippingRateModel(undefined)

    return instance.applyWhereNotIn<V>(column, values)
  }

  static whereBetween<V = number>(column: keyof ShippingRatesTable, range: [V, V]): ShippingRateModel {
    const instance = new ShippingRateModel(undefined)

    return instance.applyWhereBetween<V>(column, range)
  }

  static whereRef(column: keyof ShippingRatesTable, ...args: string[]): ShippingRateModel {
    const instance = new ShippingRateModel(undefined)

    return instance.applyWhereRef(column, ...args)
  }

  static when(condition: boolean, callback: (query: ShippingRateModel) => ShippingRateModel): ShippingRateModel {
    const instance = new ShippingRateModel(undefined)

    return instance.applyWhen(condition, callback as any)
  }

  static whereNull(column: keyof ShippingRatesTable): ShippingRateModel {
    const instance = new ShippingRateModel(undefined)

    return instance.applyWhereNull(column)
  }

  static whereNotNull(column: keyof ShippingRatesTable): ShippingRateModel {
    const instance = new ShippingRateModel(undefined)

    return instance.applyWhereNotNull(column)
  }

  static whereLike(column: keyof ShippingRatesTable, value: string): ShippingRateModel {
    const instance = new ShippingRateModel(undefined)

    return instance.applyWhereLike(column, value)
  }

  static orderBy(column: keyof ShippingRatesTable, order: 'asc' | 'desc'): ShippingRateModel {
    const instance = new ShippingRateModel(undefined)

    return instance.applyOrderBy(column, order)
  }

  static orderByAsc(column: keyof ShippingRatesTable): ShippingRateModel {
    const instance = new ShippingRateModel(undefined)

    return instance.applyOrderByAsc(column)
  }

  static orderByDesc(column: keyof ShippingRatesTable): ShippingRateModel {
    const instance = new ShippingRateModel(undefined)

    return instance.applyOrderByDesc(column)
  }

  static groupBy(column: keyof ShippingRatesTable): ShippingRateModel {
    const instance = new ShippingRateModel(undefined)

    return instance.applyGroupBy(column)
  }

  static having<V = string>(column: keyof ShippingRatesTable, operator: Operator, value: V): ShippingRateModel {
    const instance = new ShippingRateModel(undefined)

    return instance.applyHaving<V>(column, operator, value)
  }

  static inRandomOrder(): ShippingRateModel {
    const instance = new ShippingRateModel(undefined)

    return instance.applyInRandomOrder()
  }

  static whereColumn(first: keyof ShippingRatesTable, operator: Operator, second: keyof ShippingRatesTable): ShippingRateModel {
    const instance = new ShippingRateModel(undefined)

    return instance.applyWhereColumn(first, operator, second)
  }

  static async max(field: keyof ShippingRatesTable): Promise<number> {
    const instance = new ShippingRateModel(undefined)

    return await instance.applyMax(field)
  }

  static async min(field: keyof ShippingRatesTable): Promise<number> {
    const instance = new ShippingRateModel(undefined)

    return await instance.applyMin(field)
  }

  static async avg(field: keyof ShippingRatesTable): Promise<number> {
    const instance = new ShippingRateModel(undefined)

    return await instance.applyAvg(field)
  }

  static async sum(field: keyof ShippingRatesTable): Promise<number> {
    const instance = new ShippingRateModel(undefined)

    return await instance.applySum(field)
  }

  static async count(): Promise<number> {
    const instance = new ShippingRateModel(undefined)

    return instance.applyCount()
  }

  static async get(): Promise<ShippingRateModel[]> {
    const instance = new ShippingRateModel(undefined)

    const results = await instance.applyGet()

    return results.map((item: ShippingRateJsonResponse) => instance.createInstance(item))
  }

  static async pluck<K extends keyof ShippingRateModel>(field: K): Promise<ShippingRateModel[K][]> {
    const instance = new ShippingRateModel(undefined)

    return await instance.applyPluck(field)
  }

  static async chunk(size: number, callback: (models: ShippingRateModel[]) => Promise<void>): Promise<void> {
    const instance = new ShippingRateModel(undefined)

    await instance.applyChunk(size, async (models) => {
      const modelInstances = models.map((item: ShippingRateJsonResponse) => instance.createInstance(item))
      await callback(modelInstances)
    })
  }

  static async paginate(options: { limit?: number, offset?: number, page?: number } = { limit: 10, offset: 0, page: 1 }): Promise<{
    data: ShippingRateModel[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }> {
    const instance = new ShippingRateModel(undefined)

    const result = await instance.applyPaginate(options)

    return {
      data: result.data.map((item: ShippingRateJsonResponse) => instance.createInstance(item)),
      paging: result.paging,
      next_cursor: result.next_cursor,
    }
  }

  // Instance method for creating model instances
  createInstance(data: ShippingRateJsonResponse): ShippingRateModel {
    return new ShippingRateModel(data)
  }

  async applyCreate(newShippingRate: NewShippingRate): Promise<ShippingRateModel> {
    const filteredValues = Object.fromEntries(
      Object.entries(newShippingRate).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewShippingRate

    await this.mapCustomSetters(filteredValues)

    filteredValues.uuid = randomUUIDv7()

    const result = await DB.instance.insertInto('shipping_rates')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await DB.instance.selectFrom('shipping_rates')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created ShippingRate')
    }

    if (model)
      dispatch('shippingRate:created', model)
    return this.createInstance(model)
  }

  async create(newShippingRate: NewShippingRate): Promise<ShippingRateModel> {
    return await this.applyCreate(newShippingRate)
  }

  static async create(newShippingRate: NewShippingRate): Promise<ShippingRateModel> {
    const instance = new ShippingRateModel(undefined)
    return await instance.applyCreate(newShippingRate)
  }

  static async firstOrCreate(search: Partial<ShippingRatesTable>, values: NewShippingRate = {} as NewShippingRate): Promise<ShippingRateModel> {
    // First try to find a record matching the search criteria
    const instance = new ShippingRateModel(undefined)

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
    const createData = { ...search, ...values } as NewShippingRate
    return await ShippingRateModel.create(createData)
  }

  static async updateOrCreate(search: Partial<ShippingRatesTable>, values: NewShippingRate = {} as NewShippingRate): Promise<ShippingRateModel> {
    // First try to find a record matching the search criteria
    const instance = new ShippingRateModel(undefined)

    // Apply all search conditions
    for (const [key, value] of Object.entries(search)) {
      instance.selectFromQuery = instance.selectFromQuery.where(key, '=', value)
    }

    // Try to find the record
    const existingRecord = await instance.applyFirst()

    if (existingRecord) {
      // If record exists, update it with the new values
      const model = instance.createInstance(existingRecord)
      const updatedModel = await model.update(values as ShippingRateUpdate)

      // Return the updated model instance
      if (updatedModel) {
        return updatedModel
      }

      // If update didn't return a model, fetch it again to ensure we have latest data
      const refreshedModel = await instance.applyFirst()
      return instance.createInstance(refreshedModel!)
    }

    // If no record exists, create a new one with combined search criteria and values
    const createData = { ...search, ...values } as NewShippingRate
    return await ShippingRateModel.create(createData)
  }

  async update(newShippingRate: ShippingRateUpdate): Promise<ShippingRateModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newShippingRate).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as ShippingRateUpdate

    await this.mapCustomSetters(filteredValues)

    filteredValues.updated_at = new Date().toISOString()

    await DB.instance.updateTable('shipping_rates')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('shipping_rates')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated ShippingRate')
      }

      if (model)
        dispatch('shippingRate:updated', model)
      return this.createInstance(model)
    }

    return undefined
  }

  async forceUpdate(newShippingRate: ShippingRateUpdate): Promise<ShippingRateModel | undefined> {
    await DB.instance.updateTable('shipping_rates')
      .set(newShippingRate)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('shipping_rates')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated ShippingRate')
      }

      if (this)
        dispatch('shippingRate:updated', model)
      return this.createInstance(model)
    }

    return undefined
  }

  async save(): Promise<ShippingRateModel> {
    // If the model has an ID, update it; otherwise, create a new record
    if (this.id) {
      // Update existing record
      await DB.instance.updateTable('shipping_rates')
        .set(this.attributes as ShippingRateUpdate)
        .where('id', '=', this.id)
        .executeTakeFirst()

      // Get the updated data
      const model = await DB.instance.selectFrom('shipping_rates')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated ShippingRate')
      }

      if (this)
        dispatch('shippingRate:updated', model)
      return this.createInstance(model)
    }
    else {
      // Create new record
      const result = await DB.instance.insertInto('shipping_rates')
        .values(this.attributes as NewShippingRate)
        .executeTakeFirst()

      // Get the created data
      const model = await DB.instance.selectFrom('shipping_rates')
        .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve created ShippingRate')
      }

      if (this)
        dispatch('shippingRate:created', model)
      return this.createInstance(model)
    }
  }

  static async createMany(newShippingRate: NewShippingRate[]): Promise<void> {
    const instance = new ShippingRateModel(undefined)

    const valuesFiltered = newShippingRate.map((newShippingRate: NewShippingRate) => {
      const filteredValues = Object.fromEntries(
        Object.entries(newShippingRate).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewShippingRate

      filteredValues.uuid = randomUUIDv7()

      return filteredValues
    })

    await DB.instance.insertInto('shipping_rates')
      .values(valuesFiltered)
      .executeTakeFirst()
  }

  static async forceCreate(newShippingRate: NewShippingRate): Promise<ShippingRateModel> {
    const result = await DB.instance.insertInto('shipping_rates')
      .values(newShippingRate)
      .executeTakeFirst()

    const instance = new ShippingRateModel(undefined)
    const model = await DB.instance.selectFrom('shipping_rates')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created ShippingRate')
    }

    if (model)
      dispatch('shippingRate:created', model)

    return instance.createInstance(model)
  }

  // Method to remove a ShippingRate
  async delete(): Promise<number> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()
    const model = await this.find(Number(this.id))

    if (model)
      dispatch('shippingRate:deleted', model)

    const deleted = await DB.instance.deleteFrom('shipping_rates')
      .where('id', '=', this.id)
      .execute()

    return deleted.numDeletedRows
  }

  static async remove(id: number): Promise<any> {
    const instance = new ShippingRateModel(undefined)

    const model = await instance.find(Number(id))

    if (model)
      dispatch('shippingRate:deleted', model)

    return await DB.instance.deleteFrom('shipping_rates')
      .where('id', '=', id)
      .execute()
  }

  static whereWeightFrom(value: string): ShippingRateModel {
    const instance = new ShippingRateModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('weight_from', '=', value)

    return instance
  }

  static whereWeightTo(value: string): ShippingRateModel {
    const instance = new ShippingRateModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('weight_to', '=', value)

    return instance
  }

  static whereRate(value: string): ShippingRateModel {
    const instance = new ShippingRateModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('rate', '=', value)

    return instance
  }

  static whereIn<V = number>(column: keyof ShippingRatesTable, values: V[]): ShippingRateModel {
    const instance = new ShippingRateModel(undefined)

    return instance.applyWhereIn<V>(column, values)
  }

  async shippingMethodBelong(): Promise<ShippingMethodModel> {
    if (this.shipping_method_id === undefined)
      throw new HttpError(500, 'Relation Error!')

    const model = await ShippingMethod
      .where('id', '=', this.shipping_method_id)
      .first()

    if (!model)
      throw new HttpError(500, 'Model Relation Not Found!')

    return model
  }

  async shippingZoneBelong(): Promise<ShippingZoneModel> {
    if (this.shipping_zone_id === undefined)
      throw new HttpError(500, 'Relation Error!')

    const model = await ShippingZone
      .where('id', '=', this.shipping_zone_id)
      .first()

    if (!model)
      throw new HttpError(500, 'Model Relation Not Found!')

    return model
  }

  toSearchableObject(): Partial<ShippingRateJsonResponse> {
    return {
      id: this.id,
      method: this.method,
      zone: this.zone,
      weight_from: this.weight_from,
      weight_to: this.weight_to,
      rate: this.rate,
    }
  }

  static distinct(column: keyof ShippingRateJsonResponse): ShippingRateModel {
    const instance = new ShippingRateModel(undefined)

    return instance.applyDistinct(column)
  }

  static join(table: string, firstCol: string, secondCol: string): ShippingRateModel {
    const instance = new ShippingRateModel(undefined)

    return instance.applyJoin(table, firstCol, secondCol)
  }

  toJSON(): ShippingRateJsonResponse {
    const output = {

      uuid: this.uuid,

      id: this.id,
      weight_from: this.weight_from,
      weight_to: this.weight_to,
      rate: this.rate,

      created_at: this.created_at,

      updated_at: this.updated_at,

      shipping_method_id: this.shipping_method_id,
      shipping_method: this.shipping_method,
      shipping_zone_id: this.shipping_zone_id,
      shipping_zone: this.shipping_zone,
      ...this.customColumns,
    }

    return output
  }

  parseResult(model: ShippingRateModel): ShippingRateModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof ShippingRateModel]
    }

    return model
  }

  // Add a protected applyFind implementation
  protected async applyFind(id: number): Promise<ShippingRateModel | undefined> {
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

export async function find(id: number): Promise<ShippingRateModel | undefined> {
  const query = DB.instance.selectFrom('shipping_rates').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  const instance = new ShippingRateModel(undefined)
  return instance.createInstance(model)
}

export async function count(): Promise<number> {
  const results = await ShippingRateModel.count()

  return results
}

export async function create(newShippingRate: NewShippingRate): Promise<ShippingRateModel> {
  const instance = new ShippingRateModel(undefined)
  return await instance.applyCreate(newShippingRate)
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(DB.instance)
}

export async function remove(id: number): Promise<void> {
  await DB.instance.deleteFrom('shipping_rates')
    .where('id', '=', id)
    .execute()
}

export async function whereWeightFrom(value: number): Promise<ShippingRateModel[]> {
  const query = DB.instance.selectFrom('shipping_rates').where('weight_from', '=', value)
  const results: ShippingRateJsonResponse = await query.execute()

  return results.map((modelItem: ShippingRateJsonResponse) => new ShippingRateModel(modelItem))
}

export async function whereWeightTo(value: number): Promise<ShippingRateModel[]> {
  const query = DB.instance.selectFrom('shipping_rates').where('weight_to', '=', value)
  const results: ShippingRateJsonResponse = await query.execute()

  return results.map((modelItem: ShippingRateJsonResponse) => new ShippingRateModel(modelItem))
}

export async function whereRate(value: number): Promise<ShippingRateModel[]> {
  const query = DB.instance.selectFrom('shipping_rates').where('rate', '=', value)
  const results: ShippingRateJsonResponse = await query.execute()

  return results.map((modelItem: ShippingRateJsonResponse) => new ShippingRateModel(modelItem))
}

export const ShippingRate = ShippingRateModel

export default ShippingRate
