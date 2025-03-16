import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import type { CustomerModel } from './Customer'
import type { ProductModel } from './Product'
import { randomUUIDv7 } from 'bun'
import { cache } from '@stacksjs/cache'
import { sql } from '@stacksjs/database'
import { HttpError, ModelNotFoundException } from '@stacksjs/error-handling'
import { dispatch } from '@stacksjs/events'

import { BaseOrm, DB, SubqueryBuilder } from '@stacksjs/orm'

import Customer from './Customer'

import Product from './Product'

export interface ProductReviewsTable {
  id: Generated<number>
  product_id: number
  customer_id: number
  rating: number
  title: string
  content: string
  is_verified_purchase?: boolean
  is_approved?: boolean
  helpful_votes?: number
  unhelpful_votes?: number
  purchase_date?: string
  images?: string
  uuid?: string

  created_at?: Date

  updated_at?: Date

}

export interface ProductReviewResponse {
  data: ProductReviewJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface ProductReviewJsonResponse extends Omit<Selectable<ProductReviewsTable>, 'password'> {
  [key: string]: any
}

export type NewProductReview = Insertable<ProductReviewsTable>
export type ProductReviewUpdate = Updateable<ProductReviewsTable>

      type SortDirection = 'asc' | 'desc'
interface SortOptions { column: ProductReviewJsonResponse, order: SortDirection }
// Define a type for the options parameter
interface QueryOptions {
  sort?: SortOptions
  limit?: number
  offset?: number
  page?: number
}

export class ProductReviewModel extends BaseOrm<ProductReviewModel, ProductReviewsTable> {
  private readonly hidden: Array<keyof ProductReviewJsonResponse> = []
  private readonly fillable: Array<keyof ProductReviewJsonResponse> = ['rating', 'title', 'content', 'is_verified_purchase', 'is_approved', 'helpful_votes', 'unhelpful_votes', 'purchase_date', 'images', 'uuid']
  private readonly guarded: Array<keyof ProductReviewJsonResponse> = []
  protected attributes = {} as ProductReviewJsonResponse
  protected originalAttributes = {} as ProductReviewJsonResponse

  protected selectFromQuery: any
  protected withRelations: string[]
  protected updateFromQuery: any
  protected deleteFromQuery: any
  protected hasSelect: boolean
  private hasSaved: boolean
  private customColumns: Record<string, unknown> = {}

  constructor(productReview: ProductReviewJsonResponse | undefined) {
    super('product_reviews')
    if (productReview) {
      this.attributes = { ...productReview }
      this.originalAttributes = { ...productReview }

      Object.keys(productReview).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (productReview as ProductReviewJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = DB.instance.selectFrom('product_reviews')
    this.updateFromQuery = DB.instance.updateTable('product_reviews')
    this.deleteFromQuery = DB.instance.deleteFrom('product_reviews')
    this.hasSelect = false
    this.hasSaved = false
  }

  protected mapCustomGetters(models: ProductReviewJsonResponse | ProductReviewJsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: ProductReviewJsonResponse) => {
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

  async mapCustomSetters(model: NewProductReview | ProductReviewUpdate): Promise<void> {
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

  get customer_id(): number {
    return this.attributes.customer_id
  }

  get customer(): CustomerModel | undefined {
    return this.attributes.customer
  }

  get id(): number {
    return this.attributes.id
  }

  get uuid(): string | undefined {
    return this.attributes.uuid
  }

  get rating(): number {
    return this.attributes.rating
  }

  get title(): string {
    return this.attributes.title
  }

  get content(): string {
    return this.attributes.content
  }

  get is_verified_purchase(): boolean | undefined {
    return this.attributes.is_verified_purchase
  }

  get is_approved(): boolean | undefined {
    return this.attributes.is_approved
  }

  get helpful_votes(): number | undefined {
    return this.attributes.helpful_votes
  }

  get unhelpful_votes(): number | undefined {
    return this.attributes.unhelpful_votes
  }

  get purchase_date(): string | undefined {
    return this.attributes.purchase_date
  }

  get images(): string | undefined {
    return this.attributes.images
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

  set rating(value: number) {
    this.attributes.rating = value
  }

  set title(value: string) {
    this.attributes.title = value
  }

  set content(value: string) {
    this.attributes.content = value
  }

  set is_verified_purchase(value: boolean) {
    this.attributes.is_verified_purchase = value
  }

  set is_approved(value: boolean) {
    this.attributes.is_approved = value
  }

  set helpful_votes(value: number) {
    this.attributes.helpful_votes = value
  }

  set unhelpful_votes(value: number) {
    this.attributes.unhelpful_votes = value
  }

  set purchase_date(value: string) {
    this.attributes.purchase_date = value
  }

  set images(value: string) {
    this.attributes.images = value
  }

  set updated_at(value: Date) {
    this.attributes.updated_at = value
  }

  getOriginal(column?: keyof ProductReviewJsonResponse): Partial<ProductReviewJsonResponse> {
    if (column) {
      return this.originalAttributes[column]
    }

    return this.originalAttributes
  }

  getChanges(): Partial<ProductReviewJsonResponse> {
    return this.fillable.reduce<Partial<ProductReviewJsonResponse>>((changes, key) => {
      const currentValue = this.attributes[key as keyof ProductReviewsTable]
      const originalValue = this.originalAttributes[key as keyof ProductReviewsTable]

      if (currentValue !== originalValue) {
        changes[key] = currentValue
      }

      return changes
    }, {})
  }

  isDirty(column?: keyof ProductReviewJsonResponse): boolean {
    if (column) {
      return this.attributes[column] !== this.originalAttributes[column]
    }

    return Object.entries(this.originalAttributes).some(([key, originalValue]) => {
      const currentValue = (this.attributes as any)[key]

      return currentValue !== originalValue
    })
  }

  isClean(column?: keyof ProductReviewJsonResponse): boolean {
    return !this.isDirty(column)
  }

  wasChanged(column?: keyof ProductReviewJsonResponse): boolean {
    return this.hasSaved && this.isDirty(column)
  }

  select(params: (keyof ProductReviewJsonResponse)[] | RawBuilder<string> | string): ProductReviewModel {
    this.selectFromQuery = this.selectFromQuery.select(params)

    this.hasSelect = true

    return this
  }

  static select(params: (keyof ProductReviewJsonResponse)[] | RawBuilder<string> | string): ProductReviewModel {
    const instance = new ProductReviewModel(undefined)

    // Initialize a query with the table name and selected fields
    instance.selectFromQuery = instance.selectFromQuery.select(params)

    instance.hasSelect = true

    return instance
  }

  // Method to find a ProductReview by ID
  static async find(id: number): Promise<ProductReviewModel | undefined> {
    const instance = new ProductReviewModel(undefined)

    return await instance.applyFind(id)
  }

  async first(): Promise<ProductReviewModel | undefined> {
    const model = await this.applyFirst()

    const data = new ProductReviewModel(model)

    return data
  }

  static async first(): Promise<ProductReviewModel | undefined> {
    const instance = new ProductReviewModel(undefined)

    const model = await instance.applyFirst()

    const data = new ProductReviewModel(model)

    return data
  }

  async applyFirstOrFail(): Promise<ProductReviewModel | undefined> {
    const model = await this.selectFromQuery.executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, 'No ProductReviewModel results found for query')

    if (model) {
      this.mapCustomGetters(model)
      await this.loadRelations(model)
    }

    const data = new ProductReviewModel(model)

    return data
  }

  async firstOrFail(): Promise<ProductReviewModel | undefined> {
    return await this.applyFirstOrFail()
  }

  static async firstOrFail(): Promise<ProductReviewModel | undefined> {
    const instance = new ProductReviewModel(undefined)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<ProductReviewModel[]> {
    const instance = new ProductReviewModel(undefined)

    const models = await DB.instance.selectFrom('product_reviews').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: ProductReviewJsonResponse) => {
      return new ProductReviewModel(model)
    }))

    return data
  }

  async applyFindOrFail(id: number): Promise<ProductReviewModel> {
    const model = await DB.instance.selectFrom('product_reviews').where('id', '=', id).selectAll().executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, `No ProductReviewModel results for ${id}`)

    cache.getOrSet(`productReview:${id}`, JSON.stringify(model))

    this.mapCustomGetters(model)
    await this.loadRelations(model)

    const data = new ProductReviewModel(model)

    return data
  }

  async findOrFail(id: number): Promise<ProductReviewModel> {
    return await this.applyFindOrFail(id)
  }

  static async findOrFail(id: number): Promise<ProductReviewModel> {
    const instance = new ProductReviewModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  async applyFindMany(ids: number[]): Promise<ProductReviewModel[]> {
    let query = DB.instance.selectFrom('product_reviews').where('id', 'in', ids)

    const instance = new ProductReviewModel(undefined)

    query = query.selectAll()

    const models = await query.execute()

    instance.mapCustomGetters(models)
    await instance.loadRelations(models)

    return models.map((modelItem: ProductReviewJsonResponse) => instance.parseResult(new ProductReviewModel(modelItem)))
  }

  static async findMany(ids: number[]): Promise<ProductReviewModel[]> {
    const instance = new ProductReviewModel(undefined)

    return await instance.applyFindMany(ids)
  }

  async findMany(ids: number[]): Promise<ProductReviewModel[]> {
    return await this.applyFindMany(ids)
  }

  skip(count: number): ProductReviewModel {
    this.selectFromQuery = this.selectFromQuery.offset(count)

    return this
  }

  static skip(count: number): ProductReviewModel {
    const instance = new ProductReviewModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.offset(count)

    return instance
  }

  async applyChunk(size: number, callback: (models: ProductReviewModel[]) => Promise<void>): Promise<void> {
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

  async chunk(size: number, callback: (models: ProductReviewModel[]) => Promise<void>): Promise<void> {
    await this.applyChunk(size, callback)
  }

  static async chunk(size: number, callback: (models: ProductReviewModel[]) => Promise<void>): Promise<void> {
    const instance = new ProductReviewModel(undefined)

    await instance.applyChunk(size, callback)
  }

  take(count: number): ProductReviewModel {
    this.selectFromQuery = this.selectFromQuery.limit(count)

    return this
  }

  static take(count: number): ProductReviewModel {
    const instance = new ProductReviewModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.limit(count)

    return instance
  }

  static async pluck<K extends keyof ProductReviewModel>(field: K): Promise<ProductReviewModel[K][]> {
    const instance = new ProductReviewModel(undefined)

    if (instance.hasSelect) {
      const model = await instance.selectFromQuery.execute()
      return model.map((modelItem: ProductReviewModel) => modelItem[field])
    }

    const model = await instance.selectFromQuery.selectAll().execute()

    return model.map((modelItem: ProductReviewModel) => modelItem[field])
  }

  async pluck<K extends keyof ProductReviewModel>(field: K): Promise<ProductReviewModel[K][]> {
    if (this.hasSelect) {
      const model = await this.selectFromQuery.execute()
      return model.map((modelItem: ProductReviewModel) => modelItem[field])
    }

    const model = await this.selectFromQuery.selectAll().execute()

    return model.map((modelItem: ProductReviewModel) => modelItem[field])
  }

  static async count(): Promise<number> {
    const instance = new ProductReviewModel(undefined)

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

  static async max(field: keyof ProductReviewModel): Promise<number> {
    const instance = new ProductReviewModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`MAX(${sql.raw(field as string)}) as max `)
      .executeTakeFirst()

    return result.max
  }

  async max(field: keyof ProductReviewModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`MAX(${sql.raw(field as string)}) as max`)
      .executeTakeFirst()

    return result.max
  }

  static async min(field: keyof ProductReviewModel): Promise<number> {
    const instance = new ProductReviewModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`MIN(${sql.raw(field as string)}) as min `)
      .executeTakeFirst()

    return result.min
  }

  async min(field: keyof ProductReviewModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`MIN(${sql.raw(field as string)}) as min `)
      .executeTakeFirst()

    return result.min
  }

  static async avg(field: keyof ProductReviewModel): Promise<number> {
    const instance = new ProductReviewModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`AVG(${sql.raw(field as string)}) as avg `)
      .executeTakeFirst()

    return result.avg
  }

  async avg(field: keyof ProductReviewModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`AVG(${sql.raw(field as string)}) as avg `)
      .executeTakeFirst()

    return result.avg
  }

  static async sum(field: keyof ProductReviewModel): Promise<number> {
    const instance = new ProductReviewModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`SUM(${sql.raw(field as string)}) as sum `)
      .executeTakeFirst()

    return result.sum
  }

  async sum(field: keyof ProductReviewModel): Promise<number> {
    const result = this.selectFromQuery
      .select(sql`SUM(${sql.raw(field as string)}) as sum `)
      .executeTakeFirst()

    return result.sum
  }

  async applyGet(): Promise<ProductReviewModel[]> {
    let models

    if (this.hasSelect) {
      models = await this.selectFromQuery.execute()
    }
    else {
      models = await this.selectFromQuery.selectAll().execute()
    }

    this.mapCustomGetters(models)
    await this.loadRelations(models)

    const data = await Promise.all(models.map(async (model: ProductReviewJsonResponse) => {
      return new ProductReviewModel(model)
    }))

    return data
  }

  async get(): Promise<ProductReviewModel[]> {
    return await this.applyGet()
  }

  static async get(): Promise<ProductReviewModel[]> {
    const instance = new ProductReviewModel(undefined)

    return await instance.applyGet()
  }

  has(relation: string): ProductReviewModel {
    this.selectFromQuery = this.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(
        selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.productReview_id`, '=', 'product_reviews.id'),
      ),
    )

    return this
  }

  static has(relation: string): ProductReviewModel {
    const instance = new ProductReviewModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(
        selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.productReview_id`, '=', 'product_reviews.id'),
      ),
    )

    return instance
  }

  static whereExists(callback: (qb: any) => any): ProductReviewModel {
    const instance = new ProductReviewModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(callback({ exists, selectFrom })),
    )

    return instance
  }

  applyWhereHas(
    relation: string,
    callback: (query: SubqueryBuilder<keyof ProductReviewModel>) => void,
  ): ProductReviewModel {
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    this.selectFromQuery = this.selectFromQuery
      .where(({ exists, selectFrom }: any) => {
        let subquery = selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.productReview_id`, '=', 'product_reviews.id')

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
    callback: (query: SubqueryBuilder<keyof ProductReviewModel>) => void,
  ): ProductReviewModel {
    return this.applyWhereHas(relation, callback)
  }

  static whereHas(
    relation: string,
    callback: (query: SubqueryBuilder<keyof ProductReviewModel>) => void,
  ): ProductReviewModel {
    const instance = new ProductReviewModel(undefined)

    return instance.applyWhereHas(relation, callback)
  }

  applyDoesntHave(relation: string): ProductReviewModel {
    this.selectFromQuery = this.selectFromQuery.where(({ not, exists, selectFrom }: any) =>
      not(
        exists(
          selectFrom(relation)
            .select('1')
            .whereRef(`${relation}.productReview_id`, '=', 'product_reviews.id'),
        ),
      ),
    )

    return this
  }

  doesntHave(relation: string): ProductReviewModel {
    return this.applyDoesntHave(relation)
  }

  static doesntHave(relation: string): ProductReviewModel {
    const instance = new ProductReviewModel(undefined)

    return instance.applyDoesntHave(relation)
  }

  applyWhereDoesntHave(relation: string, callback: (query: SubqueryBuilder<ProductReviewsTable>) => void): ProductReviewModel {
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    this.selectFromQuery = this.selectFromQuery
      .where(({ exists, selectFrom, not }: any) => {
        const subquery = selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.productReview_id`, '=', 'product_reviews.id')

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

  whereDoesntHave(relation: string, callback: (query: SubqueryBuilder<ProductReviewsTable>) => void): ProductReviewModel {
    return this.applyWhereDoesntHave(relation, callback)
  }

  static whereDoesntHave(
    relation: string,
    callback: (query: SubqueryBuilder<ProductReviewsTable>) => void,
  ): ProductReviewModel {
    const instance = new ProductReviewModel(undefined)

    return instance.applyWhereDoesntHave(relation, callback)
  }

  async applyPaginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<ProductReviewResponse> {
    const totalRecordsResult = await DB.instance.selectFrom('product_reviews')
      .select(DB.instance.fn.count('id').as('total')) // Use 'id' or another actual column name
      .executeTakeFirst()

    const totalRecords = Number(totalRecordsResult?.total) || 0
    const totalPages = Math.ceil(totalRecords / (options.limit ?? 10))

    const product_reviewsWithExtra = await DB.instance.selectFrom('product_reviews')
      .selectAll()
      .orderBy('id', 'asc') // Assuming 'id' is used for cursor-based pagination
      .limit((options.limit ?? 10) + 1) // Fetch one extra record
      .offset(((options.page ?? 1) - 1) * (options.limit ?? 10)) // Ensure options.page is not undefined
      .execute()

    let nextCursor = null
    if (product_reviewsWithExtra.length > (options.limit ?? 10))
      nextCursor = product_reviewsWithExtra.pop()?.id ?? null

    return {
      data: product_reviewsWithExtra,
      paging: {
        total_records: totalRecords,
        page: options.page || 1,
        total_pages: totalPages,
      },
      next_cursor: nextCursor,
    }
  }

  async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<ProductReviewResponse> {
    return await this.applyPaginate(options)
  }

  // Method to get all product_reviews
  static async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<ProductReviewResponse> {
    const instance = new ProductReviewModel(undefined)

    return await instance.applyPaginate(options)
  }

  async applyCreate(newProductReview: NewProductReview): Promise<ProductReviewModel> {
    const filteredValues = Object.fromEntries(
      Object.entries(newProductReview).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewProductReview

    await this.mapCustomSetters(filteredValues)

    filteredValues.uuid = randomUUIDv7()

    const result = await DB.instance.insertInto('product_reviews')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await this.find(Number(result.numInsertedOrUpdatedRows)) as ProductReviewModel

    if (model)
      dispatch('productReview:created', model)

    return model
  }

  async create(newProductReview: NewProductReview): Promise<ProductReviewModel> {
    return await this.applyCreate(newProductReview)
  }

  static async create(newProductReview: NewProductReview): Promise<ProductReviewModel> {
    const instance = new ProductReviewModel(undefined)

    return await instance.applyCreate(newProductReview)
  }

  static async createMany(newProductReview: NewProductReview[]): Promise<void> {
    const instance = new ProductReviewModel(undefined)

    const valuesFiltered = newProductReview.map((newProductReview: NewProductReview) => {
      const filteredValues = Object.fromEntries(
        Object.entries(newProductReview).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewProductReview

      filteredValues.uuid = randomUUIDv7()

      return filteredValues
    })

    await DB.instance.insertInto('product_reviews')
      .values(valuesFiltered)
      .executeTakeFirst()
  }

  static async forceCreate(newProductReview: NewProductReview): Promise<ProductReviewModel> {
    const result = await DB.instance.insertInto('product_reviews')
      .values(newProductReview)
      .executeTakeFirst()

    const model = await find(Number(result.numInsertedOrUpdatedRows)) as ProductReviewModel

    if (model)
      dispatch('productReview:created', model)

    return model
  }

  // Method to remove a ProductReview
  static async remove(id: number): Promise<any> {
    const instance = new ProductReviewModel(undefined)

    const model = await instance.find(Number(id))

    if (model)
      dispatch('productReview:deleted', model)

    return await DB.instance.deleteFrom('product_reviews')
      .where('id', '=', id)
      .execute()
  }

  static where<V = string>(column: keyof ProductReviewsTable, ...args: [V] | [Operator, V]): ProductReviewModel {
    const instance = new ProductReviewModel(undefined)

    return instance.applyWhere<V>(column, ...args)
  }

  whereColumn(first: keyof ProductReviewsTable, operator: Operator, second: keyof ProductReviewsTable): ProductReviewModel {
    this.selectFromQuery = this.selectFromQuery.whereRef(first, operator, second)

    return this
  }

  static whereColumn(first: keyof ProductReviewsTable, operator: Operator, second: keyof ProductReviewsTable): ProductReviewModel {
    const instance = new ProductReviewModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.whereRef(first, operator, second)

    return instance
  }

  applyWhereRef(column: keyof ProductReviewsTable, ...args: string[]): ProductReviewModel {
    const [operatorOrValue, value] = args
    const operator = value === undefined ? '=' : operatorOrValue
    const actualValue = value === undefined ? operatorOrValue : value

    const instance = new ProductReviewModel(undefined)
    instance.selectFromQuery = instance.selectFromQuery.whereRef(column, operator, actualValue)

    return instance
  }

  whereRef(column: keyof ProductReviewsTable, ...args: string[]): ProductReviewModel {
    return this.applyWhereRef(column, ...args)
  }

  static whereRef(column: keyof ProductReviewsTable, ...args: string[]): ProductReviewModel {
    const instance = new ProductReviewModel(undefined)

    return instance.applyWhereRef(column, ...args)
  }

  whereRaw(sqlStatement: string): ProductReviewModel {
    this.selectFromQuery = this.selectFromQuery.where(sql`${sqlStatement}`)

    return this
  }

  static whereRaw(sqlStatement: string): ProductReviewModel {
    const instance = new ProductReviewModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where(sql`${sqlStatement}`)

    return instance
  }

  applyOrWhere(...conditions: [string, any][]): ProductReviewModel {
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

  orWhere(...conditions: [string, any][]): ProductReviewModel {
    return this.applyOrWhere(...conditions)
  }

  static orWhere(...conditions: [string, any][]): ProductReviewModel {
    const instance = new ProductReviewModel(undefined)

    return instance.applyOrWhere(...conditions)
  }

  when(
    condition: boolean,
    callback: (query: ProductReviewModel) => ProductReviewModel,
  ): ProductReviewModel {
    return ProductReviewModel.when(condition, callback)
  }

  static when(
    condition: boolean,
    callback: (query: ProductReviewModel) => ProductReviewModel,
  ): ProductReviewModel {
    let instance = new ProductReviewModel(undefined)

    if (condition)
      instance = callback(instance)

    return instance
  }

  whereNotNull(column: keyof ProductReviewsTable): ProductReviewModel {
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

  static whereNotNull(column: keyof ProductReviewsTable): ProductReviewModel {
    const instance = new ProductReviewModel(undefined)

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

  whereNull(column: keyof ProductReviewsTable): ProductReviewModel {
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

  static whereNull(column: keyof ProductReviewsTable): ProductReviewModel {
    const instance = new ProductReviewModel(undefined)

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

  static whereRating(value: string): ProductReviewModel {
    const instance = new ProductReviewModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('rating', '=', value)

    return instance
  }

  static whereTitle(value: string): ProductReviewModel {
    const instance = new ProductReviewModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('title', '=', value)

    return instance
  }

  static whereContent(value: string): ProductReviewModel {
    const instance = new ProductReviewModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('content', '=', value)

    return instance
  }

  static whereIsVerifiedPurchase(value: string): ProductReviewModel {
    const instance = new ProductReviewModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('is_verified_purchase', '=', value)

    return instance
  }

  static whereIsApproved(value: string): ProductReviewModel {
    const instance = new ProductReviewModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('is_approved', '=', value)

    return instance
  }

  static whereHelpfulVotes(value: string): ProductReviewModel {
    const instance = new ProductReviewModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('helpful_votes', '=', value)

    return instance
  }

  static whereUnhelpfulVotes(value: string): ProductReviewModel {
    const instance = new ProductReviewModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('unhelpful_votes', '=', value)

    return instance
  }

  static wherePurchaseDate(value: string): ProductReviewModel {
    const instance = new ProductReviewModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('purchase_date', '=', value)

    return instance
  }

  static whereImages(value: string): ProductReviewModel {
    const instance = new ProductReviewModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('images', '=', value)

    return instance
  }

  applyWhereIn<V>(column: keyof ProductReviewsTable, values: V[]) {
    this.selectFromQuery = this.selectFromQuery.where(column, 'in', values)

    this.updateFromQuery = this.updateFromQuery.where(column, 'in', values)

    this.deleteFromQuery = this.deleteFromQuery.where(column, 'in', values)

    return this
  }

  whereIn<V = number>(column: keyof ProductReviewsTable, values: V[]): ProductReviewModel {
    return this.applyWhereIn<V>(column, values)
  }

  static whereIn<V = number>(column: keyof ProductReviewsTable, values: V[]): ProductReviewModel {
    const instance = new ProductReviewModel(undefined)

    return instance.applyWhereIn<V>(column, values)
  }

  applyWhereBetween<V>(column: keyof ProductReviewsTable, range: [V, V]): ProductReviewModel {
    if (range.length !== 2) {
      throw new HttpError(500, 'Range must have exactly two values: [min, max]')
    }

    const query = sql` ${sql.raw(column as string)} between ${range[0]} and ${range[1]} `

    this.selectFromQuery = this.selectFromQuery.where(query)
    this.updateFromQuery = this.updateFromQuery.where(query)
    this.deleteFromQuery = this.deleteFromQuery.where(query)

    return this
  }

  whereBetween<V = number>(column: keyof ProductReviewsTable, range: [V, V]): ProductReviewModel {
    return this.applyWhereBetween<V>(column, range)
  }

  static whereBetween<V = number>(column: keyof ProductReviewsTable, range: [V, V]): ProductReviewModel {
    const instance = new ProductReviewModel(undefined)

    return instance.applyWhereBetween<V>(column, range)
  }

  applyWhereLike(column: keyof ProductReviewsTable, value: string): ProductReviewModel {
    this.selectFromQuery = this.selectFromQuery.where(sql` ${sql.raw(column as string)} LIKE ${value}`)

    this.updateFromQuery = this.updateFromQuery.where(sql` ${sql.raw(column as string)} LIKE ${value}`)

    this.deleteFromQuery = this.deleteFromQuery.where(sql` ${sql.raw(column as string)} LIKE ${value}`)

    return this
  }

  whereLike(column: keyof ProductReviewsTable, value: string): ProductReviewModel {
    return this.applyWhereLike(column, value)
  }

  static whereLike(column: keyof ProductReviewsTable, value: string): ProductReviewModel {
    const instance = new ProductReviewModel(undefined)

    return instance.applyWhereLike(column, value)
  }

  applyWhereNotIn<V>(column: keyof ProductReviewsTable, values: V[]): ProductReviewModel {
    this.selectFromQuery = this.selectFromQuery.where(column, 'not in', values)

    this.updateFromQuery = this.updateFromQuery.where(column, 'not in', values)

    this.deleteFromQuery = this.deleteFromQuery.where(column, 'not in', values)

    return this
  }

  whereNotIn<V>(column: keyof ProductReviewsTable, values: V[]): ProductReviewModel {
    return this.applyWhereNotIn<V>(column, values)
  }

  static whereNotIn<V = number>(column: keyof ProductReviewsTable, values: V[]): ProductReviewModel {
    const instance = new ProductReviewModel(undefined)

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

  static async latest(): Promise<ProductReviewModel | undefined> {
    const instance = new ProductReviewModel(undefined)

    const model = await DB.instance.selectFrom('product_reviews')
      .selectAll()
      .orderBy('id', 'desc')
      .executeTakeFirst()

    if (!model)
      return undefined

    instance.mapCustomGetters(model)

    const data = new ProductReviewModel(model)

    return data
  }

  static async oldest(): Promise<ProductReviewModel | undefined> {
    const instance = new ProductReviewModel(undefined)

    const model = await DB.instance.selectFrom('product_reviews')
      .selectAll()
      .orderBy('id', 'asc')
      .executeTakeFirst()

    if (!model)
      return undefined

    instance.mapCustomGetters(model)

    const data = new ProductReviewModel(model)

    return data
  }

  static async firstOrCreate(
    condition: Partial<ProductReviewJsonResponse>,
    newProductReview: NewProductReview,
  ): Promise<ProductReviewModel> {
    const instance = new ProductReviewModel(undefined)

    const key = Object.keys(condition)[0] as keyof ProductReviewJsonResponse

    if (!key) {
      throw new HttpError(500, 'Condition must contain at least one key-value pair')
    }

    const value = condition[key]

    // Attempt to find the first record matching the condition
    const existingProductReview = await DB.instance.selectFrom('product_reviews')
      .selectAll()
      .where(key, '=', value)
      .executeTakeFirst()

    if (existingProductReview) {
      instance.mapCustomGetters(existingProductReview)
      await instance.loadRelations(existingProductReview)

      return new ProductReviewModel(existingProductReview as ProductReviewJsonResponse)
    }
    else {
      return await instance.create(newProductReview)
    }
  }

  static async updateOrCreate(
    condition: Partial<ProductReviewJsonResponse>,
    newProductReview: NewProductReview,
  ): Promise<ProductReviewModel> {
    const instance = new ProductReviewModel(undefined)

    const key = Object.keys(condition)[0] as keyof ProductReviewJsonResponse

    if (!key) {
      throw new HttpError(500, 'Condition must contain at least one key-value pair')
    }

    const value = condition[key]

    // Attempt to find the first record matching the condition
    const existingProductReview = await DB.instance.selectFrom('product_reviews')
      .selectAll()
      .where(key, '=', value)
      .executeTakeFirst()

    if (existingProductReview) {
      // If found, update the existing record
      await DB.instance.updateTable('product_reviews')
        .set(newProductReview)
        .where(key, '=', value)
        .executeTakeFirstOrThrow()

      // Fetch and return the updated record
      const updatedProductReview = await DB.instance.selectFrom('product_reviews')
        .selectAll()
        .where(key, '=', value)
        .executeTakeFirst()

      if (!updatedProductReview) {
        throw new HttpError(500, 'Failed to fetch updated record')
      }

      instance.hasSaved = true

      return new ProductReviewModel(updatedProductReview as ProductReviewJsonResponse)
    }
    else {
      // If not found, create a new record
      return await instance.create(newProductReview)
    }
  }

  protected async loadRelations(models: ProductReviewJsonResponse | ProductReviewJsonResponse[]): Promise<void> {
    // Handle both single model and array of models
    const modelArray = Array.isArray(models) ? models : [models]
    if (!modelArray.length)
      return

    const modelIds = modelArray.map(model => model.id)

    for (const relation of this.withRelations) {
      const relatedRecords = await DB.instance
        .selectFrom(relation)
        .where('productReview_id', 'in', modelIds)
        .selectAll()
        .execute()

      if (Array.isArray(models)) {
        models.map((model: ProductReviewJsonResponse) => {
          const records = relatedRecords.filter((record: { productReview_id: number }) => {
            return record.productReview_id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      }
      else {
        const records = relatedRecords.filter((record: { productReview_id: number }) => {
          return record.productReview_id === models.id
        })

        models[relation] = records.length === 1 ? records[0] : records
      }
    }
  }

  with(relations: string[]): ProductReviewModel {
    this.withRelations = relations

    return this
  }

  static with(relations: string[]): ProductReviewModel {
    const instance = new ProductReviewModel(undefined)

    instance.withRelations = relations

    return instance
  }

  async last(): Promise<ProductReviewModel | undefined> {
    let model: ProductReviewJsonResponse | undefined

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

    const data = new ProductReviewModel(model)

    return data
  }

  static async last(): Promise<ProductReviewModel | undefined> {
    const model = await DB.instance.selectFrom('product_reviews').selectAll().orderBy('id', 'desc').executeTakeFirst()

    if (!model)
      return undefined

    const data = new ProductReviewModel(model)

    return data
  }

  orderBy(column: keyof ProductReviewsTable, order: 'asc' | 'desc'): ProductReviewModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, order)

    return this
  }

  static orderBy(column: keyof ProductReviewsTable, order: 'asc' | 'desc'): ProductReviewModel {
    const instance = new ProductReviewModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, order)

    return instance
  }

  groupBy(column: keyof ProductReviewsTable): ProductReviewModel {
    this.selectFromQuery = this.selectFromQuery.groupBy(column)

    return this
  }

  static groupBy(column: keyof ProductReviewsTable): ProductReviewModel {
    const instance = new ProductReviewModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.groupBy(column)

    return instance
  }

  having<V = string>(column: keyof ProductReviewsTable, operator: Operator, value: V): ProductReviewModel {
    this.selectFromQuery = this.selectFromQuery.having(column, operator, value)

    return this
  }

  static having<V = string>(column: keyof ProductReviewsTable, operator: Operator, value: V): ProductReviewModel {
    const instance = new ProductReviewModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.having(column, operator, value)

    return instance
  }

  inRandomOrder(): ProductReviewModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(sql` ${sql.raw('RANDOM()')} `)

    return this
  }

  static inRandomOrder(): ProductReviewModel {
    const instance = new ProductReviewModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(sql` ${sql.raw('RANDOM()')} `)

    return instance
  }

  orderByDesc(column: keyof ProductReviewsTable): ProductReviewModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, 'desc')

    return this
  }

  static orderByDesc(column: keyof ProductReviewsTable): ProductReviewModel {
    const instance = new ProductReviewModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'desc')

    return instance
  }

  orderByAsc(column: keyof ProductReviewsTable): ProductReviewModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, 'asc')

    return this
  }

  static orderByAsc(column: keyof ProductReviewsTable): ProductReviewModel {
    const instance = new ProductReviewModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'asc')

    return instance
  }

  async update(newProductReview: ProductReviewUpdate): Promise<ProductReviewModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newProductReview).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewProductReview

    await this.mapCustomSetters(filteredValues)

    await DB.instance.updateTable('product_reviews')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      const model = await this.find(this.id)

      if (model)
        dispatch('productReview:updated', model)

      return model
    }

    this.hasSaved = true

    return undefined
  }

  async forceUpdate(productReview: ProductReviewUpdate): Promise<ProductReviewModel | undefined> {
    if (this.id === undefined) {
      this.updateFromQuery.set(productReview).execute()
    }

    await this.mapCustomSetters(productReview)

    await DB.instance.updateTable('product_reviews')
      .set(productReview)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      const model = await this.find(this.id)

      if (model)
        dispatch('productReview:updated', model)

      this.hasSaved = true

      return model
    }

    return undefined
  }

  async save(): Promise<void> {
    if (!this)
      throw new HttpError(500, 'ProductReview data is undefined')

    await this.mapCustomSetters(this.attributes)

    if (this.id === undefined) {
      await this.create(this.attributes)
    }
    else {
      await this.update(this.attributes)
    }

    this.hasSaved = true
  }

  fill(data: Partial<ProductReviewJsonResponse>): ProductReviewModel {
    const filteredValues = Object.fromEntries(
      Object.entries(data).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewProductReview

    this.attributes = {
      ...this.attributes,
      ...filteredValues,
    }

    return this
  }

  forceFill(data: Partial<ProductReviewJsonResponse>): ProductReviewModel {
    this.attributes = {
      ...this.attributes,
      ...data,
    }

    return this
  }

  // Method to delete (soft delete) the productReview instance
  async delete(): Promise<ProductReviewsTable> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()
    const model = await this.find(Number(this.id))
    if (model)
      dispatch('productReview:deleted', model)

    return await DB.instance.deleteFrom('product_reviews')
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

  toSearchableObject(): Partial<ProductReviewJsonResponse> {
    return {
      id: this.id,
      product_id: this.product_id,
      rating: this.rating,
      title: this.title,
      content: this.content,
      is_verified_purchase: this.is_verified_purchase,
      is_approved: this.is_approved,
    }
  }

  distinct(column: keyof ProductReviewJsonResponse): ProductReviewModel {
    this.selectFromQuery = this.selectFromQuery.select(column).distinct()

    this.hasSelect = true

    return this
  }

  static distinct(column: keyof ProductReviewJsonResponse): ProductReviewModel {
    const instance = new ProductReviewModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.select(column).distinct()

    instance.hasSelect = true

    return instance
  }

  join(table: string, firstCol: string, secondCol: string): ProductReviewModel {
    this.selectFromQuery = this.selectFromQuery.innerJoin(table, firstCol, secondCol)

    return this
  }

  static join(table: string, firstCol: string, secondCol: string): ProductReviewModel {
    const instance = new ProductReviewModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.innerJoin(table, firstCol, secondCol)

    return instance
  }

  toJSON(): ProductReviewJsonResponse {
    const output = {

      uuid: this.uuid,

      id: this.id,
      rating: this.rating,
      title: this.title,
      content: this.content,
      is_verified_purchase: this.is_verified_purchase,
      is_approved: this.is_approved,
      helpful_votes: this.helpful_votes,
      unhelpful_votes: this.unhelpful_votes,
      purchase_date: this.purchase_date,
      images: this.images,

      created_at: this.created_at,

      updated_at: this.updated_at,

      product_id: this.product_id,
      product: this.product,
      customer_id: this.customer_id,
      customer: this.customer,
      ...this.customColumns,
    }

    return output
  }

  parseResult(model: ProductReviewModel): ProductReviewModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof ProductReviewModel]
    }

    return model
  }
}

async function find(id: number): Promise<ProductReviewModel | undefined> {
  const query = DB.instance.selectFrom('product_reviews').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  return new ProductReviewModel(model)
}

export async function count(): Promise<number> {
  const results = await ProductReviewModel.count()

  return results
}

export async function create(newProductReview: NewProductReview): Promise<ProductReviewModel> {
  const result = await DB.instance.insertInto('product_reviews')
    .values(newProductReview)
    .executeTakeFirstOrThrow()

  return await find(Number(result.numInsertedOrUpdatedRows)) as ProductReviewModel
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(DB.instance)
}

export async function remove(id: number): Promise<void> {
  await DB.instance.deleteFrom('product_reviews')
    .where('id', '=', id)
    .execute()
}

export async function whereRating(value: number): Promise<ProductReviewModel[]> {
  const query = DB.instance.selectFrom('product_reviews').where('rating', '=', value)
  const results: ProductReviewJsonResponse = await query.execute()

  return results.map((modelItem: ProductReviewJsonResponse) => new ProductReviewModel(modelItem))
}

export async function whereTitle(value: string): Promise<ProductReviewModel[]> {
  const query = DB.instance.selectFrom('product_reviews').where('title', '=', value)
  const results: ProductReviewJsonResponse = await query.execute()

  return results.map((modelItem: ProductReviewJsonResponse) => new ProductReviewModel(modelItem))
}

export async function whereContent(value: string): Promise<ProductReviewModel[]> {
  const query = DB.instance.selectFrom('product_reviews').where('content', '=', value)
  const results: ProductReviewJsonResponse = await query.execute()

  return results.map((modelItem: ProductReviewJsonResponse) => new ProductReviewModel(modelItem))
}

export async function whereIsVerifiedPurchase(value: boolean): Promise<ProductReviewModel[]> {
  const query = DB.instance.selectFrom('product_reviews').where('is_verified_purchase', '=', value)
  const results: ProductReviewJsonResponse = await query.execute()

  return results.map((modelItem: ProductReviewJsonResponse) => new ProductReviewModel(modelItem))
}

export async function whereIsApproved(value: boolean): Promise<ProductReviewModel[]> {
  const query = DB.instance.selectFrom('product_reviews').where('is_approved', '=', value)
  const results: ProductReviewJsonResponse = await query.execute()

  return results.map((modelItem: ProductReviewJsonResponse) => new ProductReviewModel(modelItem))
}

export async function whereHelpfulVotes(value: number): Promise<ProductReviewModel[]> {
  const query = DB.instance.selectFrom('product_reviews').where('helpful_votes', '=', value)
  const results: ProductReviewJsonResponse = await query.execute()

  return results.map((modelItem: ProductReviewJsonResponse) => new ProductReviewModel(modelItem))
}

export async function whereUnhelpfulVotes(value: number): Promise<ProductReviewModel[]> {
  const query = DB.instance.selectFrom('product_reviews').where('unhelpful_votes', '=', value)
  const results: ProductReviewJsonResponse = await query.execute()

  return results.map((modelItem: ProductReviewJsonResponse) => new ProductReviewModel(modelItem))
}

export async function wherePurchaseDate(value: string): Promise<ProductReviewModel[]> {
  const query = DB.instance.selectFrom('product_reviews').where('purchase_date', '=', value)
  const results: ProductReviewJsonResponse = await query.execute()

  return results.map((modelItem: ProductReviewJsonResponse) => new ProductReviewModel(modelItem))
}

export async function whereImages(value: string): Promise<ProductReviewModel[]> {
  const query = DB.instance.selectFrom('product_reviews').where('images', '=', value)
  const results: ProductReviewJsonResponse = await query.execute()

  return results.map((modelItem: ProductReviewJsonResponse) => new ProductReviewModel(modelItem))
}

export const ProductReview = ProductReviewModel

export default ProductReview
