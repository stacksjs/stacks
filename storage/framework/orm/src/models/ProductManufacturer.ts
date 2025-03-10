import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import type { ProductModel } from './Product'
import { randomUUIDv7 } from 'bun'
import { cache } from '@stacksjs/cache'
import { sql } from '@stacksjs/database'
import { HttpError, ModelNotFoundException } from '@stacksjs/error-handling'
import { dispatch } from '@stacksjs/events'
import { DB, SubqueryBuilder } from '@stacksjs/orm'

export interface ProductManufacturersTable {
  id: Generated<number>
  manufacturer: string
  description?: string
  country: string
  featured?: boolean
  uuid?: string

  created_at?: Date

  updated_at?: Date

}

export interface ProductManufacturerResponse {
  data: ProductManufacturerJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface ProductManufacturerJsonResponse extends Omit<Selectable<ProductManufacturersTable>, 'password'> {
  [key: string]: any
}

export type NewProductManufacturer = Insertable<ProductManufacturersTable>
export type ProductManufacturerUpdate = Updateable<ProductManufacturersTable>

      type SortDirection = 'asc' | 'desc'
interface SortOptions { column: ProductManufacturerJsonResponse, order: SortDirection }
// Define a type for the options parameter
interface QueryOptions {
  sort?: SortOptions
  limit?: number
  offset?: number
  page?: number
}

export class ProductManufacturerModel {
  private readonly hidden: Array<keyof ProductManufacturerJsonResponse> = []
  private readonly fillable: Array<keyof ProductManufacturerJsonResponse> = ['manufacturer', 'description', 'country', 'featured', 'uuid']
  private readonly guarded: Array<keyof ProductManufacturerJsonResponse> = []
  protected attributes = {} as ProductManufacturerJsonResponse
  protected originalAttributes = {} as ProductManufacturerJsonResponse

  protected selectFromQuery: any
  protected withRelations: string[]
  protected updateFromQuery: any
  protected deleteFromQuery: any
  protected hasSelect: boolean
  private hasSaved: boolean
  private customColumns: Record<string, unknown> = {}

  constructor(productManufacturer: ProductManufacturerJsonResponse | undefined) {
    if (productManufacturer) {
      this.attributes = { ...productManufacturer }
      this.originalAttributes = { ...productManufacturer }

      Object.keys(productManufacturer).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (productManufacturer as ProductManufacturerJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = DB.instance.selectFrom('product_manufacturers')
    this.updateFromQuery = DB.instance.updateTable('product_manufacturers')
    this.deleteFromQuery = DB.instance.deleteFrom('product_manufacturers')
    this.hasSelect = false
    this.hasSaved = false
  }

  mapCustomGetters(models: ProductManufacturerJsonResponse | ProductManufacturerJsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: ProductManufacturerJsonResponse) => {
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

  async mapCustomSetters(model: NewProductManufacturer | ProductManufacturerUpdate): Promise<void> {
    const customSetter = {
      default: () => {
      },

    }

    for (const [key, fn] of Object.entries(customSetter)) {
      model[key] = await fn()
    }
  }

  get products(): ProductModel[] | [] {
    return this.attributes.products
  }

  get id(): number {
    return this.attributes.id
  }

  get uuid(): string | undefined {
    return this.attributes.uuid
  }

  get manufacturer(): string {
    return this.attributes.manufacturer
  }

  get description(): string | undefined {
    return this.attributes.description
  }

  get country(): string {
    return this.attributes.country
  }

  get featured(): boolean | undefined {
    return this.attributes.featured
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

  set manufacturer(value: string) {
    this.attributes.manufacturer = value
  }

  set description(value: string) {
    this.attributes.description = value
  }

  set country(value: string) {
    this.attributes.country = value
  }

  set featured(value: boolean) {
    this.attributes.featured = value
  }

  set updated_at(value: Date) {
    this.attributes.updated_at = value
  }

  getOriginal(column?: keyof ProductManufacturerJsonResponse): Partial<ProductManufacturerJsonResponse> {
    if (column) {
      return this.originalAttributes[column]
    }

    return this.originalAttributes
  }

  getChanges(): Partial<ProductManufacturerJsonResponse> {
    return this.fillable.reduce<Partial<ProductManufacturerJsonResponse>>((changes, key) => {
      const currentValue = this.attributes[key as keyof ProductManufacturersTable]
      const originalValue = this.originalAttributes[key as keyof ProductManufacturersTable]

      if (currentValue !== originalValue) {
        changes[key] = currentValue
      }

      return changes
    }, {})
  }

  isDirty(column?: keyof ProductManufacturerJsonResponse): boolean {
    if (column) {
      return this.attributes[column] !== this.originalAttributes[column]
    }

    return Object.entries(this.originalAttributes).some(([key, originalValue]) => {
      const currentValue = (this.attributes as any)[key]

      return currentValue !== originalValue
    })
  }

  isClean(column?: keyof ProductManufacturerJsonResponse): boolean {
    return !this.isDirty(column)
  }

  wasChanged(column?: keyof ProductManufacturerJsonResponse): boolean {
    return this.hasSaved && this.isDirty(column)
  }

  select(params: (keyof ProductManufacturerJsonResponse)[] | RawBuilder<string> | string): ProductManufacturerModel {
    this.selectFromQuery = this.selectFromQuery.select(params)

    this.hasSelect = true

    return this
  }

  static select(params: (keyof ProductManufacturerJsonResponse)[] | RawBuilder<string> | string): ProductManufacturerModel {
    const instance = new ProductManufacturerModel(undefined)

    // Initialize a query with the table name and selected fields
    instance.selectFromQuery = instance.selectFromQuery.select(params)

    instance.hasSelect = true

    return instance
  }

  async applyFind(id: number): Promise<ProductManufacturerModel | undefined> {
    const model = await DB.instance.selectFrom('product_manufacturers').where('id', '=', id).selectAll().executeTakeFirst()

    if (!model)
      return undefined

    this.mapCustomGetters(model)
    await this.loadRelations(model)

    const data = new ProductManufacturerModel(model)

    cache.getOrSet(`productManufacturer:${id}`, JSON.stringify(model))

    return data
  }

  async find(id: number): Promise<ProductManufacturerModel | undefined> {
    return await this.applyFind(id)
  }

  // Method to find a ProductManufacturer by ID
  static async find(id: number): Promise<ProductManufacturerModel | undefined> {
    const instance = new ProductManufacturerModel(undefined)

    return await instance.applyFind(id)
  }

  async first(): Promise<ProductManufacturerModel | undefined> {
    let model: ProductManufacturerJsonResponse | undefined

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

    const data = new ProductManufacturerModel(model)

    return data
  }

  static async first(): Promise<ProductManufacturerModel | undefined> {
    const instance = new ProductManufacturerJsonResponse(null)

    const model = await DB.instance.selectFrom('product_manufacturers')
      .selectAll()
      .executeTakeFirst()

    instance.mapCustomGetters(model)

    const data = new ProductManufacturerModel(model)

    return data
  }

  async applyFirstOrFail(): Promise<ProductManufacturerModel | undefined> {
    const model = await this.selectFromQuery.executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, 'No ProductManufacturerModel results found for query')

    if (model) {
      this.mapCustomGetters(model)
      await this.loadRelations(model)
    }

    const data = new ProductManufacturerModel(model)

    return data
  }

  async firstOrFail(): Promise<ProductManufacturerModel | undefined> {
    return await this.applyFirstOrFail()
  }

  static async firstOrFail(): Promise<ProductManufacturerModel | undefined> {
    const instance = new ProductManufacturerModel(undefined)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<ProductManufacturerModel[]> {
    const instance = new ProductManufacturerModel(undefined)

    const models = await DB.instance.selectFrom('product_manufacturers').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: ProductManufacturerJsonResponse) => {
      return new ProductManufacturerModel(model)
    }))

    return data
  }

  async applyFindOrFail(id: number): Promise<ProductManufacturerModel> {
    const model = await DB.instance.selectFrom('product_manufacturers').where('id', '=', id).selectAll().executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, `No ProductManufacturerModel results for ${id}`)

    cache.getOrSet(`productManufacturer:${id}`, JSON.stringify(model))

    this.mapCustomGetters(model)
    await this.loadRelations(model)

    const data = new ProductManufacturerModel(model)

    return data
  }

  async findOrFail(id: number): Promise<ProductManufacturerModel> {
    return await this.applyFindOrFail(id)
  }

  static async findOrFail(id: number): Promise<ProductManufacturerModel> {
    const instance = new ProductManufacturerModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  async applyFindMany(ids: number[]): Promise<ProductManufacturerModel[]> {
    let query = DB.instance.selectFrom('product_manufacturers').where('id', 'in', ids)

    const instance = new ProductManufacturerModel(undefined)

    query = query.selectAll()

    const models = await query.execute()

    instance.mapCustomGetters(models)
    await instance.loadRelations(models)

    return models.map((modelItem: ProductManufacturerJsonResponse) => instance.parseResult(new ProductManufacturerModel(modelItem)))
  }

  static async findMany(ids: number[]): Promise<ProductManufacturerModel[]> {
    const instance = new ProductManufacturerModel(undefined)

    return await instance.applyFindMany(ids)
  }

  async findMany(ids: number[]): Promise<ProductManufacturerModel[]> {
    return await this.applyFindMany(ids)
  }

  skip(count: number): ProductManufacturerModel {
    this.selectFromQuery = this.selectFromQuery.offset(count)

    return this
  }

  static skip(count: number): ProductManufacturerModel {
    const instance = new ProductManufacturerModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.offset(count)

    return instance
  }

  async applyChunk(size: number, callback: (models: ProductManufacturerModel[]) => Promise<void>): Promise<void> {
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

  async chunk(size: number, callback: (models: ProductManufacturerModel[]) => Promise<void>): Promise<void> {
    await this.applyChunk(size, callback)
  }

  static async chunk(size: number, callback: (models: ProductManufacturerModel[]) => Promise<void>): Promise<void> {
    const instance = new ProductManufacturerModel(undefined)

    await instance.applyChunk(size, callback)
  }

  take(count: number): ProductManufacturerModel {
    this.selectFromQuery = this.selectFromQuery.limit(count)

    return this
  }

  static take(count: number): ProductManufacturerModel {
    const instance = new ProductManufacturerModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.limit(count)

    return instance
  }

  static async pluck<K extends keyof ProductManufacturerModel>(field: K): Promise<ProductManufacturerModel[K][]> {
    const instance = new ProductManufacturerModel(undefined)

    if (instance.hasSelect) {
      const model = await instance.selectFromQuery.execute()
      return model.map((modelItem: ProductManufacturerModel) => modelItem[field])
    }

    const model = await instance.selectFromQuery.selectAll().execute()

    return model.map((modelItem: ProductManufacturerModel) => modelItem[field])
  }

  async pluck<K extends keyof ProductManufacturerModel>(field: K): Promise<ProductManufacturerModel[K][]> {
    if (this.hasSelect) {
      const model = await this.selectFromQuery.execute()
      return model.map((modelItem: ProductManufacturerModel) => modelItem[field])
    }

    const model = await this.selectFromQuery.selectAll().execute()

    return model.map((modelItem: ProductManufacturerModel) => modelItem[field])
  }

  static async count(): Promise<number> {
    const instance = new ProductManufacturerModel(undefined)

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

  static async max(field: keyof ProductManufacturerModel): Promise<number> {
    const instance = new ProductManufacturerModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`MAX(${sql.raw(field as string)}) as max `)
      .executeTakeFirst()

    return result.max
  }

  async max(field: keyof ProductManufacturerModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`MAX(${sql.raw(field as string)}) as max`)
      .executeTakeFirst()

    return result.max
  }

  static async min(field: keyof ProductManufacturerModel): Promise<number> {
    const instance = new ProductManufacturerModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`MIN(${sql.raw(field as string)}) as min `)
      .executeTakeFirst()

    return result.min
  }

  async min(field: keyof ProductManufacturerModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`MIN(${sql.raw(field as string)}) as min `)
      .executeTakeFirst()

    return result.min
  }

  static async avg(field: keyof ProductManufacturerModel): Promise<number> {
    const instance = new ProductManufacturerModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`AVG(${sql.raw(field as string)}) as avg `)
      .executeTakeFirst()

    return result.avg
  }

  async avg(field: keyof ProductManufacturerModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`AVG(${sql.raw(field as string)}) as avg `)
      .executeTakeFirst()

    return result.avg
  }

  static async sum(field: keyof ProductManufacturerModel): Promise<number> {
    const instance = new ProductManufacturerModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`SUM(${sql.raw(field as string)}) as sum `)
      .executeTakeFirst()

    return result.sum
  }

  async sum(field: keyof ProductManufacturerModel): Promise<number> {
    const result = this.selectFromQuery
      .select(sql`SUM(${sql.raw(field as string)}) as sum `)
      .executeTakeFirst()

    return result.sum
  }

  async applyGet(): Promise<ProductManufacturerModel[]> {
    let models

    if (this.hasSelect) {
      models = await this.selectFromQuery.execute()
    }
    else {
      models = await this.selectFromQuery.selectAll().execute()
    }

    this.mapCustomGetters(models)
    await this.loadRelations(models)

    const data = await Promise.all(models.map(async (model: ProductManufacturerJsonResponse) => {
      return new ProductManufacturerModel(model)
    }))

    return data
  }

  async get(): Promise<ProductManufacturerModel[]> {
    return await this.applyGet()
  }

  static async get(): Promise<ProductManufacturerModel[]> {
    const instance = new ProductManufacturerModel(undefined)

    return await instance.applyGet()
  }

  has(relation: string): ProductManufacturerModel {
    this.selectFromQuery = this.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(
        selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.productManufacturer_id`, '=', 'product_manufacturers.id'),
      ),
    )

    return this
  }

  static has(relation: string): ProductManufacturerModel {
    const instance = new ProductManufacturerModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(
        selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.productManufacturer_id`, '=', 'product_manufacturers.id'),
      ),
    )

    return instance
  }

  static whereExists(callback: (qb: any) => any): ProductManufacturerModel {
    const instance = new ProductManufacturerModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(callback({ exists, selectFrom })),
    )

    return instance
  }

  applyWhereHas(
    relation: string,
    callback: (query: SubqueryBuilder<keyof ProductManufacturerModel>) => void,
  ): ProductManufacturerModel {
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    this.selectFromQuery = this.selectFromQuery
      .where(({ exists, selectFrom }: any) => {
        let subquery = selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.productManufacturer_id`, '=', 'product_manufacturers.id')

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
    callback: (query: SubqueryBuilder<keyof ProductManufacturerModel>) => void,
  ): ProductManufacturerModel {
    return this.applyWhereHas(relation, callback)
  }

  static whereHas(
    relation: string,
    callback: (query: SubqueryBuilder<keyof ProductManufacturerModel>) => void,
  ): ProductManufacturerModel {
    const instance = new ProductManufacturerModel(undefined)

    return instance.applyWhereHas(relation, callback)
  }

  applyDoesntHave(relation: string): ProductManufacturerModel {
    this.selectFromQuery = this.selectFromQuery.where(({ not, exists, selectFrom }: any) =>
      not(
        exists(
          selectFrom(relation)
            .select('1')
            .whereRef(`${relation}.productManufacturer_id`, '=', 'product_manufacturers.id'),
        ),
      ),
    )

    return this
  }

  doesntHave(relation: string): ProductManufacturerModel {
    return this.applyDoesntHave(relation)
  }

  static doesntHave(relation: string): ProductManufacturerModel {
    const instance = new ProductManufacturerModel(undefined)

    return instance.applyDoesntHave(relation)
  }

  applyWhereDoesntHave(relation: string, callback: (query: SubqueryBuilder<ProductManufacturersTable>) => void): ProductManufacturerModel {
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    this.selectFromQuery = this.selectFromQuery
      .where(({ exists, selectFrom, not }: any) => {
        const subquery = selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.productManufacturer_id`, '=', 'product_manufacturers.id')

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

  whereDoesntHave(relation: string, callback: (query: SubqueryBuilder<ProductManufacturersTable>) => void): ProductManufacturerModel {
    return this.applyWhereDoesntHave(relation, callback)
  }

  static whereDoesntHave(
    relation: string,
    callback: (query: SubqueryBuilder<ProductManufacturersTable>) => void,
  ): ProductManufacturerModel {
    const instance = new ProductManufacturerModel(undefined)

    return instance.applyWhereDoesntHave(relation, callback)
  }

  async applyPaginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<ProductManufacturerResponse> {
    const totalRecordsResult = await DB.instance.selectFrom('product_manufacturers')
      .select(DB.instance.fn.count('id').as('total')) // Use 'id' or another actual column name
      .executeTakeFirst()

    const totalRecords = Number(totalRecordsResult?.total) || 0
    const totalPages = Math.ceil(totalRecords / (options.limit ?? 10))

    const product_manufacturersWithExtra = await DB.instance.selectFrom('product_manufacturers')
      .selectAll()
      .orderBy('id', 'asc') // Assuming 'id' is used for cursor-based pagination
      .limit((options.limit ?? 10) + 1) // Fetch one extra record
      .offset(((options.page ?? 1) - 1) * (options.limit ?? 10)) // Ensure options.page is not undefined
      .execute()

    let nextCursor = null
    if (product_manufacturersWithExtra.length > (options.limit ?? 10))
      nextCursor = product_manufacturersWithExtra.pop()?.id ?? null

    return {
      data: product_manufacturersWithExtra,
      paging: {
        total_records: totalRecords,
        page: options.page || 1,
        total_pages: totalPages,
      },
      next_cursor: nextCursor,
    }
  }

  async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<ProductManufacturerResponse> {
    return await this.applyPaginate(options)
  }

  // Method to get all product_manufacturers
  static async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<ProductManufacturerResponse> {
    const instance = new ProductManufacturerModel(undefined)

    return await instance.applyPaginate(options)
  }

  async applyCreate(newProductManufacturer: NewProductManufacturer): Promise<ProductManufacturerModel> {
    const filteredValues = Object.fromEntries(
      Object.entries(newProductManufacturer).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewProductManufacturer

    await this.mapCustomSetters(filteredValues)

    filteredValues.uuid = randomUUIDv7()

    const result = await DB.instance.insertInto('product_manufacturers')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await this.find(Number(result.numInsertedOrUpdatedRows)) as ProductManufacturerModel

    if (model)
      dispatch('productManufacturer:created', model)

    return model
  }

  async create(newProductManufacturer: NewProductManufacturer): Promise<ProductManufacturerModel> {
    return await this.applyCreate(newProductManufacturer)
  }

  static async create(newProductManufacturer: NewProductManufacturer): Promise<ProductManufacturerModel> {
    const instance = new ProductManufacturerModel(undefined)

    return await instance.applyCreate(newProductManufacturer)
  }

  static async createMany(newProductManufacturer: NewProductManufacturer[]): Promise<void> {
    const instance = new ProductManufacturerModel(undefined)

    const valuesFiltered = newProductManufacturer.map((newProductManufacturer: NewProductManufacturer) => {
      const filteredValues = Object.fromEntries(
        Object.entries(newProductManufacturer).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewProductManufacturer

      filteredValues.uuid = randomUUIDv7()

      return filteredValues
    })

    await DB.instance.insertInto('product_manufacturers')
      .values(valuesFiltered)
      .executeTakeFirst()
  }

  static async forceCreate(newProductManufacturer: NewProductManufacturer): Promise<ProductManufacturerModel> {
    const result = await DB.instance.insertInto('product_manufacturers')
      .values(newProductManufacturer)
      .executeTakeFirst()

    const model = await find(Number(result.numInsertedOrUpdatedRows)) as ProductManufacturerModel

    if (model)
      dispatch('productManufacturer:created', model)

    return model
  }

  // Method to remove a ProductManufacturer
  static async remove(id: number): Promise<any> {
    const instance = new ProductManufacturerModel(undefined)

    const model = await instance.find(Number(id))

    if (model)
      dispatch('productManufacturer:deleted', model)

    return await DB.instance.deleteFrom('product_manufacturers')
      .where('id', '=', id)
      .execute()
  }

  applyWhere<V>(column: keyof ProductManufacturersTable, ...args: [V] | [Operator, V]): ProductManufacturerModel {
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

  where<V = string>(column: keyof ProductManufacturersTable, ...args: [V] | [Operator, V]): ProductManufacturerModel {
    return this.applyWhere<V>(column, ...args)
  }

  static where<V = string>(column: keyof ProductManufacturersTable, ...args: [V] | [Operator, V]): ProductManufacturerModel {
    const instance = new ProductManufacturerModel(undefined)

    return instance.applyWhere<V>(column, ...args)
  }

  whereColumn(first: keyof ProductManufacturersTable, operator: Operator, second: keyof ProductManufacturersTable): ProductManufacturerModel {
    this.selectFromQuery = this.selectFromQuery.whereRef(first, operator, second)

    return this
  }

  static whereColumn(first: keyof ProductManufacturersTable, operator: Operator, second: keyof ProductManufacturersTable): ProductManufacturerModel {
    const instance = new ProductManufacturerModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.whereRef(first, operator, second)

    return instance
  }

  applyWhereRef(column: keyof ProductManufacturersTable, ...args: string[]): ProductManufacturerModel {
    const [operatorOrValue, value] = args
    const operator = value === undefined ? '=' : operatorOrValue
    const actualValue = value === undefined ? operatorOrValue : value

    const instance = new ProductManufacturerModel(undefined)
    instance.selectFromQuery = instance.selectFromQuery.whereRef(column, operator, actualValue)

    return instance
  }

  whereRef(column: keyof ProductManufacturersTable, ...args: string[]): ProductManufacturerModel {
    return this.applyWhereRef(column, ...args)
  }

  static whereRef(column: keyof ProductManufacturersTable, ...args: string[]): ProductManufacturerModel {
    const instance = new ProductManufacturerModel(undefined)

    return instance.applyWhereRef(column, ...args)
  }

  whereRaw(sqlStatement: string): ProductManufacturerModel {
    this.selectFromQuery = this.selectFromQuery.where(sql`${sqlStatement}`)

    return this
  }

  static whereRaw(sqlStatement: string): ProductManufacturerModel {
    const instance = new ProductManufacturerModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where(sql`${sqlStatement}`)

    return instance
  }

  applyOrWhere(...conditions: [string, any][]): ProductManufacturerModel {
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

  orWhere(...conditions: [string, any][]): ProductManufacturerModel {
    return this.applyOrWhere(...conditions)
  }

  static orWhere(...conditions: [string, any][]): ProductManufacturerModel {
    const instance = new ProductManufacturerModel(undefined)

    return instance.applyOrWhere(...conditions)
  }

  when(
    condition: boolean,
    callback: (query: ProductManufacturerModel) => ProductManufacturerModel,
  ): ProductManufacturerModel {
    return ProductManufacturerModel.when(condition, callback)
  }

  static when(
    condition: boolean,
    callback: (query: ProductManufacturerModel) => ProductManufacturerModel,
  ): ProductManufacturerModel {
    let instance = new ProductManufacturerModel(undefined)

    if (condition)
      instance = callback(instance)

    return instance
  }

  whereNotNull(column: keyof ProductManufacturersTable): ProductManufacturerModel {
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

  static whereNotNull(column: keyof ProductManufacturersTable): ProductManufacturerModel {
    const instance = new ProductManufacturerModel(undefined)

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

  whereNull(column: keyof ProductManufacturersTable): ProductManufacturerModel {
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

  static whereNull(column: keyof ProductManufacturersTable): ProductManufacturerModel {
    const instance = new ProductManufacturerModel(undefined)

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

  static whereManufacturer(value: string): ProductManufacturerModel {
    const instance = new ProductManufacturerModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('manufacturer', '=', value)

    return instance
  }

  static whereDescription(value: string): ProductManufacturerModel {
    const instance = new ProductManufacturerModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('description', '=', value)

    return instance
  }

  static whereCountry(value: string): ProductManufacturerModel {
    const instance = new ProductManufacturerModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('country', '=', value)

    return instance
  }

  static whereFeatured(value: string): ProductManufacturerModel {
    const instance = new ProductManufacturerModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('featured', '=', value)

    return instance
  }

  applyWhereIn<V>(column: keyof ProductManufacturersTable, values: V[]) {
    this.selectFromQuery = this.selectFromQuery.where(column, 'in', values)

    this.updateFromQuery = this.updateFromQuery.where(column, 'in', values)

    this.deleteFromQuery = this.deleteFromQuery.where(column, 'in', values)

    return this
  }

  whereIn<V = number>(column: keyof ProductManufacturersTable, values: V[]): ProductManufacturerModel {
    return this.applyWhereIn<V>(column, values)
  }

  static whereIn<V = number>(column: keyof ProductManufacturersTable, values: V[]): ProductManufacturerModel {
    const instance = new ProductManufacturerModel(undefined)

    return instance.applyWhereIn<V>(column, values)
  }

  applyWhereBetween<V>(column: keyof ProductManufacturersTable, range: [V, V]): ProductManufacturerModel {
    if (range.length !== 2) {
      throw new HttpError(500, 'Range must have exactly two values: [min, max]')
    }

    const query = sql` ${sql.raw(column as string)} between ${range[0]} and ${range[1]} `

    this.selectFromQuery = this.selectFromQuery.where(query)
    this.updateFromQuery = this.updateFromQuery.where(query)
    this.deleteFromQuery = this.deleteFromQuery.where(query)

    return this
  }

  whereBetween<V = number>(column: keyof ProductManufacturersTable, range: [V, V]): ProductManufacturerModel {
    return this.applyWhereBetween<V>(column, range)
  }

  static whereBetween<V = number>(column: keyof ProductManufacturersTable, range: [V, V]): ProductManufacturerModel {
    const instance = new ProductManufacturerModel(undefined)

    return instance.applyWhereBetween<V>(column, range)
  }

  applyWhereLike(column: keyof ProductManufacturersTable, value: string): ProductManufacturerModel {
    this.selectFromQuery = this.selectFromQuery.where(sql` ${sql.raw(column as string)} LIKE ${value}`)

    this.updateFromQuery = this.updateFromQuery.where(sql` ${sql.raw(column as string)} LIKE ${value}`)

    this.deleteFromQuery = this.deleteFromQuery.where(sql` ${sql.raw(column as string)} LIKE ${value}`)

    return this
  }

  whereLike(column: keyof ProductManufacturersTable, value: string): ProductManufacturerModel {
    return this.applyWhereLike(column, value)
  }

  static whereLike(column: keyof ProductManufacturersTable, value: string): ProductManufacturerModel {
    const instance = new ProductManufacturerModel(undefined)

    return instance.applyWhereLike(column, value)
  }

  applyWhereNotIn<V>(column: keyof ProductManufacturersTable, values: V[]): ProductManufacturerModel {
    this.selectFromQuery = this.selectFromQuery.where(column, 'not in', values)

    this.updateFromQuery = this.updateFromQuery.where(column, 'not in', values)

    this.deleteFromQuery = this.deleteFromQuery.where(column, 'not in', values)

    return this
  }

  whereNotIn<V>(column: keyof ProductManufacturersTable, values: V[]): ProductManufacturerModel {
    return this.applyWhereNotIn<V>(column, values)
  }

  static whereNotIn<V = number>(column: keyof ProductManufacturersTable, values: V[]): ProductManufacturerModel {
    const instance = new ProductManufacturerModel(undefined)

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

  static async latest(): Promise<ProductManufacturerModel | undefined> {
    const instance = new ProductManufacturerModel(undefined)

    const model = await DB.instance.selectFrom('product_manufacturers')
      .selectAll()
      .orderBy('id', 'desc')
      .executeTakeFirst()

    if (!model)
      return undefined

    instance.mapCustomGetters(model)

    const data = new ProductManufacturerModel(model)

    return data
  }

  static async oldest(): Promise<ProductManufacturerModel | undefined> {
    const instance = new ProductManufacturerModel(undefined)

    const model = await DB.instance.selectFrom('product_manufacturers')
      .selectAll()
      .orderBy('id', 'asc')
      .executeTakeFirst()

    if (!model)
      return undefined

    instance.mapCustomGetters(model)

    const data = new ProductManufacturerModel(model)

    return data
  }

  static async firstOrCreate(
    condition: Partial<ProductManufacturerJsonResponse>,
    newProductManufacturer: NewProductManufacturer,
  ): Promise<ProductManufacturerModel> {
    const instance = new ProductManufacturerModel(undefined)

    const key = Object.keys(condition)[0] as keyof ProductManufacturerJsonResponse

    if (!key) {
      throw new HttpError(500, 'Condition must contain at least one key-value pair')
    }

    const value = condition[key]

    // Attempt to find the first record matching the condition
    const existingProductManufacturer = await DB.instance.selectFrom('product_manufacturers')
      .selectAll()
      .where(key, '=', value)
      .executeTakeFirst()

    if (existingProductManufacturer) {
      instance.mapCustomGetters(existingProductManufacturer)
      await instance.loadRelations(existingProductManufacturer)

      return new ProductManufacturerModel(existingProductManufacturer as ProductManufacturerJsonResponse)
    }
    else {
      return await instance.create(newProductManufacturer)
    }
  }

  static async updateOrCreate(
    condition: Partial<ProductManufacturerJsonResponse>,
    newProductManufacturer: NewProductManufacturer,
  ): Promise<ProductManufacturerModel> {
    const instance = new ProductManufacturerModel(undefined)

    const key = Object.keys(condition)[0] as keyof ProductManufacturerJsonResponse

    if (!key) {
      throw new HttpError(500, 'Condition must contain at least one key-value pair')
    }

    const value = condition[key]

    // Attempt to find the first record matching the condition
    const existingProductManufacturer = await DB.instance.selectFrom('product_manufacturers')
      .selectAll()
      .where(key, '=', value)
      .executeTakeFirst()

    if (existingProductManufacturer) {
      // If found, update the existing record
      await DB.instance.updateTable('product_manufacturers')
        .set(newProductManufacturer)
        .where(key, '=', value)
        .executeTakeFirstOrThrow()

      // Fetch and return the updated record
      const updatedProductManufacturer = await DB.instance.selectFrom('product_manufacturers')
        .selectAll()
        .where(key, '=', value)
        .executeTakeFirst()

      if (!updatedProductManufacturer) {
        throw new HttpError(500, 'Failed to fetch updated record')
      }

      instance.hasSaved = true

      return new ProductManufacturerModel(updatedProductManufacturer as ProductManufacturerJsonResponse)
    }
    else {
      // If not found, create a new record
      return await instance.create(newProductManufacturer)
    }
  }

  async loadRelations(models: ProductManufacturerJsonResponse | ProductManufacturerJsonResponse[]): Promise<void> {
    // Handle both single model and array of models
    const modelArray = Array.isArray(models) ? models : [models]
    if (!modelArray.length)
      return

    const modelIds = modelArray.map(model => model.id)

    for (const relation of this.withRelations) {
      const relatedRecords = await DB.instance
        .selectFrom(relation)
        .where('productManufacturer_id', 'in', modelIds)
        .selectAll()
        .execute()

      if (Array.isArray(models)) {
        models.map((model: ProductManufacturerJsonResponse) => {
          const records = relatedRecords.filter((record: { productManufacturer_id: number }) => {
            return record.productManufacturer_id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      }
      else {
        const records = relatedRecords.filter((record: { productManufacturer_id: number }) => {
          return record.productManufacturer_id === models.id
        })

        models[relation] = records.length === 1 ? records[0] : records
      }
    }
  }

  with(relations: string[]): ProductManufacturerModel {
    this.withRelations = relations

    return this
  }

  static with(relations: string[]): ProductManufacturerModel {
    const instance = new ProductManufacturerModel(undefined)

    instance.withRelations = relations

    return instance
  }

  async last(): Promise<ProductManufacturerModel | undefined> {
    let model: ProductManufacturerJsonResponse | undefined

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

    const data = new ProductManufacturerModel(model)

    return data
  }

  static async last(): Promise<ProductManufacturerModel | undefined> {
    const model = await DB.instance.selectFrom('product_manufacturers').selectAll().orderBy('id', 'desc').executeTakeFirst()

    if (!model)
      return undefined

    const data = new ProductManufacturerModel(model)

    return data
  }

  orderBy(column: keyof ProductManufacturersTable, order: 'asc' | 'desc'): ProductManufacturerModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, order)

    return this
  }

  static orderBy(column: keyof ProductManufacturersTable, order: 'asc' | 'desc'): ProductManufacturerModel {
    const instance = new ProductManufacturerModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, order)

    return instance
  }

  groupBy(column: keyof ProductManufacturersTable): ProductManufacturerModel {
    this.selectFromQuery = this.selectFromQuery.groupBy(column)

    return this
  }

  static groupBy(column: keyof ProductManufacturersTable): ProductManufacturerModel {
    const instance = new ProductManufacturerModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.groupBy(column)

    return instance
  }

  having<V = string>(column: keyof ProductManufacturersTable, operator: Operator, value: V): ProductManufacturerModel {
    this.selectFromQuery = this.selectFromQuery.having(column, operator, value)

    return this
  }

  static having<V = string>(column: keyof ProductManufacturersTable, operator: Operator, value: V): ProductManufacturerModel {
    const instance = new ProductManufacturerModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.having(column, operator, value)

    return instance
  }

  inRandomOrder(): ProductManufacturerModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(sql` ${sql.raw('RANDOM()')} `)

    return this
  }

  static inRandomOrder(): ProductManufacturerModel {
    const instance = new ProductManufacturerModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(sql` ${sql.raw('RANDOM()')} `)

    return instance
  }

  orderByDesc(column: keyof ProductManufacturersTable): ProductManufacturerModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, 'desc')

    return this
  }

  static orderByDesc(column: keyof ProductManufacturersTable): ProductManufacturerModel {
    const instance = new ProductManufacturerModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'desc')

    return instance
  }

  orderByAsc(column: keyof ProductManufacturersTable): ProductManufacturerModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, 'asc')

    return this
  }

  static orderByAsc(column: keyof ProductManufacturersTable): ProductManufacturerModel {
    const instance = new ProductManufacturerModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'asc')

    return instance
  }

  async update(newProductManufacturer: ProductManufacturerUpdate): Promise<ProductManufacturerModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newProductManufacturer).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewProductManufacturer

    await this.mapCustomSetters(filteredValues)

    await DB.instance.updateTable('product_manufacturers')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      const model = await this.find(this.id)

      if (model)
        dispatch('productManufacturer:updated', model)

      return model
    }

    this.hasSaved = true

    return undefined
  }

  async forceUpdate(productManufacturer: ProductManufacturerUpdate): Promise<ProductManufacturerModel | undefined> {
    if (this.id === undefined) {
      this.updateFromQuery.set(productManufacturer).execute()
    }

    await this.mapCustomSetters(productManufacturer)

    await DB.instance.updateTable('product_manufacturers')
      .set(productManufacturer)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      const model = await this.find(this.id)

      if (model)
        dispatch('productManufacturer:updated', model)

      this.hasSaved = true

      return model
    }

    return undefined
  }

  async save(): Promise<void> {
    if (!this)
      throw new HttpError(500, 'ProductManufacturer data is undefined')

    await this.mapCustomSetters(this.attributes)

    if (this.id === undefined) {
      await this.create(this.attributes)
    }
    else {
      await this.update(this.attributes)
    }

    this.hasSaved = true
  }

  fill(data: Partial<ProductManufacturerJsonResponse>): ProductManufacturerModel {
    const filteredValues = Object.fromEntries(
      Object.entries(data).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewProductManufacturer

    this.attributes = {
      ...this.attributes,
      ...filteredValues,
    }

    return this
  }

  forceFill(data: Partial<ProductManufacturerJsonResponse>): ProductManufacturerModel {
    this.attributes = {
      ...this.attributes,
      ...data,
    }

    return this
  }

  // Method to delete (soft delete) the productManufacturer instance
  async delete(): Promise<ProductManufacturersTable> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()
    const model = await this.find(Number(this.id))
    if (model)
      dispatch('productManufacturer:deleted', model)

    return await DB.instance.deleteFrom('product_manufacturers')
      .where('id', '=', this.id)
      .execute()
  }

  toSearchableObject(): Partial<ProductManufacturerJsonResponse> {
    return {
      id: this.id,
      manufacturer: this.manufacturer,
      description: this.description,
      country: this.country,
      featured: this.featured,
    }
  }

  distinct(column: keyof ProductManufacturerJsonResponse): ProductManufacturerModel {
    this.selectFromQuery = this.selectFromQuery.select(column).distinct()

    this.hasSelect = true

    return this
  }

  static distinct(column: keyof ProductManufacturerJsonResponse): ProductManufacturerModel {
    const instance = new ProductManufacturerModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.select(column).distinct()

    instance.hasSelect = true

    return instance
  }

  join(table: string, firstCol: string, secondCol: string): ProductManufacturerModel {
    this.selectFromQuery = this.selectFromQuery.innerJoin(table, firstCol, secondCol)

    return this
  }

  static join(table: string, firstCol: string, secondCol: string): ProductManufacturerModel {
    const instance = new ProductManufacturerModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.innerJoin(table, firstCol, secondCol)

    return instance
  }

  toJSON(): ProductManufacturerJsonResponse {
    const output = {

      uuid: this.uuid,

      id: this.id,
      manufacturer: this.manufacturer,
      description: this.description,
      country: this.country,
      featured: this.featured,

      created_at: this.created_at,

      updated_at: this.updated_at,

      products: this.products,
      ...this.customColumns,
    }

    return output
  }

  parseResult(model: ProductManufacturerModel): ProductManufacturerModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof ProductManufacturerModel]
    }

    return model
  }
}

async function find(id: number): Promise<ProductManufacturerModel | undefined> {
  const query = DB.instance.selectFrom('product_manufacturers').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  return new ProductManufacturerModel(model)
}

export async function count(): Promise<number> {
  const results = await ProductManufacturerModel.count()

  return results
}

export async function create(newProductManufacturer: NewProductManufacturer): Promise<ProductManufacturerModel> {
  const result = await DB.instance.insertInto('product_manufacturers')
    .values(newProductManufacturer)
    .executeTakeFirstOrThrow()

  return await find(Number(result.numInsertedOrUpdatedRows)) as ProductManufacturerModel
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(DB.instance)
}

export async function remove(id: number): Promise<void> {
  await DB.instance.deleteFrom('product_manufacturers')
    .where('id', '=', id)
    .execute()
}

export async function whereManufacturer(value: string): Promise<ProductManufacturerModel[]> {
  const query = DB.instance.selectFrom('product_manufacturers').where('manufacturer', '=', value)
  const results: ProductManufacturerJsonResponse = await query.execute()

  return results.map((modelItem: ProductManufacturerJsonResponse) => new ProductManufacturerModel(modelItem))
}

export async function whereDescription(value: string): Promise<ProductManufacturerModel[]> {
  const query = DB.instance.selectFrom('product_manufacturers').where('description', '=', value)
  const results: ProductManufacturerJsonResponse = await query.execute()

  return results.map((modelItem: ProductManufacturerJsonResponse) => new ProductManufacturerModel(modelItem))
}

export async function whereCountry(value: string): Promise<ProductManufacturerModel[]> {
  const query = DB.instance.selectFrom('product_manufacturers').where('country', '=', value)
  const results: ProductManufacturerJsonResponse = await query.execute()

  return results.map((modelItem: ProductManufacturerJsonResponse) => new ProductManufacturerModel(modelItem))
}

export async function whereFeatured(value: boolean): Promise<ProductManufacturerModel[]> {
  const query = DB.instance.selectFrom('product_manufacturers').where('featured', '=', value)
  const results: ProductManufacturerJsonResponse = await query.execute()

  return results.map((modelItem: ProductManufacturerJsonResponse) => new ProductManufacturerModel(modelItem))
}

export const ProductManufacturer = ProductManufacturerModel

export default ProductManufacturer
