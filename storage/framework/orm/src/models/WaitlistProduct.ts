import type { RawBuilder } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import type { NewWaitlistProduct, WaitlistProductJsonResponse, WaitlistProductsTable, WaitlistProductUpdate } from '../types/WaitlistProductType'
import type { CustomerModel } from './Customer'
import type { ProductModel } from './Product'
import { randomUUIDv7 } from 'bun'
import { sql } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'
import { dispatch } from '@stacksjs/events'
import { DB } from '@stacksjs/orm'

import { BaseOrm } from '../utils/base'

export class WaitlistProductModel extends BaseOrm<WaitlistProductModel, WaitlistProductsTable, WaitlistProductJsonResponse> {
  private readonly hidden: Array<keyof WaitlistProductJsonResponse> = []
  private readonly fillable: Array<keyof WaitlistProductJsonResponse> = ['name', 'email', 'phone', 'quantity', 'notification_preference', 'source', 'notes', 'status', 'notified_at', 'purchased_at', 'cancelled_at', 'uuid', 'customer_id', 'product_id']
  private readonly guarded: Array<keyof WaitlistProductJsonResponse> = []
  protected attributes = {} as WaitlistProductJsonResponse
  protected originalAttributes = {} as WaitlistProductJsonResponse

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

  constructor(waitlistProduct: WaitlistProductJsonResponse | undefined) {
    super('waitlist_products')
    if (waitlistProduct) {
      this.attributes = { ...waitlistProduct }
      this.originalAttributes = { ...waitlistProduct }

      Object.keys(waitlistProduct).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (waitlistProduct as WaitlistProductJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = DB.instance.selectFrom('waitlist_products')
    this.updateFromQuery = DB.instance.updateTable('waitlist_products')
    this.deleteFromQuery = DB.instance.deleteFrom('waitlist_products')
    this.hasSelect = false
  }

  protected async loadRelations(models: WaitlistProductJsonResponse | WaitlistProductJsonResponse[]): Promise<void> {
    // Handle both single model and array of models
    const modelArray = Array.isArray(models) ? models : [models]
    if (!modelArray.length)
      return

    const modelIds = modelArray.map(model => model.id)

    for (const relation of this.withRelations) {
      const relatedRecords = await DB.instance
        .selectFrom(relation)
        .where('waitlistProduct_id', 'in', modelIds)
        .selectAll()
        .execute()

      if (Array.isArray(models)) {
        models.map((model: WaitlistProductJsonResponse) => {
          const records = relatedRecords.filter((record: { waitlistProduct_id: number }) => {
            return record.waitlistProduct_id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      }
      else {
        const records = relatedRecords.filter((record: { waitlistProduct_id: number }) => {
          return record.waitlistProduct_id === models.id
        })

        models[relation] = records.length === 1 ? records[0] : records
      }
    }
  }

  static with(relations: string[]): WaitlistProductModel {
    const instance = new WaitlistProductModel(undefined)

    return instance.applyWith(relations)
  }

  protected mapCustomGetters(models: WaitlistProductJsonResponse | WaitlistProductJsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: WaitlistProductJsonResponse) => {
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

  async mapCustomSetters(model: NewWaitlistProduct): Promise<void> {
    const customSetter = {
      default: () => {
      },

    }

    for (const [key, fn] of Object.entries(customSetter)) {
      (model as any)[key] = await fn()
    }
  }

  get product_id(): number {
    return this.attributes.product_id
  }

  get product(): ProductModel | undefined {
    return this.attributes.product
  }

  get customer_id(): number {
    return this.attributes.customer_id
  }

  get customer(): CustomerModel | undefined {
    return this.attributes.customer
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

  get email(): string {
    return this.attributes.email
  }

  get phone(): string | undefined {
    return this.attributes.phone
  }

  get quantity(): number {
    return this.attributes.quantity
  }

  get notification_preference(): string | string[] {
    return this.attributes.notification_preference
  }

  get source(): string {
    return this.attributes.source
  }

  get notes(): string | undefined {
    return this.attributes.notes
  }

  get status(): string | string[] {
    return this.attributes.status
  }

  get notified_at(): unix | undefined {
    return this.attributes.notified_at
  }

  get purchased_at(): unix | undefined {
    return this.attributes.purchased_at
  }

  get cancelled_at(): unix | undefined {
    return this.attributes.cancelled_at
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

  set email(value: string) {
    this.attributes.email = value
  }

  set phone(value: string) {
    this.attributes.phone = value
  }

  set quantity(value: number) {
    this.attributes.quantity = value
  }

  set notification_preference(value: string | string[]) {
    this.attributes.notification_preference = value
  }

  set source(value: string) {
    this.attributes.source = value
  }

  set notes(value: string) {
    this.attributes.notes = value
  }

  set status(value: string | string[]) {
    this.attributes.status = value
  }

  set notified_at(value: unix) {
    this.attributes.notified_at = value
  }

  set purchased_at(value: unix) {
    this.attributes.purchased_at = value
  }

  set cancelled_at(value: unix) {
    this.attributes.cancelled_at = value
  }

  set updated_at(value: string) {
    this.attributes.updated_at = value
  }

  static select(params: (keyof WaitlistProductJsonResponse)[] | RawBuilder<string> | string): WaitlistProductModel {
    const instance = new WaitlistProductModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a WaitlistProduct by ID
  static async find(id: number): Promise<WaitlistProductModel | undefined> {
    const query = DB.instance.selectFrom('waitlist_products').where('id', '=', id).selectAll()

    const model = await query.executeTakeFirst()

    if (!model)
      return undefined

    const instance = new WaitlistProductModel(undefined)
    return instance.createInstance(model)
  }

  static async first(): Promise<WaitlistProductModel | undefined> {
    const instance = new WaitlistProductModel(undefined)

    const model = await instance.applyFirst()

    const data = new WaitlistProductModel(model)

    return data
  }

  static async last(): Promise<WaitlistProductModel | undefined> {
    const instance = new WaitlistProductModel(undefined)

    const model = await instance.applyLast()

    if (!model)
      return undefined

    return new WaitlistProductModel(model)
  }

  static async firstOrFail(): Promise<WaitlistProductModel | undefined> {
    const instance = new WaitlistProductModel(undefined)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<WaitlistProductModel[]> {
    const instance = new WaitlistProductModel(undefined)

    const models = await DB.instance.selectFrom('waitlist_products').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: WaitlistProductJsonResponse) => {
      return new WaitlistProductModel(model)
    }))

    return data
  }

  static async findOrFail(id: number): Promise<WaitlistProductModel | undefined> {
    const instance = new WaitlistProductModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<WaitlistProductModel[]> {
    const instance = new WaitlistProductModel(undefined)

    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: WaitlistProductJsonResponse) => instance.parseResult(new WaitlistProductModel(modelItem)))
  }

  static async latest(column: keyof WaitlistProductsTable = 'created_at'): Promise<WaitlistProductModel | undefined> {
    const instance = new WaitlistProductModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'desc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new WaitlistProductModel(model)
  }

  static async oldest(column: keyof WaitlistProductsTable = 'created_at'): Promise<WaitlistProductModel | undefined> {
    const instance = new WaitlistProductModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'asc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new WaitlistProductModel(model)
  }

  static skip(count: number): WaitlistProductModel {
    const instance = new WaitlistProductModel(undefined)

    return instance.applySkip(count)
  }

  static take(count: number): WaitlistProductModel {
    const instance = new WaitlistProductModel(undefined)

    return instance.applyTake(count)
  }

  static where<V = string>(column: keyof WaitlistProductsTable, ...args: [V] | [Operator, V]): WaitlistProductModel {
    const instance = new WaitlistProductModel(undefined)

    return instance.applyWhere<V>(column, ...args)
  }

  static orWhere(...conditions: [string, any][]): WaitlistProductModel {
    const instance = new WaitlistProductModel(undefined)

    return instance.applyOrWhere(...conditions)
  }

  static whereNotIn<V = number>(column: keyof WaitlistProductsTable, values: V[]): WaitlistProductModel {
    const instance = new WaitlistProductModel(undefined)

    return instance.applyWhereNotIn<V>(column, values)
  }

  static whereBetween<V = number>(column: keyof WaitlistProductsTable, range: [V, V]): WaitlistProductModel {
    const instance = new WaitlistProductModel(undefined)

    return instance.applyWhereBetween<V>(column, range)
  }

  static whereRef(column: keyof WaitlistProductsTable, ...args: string[]): WaitlistProductModel {
    const instance = new WaitlistProductModel(undefined)

    return instance.applyWhereRef(column, ...args)
  }

  static when(condition: boolean, callback: (query: WaitlistProductModel) => WaitlistProductModel): WaitlistProductModel {
    const instance = new WaitlistProductModel(undefined)

    return instance.applyWhen(condition, callback as any)
  }

  static whereNull(column: keyof WaitlistProductsTable): WaitlistProductModel {
    const instance = new WaitlistProductModel(undefined)

    return instance.applyWhereNull(column)
  }

  static whereNotNull(column: keyof WaitlistProductsTable): WaitlistProductModel {
    const instance = new WaitlistProductModel(undefined)

    return instance.applyWhereNotNull(column)
  }

  static whereLike(column: keyof WaitlistProductsTable, value: string): WaitlistProductModel {
    const instance = new WaitlistProductModel(undefined)

    return instance.applyWhereLike(column, value)
  }

  static orderBy(column: keyof WaitlistProductsTable, order: 'asc' | 'desc'): WaitlistProductModel {
    const instance = new WaitlistProductModel(undefined)

    return instance.applyOrderBy(column, order)
  }

  static orderByAsc(column: keyof WaitlistProductsTable): WaitlistProductModel {
    const instance = new WaitlistProductModel(undefined)

    return instance.applyOrderByAsc(column)
  }

  static orderByDesc(column: keyof WaitlistProductsTable): WaitlistProductModel {
    const instance = new WaitlistProductModel(undefined)

    return instance.applyOrderByDesc(column)
  }

  static groupBy(column: keyof WaitlistProductsTable): WaitlistProductModel {
    const instance = new WaitlistProductModel(undefined)

    return instance.applyGroupBy(column)
  }

  static having<V = string>(column: keyof WaitlistProductsTable, operator: Operator, value: V): WaitlistProductModel {
    const instance = new WaitlistProductModel(undefined)

    return instance.applyHaving<V>(column, operator, value)
  }

  static inRandomOrder(): WaitlistProductModel {
    const instance = new WaitlistProductModel(undefined)

    return instance.applyInRandomOrder()
  }

  static whereColumn(first: keyof WaitlistProductsTable, operator: Operator, second: keyof WaitlistProductsTable): WaitlistProductModel {
    const instance = new WaitlistProductModel(undefined)

    return instance.applyWhereColumn(first, operator, second)
  }

  static async max(field: keyof WaitlistProductsTable): Promise<number> {
    const instance = new WaitlistProductModel(undefined)

    return await instance.applyMax(field)
  }

  static async min(field: keyof WaitlistProductsTable): Promise<number> {
    const instance = new WaitlistProductModel(undefined)

    return await instance.applyMin(field)
  }

  static async avg(field: keyof WaitlistProductsTable): Promise<number> {
    const instance = new WaitlistProductModel(undefined)

    return await instance.applyAvg(field)
  }

  static async sum(field: keyof WaitlistProductsTable): Promise<number> {
    const instance = new WaitlistProductModel(undefined)

    return await instance.applySum(field)
  }

  static async count(): Promise<number> {
    const instance = new WaitlistProductModel(undefined)

    return instance.applyCount()
  }

  static async get(): Promise<WaitlistProductModel[]> {
    const instance = new WaitlistProductModel(undefined)

    const results = await instance.applyGet()

    return results.map((item: WaitlistProductJsonResponse) => instance.createInstance(item))
  }

  static async pluck<K extends keyof WaitlistProductModel>(field: K): Promise<WaitlistProductModel[K][]> {
    const instance = new WaitlistProductModel(undefined)

    return await instance.applyPluck(field)
  }

  static async chunk(size: number, callback: (models: WaitlistProductModel[]) => Promise<void>): Promise<void> {
    const instance = new WaitlistProductModel(undefined)

    await instance.applyChunk(size, async (models) => {
      const modelInstances = models.map((item: WaitlistProductJsonResponse) => instance.createInstance(item))
      await callback(modelInstances)
    })
  }

  static async paginate(options: { limit?: number, offset?: number, page?: number } = { limit: 10, offset: 0, page: 1 }): Promise<{
    data: WaitlistProductModel[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }> {
    const instance = new WaitlistProductModel(undefined)

    const result = await instance.applyPaginate(options)

    return {
      data: result.data.map((item: WaitlistProductJsonResponse) => instance.createInstance(item)),
      paging: result.paging,
      next_cursor: result.next_cursor,
    }
  }

  // Instance method for creating model instances
  createInstance(data: WaitlistProductJsonResponse): WaitlistProductModel {
    return new WaitlistProductModel(data)
  }

  async applyCreate(newWaitlistProduct: NewWaitlistProduct): Promise<WaitlistProductModel> {
    const filteredValues = Object.fromEntries(
      Object.entries(newWaitlistProduct).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewWaitlistProduct

    await this.mapCustomSetters(filteredValues)

    filteredValues.uuid = randomUUIDv7()

    const result = await DB.instance.insertInto('waitlist_products')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await DB.instance.selectFrom('waitlist_products')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created WaitlistProduct')
    }

    if (model)
      dispatch('waitlistProduct:created', model)
    return this.createInstance(model)
  }

  async create(newWaitlistProduct: NewWaitlistProduct): Promise<WaitlistProductModel> {
    return await this.applyCreate(newWaitlistProduct)
  }

  static async create(newWaitlistProduct: NewWaitlistProduct): Promise<WaitlistProductModel> {
    const instance = new WaitlistProductModel(undefined)
    return await instance.applyCreate(newWaitlistProduct)
  }

  static async firstOrCreate(search: Partial<WaitlistProductsTable>, values: NewWaitlistProduct = {} as NewWaitlistProduct): Promise<WaitlistProductModel> {
    // First try to find a record matching the search criteria
    const instance = new WaitlistProductModel(undefined)

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
    const createData = { ...search, ...values } as NewWaitlistProduct
    return await WaitlistProductModel.create(createData)
  }

  static async updateOrCreate(search: Partial<WaitlistProductsTable>, values: NewWaitlistProduct = {} as NewWaitlistProduct): Promise<WaitlistProductModel> {
    // First try to find a record matching the search criteria
    const instance = new WaitlistProductModel(undefined)

    // Apply all search conditions
    for (const [key, value] of Object.entries(search)) {
      instance.selectFromQuery = instance.selectFromQuery.where(key, '=', value)
    }

    // Try to find the record
    const existingRecord = await instance.applyFirst()

    if (existingRecord) {
      // If record exists, update it with the new values
      const model = instance.createInstance(existingRecord)
      const updatedModel = await model.update(values as WaitlistProductUpdate)

      // Return the updated model instance
      if (updatedModel) {
        return updatedModel
      }

      // If update didn't return a model, fetch it again to ensure we have latest data
      const refreshedModel = await instance.applyFirst()
      return instance.createInstance(refreshedModel!)
    }

    // If no record exists, create a new one with combined search criteria and values
    const createData = { ...search, ...values } as NewWaitlistProduct
    return await WaitlistProductModel.create(createData)
  }

  async update(newWaitlistProduct: WaitlistProductUpdate): Promise<WaitlistProductModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newWaitlistProduct).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as WaitlistProductUpdate

    await this.mapCustomSetters(filteredValues)

    filteredValues.updated_at = new Date().toISOString()

    await DB.instance.updateTable('waitlist_products')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('waitlist_products')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated WaitlistProduct')
      }

      if (model)
        dispatch('waitlistProduct:updated', model)
      return this.createInstance(model)
    }

    return undefined
  }

  async forceUpdate(newWaitlistProduct: WaitlistProductUpdate): Promise<WaitlistProductModel | undefined> {
    await DB.instance.updateTable('waitlist_products')
      .set(newWaitlistProduct)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('waitlist_products')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated WaitlistProduct')
      }

      if (this)
        dispatch('waitlistProduct:updated', model)
      return this.createInstance(model)
    }

    return undefined
  }

  async save(): Promise<WaitlistProductModel> {
    // If the model has an ID, update it; otherwise, create a new record
    if (this.id) {
      // Update existing record
      await DB.instance.updateTable('waitlist_products')
        .set(this.attributes as WaitlistProductUpdate)
        .where('id', '=', this.id)
        .executeTakeFirst()

      // Get the updated data
      const model = await DB.instance.selectFrom('waitlist_products')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated WaitlistProduct')
      }

      if (this)
        dispatch('waitlistProduct:updated', model)
      return this.createInstance(model)
    }
    else {
      // Create new record
      const result = await DB.instance.insertInto('waitlist_products')
        .values(this.attributes as NewWaitlistProduct)
        .executeTakeFirst()

      // Get the created data
      const model = await DB.instance.selectFrom('waitlist_products')
        .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve created WaitlistProduct')
      }

      if (this)
        dispatch('waitlistProduct:created', model)
      return this.createInstance(model)
    }
  }

  static async createMany(newWaitlistProduct: NewWaitlistProduct[]): Promise<void> {
    const instance = new WaitlistProductModel(undefined)

    const valuesFiltered = newWaitlistProduct.map((newWaitlistProduct: NewWaitlistProduct) => {
      const filteredValues = Object.fromEntries(
        Object.entries(newWaitlistProduct).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewWaitlistProduct

      filteredValues.uuid = randomUUIDv7()

      return filteredValues
    })

    await DB.instance.insertInto('waitlist_products')
      .values(valuesFiltered)
      .executeTakeFirst()
  }

  static async forceCreate(newWaitlistProduct: NewWaitlistProduct): Promise<WaitlistProductModel> {
    const result = await DB.instance.insertInto('waitlist_products')
      .values(newWaitlistProduct)
      .executeTakeFirst()

    const instance = new WaitlistProductModel(undefined)
    const model = await DB.instance.selectFrom('waitlist_products')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created WaitlistProduct')
    }

    if (model)
      dispatch('waitlistProduct:created', model)

    return instance.createInstance(model)
  }

  // Method to remove a WaitlistProduct
  async delete(): Promise<number> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()
    const model = await this.find(Number(this.id))

    if (model)
      dispatch('waitlistProduct:deleted', model)

    const deleted = await DB.instance.deleteFrom('waitlist_products')
      .where('id', '=', this.id)
      .execute()

    return deleted.numDeletedRows
  }

  static async remove(id: number): Promise<any> {
    const instance = new WaitlistProductModel(undefined)

    const model = await instance.find(Number(id))

    if (model)
      dispatch('waitlistProduct:deleted', model)

    return await DB.instance.deleteFrom('waitlist_products')
      .where('id', '=', id)
      .execute()
  }

  static whereName(value: string): WaitlistProductModel {
    const instance = new WaitlistProductModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('name', '=', value)

    return instance
  }

  static whereEmail(value: string): WaitlistProductModel {
    const instance = new WaitlistProductModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('email', '=', value)

    return instance
  }

  static wherePhone(value: string): WaitlistProductModel {
    const instance = new WaitlistProductModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('phone', '=', value)

    return instance
  }

  static whereQuantity(value: string): WaitlistProductModel {
    const instance = new WaitlistProductModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('quantity', '=', value)

    return instance
  }

  static whereNotificationPreference(value: string): WaitlistProductModel {
    const instance = new WaitlistProductModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('notification_preference', '=', value)

    return instance
  }

  static whereSource(value: string): WaitlistProductModel {
    const instance = new WaitlistProductModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('source', '=', value)

    return instance
  }

  static whereNotes(value: string): WaitlistProductModel {
    const instance = new WaitlistProductModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('notes', '=', value)

    return instance
  }

  static whereStatus(value: string): WaitlistProductModel {
    const instance = new WaitlistProductModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('status', '=', value)

    return instance
  }

  static whereNotifiedAt(value: string): WaitlistProductModel {
    const instance = new WaitlistProductModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('notified_at', '=', value)

    return instance
  }

  static wherePurchasedAt(value: string): WaitlistProductModel {
    const instance = new WaitlistProductModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('purchased_at', '=', value)

    return instance
  }

  static whereCancelledAt(value: string): WaitlistProductModel {
    const instance = new WaitlistProductModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('cancelled_at', '=', value)

    return instance
  }

  static whereIn<V = number>(column: keyof WaitlistProductsTable, values: V[]): WaitlistProductModel {
    const instance = new WaitlistProductModel(undefined)

    return instance.applyWhereIn<V>(column, values)
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

  toSearchableObject(): Partial<WaitlistProductJsonResponse> {
    return {
      id: this.id,
      name: this.name,
      email: this.email,
      phone: this.phone,
      party_size: this.party_size,
      notification_preference: this.notification_preference,
      source: this.source,
      notes: this.notes,
      status: this.status,
    }
  }

  static distinct(column: keyof WaitlistProductJsonResponse): WaitlistProductModel {
    const instance = new WaitlistProductModel(undefined)

    return instance.applyDistinct(column)
  }

  static join(table: string, firstCol: string, secondCol: string): WaitlistProductModel {
    const instance = new WaitlistProductModel(undefined)

    return instance.applyJoin(table, firstCol, secondCol)
  }

  toJSON(): WaitlistProductJsonResponse {
    const output = {

      uuid: this.uuid,

      id: this.id,
      name: this.name,
      email: this.email,
      phone: this.phone,
      quantity: this.quantity,
      notification_preference: this.notification_preference,
      source: this.source,
      notes: this.notes,
      status: this.status,
      notified_at: this.notified_at,
      purchased_at: this.purchased_at,
      cancelled_at: this.cancelled_at,

      created_at: this.created_at,

      updated_at: this.updated_at,

      product_id: this.product_id,
      product: this.product,
      customer_id: this.customer_id,
      customer: this.customer,
      ...this.customColumns,
    }

    return output
  }

  parseResult(model: WaitlistProductModel): WaitlistProductModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof WaitlistProductModel]
    }

    return model
  }

  // Add a protected applyFind implementation
  protected async applyFind(id: number): Promise<WaitlistProductModel | undefined> {
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

export async function find(id: number): Promise<WaitlistProductModel | undefined> {
  const query = DB.instance.selectFrom('waitlist_products').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  const instance = new WaitlistProductModel(undefined)
  return instance.createInstance(model)
}

export async function count(): Promise<number> {
  const results = await WaitlistProductModel.count()

  return results
}

export async function create(newWaitlistProduct: NewWaitlistProduct): Promise<WaitlistProductModel> {
  const instance = new WaitlistProductModel(undefined)
  return await instance.applyCreate(newWaitlistProduct)
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(DB.instance)
}

export async function remove(id: number): Promise<void> {
  await DB.instance.deleteFrom('waitlist_products')
    .where('id', '=', id)
    .execute()
}

export async function whereName(value: string): Promise<WaitlistProductModel[]> {
  const query = DB.instance.selectFrom('waitlist_products').where('name', '=', value)
  const results: WaitlistProductJsonResponse = await query.execute()

  return results.map((modelItem: WaitlistProductJsonResponse) => new WaitlistProductModel(modelItem))
}

export async function whereEmail(value: string): Promise<WaitlistProductModel[]> {
  const query = DB.instance.selectFrom('waitlist_products').where('email', '=', value)
  const results: WaitlistProductJsonResponse = await query.execute()

  return results.map((modelItem: WaitlistProductJsonResponse) => new WaitlistProductModel(modelItem))
}

export async function wherePhone(value: string): Promise<WaitlistProductModel[]> {
  const query = DB.instance.selectFrom('waitlist_products').where('phone', '=', value)
  const results: WaitlistProductJsonResponse = await query.execute()

  return results.map((modelItem: WaitlistProductJsonResponse) => new WaitlistProductModel(modelItem))
}

export async function whereQuantity(value: number): Promise<WaitlistProductModel[]> {
  const query = DB.instance.selectFrom('waitlist_products').where('quantity', '=', value)
  const results: WaitlistProductJsonResponse = await query.execute()

  return results.map((modelItem: WaitlistProductJsonResponse) => new WaitlistProductModel(modelItem))
}

export async function whereNotificationPreference(value: string | string[]): Promise<WaitlistProductModel[]> {
  const query = DB.instance.selectFrom('waitlist_products').where('notification_preference', '=', value)
  const results: WaitlistProductJsonResponse = await query.execute()

  return results.map((modelItem: WaitlistProductJsonResponse) => new WaitlistProductModel(modelItem))
}

export async function whereSource(value: string): Promise<WaitlistProductModel[]> {
  const query = DB.instance.selectFrom('waitlist_products').where('source', '=', value)
  const results: WaitlistProductJsonResponse = await query.execute()

  return results.map((modelItem: WaitlistProductJsonResponse) => new WaitlistProductModel(modelItem))
}

export async function whereNotes(value: string): Promise<WaitlistProductModel[]> {
  const query = DB.instance.selectFrom('waitlist_products').where('notes', '=', value)
  const results: WaitlistProductJsonResponse = await query.execute()

  return results.map((modelItem: WaitlistProductJsonResponse) => new WaitlistProductModel(modelItem))
}

export async function whereStatus(value: string | string[]): Promise<WaitlistProductModel[]> {
  const query = DB.instance.selectFrom('waitlist_products').where('status', '=', value)
  const results: WaitlistProductJsonResponse = await query.execute()

  return results.map((modelItem: WaitlistProductJsonResponse) => new WaitlistProductModel(modelItem))
}

export async function whereNotifiedAt(value: unix): Promise<WaitlistProductModel[]> {
  const query = DB.instance.selectFrom('waitlist_products').where('notified_at', '=', value)
  const results: WaitlistProductJsonResponse = await query.execute()

  return results.map((modelItem: WaitlistProductJsonResponse) => new WaitlistProductModel(modelItem))
}

export async function wherePurchasedAt(value: unix): Promise<WaitlistProductModel[]> {
  const query = DB.instance.selectFrom('waitlist_products').where('purchased_at', '=', value)
  const results: WaitlistProductJsonResponse = await query.execute()

  return results.map((modelItem: WaitlistProductJsonResponse) => new WaitlistProductModel(modelItem))
}

export async function whereCancelledAt(value: unix): Promise<WaitlistProductModel[]> {
  const query = DB.instance.selectFrom('waitlist_products').where('cancelled_at', '=', value)
  const results: WaitlistProductJsonResponse = await query.execute()

  return results.map((modelItem: WaitlistProductJsonResponse) => new WaitlistProductModel(modelItem))
}

export const WaitlistProduct = WaitlistProductModel

export default WaitlistProduct
