import type { RawBuilder } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import type { LicenseKeyJsonResponse, LicenseKeysTable, LicenseKeyUpdate, NewLicenseKey } from '../types/LicenseKeyType'
import type { CustomerModel } from './Customer'
import type { OrderModel } from './Order'
import type { ProductModel } from './Product'
import { randomUUIDv7 } from 'bun'
import { sql } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'
import { dispatch } from '@stacksjs/events'

import { DB } from '@stacksjs/orm'

import { BaseOrm } from '../utils/base'

export class LicenseKeyModel extends BaseOrm<LicenseKeyModel, LicenseKeysTable, LicenseKeyJsonResponse> {
  private readonly hidden: Array<keyof LicenseKeyJsonResponse> = []
  private readonly fillable: Array<keyof LicenseKeyJsonResponse> = ['key', 'template', 'expiry_date', 'status', 'uuid', 'customer_id', 'product_id', 'order_id']
  private readonly guarded: Array<keyof LicenseKeyJsonResponse> = []
  protected attributes = {} as LicenseKeyJsonResponse
  protected originalAttributes = {} as LicenseKeyJsonResponse

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

  constructor(licenseKey: LicenseKeyJsonResponse | undefined) {
    super('license_keys')
    if (licenseKey) {
      this.attributes = { ...licenseKey }
      this.originalAttributes = { ...licenseKey }

      Object.keys(licenseKey).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (licenseKey as LicenseKeyJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = DB.instance.selectFrom('license_keys')
    this.updateFromQuery = DB.instance.updateTable('license_keys')
    this.deleteFromQuery = DB.instance.deleteFrom('license_keys')
    this.hasSelect = false
  }

  protected async loadRelations(models: LicenseKeyJsonResponse | LicenseKeyJsonResponse[]): Promise<void> {
    // Handle both single model and array of models
    const modelArray = Array.isArray(models) ? models : [models]
    if (!modelArray.length)
      return

    const modelIds = modelArray.map(model => model.id)

    for (const relation of this.withRelations) {
      const relatedRecords = await DB.instance
        .selectFrom(relation)
        .where('licenseKey_id', 'in', modelIds)
        .selectAll()
        .execute()

      if (Array.isArray(models)) {
        models.map((model: LicenseKeyJsonResponse) => {
          const records = relatedRecords.filter((record: { licenseKey_id: number }) => {
            return record.licenseKey_id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      }
      else {
        const records = relatedRecords.filter((record: { licenseKey_id: number }) => {
          return record.licenseKey_id === models.id
        })

        models[relation] = records.length === 1 ? records[0] : records
      }
    }
  }

  static with(relations: string[]): LicenseKeyModel {
    const instance = new LicenseKeyModel(undefined)

    return instance.applyWith(relations)
  }

  protected mapCustomGetters(models: LicenseKeyJsonResponse | LicenseKeyJsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: LicenseKeyJsonResponse) => {
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

  async mapCustomSetters(model: NewLicenseKey): Promise<void> {
    const customSetter = {
      default: () => {
      },

    }

    for (const [key, fn] of Object.entries(customSetter)) {
      (model as any)[key] = await fn()
    }
  }

  get customer_id(): number {
    return this.attributes.customer_id
  }

  get customer(): CustomerModel | undefined {
    return this.attributes.customer
  }

  get product_id(): number {
    return this.attributes.product_id
  }

  get product(): ProductModel | undefined {
    return this.attributes.product
  }

  get order_id(): number {
    return this.attributes.order_id
  }

  get order(): OrderModel | undefined {
    return this.attributes.order
  }

  get id(): number {
    return this.attributes.id
  }

  get uuid(): string | undefined {
    return this.attributes.uuid
  }

  get key(): string {
    return this.attributes.key
  }

  get template(): string | string[] {
    return this.attributes.template
  }

  get expiry_date(): Date | string {
    return this.attributes.expiry_date
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

  set key(value: string) {
    this.attributes.key = value
  }

  set template(value: string | string[]) {
    this.attributes.template = value
  }

  set expiry_date(value: Date | string) {
    this.attributes.expiry_date = value
  }

  set status(value: string | string[]) {
    this.attributes.status = value
  }

  set updated_at(value: string) {
    this.attributes.updated_at = value
  }

  static select(params: (keyof LicenseKeyJsonResponse)[] | RawBuilder<string> | string): LicenseKeyModel {
    const instance = new LicenseKeyModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a LicenseKey by ID
  static async find(id: number): Promise<LicenseKeyModel | undefined> {
    const query = DB.instance.selectFrom('license_keys').where('id', '=', id).selectAll()

    const model = await query.executeTakeFirst()

    if (!model)
      return undefined

    const instance = new LicenseKeyModel(undefined)
    return instance.createInstance(model)
  }

  static async first(): Promise<LicenseKeyModel | undefined> {
    const instance = new LicenseKeyModel(undefined)

    const model = await instance.applyFirst()

    const data = new LicenseKeyModel(model)

    return data
  }

  static async last(): Promise<LicenseKeyModel | undefined> {
    const instance = new LicenseKeyModel(undefined)

    const model = await instance.applyLast()

    if (!model)
      return undefined

    return new LicenseKeyModel(model)
  }

  static async firstOrFail(): Promise<LicenseKeyModel | undefined> {
    const instance = new LicenseKeyModel(undefined)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<LicenseKeyModel[]> {
    const instance = new LicenseKeyModel(undefined)

    const models = await DB.instance.selectFrom('license_keys').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: LicenseKeyJsonResponse) => {
      return new LicenseKeyModel(model)
    }))

    return data
  }

  static async findOrFail(id: number): Promise<LicenseKeyModel | undefined> {
    const instance = new LicenseKeyModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<LicenseKeyModel[]> {
    const instance = new LicenseKeyModel(undefined)

    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: LicenseKeyJsonResponse) => instance.parseResult(new LicenseKeyModel(modelItem)))
  }

  static async latest(column: keyof LicenseKeysTable = 'created_at'): Promise<LicenseKeyModel | undefined> {
    const instance = new LicenseKeyModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'desc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new LicenseKeyModel(model)
  }

  static async oldest(column: keyof LicenseKeysTable = 'created_at'): Promise<LicenseKeyModel | undefined> {
    const instance = new LicenseKeyModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'asc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new LicenseKeyModel(model)
  }

  static skip(count: number): LicenseKeyModel {
    const instance = new LicenseKeyModel(undefined)

    return instance.applySkip(count)
  }

  static take(count: number): LicenseKeyModel {
    const instance = new LicenseKeyModel(undefined)

    return instance.applyTake(count)
  }

  static where<V = string>(column: keyof LicenseKeysTable, ...args: [V] | [Operator, V]): LicenseKeyModel {
    const instance = new LicenseKeyModel(undefined)

    return instance.applyWhere<V>(column, ...args)
  }

  static orWhere(...conditions: [string, any][]): LicenseKeyModel {
    const instance = new LicenseKeyModel(undefined)

    return instance.applyOrWhere(...conditions)
  }

  static whereNotIn<V = number>(column: keyof LicenseKeysTable, values: V[]): LicenseKeyModel {
    const instance = new LicenseKeyModel(undefined)

    return instance.applyWhereNotIn<V>(column, values)
  }

  static whereBetween<V = number>(column: keyof LicenseKeysTable, range: [V, V]): LicenseKeyModel {
    const instance = new LicenseKeyModel(undefined)

    return instance.applyWhereBetween<V>(column, range)
  }

  static whereRef(column: keyof LicenseKeysTable, ...args: string[]): LicenseKeyModel {
    const instance = new LicenseKeyModel(undefined)

    return instance.applyWhereRef(column, ...args)
  }

  static when(condition: boolean, callback: (query: LicenseKeyModel) => LicenseKeyModel): LicenseKeyModel {
    const instance = new LicenseKeyModel(undefined)

    return instance.applyWhen(condition, callback as any)
  }

  static whereNull(column: keyof LicenseKeysTable): LicenseKeyModel {
    const instance = new LicenseKeyModel(undefined)

    return instance.applyWhereNull(column)
  }

  static whereNotNull(column: keyof LicenseKeysTable): LicenseKeyModel {
    const instance = new LicenseKeyModel(undefined)

    return instance.applyWhereNotNull(column)
  }

  static whereLike(column: keyof LicenseKeysTable, value: string): LicenseKeyModel {
    const instance = new LicenseKeyModel(undefined)

    return instance.applyWhereLike(column, value)
  }

  static orderBy(column: keyof LicenseKeysTable, order: 'asc' | 'desc'): LicenseKeyModel {
    const instance = new LicenseKeyModel(undefined)

    return instance.applyOrderBy(column, order)
  }

  static orderByAsc(column: keyof LicenseKeysTable): LicenseKeyModel {
    const instance = new LicenseKeyModel(undefined)

    return instance.applyOrderByAsc(column)
  }

  static orderByDesc(column: keyof LicenseKeysTable): LicenseKeyModel {
    const instance = new LicenseKeyModel(undefined)

    return instance.applyOrderByDesc(column)
  }

  static groupBy(column: keyof LicenseKeysTable): LicenseKeyModel {
    const instance = new LicenseKeyModel(undefined)

    return instance.applyGroupBy(column)
  }

  static having<V = string>(column: keyof LicenseKeysTable, operator: Operator, value: V): LicenseKeyModel {
    const instance = new LicenseKeyModel(undefined)

    return instance.applyHaving<V>(column, operator, value)
  }

  static inRandomOrder(): LicenseKeyModel {
    const instance = new LicenseKeyModel(undefined)

    return instance.applyInRandomOrder()
  }

  static whereColumn(first: keyof LicenseKeysTable, operator: Operator, second: keyof LicenseKeysTable): LicenseKeyModel {
    const instance = new LicenseKeyModel(undefined)

    return instance.applyWhereColumn(first, operator, second)
  }

  static async max(field: keyof LicenseKeysTable): Promise<number> {
    const instance = new LicenseKeyModel(undefined)

    return await instance.applyMax(field)
  }

  static async min(field: keyof LicenseKeysTable): Promise<number> {
    const instance = new LicenseKeyModel(undefined)

    return await instance.applyMin(field)
  }

  static async avg(field: keyof LicenseKeysTable): Promise<number> {
    const instance = new LicenseKeyModel(undefined)

    return await instance.applyAvg(field)
  }

  static async sum(field: keyof LicenseKeysTable): Promise<number> {
    const instance = new LicenseKeyModel(undefined)

    return await instance.applySum(field)
  }

  static async count(): Promise<number> {
    const instance = new LicenseKeyModel(undefined)

    return instance.applyCount()
  }

  static async get(): Promise<LicenseKeyModel[]> {
    const instance = new LicenseKeyModel(undefined)

    const results = await instance.applyGet()

    return results.map((item: LicenseKeyJsonResponse) => instance.createInstance(item))
  }

  static async pluck<K extends keyof LicenseKeyModel>(field: K): Promise<LicenseKeyModel[K][]> {
    const instance = new LicenseKeyModel(undefined)

    return await instance.applyPluck(field)
  }

  static async chunk(size: number, callback: (models: LicenseKeyModel[]) => Promise<void>): Promise<void> {
    const instance = new LicenseKeyModel(undefined)

    await instance.applyChunk(size, async (models) => {
      const modelInstances = models.map((item: LicenseKeyJsonResponse) => instance.createInstance(item))
      await callback(modelInstances)
    })
  }

  static async paginate(options: { limit?: number, offset?: number, page?: number } = { limit: 10, offset: 0, page: 1 }): Promise<{
    data: LicenseKeyModel[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }> {
    const instance = new LicenseKeyModel(undefined)

    const result = await instance.applyPaginate(options)

    return {
      data: result.data.map((item: LicenseKeyJsonResponse) => instance.createInstance(item)),
      paging: result.paging,
      next_cursor: result.next_cursor,
    }
  }

  // Instance method for creating model instances
  createInstance(data: LicenseKeyJsonResponse): LicenseKeyModel {
    return new LicenseKeyModel(data)
  }

  async applyCreate(newLicenseKey: NewLicenseKey): Promise<LicenseKeyModel> {
    const filteredValues = Object.fromEntries(
      Object.entries(newLicenseKey).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewLicenseKey

    await this.mapCustomSetters(filteredValues)

    filteredValues.uuid = randomUUIDv7()

    const result = await DB.instance.insertInto('license_keys')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await DB.instance.selectFrom('license_keys')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created LicenseKey')
    }

    if (model)
      dispatch('licenseKey:created', model)
    return this.createInstance(model)
  }

  async create(newLicenseKey: NewLicenseKey): Promise<LicenseKeyModel> {
    return await this.applyCreate(newLicenseKey)
  }

  static async create(newLicenseKey: NewLicenseKey): Promise<LicenseKeyModel> {
    const instance = new LicenseKeyModel(undefined)
    return await instance.applyCreate(newLicenseKey)
  }

  static async firstOrCreate(search: Partial<LicenseKeysTable>, values: NewLicenseKey = {} as NewLicenseKey): Promise<LicenseKeyModel> {
    // First try to find a record matching the search criteria
    const instance = new LicenseKeyModel(undefined)

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
    const createData = { ...search, ...values } as NewLicenseKey
    return await LicenseKeyModel.create(createData)
  }

  static async updateOrCreate(search: Partial<LicenseKeysTable>, values: NewLicenseKey = {} as NewLicenseKey): Promise<LicenseKeyModel> {
    // First try to find a record matching the search criteria
    const instance = new LicenseKeyModel(undefined)

    // Apply all search conditions
    for (const [key, value] of Object.entries(search)) {
      instance.selectFromQuery = instance.selectFromQuery.where(key, '=', value)
    }

    // Try to find the record
    const existingRecord = await instance.applyFirst()

    if (existingRecord) {
      // If record exists, update it with the new values
      const model = instance.createInstance(existingRecord)
      const updatedModel = await model.update(values as LicenseKeyUpdate)

      // Return the updated model instance
      if (updatedModel) {
        return updatedModel
      }

      // If update didn't return a model, fetch it again to ensure we have latest data
      const refreshedModel = await instance.applyFirst()
      return instance.createInstance(refreshedModel!)
    }

    // If no record exists, create a new one with combined search criteria and values
    const createData = { ...search, ...values } as NewLicenseKey
    return await LicenseKeyModel.create(createData)
  }

  async update(newLicenseKey: LicenseKeyUpdate): Promise<LicenseKeyModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newLicenseKey).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as LicenseKeyUpdate

    await this.mapCustomSetters(filteredValues)

    filteredValues.updated_at = new Date().toISOString()

    await DB.instance.updateTable('license_keys')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('license_keys')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated LicenseKey')
      }

      if (model)
        dispatch('licenseKey:updated', model)
      return this.createInstance(model)
    }

    return undefined
  }

  async forceUpdate(newLicenseKey: LicenseKeyUpdate): Promise<LicenseKeyModel | undefined> {
    await DB.instance.updateTable('license_keys')
      .set(newLicenseKey)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('license_keys')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated LicenseKey')
      }

      if (this)
        dispatch('licenseKey:updated', model)
      return this.createInstance(model)
    }

    return undefined
  }

  async save(): Promise<LicenseKeyModel> {
    // If the model has an ID, update it; otherwise, create a new record
    if (this.id) {
      // Update existing record
      await DB.instance.updateTable('license_keys')
        .set(this.attributes as LicenseKeyUpdate)
        .where('id', '=', this.id)
        .executeTakeFirst()

      // Get the updated data
      const model = await DB.instance.selectFrom('license_keys')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated LicenseKey')
      }

      if (this)
        dispatch('licenseKey:updated', model)
      return this.createInstance(model)
    }
    else {
      // Create new record
      const result = await DB.instance.insertInto('license_keys')
        .values(this.attributes as NewLicenseKey)
        .executeTakeFirst()

      // Get the created data
      const model = await DB.instance.selectFrom('license_keys')
        .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve created LicenseKey')
      }

      if (this)
        dispatch('licenseKey:created', model)
      return this.createInstance(model)
    }
  }

  static async createMany(newLicenseKey: NewLicenseKey[]): Promise<void> {
    const instance = new LicenseKeyModel(undefined)

    const valuesFiltered = newLicenseKey.map((newLicenseKey: NewLicenseKey) => {
      const filteredValues = Object.fromEntries(
        Object.entries(newLicenseKey).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewLicenseKey

      filteredValues.uuid = randomUUIDv7()

      return filteredValues
    })

    await DB.instance.insertInto('license_keys')
      .values(valuesFiltered)
      .executeTakeFirst()
  }

  static async forceCreate(newLicenseKey: NewLicenseKey): Promise<LicenseKeyModel> {
    const result = await DB.instance.insertInto('license_keys')
      .values(newLicenseKey)
      .executeTakeFirst()

    const instance = new LicenseKeyModel(undefined)
    const model = await DB.instance.selectFrom('license_keys')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created LicenseKey')
    }

    if (model)
      dispatch('licenseKey:created', model)

    return instance.createInstance(model)
  }

  // Method to remove a LicenseKey
  async delete(): Promise<number> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()
    const model = await this.find(Number(this.id))

    if (model)
      dispatch('licenseKey:deleted', model)

    const deleted = await DB.instance.deleteFrom('license_keys')
      .where('id', '=', this.id)
      .execute()

    return deleted.numDeletedRows
  }

  static async remove(id: number): Promise<any> {
    const instance = new LicenseKeyModel(undefined)

    const model = await instance.find(Number(id))

    if (model)
      dispatch('licenseKey:deleted', model)

    return await DB.instance.deleteFrom('license_keys')
      .where('id', '=', id)
      .execute()
  }

  static whereKey(value: string): LicenseKeyModel {
    const instance = new LicenseKeyModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('key', '=', value)

    return instance
  }

  static whereTemplate(value: string): LicenseKeyModel {
    const instance = new LicenseKeyModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('template', '=', value)

    return instance
  }

  static whereExpiryDate(value: string): LicenseKeyModel {
    const instance = new LicenseKeyModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('expiry_date', '=', value)

    return instance
  }

  static whereStatus(value: string): LicenseKeyModel {
    const instance = new LicenseKeyModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('status', '=', value)

    return instance
  }

  static whereIn<V = number>(column: keyof LicenseKeysTable, values: V[]): LicenseKeyModel {
    const instance = new LicenseKeyModel(undefined)

    return instance.applyWhereIn<V>(column, values)
  }

  async customerBelong(): Promise<CustomerModel> {
    if (this.customer_id === undefined)
      throw new HttpError(500, 'Relation Error!')

    const model = await Customer
      .where('id', '=', this.customer_id)
      .first()

    if (!model)
      throw new HttpError(500, 'Model Relation Not Found!')

    return model
  }

  async productBelong(): Promise<ProductModel> {
    if (this.product_id === undefined)
      throw new HttpError(500, 'Relation Error!')

    const model = await Product
      .where('id', '=', this.product_id)
      .first()

    if (!model)
      throw new HttpError(500, 'Model Relation Not Found!')

    return model
  }

  async orderBelong(): Promise<OrderModel> {
    if (this.order_id === undefined)
      throw new HttpError(500, 'Relation Error!')

    const model = await Order
      .where('id', '=', this.order_id)
      .first()

    if (!model)
      throw new HttpError(500, 'Model Relation Not Found!')

    return model
  }

  toSearchableObject(): Partial<LicenseKeyJsonResponse> {
    return {
      id: this.id,
      key: this.key,
      template: this.template,
      expiry_date: this.expiry_date,
      status: this.status,
    }
  }

  static distinct(column: keyof LicenseKeyJsonResponse): LicenseKeyModel {
    const instance = new LicenseKeyModel(undefined)

    return instance.applyDistinct(column)
  }

  static join(table: string, firstCol: string, secondCol: string): LicenseKeyModel {
    const instance = new LicenseKeyModel(undefined)

    return instance.applyJoin(table, firstCol, secondCol)
  }

  toJSON(): LicenseKeyJsonResponse {
    const output = {

      uuid: this.uuid,

      id: this.id,
      key: this.key,
      template: this.template,
      expiry_date: this.expiry_date,
      status: this.status,

      created_at: this.created_at,

      updated_at: this.updated_at,

      customer_id: this.customer_id,
      customer: this.customer,
      product_id: this.product_id,
      product: this.product,
      order_id: this.order_id,
      order: this.order,
      ...this.customColumns,
    }

    return output
  }

  parseResult(model: LicenseKeyModel): LicenseKeyModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof LicenseKeyModel]
    }

    return model
  }

  // Add a protected applyFind implementation
  protected async applyFind(id: number): Promise<LicenseKeyModel | undefined> {
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

export async function find(id: number): Promise<LicenseKeyModel | undefined> {
  const query = DB.instance.selectFrom('license_keys').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  const instance = new LicenseKeyModel(undefined)
  return instance.createInstance(model)
}

export async function count(): Promise<number> {
  const results = await LicenseKeyModel.count()

  return results
}

export async function create(newLicenseKey: NewLicenseKey): Promise<LicenseKeyModel> {
  const instance = new LicenseKeyModel(undefined)
  return await instance.applyCreate(newLicenseKey)
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(DB.instance)
}

export async function remove(id: number): Promise<void> {
  await DB.instance.deleteFrom('license_keys')
    .where('id', '=', id)
    .execute()
}

export async function whereKey(value: string): Promise<LicenseKeyModel[]> {
  const query = DB.instance.selectFrom('license_keys').where('key', '=', value)
  const results: LicenseKeyJsonResponse = await query.execute()

  return results.map((modelItem: LicenseKeyJsonResponse) => new LicenseKeyModel(modelItem))
}

export async function whereTemplate(value: string | string[]): Promise<LicenseKeyModel[]> {
  const query = DB.instance.selectFrom('license_keys').where('template', '=', value)
  const results: LicenseKeyJsonResponse = await query.execute()

  return results.map((modelItem: LicenseKeyJsonResponse) => new LicenseKeyModel(modelItem))
}

export async function whereExpiryDate(value: Date | string): Promise<LicenseKeyModel[]> {
  const query = DB.instance.selectFrom('license_keys').where('expiry_date', '=', value)
  const results: LicenseKeyJsonResponse = await query.execute()

  return results.map((modelItem: LicenseKeyJsonResponse) => new LicenseKeyModel(modelItem))
}

export async function whereStatus(value: string | string[]): Promise<LicenseKeyModel[]> {
  const query = DB.instance.selectFrom('license_keys').where('status', '=', value)
  const results: LicenseKeyJsonResponse = await query.execute()

  return results.map((modelItem: LicenseKeyJsonResponse) => new LicenseKeyModel(modelItem))
}

export const LicenseKey = LicenseKeyModel

export default LicenseKey
