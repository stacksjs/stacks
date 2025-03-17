import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { CouponModel } from './Coupon'
import type { CustomerModel } from './Customer'
import type { OrderItemModel } from './OrderItem'
import { randomUUIDv7 } from 'bun'
import { cache } from '@stacksjs/cache'
import { sql } from '@stacksjs/database'
import { HttpError, ModelNotFoundException } from '@stacksjs/error-handling'

import { dispatch } from '@stacksjs/events'

import { BaseOrm, DB, SubqueryBuilder } from '@stacksjs/orm'

import Coupon from './Coupon'

import Customer from './Customer'

export interface OrdersTable {
  id: Generated<number>
  customer_id: number
  coupon_id: number
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

export interface OrderJsonResponse extends Omit<Selectable<OrdersTable>, 'password'> {
  [key: string]: any
}

export type NewOrder = Insertable<OrdersTable>
export type OrderUpdate = Updateable<OrdersTable>

      type SortDirection = 'asc' | 'desc'
interface SortOptions { column: OrderJsonResponse, order: SortDirection }
// Define a type for the options parameter
interface QueryOptions {
  sort?: SortOptions
  limit?: number
  offset?: number
  page?: number
}

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
  private hasSaved: boolean
  private customColumns: Record<string, unknown> = {}

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
    this.hasSaved = false
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

  async mapCustomSetters(model: NewOrder | OrderUpdate): Promise<void> {
    const customSetter = {
      default: () => {
      },

    }

    for (const [key, fn] of Object.entries(customSetter)) {
      model[key] = await fn()
    }
  }

  get order_items(): OrderItemModel[] | [] {
    return this.attributes.order_items
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

  isDirty(column?: keyof OrderJsonResponse): boolean {
    if (column) {
      return this.attributes[column] !== this.originalAttributes[column]
    }

    return Object.entries(this.originalAttributes).some(([key, originalValue]) => {
      const currentValue = (this.attributes as any)[key]

      return currentValue !== originalValue
    })
  }

  isClean(column?: keyof OrderJsonResponse): boolean {
    return !this.isDirty(column)
  }

  wasChanged(column?: keyof OrderJsonResponse): boolean {
    return this.hasSaved && this.isDirty(column)
  }

  static select(params: (keyof OrderJsonResponse)[] | RawBuilder<string> | string): OrderModel {
    const instance = new OrderModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a Order by ID
  static async find(id: number): Promise<OrderModel | undefined> {
    const instance = new OrderModel(undefined)

    return await instance.applyFind(id)
  }

  async first(): Promise<OrderModel | undefined> {
    const model = await this.applyFirst()

    const data = new OrderModel(model)

    return data
  }

  static async first(): Promise<OrderModel | undefined> {
    const instance = new OrderModel(undefined)

    const model = await instance.applyFirst()

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

    const data = await Promise.all(models.map(async (model: OrderJsonResponse) => {
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

  static async findMany(ids: number[]): Promise<OrderModel[]> {
    const instance = new OrderModel(undefined)

    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: UserJsonResponse) => instance.parseResult(new OrderModel(modelItem)))
  }

  async findMany(ids: number[]): Promise<OrderModel[]> {
    const models = await this.applyFindMany(ids)

    return models.map((modelItem: UserJsonResponse) => this.parseResult(new OrderModel(modelItem)))
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

  static take(count: number): OrderModel {
    const instance = new OrderModel(undefined)

    return instance.applyTake(count)
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

    return instance.applyCount()
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

  distinct(column: keyof OrderJsonResponse): OrderModel {
    return this.applyDistinct(column)
  }

  static distinct(column: keyof OrderJsonResponse): OrderModel {
    const instance = new OrderModel(undefined)

    return instance.applyDistinct(column)
  }

  join(table: string, firstCol: string, secondCol: string): OrderModel {
    return this.applyJoin(table, firstCol, secondCol)
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
