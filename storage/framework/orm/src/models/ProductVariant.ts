import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import type { ProductModel } from './Product'
import { randomUUIDv7 } from 'bun'
import { cache } from '@stacksjs/cache'
import { sql } from '@stacksjs/database'
import { HttpError, ModelNotFoundException } from '@stacksjs/error-handling'
import { dispatch } from '@stacksjs/events'
import { BaseOrm, DB, SubqueryBuilder } from '@stacksjs/orm'

import Product from './Product'

export interface ProductVariantsTable {
  id: Generated<number>
  product_id: number
  variant: string
  type: string
  description?: string
  options?: string
  status: string | string[]
  uuid?: string

  created_at?: Date

  updated_at?: Date

}

export interface ProductVariantResponse {
  data: ProductVariantJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface ProductVariantJsonResponse extends Omit<Selectable<ProductVariantsTable>, 'password'> {
  [key: string]: any
}

export type NewProductVariant = Insertable<ProductVariantsTable>
export type ProductVariantUpdate = Updateable<ProductVariantsTable>

      type SortDirection = 'asc' | 'desc'
interface SortOptions { column: ProductVariantJsonResponse, order: SortDirection }
// Define a type for the options parameter
interface QueryOptions {
  sort?: SortOptions
  limit?: number
  offset?: number
  page?: number
}

export class ProductVariantModel extends BaseOrm<ProductVariantModel, ProductVariantsTable> {
  private readonly hidden: Array<keyof ProductVariantJsonResponse> = []
  private readonly fillable: Array<keyof ProductVariantJsonResponse> = ['variant', 'type', 'description', 'options', 'status', 'uuid']
  private readonly guarded: Array<keyof ProductVariantJsonResponse> = []
  protected attributes = {} as ProductVariantJsonResponse
  protected originalAttributes = {} as ProductVariantJsonResponse

  protected selectFromQuery: any
  protected withRelations: string[]
  protected updateFromQuery: any
  protected deleteFromQuery: any
  protected hasSelect: boolean
  private hasSaved: boolean
  private customColumns: Record<string, unknown> = {}

  constructor(productVariant: ProductVariantJsonResponse | undefined) {
    super('product_variants')
    if (productVariant) {
      this.attributes = { ...productVariant }
      this.originalAttributes = { ...productVariant }

      Object.keys(productVariant).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (productVariant as ProductVariantJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = DB.instance.selectFrom('product_variants')
    this.updateFromQuery = DB.instance.updateTable('product_variants')
    this.deleteFromQuery = DB.instance.deleteFrom('product_variants')
    this.hasSelect = false
    this.hasSaved = false
  }

  protected mapCustomGetters(models: ProductVariantJsonResponse | ProductVariantJsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: ProductVariantJsonResponse) => {
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

  async mapCustomSetters(model: NewProductVariant | ProductVariantUpdate): Promise<void> {
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

  get id(): number {
    return this.attributes.id
  }

  get uuid(): string | undefined {
    return this.attributes.uuid
  }

  get variant(): string {
    return this.attributes.variant
  }

  get type(): string {
    return this.attributes.type
  }

  get description(): string | undefined {
    return this.attributes.description
  }

  get options(): string | undefined {
    return this.attributes.options
  }

  get status(): string | string[] {
    return this.attributes.status
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

  set variant(value: string) {
    this.attributes.variant = value
  }

  set type(value: string) {
    this.attributes.type = value
  }

  set description(value: string) {
    this.attributes.description = value
  }

  set options(value: string) {
    this.attributes.options = value
  }

  set status(value: string | string[]) {
    this.attributes.status = value
  }

  set updated_at(value: Date) {
    this.attributes.updated_at = value
  }

  getOriginal(column?: keyof ProductVariantJsonResponse): Partial<ProductVariantJsonResponse> {
    if (column) {
      return this.originalAttributes[column]
    }

    return this.originalAttributes
  }

  getChanges(): Partial<ProductVariantJsonResponse> {
    return this.fillable.reduce<Partial<ProductVariantJsonResponse>>((changes, key) => {
      const currentValue = this.attributes[key as keyof ProductVariantsTable]
      const originalValue = this.originalAttributes[key as keyof ProductVariantsTable]

      if (currentValue !== originalValue) {
        changes[key] = currentValue
      }

      return changes
    }, {})
  }

  isDirty(column?: keyof ProductVariantJsonResponse): boolean {
    if (column) {
      return this.attributes[column] !== this.originalAttributes[column]
    }

    return Object.entries(this.originalAttributes).some(([key, originalValue]) => {
      const currentValue = (this.attributes as any)[key]

      return currentValue !== originalValue
    })
  }

  isClean(column?: keyof ProductVariantJsonResponse): boolean {
    return !this.isDirty(column)
  }

  wasChanged(column?: keyof ProductVariantJsonResponse): boolean {
    return this.hasSaved && this.isDirty(column)
  }

  select(params: (keyof ProductVariantJsonResponse)[] | RawBuilder<string> | string): ProductVariantModel {
    this.selectFromQuery = this.selectFromQuery.select(params)

    this.hasSelect = true

    return this
  }

  static select(params: (keyof ProductVariantJsonResponse)[] | RawBuilder<string> | string): ProductVariantModel {
    const instance = new ProductVariantModel(undefined)

    // Initialize a query with the table name and selected fields
    instance.selectFromQuery = instance.selectFromQuery.select(params)

    instance.hasSelect = true

    return instance
  }

  // Method to find a ProductVariant by ID
  static async find(id: number): Promise<ProductVariantModel | undefined> {
    const instance = new ProductVariantModel(undefined)

    return await instance.applyFind(id)
  }

  async first(): Promise<ProductVariantModel | undefined> {
    const model = await this.applyFirst()

    const data = new ProductVariantModel(model)

    return data
  }

  static async first(): Promise<ProductVariantModel | undefined> {
    const instance = new ProductVariantModel(undefined)

    const model = await instance.applyFirst()

    const data = new ProductVariantModel(model)

    return data
  }

  async applyFirstOrFail(): Promise<ProductVariantModel | undefined> {
    const model = await this.selectFromQuery.executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, 'No ProductVariantModel results found for query')

    if (model) {
      this.mapCustomGetters(model)
      await this.loadRelations(model)
    }

    const data = new ProductVariantModel(model)

    return data
  }

  async firstOrFail(): Promise<ProductVariantModel | undefined> {
    return await this.applyFirstOrFail()
  }

  static async firstOrFail(): Promise<ProductVariantModel | undefined> {
    const instance = new ProductVariantModel(undefined)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<ProductVariantModel[]> {
    const instance = new ProductVariantModel(undefined)

    const models = await DB.instance.selectFrom('product_variants').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: ProductVariantJsonResponse) => {
      return new ProductVariantModel(model)
    }))

    return data
  }

  async applyFindOrFail(id: number): Promise<ProductVariantModel> {
    const model = await DB.instance.selectFrom('product_variants').where('id', '=', id).selectAll().executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, `No ProductVariantModel results for ${id}`)

    cache.getOrSet(`productVariant:${id}`, JSON.stringify(model))

    this.mapCustomGetters(model)
    await this.loadRelations(model)

    const data = new ProductVariantModel(model)

    return data
  }

  async findOrFail(id: number): Promise<ProductVariantModel> {
    return await this.applyFindOrFail(id)
  }

  static async findOrFail(id: number): Promise<ProductVariantModel> {
    const instance = new ProductVariantModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  async applyFindMany(ids: number[]): Promise<ProductVariantModel[]> {
    let query = DB.instance.selectFrom('product_variants').where('id', 'in', ids)

    const instance = new ProductVariantModel(undefined)

    query = query.selectAll()

    const models = await query.execute()

    instance.mapCustomGetters(models)
    await instance.loadRelations(models)

    return models.map((modelItem: ProductVariantJsonResponse) => instance.parseResult(new ProductVariantModel(modelItem)))
  }

  static async findMany(ids: number[]): Promise<ProductVariantModel[]> {
    const instance = new ProductVariantModel(undefined)

    return await instance.applyFindMany(ids)
  }

  async findMany(ids: number[]): Promise<ProductVariantModel[]> {
    return await this.applyFindMany(ids)
  }

  skip(count: number): ProductVariantModel {
    this.selectFromQuery = this.selectFromQuery.offset(count)

    return this
  }

  static skip(count: number): ProductVariantModel {
    const instance = new ProductVariantModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.offset(count)

    return instance
  }

  async applyChunk(size: number, callback: (models: ProductVariantModel[]) => Promise<void>): Promise<void> {
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

  async chunk(size: number, callback: (models: ProductVariantModel[]) => Promise<void>): Promise<void> {
    await this.applyChunk(size, callback)
  }

  static async chunk(size: number, callback: (models: ProductVariantModel[]) => Promise<void>): Promise<void> {
    const instance = new ProductVariantModel(undefined)

    await instance.applyChunk(size, callback)
  }

  take(count: number): ProductVariantModel {
    this.selectFromQuery = this.selectFromQuery.limit(count)

    return this
  }

  static take(count: number): ProductVariantModel {
    const instance = new ProductVariantModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.limit(count)

    return instance
  }

  static async pluck<K extends keyof ProductVariantModel>(field: K): Promise<ProductVariantModel[K][]> {
    const instance = new ProductVariantModel(undefined)

    if (instance.hasSelect) {
      const model = await instance.selectFromQuery.execute()
      return model.map((modelItem: ProductVariantModel) => modelItem[field])
    }

    const model = await instance.selectFromQuery.selectAll().execute()

    return model.map((modelItem: ProductVariantModel) => modelItem[field])
  }

  async pluck<K extends keyof ProductVariantModel>(field: K): Promise<ProductVariantModel[K][]> {
    if (this.hasSelect) {
      const model = await this.selectFromQuery.execute()
      return model.map((modelItem: ProductVariantModel) => modelItem[field])
    }

    const model = await this.selectFromQuery.selectAll().execute()

    return model.map((modelItem: ProductVariantModel) => modelItem[field])
  }

  static async count(): Promise<number> {
    const instance = new ProductVariantModel(undefined)

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

  static async max(field: keyof ProductVariantModel): Promise<number> {
    const instance = new ProductVariantModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`MAX(${sql.raw(field as string)}) as max `)
      .executeTakeFirst()

    return result.max
  }

  async max(field: keyof ProductVariantModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`MAX(${sql.raw(field as string)}) as max`)
      .executeTakeFirst()

    return result.max
  }

  static async min(field: keyof ProductVariantModel): Promise<number> {
    const instance = new ProductVariantModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`MIN(${sql.raw(field as string)}) as min `)
      .executeTakeFirst()

    return result.min
  }

  async min(field: keyof ProductVariantModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`MIN(${sql.raw(field as string)}) as min `)
      .executeTakeFirst()

    return result.min
  }

  static async avg(field: keyof ProductVariantModel): Promise<number> {
    const instance = new ProductVariantModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`AVG(${sql.raw(field as string)}) as avg `)
      .executeTakeFirst()

    return result.avg
  }

  async avg(field: keyof ProductVariantModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`AVG(${sql.raw(field as string)}) as avg `)
      .executeTakeFirst()

    return result.avg
  }

  static async sum(field: keyof ProductVariantModel): Promise<number> {
    const instance = new ProductVariantModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`SUM(${sql.raw(field as string)}) as sum `)
      .executeTakeFirst()

    return result.sum
  }

  async sum(field: keyof ProductVariantModel): Promise<number> {
    const result = this.selectFromQuery
      .select(sql`SUM(${sql.raw(field as string)}) as sum `)
      .executeTakeFirst()

    return result.sum
  }

  async applyGet(): Promise<ProductVariantModel[]> {
    let models

    if (this.hasSelect) {
      models = await this.selectFromQuery.execute()
    }
    else {
      models = await this.selectFromQuery.selectAll().execute()
    }

    this.mapCustomGetters(models)
    await this.loadRelations(models)

    const data = await Promise.all(models.map(async (model: ProductVariantJsonResponse) => {
      return new ProductVariantModel(model)
    }))

    return data
  }

  async get(): Promise<ProductVariantModel[]> {
    return await this.applyGet()
  }

  static async get(): Promise<ProductVariantModel[]> {
    const instance = new ProductVariantModel(undefined)

    return await instance.applyGet()
  }

  has(relation: string): ProductVariantModel {
    this.selectFromQuery = this.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(
        selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.productVariant_id`, '=', 'product_variants.id'),
      ),
    )

    return this
  }

  static has(relation: string): ProductVariantModel {
    const instance = new ProductVariantModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(
        selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.productVariant_id`, '=', 'product_variants.id'),
      ),
    )

    return instance
  }

  static whereExists(callback: (qb: any) => any): ProductVariantModel {
    const instance = new ProductVariantModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(callback({ exists, selectFrom })),
    )

    return instance
  }

  applyWhereHas(
    relation: string,
    callback: (query: SubqueryBuilder<keyof ProductVariantModel>) => void,
  ): ProductVariantModel {
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    this.selectFromQuery = this.selectFromQuery
      .where(({ exists, selectFrom }: any) => {
        let subquery = selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.productVariant_id`, '=', 'product_variants.id')

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
    callback: (query: SubqueryBuilder<keyof ProductVariantModel>) => void,
  ): ProductVariantModel {
    return this.applyWhereHas(relation, callback)
  }

  static whereHas(
    relation: string,
    callback: (query: SubqueryBuilder<keyof ProductVariantModel>) => void,
  ): ProductVariantModel {
    const instance = new ProductVariantModel(undefined)

    return instance.applyWhereHas(relation, callback)
  }

  applyDoesntHave(relation: string): ProductVariantModel {
    this.selectFromQuery = this.selectFromQuery.where(({ not, exists, selectFrom }: any) =>
      not(
        exists(
          selectFrom(relation)
            .select('1')
            .whereRef(`${relation}.productVariant_id`, '=', 'product_variants.id'),
        ),
      ),
    )

    return this
  }

  doesntHave(relation: string): ProductVariantModel {
    return this.applyDoesntHave(relation)
  }

  static doesntHave(relation: string): ProductVariantModel {
    const instance = new ProductVariantModel(undefined)

    return instance.applyDoesntHave(relation)
  }

  applyWhereDoesntHave(relation: string, callback: (query: SubqueryBuilder<ProductVariantsTable>) => void): ProductVariantModel {
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    this.selectFromQuery = this.selectFromQuery
      .where(({ exists, selectFrom, not }: any) => {
        const subquery = selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.productVariant_id`, '=', 'product_variants.id')

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

  whereDoesntHave(relation: string, callback: (query: SubqueryBuilder<ProductVariantsTable>) => void): ProductVariantModel {
    return this.applyWhereDoesntHave(relation, callback)
  }

  static whereDoesntHave(
    relation: string,
    callback: (query: SubqueryBuilder<ProductVariantsTable>) => void,
  ): ProductVariantModel {
    const instance = new ProductVariantModel(undefined)

    return instance.applyWhereDoesntHave(relation, callback)
  }

  async applyPaginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<ProductVariantResponse> {
    const totalRecordsResult = await DB.instance.selectFrom('product_variants')
      .select(DB.instance.fn.count('id').as('total')) // Use 'id' or another actual column name
      .executeTakeFirst()

    const totalRecords = Number(totalRecordsResult?.total) || 0
    const totalPages = Math.ceil(totalRecords / (options.limit ?? 10))

    const product_variantsWithExtra = await DB.instance.selectFrom('product_variants')
      .selectAll()
      .orderBy('id', 'asc') // Assuming 'id' is used for cursor-based pagination
      .limit((options.limit ?? 10) + 1) // Fetch one extra record
      .offset(((options.page ?? 1) - 1) * (options.limit ?? 10)) // Ensure options.page is not undefined
      .execute()

    let nextCursor = null
    if (product_variantsWithExtra.length > (options.limit ?? 10))
      nextCursor = product_variantsWithExtra.pop()?.id ?? null

    return {
      data: product_variantsWithExtra,
      paging: {
        total_records: totalRecords,
        page: options.page || 1,
        total_pages: totalPages,
      },
      next_cursor: nextCursor,
    }
  }

  async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<ProductVariantResponse> {
    return await this.applyPaginate(options)
  }

  // Method to get all product_variants
  static async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<ProductVariantResponse> {
    const instance = new ProductVariantModel(undefined)

    return await instance.applyPaginate(options)
  }

  async applyCreate(newProductVariant: NewProductVariant): Promise<ProductVariantModel> {
    const filteredValues = Object.fromEntries(
      Object.entries(newProductVariant).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewProductVariant

    await this.mapCustomSetters(filteredValues)

    filteredValues.uuid = randomUUIDv7()

    const result = await DB.instance.insertInto('product_variants')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await this.find(Number(result.numInsertedOrUpdatedRows)) as ProductVariantModel

    if (model)
      dispatch('productVariant:created', model)

    return model
  }

  async create(newProductVariant: NewProductVariant): Promise<ProductVariantModel> {
    return await this.applyCreate(newProductVariant)
  }

  static async create(newProductVariant: NewProductVariant): Promise<ProductVariantModel> {
    const instance = new ProductVariantModel(undefined)

    return await instance.applyCreate(newProductVariant)
  }

  static async createMany(newProductVariant: NewProductVariant[]): Promise<void> {
    const instance = new ProductVariantModel(undefined)

    const valuesFiltered = newProductVariant.map((newProductVariant: NewProductVariant) => {
      const filteredValues = Object.fromEntries(
        Object.entries(newProductVariant).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewProductVariant

      filteredValues.uuid = randomUUIDv7()

      return filteredValues
    })

    await DB.instance.insertInto('product_variants')
      .values(valuesFiltered)
      .executeTakeFirst()
  }

  static async forceCreate(newProductVariant: NewProductVariant): Promise<ProductVariantModel> {
    const result = await DB.instance.insertInto('product_variants')
      .values(newProductVariant)
      .executeTakeFirst()

    const model = await find(Number(result.numInsertedOrUpdatedRows)) as ProductVariantModel

    if (model)
      dispatch('productVariant:created', model)

    return model
  }

  // Method to remove a ProductVariant
  static async remove(id: number): Promise<any> {
    const instance = new ProductVariantModel(undefined)

    const model = await instance.find(Number(id))

    if (model)
      dispatch('productVariant:deleted', model)

    return await DB.instance.deleteFrom('product_variants')
      .where('id', '=', id)
      .execute()
  }

  static where<V = string>(column: keyof ProductVariantsTable, ...args: [V] | [Operator, V]): ProductVariantModel {
    const instance = new ProductVariantModel(undefined)

    return instance.applyWhere<V>(column, ...args)
  }

  static whereColumn(first: keyof ProductVariantsTable, operator: Operator, second: keyof ProductVariantsTable): ProductVariantModel {
    const instance = new ProductVariantModel(undefined)

    instance.selectFromQuery = instance.applyWhereColumn(first, operator, second)

    return instance
  }

  static whereRef(column: keyof ProductVariantsTable, ...args: string[]): ProductVariantModel {
    const instance = new ProductVariantModel(undefined)

    return instance.applyWhereRef(column, ...args)
  }

  static whereRaw(sqlStatement: string): ProductVariantModel {
    const instance = new ProductVariantModel(undefined)

    instance.selectFromQuery = instance.applyWhereRaw(sqlStatement)

    return instance
  }

  static orWhere(...conditions: [string, any][]): ProductVariantModel {
    const instance = new ProductVariantModel(undefined)

    return instance.applyOrWhere(...conditions)
  }

  static when(condition: boolean, callback: (query: ProductVariantModel) => ProductVariantModel): ProductVariantModel {
    const instance = new ProductVariantModel(undefined)

    return instance.applyWhen(condition, callback)
  }

  static whereNotNull(column: keyof ProductVariantsTable): ProductVariantModel {
    const instance = new UserModel(undefined)

    return instance.applyWhereNotNull(column)
  }

  static whereNull(column: keyof ProductVariantsTable): ProductVariantModel {
    const instance = new ProductVariantModel(undefined)

    return instance.applyWhereNull(column)
  }

  static whereVariant(value: string): ProductVariantModel {
    const instance = new ProductVariantModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('variant', '=', value)

    return instance
  }

  static whereType(value: string): ProductVariantModel {
    const instance = new ProductVariantModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('type', '=', value)

    return instance
  }

  static whereDescription(value: string): ProductVariantModel {
    const instance = new ProductVariantModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('description', '=', value)

    return instance
  }

  static whereOptions(value: string): ProductVariantModel {
    const instance = new ProductVariantModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('options', '=', value)

    return instance
  }

  static whereStatus(value: string): ProductVariantModel {
    const instance = new ProductVariantModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('status', '=', value)

    return instance
  }

  applyWhereIn<V>(column: keyof ProductVariantsTable, values: V[]) {
    this.selectFromQuery = this.selectFromQuery.where(column, 'in', values)

    this.updateFromQuery = this.updateFromQuery.where(column, 'in', values)

    this.deleteFromQuery = this.deleteFromQuery.where(column, 'in', values)

    return this
  }

  whereIn<V = number>(column: keyof ProductVariantsTable, values: V[]): ProductVariantModel {
    return this.applyWhereIn<V>(column, values)
  }

  static whereIn<V = number>(column: keyof ProductVariantsTable, values: V[]): ProductVariantModel {
    const instance = new ProductVariantModel(undefined)

    return instance.applyWhereIn<V>(column, values)
  }

  applyWhereBetween<V>(column: keyof ProductVariantsTable, range: [V, V]): ProductVariantModel {
    if (range.length !== 2) {
      throw new HttpError(500, 'Range must have exactly two values: [min, max]')
    }

    const query = sql` ${sql.raw(column as string)} between ${range[0]} and ${range[1]} `

    this.selectFromQuery = this.selectFromQuery.where(query)
    this.updateFromQuery = this.updateFromQuery.where(query)
    this.deleteFromQuery = this.deleteFromQuery.where(query)

    return this
  }

  whereBetween<V = number>(column: keyof ProductVariantsTable, range: [V, V]): ProductVariantModel {
    return this.applyWhereBetween<V>(column, range)
  }

  static whereBetween<V = number>(column: keyof ProductVariantsTable, range: [V, V]): ProductVariantModel {
    const instance = new ProductVariantModel(undefined)

    return instance.applyWhereBetween<V>(column, range)
  }

  applyWhereLike(column: keyof ProductVariantsTable, value: string): ProductVariantModel {
    this.selectFromQuery = this.selectFromQuery.where(sql` ${sql.raw(column as string)} LIKE ${value}`)

    this.updateFromQuery = this.updateFromQuery.where(sql` ${sql.raw(column as string)} LIKE ${value}`)

    this.deleteFromQuery = this.deleteFromQuery.where(sql` ${sql.raw(column as string)} LIKE ${value}`)

    return this
  }

  whereLike(column: keyof ProductVariantsTable, value: string): ProductVariantModel {
    return this.applyWhereLike(column, value)
  }

  static whereLike(column: keyof ProductVariantsTable, value: string): ProductVariantModel {
    const instance = new ProductVariantModel(undefined)

    return instance.applyWhereLike(column, value)
  }

  applyWhereNotIn<V>(column: keyof ProductVariantsTable, values: V[]): ProductVariantModel {
    this.selectFromQuery = this.selectFromQuery.where(column, 'not in', values)

    this.updateFromQuery = this.updateFromQuery.where(column, 'not in', values)

    this.deleteFromQuery = this.deleteFromQuery.where(column, 'not in', values)

    return this
  }

  whereNotIn<V>(column: keyof ProductVariantsTable, values: V[]): ProductVariantModel {
    return this.applyWhereNotIn<V>(column, values)
  }

  static whereNotIn<V = number>(column: keyof ProductVariantsTable, values: V[]): ProductVariantModel {
    const instance = new ProductVariantModel(undefined)

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

  static async latest(): Promise<ProductVariantModel | undefined> {
    const instance = new ProductVariantModel(undefined)

    const model = await DB.instance.selectFrom('product_variants')
      .selectAll()
      .orderBy('id', 'desc')
      .executeTakeFirst()

    if (!model)
      return undefined

    instance.mapCustomGetters(model)

    const data = new ProductVariantModel(model)

    return data
  }

  static async oldest(): Promise<ProductVariantModel | undefined> {
    const instance = new ProductVariantModel(undefined)

    const model = await DB.instance.selectFrom('product_variants')
      .selectAll()
      .orderBy('id', 'asc')
      .executeTakeFirst()

    if (!model)
      return undefined

    instance.mapCustomGetters(model)

    const data = new ProductVariantModel(model)

    return data
  }

  static async firstOrCreate(
    condition: Partial<ProductVariantJsonResponse>,
    newProductVariant: NewProductVariant,
  ): Promise<ProductVariantModel> {
    const instance = new ProductVariantModel(undefined)

    const key = Object.keys(condition)[0] as keyof ProductVariantJsonResponse

    if (!key) {
      throw new HttpError(500, 'Condition must contain at least one key-value pair')
    }

    const value = condition[key]

    // Attempt to find the first record matching the condition
    const existingProductVariant = await DB.instance.selectFrom('product_variants')
      .selectAll()
      .where(key, '=', value)
      .executeTakeFirst()

    if (existingProductVariant) {
      instance.mapCustomGetters(existingProductVariant)
      await instance.loadRelations(existingProductVariant)

      return new ProductVariantModel(existingProductVariant as ProductVariantJsonResponse)
    }
    else {
      return await instance.create(newProductVariant)
    }
  }

  static async updateOrCreate(
    condition: Partial<ProductVariantJsonResponse>,
    newProductVariant: NewProductVariant,
  ): Promise<ProductVariantModel> {
    const instance = new ProductVariantModel(undefined)

    const key = Object.keys(condition)[0] as keyof ProductVariantJsonResponse

    if (!key) {
      throw new HttpError(500, 'Condition must contain at least one key-value pair')
    }

    const value = condition[key]

    // Attempt to find the first record matching the condition
    const existingProductVariant = await DB.instance.selectFrom('product_variants')
      .selectAll()
      .where(key, '=', value)
      .executeTakeFirst()

    if (existingProductVariant) {
      // If found, update the existing record
      await DB.instance.updateTable('product_variants')
        .set(newProductVariant)
        .where(key, '=', value)
        .executeTakeFirstOrThrow()

      // Fetch and return the updated record
      const updatedProductVariant = await DB.instance.selectFrom('product_variants')
        .selectAll()
        .where(key, '=', value)
        .executeTakeFirst()

      if (!updatedProductVariant) {
        throw new HttpError(500, 'Failed to fetch updated record')
      }

      instance.hasSaved = true

      return new ProductVariantModel(updatedProductVariant as ProductVariantJsonResponse)
    }
    else {
      // If not found, create a new record
      return await instance.create(newProductVariant)
    }
  }

  protected async loadRelations(models: ProductVariantJsonResponse | ProductVariantJsonResponse[]): Promise<void> {
    // Handle both single model and array of models
    const modelArray = Array.isArray(models) ? models : [models]
    if (!modelArray.length)
      return

    const modelIds = modelArray.map(model => model.id)

    for (const relation of this.withRelations) {
      const relatedRecords = await DB.instance
        .selectFrom(relation)
        .where('productVariant_id', 'in', modelIds)
        .selectAll()
        .execute()

      if (Array.isArray(models)) {
        models.map((model: ProductVariantJsonResponse) => {
          const records = relatedRecords.filter((record: { productVariant_id: number }) => {
            return record.productVariant_id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      }
      else {
        const records = relatedRecords.filter((record: { productVariant_id: number }) => {
          return record.productVariant_id === models.id
        })

        models[relation] = records.length === 1 ? records[0] : records
      }
    }
  }

  with(relations: string[]): ProductVariantModel {
    this.withRelations = relations

    return this
  }

  static with(relations: string[]): ProductVariantModel {
    const instance = new ProductVariantModel(undefined)

    instance.withRelations = relations

    return instance
  }

  async last(): Promise<ProductVariantModel | undefined> {
    let model: ProductVariantJsonResponse | undefined

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

    const data = new ProductVariantModel(model)

    return data
  }

  static async last(): Promise<ProductVariantModel | undefined> {
    const model = await DB.instance.selectFrom('product_variants').selectAll().orderBy('id', 'desc').executeTakeFirst()

    if (!model)
      return undefined

    const data = new ProductVariantModel(model)

    return data
  }

  orderBy(column: keyof ProductVariantsTable, order: 'asc' | 'desc'): ProductVariantModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, order)

    return this
  }

  static orderBy(column: keyof ProductVariantsTable, order: 'asc' | 'desc'): ProductVariantModel {
    const instance = new ProductVariantModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, order)

    return instance
  }

  groupBy(column: keyof ProductVariantsTable): ProductVariantModel {
    this.selectFromQuery = this.selectFromQuery.groupBy(column)

    return this
  }

  static groupBy(column: keyof ProductVariantsTable): ProductVariantModel {
    const instance = new ProductVariantModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.groupBy(column)

    return instance
  }

  having<V = string>(column: keyof ProductVariantsTable, operator: Operator, value: V): ProductVariantModel {
    this.selectFromQuery = this.selectFromQuery.having(column, operator, value)

    return this
  }

  static having<V = string>(column: keyof ProductVariantsTable, operator: Operator, value: V): ProductVariantModel {
    const instance = new ProductVariantModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.having(column, operator, value)

    return instance
  }

  inRandomOrder(): ProductVariantModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(sql` ${sql.raw('RANDOM()')} `)

    return this
  }

  static inRandomOrder(): ProductVariantModel {
    const instance = new ProductVariantModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(sql` ${sql.raw('RANDOM()')} `)

    return instance
  }

  orderByDesc(column: keyof ProductVariantsTable): ProductVariantModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, 'desc')

    return this
  }

  static orderByDesc(column: keyof ProductVariantsTable): ProductVariantModel {
    const instance = new ProductVariantModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'desc')

    return instance
  }

  orderByAsc(column: keyof ProductVariantsTable): ProductVariantModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, 'asc')

    return this
  }

  static orderByAsc(column: keyof ProductVariantsTable): ProductVariantModel {
    const instance = new ProductVariantModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'asc')

    return instance
  }

  async update(newProductVariant: ProductVariantUpdate): Promise<ProductVariantModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newProductVariant).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewProductVariant

    await this.mapCustomSetters(filteredValues)

    await DB.instance.updateTable('product_variants')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      const model = await this.find(this.id)

      if (model)
        dispatch('productVariant:updated', model)

      return model
    }

    this.hasSaved = true

    return undefined
  }

  async forceUpdate(productVariant: ProductVariantUpdate): Promise<ProductVariantModel | undefined> {
    if (this.id === undefined) {
      this.updateFromQuery.set(productVariant).execute()
    }

    await this.mapCustomSetters(productVariant)

    await DB.instance.updateTable('product_variants')
      .set(productVariant)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      const model = await this.find(this.id)

      if (model)
        dispatch('productVariant:updated', model)

      this.hasSaved = true

      return model
    }

    return undefined
  }

  async save(): Promise<void> {
    if (!this)
      throw new HttpError(500, 'ProductVariant data is undefined')

    await this.mapCustomSetters(this.attributes)

    if (this.id === undefined) {
      await this.create(this.attributes)
    }
    else {
      await this.update(this.attributes)
    }

    this.hasSaved = true
  }

  fill(data: Partial<ProductVariantJsonResponse>): ProductVariantModel {
    const filteredValues = Object.fromEntries(
      Object.entries(data).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewProductVariant

    this.attributes = {
      ...this.attributes,
      ...filteredValues,
    }

    return this
  }

  forceFill(data: Partial<ProductVariantJsonResponse>): ProductVariantModel {
    this.attributes = {
      ...this.attributes,
      ...data,
    }

    return this
  }

  // Method to delete (soft delete) the productVariant instance
  async delete(): Promise<ProductVariantsTable> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()
    const model = await this.find(Number(this.id))
    if (model)
      dispatch('productVariant:deleted', model)

    return await DB.instance.deleteFrom('product_variants')
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

  toSearchableObject(): Partial<ProductVariantJsonResponse> {
    return {
      id: this.id,
      product_id: this.product_id,
      variant: this.variant,
      type: this.type,
      description: this.description,
      options: this.options,
      status: this.status,
    }
  }

  distinct(column: keyof ProductVariantJsonResponse): ProductVariantModel {
    this.selectFromQuery = this.selectFromQuery.select(column).distinct()

    this.hasSelect = true

    return this
  }

  static distinct(column: keyof ProductVariantJsonResponse): ProductVariantModel {
    const instance = new ProductVariantModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.select(column).distinct()

    instance.hasSelect = true

    return instance
  }

  join(table: string, firstCol: string, secondCol: string): ProductVariantModel {
    this.selectFromQuery = this.selectFromQuery.innerJoin(table, firstCol, secondCol)

    return this
  }

  static join(table: string, firstCol: string, secondCol: string): ProductVariantModel {
    const instance = new ProductVariantModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.innerJoin(table, firstCol, secondCol)

    return instance
  }

  toJSON(): ProductVariantJsonResponse {
    const output = {

      uuid: this.uuid,

      id: this.id,
      variant: this.variant,
      type: this.type,
      description: this.description,
      options: this.options,
      status: this.status,

      created_at: this.created_at,

      updated_at: this.updated_at,

      product_id: this.product_id,
      product: this.product,
      ...this.customColumns,
    }

    return output
  }

  parseResult(model: ProductVariantModel): ProductVariantModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof ProductVariantModel]
    }

    return model
  }
}

async function find(id: number): Promise<ProductVariantModel | undefined> {
  const query = DB.instance.selectFrom('product_variants').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  return new ProductVariantModel(model)
}

export async function count(): Promise<number> {
  const results = await ProductVariantModel.count()

  return results
}

export async function create(newProductVariant: NewProductVariant): Promise<ProductVariantModel> {
  const result = await DB.instance.insertInto('product_variants')
    .values(newProductVariant)
    .executeTakeFirstOrThrow()

  return await find(Number(result.numInsertedOrUpdatedRows)) as ProductVariantModel
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(DB.instance)
}

export async function remove(id: number): Promise<void> {
  await DB.instance.deleteFrom('product_variants')
    .where('id', '=', id)
    .execute()
}

export async function whereVariant(value: string): Promise<ProductVariantModel[]> {
  const query = DB.instance.selectFrom('product_variants').where('variant', '=', value)
  const results: ProductVariantJsonResponse = await query.execute()

  return results.map((modelItem: ProductVariantJsonResponse) => new ProductVariantModel(modelItem))
}

export async function whereType(value: string): Promise<ProductVariantModel[]> {
  const query = DB.instance.selectFrom('product_variants').where('type', '=', value)
  const results: ProductVariantJsonResponse = await query.execute()

  return results.map((modelItem: ProductVariantJsonResponse) => new ProductVariantModel(modelItem))
}

export async function whereDescription(value: string): Promise<ProductVariantModel[]> {
  const query = DB.instance.selectFrom('product_variants').where('description', '=', value)
  const results: ProductVariantJsonResponse = await query.execute()

  return results.map((modelItem: ProductVariantJsonResponse) => new ProductVariantModel(modelItem))
}

export async function whereOptions(value: string): Promise<ProductVariantModel[]> {
  const query = DB.instance.selectFrom('product_variants').where('options', '=', value)
  const results: ProductVariantJsonResponse = await query.execute()

  return results.map((modelItem: ProductVariantJsonResponse) => new ProductVariantModel(modelItem))
}

export async function whereStatus(value: string | string[]): Promise<ProductVariantModel[]> {
  const query = DB.instance.selectFrom('product_variants').where('status', '=', value)
  const results: ProductVariantJsonResponse = await query.execute()

  return results.map((modelItem: ProductVariantJsonResponse) => new ProductVariantModel(modelItem))
}

export const ProductVariant = ProductVariantModel

export default ProductVariant
