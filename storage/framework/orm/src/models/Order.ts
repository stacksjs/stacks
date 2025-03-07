import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import type { CouponModel } from './Coupon'
import type { CustomerModel } from './Customer'
import type { OrderItemModel } from './OrderItem'
import { randomUUIDv7 } from 'bun'
import { cache } from '@stacksjs/cache'
import { sql } from '@stacksjs/database'
import { HttpError, ModelNotFoundException } from '@stacksjs/error-handling'

import { dispatch } from '@stacksjs/events'

import { DB, SubqueryBuilder } from '@stacksjs/orm'

import Coupon from './Coupon'

import Customer from './Customer'

export interface OrdersTable {
  id: Generated<number>
  order_items: OrderItemModel[] | []
  customer_id: number
  customer?: CustomerModel
  coupon_id: number
  coupon?: CouponModel
  status: string
  total_amount: number
  tax_amount?: number
  discount_amount?: number
  delivery_fee?: number
  tip_amount?: number
  order_type: string
  delivery_address?: string
  special_instructions?: string
  estimated_delivery_time?: string
  applied_coupon_id?: string
  uuid?: string

  created_at?: Date

  updated_at?: Date

}

export interface OrderResponse {
  data: OrderJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface OrderJsonResponse extends Omit<OrdersTable, 'password'> {
  [key: string]: any
}

export type OrderType = Selectable<OrdersTable>
export type NewOrder = Partial<Insertable<OrdersTable>>
export type OrderUpdate = Updateable<OrdersTable>

      type SortDirection = 'asc' | 'desc'
interface SortOptions { column: OrderType, order: SortDirection }
// Define a type for the options parameter
interface QueryOptions {
  sort?: SortOptions
  limit?: number
  offset?: number
  page?: number
}

export class OrderModel {
  private readonly hidden: Array<keyof OrderJsonResponse> = []
  private readonly fillable: Array<keyof OrderJsonResponse> = ['status', 'total_amount', 'tax_amount', 'discount_amount', 'delivery_fee', 'tip_amount', 'order_type', 'delivery_address', 'special_instructions', 'estimated_delivery_time', 'applied_coupon_id', 'uuid', 'customer_id', 'gift_card_id', 'coupon_id']
  private readonly guarded: Array<keyof OrderJsonResponse> = []
  protected attributes: Partial<OrderJsonResponse> = {}
  protected originalAttributes: Partial<OrderJsonResponse> = {}

  protected selectFromQuery: any
  protected withRelations: string[]
  protected updateFromQuery: any
  protected deleteFromQuery: any
  protected hasSelect: boolean
  private hasSaved: boolean
  private customColumns: Record<string, unknown> = {}

  constructor(order: OrderJsonResponse | undefined) {
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
    this.hasSaved = false
  }

  mapCustomGetters(models: OrderJsonResponse | OrderJsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: OrderJsonResponse) => {
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

  async mapCustomSetters(model: NewOrder): Promise<void> {
    const customSetter = {
      default: () => {
      },

    }

    for (const [key, fn] of Object.entries(customSetter)) {
      model[key] = await fn()
    }
  }

  get order_items(): OrderItemModel[] | undefined {
    return this.attributes.order_items
  }

  get customer_id(): number | undefined {
    return this.attributes.customer_id
  }

  get customer(): CustomerModel | undefined {
    return this.attributes.customer
  }

  get coupon_id(): number | undefined {
    return this.attributes.coupon_id
  }

  get coupon(): CouponModel | undefined {
    return this.attributes.coupon
  }

  get id(): number | undefined {
    return this.attributes.id
  }

  get uuid(): string | undefined {
    return this.attributes.uuid
  }

  get status(): string | undefined {
    return this.attributes.status
  }

  get total_amount(): number | undefined {
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

  get order_type(): string | undefined {
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

  get created_at(): Date | undefined {
    return this.attributes.created_at
  }

  get updated_at(): Date | undefined {
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

  set updated_at(value: Date) {
    this.attributes.updated_at = value
  }

  getOriginal(column?: keyof OrderJsonResponse): Partial<OrderJsonResponse> {
    if (column) {
      return this.originalAttributes[column]
    }

    return this.originalAttributes
  }

  getChanges(): Partial<OrderJsonResponse> {
    return this.fillable.reduce<Partial<OrderJsonResponse>>((changes, key) => {
      const currentValue = this.attributes[key as keyof OrdersTable]
      const originalValue = this.originalAttributes[key as keyof OrdersTable]

      if (currentValue !== originalValue) {
        changes[key] = currentValue
      }

      return changes
    }, {})
  }

  isDirty(column?: keyof OrderType): boolean {
    if (column) {
      return this.attributes[column] !== this.originalAttributes[column]
    }

    return Object.entries(this.originalAttributes).some(([key, originalValue]) => {
      const currentValue = (this.attributes as any)[key]

      return currentValue !== originalValue
    })
  }

  isClean(column?: keyof OrderType): boolean {
    return !this.isDirty(column)
  }

  wasChanged(column?: keyof OrderType): boolean {
    return this.hasSaved && this.isDirty(column)
  }

  select(params: (keyof OrderType)[] | RawBuilder<string> | string): OrderModel {
    this.selectFromQuery = this.selectFromQuery.select(params)

    this.hasSelect = true

    return this
  }

  static select(params: (keyof OrderType)[] | RawBuilder<string> | string): OrderModel {
    const instance = new OrderModel(undefined)

    // Initialize a query with the table name and selected fields
    instance.selectFromQuery = instance.selectFromQuery.select(params)

    instance.hasSelect = true

    return instance
  }

  async applyFind(id: number): Promise<OrderModel | undefined> {
    const model = await DB.instance.selectFrom('orders').where('id', '=', id).selectAll().executeTakeFirst()

    if (!model)
      return undefined

    this.mapCustomGetters(model)
    await this.loadRelations(model)

    const data = new OrderModel(model)

    cache.getOrSet(`order:${id}`, JSON.stringify(model))

    return data
  }

  async find(id: number): Promise<OrderModel | undefined> {
    return await this.applyFind(id)
  }

  // Method to find a Order by ID
  static async find(id: number): Promise<OrderModel | undefined> {
    const instance = new OrderModel(undefined)

    return await instance.applyFind(id)
  }

  async first(): Promise<OrderModel | undefined> {
    let model: OrderJsonResponse | undefined

    if (this.hasSelect) {
      model = await this.selectFromQuery.executeTakeFirst()
    }
    else {
      model = await this.selectFromQuery.selectAll().executeTakeFirst()
    }

    if (model) {
      this.mapCustomGetters(model)
      await this.loadRelations(model)
    }

    const data = new OrderModel(model)

    return data
  }

  static async first(): Promise<OrderModel | undefined> {
    const instance = new OrderJsonResponse(null)

    const model = await DB.instance.selectFrom('orders')
      .selectAll()
      .executeTakeFirst()

    instance.mapCustomGetters(model)

    const data = new OrderModel(model)

    return data
  }

  async applyFirstOrFail(): Promise<OrderModel | undefined> {
    const model = await this.selectFromQuery.executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, 'No OrderModel results found for query')

    if (model) {
      this.mapCustomGetters(model)
      await this.loadRelations(model)
    }

    const data = new OrderModel(model)

    return data
  }

  async firstOrFail(): Promise<OrderModel | undefined> {
    return await this.applyFirstOrFail()
  }

  static async firstOrFail(): Promise<OrderModel | undefined> {
    const instance = new OrderModel(undefined)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<OrderModel[]> {
    const instance = new OrderModel(undefined)

    const models = await DB.instance.selectFrom('orders').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: OrderType) => {
      return new OrderModel(model)
    }))

    return data
  }

  async applyFindOrFail(id: number): Promise<OrderModel> {
    const model = await DB.instance.selectFrom('orders').where('id', '=', id).selectAll().executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, `No OrderModel results for ${id}`)

    cache.getOrSet(`order:${id}`, JSON.stringify(model))

    this.mapCustomGetters(model)
    await this.loadRelations(model)

    const data = new OrderModel(model)

    return data
  }

  async findOrFail(id: number): Promise<OrderModel> {
    return await this.applyFindOrFail(id)
  }

  static async findOrFail(id: number): Promise<OrderModel> {
    const instance = new OrderModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  async applyFindMany(ids: number[]): Promise<OrderModel[]> {
    let query = DB.instance.selectFrom('orders').where('id', 'in', ids)

    const instance = new OrderModel(undefined)

    query = query.selectAll()

    const models = await query.execute()

    instance.mapCustomGetters(models)
    await instance.loadRelations(models)

    return models.map((modelItem: OrderJsonResponse) => instance.parseResult(new OrderModel(modelItem)))
  }

  static async findMany(ids: number[]): Promise<OrderModel[]> {
    const instance = new OrderModel(undefined)

    return await instance.applyFindMany(ids)
  }

  async findMany(ids: number[]): Promise<OrderModel[]> {
    return await this.applyFindMany(ids)
  }

  skip(count: number): OrderModel {
    this.selectFromQuery = this.selectFromQuery.offset(count)

    return this
  }

  static skip(count: number): OrderModel {
    const instance = new OrderModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.offset(count)

    return instance
  }

  async applyChunk(size: number, callback: (models: OrderModel[]) => Promise<void>): Promise<void> {
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

  async chunk(size: number, callback: (models: OrderModel[]) => Promise<void>): Promise<void> {
    await this.applyChunk(size, callback)
  }

  static async chunk(size: number, callback: (models: OrderModel[]) => Promise<void>): Promise<void> {
    const instance = new OrderModel(undefined)

    await instance.applyChunk(size, callback)
  }

  take(count: number): OrderModel {
    this.selectFromQuery = this.selectFromQuery.limit(count)

    return this
  }

  static take(count: number): OrderModel {
    const instance = new OrderModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.limit(count)

    return instance
  }

  static async pluck<K extends keyof OrderModel>(field: K): Promise<OrderModel[K][]> {
    const instance = new OrderModel(undefined)

    if (instance.hasSelect) {
      const model = await instance.selectFromQuery.execute()
      return model.map((modelItem: OrderModel) => modelItem[field])
    }

    const model = await instance.selectFromQuery.selectAll().execute()

    return model.map((modelItem: OrderModel) => modelItem[field])
  }

  async pluck<K extends keyof OrderModel>(field: K): Promise<OrderModel[K][]> {
    if (this.hasSelect) {
      const model = await this.selectFromQuery.execute()
      return model.map((modelItem: OrderModel) => modelItem[field])
    }

    const model = await this.selectFromQuery.selectAll().execute()

    return model.map((modelItem: OrderModel) => modelItem[field])
  }

  static async count(): Promise<number> {
    const instance = new OrderModel(undefined)

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

  static async max(field: keyof OrderModel): Promise<number> {
    const instance = new OrderModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`MAX(${sql.raw(field as string)}) as max `)
      .executeTakeFirst()

    return result.max
  }

  async max(field: keyof OrderModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`MAX(${sql.raw(field as string)}) as max`)
      .executeTakeFirst()

    return result.max
  }

  static async min(field: keyof OrderModel): Promise<number> {
    const instance = new OrderModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`MIN(${sql.raw(field as string)}) as min `)
      .executeTakeFirst()

    return result.min
  }

  async min(field: keyof OrderModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`MIN(${sql.raw(field as string)}) as min `)
      .executeTakeFirst()

    return result.min
  }

  static async avg(field: keyof OrderModel): Promise<number> {
    const instance = new OrderModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`AVG(${sql.raw(field as string)}) as avg `)
      .executeTakeFirst()

    return result.avg
  }

  async avg(field: keyof OrderModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`AVG(${sql.raw(field as string)}) as avg `)
      .executeTakeFirst()

    return result.avg
  }

  static async sum(field: keyof OrderModel): Promise<number> {
    const instance = new OrderModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`SUM(${sql.raw(field as string)}) as sum `)
      .executeTakeFirst()

    return result.sum
  }

  async sum(field: keyof OrderModel): Promise<number> {
    const result = this.selectFromQuery
      .select(sql`SUM(${sql.raw(field as string)}) as sum `)
      .executeTakeFirst()

    return result.sum
  }

  async applyGet(): Promise<OrderModel[]> {
    let models

    if (this.hasSelect) {
      models = await this.selectFromQuery.execute()
    }
    else {
      models = await this.selectFromQuery.selectAll().execute()
    }

    this.mapCustomGetters(models)
    await this.loadRelations(models)

    const data = await Promise.all(models.map(async (model: OrderJsonResponse) => {
      return new OrderModel(model)
    }))

    return data
  }

  async get(): Promise<OrderModel[]> {
    return await this.applyGet()
  }

  static async get(): Promise<OrderModel[]> {
    const instance = new OrderModel(undefined)

    return await instance.applyGet()
  }

  has(relation: string): OrderModel {
    this.selectFromQuery = this.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(
        selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.order_id`, '=', 'orders.id'),
      ),
    )

    return this
  }

  static has(relation: string): OrderModel {
    const instance = new OrderModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(
        selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.order_id`, '=', 'orders.id'),
      ),
    )

    return instance
  }

  static whereExists(callback: (qb: any) => any): OrderModel {
    const instance = new OrderModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(callback({ exists, selectFrom })),
    )

    return instance
  }

  applyWhereHas(
    relation: string,
    callback: (query: SubqueryBuilder<keyof OrderModel>) => void,
  ): OrderModel {
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    this.selectFromQuery = this.selectFromQuery
      .where(({ exists, selectFrom }: any) => {
        let subquery = selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.order_id`, '=', 'orders.id')

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
    callback: (query: SubqueryBuilder<keyof OrderModel>) => void,
  ): OrderModel {
    return this.applyWhereHas(relation, callback)
  }

  static whereHas(
    relation: string,
    callback: (query: SubqueryBuilder<keyof OrderModel>) => void,
  ): OrderModel {
    const instance = new OrderModel(undefined)

    return instance.applyWhereHas(relation, callback)
  }

  applyDoesntHave(relation: string): OrderModel {
    this.selectFromQuery = this.selectFromQuery.where(({ not, exists, selectFrom }: any) =>
      not(
        exists(
          selectFrom(relation)
            .select('1')
            .whereRef(`${relation}.order_id`, '=', 'orders.id'),
        ),
      ),
    )

    return this
  }

  doesntHave(relation: string): OrderModel {
    return this.applyDoesntHave(relation)
  }

  static doesntHave(relation: string): OrderModel {
    const instance = new OrderModel(undefined)

    return instance.applyDoesntHave(relation)
  }

  applyWhereDoesntHave(relation: string, callback: (query: SubqueryBuilder<OrdersTable>) => void): OrderModel {
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    this.selectFromQuery = this.selectFromQuery
      .where(({ exists, selectFrom, not }: any) => {
        const subquery = selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.order_id`, '=', 'orders.id')

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

  whereDoesntHave(relation: string, callback: (query: SubqueryBuilder<OrdersTable>) => void): OrderModel {
    return this.applyWhereDoesntHave(relation, callback)
  }

  static whereDoesntHave(
    relation: string,
    callback: (query: SubqueryBuilder<OrdersTable>) => void,
  ): OrderModel {
    const instance = new OrderModel(undefined)

    return instance.applyWhereDoesntHave(relation, callback)
  }

  async applyPaginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<OrderResponse> {
    const totalRecordsResult = await DB.instance.selectFrom('orders')
      .select(DB.instance.fn.count('id').as('total')) // Use 'id' or another actual column name
      .executeTakeFirst()

    const totalRecords = Number(totalRecordsResult?.total) || 0
    const totalPages = Math.ceil(totalRecords / (options.limit ?? 10))

    const ordersWithExtra = await DB.instance.selectFrom('orders')
      .selectAll()
      .orderBy('id', 'asc') // Assuming 'id' is used for cursor-based pagination
      .limit((options.limit ?? 10) + 1) // Fetch one extra record
      .offset(((options.page ?? 1) - 1) * (options.limit ?? 10)) // Ensure options.page is not undefined
      .execute()

    let nextCursor = null
    if (ordersWithExtra.length > (options.limit ?? 10))
      nextCursor = ordersWithExtra.pop()?.id ?? null

    return {
      data: ordersWithExtra,
      paging: {
        total_records: totalRecords,
        page: options.page || 1,
        total_pages: totalPages,
      },
      next_cursor: nextCursor,
    }
  }

  async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<OrderResponse> {
    return await this.applyPaginate(options)
  }

  // Method to get all orders
  static async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<OrderResponse> {
    const instance = new OrderModel(undefined)

    return await instance.applyPaginate(options)
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

    const model = await this.find(Number(result.numInsertedOrUpdatedRows)) as OrderModel

    if (model)
      dispatch('order:created', model)

    return model
  }

  async create(newOrder: NewOrder): Promise<OrderModel> {
    return await this.applyCreate(newOrder)
  }

  static async create(newOrder: NewOrder): Promise<OrderModel> {
    const instance = new OrderModel(undefined)

    return await instance.applyCreate(newOrder)
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

    const model = await find(Number(result.numInsertedOrUpdatedRows)) as OrderModel

    if (model)
      dispatch('order:created', model)

    return model
  }

  // Method to remove a Order
  static async remove(id: number): Promise<any> {
    const instance = new OrderModel(undefined)

    const model = await instance.find(Number(id))

    if (model)
      dispatch('order:deleted', model)

    return await DB.instance.deleteFrom('orders')
      .where('id', '=', id)
      .execute()
  }

  applyWhere<V>(column: keyof OrdersTable, ...args: [V] | [Operator, V]): OrderModel {
    if (args.length === 1) {
      const [value] = args
      this.selectFromQuery = this.selectFromQuery.where(column, '=', value)
      this.updateFromQuery = this.updateFromQuery.where(column, '=', value)
      this.deleteFromQuery = this.deleteFromQuery.where(column, '=', value)
    }
    else {
      const [operator, value] = args as [Operator, V]
      this.selectFromQuery = this.selectFromQuery.where(column, operator, value)
      this.updateFromQuery = this.updateFromQuery.where(column, operator, value)
      this.deleteFromQuery = this.deleteFromQuery.where(column, operator, value)
    }

    return this
  }

  where<V = string>(column: keyof OrdersTable, ...args: [V] | [Operator, V]): OrderModel {
    return this.applyWhere<V>(column, ...args)
  }

  static where<V = string>(column: keyof OrdersTable, ...args: [V] | [Operator, V]): OrderModel {
    const instance = new OrderModel(undefined)

    return instance.applyWhere<V>(column, ...args)
  }

  whereColumn(first: keyof OrdersTable, operator: Operator, second: keyof OrdersTable): OrderModel {
    this.selectFromQuery = this.selectFromQuery.whereRef(first, operator, second)

    return this
  }

  static whereColumn(first: keyof OrdersTable, operator: Operator, second: keyof OrdersTable): OrderModel {
    const instance = new OrderModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.whereRef(first, operator, second)

    return instance
  }

  applyWhereRef(column: keyof OrdersTable, ...args: string[]): OrderModel {
    const [operatorOrValue, value] = args
    const operator = value === undefined ? '=' : operatorOrValue
    const actualValue = value === undefined ? operatorOrValue : value

    const instance = new OrderModel(undefined)
    instance.selectFromQuery = instance.selectFromQuery.whereRef(column, operator, actualValue)

    return instance
  }

  whereRef(column: keyof OrdersTable, ...args: string[]): OrderModel {
    return this.applyWhereRef(column, ...args)
  }

  static whereRef(column: keyof OrdersTable, ...args: string[]): OrderModel {
    const instance = new OrderModel(undefined)

    return instance.applyWhereRef(column, ...args)
  }

  whereRaw(sqlStatement: string): OrderModel {
    this.selectFromQuery = this.selectFromQuery.where(sql`${sqlStatement}`)

    return this
  }

  static whereRaw(sqlStatement: string): OrderModel {
    const instance = new OrderModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where(sql`${sqlStatement}`)

    return instance
  }

  applyOrWhere(...conditions: [string, any][]): OrderModel {
    this.selectFromQuery = this.selectFromQuery.where((eb: any) => {
      return eb.or(
        conditions.map(([column, value]) => eb(column, '=', value)),
      )
    })

    this.updateFromQuery = this.updateFromQuery.where((eb: any) => {
      return eb.or(
        conditions.map(([column, value]) => eb(column, '=', value)),
      )
    })

    this.deleteFromQuery = this.deleteFromQuery.where((eb: any) => {
      return eb.or(
        conditions.map(([column, value]) => eb(column, '=', value)),
      )
    })

    return this
  }

  orWhere(...conditions: [string, any][]): OrderModel {
    return this.applyOrWhere(...conditions)
  }

  static orWhere(...conditions: [string, any][]): OrderModel {
    const instance = new OrderModel(undefined)

    return instance.applyOrWhere(...conditions)
  }

  when(
    condition: boolean,
    callback: (query: OrderModel) => OrderModel,
  ): OrderModel {
    return OrderModel.when(condition, callback)
  }

  static when(
    condition: boolean,
    callback: (query: OrderModel) => OrderModel,
  ): OrderModel {
    let instance = new OrderModel(undefined)

    if (condition)
      instance = callback(instance)

    return instance
  }

  whereNotNull(column: keyof OrdersTable): OrderModel {
    this.selectFromQuery = this.selectFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is not', null),
    )

    this.updateFromQuery = this.updateFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is not', null),
    )

    this.deleteFromQuery = this.deleteFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is not', null),
    )

    return this
  }

  static whereNotNull(column: keyof OrdersTable): OrderModel {
    const instance = new OrderModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is not', null),
    )

    instance.updateFromQuery = instance.updateFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is not', null),
    )

    instance.deleteFromQuery = instance.deleteFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is not', null),
    )

    return instance
  }

  whereNull(column: keyof OrdersTable): OrderModel {
    this.selectFromQuery = this.selectFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    this.updateFromQuery = this.updateFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    this.deleteFromQuery = this.deleteFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    return this
  }

  static whereNull(column: keyof OrdersTable): OrderModel {
    const instance = new OrderModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    instance.updateFromQuery = instance.updateFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    instance.deleteFromQuery = instance.deleteFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    return instance
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

  applyWhereIn<V>(column: keyof OrdersTable, values: V[]) {
    this.selectFromQuery = this.selectFromQuery.where(column, 'in', values)

    this.updateFromQuery = this.updateFromQuery.where(column, 'in', values)

    this.deleteFromQuery = this.deleteFromQuery.where(column, 'in', values)

    return this
  }

  whereIn<V = number>(column: keyof OrdersTable, values: V[]): OrderModel {
    return this.applyWhereIn<V>(column, values)
  }

  static whereIn<V = number>(column: keyof OrdersTable, values: V[]): OrderModel {
    const instance = new OrderModel(undefined)

    return instance.applyWhereIn<V>(column, values)
  }

  applyWhereBetween<V>(column: keyof OrdersTable, range: [V, V]): OrderModel {
    if (range.length !== 2) {
      throw new HttpError(500, 'Range must have exactly two values: [min, max]')
    }

    const query = sql` ${sql.raw(column as string)} between ${range[0]} and ${range[1]} `

    this.selectFromQuery = this.selectFromQuery.where(query)
    this.updateFromQuery = this.updateFromQuery.where(query)
    this.deleteFromQuery = this.deleteFromQuery.where(query)

    return this
  }

  whereBetween<V = number>(column: keyof OrdersTable, range: [V, V]): OrderModel {
    return this.applyWhereBetween<V>(column, range)
  }

  static whereBetween<V = number>(column: keyof OrdersTable, range: [V, V]): OrderModel {
    const instance = new OrderModel(undefined)

    return instance.applyWhereBetween<V>(column, range)
  }

  applyWhereLike(column: keyof OrdersTable, value: string): OrderModel {
    this.selectFromQuery = this.selectFromQuery.where(sql` ${sql.raw(column as string)} LIKE ${value}`)

    this.updateFromQuery = this.updateFromQuery.where(sql` ${sql.raw(column as string)} LIKE ${value}`)

    this.deleteFromQuery = this.deleteFromQuery.where(sql` ${sql.raw(column as string)} LIKE ${value}`)

    return this
  }

  whereLike(column: keyof OrdersTable, value: string): OrderModel {
    return this.applyWhereLike(column, value)
  }

  static whereLike(column: keyof OrdersTable, value: string): OrderModel {
    const instance = new OrderModel(undefined)

    return instance.applyWhereLike(column, value)
  }

  applyWhereNotIn<V>(column: keyof OrdersTable, values: V[]): OrderModel {
    this.selectFromQuery = this.selectFromQuery.where(column, 'not in', values)

    this.updateFromQuery = this.updateFromQuery.where(column, 'not in', values)

    this.deleteFromQuery = this.deleteFromQuery.where(column, 'not in', values)

    return this
  }

  whereNotIn<V>(column: keyof OrdersTable, values: V[]): OrderModel {
    return this.applyWhereNotIn<V>(column, values)
  }

  static whereNotIn<V = number>(column: keyof OrdersTable, values: V[]): OrderModel {
    const instance = new OrderModel(undefined)

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

  static async latest(): Promise<OrderModel | undefined> {
    const instance = new OrderModel(undefined)

    const model = await DB.instance.selectFrom('orders')
      .selectAll()
      .orderBy('id', 'desc')
      .executeTakeFirst()

    if (!model)
      return undefined

    instance.mapCustomGetters(model)

    const data = new OrderModel(model)

    return data
  }

  static async oldest(): Promise<OrderModel | undefined> {
    const instance = new OrderModel(undefined)

    const model = await DB.instance.selectFrom('orders')
      .selectAll()
      .orderBy('id', 'asc')
      .executeTakeFirst()

    if (!model)
      return undefined

    instance.mapCustomGetters(model)

    const data = new OrderModel(model)

    return data
  }

  static async firstOrCreate(
    condition: Partial<OrderType>,
    newOrder: NewOrder,
  ): Promise<OrderModel> {
    const instance = new OrderModel(undefined)

    const key = Object.keys(condition)[0] as keyof OrderType

    if (!key) {
      throw new HttpError(500, 'Condition must contain at least one key-value pair')
    }

    const value = condition[key]

    // Attempt to find the first record matching the condition
    const existingOrder = await DB.instance.selectFrom('orders')
      .selectAll()
      .where(key, '=', value)
      .executeTakeFirst()

    if (existingOrder) {
      instance.mapCustomGetters(existingOrder)
      await instance.loadRelations(existingOrder)

      return new OrderModel(existingOrder as OrderType)
    }
    else {
      return await instance.create(newOrder)
    }
  }

  static async updateOrCreate(
    condition: Partial<OrderType>,
    newOrder: NewOrder,
  ): Promise<OrderModel> {
    const instance = new OrderModel(undefined)

    const key = Object.keys(condition)[0] as keyof OrderType

    if (!key) {
      throw new HttpError(500, 'Condition must contain at least one key-value pair')
    }

    const value = condition[key]

    // Attempt to find the first record matching the condition
    const existingOrder = await DB.instance.selectFrom('orders')
      .selectAll()
      .where(key, '=', value)
      .executeTakeFirst()

    if (existingOrder) {
      // If found, update the existing record
      await DB.instance.updateTable('orders')
        .set(newOrder)
        .where(key, '=', value)
        .executeTakeFirstOrThrow()

      // Fetch and return the updated record
      const updatedOrder = await DB.instance.selectFrom('orders')
        .selectAll()
        .where(key, '=', value)
        .executeTakeFirst()

      if (!updatedOrder) {
        throw new HttpError(500, 'Failed to fetch updated record')
      }

      instance.hasSaved = true

      return new OrderModel(updatedOrder as OrderType)
    }
    else {
      // If not found, create a new record
      return await instance.create(newOrder)
    }
  }

  async loadRelations(models: OrderJsonResponse | OrderJsonResponse[]): Promise<void> {
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

  with(relations: string[]): OrderModel {
    this.withRelations = relations

    return this
  }

  static with(relations: string[]): OrderModel {
    const instance = new OrderModel(undefined)

    instance.withRelations = relations

    return instance
  }

  async last(): Promise<OrderModel | undefined> {
    let model: OrderJsonResponse | undefined

    if (this.hasSelect) {
      model = await this.selectFromQuery.executeTakeFirst()
    }
    else {
      model = await this.selectFromQuery.selectAll().orderBy('id', 'desc').executeTakeFirst()
    }

    if (model) {
      this.mapCustomGetters(model)
      await this.loadRelations(model)
    }

    const data = new OrderModel(model)

    return data
  }

  static async last(): Promise<OrderModel | undefined> {
    const model = await DB.instance.selectFrom('orders').selectAll().orderBy('id', 'desc').executeTakeFirst()

    if (!model)
      return undefined

    const data = new OrderModel(model)

    return data
  }

  orderBy(column: keyof OrdersTable, order: 'asc' | 'desc'): OrderModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, order)

    return this
  }

  static orderBy(column: keyof OrdersTable, order: 'asc' | 'desc'): OrderModel {
    const instance = new OrderModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, order)

    return instance
  }

  groupBy(column: keyof OrdersTable): OrderModel {
    this.selectFromQuery = this.selectFromQuery.groupBy(column)

    return this
  }

  static groupBy(column: keyof OrdersTable): OrderModel {
    const instance = new OrderModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.groupBy(column)

    return instance
  }

  having<V = string>(column: keyof OrdersTable, operator: Operator, value: V): OrderModel {
    this.selectFromQuery = this.selectFromQuery.having(column, operator, value)

    return this
  }

  static having<V = string>(column: keyof OrdersTable, operator: Operator, value: V): OrderModel {
    const instance = new OrderModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.having(column, operator, value)

    return instance
  }

  inRandomOrder(): OrderModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(sql` ${sql.raw('RANDOM()')} `)

    return this
  }

  static inRandomOrder(): OrderModel {
    const instance = new OrderModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(sql` ${sql.raw('RANDOM()')} `)

    return instance
  }

  orderByDesc(column: keyof OrdersTable): OrderModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, 'desc')

    return this
  }

  static orderByDesc(column: keyof OrdersTable): OrderModel {
    const instance = new OrderModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'desc')

    return instance
  }

  orderByAsc(column: keyof OrdersTable): OrderModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, 'asc')

    return this
  }

  static orderByAsc(column: keyof OrdersTable): OrderModel {
    const instance = new OrderModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'asc')

    return instance
  }

  async update(newOrder: OrderUpdate): Promise<OrderModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newOrder).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewOrder

    await this.mapCustomSetters(filteredValues)

    await DB.instance.updateTable('orders')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      const model = await this.find(this.id)

      if (model)
        dispatch('order:updated', model)

      return model
    }

    this.hasSaved = true

    return undefined
  }

  async forceUpdate(order: OrderUpdate): Promise<OrderModel | undefined> {
    if (this.id === undefined) {
      this.updateFromQuery.set(order).execute()
    }

    await this.mapCustomSetters(order)

    await DB.instance.updateTable('orders')
      .set(order)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      const model = await this.find(this.id)

      if (model)
        dispatch('order:updated', model)

      this.hasSaved = true

      return model
    }

    return undefined
  }

  async save(): Promise<void> {
    if (!this)
      throw new HttpError(500, 'Order data is undefined')

    await this.mapCustomSetters(this.attributes)

    if (this.id === undefined) {
      await this.create(this.attributes)
    }
    else {
      await this.update(this.attributes)
    }

    this.hasSaved = true
  }

  fill(data: Partial<OrderType>): OrderModel {
    const filteredValues = Object.fromEntries(
      Object.entries(data).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewOrder

    this.attributes = {
      ...this.attributes,
      ...filteredValues,
    }

    return this
  }

  forceFill(data: Partial<OrderType>): OrderModel {
    this.attributes = {
      ...this.attributes,
      ...data,
    }

    return this
  }

  // Method to delete (soft delete) the order instance
  async delete(): Promise<OrdersTable> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()
    const model = await this.find(Number(this.id))
    if (model)
      dispatch('order:deleted', model)

    return await DB.instance.deleteFrom('orders')
      .where('id', '=', this.id)
      .execute()
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

  toSearchableObject(): Partial<OrdersTable> {
    return {
      id: this.id,
      customer_id: this.customer_id,
      status: this.status,
      total_amount: this.total_amount,
      order_type: this.order_type,
      created_at: this.created_at,
    }
  }

  distinct(column: keyof OrderType): OrderModel {
    this.selectFromQuery = this.selectFromQuery.select(column).distinct()

    this.hasSelect = true

    return this
  }

  static distinct(column: keyof OrderType): OrderModel {
    const instance = new OrderModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.select(column).distinct()

    instance.hasSelect = true

    return instance
  }

  join(table: string, firstCol: string, secondCol: string): OrderModel {
    this.selectFromQuery = this.selectFromQuery.innerJoin(table, firstCol, secondCol)

    return this
  }

  static join(table: string, firstCol: string, secondCol: string): OrderModel {
    const instance = new OrderModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.innerJoin(table, firstCol, secondCol)

    return instance
  }

  toJSON(): Partial<OrderJsonResponse> {
    const output: Partial<OrderJsonResponse> = {

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
}

async function find(id: number): Promise<OrderModel | undefined> {
  const query = DB.instance.selectFrom('orders').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  return new OrderModel(model)
}

export async function count(): Promise<number> {
  const results = await OrderModel.count()

  return results
}

export async function create(newOrder: NewOrder): Promise<OrderModel> {
  const result = await DB.instance.insertInto('orders')
    .values(newOrder)
    .executeTakeFirstOrThrow()

  return await find(Number(result.numInsertedOrUpdatedRows)) as OrderModel
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
