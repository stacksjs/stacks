import type { Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import { randomUUIDv7 } from 'bun'
import { cache } from '@stacksjs/cache'
import { sql } from '@stacksjs/database'
import { HttpError, ModelNotFoundException } from '@stacksjs/error-handling'
import { dispatch } from '@stacksjs/events'
import { DB, SubqueryBuilder } from '@stacksjs/orm'

export interface ProductsTable {
  id?: number
  name?: string
  description?: number
  key?: number
  unit_price?: number
  status?: string
  image?: string
  provider_id?: string
  uuid?: string

  created_at?: Date

  updated_at?: Date

}

interface ProductResponse {
  data: ProductJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface ProductJsonResponse extends Omit<ProductsTable, 'password'> {
  [key: string]: any
}

export type ProductType = Selectable<ProductsTable>
export type NewProduct = Partial<Insertable<ProductsTable>>
export type ProductUpdate = Updateable<ProductsTable>

      type SortDirection = 'asc' | 'desc'
interface SortOptions { column: ProductType, order: SortDirection }
// Define a type for the options parameter
interface QueryOptions {
  sort?: SortOptions
  limit?: number
  offset?: number
  page?: number
}

export class ProductModel {
  private readonly hidden: Array<keyof ProductJsonResponse> = []
  private readonly fillable: Array<keyof ProductJsonResponse> = ['name', 'description', 'key', 'unit_price', 'status', 'image', 'provider_id', 'uuid']
  private readonly guarded: Array<keyof ProductJsonResponse> = []
  protected attributes: Partial<ProductJsonResponse> = {}
  protected originalAttributes: Partial<ProductJsonResponse> = {}

  protected selectFromQuery: any
  protected withRelations: string[]
  protected updateFromQuery: any
  protected deleteFromQuery: any
  protected hasSelect: boolean
  private hasSaved: boolean
  private customColumns: Record<string, unknown> = {}

  constructor(product: Partial<ProductType> | null) {
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

  mapCustomGetters(models: ProductJsonResponse | ProductJsonResponse[]): void {
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

  async mapCustomSetters(model: ProductJsonResponse): Promise<void> {
    const customSetter = {
      default: () => {
      },

    }

    for (const [key, fn] of Object.entries(customSetter)) {
      model[key] = await fn()
    }
  }

  get id(): number | undefined {
    return this.attributes.id
  }

  get uuid(): string | undefined {
    return this.attributes.uuid
  }

  get name(): string | undefined {
    return this.attributes.name
  }

  get description(): number | undefined {
    return this.attributes.description
  }

  get key(): number | undefined {
    return this.attributes.key
  }

  get unit_price(): number | undefined {
    return this.attributes.unit_price
  }

  get status(): string | undefined {
    return this.attributes.status
  }

  get image(): string | undefined {
    return this.attributes.image
  }

  get provider_id(): string | undefined {
    return this.attributes.provider_id
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

  set description(value: number) {
    this.attributes.description = value
  }

  set key(value: number) {
    this.attributes.key = value
  }

  set unit_price(value: number) {
    this.attributes.unit_price = value
  }

  set status(value: string) {
    this.attributes.status = value
  }

  set image(value: string) {
    this.attributes.image = value
  }

  set provider_id(value: string) {
    this.attributes.provider_id = value
  }

  set updated_at(value: Date) {
    this.attributes.updated_at = value
  }

  getOriginal(column?: keyof ProductType): Partial<ProductType> {
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

  isDirty(column?: keyof ProductType): boolean {
    if (column) {
      return this.attributes[column] !== this.originalAttributes[column]
    }

    return Object.entries(this.originalAttributes).some(([key, originalValue]) => {
      const currentValue = (this.attributes as any)[key]

      return currentValue !== originalValue
    })
  }

  isClean(column?: keyof ProductType): boolean {
    return !this.isDirty(column)
  }

  wasChanged(column?: keyof ProductType): boolean {
    return this.hasSaved && this.isDirty(column)
  }

  select(params: (keyof ProductType)[] | RawBuilder<string> | string): ProductModel {
    this.selectFromQuery = this.selectFromQuery.select(params)

    this.hasSelect = true

    return this
  }

  static select(params: (keyof ProductType)[] | RawBuilder<string> | string): ProductModel {
    const instance = new ProductModel(null)

    // Initialize a query with the table name and selected fields
    instance.selectFromQuery = instance.selectFromQuery.select(params)

    instance.hasSelect = true

    return instance
  }

  async applyFind(id: number): Promise<ProductModel | undefined> {
    const model = await DB.instance.selectFrom('products').where('id', '=', id).selectAll().executeTakeFirst()

    if (!model)
      return undefined

    this.mapCustomGetters(model)
    await this.loadRelations(model)

    const data = new ProductModel(model as ProductType)

    cache.getOrSet(`product:${id}`, JSON.stringify(model))

    return data
  }

  async find(id: number): Promise<ProductModel | undefined> {
    return await this.applyFind(id)
  }

  // Method to find a Product by ID
  static async find(id: number): Promise<ProductModel | undefined> {
    const instance = new ProductModel(null)

    return await instance.applyFind(id)
  }

  async first(): Promise<ProductModel | undefined> {
    let model: ProductModel | undefined

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

    const data = new ProductModel(model as ProductType)

    return data
  }

  static async first(): Promise<ProductModel | undefined> {
    const instance = new ProductModel(null)

    const model = await DB.instance.selectFrom('products')
      .selectAll()
      .executeTakeFirst()

    instance.mapCustomGetters(model)

    const data = new ProductModel(model as ProductType)

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

    const data = new ProductModel(model as ProductType)

    return data
  }

  async firstOrFail(): Promise<ProductModel | undefined> {
    return await this.applyFirstOrFail()
  }

  static async firstOrFail(): Promise<ProductModel | undefined> {
    const instance = new ProductModel(null)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<ProductModel[]> {
    const instance = new ProductModel(null)

    const models = await DB.instance.selectFrom('products').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: ProductType) => {
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

    const data = new ProductModel(model as ProductType)

    return data
  }

  async findOrFail(id: number): Promise<ProductModel> {
    return await this.applyFindOrFail(id)
  }

  static async findOrFail(id: number): Promise<ProductModel> {
    const instance = new ProductModel(null)

    return await instance.applyFindOrFail(id)
  }

  async applyFindMany(ids: number[]): Promise<ProductModel[]> {
    let query = DB.instance.selectFrom('products').where('id', 'in', ids)

    const instance = new ProductModel(null)

    query = query.selectAll()

    const models = await query.execute()

    instance.mapCustomGetters(models)
    await instance.loadRelations(models)

    return models.map((modelItem: ProductModel) => instance.parseResult(new ProductModel(modelItem)))
  }

  static async findMany(ids: number[]): Promise<ProductModel[]> {
    const instance = new ProductModel(null)

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
    const instance = new ProductModel(null)

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
    const instance = new ProductModel(null)

    await instance.applyChunk(size, callback)
  }

  take(count: number): ProductModel {
    this.selectFromQuery = this.selectFromQuery.limit(count)

    return this
  }

  static take(count: number): ProductModel {
    const instance = new ProductModel(null)

    instance.selectFromQuery = instance.selectFromQuery.limit(count)

    return instance
  }

  static async pluck<K extends keyof ProductModel>(field: K): Promise<ProductModel[K][]> {
    const instance = new ProductModel(null)

    if (instance.hasSelect) {
      const model = await instance.selectFromQuery.execute()
      return model.map((modelItem: ProductModel) => modelItem[field])
    }

    const model = await instance.selectFromQuery.selectAll().execute()

    return model.map((modelItem: ProductModel) => modelItem[field])
  }

  async pluck<K extends keyof ProductModel>(field: K): Promise<ProductModel[K][]> {
    return ProductModel.pluck(field)
  }

  static async count(): Promise<number> {
    const instance = new ProductModel(null)

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
    const instance = new ProductModel(null)

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
    const instance = new ProductModel(null)

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
    const instance = new ProductModel(null)

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
    const instance = new ProductModel(null)

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

    const data = await Promise.all(models.map(async (model: ProductModel) => {
      return new ProductModel(model)
    }))

    return data
  }

  async get(): Promise<ProductModel[]> {
    return await this.applyGet()
  }

  static async get(): Promise<ProductModel[]> {
    const instance = new ProductModel(null)

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
    const instance = new ProductModel(null)

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
    const instance = new ProductModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(callback({ exists, selectFrom })),
    )

    return instance
  }

  applyWhereHas(
    relation: string,
    callback: (query: SubqueryBuilder) => void,
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
              if (condition.operator === 'not') {
                subquery = subquery.whereNotIn(condition.column, condition.values!)
              }
              else {
                subquery = subquery.whereIn(condition.column, condition.values!)
              }

              break

            case 'whereNull':
              subquery = subquery.whereNull(condition.column)
              break

            case 'whereNotNull':
              subquery = subquery.whereNotNull(condition.column)
              break

            case 'whereBetween':
              subquery = subquery.whereBetween(condition.column, condition.values!)
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
    callback: (query: SubqueryBuilder) => void,
  ): ProductModel {
    return this.applyWhereHas(relation, callback)
  }

  static whereHas(
    relation: string,
    callback: (query: SubqueryBuilder) => void,
  ): ProductModel {
    const instance = new ProductModel(null)

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
    const instance = new ProductModel(null)

    return instance.doesntHave(relation)
  }

  applyWhereDoesntHave(relation: string, callback: (query: SubqueryBuilder) => void): ProductModel {
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    this.selectFromQuery = this.selectFromQuery
      .where(({ exists, selectFrom, not }: any) => {
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
              if (condition.operator === 'not') {
                subquery = subquery.whereNotIn(condition.column, condition.values!)
              }
              else {
                subquery = subquery.whereIn(condition.column, condition.values!)
              }

              break

            case 'whereNull':
              subquery = subquery.whereNull(condition.column)
              break

            case 'whereNotNull':
              subquery = subquery.whereNotNull(condition.column)
              break

            case 'whereBetween':
              subquery = subquery.whereBetween(condition.column, condition.values!)
              break

            case 'whereExists': {
              const nestedBuilder = new SubqueryBuilder()
              condition.callback!(nestedBuilder)
              break
            }
          }
        })

        return not(exists(subquery))
      })

    return this
  }

  whereDoesntHave(relation: string, callback: (query: SubqueryBuilder) => void): ProductModel {
    return this.applyWhereDoesntHave(relation, callback)
  }

  static whereDoesntHave(
    relation: string,
    callback: (query: SubqueryBuilder) => void,
  ): ProductModel {
    const instance = new ProductModel(null)

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
    const instance = new ProductModel(null)

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
    const instance = new ProductModel(null)

    return await instance.applyCreate(newProduct)
  }

  static async createMany(newProduct: NewProduct[]): Promise<void> {
    const instance = new ProductModel(null)

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

    return model
  }

  // Method to remove a Product
  static async remove(id: number): Promise<any> {
    return await DB.instance.deleteFrom('products')
      .where('id', '=', id)
      .execute()
  }

  applyWhere(instance: ProductModel, column: string, ...args: any[]): ProductModel {
    const [operatorOrValue, value] = args
    const operator = value === undefined ? '=' : operatorOrValue
    const actualValue = value === undefined ? operatorOrValue : value

    instance.selectFromQuery = instance.selectFromQuery.where(column, operator, actualValue)
    instance.updateFromQuery = instance.updateFromQuery.where(column, operator, actualValue)
    instance.deleteFromQuery = instance.deleteFromQuery.where(column, operator, actualValue)

    return instance
  }

  where(column: string, ...args: any[]): ProductModel {
    return this.applyWhere(this, column, ...args)
  }

  static where(column: string, ...args: any[]): ProductModel {
    const instance = new ProductModel(null)

    return instance.applyWhere(instance, column, ...args)
  }

  whereColumn(first: string, operator: string, second: string): ProductModel {
    this.selectFromQuery = this.selectFromQuery.whereRef(first, operator, second)

    return this
  }

  static whereColumn(first: string, operator: string, second: string): ProductModel {
    const instance = new ProductModel(null)

    instance.selectFromQuery = instance.selectFromQuery.whereRef(first, operator, second)

    return instance
  }

  applyWhereRef(column: string, ...args: string[]): ProductModel {
    const [operatorOrValue, value] = args
    const operator = value === undefined ? '=' : operatorOrValue
    const actualValue = value === undefined ? operatorOrValue : value

    const instance = new ProductModel(null)
    instance.selectFromQuery = instance.selectFromQuery.whereRef(column, operator, actualValue)

    return instance
  }

  whereRef(column: string, ...args: string[]): ProductModel {
    return this.applyWhereRef(column, ...args)
  }

  static whereRef(column: string, ...args: string[]): ProductModel {
    const instance = new ProductModel(null)

    return instance.applyWhereRef(column, ...args)
  }

  whereRaw(sqlStatement: string): ProductModel {
    this.selectFromQuery = this.selectFromQuery.where(sql`${sqlStatement}`)

    return this
  }

  static whereRaw(sqlStatement: string): ProductModel {
    const instance = new ProductModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(sql`${sqlStatement}`)

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
    const instance = new ProductModel(null)

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
    let instance = new ProductModel(null)

    if (condition)
      instance = callback(instance)

    return instance
  }

  whereNull(column: string): ProductModel {
    return ProductModel.whereNull(column)
  }

  static whereNull(column: string): ProductModel {
    const instance = new ProductModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    instance.updateFromQuery = instance.updateFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    return instance
  }

  static whereName(value: string): ProductModel {
    const instance = new ProductModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('name', '=', value)

    return instance
  }

  static whereDescription(value: string): ProductModel {
    const instance = new ProductModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('description', '=', value)

    return instance
  }

  static whereKey(value: string): ProductModel {
    const instance = new ProductModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('key', '=', value)

    return instance
  }

  static whereUnitPrice(value: string): ProductModel {
    const instance = new ProductModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('unitPrice', '=', value)

    return instance
  }

  static whereStatus(value: string): ProductModel {
    const instance = new ProductModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('status', '=', value)

    return instance
  }

  static whereImage(value: string): ProductModel {
    const instance = new ProductModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('image', '=', value)

    return instance
  }

  static whereProviderId(value: string): ProductModel {
    const instance = new ProductModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('providerId', '=', value)

    return instance
  }

  whereIn(column: keyof ProductType, values: any[]): ProductModel {
    return ProductModel.whereIn(column, values)
  }

  static whereIn(column: keyof ProductType, values: any[]): ProductModel {
    const instance = new ProductModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(column, 'in', values)

    instance.updateFromQuery = instance.updateFromQuery.where(column, 'in', values)

    instance.deleteFromQuery = instance.deleteFromQuery.where(column, 'in', values)

    return instance
  }

  applyWhereBetween(column: keyof ProductType, range: [any, any]): ProductModel {
    if (range.length !== 2) {
      throw new HttpError(500, 'Range must have exactly two values: [min, max]')
    }

    const query = sql` ${sql.raw(column as string)} between ${range[0]} and ${range[1]} `

    this.selectFromQuery = this.selectFromQuery.where(query)
    this.updateFromQuery = this.updateFromQuery.where(query)
    this.deleteFromQuery = this.deleteFromQuery.where(query)

    return this
  }

  whereBetween(column: keyof ProductType, range: [any, any]): ProductModel {
    return this.applyWhereBetween(column, range)
  }

  static whereBetween(column: keyof ProductType, range: [any, any]): ProductModel {
    const instance = new ProductModel(null)

    return instance.applyWhereBetween(column, range)
  }

  applyWhereLike(column: keyof ProductType, value: string): ProductModel {
    this.selectFromQuery = this.selectFromQuery.where(sql` ${sql.raw(column as string)} LIKE ${value}`)

    this.updateFromQuery = this.updateFromQuery.where(sql` ${sql.raw(column as string)} LIKE ${value}`)

    this.deleteFromQuery = this.deleteFromQuery.where(sql` ${sql.raw(column as string)} LIKE ${value}`)

    return this
  }

  whereLike(column: keyof ProductType, value: string): ProductModel {
    return this.applyWhereLike(column, value)
  }

  static whereLike(column: keyof ProductType, value: string): ProductModel {
    const instance = new ProductModel(null)

    return instance.applyWhereLike(column, value)
  }

  applyWhereNotIn(column: keyof ProductType, values: any[]): ProductModel {
    this.selectFromQuery = this.selectFromQuery.where(column, 'not in', values)

    this.updateFromQuery = this.updateFromQuery.where(column, 'not in', values)

    this.deleteFromQuery = this.deleteFromQuery.where(column, 'not in', values)

    return this
  }

  whereNotIn(column: keyof ProductType, values: any[]): ProductModel {
    return this.applyWhereNotIn(column, values)
  }

  static whereNotIn(column: keyof ProductType, values: any[]): ProductModel {
    const instance = new ProductModel(null)

    return instance.applyWhereNotIn(column, values)
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

  static async latest(): Promise<ProductType | undefined> {
    const instance = new ProductModel(null)

    const model = await DB.instance.selectFrom('products')
      .selectAll()
      .orderBy('id', 'desc')
      .executeTakeFirst()

    if (!model)
      return undefined

    instance.mapCustomGetters(model)

    const data = new ProductModel(model as ProductType)

    return data
  }

  static async oldest(): Promise<ProductType | undefined> {
    const instance = new ProductModel(null)

    const model = await DB.instance.selectFrom('products')
      .selectAll()
      .orderBy('id', 'asc')
      .executeTakeFirst()

    if (!model)
      return undefined

    instance.mapCustomGetters(model)

    const data = new ProductModel(model as ProductType)

    return data
  }

  static async firstOrCreate(
    condition: Partial<ProductType>,
    newProduct: NewProduct,
  ): Promise<ProductModel> {
    const instance = new ProductModel(null)

    const key = Object.keys(condition)[0] as keyof ProductType

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

      return new ProductModel(existingProduct as ProductType)
    }
    else {
      return await instance.create(newProduct)
    }
  }

  static async updateOrCreate(
    condition: Partial<ProductType>,
    newProduct: NewProduct,
  ): Promise<ProductModel> {
    const instance = new ProductModel(null)

    const key = Object.keys(condition)[0] as keyof ProductType

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

      return new ProductModel(updatedProduct as ProductType)
    }
    else {
      // If not found, create a new record
      return await instance.create(newProduct)
    }
  }

  async loadRelations(models: ProductJsonResponse | ProductJsonResponse[]): Promise<void> {
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
    const instance = new ProductModel(null)

    instance.withRelations = relations

    return instance
  }

  async last(): Promise<ProductType | undefined> {
    let model: ProductModel | undefined

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

    const data = new ProductModel(model as ProductType)

    return data
  }

  static async last(): Promise<ProductType | undefined> {
    const model = await DB.instance.selectFrom('products').selectAll().orderBy('id', 'desc').executeTakeFirst()

    if (!model)
      return undefined

    const data = new ProductModel(model as ProductType)

    return data
  }

  orderBy(column: keyof ProductType, order: 'asc' | 'desc'): ProductModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, order)

    return this
  }

  static orderBy(column: keyof ProductType, order: 'asc' | 'desc'): ProductModel {
    const instance = new ProductModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, order)

    return instance
  }

  groupBy(column: keyof ProductType): ProductModel {
    this.selectFromQuery = this.selectFromQuery.groupBy(column)

    return this
  }

  static groupBy(column: keyof ProductType): ProductModel {
    const instance = new ProductModel(null)

    instance.selectFromQuery = instance.selectFromQuery.groupBy(column)

    return instance
  }

  having(column: keyof ProductType, operator: string, value: any): ProductModel {
    this.selectFromQuery = this.selectFromQuery.having(column, operator, value)

    return this
  }

  static having(column: keyof ProductType, operator: string, value: any): ProductModel {
    const instance = new ProductModel(null)

    instance.selectFromQuery = instance.selectFromQuery.having(column, operator, value)

    return instance
  }

  inRandomOrder(): ProductModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(sql` ${sql.raw('RANDOM()')} `)

    return this
  }

  static inRandomOrder(): ProductModel {
    const instance = new ProductModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(sql` ${sql.raw('RANDOM()')} `)

    return instance
  }

  orderByDesc(column: keyof ProductType): ProductModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, 'desc')

    return this
  }

  static orderByDesc(column: keyof ProductType): ProductModel {
    const instance = new ProductModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'desc')

    return instance
  }

  orderByAsc(column: keyof ProductType): ProductModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, 'asc')

    return this
  }

  static orderByAsc(column: keyof ProductType): ProductModel {
    const instance = new ProductModel(null)

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

      this.hasSaved = true

      return model
    }

    return undefined
  }

  async save(): Promise<void> {
    if (!this)
      throw new HttpError(500, 'Product data is undefined')

    const filteredValues = Object.fromEntries(
      Object.entries(this.attributes).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewProduct

    await this.mapCustomSetters(filteredValues)

    if (this.id === undefined) {
      await DB.instance.insertInto('products')
        .values(filteredValues)
        .executeTakeFirstOrThrow()
    }
    else {
      await this.update(this.attributes)
    }

    this.hasSaved = true
  }

  fill(data: Partial<ProductType>): ProductModel {
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

  forceFill(data: Partial<ProductType>): ProductModel {
    this.attributes = {
      ...this.attributes,
      ...data,
    }

    return this
  }

  // Method to delete (soft delete) the product instance
  async delete(): Promise<any> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()

    return await DB.instance.deleteFrom('products')
      .where('id', '=', this.id)
      .execute()
  }

  distinct(column: keyof ProductType): ProductModel {
    this.selectFromQuery = this.selectFromQuery.select(column).distinct()

    this.hasSelect = true

    return this
  }

  static distinct(column: keyof ProductType): ProductModel {
    const instance = new ProductModel(null)

    instance.selectFromQuery = instance.selectFromQuery.select(column).distinct()

    instance.hasSelect = true

    return instance
  }

  join(table: string, firstCol: string, secondCol: string): ProductModel {
    this.selectFromQuery = this.selectFromQuery.innerJoin(table, firstCol, secondCol)

    return this
  }

  static join(table: string, firstCol: string, secondCol: string): ProductModel {
    const instance = new ProductModel(null)

    instance.selectFromQuery = instance.selectFromQuery.innerJoin(table, firstCol, secondCol)

    return instance
  }

  toJSON(): Partial<ProductJsonResponse> {
    const output: Partial<ProductJsonResponse> = {

      id: this.id,
      name: this.name,
      description: this.description,
      key: this.key,
      unit_price: this.unit_price,
      status: this.status,
      image: this.image,
      provider_id: this.provider_id,

      created_at: this.created_at,

      updated_at: this.updated_at,

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
  const results = await query.execute()

  return results.map((modelItem: ProductModel) => new ProductModel(modelItem))
}

export async function whereDescription(value: number): Promise<ProductModel[]> {
  const query = DB.instance.selectFrom('products').where('description', '=', value)
  const results = await query.execute()

  return results.map((modelItem: ProductModel) => new ProductModel(modelItem))
}

export async function whereKey(value: number): Promise<ProductModel[]> {
  const query = DB.instance.selectFrom('products').where('key', '=', value)
  const results = await query.execute()

  return results.map((modelItem: ProductModel) => new ProductModel(modelItem))
}

export async function whereUnitPrice(value: number): Promise<ProductModel[]> {
  const query = DB.instance.selectFrom('products').where('unit_price', '=', value)
  const results = await query.execute()

  return results.map((modelItem: ProductModel) => new ProductModel(modelItem))
}

export async function whereStatus(value: string): Promise<ProductModel[]> {
  const query = DB.instance.selectFrom('products').where('status', '=', value)
  const results = await query.execute()

  return results.map((modelItem: ProductModel) => new ProductModel(modelItem))
}

export async function whereImage(value: string): Promise<ProductModel[]> {
  const query = DB.instance.selectFrom('products').where('image', '=', value)
  const results = await query.execute()

  return results.map((modelItem: ProductModel) => new ProductModel(modelItem))
}

export async function whereProviderId(value: string): Promise<ProductModel[]> {
  const query = DB.instance.selectFrom('products').where('provider_id', '=', value)
  const results = await query.execute()

  return results.map((modelItem: ProductModel) => new ProductModel(modelItem))
}

export const Product = ProductModel

export default Product
