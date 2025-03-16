import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import type { ManufacturerModel } from './Manufacturer'
import type { ProductModel } from './Product'
import type { ProductCategoryModel } from './ProductCategory'
import { randomUUIDv7 } from 'bun'
import { cache } from '@stacksjs/cache'
import { sql } from '@stacksjs/database'
import { HttpError, ModelNotFoundException } from '@stacksjs/error-handling'

import { dispatch } from '@stacksjs/events'

import { BaseOrm, DB, SubqueryBuilder } from '@stacksjs/orm'

import Manufacturer from './Manufacturer'

import Product from './Product'

import ProductCategory from './ProductCategory'

export interface ProductItemsTable {
  id: Generated<number>
  product_id: number
  manufacturer_id: number
  product_category_id: number
  name: string
  size?: string
  color?: string
  price: number
  image_url?: string
  is_available?: boolean
  inventory_count?: number
  sku: string
  custom_options?: string
  uuid?: string

  created_at?: Date

  updated_at?: Date

}

export interface ProductItemResponse {
  data: ProductItemJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface ProductItemJsonResponse extends Omit<Selectable<ProductItemsTable>, 'password'> {
  [key: string]: any
}

export type NewProductItem = Insertable<ProductItemsTable>
export type ProductItemUpdate = Updateable<ProductItemsTable>

      type SortDirection = 'asc' | 'desc'
interface SortOptions { column: ProductItemJsonResponse, order: SortDirection }
// Define a type for the options parameter
interface QueryOptions {
  sort?: SortOptions
  limit?: number
  offset?: number
  page?: number
}

export class ProductItemModel extends BaseOrm<ProductItemModel, ProductItemsTable> {
  private readonly hidden: Array<keyof ProductItemJsonResponse> = []
  private readonly fillable: Array<keyof ProductItemJsonResponse> = ['name', 'size', 'color', 'price', 'image_url', 'is_available', 'inventory_count', 'sku', 'custom_options', 'uuid']
  private readonly guarded: Array<keyof ProductItemJsonResponse> = []
  protected attributes = {} as ProductItemJsonResponse
  protected originalAttributes = {} as ProductItemJsonResponse

  protected selectFromQuery: any
  protected updateFromQuery: any
  protected deleteFromQuery: any
  protected hasSelect: boolean
  private hasSaved: boolean
  private customColumns: Record<string, unknown> = {}

  constructor(productItem: ProductItemJsonResponse | undefined) {
    super('product_items')
    if (productItem) {
      this.attributes = { ...productItem }
      this.originalAttributes = { ...productItem }

      Object.keys(productItem).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (productItem as ProductItemJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = DB.instance.selectFrom('product_items')
    this.updateFromQuery = DB.instance.updateTable('product_items')
    this.deleteFromQuery = DB.instance.deleteFrom('product_items')
    this.hasSelect = false
    this.hasSaved = false
  }

  protected mapCustomGetters(models: ProductItemJsonResponse | ProductItemJsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: ProductItemJsonResponse) => {
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

  async mapCustomSetters(model: NewProductItem | ProductItemUpdate): Promise<void> {
    const customSetter = {
      default: () => {
      },

    }

    for (const [key, fn] of Object.entries(customSetter)) {
      model[key] = await fn()
    }
  }

  get product_id(): number {
    return this.attributes.product_id
  }

  get product(): ProductModel | undefined {
    return this.attributes.product
  }

  get manufacturer_id(): number {
    return this.attributes.manufacturer_id
  }

  get manufacturer(): ManufacturerModel | undefined {
    return this.attributes.manufacturer
  }

  get product_category_id(): number {
    return this.attributes.product_category_id
  }

  get product_category(): ProductCategoryModel | undefined {
    return this.attributes.product_category
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

  get size(): string | undefined {
    return this.attributes.size
  }

  get color(): string | undefined {
    return this.attributes.color
  }

  get price(): number {
    return this.attributes.price
  }

  get image_url(): string | undefined {
    return this.attributes.image_url
  }

  get is_available(): boolean | undefined {
    return this.attributes.is_available
  }

  get inventory_count(): number | undefined {
    return this.attributes.inventory_count
  }

  get sku(): string {
    return this.attributes.sku
  }

  get custom_options(): string | undefined {
    return this.attributes.custom_options
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

  set name(value: string) {
    this.attributes.name = value
  }

  set size(value: string) {
    this.attributes.size = value
  }

  set color(value: string) {
    this.attributes.color = value
  }

  set price(value: number) {
    this.attributes.price = value
  }

  set image_url(value: string) {
    this.attributes.image_url = value
  }

  set is_available(value: boolean) {
    this.attributes.is_available = value
  }

  set inventory_count(value: number) {
    this.attributes.inventory_count = value
  }

  set sku(value: string) {
    this.attributes.sku = value
  }

  set custom_options(value: string) {
    this.attributes.custom_options = value
  }

  set updated_at(value: Date) {
    this.attributes.updated_at = value
  }

  getOriginal(column?: keyof ProductItemJsonResponse): Partial<ProductItemJsonResponse> {
    if (column) {
      return this.originalAttributes[column]
    }

    return this.originalAttributes
  }

  getChanges(): Partial<ProductItemJsonResponse> {
    return this.fillable.reduce<Partial<ProductItemJsonResponse>>((changes, key) => {
      const currentValue = this.attributes[key as keyof ProductItemsTable]
      const originalValue = this.originalAttributes[key as keyof ProductItemsTable]

      if (currentValue !== originalValue) {
        changes[key] = currentValue
      }

      return changes
    }, {})
  }

  isDirty(column?: keyof ProductItemJsonResponse): boolean {
    if (column) {
      return this.attributes[column] !== this.originalAttributes[column]
    }

    return Object.entries(this.originalAttributes).some(([key, originalValue]) => {
      const currentValue = (this.attributes as any)[key]

      return currentValue !== originalValue
    })
  }

  isClean(column?: keyof ProductItemJsonResponse): boolean {
    return !this.isDirty(column)
  }

  wasChanged(column?: keyof ProductItemJsonResponse): boolean {
    return this.hasSaved && this.isDirty(column)
  }

  select(params: (keyof ProductItemJsonResponse)[] | RawBuilder<string> | string): ProductItemModel {
    this.selectFromQuery = this.selectFromQuery.select(params)

    this.hasSelect = true

    return this
  }

  static select(params: (keyof ProductItemJsonResponse)[] | RawBuilder<string> | string): ProductItemModel {
    const instance = new ProductItemModel(undefined)

    // Initialize a query with the table name and selected fields
    instance.selectFromQuery = instance.selectFromQuery.select(params)

    instance.hasSelect = true

    return instance
  }

  // Method to find a ProductItem by ID
  static async find(id: number): Promise<ProductItemModel | undefined> {
    const instance = new ProductItemModel(undefined)

    return await instance.applyFind(id)
  }

  async first(): Promise<ProductItemModel | undefined> {
    const model = await this.applyFirst()

    const data = new ProductItemModel(model)

    return data
  }

  static async first(): Promise<ProductItemModel | undefined> {
    const instance = new ProductItemModel(undefined)

    const model = await instance.applyFirst()

    const data = new ProductItemModel(model)

    return data
  }

  async applyFirstOrFail(): Promise<ProductItemModel | undefined> {
    const model = await this.selectFromQuery.executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, 'No ProductItemModel results found for query')

    if (model) {
      this.mapCustomGetters(model)
      await this.loadRelations(model)
    }

    const data = new ProductItemModel(model)

    return data
  }

  async firstOrFail(): Promise<ProductItemModel | undefined> {
    return await this.applyFirstOrFail()
  }

  static async firstOrFail(): Promise<ProductItemModel | undefined> {
    const instance = new ProductItemModel(undefined)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<ProductItemModel[]> {
    const instance = new ProductItemModel(undefined)

    const models = await DB.instance.selectFrom('product_items').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: ProductItemJsonResponse) => {
      return new ProductItemModel(model)
    }))

    return data
  }

  async applyFindOrFail(id: number): Promise<ProductItemModel> {
    const model = await DB.instance.selectFrom('product_items').where('id', '=', id).selectAll().executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, `No ProductItemModel results for ${id}`)

    cache.getOrSet(`productItem:${id}`, JSON.stringify(model))

    this.mapCustomGetters(model)
    await this.loadRelations(model)

    const data = new ProductItemModel(model)

    return data
  }

  async findOrFail(id: number): Promise<ProductItemModel> {
    return await this.applyFindOrFail(id)
  }

  static async findOrFail(id: number): Promise<ProductItemModel> {
    const instance = new ProductItemModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  async applyFindMany(ids: number[]): Promise<ProductItemModel[]> {
    let query = DB.instance.selectFrom('product_items').where('id', 'in', ids)

    const instance = new ProductItemModel(undefined)

    query = query.selectAll()

    const models = await query.execute()

    instance.mapCustomGetters(models)
    await instance.loadRelations(models)

    return models.map((modelItem: ProductItemJsonResponse) => instance.parseResult(new ProductItemModel(modelItem)))
  }

  static async findMany(ids: number[]): Promise<ProductItemModel[]> {
    const instance = new ProductItemModel(undefined)

    return await instance.applyFindMany(ids)
  }

  async findMany(ids: number[]): Promise<ProductItemModel[]> {
    return await this.applyFindMany(ids)
  }

  skip(count: number): ProductItemModel {
    this.selectFromQuery = this.selectFromQuery.offset(count)

    return this
  }

  static skip(count: number): ProductItemModel {
    const instance = new ProductItemModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.offset(count)

    return instance
  }

  async applyChunk(size: number, callback: (models: ProductItemModel[]) => Promise<void>): Promise<void> {
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

  async chunk(size: number, callback: (models: ProductItemModel[]) => Promise<void>): Promise<void> {
    await this.applyChunk(size, callback)
  }

  static async chunk(size: number, callback: (models: ProductItemModel[]) => Promise<void>): Promise<void> {
    const instance = new ProductItemModel(undefined)

    await instance.applyChunk(size, callback)
  }

  take(count: number): ProductItemModel {
    this.selectFromQuery = this.selectFromQuery.limit(count)

    return this
  }

  static take(count: number): ProductItemModel {
    const instance = new ProductItemModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.limit(count)

    return instance
  }

  static async pluck<K extends keyof ProductItemModel>(field: K): Promise<ProductItemModel[K][]> {
    const instance = new ProductItemModel(undefined)

    if (instance.hasSelect) {
      const model = await instance.selectFromQuery.execute()
      return model.map((modelItem: ProductItemModel) => modelItem[field])
    }

    const model = await instance.selectFromQuery.selectAll().execute()

    return model.map((modelItem: ProductItemModel) => modelItem[field])
  }

  async pluck<K extends keyof ProductItemModel>(field: K): Promise<ProductItemModel[K][]> {
    if (this.hasSelect) {
      const model = await this.selectFromQuery.execute()
      return model.map((modelItem: ProductItemModel) => modelItem[field])
    }

    const model = await this.selectFromQuery.selectAll().execute()

    return model.map((modelItem: ProductItemModel) => modelItem[field])
  }

  static async count(): Promise<number> {
    const instance = new ProductItemModel(undefined)

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

  static async max(field: keyof ProductItemModel): Promise<number> {
    const instance = new ProductItemModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`MAX(${sql.raw(field as string)}) as max `)
      .executeTakeFirst()

    return result.max
  }

  async max(field: keyof ProductItemModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`MAX(${sql.raw(field as string)}) as max`)
      .executeTakeFirst()

    return result.max
  }

  static async min(field: keyof ProductItemModel): Promise<number> {
    const instance = new ProductItemModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`MIN(${sql.raw(field as string)}) as min `)
      .executeTakeFirst()

    return result.min
  }

  async min(field: keyof ProductItemModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`MIN(${sql.raw(field as string)}) as min `)
      .executeTakeFirst()

    return result.min
  }

  static async avg(field: keyof ProductItemModel): Promise<number> {
    const instance = new ProductItemModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`AVG(${sql.raw(field as string)}) as avg `)
      .executeTakeFirst()

    return result.avg
  }

  async avg(field: keyof ProductItemModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`AVG(${sql.raw(field as string)}) as avg `)
      .executeTakeFirst()

    return result.avg
  }

  static async sum(field: keyof ProductItemModel): Promise<number> {
    const instance = new ProductItemModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`SUM(${sql.raw(field as string)}) as sum `)
      .executeTakeFirst()

    return result.sum
  }

  async sum(field: keyof ProductItemModel): Promise<number> {
    const result = this.selectFromQuery
      .select(sql`SUM(${sql.raw(field as string)}) as sum `)
      .executeTakeFirst()

    return result.sum
  }

  async applyGet(): Promise<ProductItemModel[]> {
    let models

    if (this.hasSelect) {
      models = await this.selectFromQuery.execute()
    }
    else {
      models = await this.selectFromQuery.selectAll().execute()
    }

    this.mapCustomGetters(models)
    await this.loadRelations(models)

    const data = await Promise.all(models.map(async (model: ProductItemJsonResponse) => {
      return new ProductItemModel(model)
    }))

    return data
  }

  async get(): Promise<ProductItemModel[]> {
    return await this.applyGet()
  }

  static async get(): Promise<ProductItemModel[]> {
    const instance = new ProductItemModel(undefined)

    return await instance.applyGet()
  }

  has(relation: string): ProductItemModel {
    this.selectFromQuery = this.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(
        selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.productItem_id`, '=', 'product_items.id'),
      ),
    )

    return this
  }

  static has(relation: string): ProductItemModel {
    const instance = new ProductItemModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(
        selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.productItem_id`, '=', 'product_items.id'),
      ),
    )

    return instance
  }

  static whereExists(callback: (qb: any) => any): ProductItemModel {
    const instance = new ProductItemModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(callback({ exists, selectFrom })),
    )

    return instance
  }

  applyWhereHas(
    relation: string,
    callback: (query: SubqueryBuilder<keyof ProductItemModel>) => void,
  ): ProductItemModel {
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    this.selectFromQuery = this.selectFromQuery
      .where(({ exists, selectFrom }: any) => {
        let subquery = selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.productItem_id`, '=', 'product_items.id')

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
    callback: (query: SubqueryBuilder<keyof ProductItemModel>) => void,
  ): ProductItemModel {
    return this.applyWhereHas(relation, callback)
  }

  static whereHas(
    relation: string,
    callback: (query: SubqueryBuilder<keyof ProductItemModel>) => void,
  ): ProductItemModel {
    const instance = new ProductItemModel(undefined)

    return instance.applyWhereHas(relation, callback)
  }

  applyDoesntHave(relation: string): ProductItemModel {
    this.selectFromQuery = this.selectFromQuery.where(({ not, exists, selectFrom }: any) =>
      not(
        exists(
          selectFrom(relation)
            .select('1')
            .whereRef(`${relation}.productItem_id`, '=', 'product_items.id'),
        ),
      ),
    )

    return this
  }

  doesntHave(relation: string): ProductItemModel {
    return this.applyDoesntHave(relation)
  }

  static doesntHave(relation: string): ProductItemModel {
    const instance = new ProductItemModel(undefined)

    return instance.applyDoesntHave(relation)
  }

  applyWhereDoesntHave(relation: string, callback: (query: SubqueryBuilder<ProductItemsTable>) => void): ProductItemModel {
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    this.selectFromQuery = this.selectFromQuery
      .where(({ exists, selectFrom, not }: any) => {
        const subquery = selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.productItem_id`, '=', 'product_items.id')

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

  whereDoesntHave(relation: string, callback: (query: SubqueryBuilder<ProductItemsTable>) => void): ProductItemModel {
    return this.applyWhereDoesntHave(relation, callback)
  }

  static whereDoesntHave(
    relation: string,
    callback: (query: SubqueryBuilder<ProductItemsTable>) => void,
  ): ProductItemModel {
    const instance = new ProductItemModel(undefined)

    return instance.applyWhereDoesntHave(relation, callback)
  }

  async applyPaginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<ProductItemResponse> {
    const totalRecordsResult = await DB.instance.selectFrom('product_items')
      .select(DB.instance.fn.count('id').as('total')) // Use 'id' or another actual column name
      .executeTakeFirst()

    const totalRecords = Number(totalRecordsResult?.total) || 0
    const totalPages = Math.ceil(totalRecords / (options.limit ?? 10))

    const product_itemsWithExtra = await DB.instance.selectFrom('product_items')
      .selectAll()
      .orderBy('id', 'asc') // Assuming 'id' is used for cursor-based pagination
      .limit((options.limit ?? 10) + 1) // Fetch one extra record
      .offset(((options.page ?? 1) - 1) * (options.limit ?? 10)) // Ensure options.page is not undefined
      .execute()

    let nextCursor = null
    if (product_itemsWithExtra.length > (options.limit ?? 10))
      nextCursor = product_itemsWithExtra.pop()?.id ?? null

    return {
      data: product_itemsWithExtra,
      paging: {
        total_records: totalRecords,
        page: options.page || 1,
        total_pages: totalPages,
      },
      next_cursor: nextCursor,
    }
  }

  async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<ProductItemResponse> {
    return await this.applyPaginate(options)
  }

  // Method to get all product_items
  static async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<ProductItemResponse> {
    const instance = new ProductItemModel(undefined)

    return await instance.applyPaginate(options)
  }

  async applyCreate(newProductItem: NewProductItem): Promise<ProductItemModel> {
    const filteredValues = Object.fromEntries(
      Object.entries(newProductItem).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewProductItem

    await this.mapCustomSetters(filteredValues)

    filteredValues.uuid = randomUUIDv7()

    const result = await DB.instance.insertInto('product_items')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await this.find(Number(result.numInsertedOrUpdatedRows)) as ProductItemModel

    if (model)
      dispatch('productItem:created', model)

    return model
  }

  async create(newProductItem: NewProductItem): Promise<ProductItemModel> {
    return await this.applyCreate(newProductItem)
  }

  static async create(newProductItem: NewProductItem): Promise<ProductItemModel> {
    const instance = new ProductItemModel(undefined)

    return await instance.applyCreate(newProductItem)
  }

  static async createMany(newProductItem: NewProductItem[]): Promise<void> {
    const instance = new ProductItemModel(undefined)

    const valuesFiltered = newProductItem.map((newProductItem: NewProductItem) => {
      const filteredValues = Object.fromEntries(
        Object.entries(newProductItem).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewProductItem

      filteredValues.uuid = randomUUIDv7()

      return filteredValues
    })

    await DB.instance.insertInto('product_items')
      .values(valuesFiltered)
      .executeTakeFirst()
  }

  static async forceCreate(newProductItem: NewProductItem): Promise<ProductItemModel> {
    const result = await DB.instance.insertInto('product_items')
      .values(newProductItem)
      .executeTakeFirst()

    const model = await find(Number(result.numInsertedOrUpdatedRows)) as ProductItemModel

    if (model)
      dispatch('productItem:created', model)

    return model
  }

  // Method to remove a ProductItem
  static async remove(id: number): Promise<any> {
    const instance = new ProductItemModel(undefined)

    const model = await instance.find(Number(id))

    if (model)
      dispatch('productItem:deleted', model)

    return await DB.instance.deleteFrom('product_items')
      .where('id', '=', id)
      .execute()
  }

  static where<V = string>(column: keyof ProductItemsTable, ...args: [V] | [Operator, V]): ProductItemModel {
    const instance = new ProductItemModel(undefined)

    return instance.applyWhere<V>(column, ...args)
  }

  static whereColumn(first: keyof ProductItemsTable, operator: Operator, second: keyof ProductItemsTable): ProductItemModel {
    const instance = new ProductItemModel(undefined)

    instance.selectFromQuery = instance.applyWhereColumn(first, operator, second)

    return instance
  }

  static whereRef(column: keyof ProductItemsTable, ...args: string[]): ProductItemModel {
    const instance = new ProductItemModel(undefined)

    return instance.applyWhereRef(column, ...args)
  }

  static whereRaw(sqlStatement: string): ProductItemModel {
    const instance = new ProductItemModel(undefined)

    instance.selectFromQuery = instance.applyWhereRaw(sqlStatement)

    return instance
  }

  static orWhere(...conditions: [string, any][]): ProductItemModel {
    const instance = new ProductItemModel(undefined)

    return instance.applyOrWhere(...conditions)
  }

  static when(condition: boolean, callback: (query: ProductItemModel) => ProductItemModel): ProductItemModel {
    const instance = new ProductItemModel(undefined)

    return instance.applyWhen(condition, callback)
  }

  static whereNotNull(column: keyof ProductItemsTable): ProductItemModel {
    const instance = new UserModel(undefined)

    return instance.applyWhereNotNull(column)
  }

  static whereNull(column: keyof ProductItemsTable): ProductItemModel {
    const instance = new ProductItemModel(undefined)

    return instance.applyWhereNull(column)
  }

  static whereName(value: string): ProductItemModel {
    const instance = new ProductItemModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('name', '=', value)

    return instance
  }

  static whereSize(value: string): ProductItemModel {
    const instance = new ProductItemModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('size', '=', value)

    return instance
  }

  static whereColor(value: string): ProductItemModel {
    const instance = new ProductItemModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('color', '=', value)

    return instance
  }

  static wherePrice(value: string): ProductItemModel {
    const instance = new ProductItemModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('price', '=', value)

    return instance
  }

  static whereImageUrl(value: string): ProductItemModel {
    const instance = new ProductItemModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('image_url', '=', value)

    return instance
  }

  static whereIsAvailable(value: string): ProductItemModel {
    const instance = new ProductItemModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('is_available', '=', value)

    return instance
  }

  static whereInventoryCount(value: string): ProductItemModel {
    const instance = new ProductItemModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('inventory_count', '=', value)

    return instance
  }

  static whereSku(value: string): ProductItemModel {
    const instance = new ProductItemModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('sku', '=', value)

    return instance
  }

  static whereCustomOptions(value: string): ProductItemModel {
    const instance = new ProductItemModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('custom_options', '=', value)

    return instance
  }

  static whereIn<V = number>(column: keyof ProductItemsTable, values: V[]): ProductItemModel {
    const instance = new ProductItemModel(undefined)

    return instance.applyWhereIn<V>(column, values)
  }

  static whereBetween<V = number>(column: keyof ProductItemsTable, range: [V, V]): ProductItemModel {
    const instance = new ProductItemModel(undefined)

    return instance.applyWhereBetween<V>(column, range)
  }

  static whereLike(column: keyof ProductItemsTable, value: string): ProductItemModel {
    const instance = new ProductItemModel(undefined)

    return instance.applyWhereLike(column, value)
  }

  static whereNotIn<V = number>(column: keyof ProductItemsTable, values: V[]): ProductItemModel {
    const instance = new ProductItemModel(undefined)

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

  static async latest(): Promise<ProductItemModel | undefined> {
    const instance = new ProductItemModel(undefined)

    const model = await DB.instance.selectFrom('product_items')
      .selectAll()
      .orderBy('id', 'desc')
      .executeTakeFirst()

    if (!model)
      return undefined

    instance.mapCustomGetters(model)

    const data = new ProductItemModel(model)

    return data
  }

  static async oldest(): Promise<ProductItemModel | undefined> {
    const instance = new ProductItemModel(undefined)

    const model = await DB.instance.selectFrom('product_items')
      .selectAll()
      .orderBy('id', 'asc')
      .executeTakeFirst()

    if (!model)
      return undefined

    instance.mapCustomGetters(model)

    const data = new ProductItemModel(model)

    return data
  }

  static async firstOrCreate(
    condition: Partial<ProductItemJsonResponse>,
    newProductItem: NewProductItem,
  ): Promise<ProductItemModel> {
    const instance = new ProductItemModel(undefined)

    const key = Object.keys(condition)[0] as keyof ProductItemJsonResponse

    if (!key) {
      throw new HttpError(500, 'Condition must contain at least one key-value pair')
    }

    const value = condition[key]

    // Attempt to find the first record matching the condition
    const existingProductItem = await DB.instance.selectFrom('product_items')
      .selectAll()
      .where(key, '=', value)
      .executeTakeFirst()

    if (existingProductItem) {
      instance.mapCustomGetters(existingProductItem)
      await instance.loadRelations(existingProductItem)

      return new ProductItemModel(existingProductItem as ProductItemJsonResponse)
    }
    else {
      return await instance.create(newProductItem)
    }
  }

  static async updateOrCreate(
    condition: Partial<ProductItemJsonResponse>,
    newProductItem: NewProductItem,
  ): Promise<ProductItemModel> {
    const instance = new ProductItemModel(undefined)

    const key = Object.keys(condition)[0] as keyof ProductItemJsonResponse

    if (!key) {
      throw new HttpError(500, 'Condition must contain at least one key-value pair')
    }

    const value = condition[key]

    // Attempt to find the first record matching the condition
    const existingProductItem = await DB.instance.selectFrom('product_items')
      .selectAll()
      .where(key, '=', value)
      .executeTakeFirst()

    if (existingProductItem) {
      // If found, update the existing record
      await DB.instance.updateTable('product_items')
        .set(newProductItem)
        .where(key, '=', value)
        .executeTakeFirstOrThrow()

      // Fetch and return the updated record
      const updatedProductItem = await DB.instance.selectFrom('product_items')
        .selectAll()
        .where(key, '=', value)
        .executeTakeFirst()

      if (!updatedProductItem) {
        throw new HttpError(500, 'Failed to fetch updated record')
      }

      instance.hasSaved = true

      return new ProductItemModel(updatedProductItem as ProductItemJsonResponse)
    }
    else {
      // If not found, create a new record
      return await instance.create(newProductItem)
    }
  }

  protected async loadRelations(models: ProductItemJsonResponse | ProductItemJsonResponse[]): Promise<void> {
    // Handle both single model and array of models
    const modelArray = Array.isArray(models) ? models : [models]
    if (!modelArray.length)
      return

    const modelIds = modelArray.map(model => model.id)

    for (const relation of this.withRelations) {
      const relatedRecords = await DB.instance
        .selectFrom(relation)
        .where('productItem_id', 'in', modelIds)
        .selectAll()
        .execute()

      if (Array.isArray(models)) {
        models.map((model: ProductItemJsonResponse) => {
          const records = relatedRecords.filter((record: { productItem_id: number }) => {
            return record.productItem_id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      }
      else {
        const records = relatedRecords.filter((record: { productItem_id: number }) => {
          return record.productItem_id === models.id
        })

        models[relation] = records.length === 1 ? records[0] : records
      }
    }
  }

  static with(relations: string[]): ProductItemModel {
    const instance = new ProductItemModel(undefined)

    instance.withRelations = relations

    return instance
  }

  async last(): Promise<ProductItemModel | undefined> {
    const model = await this.applyLast()

    const data = new ProductItemModel(model)

    return data
  }

  static async last(): Promise<ProductItemModel | undefined> {
    const instance = new ProductItemModel(undefined)

    const model = await instance.applyLast()

    if (!model)
      return undefined

    const data = new ProductItemModel(model)

    return data
  }

  static orderBy(column: keyof ProductItemsTable, order: 'asc' | 'desc'): ProductItemModel {
    const instance = new UserModel(undefined)

    return instance.applyOrderBy(column, order)
  }

  static groupBy(column: keyof ProductItemsTable): ProductItemModel {
    const instance = new ProductItemModel(undefined)

    return instance.applyGroupBy(column)
  }

  static having<V = string>(column: keyof ProductItemsTable, operator: Operator, value: V): ProductItemModel {
    const instance = new ProductItemModel(undefined)

    return instance.applyHaving(column, operator, value)
  }

  static inRandomOrder(): ProductItemModel {
    const instance = new ProductItemModel(undefined)

    return instance.applyInRandomOrder()
  }

  static orderByDesc(column: keyof ProductItemsTable): ProductItemModel {
    const instance = new ProductItemModel(undefined)

    return instance.applyOrderByDesc(column)
  }

  static orderByAsc(column: keyof ProductItemsTable): ProductItemModel {
    const instance = new ProductItemModel(undefined)

    return instance.applyOrderByAsc(column)
  }

  async update(newProductItem: ProductItemUpdate): Promise<ProductItemModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newProductItem).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewProductItem

    await this.mapCustomSetters(filteredValues)

    await DB.instance.updateTable('product_items')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      const model = await this.find(this.id)

      if (model)
        dispatch('productItem:updated', model)

      return model
    }

    this.hasSaved = true

    return undefined
  }

  async forceUpdate(productItem: ProductItemUpdate): Promise<ProductItemModel | undefined> {
    if (this.id === undefined) {
      this.updateFromQuery.set(productItem).execute()
    }

    await this.mapCustomSetters(productItem)

    await DB.instance.updateTable('product_items')
      .set(productItem)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      const model = await this.find(this.id)

      if (model)
        dispatch('productItem:updated', model)

      this.hasSaved = true

      return model
    }

    return undefined
  }

  async save(): Promise<void> {
    if (!this)
      throw new HttpError(500, 'ProductItem data is undefined')

    await this.mapCustomSetters(this.attributes)

    if (this.id === undefined) {
      await this.create(this.attributes)
    }
    else {
      await this.update(this.attributes)
    }

    this.hasSaved = true
  }

  fill(data: Partial<ProductItemJsonResponse>): ProductItemModel {
    const filteredValues = Object.fromEntries(
      Object.entries(data).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewProductItem

    this.attributes = {
      ...this.attributes,
      ...filteredValues,
    }

    return this
  }

  forceFill(data: Partial<ProductItemJsonResponse>): ProductItemModel {
    this.attributes = {
      ...this.attributes,
      ...data,
    }

    return this
  }

  // Method to delete (soft delete) the productItem instance
  async delete(): Promise<ProductItemsTable> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()
    const model = await this.find(Number(this.id))
    if (model)
      dispatch('productItem:deleted', model)

    return await DB.instance.deleteFrom('product_items')
      .where('id', '=', this.id)
      .execute()
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

  async manufacturerBelong(): Promise<ManufacturerModel> {
    if (this.manufacturer_id === undefined)
      throw new HttpError(500, 'Relation Error!')

    const model = await Manufacturer
      .where('id', '=', this.manufacturer_id)
      .first()

    if (!model)
      throw new HttpError(500, 'Model Relation Not Found!')

    return model
  }

  async productCategoryBelong(): Promise<ProductCategoryModel> {
    if (this.product_category_id === undefined)
      throw new HttpError(500, 'Relation Error!')

    const model = await ProductCategory
      .where('id', '=', this.product_category_id)
      .first()

    if (!model)
      throw new HttpError(500, 'Model Relation Not Found!')

    return model
  }

  toSearchableObject(): Partial<ProductItemJsonResponse> {
    return {
      id: this.id,
      name: this.name,
      product_id: this.product_id,
      size: this.size,
      color: this.color,
      price: this.price,
      is_available: this.is_available,
      inventory_count: this.inventory_count,
    }
  }

  distinct(column: keyof ProductItemJsonResponse): ProductItemModel {
    this.selectFromQuery = this.selectFromQuery.select(column).distinct()

    this.hasSelect = true

    return this
  }

  static distinct(column: keyof ProductItemJsonResponse): ProductItemModel {
    const instance = new ProductItemModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.select(column).distinct()

    instance.hasSelect = true

    return instance
  }

  join(table: string, firstCol: string, secondCol: string): ProductItemModel {
    this.selectFromQuery = this.selectFromQuery.innerJoin(table, firstCol, secondCol)

    return this
  }

  static join(table: string, firstCol: string, secondCol: string): ProductItemModel {
    const instance = new ProductItemModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.innerJoin(table, firstCol, secondCol)

    return instance
  }

  toJSON(): ProductItemJsonResponse {
    const output = {

      uuid: this.uuid,

      id: this.id,
      name: this.name,
      size: this.size,
      color: this.color,
      price: this.price,
      image_url: this.image_url,
      is_available: this.is_available,
      inventory_count: this.inventory_count,
      sku: this.sku,
      custom_options: this.custom_options,

      created_at: this.created_at,

      updated_at: this.updated_at,

      product_id: this.product_id,
      product: this.product,
      manufacturer_id: this.manufacturer_id,
      manufacturer: this.manufacturer,
      product_category_id: this.product_category_id,
      product_category: this.product_category,
      ...this.customColumns,
    }

    return output
  }

  parseResult(model: ProductItemModel): ProductItemModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof ProductItemModel]
    }

    return model
  }
}

async function find(id: number): Promise<ProductItemModel | undefined> {
  const query = DB.instance.selectFrom('product_items').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  return new ProductItemModel(model)
}

export async function count(): Promise<number> {
  const results = await ProductItemModel.count()

  return results
}

export async function create(newProductItem: NewProductItem): Promise<ProductItemModel> {
  const result = await DB.instance.insertInto('product_items')
    .values(newProductItem)
    .executeTakeFirstOrThrow()

  return await find(Number(result.numInsertedOrUpdatedRows)) as ProductItemModel
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(DB.instance)
}

export async function remove(id: number): Promise<void> {
  await DB.instance.deleteFrom('product_items')
    .where('id', '=', id)
    .execute()
}

export async function whereName(value: string): Promise<ProductItemModel[]> {
  const query = DB.instance.selectFrom('product_items').where('name', '=', value)
  const results: ProductItemJsonResponse = await query.execute()

  return results.map((modelItem: ProductItemJsonResponse) => new ProductItemModel(modelItem))
}

export async function whereSize(value: string): Promise<ProductItemModel[]> {
  const query = DB.instance.selectFrom('product_items').where('size', '=', value)
  const results: ProductItemJsonResponse = await query.execute()

  return results.map((modelItem: ProductItemJsonResponse) => new ProductItemModel(modelItem))
}

export async function whereColor(value: string): Promise<ProductItemModel[]> {
  const query = DB.instance.selectFrom('product_items').where('color', '=', value)
  const results: ProductItemJsonResponse = await query.execute()

  return results.map((modelItem: ProductItemJsonResponse) => new ProductItemModel(modelItem))
}

export async function wherePrice(value: number): Promise<ProductItemModel[]> {
  const query = DB.instance.selectFrom('product_items').where('price', '=', value)
  const results: ProductItemJsonResponse = await query.execute()

  return results.map((modelItem: ProductItemJsonResponse) => new ProductItemModel(modelItem))
}

export async function whereImageUrl(value: string): Promise<ProductItemModel[]> {
  const query = DB.instance.selectFrom('product_items').where('image_url', '=', value)
  const results: ProductItemJsonResponse = await query.execute()

  return results.map((modelItem: ProductItemJsonResponse) => new ProductItemModel(modelItem))
}

export async function whereIsAvailable(value: boolean): Promise<ProductItemModel[]> {
  const query = DB.instance.selectFrom('product_items').where('is_available', '=', value)
  const results: ProductItemJsonResponse = await query.execute()

  return results.map((modelItem: ProductItemJsonResponse) => new ProductItemModel(modelItem))
}

export async function whereInventoryCount(value: number): Promise<ProductItemModel[]> {
  const query = DB.instance.selectFrom('product_items').where('inventory_count', '=', value)
  const results: ProductItemJsonResponse = await query.execute()

  return results.map((modelItem: ProductItemJsonResponse) => new ProductItemModel(modelItem))
}

export async function whereSku(value: string): Promise<ProductItemModel[]> {
  const query = DB.instance.selectFrom('product_items').where('sku', '=', value)
  const results: ProductItemJsonResponse = await query.execute()

  return results.map((modelItem: ProductItemJsonResponse) => new ProductItemModel(modelItem))
}

export async function whereCustomOptions(value: string): Promise<ProductItemModel[]> {
  const query = DB.instance.selectFrom('product_items').where('custom_options', '=', value)
  const results: ProductItemJsonResponse = await query.execute()

  return results.map((modelItem: ProductItemJsonResponse) => new ProductItemModel(modelItem))
}

export const ProductItem = ProductItemModel

export default ProductItem
