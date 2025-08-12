import type { RawBuilder } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import type { NewShippingZone, ShippingZoneJsonResponse, ShippingZonesTable, ShippingZoneUpdate } from '../types/ShippingZoneType'
import type { ShippingMethodModel } from './ShippingMethod'
import type { ShippingRateModel } from './ShippingRate'
import { randomUUIDv7 } from 'bun'
import { sql } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'
import { dispatch } from '@stacksjs/events'
import { DB } from '@stacksjs/orm'

import { BaseOrm } from '../utils/base'

export class ShippingZoneModel extends BaseOrm<ShippingZoneModel, ShippingZonesTable, ShippingZoneJsonResponse> {
  private readonly hidden: Array<keyof ShippingZoneJsonResponse> = []
  private readonly fillable: Array<keyof ShippingZoneJsonResponse> = ['name', 'countries', 'regions', 'postal_codes', 'status', 'uuid', 'shipping_method_id']
  private readonly guarded: Array<keyof ShippingZoneJsonResponse> = []
  protected attributes = {} as ShippingZoneJsonResponse
  protected originalAttributes = {} as ShippingZoneJsonResponse

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

  constructor(shippingZone: ShippingZoneJsonResponse | undefined) {
    super('shipping_zones')
    if (shippingZone) {
      this.attributes = { ...shippingZone }
      this.originalAttributes = { ...shippingZone }

      Object.keys(shippingZone).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (shippingZone as ShippingZoneJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = DB.instance.selectFrom('shipping_zones')
    this.updateFromQuery = DB.instance.updateTable('shipping_zones')
    this.deleteFromQuery = DB.instance.deleteFrom('shipping_zones')
    this.hasSelect = false
  }

  protected async loadRelations(models: ShippingZoneJsonResponse | ShippingZoneJsonResponse[]): Promise<void> {
    // Handle both single model and array of models
    const modelArray = Array.isArray(models) ? models : [models]
    if (!modelArray.length)
      return

    const modelIds = modelArray.map(model => model.id)

    for (const relation of this.withRelations) {
      const relatedRecords = await DB.instance
        .selectFrom(relation)
        .where('shippingZone_id', 'in', modelIds)
        .selectAll()
        .execute()

      if (Array.isArray(models)) {
        models.map((model: ShippingZoneJsonResponse) => {
          const records = relatedRecords.filter((record: { shippingZone_id: number }) => {
            return record.shippingZone_id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      }
      else {
        const records = relatedRecords.filter((record: { shippingZone_id: number }) => {
          return record.shippingZone_id === models.id
        })

        models[relation] = records.length === 1 ? records[0] : records
      }
    }
  }

  static with(relations: string[]): ShippingZoneModel {
    const instance = new ShippingZoneModel(undefined)

    return instance.applyWith(relations)
  }

  protected mapCustomGetters(models: ShippingZoneJsonResponse | ShippingZoneJsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: ShippingZoneJsonResponse) => {
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

  async mapCustomSetters(model: NewShippingZone): Promise<void> {
    const customSetter = {
      default: () => {
      },

    }

    for (const [key, fn] of Object.entries(customSetter)) {
      (model as any)[key] = await fn()
    }
  }

  get shipping_rates(): ShippingRateModel[] | [] {
    return this.attributes.shipping_rates
  }

  get shipping_method_id(): number {
    return this.attributes.shipping_method_id
  }

  get shipping_method(): ShippingMethodModel | undefined {
    return this.attributes.shipping_method
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

  get countries(): string | undefined {
    return this.attributes.countries
  }

  get regions(): string | undefined {
    return this.attributes.regions
  }

  get postal_codes(): string | undefined {
    return this.attributes.postal_codes
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

  set countries(value: string) {
    this.attributes.countries = value
  }

  set regions(value: string) {
    this.attributes.regions = value
  }

  set postal_codes(value: string) {
    this.attributes.postal_codes = value
  }

  set status(value: string | string[]) {
    this.attributes.status = value
  }

  set updated_at(value: string) {
    this.attributes.updated_at = value
  }

  static select(params: (keyof ShippingZoneJsonResponse)[] | RawBuilder<string> | string): ShippingZoneModel {
    const instance = new ShippingZoneModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a ShippingZone by ID
  static async find(id: number): Promise<ShippingZoneModel | undefined> {
    const query = DB.instance.selectFrom('shipping_zones').where('id', '=', id).selectAll()

    const model = await query.executeTakeFirst()

    if (!model)
      return undefined

    const instance = new ShippingZoneModel(undefined)
    return instance.createInstance(model)
  }

  static async first(): Promise<ShippingZoneModel | undefined> {
    const instance = new ShippingZoneModel(undefined)

    const model = await instance.applyFirst()

    const data = new ShippingZoneModel(model)

    return data
  }

  static async last(): Promise<ShippingZoneModel | undefined> {
    const instance = new ShippingZoneModel(undefined)

    const model = await instance.applyLast()

    if (!model)
      return undefined

    return new ShippingZoneModel(model)
  }

  static async firstOrFail(): Promise<ShippingZoneModel | undefined> {
    const instance = new ShippingZoneModel(undefined)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<ShippingZoneModel[]> {
    const instance = new ShippingZoneModel(undefined)

    const models = await DB.instance.selectFrom('shipping_zones').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: ShippingZoneJsonResponse) => {
      return new ShippingZoneModel(model)
    }))

    return data
  }

  static async findOrFail(id: number): Promise<ShippingZoneModel | undefined> {
    const instance = new ShippingZoneModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<ShippingZoneModel[]> {
    const instance = new ShippingZoneModel(undefined)

    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: ShippingZoneJsonResponse) => instance.parseResult(new ShippingZoneModel(modelItem)))
  }

  static async latest(column: keyof ShippingZonesTable = 'created_at'): Promise<ShippingZoneModel | undefined> {
    const instance = new ShippingZoneModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'desc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new ShippingZoneModel(model)
  }

  static async oldest(column: keyof ShippingZonesTable = 'created_at'): Promise<ShippingZoneModel | undefined> {
    const instance = new ShippingZoneModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'asc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new ShippingZoneModel(model)
  }

  static skip(count: number): ShippingZoneModel {
    const instance = new ShippingZoneModel(undefined)

    return instance.applySkip(count)
  }

  static take(count: number): ShippingZoneModel {
    const instance = new ShippingZoneModel(undefined)

    return instance.applyTake(count)
  }

  static where<V = string>(column: keyof ShippingZonesTable, ...args: [V] | [Operator, V]): ShippingZoneModel {
    const instance = new ShippingZoneModel(undefined)

    return instance.applyWhere<V>(column, ...args)
  }

  static orWhere(...conditions: [string, any][]): ShippingZoneModel {
    const instance = new ShippingZoneModel(undefined)

    return instance.applyOrWhere(...conditions)
  }

  static whereNotIn<V = number>(column: keyof ShippingZonesTable, values: V[]): ShippingZoneModel {
    const instance = new ShippingZoneModel(undefined)

    return instance.applyWhereNotIn<V>(column, values)
  }

  static whereBetween<V = number>(column: keyof ShippingZonesTable, range: [V, V]): ShippingZoneModel {
    const instance = new ShippingZoneModel(undefined)

    return instance.applyWhereBetween<V>(column, range)
  }

  static whereRef(column: keyof ShippingZonesTable, ...args: string[]): ShippingZoneModel {
    const instance = new ShippingZoneModel(undefined)

    return instance.applyWhereRef(column, ...args)
  }

  static when(condition: boolean, callback: (query: ShippingZoneModel) => ShippingZoneModel): ShippingZoneModel {
    const instance = new ShippingZoneModel(undefined)

    return instance.applyWhen(condition, callback as any)
  }

  static whereNull(column: keyof ShippingZonesTable): ShippingZoneModel {
    const instance = new ShippingZoneModel(undefined)

    return instance.applyWhereNull(column)
  }

  static whereNotNull(column: keyof ShippingZonesTable): ShippingZoneModel {
    const instance = new ShippingZoneModel(undefined)

    return instance.applyWhereNotNull(column)
  }

  static whereLike(column: keyof ShippingZonesTable, value: string): ShippingZoneModel {
    const instance = new ShippingZoneModel(undefined)

    return instance.applyWhereLike(column, value)
  }

  static orderBy(column: keyof ShippingZonesTable, order: 'asc' | 'desc'): ShippingZoneModel {
    const instance = new ShippingZoneModel(undefined)

    return instance.applyOrderBy(column, order)
  }

  static orderByAsc(column: keyof ShippingZonesTable): ShippingZoneModel {
    const instance = new ShippingZoneModel(undefined)

    return instance.applyOrderByAsc(column)
  }

  static orderByDesc(column: keyof ShippingZonesTable): ShippingZoneModel {
    const instance = new ShippingZoneModel(undefined)

    return instance.applyOrderByDesc(column)
  }

  static groupBy(column: keyof ShippingZonesTable): ShippingZoneModel {
    const instance = new ShippingZoneModel(undefined)

    return instance.applyGroupBy(column)
  }

  static having<V = string>(column: keyof ShippingZonesTable, operator: Operator, value: V): ShippingZoneModel {
    const instance = new ShippingZoneModel(undefined)

    return instance.applyHaving<V>(column, operator, value)
  }

  static inRandomOrder(): ShippingZoneModel {
    const instance = new ShippingZoneModel(undefined)

    return instance.applyInRandomOrder()
  }

  static whereColumn(first: keyof ShippingZonesTable, operator: Operator, second: keyof ShippingZonesTable): ShippingZoneModel {
    const instance = new ShippingZoneModel(undefined)

    return instance.applyWhereColumn(first, operator, second)
  }

  static async max(field: keyof ShippingZonesTable): Promise<number> {
    const instance = new ShippingZoneModel(undefined)

    return await instance.applyMax(field)
  }

  static async min(field: keyof ShippingZonesTable): Promise<number> {
    const instance = new ShippingZoneModel(undefined)

    return await instance.applyMin(field)
  }

  static async avg(field: keyof ShippingZonesTable): Promise<number> {
    const instance = new ShippingZoneModel(undefined)

    return await instance.applyAvg(field)
  }

  static async sum(field: keyof ShippingZonesTable): Promise<number> {
    const instance = new ShippingZoneModel(undefined)

    return await instance.applySum(field)
  }

  static async count(): Promise<number> {
    const instance = new ShippingZoneModel(undefined)

    return instance.applyCount()
  }

  static async get(): Promise<ShippingZoneModel[]> {
    const instance = new ShippingZoneModel(undefined)

    const results = await instance.applyGet()

    return results.map((item: ShippingZoneJsonResponse) => instance.createInstance(item))
  }

  static async pluck<K extends keyof ShippingZoneModel>(field: K): Promise<ShippingZoneModel[K][]> {
    const instance = new ShippingZoneModel(undefined)

    return await instance.applyPluck(field)
  }

  static async chunk(size: number, callback: (models: ShippingZoneModel[]) => Promise<void>): Promise<void> {
    const instance = new ShippingZoneModel(undefined)

    await instance.applyChunk(size, async (models) => {
      const modelInstances = models.map((item: ShippingZoneJsonResponse) => instance.createInstance(item))
      await callback(modelInstances)
    })
  }

  static async paginate(options: { limit?: number, offset?: number, page?: number } = { limit: 10, offset: 0, page: 1 }): Promise<{
    data: ShippingZoneModel[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }> {
    const instance = new ShippingZoneModel(undefined)

    const result = await instance.applyPaginate(options)

    return {
      data: result.data.map((item: ShippingZoneJsonResponse) => instance.createInstance(item)),
      paging: result.paging,
      next_cursor: result.next_cursor,
    }
  }

  // Instance method for creating model instances
  createInstance(data: ShippingZoneJsonResponse): ShippingZoneModel {
    return new ShippingZoneModel(data)
  }

  async applyCreate(newShippingZone: NewShippingZone): Promise<ShippingZoneModel> {
    const filteredValues = Object.fromEntries(
      Object.entries(newShippingZone).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewShippingZone

    await this.mapCustomSetters(filteredValues)

    filteredValues.uuid = randomUUIDv7()

    const result = await DB.instance.insertInto('shipping_zones')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await DB.instance.selectFrom('shipping_zones')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created ShippingZone')
    }

    if (model)
      dispatch('shippingZone:created', model)
    return this.createInstance(model)
  }

  async create(newShippingZone: NewShippingZone): Promise<ShippingZoneModel> {
    return await this.applyCreate(newShippingZone)
  }

  static async create(newShippingZone: NewShippingZone): Promise<ShippingZoneModel> {
    const instance = new ShippingZoneModel(undefined)
    return await instance.applyCreate(newShippingZone)
  }

  static async firstOrCreate(search: Partial<ShippingZonesTable>, values: NewShippingZone = {} as NewShippingZone): Promise<ShippingZoneModel> {
    // First try to find a record matching the search criteria
    const instance = new ShippingZoneModel(undefined)

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
    const createData = { ...search, ...values } as NewShippingZone
    return await ShippingZoneModel.create(createData)
  }

  static async updateOrCreate(search: Partial<ShippingZonesTable>, values: NewShippingZone = {} as NewShippingZone): Promise<ShippingZoneModel> {
    // First try to find a record matching the search criteria
    const instance = new ShippingZoneModel(undefined)

    // Apply all search conditions
    for (const [key, value] of Object.entries(search)) {
      instance.selectFromQuery = instance.selectFromQuery.where(key, '=', value)
    }

    // Try to find the record
    const existingRecord = await instance.applyFirst()

    if (existingRecord) {
      // If record exists, update it with the new values
      const model = instance.createInstance(existingRecord)
      const updatedModel = await model.update(values as ShippingZoneUpdate)

      // Return the updated model instance
      if (updatedModel) {
        return updatedModel
      }

      // If update didn't return a model, fetch it again to ensure we have latest data
      const refreshedModel = await instance.applyFirst()
      return instance.createInstance(refreshedModel!)
    }

    // If no record exists, create a new one with combined search criteria and values
    const createData = { ...search, ...values } as NewShippingZone
    return await ShippingZoneModel.create(createData)
  }

  async update(newShippingZone: ShippingZoneUpdate): Promise<ShippingZoneModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newShippingZone).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as ShippingZoneUpdate

    await this.mapCustomSetters(filteredValues)

    filteredValues.updated_at = new Date().toISOString()

    await DB.instance.updateTable('shipping_zones')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('shipping_zones')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated ShippingZone')
      }

      if (model)
        dispatch('shippingZone:updated', model)
      return this.createInstance(model)
    }

    return undefined
  }

  async forceUpdate(newShippingZone: ShippingZoneUpdate): Promise<ShippingZoneModel | undefined> {
    await DB.instance.updateTable('shipping_zones')
      .set(newShippingZone)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('shipping_zones')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated ShippingZone')
      }

      if (this)
        dispatch('shippingZone:updated', model)
      return this.createInstance(model)
    }

    return undefined
  }

  async save(): Promise<ShippingZoneModel> {
    // If the model has an ID, update it; otherwise, create a new record
    if (this.id) {
      // Update existing record
      await DB.instance.updateTable('shipping_zones')
        .set(this.attributes as ShippingZoneUpdate)
        .where('id', '=', this.id)
        .executeTakeFirst()

      // Get the updated data
      const model = await DB.instance.selectFrom('shipping_zones')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated ShippingZone')
      }

      if (this)
        dispatch('shippingZone:updated', model)
      return this.createInstance(model)
    }
    else {
      // Create new record
      const result = await DB.instance.insertInto('shipping_zones')
        .values(this.attributes as NewShippingZone)
        .executeTakeFirst()

      // Get the created data
      const model = await DB.instance.selectFrom('shipping_zones')
        .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve created ShippingZone')
      }

      if (this)
        dispatch('shippingZone:created', model)
      return this.createInstance(model)
    }
  }

  static async createMany(newShippingZone: NewShippingZone[]): Promise<void> {
    const instance = new ShippingZoneModel(undefined)

    const valuesFiltered = newShippingZone.map((newShippingZone: NewShippingZone) => {
      const filteredValues = Object.fromEntries(
        Object.entries(newShippingZone).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewShippingZone

      filteredValues.uuid = randomUUIDv7()

      return filteredValues
    })

    await DB.instance.insertInto('shipping_zones')
      .values(valuesFiltered)
      .executeTakeFirst()
  }

  static async forceCreate(newShippingZone: NewShippingZone): Promise<ShippingZoneModel> {
    const result = await DB.instance.insertInto('shipping_zones')
      .values(newShippingZone)
      .executeTakeFirst()

    const instance = new ShippingZoneModel(undefined)
    const model = await DB.instance.selectFrom('shipping_zones')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created ShippingZone')
    }

    if (model)
      dispatch('shippingZone:created', model)

    return instance.createInstance(model)
  }

  // Method to remove a ShippingZone
  async delete(): Promise<number> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()
    const model = await this.find(Number(this.id))

    if (model)
      dispatch('shippingZone:deleted', model)

    const deleted = await DB.instance.deleteFrom('shipping_zones')
      .where('id', '=', this.id)
      .execute()

    return deleted.numDeletedRows
  }

  static async remove(id: number): Promise<any> {
    const instance = new ShippingZoneModel(undefined)

    const model = await instance.find(Number(id))

    if (model)
      dispatch('shippingZone:deleted', model)

    return await DB.instance.deleteFrom('shipping_zones')
      .where('id', '=', id)
      .execute()
  }

  static whereName(value: string): ShippingZoneModel {
    const instance = new ShippingZoneModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('name', '=', value)

    return instance
  }

  static whereCountries(value: string): ShippingZoneModel {
    const instance = new ShippingZoneModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('countries', '=', value)

    return instance
  }

  static whereRegions(value: string): ShippingZoneModel {
    const instance = new ShippingZoneModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('regions', '=', value)

    return instance
  }

  static wherePostalCodes(value: string): ShippingZoneModel {
    const instance = new ShippingZoneModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('postal_codes', '=', value)

    return instance
  }

  static whereStatus(value: string): ShippingZoneModel {
    const instance = new ShippingZoneModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('status', '=', value)

    return instance
  }

  static whereIn<V = number>(column: keyof ShippingZonesTable, values: V[]): ShippingZoneModel {
    const instance = new ShippingZoneModel(undefined)

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

  toSearchableObject(): Partial<ShippingZoneJsonResponse> {
    return {
      id: this.id,
      name: this.name,
      countries: this.countries,
      regions: this.regions,
      postal_codes: this.postal_codes,
      status: this.status,
    }
  }

  static distinct(column: keyof ShippingZoneJsonResponse): ShippingZoneModel {
    const instance = new ShippingZoneModel(undefined)

    return instance.applyDistinct(column)
  }

  static join(table: string, firstCol: string, secondCol: string): ShippingZoneModel {
    const instance = new ShippingZoneModel(undefined)

    return instance.applyJoin(table, firstCol, secondCol)
  }

  toJSON(): ShippingZoneJsonResponse {
    const output = {

      uuid: this.uuid,

      id: this.id,
      name: this.name,
      countries: this.countries,
      regions: this.regions,
      postal_codes: this.postal_codes,
      status: this.status,

      created_at: this.created_at,

      updated_at: this.updated_at,

      shipping_rates: this.shipping_rates,
      shipping_method_id: this.shipping_method_id,
      shipping_method: this.shipping_method,
      ...this.customColumns,
    }

    return output
  }

  parseResult(model: ShippingZoneModel): ShippingZoneModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof ShippingZoneModel]
    }

    return model
  }

  // Add a protected applyFind implementation
  protected async applyFind(id: number): Promise<ShippingZoneModel | undefined> {
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

export async function find(id: number): Promise<ShippingZoneModel | undefined> {
  const query = DB.instance.selectFrom('shipping_zones').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  const instance = new ShippingZoneModel(undefined)
  return instance.createInstance(model)
}

export async function count(): Promise<number> {
  const results = await ShippingZoneModel.count()

  return results
}

export async function create(newShippingZone: NewShippingZone): Promise<ShippingZoneModel> {
  const instance = new ShippingZoneModel(undefined)
  return await instance.applyCreate(newShippingZone)
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(DB.instance)
}

export async function remove(id: number): Promise<void> {
  await DB.instance.deleteFrom('shipping_zones')
    .where('id', '=', id)
    .execute()
}

export async function whereName(value: string): Promise<ShippingZoneModel[]> {
  const query = DB.instance.selectFrom('shipping_zones').where('name', '=', value)
  const results: ShippingZoneJsonResponse = await query.execute()

  return results.map((modelItem: ShippingZoneJsonResponse) => new ShippingZoneModel(modelItem))
}

export async function whereCountries(value: string): Promise<ShippingZoneModel[]> {
  const query = DB.instance.selectFrom('shipping_zones').where('countries', '=', value)
  const results: ShippingZoneJsonResponse = await query.execute()

  return results.map((modelItem: ShippingZoneJsonResponse) => new ShippingZoneModel(modelItem))
}

export async function whereRegions(value: string): Promise<ShippingZoneModel[]> {
  const query = DB.instance.selectFrom('shipping_zones').where('regions', '=', value)
  const results: ShippingZoneJsonResponse = await query.execute()

  return results.map((modelItem: ShippingZoneJsonResponse) => new ShippingZoneModel(modelItem))
}

export async function wherePostalCodes(value: string): Promise<ShippingZoneModel[]> {
  const query = DB.instance.selectFrom('shipping_zones').where('postal_codes', '=', value)
  const results: ShippingZoneJsonResponse = await query.execute()

  return results.map((modelItem: ShippingZoneJsonResponse) => new ShippingZoneModel(modelItem))
}

export async function whereStatus(value: string | string[]): Promise<ShippingZoneModel[]> {
  const query = DB.instance.selectFrom('shipping_zones').where('status', '=', value)
  const results: ShippingZoneJsonResponse = await query.execute()

  return results.map((modelItem: ShippingZoneJsonResponse) => new ShippingZoneModel(modelItem))
}

export const ShippingZone = ShippingZoneModel

export default ShippingZone
