import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import type { ManufacturerModel } from './Manufacturer'
import type { ProductCategoryModel } from './ProductCategory'
import { randomUUIDv7 } from 'bun'
import { cache } from '@stacksjs/cache'
import { sql } from '@stacksjs/database'
import { HttpError, ModelNotFoundException } from '@stacksjs/error-handling'
import { dispatch } from '@stacksjs/events'

import { BaseOrm, DB, SubqueryBuilder } from '@stacksjs/orm'

import Manufacturer from './Manufacturer'

import ProductCategory from './ProductCategory'

export interface ProductsTable {
  id: Generated<number>
  product_category_id: number
  manufacturer_id: number
  name: string
  description?: string
  price: number
  image_url?: string
  is_available?: boolean
  inventory_count?: number
  category_id: string
  preparation_time: number
  allergens?: string
  nutritional_info?: string
  uuid?: string

  created_at?: Date

  updated_at?: Date

}

export interface ProductResponse {
  data: ProductJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface ProductJsonResponse extends Omit<Selectable<ProductsTable>, 'password'> {
  [key: string]: any
}

export type NewProduct = Insertable<ProductsTable>
export type ProductUpdate = Updateable<ProductsTable>

      type SortDirection = 'asc' | 'desc'
interface SortOptions { column: ProductJsonResponse, order: SortDirection }
// Define a type for the options parameter
interface QueryOptions {
  sort?: SortOptions
  limit?: number
  offset?: number
  page?: number
}

export class ProductModel extends BaseOrm<ProductModel, ProductsTable> {
  private readonly hidden: Array<keyof ProductJsonResponse> = []
  private readonly fillable: Array<keyof ProductJsonResponse> = ['name', 'description', 'price', 'image_url', 'is_available', 'inventory_count', 'category_id', 'preparation_time', 'allergens', 'nutritional_info', 'uuid', 'manufacturer_id', 'product_category_id']
  private readonly guarded: Array<keyof ProductJsonResponse> = []
  protected attributes = {} as ProductJsonResponse
  protected originalAttributes = {} as ProductJsonResponse

  protected selectFromQuery: any
  protected withRelations: string[]
  protected updateFromQuery: any
  protected deleteFromQuery: any
  protected hasSelect: boolean
  private hasSaved: boolean
  private customColumns: Record<string, unknown> = {}

  constructor(product: ProductJsonResponse | undefined) {
    super('products')
    if (product) {
      this.attributes = { ...product }
      this.originalAttributes = { ...product }

      Object.keys(product).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (product as ProductJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = DB.instance.selectFrom('products')
    this.updateFromQuery = DB.instance.updateTable('products')
    this.deleteFromQuery = DB.instance.deleteFrom('products')
    this.hasSelect = false
    this.hasSaved = false
  }

  protected mapCustomGetters(models: ProductJsonResponse | ProductJsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: ProductJsonResponse) => {
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

  async mapCustomSetters(model: NewProduct | ProductUpdate): Promise<void> {
    const customSetter = {
      default: () => {
      },

    }

    for (const [key, fn] of Object.entries(customSetter)) {
      model[key] = await fn()
    }
  }

  get product_category_id(): number {
    return this.attributes.product_category_id
  }

  get product_category(): ProductCategoryModel | undefined {
    return this.attributes.product_category
  }

  get manufacturer_id(): number {
    return this.attributes.manufacturer_id
  }

  get manufacturer(): ManufacturerModel | undefined {
    return this.attributes.manufacturer
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

  get description(): string | undefined {
    return this.attributes.description
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

  get category_id(): string {
    return this.attributes.category_id
  }

  get preparation_time(): number {
    return this.attributes.preparation_time
  }

  get allergens(): string | undefined {
    return this.attributes.allergens
  }

  get nutritional_info(): string | undefined {
    return this.attributes.nutritional_info
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

  set description(value: string) {
    this.attributes.description = value
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

  set category_id(value: string) {
    this.attributes.category_id = value
  }

  set preparation_time(value: number) {
    this.attributes.preparation_time = value
  }

  set allergens(value: string) {
    this.attributes.allergens = value
  }

  set nutritional_info(value: string) {
    this.attributes.nutritional_info = value
  }

  set updated_at(value: Date) {
    this.attributes.updated_at = value
  }

  getOriginal(column?: keyof ProductJsonResponse): Partial<ProductJsonResponse> {
    if (column) {
      return this.originalAttributes[column]
    }

    return this.originalAttributes
  }

  getChanges(): Partial<ProductJsonResponse> {
    return this.fillable.reduce<Partial<ProductJsonResponse>>((changes, key) => {
      const currentValue = this.attributes[key as keyof ProductsTable]
      const originalValue = this.originalAttributes[key as keyof ProductsTable]

      if (currentValue !== originalValue) {
        changes[key] = currentValue
      }

      return changes
    }, {})
  }

  isDirty(column?: keyof ProductJsonResponse): boolean {
    if (column) {
      return this.attributes[column] !== this.originalAttributes[column]
    }

    return Object.entries(this.originalAttributes).some(([key, originalValue]) => {
      const currentValue = (this.attributes as any)[key]

      return currentValue !== originalValue
    })
  }

  isClean(column?: keyof ProductJsonResponse): boolean {
    return !this.isDirty(column)
  }

  wasChanged(column?: keyof ProductJsonResponse): boolean {
    return this.hasSaved && this.isDirty(column)
  }

  select(params: (keyof ProductJsonResponse)[] | RawBuilder<string> | string): ProductModel {
    this.selectFromQuery = this.selectFromQuery.select(params)

    this.hasSelect = true

    return this
  }

  static select(params: (keyof ProductJsonResponse)[] | RawBuilder<string> | string): ProductModel {
    const instance = new ProductModel(undefined)

    // Initialize a query with the table name and selected fields
    instance.selectFromQuery = instance.selectFromQuery.select(params)

    instance.hasSelect = true

    return instance
  }

  // Method to find a Product by ID
  static async find(id: number): Promise<ProductModel | undefined> {
    const instance = new ProductModel(undefined)

    return await instance.applyFind(id)
  }

  async first(): Promise<ProductModel | undefined> {
    const model = await this.applyFirst()

    const data = new ProductModel(model)

    return data
  }

  static async first(): Promise<ProductModel | undefined> {
    const instance = new ProductModel(undefined)

    const model = await instance.applyFirst()

    const data = new ProductModel(model)

    return data
  }

  async applyFirstOrFail(): Promise<ProductModel | undefined> {
    const model = await this.selectFromQuery.executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, 'No ProductModel results found for query')

    if (model) {
      this.mapCustomGetters(model)
      await this.loadRelations(model)
    }

    const data = new ProductModel(model)

    return data
  }

  async firstOrFail(): Promise<ProductModel | undefined> {
    return await this.applyFirstOrFail()
  }

  static async firstOrFail(): Promise<ProductModel | undefined> {
    const instance = new ProductModel(undefined)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<ProductModel[]> {
    const instance = new ProductModel(undefined)

    const models = await DB.instance.selectFrom('products').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: ProductJsonResponse) => {
      return new ProductModel(model)
    }))

    return data
  }

  async applyFindOrFail(id: number): Promise<ProductModel> {
    const model = await DB.instance.selectFrom('products').where('id', '=', id).selectAll().executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, `No ProductModel results for ${id}`)

    cache.getOrSet(`product:${id}`, JSON.stringify(model))

    this.mapCustomGetters(model)
    await this.loadRelations(model)

    const data = new ProductModel(model)

    return data
  }

  async findOrFail(id: number): Promise<ProductModel> {
    return await this.applyFindOrFail(id)
  }

  static async findOrFail(id: number): Promise<ProductModel> {
    const instance = new ProductModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  async applyFindMany(ids: number[]): Promise<ProductModel[]> {
    let query = DB.instance.selectFrom('products').where('id', 'in', ids)

    const instance = new ProductModel(undefined)

    query = query.selectAll()

    const models = await query.execute()

    instance.mapCustomGetters(models)
    await instance.loadRelations(models)

    return models.map((modelItem: ProductJsonResponse) => instance.parseResult(new ProductModel(modelItem)))
  }

  static async findMany(ids: number[]): Promise<ProductModel[]> {
    const instance = new ProductModel(undefined)

    return await instance.applyFindMany(ids)
  }

  async findMany(ids: number[]): Promise<ProductModel[]> {
    return await this.applyFindMany(ids)
  }

  skip(count: number): ProductModel {
    this.selectFromQuery = this.selectFromQuery.offset(count)

    return this
  }

  static skip(count: number): ProductModel {
    const instance = new ProductModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.offset(count)

    return instance
  }

  async applyChunk(size: number, callback: (models: ProductModel[]) => Promise<void>): Promise<void> {
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

  async chunk(size: number, callback: (models: ProductModel[]) => Promise<void>): Promise<void> {
    await this.applyChunk(size, callback)
  }

  static async chunk(size: number, callback: (models: ProductModel[]) => Promise<void>): Promise<void> {
    const instance = new ProductModel(undefined)

    await instance.applyChunk(size, callback)
  }

  take(count: number): ProductModel {
    this.selectFromQuery = this.selectFromQuery.limit(count)

    return this
  }

  static take(count: number): ProductModel {
    const instance = new ProductModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.limit(count)

    return instance
  }

  static async pluck<K extends keyof ProductModel>(field: K): Promise<ProductModel[K][]> {
    const instance = new ProductModel(undefined)

    if (instance.hasSelect) {
      const model = await instance.selectFromQuery.execute()
      return model.map((modelItem: ProductModel) => modelItem[field])
    }

    const model = await instance.selectFromQuery.selectAll().execute()

    return model.map((modelItem: ProductModel) => modelItem[field])
  }

  async pluck<K extends keyof ProductModel>(field: K): Promise<ProductModel[K][]> {
    if (this.hasSelect) {
      const model = await this.selectFromQuery.execute()
      return model.map((modelItem: ProductModel) => modelItem[field])
    }

    const model = await this.selectFromQuery.selectAll().execute()

    return model.map((modelItem: ProductModel) => modelItem[field])
  }

  static async count(): Promise<number> {
    const instance = new ProductModel(undefined)

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

  static async max(field: keyof ProductModel): Promise<number> {
    const instance = new ProductModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`MAX(${sql.raw(field as string)}) as max `)
      .executeTakeFirst()

    return result.max
  }

  async max(field: keyof ProductModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`MAX(${sql.raw(field as string)}) as max`)
      .executeTakeFirst()

    return result.max
  }

  static async min(field: keyof ProductModel): Promise<number> {
    const instance = new ProductModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`MIN(${sql.raw(field as string)}) as min `)
      .executeTakeFirst()

    return result.min
  }

  async min(field: keyof ProductModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`MIN(${sql.raw(field as string)}) as min `)
      .executeTakeFirst()

    return result.min
  }

  static async avg(field: keyof ProductModel): Promise<number> {
    const instance = new ProductModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`AVG(${sql.raw(field as string)}) as avg `)
      .executeTakeFirst()

    return result.avg
  }

  async avg(field: keyof ProductModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`AVG(${sql.raw(field as string)}) as avg `)
      .executeTakeFirst()

    return result.avg
  }

  static async sum(field: keyof ProductModel): Promise<number> {
    const instance = new ProductModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`SUM(${sql.raw(field as string)}) as sum `)
      .executeTakeFirst()

    return result.sum
  }

  async sum(field: keyof ProductModel): Promise<number> {
    const result = this.selectFromQuery
      .select(sql`SUM(${sql.raw(field as string)}) as sum `)
      .executeTakeFirst()

    return result.sum
  }

  async applyGet(): Promise<ProductModel[]> {
    let models

    if (this.hasSelect) {
      models = await this.selectFromQuery.execute()
    }
    else {
      models = await this.selectFromQuery.selectAll().execute()
    }

    this.mapCustomGetters(models)
    await this.loadRelations(models)

    const data = await Promise.all(models.map(async (model: ProductJsonResponse) => {
      return new ProductModel(model)
    }))

    return data
  }

  async get(): Promise<ProductModel[]> {
    return await this.applyGet()
  }

  static async get(): Promise<ProductModel[]> {
    const instance = new ProductModel(undefined)

    return await instance.applyGet()
  }

  has(relation: string): ProductModel {
    this.selectFromQuery = this.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(
        selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.product_id`, '=', 'products.id'),
      ),
    )

    return this
  }

  static has(relation: string): ProductModel {
    const instance = new ProductModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(
        selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.product_id`, '=', 'products.id'),
      ),
    )

    return instance
  }

  static whereExists(callback: (qb: any) => any): ProductModel {
    const instance = new ProductModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(callback({ exists, selectFrom })),
    )

    return instance
  }

  applyWhereHas(
    relation: string,
    callback: (query: SubqueryBuilder<keyof ProductModel>) => void,
  ): ProductModel {
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    this.selectFromQuery = this.selectFromQuery
      .where(({ exists, selectFrom }: any) => {
        let subquery = selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.product_id`, '=', 'products.id')

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
    callback: (query: SubqueryBuilder<keyof ProductModel>) => void,
  ): ProductModel {
    return this.applyWhereHas(relation, callback)
  }

  static whereHas(
    relation: string,
    callback: (query: SubqueryBuilder<keyof ProductModel>) => void,
  ): ProductModel {
    const instance = new ProductModel(undefined)

    return instance.applyWhereHas(relation, callback)
  }

  applyDoesntHave(relation: string): ProductModel {
    this.selectFromQuery = this.selectFromQuery.where(({ not, exists, selectFrom }: any) =>
      not(
        exists(
          selectFrom(relation)
            .select('1')
            .whereRef(`${relation}.product_id`, '=', 'products.id'),
        ),
      ),
    )

    return this
  }

  doesntHave(relation: string): ProductModel {
    return this.applyDoesntHave(relation)
  }

  static doesntHave(relation: string): ProductModel {
    const instance = new ProductModel(undefined)

    return instance.applyDoesntHave(relation)
  }

  applyWhereDoesntHave(relation: string, callback: (query: SubqueryBuilder<ProductsTable>) => void): ProductModel {
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    this.selectFromQuery = this.selectFromQuery
      .where(({ exists, selectFrom, not }: any) => {
        const subquery = selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.product_id`, '=', 'products.id')

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

  whereDoesntHave(relation: string, callback: (query: SubqueryBuilder<ProductsTable>) => void): ProductModel {
    return this.applyWhereDoesntHave(relation, callback)
  }

  static whereDoesntHave(
    relation: string,
    callback: (query: SubqueryBuilder<ProductsTable>) => void,
  ): ProductModel {
    const instance = new ProductModel(undefined)

    return instance.applyWhereDoesntHave(relation, callback)
  }

  async applyPaginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<ProductResponse> {
    const totalRecordsResult = await DB.instance.selectFrom('products')
      .select(DB.instance.fn.count('id').as('total')) // Use 'id' or another actual column name
      .executeTakeFirst()

    const totalRecords = Number(totalRecordsResult?.total) || 0
    const totalPages = Math.ceil(totalRecords / (options.limit ?? 10))

    const productsWithExtra = await DB.instance.selectFrom('products')
      .selectAll()
      .orderBy('id', 'asc') // Assuming 'id' is used for cursor-based pagination
      .limit((options.limit ?? 10) + 1) // Fetch one extra record
      .offset(((options.page ?? 1) - 1) * (options.limit ?? 10)) // Ensure options.page is not undefined
      .execute()

    let nextCursor = null
    if (productsWithExtra.length > (options.limit ?? 10))
      nextCursor = productsWithExtra.pop()?.id ?? null

    return {
      data: productsWithExtra,
      paging: {
        total_records: totalRecords,
        page: options.page || 1,
        total_pages: totalPages,
      },
      next_cursor: nextCursor,
    }
  }

  async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<ProductResponse> {
    return await this.applyPaginate(options)
  }

  // Method to get all products
  static async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<ProductResponse> {
    const instance = new ProductModel(undefined)

    return await instance.applyPaginate(options)
  }

  async applyCreate(newProduct: NewProduct): Promise<ProductModel> {
    const filteredValues = Object.fromEntries(
      Object.entries(newProduct).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewProduct

    await this.mapCustomSetters(filteredValues)

    filteredValues.uuid = randomUUIDv7()

    const result = await DB.instance.insertInto('products')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await this.find(Number(result.numInsertedOrUpdatedRows)) as ProductModel

    if (model)
      dispatch('product:created', model)

    return model
  }

  async create(newProduct: NewProduct): Promise<ProductModel> {
    return await this.applyCreate(newProduct)
  }

  static async create(newProduct: NewProduct): Promise<ProductModel> {
    const instance = new ProductModel(undefined)

    return await instance.applyCreate(newProduct)
  }

  static async createMany(newProduct: NewProduct[]): Promise<void> {
    const instance = new ProductModel(undefined)

    const valuesFiltered = newProduct.map((newProduct: NewProduct) => {
      const filteredValues = Object.fromEntries(
        Object.entries(newProduct).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewProduct

      filteredValues.uuid = randomUUIDv7()

      return filteredValues
    })

    await DB.instance.insertInto('products')
      .values(valuesFiltered)
      .executeTakeFirst()
  }

  static async forceCreate(newProduct: NewProduct): Promise<ProductModel> {
    const result = await DB.instance.insertInto('products')
      .values(newProduct)
      .executeTakeFirst()

    const model = await find(Number(result.numInsertedOrUpdatedRows)) as ProductModel

    if (model)
      dispatch('product:created', model)

    return model
  }

  // Method to remove a Product
  static async remove(id: number): Promise<any> {
    const instance = new ProductModel(undefined)

    const model = await instance.find(Number(id))

    if (model)
      dispatch('product:deleted', model)

    return await DB.instance.deleteFrom('products')
      .where('id', '=', id)
      .execute()
  }

  static where<V = string>(column: keyof ProductsTable, ...args: [V] | [Operator, V]): ProductModel {
    const instance = new ProductModel(undefined)

    return instance.applyWhere<V>(column, ...args)
  }

  static whereColumn(first: keyof ProductsTable, operator: Operator, second: keyof ProductsTable): ProductModel {
    const instance = new ProductModel(undefined)

    instance.selectFromQuery = instance.applyWhereColumn(first, operator, second)

    return instance
  }

  static whereRef(column: keyof ProductsTable, ...args: string[]): ProductModel {
    const instance = new ProductModel(undefined)

    return instance.applyWhereRef(column, ...args)
  }

  static whereRaw(sqlStatement: string): ProductModel {
    const instance = new ProductModel(undefined)

    instance.selectFromQuery = instance.applyWhereRaw(sqlStatement)

    return instance
  }

  applyOrWhere(...conditions: [string, any][]): ProductModel {
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

  orWhere(...conditions: [string, any][]): ProductModel {
    return this.applyOrWhere(...conditions)
  }

  static orWhere(...conditions: [string, any][]): ProductModel {
    const instance = new ProductModel(undefined)

    return instance.applyOrWhere(...conditions)
  }

  when(
    condition: boolean,
    callback: (query: ProductModel) => ProductModel,
  ): ProductModel {
    return ProductModel.when(condition, callback)
  }

  static when(
    condition: boolean,
    callback: (query: ProductModel) => ProductModel,
  ): ProductModel {
    let instance = new ProductModel(undefined)

    if (condition)
      instance = callback(instance)

    return instance
  }

  whereNotNull(column: keyof ProductsTable): ProductModel {
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

  static whereNotNull(column: keyof ProductsTable): ProductModel {
    const instance = new ProductModel(undefined)

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

  whereNull(column: keyof ProductsTable): ProductModel {
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

  static whereNull(column: keyof ProductsTable): ProductModel {
    const instance = new ProductModel(undefined)

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

  static whereName(value: string): ProductModel {
    const instance = new ProductModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('name', '=', value)

    return instance
  }

  static whereDescription(value: string): ProductModel {
    const instance = new ProductModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('description', '=', value)

    return instance
  }

  static wherePrice(value: string): ProductModel {
    const instance = new ProductModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('price', '=', value)

    return instance
  }

  static whereImageUrl(value: string): ProductModel {
    const instance = new ProductModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('image_url', '=', value)

    return instance
  }

  static whereIsAvailable(value: string): ProductModel {
    const instance = new ProductModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('is_available', '=', value)

    return instance
  }

  static whereInventoryCount(value: string): ProductModel {
    const instance = new ProductModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('inventory_count', '=', value)

    return instance
  }

  static whereCategoryId(value: string): ProductModel {
    const instance = new ProductModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('category_id', '=', value)

    return instance
  }

  static wherePreparationTime(value: string): ProductModel {
    const instance = new ProductModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('preparation_time', '=', value)

    return instance
  }

  static whereAllergens(value: string): ProductModel {
    const instance = new ProductModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('allergens', '=', value)

    return instance
  }

  static whereNutritionalInfo(value: string): ProductModel {
    const instance = new ProductModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('nutritional_info', '=', value)

    return instance
  }

  applyWhereIn<V>(column: keyof ProductsTable, values: V[]) {
    this.selectFromQuery = this.selectFromQuery.where(column, 'in', values)

    this.updateFromQuery = this.updateFromQuery.where(column, 'in', values)

    this.deleteFromQuery = this.deleteFromQuery.where(column, 'in', values)

    return this
  }

  whereIn<V = number>(column: keyof ProductsTable, values: V[]): ProductModel {
    return this.applyWhereIn<V>(column, values)
  }

  static whereIn<V = number>(column: keyof ProductsTable, values: V[]): ProductModel {
    const instance = new ProductModel(undefined)

    return instance.applyWhereIn<V>(column, values)
  }

  applyWhereBetween<V>(column: keyof ProductsTable, range: [V, V]): ProductModel {
    if (range.length !== 2) {
      throw new HttpError(500, 'Range must have exactly two values: [min, max]')
    }

    const query = sql` ${sql.raw(column as string)} between ${range[0]} and ${range[1]} `

    this.selectFromQuery = this.selectFromQuery.where(query)
    this.updateFromQuery = this.updateFromQuery.where(query)
    this.deleteFromQuery = this.deleteFromQuery.where(query)

    return this
  }

  whereBetween<V = number>(column: keyof ProductsTable, range: [V, V]): ProductModel {
    return this.applyWhereBetween<V>(column, range)
  }

  static whereBetween<V = number>(column: keyof ProductsTable, range: [V, V]): ProductModel {
    const instance = new ProductModel(undefined)

    return instance.applyWhereBetween<V>(column, range)
  }

  applyWhereLike(column: keyof ProductsTable, value: string): ProductModel {
    this.selectFromQuery = this.selectFromQuery.where(sql` ${sql.raw(column as string)} LIKE ${value}`)

    this.updateFromQuery = this.updateFromQuery.where(sql` ${sql.raw(column as string)} LIKE ${value}`)

    this.deleteFromQuery = this.deleteFromQuery.where(sql` ${sql.raw(column as string)} LIKE ${value}`)

    return this
  }

  whereLike(column: keyof ProductsTable, value: string): ProductModel {
    return this.applyWhereLike(column, value)
  }

  static whereLike(column: keyof ProductsTable, value: string): ProductModel {
    const instance = new ProductModel(undefined)

    return instance.applyWhereLike(column, value)
  }

  applyWhereNotIn<V>(column: keyof ProductsTable, values: V[]): ProductModel {
    this.selectFromQuery = this.selectFromQuery.where(column, 'not in', values)

    this.updateFromQuery = this.updateFromQuery.where(column, 'not in', values)

    this.deleteFromQuery = this.deleteFromQuery.where(column, 'not in', values)

    return this
  }

  whereNotIn<V>(column: keyof ProductsTable, values: V[]): ProductModel {
    return this.applyWhereNotIn<V>(column, values)
  }

  static whereNotIn<V = number>(column: keyof ProductsTable, values: V[]): ProductModel {
    const instance = new ProductModel(undefined)

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

  static async latest(): Promise<ProductModel | undefined> {
    const instance = new ProductModel(undefined)

    const model = await DB.instance.selectFrom('products')
      .selectAll()
      .orderBy('id', 'desc')
      .executeTakeFirst()

    if (!model)
      return undefined

    instance.mapCustomGetters(model)

    const data = new ProductModel(model)

    return data
  }

  static async oldest(): Promise<ProductModel | undefined> {
    const instance = new ProductModel(undefined)

    const model = await DB.instance.selectFrom('products')
      .selectAll()
      .orderBy('id', 'asc')
      .executeTakeFirst()

    if (!model)
      return undefined

    instance.mapCustomGetters(model)

    const data = new ProductModel(model)

    return data
  }

  static async firstOrCreate(
    condition: Partial<ProductJsonResponse>,
    newProduct: NewProduct,
  ): Promise<ProductModel> {
    const instance = new ProductModel(undefined)

    const key = Object.keys(condition)[0] as keyof ProductJsonResponse

    if (!key) {
      throw new HttpError(500, 'Condition must contain at least one key-value pair')
    }

    const value = condition[key]

    // Attempt to find the first record matching the condition
    const existingProduct = await DB.instance.selectFrom('products')
      .selectAll()
      .where(key, '=', value)
      .executeTakeFirst()

    if (existingProduct) {
      instance.mapCustomGetters(existingProduct)
      await instance.loadRelations(existingProduct)

      return new ProductModel(existingProduct as ProductJsonResponse)
    }
    else {
      return await instance.create(newProduct)
    }
  }

  static async updateOrCreate(
    condition: Partial<ProductJsonResponse>,
    newProduct: NewProduct,
  ): Promise<ProductModel> {
    const instance = new ProductModel(undefined)

    const key = Object.keys(condition)[0] as keyof ProductJsonResponse

    if (!key) {
      throw new HttpError(500, 'Condition must contain at least one key-value pair')
    }

    const value = condition[key]

    // Attempt to find the first record matching the condition
    const existingProduct = await DB.instance.selectFrom('products')
      .selectAll()
      .where(key, '=', value)
      .executeTakeFirst()

    if (existingProduct) {
      // If found, update the existing record
      await DB.instance.updateTable('products')
        .set(newProduct)
        .where(key, '=', value)
        .executeTakeFirstOrThrow()

      // Fetch and return the updated record
      const updatedProduct = await DB.instance.selectFrom('products')
        .selectAll()
        .where(key, '=', value)
        .executeTakeFirst()

      if (!updatedProduct) {
        throw new HttpError(500, 'Failed to fetch updated record')
      }

      instance.hasSaved = true

      return new ProductModel(updatedProduct as ProductJsonResponse)
    }
    else {
      // If not found, create a new record
      return await instance.create(newProduct)
    }
  }

  protected async loadRelations(models: ProductJsonResponse | ProductJsonResponse[]): Promise<void> {
    // Handle both single model and array of models
    const modelArray = Array.isArray(models) ? models : [models]
    if (!modelArray.length)
      return

    const modelIds = modelArray.map(model => model.id)

    for (const relation of this.withRelations) {
      const relatedRecords = await DB.instance
        .selectFrom(relation)
        .where('product_id', 'in', modelIds)
        .selectAll()
        .execute()

      if (Array.isArray(models)) {
        models.map((model: ProductJsonResponse) => {
          const records = relatedRecords.filter((record: { product_id: number }) => {
            return record.product_id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      }
      else {
        const records = relatedRecords.filter((record: { product_id: number }) => {
          return record.product_id === models.id
        })

        models[relation] = records.length === 1 ? records[0] : records
      }
    }
  }

  with(relations: string[]): ProductModel {
    this.withRelations = relations

    return this
  }

  static with(relations: string[]): ProductModel {
    const instance = new ProductModel(undefined)

    instance.withRelations = relations

    return instance
  }

  async last(): Promise<ProductModel | undefined> {
    let model: ProductJsonResponse | undefined

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

    const data = new ProductModel(model)

    return data
  }

  static async last(): Promise<ProductModel | undefined> {
    const model = await DB.instance.selectFrom('products').selectAll().orderBy('id', 'desc').executeTakeFirst()

    if (!model)
      return undefined

    const data = new ProductModel(model)

    return data
  }

  orderBy(column: keyof ProductsTable, order: 'asc' | 'desc'): ProductModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, order)

    return this
  }

  static orderBy(column: keyof ProductsTable, order: 'asc' | 'desc'): ProductModel {
    const instance = new ProductModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, order)

    return instance
  }

  groupBy(column: keyof ProductsTable): ProductModel {
    this.selectFromQuery = this.selectFromQuery.groupBy(column)

    return this
  }

  static groupBy(column: keyof ProductsTable): ProductModel {
    const instance = new ProductModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.groupBy(column)

    return instance
  }

  having<V = string>(column: keyof ProductsTable, operator: Operator, value: V): ProductModel {
    this.selectFromQuery = this.selectFromQuery.having(column, operator, value)

    return this
  }

  static having<V = string>(column: keyof ProductsTable, operator: Operator, value: V): ProductModel {
    const instance = new ProductModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.having(column, operator, value)

    return instance
  }

  inRandomOrder(): ProductModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(sql` ${sql.raw('RANDOM()')} `)

    return this
  }

  static inRandomOrder(): ProductModel {
    const instance = new ProductModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(sql` ${sql.raw('RANDOM()')} `)

    return instance
  }

  orderByDesc(column: keyof ProductsTable): ProductModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, 'desc')

    return this
  }

  static orderByDesc(column: keyof ProductsTable): ProductModel {
    const instance = new ProductModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'desc')

    return instance
  }

  orderByAsc(column: keyof ProductsTable): ProductModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, 'asc')

    return this
  }

  static orderByAsc(column: keyof ProductsTable): ProductModel {
    const instance = new ProductModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'asc')

    return instance
  }

  async update(newProduct: ProductUpdate): Promise<ProductModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newProduct).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewProduct

    await this.mapCustomSetters(filteredValues)

    await DB.instance.updateTable('products')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      const model = await this.find(this.id)

      if (model)
        dispatch('product:updated', model)

      return model
    }

    this.hasSaved = true

    return undefined
  }

  async forceUpdate(product: ProductUpdate): Promise<ProductModel | undefined> {
    if (this.id === undefined) {
      this.updateFromQuery.set(product).execute()
    }

    await this.mapCustomSetters(product)

    await DB.instance.updateTable('products')
      .set(product)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      const model = await this.find(this.id)

      if (model)
        dispatch('product:updated', model)

      this.hasSaved = true

      return model
    }

    return undefined
  }

  async save(): Promise<void> {
    if (!this)
      throw new HttpError(500, 'Product data is undefined')

    await this.mapCustomSetters(this.attributes)

    if (this.id === undefined) {
      await this.create(this.attributes)
    }
    else {
      await this.update(this.attributes)
    }

    this.hasSaved = true
  }

  fill(data: Partial<ProductJsonResponse>): ProductModel {
    const filteredValues = Object.fromEntries(
      Object.entries(data).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewProduct

    this.attributes = {
      ...this.attributes,
      ...filteredValues,
    }

    return this
  }

  forceFill(data: Partial<ProductJsonResponse>): ProductModel {
    this.attributes = {
      ...this.attributes,
      ...data,
    }

    return this
  }

  // Method to delete (soft delete) the product instance
  async delete(): Promise<ProductsTable> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()
    const model = await this.find(Number(this.id))
    if (model)
      dispatch('product:deleted', model)

    return await DB.instance.deleteFrom('products')
      .where('id', '=', this.id)
      .execute()
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

  toSearchableObject(): Partial<ProductJsonResponse> {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      price: this.price,
      category_id: this.category_id,
      is_available: this.is_available,
      inventory_count: this.inventory_count,
    }
  }

  distinct(column: keyof ProductJsonResponse): ProductModel {
    this.selectFromQuery = this.selectFromQuery.select(column).distinct()

    this.hasSelect = true

    return this
  }

  static distinct(column: keyof ProductJsonResponse): ProductModel {
    const instance = new ProductModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.select(column).distinct()

    instance.hasSelect = true

    return instance
  }

  join(table: string, firstCol: string, secondCol: string): ProductModel {
    this.selectFromQuery = this.selectFromQuery.innerJoin(table, firstCol, secondCol)

    return this
  }

  static join(table: string, firstCol: string, secondCol: string): ProductModel {
    const instance = new ProductModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.innerJoin(table, firstCol, secondCol)

    return instance
  }

  toJSON(): ProductJsonResponse {
    const output = {

      uuid: this.uuid,

      id: this.id,
      name: this.name,
      description: this.description,
      price: this.price,
      image_url: this.image_url,
      is_available: this.is_available,
      inventory_count: this.inventory_count,
      category_id: this.category_id,
      preparation_time: this.preparation_time,
      allergens: this.allergens,
      nutritional_info: this.nutritional_info,

      created_at: this.created_at,

      updated_at: this.updated_at,

      product_category_id: this.product_category_id,
      product_category: this.product_category,
      manufacturer_id: this.manufacturer_id,
      manufacturer: this.manufacturer,
      ...this.customColumns,
    }

    return output
  }

  parseResult(model: ProductModel): ProductModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof ProductModel]
    }

    return model
  }
}

async function find(id: number): Promise<ProductModel | undefined> {
  const query = DB.instance.selectFrom('products').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  return new ProductModel(model)
}

export async function count(): Promise<number> {
  const results = await ProductModel.count()

  return results
}

export async function create(newProduct: NewProduct): Promise<ProductModel> {
  const result = await DB.instance.insertInto('products')
    .values(newProduct)
    .executeTakeFirstOrThrow()

  return await find(Number(result.numInsertedOrUpdatedRows)) as ProductModel
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(DB.instance)
}

export async function remove(id: number): Promise<void> {
  await DB.instance.deleteFrom('products')
    .where('id', '=', id)
    .execute()
}

export async function whereName(value: string): Promise<ProductModel[]> {
  const query = DB.instance.selectFrom('products').where('name', '=', value)
  const results: ProductJsonResponse = await query.execute()

  return results.map((modelItem: ProductJsonResponse) => new ProductModel(modelItem))
}

export async function whereDescription(value: string): Promise<ProductModel[]> {
  const query = DB.instance.selectFrom('products').where('description', '=', value)
  const results: ProductJsonResponse = await query.execute()

  return results.map((modelItem: ProductJsonResponse) => new ProductModel(modelItem))
}

export async function wherePrice(value: number): Promise<ProductModel[]> {
  const query = DB.instance.selectFrom('products').where('price', '=', value)
  const results: ProductJsonResponse = await query.execute()

  return results.map((modelItem: ProductJsonResponse) => new ProductModel(modelItem))
}

export async function whereImageUrl(value: string): Promise<ProductModel[]> {
  const query = DB.instance.selectFrom('products').where('image_url', '=', value)
  const results: ProductJsonResponse = await query.execute()

  return results.map((modelItem: ProductJsonResponse) => new ProductModel(modelItem))
}

export async function whereIsAvailable(value: boolean): Promise<ProductModel[]> {
  const query = DB.instance.selectFrom('products').where('is_available', '=', value)
  const results: ProductJsonResponse = await query.execute()

  return results.map((modelItem: ProductJsonResponse) => new ProductModel(modelItem))
}

export async function whereInventoryCount(value: number): Promise<ProductModel[]> {
  const query = DB.instance.selectFrom('products').where('inventory_count', '=', value)
  const results: ProductJsonResponse = await query.execute()

  return results.map((modelItem: ProductJsonResponse) => new ProductModel(modelItem))
}

export async function whereCategoryId(value: string): Promise<ProductModel[]> {
  const query = DB.instance.selectFrom('products').where('category_id', '=', value)
  const results: ProductJsonResponse = await query.execute()

  return results.map((modelItem: ProductJsonResponse) => new ProductModel(modelItem))
}

export async function wherePreparationTime(value: number): Promise<ProductModel[]> {
  const query = DB.instance.selectFrom('products').where('preparation_time', '=', value)
  const results: ProductJsonResponse = await query.execute()

  return results.map((modelItem: ProductJsonResponse) => new ProductModel(modelItem))
}

export async function whereAllergens(value: string): Promise<ProductModel[]> {
  const query = DB.instance.selectFrom('products').where('allergens', '=', value)
  const results: ProductJsonResponse = await query.execute()

  return results.map((modelItem: ProductJsonResponse) => new ProductModel(modelItem))
}

export async function whereNutritionalInfo(value: string): Promise<ProductModel[]> {
  const query = DB.instance.selectFrom('products').where('nutritional_info', '=', value)
  const results: ProductJsonResponse = await query.execute()

  return results.map((modelItem: ProductJsonResponse) => new ProductModel(modelItem))
}

export const Product = ProductModel

export default Product
