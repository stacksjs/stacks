import type { RawBuilder } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import type { NewOrderItem, OrderItemJsonResponse, OrderItemsTable, OrderItemUpdate } from '../types/OrderItemType'
import type { OrderModel } from './Order'
import type { ProductModel } from './Product'
import { sql } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'
import { DB } from '@stacksjs/orm'

import { BaseOrm } from '../utils/base'

export class OrderItemModel extends BaseOrm<OrderItemModel, OrderItemsTable, OrderItemJsonResponse> {
  private readonly hidden: Array<keyof OrderItemJsonResponse> = []
  private readonly fillable: Array<keyof OrderItemJsonResponse> = ['quantity', 'price', 'special_instructions', 'order_id']
  private readonly guarded: Array<keyof OrderItemJsonResponse> = []
  protected attributes = {} as OrderItemJsonResponse
  protected originalAttributes = {} as OrderItemJsonResponse

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

  constructor(orderItem: OrderItemJsonResponse | undefined) {
    super('order_items')
    if (orderItem) {
      this.attributes = { ...orderItem }
      this.originalAttributes = { ...orderItem }

      Object.keys(orderItem).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (orderItem as OrderItemJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = DB.instance.selectFrom('order_items')
    this.updateFromQuery = DB.instance.updateTable('order_items')
    this.deleteFromQuery = DB.instance.deleteFrom('order_items')
    this.hasSelect = false
  }

  protected async loadRelations(models: OrderItemJsonResponse | OrderItemJsonResponse[]): Promise<void> {
    // Handle both single model and array of models
    const modelArray = Array.isArray(models) ? models : [models]
    if (!modelArray.length)
      return

    const modelIds = modelArray.map(model => model.id)

    for (const relation of this.withRelations) {
      const relatedRecords = await DB.instance
        .selectFrom(relation)
        .where('orderItem_id', 'in', modelIds)
        .selectAll()
        .execute()

      if (Array.isArray(models)) {
        models.map((model: OrderItemJsonResponse) => {
          const records = relatedRecords.filter((record: { orderItem_id: number }) => {
            return record.orderItem_id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      }
      else {
        const records = relatedRecords.filter((record: { orderItem_id: number }) => {
          return record.orderItem_id === models.id
        })

        models[relation] = records.length === 1 ? records[0] : records
      }
    }
  }

  static with(relations: string[]): OrderItemModel {
    const instance = new OrderItemModel(undefined)

    return instance.applyWith(relations)
  }

  protected mapCustomGetters(models: OrderItemJsonResponse | OrderItemJsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: OrderItemJsonResponse) => {
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

  async mapCustomSetters(model: NewOrderItem | OrderItemUpdate): Promise<void> {
    const customSetter = {
      default: () => {
      },

    }

    for (const [key, fn] of Object.entries(customSetter)) {
      (model as any)[key] = await fn()
    }
  }

  get order_id(): number {
    return this.attributes.order_id
  }

  get order(): OrderModel | undefined {
    return this.attributes.order
  }

  get product_id(): number {
    return this.attributes.product_id
  }

  get product(): ProductModel | undefined {
    return this.attributes.product
  }

  get id(): number {
    return this.attributes.id
  }

  get quantity(): number {
    return this.attributes.quantity
  }

  get price(): number {
    return this.attributes.price
  }

  get special_instructions(): string | undefined {
    return this.attributes.special_instructions
  }

  get created_at(): string | undefined {
    return this.attributes.created_at
  }

  get updated_at(): string | undefined {
    return this.attributes.updated_at
  }

  set quantity(value: number) {
    this.attributes.quantity = value
  }

  set price(value: number) {
    this.attributes.price = value
  }

  set special_instructions(value: string) {
    this.attributes.special_instructions = value
  }

  set updated_at(value: string) {
    this.attributes.updated_at = value
  }

  static select(params: (keyof OrderItemJsonResponse)[] | RawBuilder<string> | string): OrderItemModel {
    const instance = new OrderItemModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a OrderItem by ID
  static async find(id: number): Promise<OrderItemModel | undefined> {
    const query = DB.instance.selectFrom('order_items').where('id', '=', id).selectAll()

    const model = await query.executeTakeFirst()

    if (!model)
      return undefined

    const instance = new OrderItemModel(undefined)
    return instance.createInstance(model)
  }

  static async first(): Promise<OrderItemModel | undefined> {
    const instance = new OrderItemModel(undefined)

    const model = await instance.applyFirst()

    const data = new OrderItemModel(model)

    return data
  }

  static async last(): Promise<OrderItemModel | undefined> {
    const instance = new OrderItemModel(undefined)

    const model = await instance.applyLast()

    if (!model)
      return undefined

    return new OrderItemModel(model)
  }

  static async firstOrFail(): Promise<OrderItemModel | undefined> {
    const instance = new OrderItemModel(undefined)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<OrderItemModel[]> {
    const instance = new OrderItemModel(undefined)

    const models = await DB.instance.selectFrom('order_items').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: OrderItemJsonResponse) => {
      return new OrderItemModel(model)
    }))

    return data
  }

  static async findOrFail(id: number): Promise<OrderItemModel | undefined> {
    const instance = new OrderItemModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<OrderItemModel[]> {
    const instance = new OrderItemModel(undefined)

    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: OrderItemJsonResponse) => instance.parseResult(new OrderItemModel(modelItem)))
  }

  static async latest(column: keyof OrderItemsTable = 'created_at'): Promise<OrderItemModel | undefined> {
    const instance = new OrderItemModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'desc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new OrderItemModel(model)
  }

  static async oldest(column: keyof OrderItemsTable = 'created_at'): Promise<OrderItemModel | undefined> {
    const instance = new OrderItemModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'asc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new OrderItemModel(model)
  }

  static skip(count: number): OrderItemModel {
    const instance = new OrderItemModel(undefined)

    return instance.applySkip(count)
  }

  static take(count: number): OrderItemModel {
    const instance = new OrderItemModel(undefined)

    return instance.applyTake(count)
  }

  static where<V = string>(column: keyof OrderItemsTable, ...args: [V] | [Operator, V]): OrderItemModel {
    const instance = new OrderItemModel(undefined)

    return instance.applyWhere<V>(column, ...args)
  }

  static orWhere(...conditions: [string, any][]): OrderItemModel {
    const instance = new OrderItemModel(undefined)

    return instance.applyOrWhere(...conditions)
  }

  static whereNotIn<V = number>(column: keyof OrderItemsTable, values: V[]): OrderItemModel {
    const instance = new OrderItemModel(undefined)

    return instance.applyWhereNotIn<V>(column, values)
  }

  static whereBetween<V = number>(column: keyof OrderItemsTable, range: [V, V]): OrderItemModel {
    const instance = new OrderItemModel(undefined)

    return instance.applyWhereBetween<V>(column, range)
  }

  static whereRef(column: keyof OrderItemsTable, ...args: string[]): OrderItemModel {
    const instance = new OrderItemModel(undefined)

    return instance.applyWhereRef(column, ...args)
  }

  static when(condition: boolean, callback: (query: OrderItemModel) => OrderItemModel): OrderItemModel {
    const instance = new OrderItemModel(undefined)

    return instance.applyWhen(condition, callback as any)
  }

  static whereNull(column: keyof OrderItemsTable): OrderItemModel {
    const instance = new OrderItemModel(undefined)

    return instance.applyWhereNull(column)
  }

  static whereNotNull(column: keyof OrderItemsTable): OrderItemModel {
    const instance = new OrderItemModel(undefined)

    return instance.applyWhereNotNull(column)
  }

  static whereLike(column: keyof OrderItemsTable, value: string): OrderItemModel {
    const instance = new OrderItemModel(undefined)

    return instance.applyWhereLike(column, value)
  }

  static orderBy(column: keyof OrderItemsTable, order: 'asc' | 'desc'): OrderItemModel {
    const instance = new OrderItemModel(undefined)

    return instance.applyOrderBy(column, order)
  }

  static orderByAsc(column: keyof OrderItemsTable): OrderItemModel {
    const instance = new OrderItemModel(undefined)

    return instance.applyOrderByAsc(column)
  }

  static orderByDesc(column: keyof OrderItemsTable): OrderItemModel {
    const instance = new OrderItemModel(undefined)

    return instance.applyOrderByDesc(column)
  }

  static groupBy(column: keyof OrderItemsTable): OrderItemModel {
    const instance = new OrderItemModel(undefined)

    return instance.applyGroupBy(column)
  }

  static having<V = string>(column: keyof OrderItemsTable, operator: Operator, value: V): OrderItemModel {
    const instance = new OrderItemModel(undefined)

    return instance.applyHaving<V>(column, operator, value)
  }

  static inRandomOrder(): OrderItemModel {
    const instance = new OrderItemModel(undefined)

    return instance.applyInRandomOrder()
  }

  static whereColumn(first: keyof OrderItemsTable, operator: Operator, second: keyof OrderItemsTable): OrderItemModel {
    const instance = new OrderItemModel(undefined)

    return instance.applyWhereColumn(first, operator, second)
  }

  static async max(field: keyof OrderItemsTable): Promise<number> {
    const instance = new OrderItemModel(undefined)

    return await instance.applyMax(field)
  }

  static async min(field: keyof OrderItemsTable): Promise<number> {
    const instance = new OrderItemModel(undefined)

    return await instance.applyMin(field)
  }

  static async avg(field: keyof OrderItemsTable): Promise<number> {
    const instance = new OrderItemModel(undefined)

    return await instance.applyAvg(field)
  }

  static async sum(field: keyof OrderItemsTable): Promise<number> {
    const instance = new OrderItemModel(undefined)

    return await instance.applySum(field)
  }

  static async count(): Promise<number> {
    const instance = new OrderItemModel(undefined)

    return instance.applyCount()
  }

  static async get(): Promise<OrderItemModel[]> {
    const instance = new OrderItemModel(undefined)

    const results = await instance.applyGet()

    return results.map((item: OrderItemJsonResponse) => instance.createInstance(item))
  }

  static async pluck<K extends keyof OrderItemModel>(field: K): Promise<OrderItemModel[K][]> {
    const instance = new OrderItemModel(undefined)

    return await instance.applyPluck(field)
  }

  static async chunk(size: number, callback: (models: OrderItemModel[]) => Promise<void>): Promise<void> {
    const instance = new OrderItemModel(undefined)

    await instance.applyChunk(size, async (models) => {
      const modelInstances = models.map((item: OrderItemJsonResponse) => instance.createInstance(item))
      await callback(modelInstances)
    })
  }

  static async paginate(options: { limit?: number, offset?: number, page?: number } = { limit: 10, offset: 0, page: 1 }): Promise<{
    data: OrderItemModel[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }> {
    const instance = new OrderItemModel(undefined)

    const result = await instance.applyPaginate(options)

    return {
      data: result.data.map((item: OrderItemJsonResponse) => instance.createInstance(item)),
      paging: result.paging,
      next_cursor: result.next_cursor,
    }
  }

  // Instance method for creating model instances
  createInstance(data: OrderItemJsonResponse): OrderItemModel {
    return new OrderItemModel(data)
  }

  async applyCreate(newOrderItem: NewOrderItem): Promise<OrderItemModel> {
    const filteredValues = Object.fromEntries(
      Object.entries(newOrderItem).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewOrderItem

    await this.mapCustomSetters(filteredValues)

    const result = await DB.instance.insertInto('order_items')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await DB.instance.selectFrom('order_items')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created OrderItem')
    }

    return this.createInstance(model)
  }

  async create(newOrderItem: NewOrderItem): Promise<OrderItemModel> {
    return await this.applyCreate(newOrderItem)
  }

  static async create(newOrderItem: NewOrderItem): Promise<OrderItemModel> {
    const instance = new OrderItemModel(undefined)
    return await instance.applyCreate(newOrderItem)
  }

  static async firstOrCreate(search: Partial<OrderItemsTable>, values: NewOrderItem = {} as NewOrderItem): Promise<OrderItemModel> {
    // First try to find a record matching the search criteria
    const instance = new OrderItemModel(undefined)

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
    const createData = { ...search, ...values } as NewOrderItem
    return await OrderItemModel.create(createData)
  }

  static async updateOrCreate(search: Partial<OrderItemsTable>, values: NewOrderItem = {} as NewOrderItem): Promise<OrderItemModel> {
    // First try to find a record matching the search criteria
    const instance = new OrderItemModel(undefined)

    // Apply all search conditions
    for (const [key, value] of Object.entries(search)) {
      instance.selectFromQuery = instance.selectFromQuery.where(key, '=', value)
    }

    // Try to find the record
    const existingRecord = await instance.applyFirst()

    if (existingRecord) {
      // If record exists, update it with the new values
      const model = instance.createInstance(existingRecord)
      const updatedModel = await model.update(values as OrderItemUpdate)

      // Return the updated model instance
      if (updatedModel) {
        return updatedModel
      }

      // If update didn't return a model, fetch it again to ensure we have latest data
      const refreshedModel = await instance.applyFirst()
      return instance.createInstance(refreshedModel!)
    }

    // If no record exists, create a new one with combined search criteria and values
    const createData = { ...search, ...values } as NewOrderItem
    return await OrderItemModel.create(createData)
  }

  async update(newOrderItem: OrderItemUpdate): Promise<OrderItemModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newOrderItem).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as OrderItemUpdate

    await this.mapCustomSetters(filteredValues)

    filteredValues.updated_at = new Date().toISOString()

    await DB.instance.updateTable('order_items')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('order_items')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated OrderItem')
      }

      return this.createInstance(model)
    }

    return undefined
  }

  async forceUpdate(newOrderItem: OrderItemUpdate): Promise<OrderItemModel | undefined> {
    await DB.instance.updateTable('order_items')
      .set(newOrderItem)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('order_items')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated OrderItem')
      }

      return this.createInstance(model)
    }

    return undefined
  }

  async save(): Promise<OrderItemModel> {
    // If the model has an ID, update it; otherwise, create a new record
    if (this.id) {
      // Update existing record
      await DB.instance.updateTable('order_items')
        .set(this.attributes as OrderItemUpdate)
        .where('id', '=', this.id)
        .executeTakeFirst()

      // Get the updated data
      const model = await DB.instance.selectFrom('order_items')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated OrderItem')
      }

      return this.createInstance(model)
    }
    else {
      // Create new record
      const result = await DB.instance.insertInto('order_items')
        .values(this.attributes as NewOrderItem)
        .executeTakeFirst()

      // Get the created data
      const model = await DB.instance.selectFrom('order_items')
        .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve created OrderItem')
      }

      return this.createInstance(model)
    }
  }

  static async createMany(newOrderItem: NewOrderItem[]): Promise<void> {
    const instance = new OrderItemModel(undefined)

    const valuesFiltered = newOrderItem.map((newOrderItem: NewOrderItem) => {
      const filteredValues = Object.fromEntries(
        Object.entries(newOrderItem).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewOrderItem

      return filteredValues
    })

    await DB.instance.insertInto('order_items')
      .values(valuesFiltered)
      .executeTakeFirst()
  }

  static async forceCreate(newOrderItem: NewOrderItem): Promise<OrderItemModel> {
    const result = await DB.instance.insertInto('order_items')
      .values(newOrderItem)
      .executeTakeFirst()

    const instance = new OrderItemModel(undefined)
    const model = await DB.instance.selectFrom('order_items')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created OrderItem')
    }

    return instance.createInstance(model)
  }

  // Method to remove a OrderItem
  async delete(): Promise<number> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()

    const deleted = await DB.instance.deleteFrom('order_items')
      .where('id', '=', this.id)
      .execute()

    return deleted.numDeletedRows
  }

  static async remove(id: number): Promise<any> {
    return await DB.instance.deleteFrom('order_items')
      .where('id', '=', id)
      .execute()
  }

  static whereQuantity(value: string): OrderItemModel {
    const instance = new OrderItemModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('quantity', '=', value)

    return instance
  }

  static wherePrice(value: string): OrderItemModel {
    const instance = new OrderItemModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('price', '=', value)

    return instance
  }

  static whereSpecialInstructions(value: string): OrderItemModel {
    const instance = new OrderItemModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('special_instructions', '=', value)

    return instance
  }

  static whereIn<V = number>(column: keyof OrderItemsTable, values: V[]): OrderItemModel {
    const instance = new OrderItemModel(undefined)

    return instance.applyWhereIn<V>(column, values)
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

  static distinct(column: keyof OrderItemJsonResponse): OrderItemModel {
    const instance = new OrderItemModel(undefined)

    return instance.applyDistinct(column)
  }

  static join(table: string, firstCol: string, secondCol: string): OrderItemModel {
    const instance = new OrderItemModel(undefined)

    return instance.applyJoin(table, firstCol, secondCol)
  }

  toJSON(): OrderItemJsonResponse {
    const output = {

      id: this.id,
      quantity: this.quantity,
      price: this.price,
      special_instructions: this.special_instructions,

      created_at: this.created_at,

      updated_at: this.updated_at,

      order_id: this.order_id,
      order: this.order,
      product_id: this.product_id,
      product: this.product,
      ...this.customColumns,
    }

    return output
  }

  parseResult(model: OrderItemModel): OrderItemModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof OrderItemModel]
    }

    return model
  }

  // Add a protected applyFind implementation
  protected async applyFind(id: number): Promise<OrderItemModel | undefined> {
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

export async function find(id: number): Promise<OrderItemModel | undefined> {
  const query = DB.instance.selectFrom('order_items').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  const instance = new OrderItemModel(undefined)
  return instance.createInstance(model)
}

export async function count(): Promise<number> {
  const results = await OrderItemModel.count()

  return results
}

export async function create(newOrderItem: NewOrderItem): Promise<OrderItemModel> {
  const instance = new OrderItemModel(undefined)
  return await instance.applyCreate(newOrderItem)
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(DB.instance)
}

export async function remove(id: number): Promise<void> {
  await DB.instance.deleteFrom('order_items')
    .where('id', '=', id)
    .execute()
}

export async function whereQuantity(value: number): Promise<OrderItemModel[]> {
  const query = DB.instance.selectFrom('order_items').where('quantity', '=', value)
  const results: OrderItemJsonResponse = await query.execute()

  return results.map((modelItem: OrderItemJsonResponse) => new OrderItemModel(modelItem))
}

export async function wherePrice(value: number): Promise<OrderItemModel[]> {
  const query = DB.instance.selectFrom('order_items').where('price', '=', value)
  const results: OrderItemJsonResponse = await query.execute()

  return results.map((modelItem: OrderItemJsonResponse) => new OrderItemModel(modelItem))
}

export async function whereSpecialInstructions(value: string): Promise<OrderItemModel[]> {
  const query = DB.instance.selectFrom('order_items').where('special_instructions', '=', value)
  const results: OrderItemJsonResponse = await query.execute()

  return results.map((modelItem: OrderItemJsonResponse) => new OrderItemModel(modelItem))
}

export const OrderItem = OrderItemModel

export default OrderItem
