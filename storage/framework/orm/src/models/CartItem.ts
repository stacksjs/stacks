import type { RawBuilder } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import type { CartItemJsonResponse, CartItemsTable, CartItemUpdate, NewCartItem } from '../types/CartItemType'
import type { CartModel } from './Cart'
import { randomUUIDv7 } from 'bun'
import { sql } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'
import { dispatch } from '@stacksjs/events'
import { DB } from '@stacksjs/orm'

import { BaseOrm } from '../utils/base'

export class CartItemModel extends BaseOrm<CartItemModel, CartItemsTable, CartItemJsonResponse> {
  private readonly hidden: Array<keyof CartItemJsonResponse> = []
  private readonly fillable: Array<keyof CartItemJsonResponse> = ['quantity', 'unit_price', 'total_price', 'tax_rate', 'tax_amount', 'discount_percentage', 'discount_amount', 'product_name', 'product_sku', 'product_image', 'notes', 'uuid', 'cart_id']
  private readonly guarded: Array<keyof CartItemJsonResponse> = []
  protected attributes = {} as CartItemJsonResponse
  protected originalAttributes = {} as CartItemJsonResponse

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

  constructor(cartItem: CartItemJsonResponse | undefined) {
    super('cart_items')
    if (cartItem) {
      this.attributes = { ...cartItem }
      this.originalAttributes = { ...cartItem }

      Object.keys(cartItem).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (cartItem as CartItemJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = DB.instance.selectFrom('cart_items')
    this.updateFromQuery = DB.instance.updateTable('cart_items')
    this.deleteFromQuery = DB.instance.deleteFrom('cart_items')
    this.hasSelect = false
  }

  protected async loadRelations(models: CartItemJsonResponse | CartItemJsonResponse[]): Promise<void> {
    // Handle both single model and array of models
    const modelArray = Array.isArray(models) ? models : [models]
    if (!modelArray.length)
      return

    const modelIds = modelArray.map(model => model.id)

    for (const relation of this.withRelations) {
      const relatedRecords = await DB.instance
        .selectFrom(relation)
        .where('cartItem_id', 'in', modelIds)
        .selectAll()
        .execute()

      if (Array.isArray(models)) {
        models.map((model: CartItemJsonResponse) => {
          const records = relatedRecords.filter((record: { cartItem_id: number }) => {
            return record.cartItem_id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      }
      else {
        const records = relatedRecords.filter((record: { cartItem_id: number }) => {
          return record.cartItem_id === models.id
        })

        models[relation] = records.length === 1 ? records[0] : records
      }
    }
  }

  static with(relations: string[]): CartItemModel {
    const instance = new CartItemModel(undefined)

    return instance.applyWith(relations)
  }

  protected mapCustomGetters(models: CartItemJsonResponse | CartItemJsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: CartItemJsonResponse) => {
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

  async mapCustomSetters(model: NewCartItem | CartItemUpdate): Promise<void> {
    const customSetter = {
      default: () => {
      },

    }

    for (const [key, fn] of Object.entries(customSetter)) {
      (model as any)[key] = await fn()
    }
  }

  get cart_id(): number {
    return this.attributes.cart_id
  }

  get cart(): CartModel | undefined {
    return this.attributes.cart
  }

  get id(): number {
    return this.attributes.id
  }

  get uuid(): string | undefined {
    return this.attributes.uuid
  }

  get quantity(): number {
    return this.attributes.quantity
  }

  get unit_price(): number {
    return this.attributes.unit_price
  }

  get total_price(): number {
    return this.attributes.total_price
  }

  get tax_rate(): number | undefined {
    return this.attributes.tax_rate
  }

  get tax_amount(): number | undefined {
    return this.attributes.tax_amount
  }

  get discount_percentage(): number | undefined {
    return this.attributes.discount_percentage
  }

  get discount_amount(): number | undefined {
    return this.attributes.discount_amount
  }

  get product_name(): string {
    return this.attributes.product_name
  }

  get product_sku(): string | undefined {
    return this.attributes.product_sku
  }

  get product_image(): string | undefined {
    return this.attributes.product_image
  }

  get notes(): string | undefined {
    return this.attributes.notes
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

  set quantity(value: number) {
    this.attributes.quantity = value
  }

  set unit_price(value: number) {
    this.attributes.unit_price = value
  }

  set total_price(value: number) {
    this.attributes.total_price = value
  }

  set tax_rate(value: number) {
    this.attributes.tax_rate = value
  }

  set tax_amount(value: number) {
    this.attributes.tax_amount = value
  }

  set discount_percentage(value: number) {
    this.attributes.discount_percentage = value
  }

  set discount_amount(value: number) {
    this.attributes.discount_amount = value
  }

  set product_name(value: string) {
    this.attributes.product_name = value
  }

  set product_sku(value: string) {
    this.attributes.product_sku = value
  }

  set product_image(value: string) {
    this.attributes.product_image = value
  }

  set notes(value: string) {
    this.attributes.notes = value
  }

  set updated_at(value: string) {
    this.attributes.updated_at = value
  }

  static select(params: (keyof CartItemJsonResponse)[] | RawBuilder<string> | string): CartItemModel {
    const instance = new CartItemModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a CartItem by ID
  static async find(id: number): Promise<CartItemModel | undefined> {
    const query = DB.instance.selectFrom('cart_items').where('id', '=', id).selectAll()

    const model = await query.executeTakeFirst()

    if (!model)
      return undefined

    const instance = new CartItemModel(undefined)
    return instance.createInstance(model)
  }

  static async first(): Promise<CartItemModel | undefined> {
    const instance = new CartItemModel(undefined)

    const model = await instance.applyFirst()

    const data = new CartItemModel(model)

    return data
  }

  static async last(): Promise<CartItemModel | undefined> {
    const instance = new CartItemModel(undefined)

    const model = await instance.applyLast()

    if (!model)
      return undefined

    return new CartItemModel(model)
  }

  static async firstOrFail(): Promise<CartItemModel | undefined> {
    const instance = new CartItemModel(undefined)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<CartItemModel[]> {
    const instance = new CartItemModel(undefined)

    const models = await DB.instance.selectFrom('cart_items').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: CartItemJsonResponse) => {
      return new CartItemModel(model)
    }))

    return data
  }

  static async findOrFail(id: number): Promise<CartItemModel | undefined> {
    const instance = new CartItemModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<CartItemModel[]> {
    const instance = new CartItemModel(undefined)

    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: CartItemJsonResponse) => instance.parseResult(new CartItemModel(modelItem)))
  }

  static async latest(column: keyof CartItemsTable = 'created_at'): Promise<CartItemModel | undefined> {
    const instance = new CartItemModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'desc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new CartItemModel(model)
  }

  static async oldest(column: keyof CartItemsTable = 'created_at'): Promise<CartItemModel | undefined> {
    const instance = new CartItemModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'asc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new CartItemModel(model)
  }

  static skip(count: number): CartItemModel {
    const instance = new CartItemModel(undefined)

    return instance.applySkip(count)
  }

  static take(count: number): CartItemModel {
    const instance = new CartItemModel(undefined)

    return instance.applyTake(count)
  }

  static where<V = string>(column: keyof CartItemsTable, ...args: [V] | [Operator, V]): CartItemModel {
    const instance = new CartItemModel(undefined)

    return instance.applyWhere<V>(column, ...args)
  }

  static orWhere(...conditions: [string, any][]): CartItemModel {
    const instance = new CartItemModel(undefined)

    return instance.applyOrWhere(...conditions)
  }

  static whereNotIn<V = number>(column: keyof CartItemsTable, values: V[]): CartItemModel {
    const instance = new CartItemModel(undefined)

    return instance.applyWhereNotIn<V>(column, values)
  }

  static whereBetween<V = number>(column: keyof CartItemsTable, range: [V, V]): CartItemModel {
    const instance = new CartItemModel(undefined)

    return instance.applyWhereBetween<V>(column, range)
  }

  static whereRef(column: keyof CartItemsTable, ...args: string[]): CartItemModel {
    const instance = new CartItemModel(undefined)

    return instance.applyWhereRef(column, ...args)
  }

  static when(condition: boolean, callback: (query: CartItemModel) => CartItemModel): CartItemModel {
    const instance = new CartItemModel(undefined)

    return instance.applyWhen(condition, callback as any)
  }

  static whereNull(column: keyof CartItemsTable): CartItemModel {
    const instance = new CartItemModel(undefined)

    return instance.applyWhereNull(column)
  }

  static whereNotNull(column: keyof CartItemsTable): CartItemModel {
    const instance = new CartItemModel(undefined)

    return instance.applyWhereNotNull(column)
  }

  static whereLike(column: keyof CartItemsTable, value: string): CartItemModel {
    const instance = new CartItemModel(undefined)

    return instance.applyWhereLike(column, value)
  }

  static orderBy(column: keyof CartItemsTable, order: 'asc' | 'desc'): CartItemModel {
    const instance = new CartItemModel(undefined)

    return instance.applyOrderBy(column, order)
  }

  static orderByAsc(column: keyof CartItemsTable): CartItemModel {
    const instance = new CartItemModel(undefined)

    return instance.applyOrderByAsc(column)
  }

  static orderByDesc(column: keyof CartItemsTable): CartItemModel {
    const instance = new CartItemModel(undefined)

    return instance.applyOrderByDesc(column)
  }

  static groupBy(column: keyof CartItemsTable): CartItemModel {
    const instance = new CartItemModel(undefined)

    return instance.applyGroupBy(column)
  }

  static having<V = string>(column: keyof CartItemsTable, operator: Operator, value: V): CartItemModel {
    const instance = new CartItemModel(undefined)

    return instance.applyHaving<V>(column, operator, value)
  }

  static inRandomOrder(): CartItemModel {
    const instance = new CartItemModel(undefined)

    return instance.applyInRandomOrder()
  }

  static whereColumn(first: keyof CartItemsTable, operator: Operator, second: keyof CartItemsTable): CartItemModel {
    const instance = new CartItemModel(undefined)

    return instance.applyWhereColumn(first, operator, second)
  }

  static async max(field: keyof CartItemsTable): Promise<number> {
    const instance = new CartItemModel(undefined)

    return await instance.applyMax(field)
  }

  static async min(field: keyof CartItemsTable): Promise<number> {
    const instance = new CartItemModel(undefined)

    return await instance.applyMin(field)
  }

  static async avg(field: keyof CartItemsTable): Promise<number> {
    const instance = new CartItemModel(undefined)

    return await instance.applyAvg(field)
  }

  static async sum(field: keyof CartItemsTable): Promise<number> {
    const instance = new CartItemModel(undefined)

    return await instance.applySum(field)
  }

  static async count(): Promise<number> {
    const instance = new CartItemModel(undefined)

    return instance.applyCount()
  }

  static async get(): Promise<CartItemModel[]> {
    const instance = new CartItemModel(undefined)

    const results = await instance.applyGet()

    return results.map((item: CartItemJsonResponse) => instance.createInstance(item))
  }

  static async pluck<K extends keyof CartItemModel>(field: K): Promise<CartItemModel[K][]> {
    const instance = new CartItemModel(undefined)

    return await instance.applyPluck(field)
  }

  static async chunk(size: number, callback: (models: CartItemModel[]) => Promise<void>): Promise<void> {
    const instance = new CartItemModel(undefined)

    await instance.applyChunk(size, async (models) => {
      const modelInstances = models.map((item: CartItemJsonResponse) => instance.createInstance(item))
      await callback(modelInstances)
    })
  }

  static async paginate(options: { limit?: number, offset?: number, page?: number } = { limit: 10, offset: 0, page: 1 }): Promise<{
    data: CartItemModel[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }> {
    const instance = new CartItemModel(undefined)

    const result = await instance.applyPaginate(options)

    return {
      data: result.data.map((item: CartItemJsonResponse) => instance.createInstance(item)),
      paging: result.paging,
      next_cursor: result.next_cursor,
    }
  }

  // Instance method for creating model instances
  createInstance(data: CartItemJsonResponse): CartItemModel {
    return new CartItemModel(data)
  }

  async applyCreate(newCartItem: NewCartItem): Promise<CartItemModel> {
    const filteredValues = Object.fromEntries(
      Object.entries(newCartItem).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewCartItem

    await this.mapCustomSetters(filteredValues)

    filteredValues.uuid = randomUUIDv7()

    const result = await DB.instance.insertInto('cart_items')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await DB.instance.selectFrom('cart_items')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created CartItem')
    }

    if (model)
      dispatch('cartItem:created', model)
    return this.createInstance(model)
  }

  async create(newCartItem: NewCartItem): Promise<CartItemModel> {
    return await this.applyCreate(newCartItem)
  }

  static async create(newCartItem: NewCartItem): Promise<CartItemModel> {
    const instance = new CartItemModel(undefined)
    return await instance.applyCreate(newCartItem)
  }

  static async firstOrCreate(search: Partial<CartItemsTable>, values: NewCartItem = {} as NewCartItem): Promise<CartItemModel> {
    // First try to find a record matching the search criteria
    const instance = new CartItemModel(undefined)

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
    const createData = { ...search, ...values } as NewCartItem
    return await CartItemModel.create(createData)
  }

  static async updateOrCreate(search: Partial<CartItemsTable>, values: NewCartItem = {} as NewCartItem): Promise<CartItemModel> {
    // First try to find a record matching the search criteria
    const instance = new CartItemModel(undefined)

    // Apply all search conditions
    for (const [key, value] of Object.entries(search)) {
      instance.selectFromQuery = instance.selectFromQuery.where(key, '=', value)
    }

    // Try to find the record
    const existingRecord = await instance.applyFirst()

    if (existingRecord) {
      // If record exists, update it with the new values
      const model = instance.createInstance(existingRecord)
      const updatedModel = await model.update(values as CartItemUpdate)

      // Return the updated model instance
      if (updatedModel) {
        return updatedModel
      }

      // If update didn't return a model, fetch it again to ensure we have latest data
      const refreshedModel = await instance.applyFirst()
      return instance.createInstance(refreshedModel!)
    }

    // If no record exists, create a new one with combined search criteria and values
    const createData = { ...search, ...values } as NewCartItem
    return await CartItemModel.create(createData)
  }

  async update(newCartItem: CartItemUpdate): Promise<CartItemModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newCartItem).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as CartItemUpdate

    await this.mapCustomSetters(filteredValues)

    filteredValues.updated_at = new Date().toISOString()

    await DB.instance.updateTable('cart_items')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('cart_items')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated CartItem')
      }

      if (model)
        dispatch('cartItem:updated', model)
      return this.createInstance(model)
    }

    return undefined
  }

  async forceUpdate(newCartItem: CartItemUpdate): Promise<CartItemModel | undefined> {
    await DB.instance.updateTable('cart_items')
      .set(newCartItem)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('cart_items')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated CartItem')
      }

      if (this)
        dispatch('cartItem:updated', model)
      return this.createInstance(model)
    }

    return undefined
  }

  async save(): Promise<CartItemModel> {
    // If the model has an ID, update it; otherwise, create a new record
    if (this.id) {
      // Update existing record
      await DB.instance.updateTable('cart_items')
        .set(this.attributes as CartItemUpdate)
        .where('id', '=', this.id)
        .executeTakeFirst()

      // Get the updated data
      const model = await DB.instance.selectFrom('cart_items')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated CartItem')
      }

      if (this)
        dispatch('cartItem:updated', model)
      return this.createInstance(model)
    }
    else {
      // Create new record
      const result = await DB.instance.insertInto('cart_items')
        .values(this.attributes as NewCartItem)
        .executeTakeFirst()

      // Get the created data
      const model = await DB.instance.selectFrom('cart_items')
        .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve created CartItem')
      }

      if (this)
        dispatch('cartItem:created', model)
      return this.createInstance(model)
    }
  }

  static async createMany(newCartItem: NewCartItem[]): Promise<void> {
    const instance = new CartItemModel(undefined)

    const valuesFiltered = newCartItem.map((newCartItem: NewCartItem) => {
      const filteredValues = Object.fromEntries(
        Object.entries(newCartItem).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewCartItem

      filteredValues.uuid = randomUUIDv7()

      return filteredValues
    })

    await DB.instance.insertInto('cart_items')
      .values(valuesFiltered)
      .executeTakeFirst()
  }

  static async forceCreate(newCartItem: NewCartItem): Promise<CartItemModel> {
    const result = await DB.instance.insertInto('cart_items')
      .values(newCartItem)
      .executeTakeFirst()

    const instance = new CartItemModel(undefined)
    const model = await DB.instance.selectFrom('cart_items')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created CartItem')
    }

    if (model)
      dispatch('cartItem:created', model)

    return instance.createInstance(model)
  }

  // Method to remove a CartItem
  async delete(): Promise<number> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()
    const model = await this.find(Number(this.id))

    if (model)
      dispatch('cartItem:deleted', model)

    const deleted = await DB.instance.deleteFrom('cart_items')
      .where('id', '=', this.id)
      .execute()

    return deleted.numDeletedRows
  }

  static async remove(id: number): Promise<any> {
    const instance = new CartItemModel(undefined)

    const model = await instance.find(Number(id))

    if (model)
      dispatch('cartItem:deleted', model)

    return await DB.instance.deleteFrom('cart_items')
      .where('id', '=', id)
      .execute()
  }

  static whereQuantity(value: string): CartItemModel {
    const instance = new CartItemModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('quantity', '=', value)

    return instance
  }

  static whereUnitPrice(value: string): CartItemModel {
    const instance = new CartItemModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('unit_price', '=', value)

    return instance
  }

  static whereTotalPrice(value: string): CartItemModel {
    const instance = new CartItemModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('total_price', '=', value)

    return instance
  }

  static whereTaxRate(value: string): CartItemModel {
    const instance = new CartItemModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('tax_rate', '=', value)

    return instance
  }

  static whereTaxAmount(value: string): CartItemModel {
    const instance = new CartItemModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('tax_amount', '=', value)

    return instance
  }

  static whereDiscountPercentage(value: string): CartItemModel {
    const instance = new CartItemModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('discount_percentage', '=', value)

    return instance
  }

  static whereDiscountAmount(value: string): CartItemModel {
    const instance = new CartItemModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('discount_amount', '=', value)

    return instance
  }

  static whereProductName(value: string): CartItemModel {
    const instance = new CartItemModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('product_name', '=', value)

    return instance
  }

  static whereProductSku(value: string): CartItemModel {
    const instance = new CartItemModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('product_sku', '=', value)

    return instance
  }

  static whereProductImage(value: string): CartItemModel {
    const instance = new CartItemModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('product_image', '=', value)

    return instance
  }

  static whereNotes(value: string): CartItemModel {
    const instance = new CartItemModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('notes', '=', value)

    return instance
  }

  static whereIn<V = number>(column: keyof CartItemsTable, values: V[]): CartItemModel {
    const instance = new CartItemModel(undefined)

    return instance.applyWhereIn<V>(column, values)
  }

  async cartBelong(): Promise<CartModel> {
    if (this.cart_id === undefined)
      throw new HttpError(500, 'Relation Error!')

    const model = await Cart
      .where('id', '=', this.cart_id)
      .first()

    if (!model)
      throw new HttpError(500, 'Model Relation Not Found!')

    return model
  }

  toSearchableObject(): Partial<CartItemJsonResponse> {
    return {
      id: this.id,
      cart_id: this.cart_id,
      product_id: this.product_id,
      quantity: this.quantity,
      unit_price: this.unit_price,
      total_price: this.total_price,
    }
  }

  static distinct(column: keyof CartItemJsonResponse): CartItemModel {
    const instance = new CartItemModel(undefined)

    return instance.applyDistinct(column)
  }

  static join(table: string, firstCol: string, secondCol: string): CartItemModel {
    const instance = new CartItemModel(undefined)

    return instance.applyJoin(table, firstCol, secondCol)
  }

  toJSON(): CartItemJsonResponse {
    const output = {

      uuid: this.uuid,

      id: this.id,
      quantity: this.quantity,
      unit_price: this.unit_price,
      total_price: this.total_price,
      tax_rate: this.tax_rate,
      tax_amount: this.tax_amount,
      discount_percentage: this.discount_percentage,
      discount_amount: this.discount_amount,
      product_name: this.product_name,
      product_sku: this.product_sku,
      product_image: this.product_image,
      notes: this.notes,

      created_at: this.created_at,

      updated_at: this.updated_at,

      cart_id: this.cart_id,
      cart: this.cart,
      ...this.customColumns,
    }

    return output
  }

  parseResult(model: CartItemModel): CartItemModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof CartItemModel]
    }

    return model
  }

  // Add a protected applyFind implementation
  protected async applyFind(id: number): Promise<CartItemModel | undefined> {
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

export async function find(id: number): Promise<CartItemModel | undefined> {
  const query = DB.instance.selectFrom('cart_items').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  const instance = new CartItemModel(undefined)
  return instance.createInstance(model)
}

export async function count(): Promise<number> {
  const results = await CartItemModel.count()

  return results
}

export async function create(newCartItem: NewCartItem): Promise<CartItemModel> {
  const instance = new CartItemModel(undefined)
  return await instance.applyCreate(newCartItem)
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(DB.instance)
}

export async function remove(id: number): Promise<void> {
  await DB.instance.deleteFrom('cart_items')
    .where('id', '=', id)
    .execute()
}

export async function whereQuantity(value: number): Promise<CartItemModel[]> {
  const query = DB.instance.selectFrom('cart_items').where('quantity', '=', value)
  const results: CartItemJsonResponse = await query.execute()

  return results.map((modelItem: CartItemJsonResponse) => new CartItemModel(modelItem))
}

export async function whereUnitPrice(value: number): Promise<CartItemModel[]> {
  const query = DB.instance.selectFrom('cart_items').where('unit_price', '=', value)
  const results: CartItemJsonResponse = await query.execute()

  return results.map((modelItem: CartItemJsonResponse) => new CartItemModel(modelItem))
}

export async function whereTotalPrice(value: number): Promise<CartItemModel[]> {
  const query = DB.instance.selectFrom('cart_items').where('total_price', '=', value)
  const results: CartItemJsonResponse = await query.execute()

  return results.map((modelItem: CartItemJsonResponse) => new CartItemModel(modelItem))
}

export async function whereTaxRate(value: number): Promise<CartItemModel[]> {
  const query = DB.instance.selectFrom('cart_items').where('tax_rate', '=', value)
  const results: CartItemJsonResponse = await query.execute()

  return results.map((modelItem: CartItemJsonResponse) => new CartItemModel(modelItem))
}

export async function whereTaxAmount(value: number): Promise<CartItemModel[]> {
  const query = DB.instance.selectFrom('cart_items').where('tax_amount', '=', value)
  const results: CartItemJsonResponse = await query.execute()

  return results.map((modelItem: CartItemJsonResponse) => new CartItemModel(modelItem))
}

export async function whereDiscountPercentage(value: number): Promise<CartItemModel[]> {
  const query = DB.instance.selectFrom('cart_items').where('discount_percentage', '=', value)
  const results: CartItemJsonResponse = await query.execute()

  return results.map((modelItem: CartItemJsonResponse) => new CartItemModel(modelItem))
}

export async function whereDiscountAmount(value: number): Promise<CartItemModel[]> {
  const query = DB.instance.selectFrom('cart_items').where('discount_amount', '=', value)
  const results: CartItemJsonResponse = await query.execute()

  return results.map((modelItem: CartItemJsonResponse) => new CartItemModel(modelItem))
}

export async function whereProductName(value: string): Promise<CartItemModel[]> {
  const query = DB.instance.selectFrom('cart_items').where('product_name', '=', value)
  const results: CartItemJsonResponse = await query.execute()

  return results.map((modelItem: CartItemJsonResponse) => new CartItemModel(modelItem))
}

export async function whereProductSku(value: string): Promise<CartItemModel[]> {
  const query = DB.instance.selectFrom('cart_items').where('product_sku', '=', value)
  const results: CartItemJsonResponse = await query.execute()

  return results.map((modelItem: CartItemJsonResponse) => new CartItemModel(modelItem))
}

export async function whereProductImage(value: string): Promise<CartItemModel[]> {
  const query = DB.instance.selectFrom('cart_items').where('product_image', '=', value)
  const results: CartItemJsonResponse = await query.execute()

  return results.map((modelItem: CartItemJsonResponse) => new CartItemModel(modelItem))
}

export async function whereNotes(value: string): Promise<CartItemModel[]> {
  const query = DB.instance.selectFrom('cart_items').where('notes', '=', value)
  const results: CartItemJsonResponse = await query.execute()

  return results.map((modelItem: CartItemJsonResponse) => new CartItemModel(modelItem))
}

export const CartItem = CartItemModel

export default CartItem
