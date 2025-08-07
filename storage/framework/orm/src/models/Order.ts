import type { RawBuilder } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import type { NewOrder, OrderJsonResponse, OrdersTable, OrderUpdate } from '../types/OrderType'
import type { CouponModel } from './Coupon'
import type { CustomerModel } from './Customer'
import type { LicenseKeyModel } from './LicenseKey'
import type { OrderItemModel } from './OrderItem'
import type { PaymentModel } from './Payment'
import { randomUUIDv7 } from 'bun'
import { sql } from '@stacksjs/database'

import { HttpError } from '@stacksjs/error-handling'

import { dispatch } from '@stacksjs/events'

import { DB } from '@stacksjs/orm'

import { BaseOrm } from '../utils/base'

export class OrderModel extends BaseOrm<OrderModel, OrdersTable, OrderJsonResponse> {
  private readonly hidden: Array<keyof OrderJsonResponse> = []
  private readonly fillable: Array<keyof OrderJsonResponse> = ['status', 'total_amount', 'tax_amount', 'discount_amount', 'delivery_fee', 'tip_amount', 'order_type', 'delivery_address', 'special_instructions', 'estimated_delivery_time', 'applied_coupon_id', 'uuid', 'customer_id', 'gift_card_id', 'coupon_id']
  private readonly guarded: Array<keyof OrderJsonResponse> = []
  protected attributes = {} as OrderJsonResponse
  protected originalAttributes = {} as OrderJsonResponse

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

  constructor(order: OrderJsonResponse | undefined) {
    super('orders')
    if (order) {
      this.attributes = { ...order }
      this.originalAttributes = { ...order }

      Object.keys(order).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (order as OrderJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = DB.instance.selectFrom('orders')
    this.updateFromQuery = DB.instance.updateTable('orders')
    this.deleteFromQuery = DB.instance.deleteFrom('orders')
    this.hasSelect = false
  }

  protected async loadRelations(models: OrderJsonResponse | OrderJsonResponse[]): Promise<void> {
    // Handle both single model and array of models
    const modelArray = Array.isArray(models) ? models : [models]
    if (!modelArray.length)
      return

    const modelIds = modelArray.map(model => model.id)

    for (const relation of this.withRelations) {
      const relatedRecords = await DB.instance
        .selectFrom(relation)
        .where('order_id', 'in', modelIds)
        .selectAll()
        .execute()

      if (Array.isArray(models)) {
        models.map((model: OrderJsonResponse) => {
          const records = relatedRecords.filter((record: { order_id: number }) => {
            return record.order_id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      }
      else {
        const records = relatedRecords.filter((record: { order_id: number }) => {
          return record.order_id === models.id
        })

        models[relation] = records.length === 1 ? records[0] : records
      }
    }
  }

  static with(relations: string[]): OrderModel {
    const instance = new OrderModel(undefined)

    return instance.applyWith(relations)
  }

  protected mapCustomGetters(models: OrderJsonResponse | OrderJsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: OrderJsonResponse) => {
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

  async mapCustomSetters(model: NewOrder | OrderUpdate): Promise<void> {
    const customSetter = {
      default: () => {
      },

    }

    for (const [key, fn] of Object.entries(customSetter)) {
      (model as any)[key] = await fn()
    }
  }

  get order_items(): OrderItemModel[] | [] {
    return this.attributes.order_items
  }

  get payments(): PaymentModel[] | [] {
    return this.attributes.payments
  }

  get license_keys(): LicenseKeyModel[] | [] {
    return this.attributes.license_keys
  }

  get customer_id(): number {
    return this.attributes.customer_id
  }

  get customer(): CustomerModel | undefined {
    return this.attributes.customer
  }

  get coupon_id(): number {
    return this.attributes.coupon_id
  }

  get coupon(): CouponModel | undefined {
    return this.attributes.coupon
  }

  get id(): number {
    return this.attributes.id
  }

  get uuid(): string | undefined {
    return this.attributes.uuid
  }

  get status(): string {
    return this.attributes.status
  }

  get total_amount(): number {
    return this.attributes.total_amount
  }

  get tax_amount(): number | undefined {
    return this.attributes.tax_amount
  }

  get discount_amount(): number | undefined {
    return this.attributes.discount_amount
  }

  get delivery_fee(): number | undefined {
    return this.attributes.delivery_fee
  }

  get tip_amount(): number | undefined {
    return this.attributes.tip_amount
  }

  get order_type(): string {
    return this.attributes.order_type
  }

  get delivery_address(): string | undefined {
    return this.attributes.delivery_address
  }

  get special_instructions(): string | undefined {
    return this.attributes.special_instructions
  }

  get estimated_delivery_time(): string | undefined {
    return this.attributes.estimated_delivery_time
  }

  get applied_coupon_id(): string | undefined {
    return this.attributes.applied_coupon_id
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

  set status(value: string) {
    this.attributes.status = value
  }

  set total_amount(value: number) {
    this.attributes.total_amount = value
  }

  set tax_amount(value: number) {
    this.attributes.tax_amount = value
  }

  set discount_amount(value: number) {
    this.attributes.discount_amount = value
  }

  set delivery_fee(value: number) {
    this.attributes.delivery_fee = value
  }

  set tip_amount(value: number) {
    this.attributes.tip_amount = value
  }

  set order_type(value: string) {
    this.attributes.order_type = value
  }

  set delivery_address(value: string) {
    this.attributes.delivery_address = value
  }

  set special_instructions(value: string) {
    this.attributes.special_instructions = value
  }

  set estimated_delivery_time(value: string) {
    this.attributes.estimated_delivery_time = value
  }

  set applied_coupon_id(value: string) {
    this.attributes.applied_coupon_id = value
  }

  set updated_at(value: string) {
    this.attributes.updated_at = value
  }

  static select(params: (keyof OrderJsonResponse)[] | RawBuilder<string> | string): OrderModel {
    const instance = new OrderModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a Order by ID
  static async find(id: number): Promise<OrderModel | undefined> {
    const query = DB.instance.selectFrom('orders').where('id', '=', id).selectAll()

    const model = await query.executeTakeFirst()

    if (!model)
      return undefined

    const instance = new OrderModel(undefined)
    return instance.createInstance(model)
  }

  static async first(): Promise<OrderModel | undefined> {
    const instance = new OrderModel(undefined)

    const model = await instance.applyFirst()

    const data = new OrderModel(model)

    return data
  }

  static async last(): Promise<OrderModel | undefined> {
    const instance = new OrderModel(undefined)

    const model = await instance.applyLast()

    if (!model)
      return undefined

    return new OrderModel(model)
  }

  static async firstOrFail(): Promise<OrderModel | undefined> {
    const instance = new OrderModel(undefined)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<OrderModel[]> {
    const instance = new OrderModel(undefined)

    const models = await DB.instance.selectFrom('orders').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: OrderJsonResponse) => {
      return new OrderModel(model)
    }))

    return data
  }

  static async findOrFail(id: number): Promise<OrderModel | undefined> {
    const instance = new OrderModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<OrderModel[]> {
    const instance = new OrderModel(undefined)

    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: OrderJsonResponse) => instance.parseResult(new OrderModel(modelItem)))
  }

  static async latest(column: keyof OrdersTable = 'created_at'): Promise<OrderModel | undefined> {
    const instance = new OrderModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'desc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new OrderModel(model)
  }

  static async oldest(column: keyof OrdersTable = 'created_at'): Promise<OrderModel | undefined> {
    const instance = new OrderModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'asc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new OrderModel(model)
  }

  static skip(count: number): OrderModel {
    const instance = new OrderModel(undefined)

    return instance.applySkip(count)
  }

  static take(count: number): OrderModel {
    const instance = new OrderModel(undefined)

    return instance.applyTake(count)
  }

  static where<V = string>(column: keyof OrdersTable, ...args: [V] | [Operator, V]): OrderModel {
    const instance = new OrderModel(undefined)

    return instance.applyWhere<V>(column, ...args)
  }

  static orWhere(...conditions: [string, any][]): OrderModel {
    const instance = new OrderModel(undefined)

    return instance.applyOrWhere(...conditions)
  }

  static whereNotIn<V = number>(column: keyof OrdersTable, values: V[]): OrderModel {
    const instance = new OrderModel(undefined)

    return instance.applyWhereNotIn<V>(column, values)
  }

  static whereBetween<V = number>(column: keyof OrdersTable, range: [V, V]): OrderModel {
    const instance = new OrderModel(undefined)

    return instance.applyWhereBetween<V>(column, range)
  }

  static whereRef(column: keyof OrdersTable, ...args: string[]): OrderModel {
    const instance = new OrderModel(undefined)

    return instance.applyWhereRef(column, ...args)
  }

  static when(condition: boolean, callback: (query: OrderModel) => OrderModel): OrderModel {
    const instance = new OrderModel(undefined)

    return instance.applyWhen(condition, callback as any)
  }

  static whereNull(column: keyof OrdersTable): OrderModel {
    const instance = new OrderModel(undefined)

    return instance.applyWhereNull(column)
  }

  static whereNotNull(column: keyof OrdersTable): OrderModel {
    const instance = new OrderModel(undefined)

    return instance.applyWhereNotNull(column)
  }

  static whereLike(column: keyof OrdersTable, value: string): OrderModel {
    const instance = new OrderModel(undefined)

    return instance.applyWhereLike(column, value)
  }

  static orderBy(column: keyof OrdersTable, order: 'asc' | 'desc'): OrderModel {
    const instance = new OrderModel(undefined)

    return instance.applyOrderBy(column, order)
  }

  static orderByAsc(column: keyof OrdersTable): OrderModel {
    const instance = new OrderModel(undefined)

    return instance.applyOrderByAsc(column)
  }

  static orderByDesc(column: keyof OrdersTable): OrderModel {
    const instance = new OrderModel(undefined)

    return instance.applyOrderByDesc(column)
  }

  static groupBy(column: keyof OrdersTable): OrderModel {
    const instance = new OrderModel(undefined)

    return instance.applyGroupBy(column)
  }

  static having<V = string>(column: keyof OrdersTable, operator: Operator, value: V): OrderModel {
    const instance = new OrderModel(undefined)

    return instance.applyHaving<V>(column, operator, value)
  }

  static inRandomOrder(): OrderModel {
    const instance = new OrderModel(undefined)

    return instance.applyInRandomOrder()
  }

  static whereColumn(first: keyof OrdersTable, operator: Operator, second: keyof OrdersTable): OrderModel {
    const instance = new OrderModel(undefined)

    return instance.applyWhereColumn(first, operator, second)
  }

  static async max(field: keyof OrdersTable): Promise<number> {
    const instance = new OrderModel(undefined)

    return await instance.applyMax(field)
  }

  static async min(field: keyof OrdersTable): Promise<number> {
    const instance = new OrderModel(undefined)

    return await instance.applyMin(field)
  }

  static async avg(field: keyof OrdersTable): Promise<number> {
    const instance = new OrderModel(undefined)

    return await instance.applyAvg(field)
  }

  static async sum(field: keyof OrdersTable): Promise<number> {
    const instance = new OrderModel(undefined)

    return await instance.applySum(field)
  }

  static async count(): Promise<number> {
    const instance = new OrderModel(undefined)

    return instance.applyCount()
  }

  static async get(): Promise<OrderModel[]> {
    const instance = new OrderModel(undefined)

    const results = await instance.applyGet()

    return results.map((item: OrderJsonResponse) => instance.createInstance(item))
  }

  static async pluck<K extends keyof OrderModel>(field: K): Promise<OrderModel[K][]> {
    const instance = new OrderModel(undefined)

    return await instance.applyPluck(field)
  }

  static async chunk(size: number, callback: (models: OrderModel[]) => Promise<void>): Promise<void> {
    const instance = new OrderModel(undefined)

    await instance.applyChunk(size, async (models) => {
      const modelInstances = models.map((item: OrderJsonResponse) => instance.createInstance(item))
      await callback(modelInstances)
    })
  }

  static async paginate(options: { limit?: number, offset?: number, page?: number } = { limit: 10, offset: 0, page: 1 }): Promise<{
    data: OrderModel[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }> {
    const instance = new OrderModel(undefined)

    const result = await instance.applyPaginate(options)

    return {
      data: result.data.map((item: OrderJsonResponse) => instance.createInstance(item)),
      paging: result.paging,
      next_cursor: result.next_cursor,
    }
  }

  // Instance method for creating model instances
  createInstance(data: OrderJsonResponse): OrderModel {
    return new OrderModel(data)
  }

  async applyCreate(newOrder: NewOrder): Promise<OrderModel> {
    const filteredValues = Object.fromEntries(
      Object.entries(newOrder).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewOrder

    await this.mapCustomSetters(filteredValues)

    filteredValues.uuid = randomUUIDv7()

    const result = await DB.instance.insertInto('orders')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await DB.instance.selectFrom('orders')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created Order')
    }

    if (model)
      dispatch('order:created', model)
    return this.createInstance(model)
  }

  async create(newOrder: NewOrder): Promise<OrderModel> {
    return await this.applyCreate(newOrder)
  }

  static async create(newOrder: NewOrder): Promise<OrderModel> {
    const instance = new OrderModel(undefined)
    return await instance.applyCreate(newOrder)
  }

  static async firstOrCreate(search: Partial<OrdersTable>, values: NewOrder = {} as NewOrder): Promise<OrderModel> {
    // First try to find a record matching the search criteria
    const instance = new OrderModel(undefined)

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
    const createData = { ...search, ...values } as NewOrder
    return await OrderModel.create(createData)
  }

  static async updateOrCreate(search: Partial<OrdersTable>, values: NewOrder = {} as NewOrder): Promise<OrderModel> {
    // First try to find a record matching the search criteria
    const instance = new OrderModel(undefined)

    // Apply all search conditions
    for (const [key, value] of Object.entries(search)) {
      instance.selectFromQuery = instance.selectFromQuery.where(key, '=', value)
    }

    // Try to find the record
    const existingRecord = await instance.applyFirst()

    if (existingRecord) {
      // If record exists, update it with the new values
      const model = instance.createInstance(existingRecord)
      const updatedModel = await model.update(values as OrderUpdate)

      // Return the updated model instance
      if (updatedModel) {
        return updatedModel
      }

      // If update didn't return a model, fetch it again to ensure we have latest data
      const refreshedModel = await instance.applyFirst()
      return instance.createInstance(refreshedModel!)
    }

    // If no record exists, create a new one with combined search criteria and values
    const createData = { ...search, ...values } as NewOrder
    return await OrderModel.create(createData)
  }

  async update(newOrder: OrderUpdate): Promise<OrderModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newOrder).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as OrderUpdate

    await this.mapCustomSetters(filteredValues)

    filteredValues.updated_at = new Date().toISOString()

    await DB.instance.updateTable('orders')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('orders')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated Order')
      }

      if (model)
        dispatch('order:updated', model)
      return this.createInstance(model)
    }

    return undefined
  }

  async forceUpdate(newOrder: OrderUpdate): Promise<OrderModel | undefined> {
    await DB.instance.updateTable('orders')
      .set(newOrder)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('orders')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated Order')
      }

      if (this)
        dispatch('order:updated', model)
      return this.createInstance(model)
    }

    return undefined
  }

  async save(): Promise<OrderModel> {
    // If the model has an ID, update it; otherwise, create a new record
    if (this.id) {
      // Update existing record
      await DB.instance.updateTable('orders')
        .set(this.attributes as OrderUpdate)
        .where('id', '=', this.id)
        .executeTakeFirst()

      // Get the updated data
      const model = await DB.instance.selectFrom('orders')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated Order')
      }

      if (this)
        dispatch('order:updated', model)
      return this.createInstance(model)
    }
    else {
      // Create new record
      const result = await DB.instance.insertInto('orders')
        .values(this.attributes as NewOrder)
        .executeTakeFirst()

      // Get the created data
      const model = await DB.instance.selectFrom('orders')
        .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve created Order')
      }

      if (this)
        dispatch('order:created', model)
      return this.createInstance(model)
    }
  }

  static async createMany(newOrder: NewOrder[]): Promise<void> {
    const instance = new OrderModel(undefined)

    const valuesFiltered = newOrder.map((newOrder: NewOrder) => {
      const filteredValues = Object.fromEntries(
        Object.entries(newOrder).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewOrder

      filteredValues.uuid = randomUUIDv7()

      return filteredValues
    })

    await DB.instance.insertInto('orders')
      .values(valuesFiltered)
      .executeTakeFirst()
  }

  static async forceCreate(newOrder: NewOrder): Promise<OrderModel> {
    const result = await DB.instance.insertInto('orders')
      .values(newOrder)
      .executeTakeFirst()

    const instance = new OrderModel(undefined)
    const model = await DB.instance.selectFrom('orders')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created Order')
    }

    if (model)
      dispatch('order:created', model)

    return instance.createInstance(model)
  }

  // Method to remove a Order
  async delete(): Promise<number> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()
    const model = await this.find(Number(this.id))

    if (model)
      dispatch('order:deleted', model)

    const deleted = await DB.instance.deleteFrom('orders')
      .where('id', '=', this.id)
      .execute()

    return deleted.numDeletedRows
  }

  static async remove(id: number): Promise<any> {
    const instance = new OrderModel(undefined)

    const model = await instance.find(Number(id))

    if (model)
      dispatch('order:deleted', model)

    return await DB.instance.deleteFrom('orders')
      .where('id', '=', id)
      .execute()
  }

  static whereStatus(value: string): OrderModel {
    const instance = new OrderModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('status', '=', value)

    return instance
  }

  static whereTotalAmount(value: string): OrderModel {
    const instance = new OrderModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('total_amount', '=', value)

    return instance
  }

  static whereTaxAmount(value: string): OrderModel {
    const instance = new OrderModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('tax_amount', '=', value)

    return instance
  }

  static whereDiscountAmount(value: string): OrderModel {
    const instance = new OrderModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('discount_amount', '=', value)

    return instance
  }

  static whereDeliveryFee(value: string): OrderModel {
    const instance = new OrderModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('delivery_fee', '=', value)

    return instance
  }

  static whereTipAmount(value: string): OrderModel {
    const instance = new OrderModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('tip_amount', '=', value)

    return instance
  }

  static whereOrderType(value: string): OrderModel {
    const instance = new OrderModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('order_type', '=', value)

    return instance
  }

  static whereDeliveryAddress(value: string): OrderModel {
    const instance = new OrderModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('delivery_address', '=', value)

    return instance
  }

  static whereSpecialInstructions(value: string): OrderModel {
    const instance = new OrderModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('special_instructions', '=', value)

    return instance
  }

  static whereEstimatedDeliveryTime(value: string): OrderModel {
    const instance = new OrderModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('estimated_delivery_time', '=', value)

    return instance
  }

  static whereAppliedCouponId(value: string): OrderModel {
    const instance = new OrderModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('applied_coupon_id', '=', value)

    return instance
  }

  static whereIn<V = number>(column: keyof OrdersTable, values: V[]): OrderModel {
    const instance = new OrderModel(undefined)

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

  async couponBelong(): Promise<CouponModel> {
    if (this.coupon_id === undefined)
      throw new HttpError(500, 'Relation Error!')

    const model = await Coupon
      .where('id', '=', this.coupon_id)
      .first()

    if (!model)
      throw new HttpError(500, 'Model Relation Not Found!')

    return model
  }

  toSearchableObject(): Partial<OrderJsonResponse> {
    return {
      id: this.id,
      customer_id: this.customer_id,
      status: this.status,
      total_amount: this.total_amount,
      order_type: this.order_type,
      created_at: this.created_at,
    }
  }

  static distinct(column: keyof OrderJsonResponse): OrderModel {
    const instance = new OrderModel(undefined)

    return instance.applyDistinct(column)
  }

  static join(table: string, firstCol: string, secondCol: string): OrderModel {
    const instance = new OrderModel(undefined)

    return instance.applyJoin(table, firstCol, secondCol)
  }

  toJSON(): OrderJsonResponse {
    const output = {

      uuid: this.uuid,

      id: this.id,
      status: this.status,
      total_amount: this.total_amount,
      tax_amount: this.tax_amount,
      discount_amount: this.discount_amount,
      delivery_fee: this.delivery_fee,
      tip_amount: this.tip_amount,
      order_type: this.order_type,
      delivery_address: this.delivery_address,
      special_instructions: this.special_instructions,
      estimated_delivery_time: this.estimated_delivery_time,
      applied_coupon_id: this.applied_coupon_id,

      created_at: this.created_at,

      updated_at: this.updated_at,

      order_items: this.order_items,
      payments: this.payments,
      license_keys: this.license_keys,
      customer_id: this.customer_id,
      customer: this.customer,
      coupon_id: this.coupon_id,
      coupon: this.coupon,
      ...this.customColumns,
    }

    return output
  }

  parseResult(model: OrderModel): OrderModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof OrderModel]
    }

    return model
  }

  // Add a protected applyFind implementation
  protected async applyFind(id: number): Promise<OrderModel | undefined> {
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

export async function find(id: number): Promise<OrderModel | undefined> {
  const query = DB.instance.selectFrom('orders').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  const instance = new OrderModel(undefined)
  return instance.createInstance(model)
}

export async function count(): Promise<number> {
  const results = await OrderModel.count()

  return results
}

export async function create(newOrder: NewOrder): Promise<OrderModel> {
  const instance = new OrderModel(undefined)
  return await instance.applyCreate(newOrder)
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(DB.instance)
}

export async function remove(id: number): Promise<void> {
  await DB.instance.deleteFrom('orders')
    .where('id', '=', id)
    .execute()
}

export async function whereStatus(value: string): Promise<OrderModel[]> {
  const query = DB.instance.selectFrom('orders').where('status', '=', value)
  const results: OrderJsonResponse = await query.execute()

  return results.map((modelItem: OrderJsonResponse) => new OrderModel(modelItem))
}

export async function whereTotalAmount(value: number): Promise<OrderModel[]> {
  const query = DB.instance.selectFrom('orders').where('total_amount', '=', value)
  const results: OrderJsonResponse = await query.execute()

  return results.map((modelItem: OrderJsonResponse) => new OrderModel(modelItem))
}

export async function whereTaxAmount(value: number): Promise<OrderModel[]> {
  const query = DB.instance.selectFrom('orders').where('tax_amount', '=', value)
  const results: OrderJsonResponse = await query.execute()

  return results.map((modelItem: OrderJsonResponse) => new OrderModel(modelItem))
}

export async function whereDiscountAmount(value: number): Promise<OrderModel[]> {
  const query = DB.instance.selectFrom('orders').where('discount_amount', '=', value)
  const results: OrderJsonResponse = await query.execute()

  return results.map((modelItem: OrderJsonResponse) => new OrderModel(modelItem))
}

export async function whereDeliveryFee(value: number): Promise<OrderModel[]> {
  const query = DB.instance.selectFrom('orders').where('delivery_fee', '=', value)
  const results: OrderJsonResponse = await query.execute()

  return results.map((modelItem: OrderJsonResponse) => new OrderModel(modelItem))
}

export async function whereTipAmount(value: number): Promise<OrderModel[]> {
  const query = DB.instance.selectFrom('orders').where('tip_amount', '=', value)
  const results: OrderJsonResponse = await query.execute()

  return results.map((modelItem: OrderJsonResponse) => new OrderModel(modelItem))
}

export async function whereOrderType(value: string): Promise<OrderModel[]> {
  const query = DB.instance.selectFrom('orders').where('order_type', '=', value)
  const results: OrderJsonResponse = await query.execute()

  return results.map((modelItem: OrderJsonResponse) => new OrderModel(modelItem))
}

export async function whereDeliveryAddress(value: string): Promise<OrderModel[]> {
  const query = DB.instance.selectFrom('orders').where('delivery_address', '=', value)
  const results: OrderJsonResponse = await query.execute()

  return results.map((modelItem: OrderJsonResponse) => new OrderModel(modelItem))
}

export async function whereSpecialInstructions(value: string): Promise<OrderModel[]> {
  const query = DB.instance.selectFrom('orders').where('special_instructions', '=', value)
  const results: OrderJsonResponse = await query.execute()

  return results.map((modelItem: OrderJsonResponse) => new OrderModel(modelItem))
}

export async function whereEstimatedDeliveryTime(value: string): Promise<OrderModel[]> {
  const query = DB.instance.selectFrom('orders').where('estimated_delivery_time', '=', value)
  const results: OrderJsonResponse = await query.execute()

  return results.map((modelItem: OrderJsonResponse) => new OrderModel(modelItem))
}

export async function whereAppliedCouponId(value: string): Promise<OrderModel[]> {
  const query = DB.instance.selectFrom('orders').where('applied_coupon_id', '=', value)
  const results: OrderJsonResponse = await query.execute()

  return results.map((modelItem: OrderJsonResponse) => new OrderModel(modelItem))
}

export const Order = OrderModel

export default Order
