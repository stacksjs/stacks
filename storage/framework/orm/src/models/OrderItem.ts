import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import type { OrderModel } from './Order'
import type { ProductModel } from './Product'
import { cache } from '@stacksjs/cache'
import { sql } from '@stacksjs/database'
import { HttpError, ModelNotFoundException } from '@stacksjs/error-handling'

import { BaseOrm, DB, SubqueryBuilder } from '@stacksjs/orm'

import Order from './Order'

import Product from './Product'

export interface OrderItemsTable {
  id: Generated<number>
  order_id: number
  product_id: number
  quantity: number
  price: number
  special_instructions?: string

  created_at?: Date

  updated_at?: Date

}

export interface OrderItemResponse {
  data: OrderItemJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface OrderItemJsonResponse extends Omit<Selectable<OrderItemsTable>, 'password'> {
  [key: string]: any
}

export type NewOrderItem = Insertable<OrderItemsTable>
export type OrderItemUpdate = Updateable<OrderItemsTable>

      type SortDirection = 'asc' | 'desc'
interface SortOptions { column: OrderItemJsonResponse, order: SortDirection }
// Define a type for the options parameter
interface QueryOptions {
  sort?: SortOptions
  limit?: number
  offset?: number
  page?: number
}

export class OrderItemModel extends BaseOrm<OrderItemModel, OrderItemsTable> {
  private readonly hidden: Array<keyof OrderItemJsonResponse> = []
  private readonly fillable: Array<keyof OrderItemJsonResponse> = ['quantity', 'price', 'special_instructions', 'uuid', 'order_id']
  private readonly guarded: Array<keyof OrderItemJsonResponse> = []
  protected attributes = {} as OrderItemJsonResponse
  protected originalAttributes = {} as OrderItemJsonResponse

  protected selectFromQuery: any
  protected updateFromQuery: any
  protected deleteFromQuery: any
  protected hasSelect: boolean
  private hasSaved: boolean
  private customColumns: Record<string, unknown> = {}

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
    this.hasSaved = false
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
          model[key] = fn()
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
        model[key] = fn()
      }
    }
  }

  async mapCustomSetters(model: NewOrderItem | OrderItemUpdate): Promise<void> {
    const customSetter = {
      default: () => {
      },

    }

    for (const [key, fn] of Object.entries(customSetter)) {
      model[key] = await fn()
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

  get created_at(): Date | undefined {
    return this.attributes.created_at
  }

  get updated_at(): Date | undefined {
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

  set updated_at(value: Date) {
    this.attributes.updated_at = value
  }

  getOriginal(column?: keyof OrderItemJsonResponse): Partial<OrderItemJsonResponse> {
    if (column) {
      return this.originalAttributes[column]
    }

    return this.originalAttributes
  }

  getChanges(): Partial<OrderItemJsonResponse> {
    return this.fillable.reduce<Partial<OrderItemJsonResponse>>((changes, key) => {
      const currentValue = this.attributes[key as keyof OrderItemsTable]
      const originalValue = this.originalAttributes[key as keyof OrderItemsTable]

      if (currentValue !== originalValue) {
        changes[key] = currentValue
      }

      return changes
    }, {})
  }

  isDirty(column?: keyof OrderItemJsonResponse): boolean {
    if (column) {
      return this.attributes[column] !== this.originalAttributes[column]
    }

    return Object.entries(this.originalAttributes).some(([key, originalValue]) => {
      const currentValue = (this.attributes as any)[key]

      return currentValue !== originalValue
    })
  }

  isClean(column?: keyof OrderItemJsonResponse): boolean {
    return !this.isDirty(column)
  }

  wasChanged(column?: keyof OrderItemJsonResponse): boolean {
    return this.hasSaved && this.isDirty(column)
  }

  select(params: (keyof OrderItemJsonResponse)[] | RawBuilder<string> | string): OrderItemModel {
    this.selectFromQuery = this.selectFromQuery.select(params)

    this.hasSelect = true

    return this
  }

  static select(params: (keyof OrderItemJsonResponse)[] | RawBuilder<string> | string): OrderItemModel {
    const instance = new OrderItemModel(undefined)

    // Initialize a query with the table name and selected fields
    instance.selectFromQuery = instance.selectFromQuery.select(params)

    instance.hasSelect = true

    return instance
  }

  // Method to find a OrderItem by ID
  static async find(id: number): Promise<OrderItemModel | undefined> {
    const instance = new OrderItemModel(undefined)

    return await instance.applyFind(id)
  }

  async first(): Promise<OrderItemModel | undefined> {
    const model = await this.applyFirst()

    const data = new OrderItemModel(model)

    return data
  }

  static async first(): Promise<OrderItemModel | undefined> {
    const instance = new OrderItemModel(undefined)

    const model = await instance.applyFirst()

    const data = new OrderItemModel(model)

    return data
  }

  async applyFirstOrFail(): Promise<OrderItemModel | undefined> {
    const model = await this.selectFromQuery.executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, 'No OrderItemModel results found for query')

    if (model) {
      this.mapCustomGetters(model)
      await this.loadRelations(model)
    }

    const data = new OrderItemModel(model)

    return data
  }

  async firstOrFail(): Promise<OrderItemModel | undefined> {
    return await this.applyFirstOrFail()
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

  async applyFindOrFail(id: number): Promise<OrderItemModel> {
    const model = await DB.instance.selectFrom('order_items').where('id', '=', id).selectAll().executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, `No OrderItemModel results for ${id}`)

    cache.getOrSet(`orderItem:${id}`, JSON.stringify(model))

    this.mapCustomGetters(model)
    await this.loadRelations(model)

    const data = new OrderItemModel(model)

    return data
  }

  async findOrFail(id: number): Promise<OrderItemModel> {
    return await this.applyFindOrFail(id)
  }

  static async findOrFail(id: number): Promise<OrderItemModel> {
    const instance = new OrderItemModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  async applyFindMany(ids: number[]): Promise<OrderItemModel[]> {
    let query = DB.instance.selectFrom('order_items').where('id', 'in', ids)

    const instance = new OrderItemModel(undefined)

    query = query.selectAll()

    const models = await query.execute()

    instance.mapCustomGetters(models)
    await instance.loadRelations(models)

    return models.map((modelItem: OrderItemJsonResponse) => instance.parseResult(new OrderItemModel(modelItem)))
  }

  static async findMany(ids: number[]): Promise<OrderItemModel[]> {
    const instance = new OrderItemModel(undefined)

    return await instance.applyFindMany(ids)
  }

  async findMany(ids: number[]): Promise<OrderItemModel[]> {
    return await this.applyFindMany(ids)
  }

  skip(count: number): OrderItemModel {
    this.selectFromQuery = this.selectFromQuery.offset(count)

    return this
  }

  static skip(count: number): OrderItemModel {
    const instance = new OrderItemModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.offset(count)

    return instance
  }

  async applyChunk(size: number, callback: (models: OrderItemModel[]) => Promise<void>): Promise<void> {
    let page = 1
    let hasMore = true

    while (hasMore) {
      // Get one batch
      const models = await this.selectFromQuery
        .selectAll()
        .limit(size)
        .offset((page - 1) * size)
        .execute()

      // If we got fewer results than chunk size, this is the last batch
      if (models.length < size) {
        hasMore = false
      }

      // Process this batch
      if (models.length > 0) {
        await callback(models)
      }

      page++
    }
  }

  async chunk(size: number, callback: (models: OrderItemModel[]) => Promise<void>): Promise<void> {
    await this.applyChunk(size, callback)
  }

  static async chunk(size: number, callback: (models: OrderItemModel[]) => Promise<void>): Promise<void> {
    const instance = new OrderItemModel(undefined)

    await instance.applyChunk(size, callback)
  }

  take(count: number): OrderItemModel {
    this.selectFromQuery = this.selectFromQuery.limit(count)

    return this
  }

  static take(count: number): OrderItemModel {
    const instance = new OrderItemModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.limit(count)

    return instance
  }

  static async pluck<K extends keyof OrderItemModel>(field: K): Promise<OrderItemModel[K][]> {
    const instance = new OrderItemModel(undefined)

    if (instance.hasSelect) {
      const model = await instance.selectFromQuery.execute()
      return model.map((modelItem: OrderItemModel) => modelItem[field])
    }

    const model = await instance.selectFromQuery.selectAll().execute()

    return model.map((modelItem: OrderItemModel) => modelItem[field])
  }

  async pluck<K extends keyof OrderItemModel>(field: K): Promise<OrderItemModel[K][]> {
    if (this.hasSelect) {
      const model = await this.selectFromQuery.execute()
      return model.map((modelItem: OrderItemModel) => modelItem[field])
    }

    const model = await this.selectFromQuery.selectAll().execute()

    return model.map((modelItem: OrderItemModel) => modelItem[field])
  }

  static async count(): Promise<number> {
    const instance = new OrderItemModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`COUNT(*) as count`)
      .executeTakeFirst()

    return result.count || 0
  }

  async count(): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`COUNT(*) as count`)
      .executeTakeFirst()

    return result.count || 0
  }

  static async max(field: keyof OrderItemModel): Promise<number> {
    const instance = new OrderItemModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`MAX(${sql.raw(field as string)}) as max `)
      .executeTakeFirst()

    return result.max
  }

  async max(field: keyof OrderItemModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`MAX(${sql.raw(field as string)}) as max`)
      .executeTakeFirst()

    return result.max
  }

  static async min(field: keyof OrderItemModel): Promise<number> {
    const instance = new OrderItemModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`MIN(${sql.raw(field as string)}) as min `)
      .executeTakeFirst()

    return result.min
  }

  async min(field: keyof OrderItemModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`MIN(${sql.raw(field as string)}) as min `)
      .executeTakeFirst()

    return result.min
  }

  static async avg(field: keyof OrderItemModel): Promise<number> {
    const instance = new OrderItemModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`AVG(${sql.raw(field as string)}) as avg `)
      .executeTakeFirst()

    return result.avg
  }

  async avg(field: keyof OrderItemModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`AVG(${sql.raw(field as string)}) as avg `)
      .executeTakeFirst()

    return result.avg
  }

  static async sum(field: keyof OrderItemModel): Promise<number> {
    const instance = new OrderItemModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`SUM(${sql.raw(field as string)}) as sum `)
      .executeTakeFirst()

    return result.sum
  }

  async sum(field: keyof OrderItemModel): Promise<number> {
    const result = this.selectFromQuery
      .select(sql`SUM(${sql.raw(field as string)}) as sum `)
      .executeTakeFirst()

    return result.sum
  }

  async applyGet(): Promise<OrderItemModel[]> {
    let models

    if (this.hasSelect) {
      models = await this.selectFromQuery.execute()
    }
    else {
      models = await this.selectFromQuery.selectAll().execute()
    }

    this.mapCustomGetters(models)
    await this.loadRelations(models)

    const data = await Promise.all(models.map(async (model: OrderItemJsonResponse) => {
      return new OrderItemModel(model)
    }))

    return data
  }

  async get(): Promise<OrderItemModel[]> {
    return await this.applyGet()
  }

  static async get(): Promise<OrderItemModel[]> {
    const instance = new OrderItemModel(undefined)

    return await instance.applyGet()
  }

  has(relation: string): OrderItemModel {
    this.selectFromQuery = this.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(
        selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.orderItem_id`, '=', 'order_items.id'),
      ),
    )

    return this
  }

  static has(relation: string): OrderItemModel {
    const instance = new OrderItemModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(
        selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.orderItem_id`, '=', 'order_items.id'),
      ),
    )

    return instance
  }

  static whereExists(callback: (qb: any) => any): OrderItemModel {
    const instance = new OrderItemModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(callback({ exists, selectFrom })),
    )

    return instance
  }

  applyWhereHas(
    relation: string,
    callback: (query: SubqueryBuilder<keyof OrderItemModel>) => void,
  ): OrderItemModel {
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    this.selectFromQuery = this.selectFromQuery
      .where(({ exists, selectFrom }: any) => {
        let subquery = selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.orderItem_id`, '=', 'order_items.id')

        conditions.forEach((condition) => {
          switch (condition.method) {
            case 'where':
              if (condition.type === 'and') {
                subquery = subquery.where(condition.column, condition.operator!, condition.value)
              }
              else {
                subquery = subquery.orWhere(condition.column, condition.operator!, condition.value)
              }
              break

            case 'whereIn':
              if (condition.operator === 'is not') {
                subquery = subquery.whereNotIn(condition.column, condition.values)
              }
              else {
                subquery = subquery.whereIn(condition.column, condition.values)
              }

              break

            case 'whereNull':
              subquery = subquery.whereNull(condition.column)
              break

            case 'whereNotNull':
              subquery = subquery.whereNotNull(condition.column)
              break

            case 'whereBetween':
              subquery = subquery.whereBetween(condition.column, condition.values)
              break

            case 'whereExists': {
              const nestedBuilder = new SubqueryBuilder()
              condition.callback!(nestedBuilder)
              break
            }
          }
        })

        return exists(subquery)
      })

    return this
  }

  whereHas(
    relation: string,
    callback: (query: SubqueryBuilder<keyof OrderItemModel>) => void,
  ): OrderItemModel {
    return this.applyWhereHas(relation, callback)
  }

  static whereHas(
    relation: string,
    callback: (query: SubqueryBuilder<keyof OrderItemModel>) => void,
  ): OrderItemModel {
    const instance = new OrderItemModel(undefined)

    return instance.applyWhereHas(relation, callback)
  }

  applyDoesntHave(relation: string): OrderItemModel {
    this.selectFromQuery = this.selectFromQuery.where(({ not, exists, selectFrom }: any) =>
      not(
        exists(
          selectFrom(relation)
            .select('1')
            .whereRef(`${relation}.orderItem_id`, '=', 'order_items.id'),
        ),
      ),
    )

    return this
  }

  doesntHave(relation: string): OrderItemModel {
    return this.applyDoesntHave(relation)
  }

  static doesntHave(relation: string): OrderItemModel {
    const instance = new OrderItemModel(undefined)

    return instance.applyDoesntHave(relation)
  }

  applyWhereDoesntHave(relation: string, callback: (query: SubqueryBuilder<OrderItemsTable>) => void): OrderItemModel {
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    this.selectFromQuery = this.selectFromQuery
      .where(({ exists, selectFrom, not }: any) => {
        const subquery = selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.orderItem_id`, '=', 'order_items.id')

        return not(exists(subquery))
      })

    conditions.forEach((condition) => {
      switch (condition.method) {
        case 'where':
          if (condition.type === 'and') {
            this.where(condition.column, condition.operator!, condition.value || [])
          }
          break

        case 'whereIn':
          if (condition.operator === 'is not') {
            this.whereNotIn(condition.column, condition.values || [])
          }
          else {
            this.whereIn(condition.column, condition.values || [])
          }

          break

        case 'whereNull':
          this.whereNull(condition.column)
          break

        case 'whereNotNull':
          this.whereNotNull(condition.column)
          break

        case 'whereBetween':
          this.whereBetween(condition.column, condition.range || [0, 0])
          break

        case 'whereExists': {
          const nestedBuilder = new SubqueryBuilder()
          condition.callback!(nestedBuilder)
          break
        }
      }
    })

    return this
  }

  whereDoesntHave(relation: string, callback: (query: SubqueryBuilder<OrderItemsTable>) => void): OrderItemModel {
    return this.applyWhereDoesntHave(relation, callback)
  }

  static whereDoesntHave(
    relation: string,
    callback: (query: SubqueryBuilder<OrderItemsTable>) => void,
  ): OrderItemModel {
    const instance = new OrderItemModel(undefined)

    return instance.applyWhereDoesntHave(relation, callback)
  }

  async applyPaginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<OrderItemResponse> {
    const totalRecordsResult = await DB.instance.selectFrom('order_items')
      .select(DB.instance.fn.count('id').as('total')) // Use 'id' or another actual column name
      .executeTakeFirst()

    const totalRecords = Number(totalRecordsResult?.total) || 0
    const totalPages = Math.ceil(totalRecords / (options.limit ?? 10))

    const order_itemsWithExtra = await DB.instance.selectFrom('order_items')
      .selectAll()
      .orderBy('id', 'asc') // Assuming 'id' is used for cursor-based pagination
      .limit((options.limit ?? 10) + 1) // Fetch one extra record
      .offset(((options.page ?? 1) - 1) * (options.limit ?? 10)) // Ensure options.page is not undefined
      .execute()

    let nextCursor = null
    if (order_itemsWithExtra.length > (options.limit ?? 10))
      nextCursor = order_itemsWithExtra.pop()?.id ?? null

    return {
      data: order_itemsWithExtra,
      paging: {
        total_records: totalRecords,
        page: options.page || 1,
        total_pages: totalPages,
      },
      next_cursor: nextCursor,
    }
  }

  async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<OrderItemResponse> {
    return await this.applyPaginate(options)
  }

  // Method to get all order_items
  static async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<OrderItemResponse> {
    const instance = new OrderItemModel(undefined)

    return await instance.applyPaginate(options)
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

    const model = await this.find(Number(result.numInsertedOrUpdatedRows)) as OrderItemModel

    return model
  }

  async create(newOrderItem: NewOrderItem): Promise<OrderItemModel> {
    return await this.applyCreate(newOrderItem)
  }

  static async create(newOrderItem: NewOrderItem): Promise<OrderItemModel> {
    const instance = new OrderItemModel(undefined)

    return await instance.applyCreate(newOrderItem)
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

    const model = await find(Number(result.numInsertedOrUpdatedRows)) as OrderItemModel

    return model
  }

  // Method to remove a OrderItem
  static async remove(id: number): Promise<any> {
    return await DB.instance.deleteFrom('order_items')
      .where('id', '=', id)
      .execute()
  }

  static where<V = string>(column: keyof OrderItemsTable, ...args: [V] | [Operator, V]): OrderItemModel {
    const instance = new OrderItemModel(undefined)

    return instance.applyWhere<V>(column, ...args)
  }

  static whereColumn(first: keyof OrderItemsTable, operator: Operator, second: keyof OrderItemsTable): OrderItemModel {
    const instance = new OrderItemModel(undefined)

    instance.selectFromQuery = instance.applyWhereColumn(first, operator, second)

    return instance
  }

  static whereRef(column: keyof OrderItemsTable, ...args: string[]): OrderItemModel {
    const instance = new OrderItemModel(undefined)

    return instance.applyWhereRef(column, ...args)
  }

  static whereRaw(sqlStatement: string): OrderItemModel {
    const instance = new OrderItemModel(undefined)

    instance.selectFromQuery = instance.applyWhereRaw(sqlStatement)

    return instance
  }

  static orWhere(...conditions: [string, any][]): OrderItemModel {
    const instance = new OrderItemModel(undefined)

    return instance.applyOrWhere(...conditions)
  }

  static when(condition: boolean, callback: (query: OrderItemModel) => OrderItemModel): OrderItemModel {
    const instance = new OrderItemModel(undefined)

    return instance.applyWhen(condition, callback)
  }

  static whereNotNull(column: keyof OrderItemsTable): OrderItemModel {
    const instance = new UserModel(undefined)

    return instance.applyWhereNotNull(column)
  }

  static whereNull(column: keyof OrderItemsTable): OrderItemModel {
    const instance = new OrderItemModel(undefined)

    return instance.applyWhereNull(column)
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

  static whereBetween<V = number>(column: keyof OrderItemsTable, range: [V, V]): OrderItemModel {
    const instance = new OrderItemModel(undefined)

    return instance.applyWhereBetween<V>(column, range)
  }

  static whereLike(column: keyof OrderItemsTable, value: string): OrderItemModel {
    const instance = new OrderItemModel(undefined)

    return instance.applyWhereLike(column, value)
  }

  static whereNotIn<V = number>(column: keyof OrderItemsTable, values: V[]): OrderItemModel {
    const instance = new OrderItemModel(undefined)

    return instance.applyWhereNotIn<V>(column, values)
  }

  async exists(): Promise<boolean> {
    let model

    if (this.hasSelect) {
      model = await this.selectFromQuery.executeTakeFirst()
    }
    else {
      model = await this.selectFromQuery.selectAll().executeTakeFirst()
    }

    return model !== null && model !== undefined
  }

  static async latest(): Promise<OrderItemModel | undefined> {
    const instance = new OrderItemModel(undefined)

    const model = await DB.instance.selectFrom('order_items')
      .selectAll()
      .orderBy('id', 'desc')
      .executeTakeFirst()

    if (!model)
      return undefined

    instance.mapCustomGetters(model)

    const data = new OrderItemModel(model)

    return data
  }

  static async oldest(): Promise<OrderItemModel | undefined> {
    const instance = new OrderItemModel(undefined)

    const model = await DB.instance.selectFrom('order_items')
      .selectAll()
      .orderBy('id', 'asc')
      .executeTakeFirst()

    if (!model)
      return undefined

    instance.mapCustomGetters(model)

    const data = new OrderItemModel(model)

    return data
  }

  static async firstOrCreate(
    condition: Partial<OrderItemJsonResponse>,
    newOrderItem: NewOrderItem,
  ): Promise<OrderItemModel> {
    const instance = new OrderItemModel(undefined)

    const key = Object.keys(condition)[0] as keyof OrderItemJsonResponse

    if (!key) {
      throw new HttpError(500, 'Condition must contain at least one key-value pair')
    }

    const value = condition[key]

    // Attempt to find the first record matching the condition
    const existingOrderItem = await DB.instance.selectFrom('order_items')
      .selectAll()
      .where(key, '=', value)
      .executeTakeFirst()

    if (existingOrderItem) {
      instance.mapCustomGetters(existingOrderItem)
      await instance.loadRelations(existingOrderItem)

      return new OrderItemModel(existingOrderItem as OrderItemJsonResponse)
    }
    else {
      return await instance.create(newOrderItem)
    }
  }

  static async updateOrCreate(
    condition: Partial<OrderItemJsonResponse>,
    newOrderItem: NewOrderItem,
  ): Promise<OrderItemModel> {
    const instance = new OrderItemModel(undefined)

    const key = Object.keys(condition)[0] as keyof OrderItemJsonResponse

    if (!key) {
      throw new HttpError(500, 'Condition must contain at least one key-value pair')
    }

    const value = condition[key]

    // Attempt to find the first record matching the condition
    const existingOrderItem = await DB.instance.selectFrom('order_items')
      .selectAll()
      .where(key, '=', value)
      .executeTakeFirst()

    if (existingOrderItem) {
      // If found, update the existing record
      await DB.instance.updateTable('order_items')
        .set(newOrderItem)
        .where(key, '=', value)
        .executeTakeFirstOrThrow()

      // Fetch and return the updated record
      const updatedOrderItem = await DB.instance.selectFrom('order_items')
        .selectAll()
        .where(key, '=', value)
        .executeTakeFirst()

      if (!updatedOrderItem) {
        throw new HttpError(500, 'Failed to fetch updated record')
      }

      instance.hasSaved = true

      return new OrderItemModel(updatedOrderItem as OrderItemJsonResponse)
    }
    else {
      // If not found, create a new record
      return await instance.create(newOrderItem)
    }
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

    instance.withRelations = relations

    return instance
  }

  async last(): Promise<OrderItemModel | undefined> {
    const model = await this.applyLast()

    const data = new OrderItemModel(model)

    return data
  }

  static async last(): Promise<OrderItemModel | undefined> {
    const instance = new OrderItemModel(undefined)

    const model = await instance.applyLast()

    if (!model)
      return undefined

    const data = new OrderItemModel(model)

    return data
  }

  static orderBy(column: keyof OrderItemsTable, order: 'asc' | 'desc'): OrderItemModel {
    const instance = new UserModel(undefined)

    return instance.applyOrderBy(column, order)
  }

  static groupBy(column: keyof OrderItemsTable): OrderItemModel {
    const instance = new OrderItemModel(undefined)

    return instance.applyGroupBy(column)
  }

  static having<V = string>(column: keyof OrderItemsTable, operator: Operator, value: V): OrderItemModel {
    const instance = new OrderItemModel(undefined)

    return instance.applyHaving(column, operator, value)
  }

  static inRandomOrder(): OrderItemModel {
    const instance = new OrderItemModel(undefined)

    return instance.applyInRandomOrder()
  }

  static orderByDesc(column: keyof OrderItemsTable): OrderItemModel {
    const instance = new OrderItemModel(undefined)

    return instance.applyOrderByDesc(column)
  }

  static orderByAsc(column: keyof OrderItemsTable): OrderItemModel {
    const instance = new OrderItemModel(undefined)

    return instance.applyOrderByAsc(column)
  }

  async update(newOrderItem: OrderItemUpdate): Promise<OrderItemModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newOrderItem).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewOrderItem

    await this.mapCustomSetters(filteredValues)

    await DB.instance.updateTable('order_items')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      const model = await this.find(this.id)

      return model
    }

    this.hasSaved = true

    return undefined
  }

  async forceUpdate(orderItem: OrderItemUpdate): Promise<OrderItemModel | undefined> {
    if (this.id === undefined) {
      this.updateFromQuery.set(orderItem).execute()
    }

    await this.mapCustomSetters(orderItem)

    await DB.instance.updateTable('order_items')
      .set(orderItem)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      const model = await this.find(this.id)

      this.hasSaved = true

      return model
    }

    return undefined
  }

  async save(): Promise<void> {
    if (!this)
      throw new HttpError(500, 'OrderItem data is undefined')

    await this.mapCustomSetters(this.attributes)

    if (this.id === undefined) {
      await this.create(this.attributes)
    }
    else {
      await this.update(this.attributes)
    }

    this.hasSaved = true
  }

  fill(data: Partial<OrderItemJsonResponse>): OrderItemModel {
    const filteredValues = Object.fromEntries(
      Object.entries(data).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewOrderItem

    this.attributes = {
      ...this.attributes,
      ...filteredValues,
    }

    return this
  }

  forceFill(data: Partial<OrderItemJsonResponse>): OrderItemModel {
    this.attributes = {
      ...this.attributes,
      ...data,
    }

    return this
  }

  // Method to delete (soft delete) the orderItem instance
  async delete(): Promise<OrderItemsTable> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()

    return await DB.instance.deleteFrom('order_items')
      .where('id', '=', this.id)
      .execute()
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

  distinct(column: keyof OrderItemJsonResponse): OrderItemModel {
    this.selectFromQuery = this.selectFromQuery.select(column).distinct()

    this.hasSelect = true

    return this
  }

  static distinct(column: keyof OrderItemJsonResponse): OrderItemModel {
    const instance = new OrderItemModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.select(column).distinct()

    instance.hasSelect = true

    return instance
  }

  join(table: string, firstCol: string, secondCol: string): OrderItemModel {
    this.selectFromQuery = this.selectFromQuery.innerJoin(table, firstCol, secondCol)

    return this
  }

  static join(table: string, firstCol: string, secondCol: string): OrderItemModel {
    const instance = new OrderItemModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.innerJoin(table, firstCol, secondCol)

    return instance
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
}

async function find(id: number): Promise<OrderItemModel | undefined> {
  const query = DB.instance.selectFrom('order_items').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  return new OrderItemModel(model)
}

export async function count(): Promise<number> {
  const results = await OrderItemModel.count()

  return results
}

export async function create(newOrderItem: NewOrderItem): Promise<OrderItemModel> {
  const result = await DB.instance.insertInto('order_items')
    .values(newOrderItem)
    .executeTakeFirstOrThrow()

  return await find(Number(result.numInsertedOrUpdatedRows)) as OrderItemModel
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
