import type { RawBuilder } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import type { CartJsonResponse, CartsTable, CartUpdate, NewCart } from '../types/CartType'
import type { CartItemModel } from './CartItem'
import type { CouponModel } from './Coupon'
import type { CustomerModel } from './Customer'
import { randomUUIDv7 } from 'bun'
import { sql } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'
import { dispatch } from '@stacksjs/events'

import { DB } from '@stacksjs/orm'

import { BaseOrm } from '../utils/base'

export class CartModel extends BaseOrm<CartModel, CartsTable, CartJsonResponse> {
  private readonly hidden: Array<keyof CartJsonResponse> = []
  private readonly fillable: Array<keyof CartJsonResponse> = ['status', 'total_items', 'subtotal', 'tax_amount', 'discount_amount', 'total', 'expires_at', 'currency', 'notes', 'applied_coupon_id', 'uuid']
  private readonly guarded: Array<keyof CartJsonResponse> = []
  protected attributes = {} as CartJsonResponse
  protected originalAttributes = {} as CartJsonResponse

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

  constructor(cart: CartJsonResponse | undefined) {
    super('carts')
    if (cart) {
      this.attributes = { ...cart }
      this.originalAttributes = { ...cart }

      Object.keys(cart).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (cart as CartJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = DB.instance.selectFrom('carts')
    this.updateFromQuery = DB.instance.updateTable('carts')
    this.deleteFromQuery = DB.instance.deleteFrom('carts')
    this.hasSelect = false
  }

  protected async loadRelations(models: CartJsonResponse | CartJsonResponse[]): Promise<void> {
    // Handle both single model and array of models
    const modelArray = Array.isArray(models) ? models : [models]
    if (!modelArray.length)
      return

    const modelIds = modelArray.map(model => model.id)

    for (const relation of this.withRelations) {
      const relatedRecords = await DB.instance
        .selectFrom(relation)
        .where('cart_id', 'in', modelIds)
        .selectAll()
        .execute()

      if (Array.isArray(models)) {
        models.map((model: CartJsonResponse) => {
          const records = relatedRecords.filter((record: { cart_id: number }) => {
            return record.cart_id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      }
      else {
        const records = relatedRecords.filter((record: { cart_id: number }) => {
          return record.cart_id === models.id
        })

        models[relation] = records.length === 1 ? records[0] : records
      }
    }
  }

  static with(relations: string[]): CartModel {
    const instance = new CartModel(undefined)

    return instance.applyWith(relations)
  }

  protected mapCustomGetters(models: CartJsonResponse | CartJsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: CartJsonResponse) => {
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

  async mapCustomSetters(model: NewCart): Promise<void> {
    const customSetter = {
      default: () => {
      },

    }

    for (const [key, fn] of Object.entries(customSetter)) {
      (model as any)[key] = await fn()
    }
  }

  get cart_items(): CartItemModel[] | [] {
    return this.attributes.cart_items
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

  get status(): string | string[] | undefined {
    return this.attributes.status
  }

  get total_items(): number | undefined {
    return this.attributes.total_items
  }

  get subtotal(): number | undefined {
    return this.attributes.subtotal
  }

  get tax_amount(): number | undefined {
    return this.attributes.tax_amount
  }

  get discount_amount(): number | undefined {
    return this.attributes.discount_amount
  }

  get total(): number | undefined {
    return this.attributes.total
  }

  get expires_at(): Date | string {
    return this.attributes.expires_at
  }

  get currency(): string | undefined {
    return this.attributes.currency
  }

  get notes(): string | undefined {
    return this.attributes.notes
  }

  get applied_coupon_id(): string {
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

  set status(value: string | string[]) {
    this.attributes.status = value
  }

  set total_items(value: number) {
    this.attributes.total_items = value
  }

  set subtotal(value: number) {
    this.attributes.subtotal = value
  }

  set tax_amount(value: number) {
    this.attributes.tax_amount = value
  }

  set discount_amount(value: number) {
    this.attributes.discount_amount = value
  }

  set total(value: number) {
    this.attributes.total = value
  }

  set expires_at(value: Date | string) {
    this.attributes.expires_at = value
  }

  set currency(value: string) {
    this.attributes.currency = value
  }

  set notes(value: string) {
    this.attributes.notes = value
  }

  set applied_coupon_id(value: string) {
    this.attributes.applied_coupon_id = value
  }

  set updated_at(value: string) {
    this.attributes.updated_at = value
  }

  static select(params: (keyof CartJsonResponse)[] | RawBuilder<string> | string): CartModel {
    const instance = new CartModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a Cart by ID
  static async find(id: number): Promise<CartModel | undefined> {
    const query = DB.instance.selectFrom('carts').where('id', '=', id).selectAll()

    const model = await query.executeTakeFirst()

    if (!model)
      return undefined

    const instance = new CartModel(undefined)
    return instance.createInstance(model)
  }

  static async first(): Promise<CartModel | undefined> {
    const instance = new CartModel(undefined)

    const model = await instance.applyFirst()

    const data = new CartModel(model)

    return data
  }

  static async last(): Promise<CartModel | undefined> {
    const instance = new CartModel(undefined)

    const model = await instance.applyLast()

    if (!model)
      return undefined

    return new CartModel(model)
  }

  static async firstOrFail(): Promise<CartModel | undefined> {
    const instance = new CartModel(undefined)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<CartModel[]> {
    const instance = new CartModel(undefined)

    const models = await DB.instance.selectFrom('carts').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: CartJsonResponse) => {
      return new CartModel(model)
    }))

    return data
  }

  static async findOrFail(id: number): Promise<CartModel | undefined> {
    const instance = new CartModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<CartModel[]> {
    const instance = new CartModel(undefined)

    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: CartJsonResponse) => instance.parseResult(new CartModel(modelItem)))
  }

  static async latest(column: keyof CartsTable = 'created_at'): Promise<CartModel | undefined> {
    const instance = new CartModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'desc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new CartModel(model)
  }

  static async oldest(column: keyof CartsTable = 'created_at'): Promise<CartModel | undefined> {
    const instance = new CartModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'asc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new CartModel(model)
  }

  static skip(count: number): CartModel {
    const instance = new CartModel(undefined)

    return instance.applySkip(count)
  }

  static take(count: number): CartModel {
    const instance = new CartModel(undefined)

    return instance.applyTake(count)
  }

  static where<V = string>(column: keyof CartsTable, ...args: [V] | [Operator, V]): CartModel {
    const instance = new CartModel(undefined)

    return instance.applyWhere<V>(column, ...args)
  }

  static orWhere(...conditions: [string, any][]): CartModel {
    const instance = new CartModel(undefined)

    return instance.applyOrWhere(...conditions)
  }

  static whereNotIn<V = number>(column: keyof CartsTable, values: V[]): CartModel {
    const instance = new CartModel(undefined)

    return instance.applyWhereNotIn<V>(column, values)
  }

  static whereBetween<V = number>(column: keyof CartsTable, range: [V, V]): CartModel {
    const instance = new CartModel(undefined)

    return instance.applyWhereBetween<V>(column, range)
  }

  static whereRef(column: keyof CartsTable, ...args: string[]): CartModel {
    const instance = new CartModel(undefined)

    return instance.applyWhereRef(column, ...args)
  }

  static when(condition: boolean, callback: (query: CartModel) => CartModel): CartModel {
    const instance = new CartModel(undefined)

    return instance.applyWhen(condition, callback as any)
  }

  static whereNull(column: keyof CartsTable): CartModel {
    const instance = new CartModel(undefined)

    return instance.applyWhereNull(column)
  }

  static whereNotNull(column: keyof CartsTable): CartModel {
    const instance = new CartModel(undefined)

    return instance.applyWhereNotNull(column)
  }

  static whereLike(column: keyof CartsTable, value: string): CartModel {
    const instance = new CartModel(undefined)

    return instance.applyWhereLike(column, value)
  }

  static orderBy(column: keyof CartsTable, order: 'asc' | 'desc'): CartModel {
    const instance = new CartModel(undefined)

    return instance.applyOrderBy(column, order)
  }

  static orderByAsc(column: keyof CartsTable): CartModel {
    const instance = new CartModel(undefined)

    return instance.applyOrderByAsc(column)
  }

  static orderByDesc(column: keyof CartsTable): CartModel {
    const instance = new CartModel(undefined)

    return instance.applyOrderByDesc(column)
  }

  static groupBy(column: keyof CartsTable): CartModel {
    const instance = new CartModel(undefined)

    return instance.applyGroupBy(column)
  }

  static having<V = string>(column: keyof CartsTable, operator: Operator, value: V): CartModel {
    const instance = new CartModel(undefined)

    return instance.applyHaving<V>(column, operator, value)
  }

  static inRandomOrder(): CartModel {
    const instance = new CartModel(undefined)

    return instance.applyInRandomOrder()
  }

  static whereColumn(first: keyof CartsTable, operator: Operator, second: keyof CartsTable): CartModel {
    const instance = new CartModel(undefined)

    return instance.applyWhereColumn(first, operator, second)
  }

  static async max(field: keyof CartsTable): Promise<number> {
    const instance = new CartModel(undefined)

    return await instance.applyMax(field)
  }

  static async min(field: keyof CartsTable): Promise<number> {
    const instance = new CartModel(undefined)

    return await instance.applyMin(field)
  }

  static async avg(field: keyof CartsTable): Promise<number> {
    const instance = new CartModel(undefined)

    return await instance.applyAvg(field)
  }

  static async sum(field: keyof CartsTable): Promise<number> {
    const instance = new CartModel(undefined)

    return await instance.applySum(field)
  }

  static async count(): Promise<number> {
    const instance = new CartModel(undefined)

    return instance.applyCount()
  }

  static async get(): Promise<CartModel[]> {
    const instance = new CartModel(undefined)

    const results = await instance.applyGet()

    return results.map((item: CartJsonResponse) => instance.createInstance(item))
  }

  static async pluck<K extends keyof CartModel>(field: K): Promise<CartModel[K][]> {
    const instance = new CartModel(undefined)

    return await instance.applyPluck(field)
  }

  static async chunk(size: number, callback: (models: CartModel[]) => Promise<void>): Promise<void> {
    const instance = new CartModel(undefined)

    await instance.applyChunk(size, async (models) => {
      const modelInstances = models.map((item: CartJsonResponse) => instance.createInstance(item))
      await callback(modelInstances)
    })
  }

  static async paginate(options: { limit?: number, offset?: number, page?: number } = { limit: 10, offset: 0, page: 1 }): Promise<{
    data: CartModel[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }> {
    const instance = new CartModel(undefined)

    const result = await instance.applyPaginate(options)

    return {
      data: result.data.map((item: CartJsonResponse) => instance.createInstance(item)),
      paging: result.paging,
      next_cursor: result.next_cursor,
    }
  }

  // Instance method for creating model instances
  createInstance(data: CartJsonResponse): CartModel {
    return new CartModel(data)
  }

  async applyCreate(newCart: NewCart): Promise<CartModel> {
    const filteredValues = Object.fromEntries(
      Object.entries(newCart).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewCart

    await this.mapCustomSetters(filteredValues)

    filteredValues.uuid = randomUUIDv7()

    const result = await DB.instance.insertInto('carts')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await DB.instance.selectFrom('carts')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created Cart')
    }

    if (model)
      dispatch('cart:created', model)
    return this.createInstance(model)
  }

  async create(newCart: NewCart): Promise<CartModel> {
    return await this.applyCreate(newCart)
  }

  static async create(newCart: NewCart): Promise<CartModel> {
    const instance = new CartModel(undefined)
    return await instance.applyCreate(newCart)
  }

  static async firstOrCreate(search: Partial<CartsTable>, values: NewCart = {} as NewCart): Promise<CartModel> {
    // First try to find a record matching the search criteria
    const instance = new CartModel(undefined)

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
    const createData = { ...search, ...values } as NewCart
    return await CartModel.create(createData)
  }

  static async updateOrCreate(search: Partial<CartsTable>, values: NewCart = {} as NewCart): Promise<CartModel> {
    // First try to find a record matching the search criteria
    const instance = new CartModel(undefined)

    // Apply all search conditions
    for (const [key, value] of Object.entries(search)) {
      instance.selectFromQuery = instance.selectFromQuery.where(key, '=', value)
    }

    // Try to find the record
    const existingRecord = await instance.applyFirst()

    if (existingRecord) {
      // If record exists, update it with the new values
      const model = instance.createInstance(existingRecord)
      const updatedModel = await model.update(values as CartUpdate)

      // Return the updated model instance
      if (updatedModel) {
        return updatedModel
      }

      // If update didn't return a model, fetch it again to ensure we have latest data
      const refreshedModel = await instance.applyFirst()
      return instance.createInstance(refreshedModel!)
    }

    // If no record exists, create a new one with combined search criteria and values
    const createData = { ...search, ...values } as NewCart
    return await CartModel.create(createData)
  }

  async update(newCart: CartUpdate): Promise<CartModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newCart).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as CartUpdate

    await this.mapCustomSetters(filteredValues)

    filteredValues.updated_at = new Date().toISOString()

    await DB.instance.updateTable('carts')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('carts')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated Cart')
      }

      if (model)
        dispatch('cart:updated', model)
      return this.createInstance(model)
    }

    return undefined
  }

  async forceUpdate(newCart: CartUpdate): Promise<CartModel | undefined> {
    await DB.instance.updateTable('carts')
      .set(newCart)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('carts')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated Cart')
      }

      if (this)
        dispatch('cart:updated', model)
      return this.createInstance(model)
    }

    return undefined
  }

  async save(): Promise<CartModel> {
    // If the model has an ID, update it; otherwise, create a new record
    if (this.id) {
      // Update existing record
      await DB.instance.updateTable('carts')
        .set(this.attributes as CartUpdate)
        .where('id', '=', this.id)
        .executeTakeFirst()

      // Get the updated data
      const model = await DB.instance.selectFrom('carts')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated Cart')
      }

      if (this)
        dispatch('cart:updated', model)
      return this.createInstance(model)
    }
    else {
      // Create new record
      const result = await DB.instance.insertInto('carts')
        .values(this.attributes as NewCart)
        .executeTakeFirst()

      // Get the created data
      const model = await DB.instance.selectFrom('carts')
        .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve created Cart')
      }

      if (this)
        dispatch('cart:created', model)
      return this.createInstance(model)
    }
  }

  static async createMany(newCart: NewCart[]): Promise<void> {
    const instance = new CartModel(undefined)

    const valuesFiltered = newCart.map((newCart: NewCart) => {
      const filteredValues = Object.fromEntries(
        Object.entries(newCart).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewCart

      filteredValues.uuid = randomUUIDv7()

      return filteredValues
    })

    await DB.instance.insertInto('carts')
      .values(valuesFiltered)
      .executeTakeFirst()
  }

  static async forceCreate(newCart: NewCart): Promise<CartModel> {
    const result = await DB.instance.insertInto('carts')
      .values(newCart)
      .executeTakeFirst()

    const instance = new CartModel(undefined)
    const model = await DB.instance.selectFrom('carts')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created Cart')
    }

    if (model)
      dispatch('cart:created', model)

    return instance.createInstance(model)
  }

  // Method to remove a Cart
  async delete(): Promise<number> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()
    const model = await this.find(Number(this.id))

    if (model)
      dispatch('cart:deleted', model)

    const deleted = await DB.instance.deleteFrom('carts')
      .where('id', '=', this.id)
      .execute()

    return deleted.numDeletedRows
  }

  static async remove(id: number): Promise<any> {
    const instance = new CartModel(undefined)

    const model = await instance.find(Number(id))

    if (model)
      dispatch('cart:deleted', model)

    return await DB.instance.deleteFrom('carts')
      .where('id', '=', id)
      .execute()
  }

  static whereStatus(value: string): CartModel {
    const instance = new CartModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('status', '=', value)

    return instance
  }

  static whereTotalItems(value: string): CartModel {
    const instance = new CartModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('total_items', '=', value)

    return instance
  }

  static whereSubtotal(value: string): CartModel {
    const instance = new CartModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('subtotal', '=', value)

    return instance
  }

  static whereTaxAmount(value: string): CartModel {
    const instance = new CartModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('tax_amount', '=', value)

    return instance
  }

  static whereDiscountAmount(value: string): CartModel {
    const instance = new CartModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('discount_amount', '=', value)

    return instance
  }

  static whereTotal(value: string): CartModel {
    const instance = new CartModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('total', '=', value)

    return instance
  }

  static whereExpiresAt(value: string): CartModel {
    const instance = new CartModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('expires_at', '=', value)

    return instance
  }

  static whereCurrency(value: string): CartModel {
    const instance = new CartModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('currency', '=', value)

    return instance
  }

  static whereNotes(value: string): CartModel {
    const instance = new CartModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('notes', '=', value)

    return instance
  }

  static whereAppliedCouponId(value: string): CartModel {
    const instance = new CartModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('applied_coupon_id', '=', value)

    return instance
  }

  static whereIn<V = number>(column: keyof CartsTable, values: V[]): CartModel {
    const instance = new CartModel(undefined)

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

  toSearchableObject(): Partial<CartJsonResponse> {
    return {
      id: this.id,
      customer_id: this.customer_id,
      status: this.status,
      total_items: this.total_items,
      subtotal: this.subtotal,
      total: this.total,
      expires_at: this.expires_at,
    }
  }

  static distinct(column: keyof CartJsonResponse): CartModel {
    const instance = new CartModel(undefined)

    return instance.applyDistinct(column)
  }

  static join(table: string, firstCol: string, secondCol: string): CartModel {
    const instance = new CartModel(undefined)

    return instance.applyJoin(table, firstCol, secondCol)
  }

  toJSON(): CartJsonResponse {
    const output = {

      uuid: this.uuid,

      id: this.id,
      status: this.status,
      total_items: this.total_items,
      subtotal: this.subtotal,
      tax_amount: this.tax_amount,
      discount_amount: this.discount_amount,
      total: this.total,
      expires_at: this.expires_at,
      currency: this.currency,
      notes: this.notes,
      applied_coupon_id: this.applied_coupon_id,

      created_at: this.created_at,

      updated_at: this.updated_at,

      cart_items: this.cart_items,
      customer_id: this.customer_id,
      customer: this.customer,
      coupon_id: this.coupon_id,
      coupon: this.coupon,
      ...this.customColumns,
    }

    return output
  }

  parseResult(model: CartModel): CartModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof CartModel]
    }

    return model
  }

  // Add a protected applyFind implementation
  protected async applyFind(id: number): Promise<CartModel | undefined> {
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

export async function find(id: number): Promise<CartModel | undefined> {
  const query = DB.instance.selectFrom('carts').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  const instance = new CartModel(undefined)
  return instance.createInstance(model)
}

export async function count(): Promise<number> {
  const results = await CartModel.count()

  return results
}

export async function create(newCart: NewCart): Promise<CartModel> {
  const instance = new CartModel(undefined)
  return await instance.applyCreate(newCart)
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(DB.instance)
}

export async function remove(id: number): Promise<void> {
  await DB.instance.deleteFrom('carts')
    .where('id', '=', id)
    .execute()
}

export async function whereStatus(value: string | string[]): Promise<CartModel[]> {
  const query = DB.instance.selectFrom('carts').where('status', '=', value)
  const results: CartJsonResponse = await query.execute()

  return results.map((modelItem: CartJsonResponse) => new CartModel(modelItem))
}

export async function whereTotalItems(value: number): Promise<CartModel[]> {
  const query = DB.instance.selectFrom('carts').where('total_items', '=', value)
  const results: CartJsonResponse = await query.execute()

  return results.map((modelItem: CartJsonResponse) => new CartModel(modelItem))
}

export async function whereSubtotal(value: number): Promise<CartModel[]> {
  const query = DB.instance.selectFrom('carts').where('subtotal', '=', value)
  const results: CartJsonResponse = await query.execute()

  return results.map((modelItem: CartJsonResponse) => new CartModel(modelItem))
}

export async function whereTaxAmount(value: number): Promise<CartModel[]> {
  const query = DB.instance.selectFrom('carts').where('tax_amount', '=', value)
  const results: CartJsonResponse = await query.execute()

  return results.map((modelItem: CartJsonResponse) => new CartModel(modelItem))
}

export async function whereDiscountAmount(value: number): Promise<CartModel[]> {
  const query = DB.instance.selectFrom('carts').where('discount_amount', '=', value)
  const results: CartJsonResponse = await query.execute()

  return results.map((modelItem: CartJsonResponse) => new CartModel(modelItem))
}

export async function whereTotal(value: number): Promise<CartModel[]> {
  const query = DB.instance.selectFrom('carts').where('total', '=', value)
  const results: CartJsonResponse = await query.execute()

  return results.map((modelItem: CartJsonResponse) => new CartModel(modelItem))
}

export async function whereExpiresAt(value: Date | string): Promise<CartModel[]> {
  const query = DB.instance.selectFrom('carts').where('expires_at', '=', value)
  const results: CartJsonResponse = await query.execute()

  return results.map((modelItem: CartJsonResponse) => new CartModel(modelItem))
}

export async function whereCurrency(value: string): Promise<CartModel[]> {
  const query = DB.instance.selectFrom('carts').where('currency', '=', value)
  const results: CartJsonResponse = await query.execute()

  return results.map((modelItem: CartJsonResponse) => new CartModel(modelItem))
}

export async function whereNotes(value: string): Promise<CartModel[]> {
  const query = DB.instance.selectFrom('carts').where('notes', '=', value)
  const results: CartJsonResponse = await query.execute()

  return results.map((modelItem: CartJsonResponse) => new CartModel(modelItem))
}

export async function whereAppliedCouponId(value: string): Promise<CartModel[]> {
  const query = DB.instance.selectFrom('carts').where('applied_coupon_id', '=', value)
  const results: CartJsonResponse = await query.execute()

  return results.map((modelItem: CartJsonResponse) => new CartModel(modelItem))
}

export const Cart = CartModel

export default Cart
