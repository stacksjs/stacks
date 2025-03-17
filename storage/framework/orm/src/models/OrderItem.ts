import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
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

export class OrderItemModel extends BaseOrm<OrderItemModel, OrderItemsTable, OrderItemJsonResponse> {
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

  static select(params: (keyof OrderItemJsonResponse)[] | RawBuilder<string> | string): OrderItemModel {
    const instance = new OrderItemModel(undefined)

    return instance.applySelect(params)
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
      throw new ModelNotFoundException(404, `No OrderItemModel results found for query`)

    if (model) {
      this.mapCustomGetters(model)
      await this.loadRelations(model)
    }

    const data = new OrderItemModel(model)

    return data
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

  static async findMany(ids: number[]): Promise<OrderItemModel[]> {
    const instance = new OrderItemModel(undefined)

    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: UserJsonResponse) => instance.parseResult(new OrderItemModel(modelItem)))
  }

  async findMany(ids: number[]): Promise<OrderItemModel[]> {
    const models = await this.applyFindMany(ids)

    return models.map((modelItem: UserJsonResponse) => this.parseResult(new OrderItemModel(modelItem)))
  }

  static skip(count: number): OrderItemModel {
    const instance = new OrderItemModel(undefined)

    return instance.applySkip(count)
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

  static take(count: number): OrderItemModel {
    const instance = new OrderItemModel(undefined)

    return instance.applyTake(count)
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

    return instance.applyCount()
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
  async delete(): Promise<OrderItemsTable> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()

    return await DB.instance.deleteFrom('order_items')
      .where('id', '=', this.id)
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
