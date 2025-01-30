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

  protected selectFromQuery: any
  protected withRelations: string[]
  protected updateFromQuery: any
  protected deleteFromQuery: any
  protected hasSelect: boolean
  private customColumns: Record<string, unknown> = {}
  public id: number | undefined
  public uuid: string | undefined
  public name: string | undefined
  public description: number | undefined
  public key: number | undefined
  public unit_price: number | undefined
  public status: string | undefined
  public image: string | undefined
  public provider_id: string | undefined

  public created_at: Date | undefined
  public updated_at: Date | undefined

  constructor(product: Partial<ProductType> | null) {
    if (product) {
      this.id = product?.id || 1
      this.uuid = product?.uuid
      this.name = product?.name
      this.description = product?.description
      this.key = product?.key
      this.unit_price = product?.unit_price
      this.status = product?.status
      this.image = product?.image
      this.provider_id = product?.provider_id

      this.created_at = product?.created_at

      this.updated_at = product?.updated_at

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
  }

  select(params: (keyof ProductType)[] | RawBuilder<string> | string): ProductModel {
    return ProductModel.select(params)
  }

  static select(params: (keyof ProductType)[] | RawBuilder<string> | string): ProductModel {
    const instance = new ProductModel(null)

    // Initialize a query with the table name and selected fields
    instance.selectFromQuery = instance.selectFromQuery.select(params)

    instance.hasSelect = true

    return instance
  }

  async find(id: number): Promise<ProductModel | undefined> {
    return await ProductModel.find(id)
  }

  // Method to find a Product by ID
  static async find(id: number): Promise<ProductModel | undefined> {
    const model = await DB.instance.selectFrom('products').where('id', '=', id).selectAll().executeTakeFirst()

    if (!model)
      return undefined

    const instance = new ProductModel(null)

    const result = await instance.mapWith(model)

    const data = new ProductModel(result as ProductType)

    cache.getOrSet(`product:${id}`, JSON.stringify(model))

    return data
  }

  async first(): Promise<ProductModel | undefined> {
    return await ProductModel.first()
  }

  static async first(): Promise<ProductModel | undefined> {
    const model = await DB.instance.selectFrom('products')
      .selectAll()
      .executeTakeFirst()

    if (!model)
      return undefined

    const instance = new ProductModel(null)

    const result = await instance.mapWith(model)

    const data = new ProductModel(result as ProductType)

    return data
  }

  async firstOrFail(): Promise<ProductModel | undefined> {
    return await ProductModel.firstOrFail()
  }

  static async firstOrFail(): Promise<ProductModel | undefined> {
    const instance = new ProductModel(null)

    const model = await instance.selectFromQuery.executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, 'No ProductModel results found for query')

    const result = await instance.mapWith(model)

    const data = new ProductModel(result as ProductType)

    return data
  }

  async mapWith(model: ProductType): Promise<ProductType> {
    return model
  }

  static async all(): Promise<ProductModel[]> {
    const models = await DB.instance.selectFrom('products').selectAll().execute()

    const data = await Promise.all(models.map(async (model: ProductType) => {
      const instance = new ProductModel(model)

      const results = await instance.mapWith(model)

      return new ProductModel(results)
    }))

    return data
  }

  async findOrFail(id: number): Promise<ProductModel> {
    return await ProductModel.findOrFail(id)
  }

  static async findOrFail(id: number): Promise<ProductModel> {
    const model = await DB.instance.selectFrom('products').where('id', '=', id).selectAll().executeTakeFirst()

    const instance = new ProductModel(null)

    if (model === undefined)
      throw new ModelNotFoundException(404, `No ProductModel results for ${id}`)

    cache.getOrSet(`product:${id}`, JSON.stringify(model))

    const result = await instance.mapWith(model)

    const data = new ProductModel(result as ProductType)

    return data
  }

  static async findMany(ids: number[]): Promise<ProductModel[]> {
    let query = DB.instance.selectFrom('products').where('id', 'in', ids)

    const instance = new ProductModel(null)

    query = query.selectAll()

    const model = await query.execute()

    return model.map(modelItem => instance.parseResult(new ProductModel(modelItem)))
  }

  skip(count: number): ProductModel {
    return ProductModel.skip(count)
  }

  static skip(count: number): ProductModel {
    const instance = new ProductModel(null)

    instance.selectFromQuery = instance.selectFromQuery.offset(count)

    return instance
  }

  take(count: number): ProductModel {
    return ProductModel.take(count)
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

    return instance.selectFromQuery
      .select(sql`COUNT(*) as count`)
      .executeTakeFirst()
  }

  async count(): Promise<number> {
    return ProductModel.count()
  }

  async max(field: keyof ProductModel): Promise<number> {
    return await this.selectFromQuery
      .select(sql`MAX(${sql.raw(field as string)}) `)
      .executeTakeFirst()
  }

  async min(field: keyof ProductModel): Promise<number> {
    return await this.selectFromQuery
      .select(sql`MIN(${sql.raw(field as string)}) `)
      .executeTakeFirst()
  }

  async avg(field: keyof ProductModel): Promise<number> {
    return this.selectFromQuery
      .select(sql`AVG(${sql.raw(field as string)})`)
      .executeTakeFirst()
  }

  async sum(field: keyof ProductModel): Promise<number> {
    return this.selectFromQuery
      .select(sql`SUM(${sql.raw(field as string)})`)
      .executeTakeFirst()
  }

  async get(): Promise<ProductModel[]> {
    return ProductModel.get()
  }

  static async get(): Promise<ProductModel[]> {
    const instance = new ProductModel(null)

    let models

    if (instance.hasSelect) {
      models = await instance.selectFromQuery.execute()
    }
    else {
      models = await instance.selectFromQuery.selectAll().execute()
    }

    const data = await Promise.all(models.map(async (model: ProductModel) => {
      const instance = new ProductModel(model)

      const results = await instance.mapWith(model)

      return new ProductModel(results)
    }))

    return data
  }

  has(relation: string): ProductModel {
    return ProductModel.has(relation)
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

  whereHas(
    relation: string,
    callback: (query: SubqueryBuilder) => void,
  ): ProductModel {
    return ProductModel.whereHas(relation, callback)
  }

  static whereHas(
    relation: string,
    callback: (query: SubqueryBuilder) => void,
  ): ProductModel {
    const instance = new ProductModel(null)
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    instance.selectFromQuery = instance.selectFromQuery
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

    return instance
  }

  doesntHave(relation: string): ProductModel {
    return ProductModel.doesntHave(relation)
  }

  static doesntHave(relation: string): ProductModel {
    const instance = new ProductModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(({ not, exists, selectFrom }: any) =>
      not(
        exists(
          selectFrom(relation)
            .select('1')
            .whereRef(`${relation}.product_id`, '=', 'products.id'),
        ),
      ),
    )

    return instance
  }

  whereDoesntHave(relation: string, callback: (query: SubqueryBuilder) => void): ProductModel {
    return ProductModel.whereDoesntHave(relation, callback)
  }

  static whereDoesntHave(
    relation: string,
    callback: (query: SubqueryBuilder) => void,
  ): ProductModel {
    const instance = new ProductModel(null)
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    instance.selectFromQuery = instance.selectFromQuery
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

    return instance
  }

  async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<ProductResponse> {
    return ProductModel.paginate(options)
  }

  // Method to get all products
  static async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<ProductResponse> {
    const totalRecordsResult = await DB.instance.selectFrom('products')
      .select(db.fn.count('id').as('total')) // Use 'id' or another actual column name
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

  static async create(newProduct: NewProduct): Promise<ProductModel> {
    const instance = new ProductModel(null)

    const filteredValues = Object.fromEntries(
      Object.entries(newProduct).filter(([key]) =>
        !instance.guarded.includes(key) && instance.fillable.includes(key),
      ),
    ) as NewProduct

    filteredValues.uuid = randomUUIDv7()

    const result = await DB.instance.insertInto('products')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await instance.find(Number(result.numInsertedOrUpdatedRows)) as ProductModel

    if (model)
      dispatch('Products:created', model)

    return model
  }

  static async createMany(newProduct: NewProduct[]): Promise<void> {
    const instance = new ProductModel(null)

    const filteredValues = newProduct.map((newProduct: NewProduct) => {
      const filtered = Object.fromEntries(
        Object.entries(newProduct).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewProduct

      filtered.uuid = randomUUIDv7()
      return filtered
    })

    await DB.instance.insertInto('products')
      .values(filteredValues)
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

  private static applyWhere(instance: ProductModel, column: string, operator: string, value: any): ProductModel {
    instance.selectFromQuery = instance.selectFromQuery.where(column, operator, value)
    instance.updateFromQuery = instance.updateFromQuery.where(column, operator, value)
    instance.deleteFromQuery = instance.deleteFromQuery.where(column, operator, value)

    return instance
  }

  where(column: string, operator: string, value: any): ProductModel {
    return ProductModel.applyWhere(this, column, operator, value)
  }

  static where(column: string, operator: string, value: any): ProductModel {
    const instance = new ProductModel(null)

    return ProductModel.applyWhere(instance, column, operator, value)
  }

  whereRef(column: string, operator: string, value: string): ProductModel {
    return ProductModel.whereRef(column, operator, value)
  }

  static whereRef(column: string, operator: string, value: string): ProductModel {
    const instance = new ProductModel(null)

    instance.selectFromQuery = instance.selectFromQuery.whereRef(column, operator, value)

    return instance
  }

  orWhere(...args: Array<[string, string, any]>): ProductModel {
    return ProductModel.orWhere(...args)
  }

  static orWhere(...args: Array<[string, string, any]>): ProductModel {
    const instance = new ProductModel(null)

    if (args.length === 0) {
      throw new HttpError(500, 'At least one condition must be provided')
    }

    // Use the expression builder to append the OR conditions
    instance.selectFromQuery = instance.selectFromQuery.where((eb: any) =>
      eb.or(
        args.map(([column, operator, value]) => eb(column, operator, value)),
      ),
    )

    instance.updateFromQuery = instance.updateFromQuery.where((eb: any) =>
      eb.or(
        args.map(([column, operator, value]) => eb(column, operator, value)),
      ),
    )

    instance.deleteFromQuery = instance.deleteFromQuery.where((eb: any) =>
      eb.or(
        args.map(([column, operator, value]) => eb(column, operator, value)),
      ),
    )

    return instance
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

  whereBetween(column: keyof ProductType, range: [any, any]): ProductModel {
    return ProductModel.whereBetween(column, range)
  }

  static whereBetween(column: keyof ProductType, range: [any, any]): ProductModel {
    if (range.length !== 2) {
      throw new HttpError(500, 'Range must have exactly two values: [min, max]')
    }

    const instance = new ProductModel(null)

    const query = sql` ${sql.raw(column as string)} between ${range[0]} and ${range[1]} `

    instance.selectFromQuery = instance.selectFromQuery.where(query)
    instance.updateFromQuery = instance.updateFromQuery.where(query)
    instance.deleteFromQuery = instance.deleteFromQuery.where(query)

    return instance
  }

  whereNotIn(column: keyof ProductType, values: any[]): ProductModel {
    return ProductModel.whereNotIn(column, values)
  }

  static whereNotIn(column: keyof ProductType, values: any[]): ProductModel {
    const instance = new ProductModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(column, 'not in', values)

    instance.updateFromQuery = instance.updateFromQuery.where(column, 'not in', values)

    instance.deleteFromQuery = instance.deleteFromQuery.where(column, 'not in', values)

    return instance
  }

  async exists(): Promise<boolean> {
    const model = await this.selectFromQuery.executeTakeFirst()

    return model !== null || model !== undefined
  }

  static async latest(): Promise<ProductType | undefined> {
    const model = await DB.instance.selectFrom('products')
      .selectAll()
      .orderBy('created_at', 'desc')
      .executeTakeFirst()

    if (!model)
      return undefined

    const instance = new ProductModel(null)
    const result = await instance.mapWith(model)
    const data = new ProductModel(result as ProductType)

    return data
  }

  static async oldest(): Promise<ProductType | undefined> {
    const model = await DB.instance.selectFrom('products')
      .selectAll()
      .orderBy('created_at', 'asc')
      .executeTakeFirst()

    if (!model)
      return undefined

    const instance = new ProductModel(null)
    const result = await instance.mapWith(model)
    const data = new ProductModel(result as ProductType)

    return data
  }

  static async firstOrCreate(
    condition: Partial<ProductType>,
    newProduct: NewProduct,
  ): Promise<ProductModel> {
    // Get the key and value from the condition object
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
      const instance = new ProductModel(null)
      const result = await instance.mapWith(existingProduct)
      return new ProductModel(result as ProductType)
    }
    else {
      return await this.create(newProduct)
    }
  }

  static async updateOrCreate(
    condition: Partial<ProductType>,
    newProduct: NewProduct,
  ): Promise<ProductModel> {
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
      await db.updateTable('products')
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

      const instance = new ProductModel(null)
      const result = await instance.mapWith(updatedProduct)
      return new ProductModel(result as ProductType)
    }
    else {
      // If not found, create a new record
      return await this.create(newProduct)
    }
  }

  with(relations: string[]): ProductModel {
    return ProductModel.with(relations)
  }

  static with(relations: string[]): ProductModel {
    const instance = new ProductModel(null)

    instance.withRelations = relations

    return instance
  }

  async last(): Promise<ProductType | undefined> {
    return await DB.instance.selectFrom('products')
      .selectAll()
      .orderBy('id', 'desc')
      .executeTakeFirst()
  }

  static async last(): Promise<ProductType | undefined> {
    const model = await DB.instance.selectFrom('products').selectAll().orderBy('id', 'desc').executeTakeFirst()

    if (!model)
      return undefined

    const instance = new ProductModel(null)

    const result = await instance.mapWith(model)

    const data = new ProductModel(result as ProductType)

    return data
  }

  orderBy(column: keyof ProductType, order: 'asc' | 'desc'): ProductModel {
    return ProductModel.orderBy(column, order)
  }

  static orderBy(column: keyof ProductType, order: 'asc' | 'desc'): ProductModel {
    const instance = new ProductModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, order)

    return instance
  }

  groupBy(column: keyof ProductType): ProductModel {
    return ProductModel.groupBy(column)
  }

  static groupBy(column: keyof ProductType): ProductModel {
    const instance = new ProductModel(null)

    instance.selectFromQuery = instance.selectFromQuery.groupBy(column)

    return instance
  }

  having(column: keyof ProductType, operator: string, value: any): ProductModel {
    return ProductModel.having(column, operator, value)
  }

  static having(column: keyof ProductType, operator: string, value: any): ProductModel {
    const instance = new ProductModel(null)

    instance.selectFromQuery = instance.selectFromQuery.having(column, operator, value)

    return instance
  }

  inRandomOrder(): ProductModel {
    return ProductModel.inRandomOrder()
  }

  static inRandomOrder(): ProductModel {
    const instance = new ProductModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(sql` ${sql.raw('RANDOM()')} `)

    return instance
  }

  orderByDesc(column: keyof ProductType): ProductModel {
    return ProductModel.orderByDesc(column)
  }

  static orderByDesc(column: keyof ProductType): ProductModel {
    const instance = new ProductModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'desc')

    return instance
  }

  orderByAsc(column: keyof ProductType): ProductModel {
    return ProductModel.orderByAsc(column)
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

    await db.updateTable('products')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      const model = await this.find(this.id)

      return model
    }

    return undefined
  }

  async forceUpdate(product: ProductUpdate): Promise<ProductModel | undefined> {
    if (this.id === undefined) {
      this.updateFromQuery.set(product).execute()
    }

    await db.updateTable('products')
      .set(product)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      const model = await this.find(this.id)

      return model
    }

    return undefined
  }

  async save(): Promise<void> {
    if (!this)
      throw new HttpError(500, 'Product data is undefined')

    if (this.id === undefined) {
      await DB.instance.insertInto('products')
        .values(this as NewProduct)
        .executeTakeFirstOrThrow()
    }
    else {
      await this.update(this)
    }
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
    return ProductModel.distinct(column)
  }

  static distinct(column: keyof ProductType): ProductModel {
    const instance = new ProductModel(null)

    instance.selectFromQuery = instance.selectFromQuery.select(column).distinct()

    instance.hasSelect = true

    return instance
  }

  join(table: string, firstCol: string, secondCol: string): ProductModel {
    return ProductModel.join(table, firstCol, secondCol)
  }

  static join(table: string, firstCol: string, secondCol: string): ProductModel {
    const instance = new ProductModel(null)

    instance.selectFromQuery = instance.selectFromQuery.innerJoin(table, firstCol, secondCol)

    return instance
  }

  static async rawQuery(rawQuery: string): Promise<any> {
    return await sql`${rawQuery}`.execute(db)
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
  return await sql`${rawQuery}`.execute(db)
}

export async function remove(id: number): Promise<void> {
  await DB.instance.deleteFrom('products')
    .where('id', '=', id)
    .execute()
}

export async function whereName(value: string): Promise<ProductModel[]> {
  const query = DB.instance.selectFrom('products').where('name', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new ProductModel(modelItem))
}

export async function whereDescription(value: number): Promise<ProductModel[]> {
  const query = DB.instance.selectFrom('products').where('description', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new ProductModel(modelItem))
}

export async function whereKey(value: number): Promise<ProductModel[]> {
  const query = DB.instance.selectFrom('products').where('key', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new ProductModel(modelItem))
}

export async function whereUnitPrice(value: number): Promise<ProductModel[]> {
  const query = DB.instance.selectFrom('products').where('unit_price', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new ProductModel(modelItem))
}

export async function whereStatus(value: string): Promise<ProductModel[]> {
  const query = DB.instance.selectFrom('products').where('status', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new ProductModel(modelItem))
}

export async function whereImage(value: string): Promise<ProductModel[]> {
  const query = DB.instance.selectFrom('products').where('image', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new ProductModel(modelItem))
}

export async function whereProviderId(value: string): Promise<ProductModel[]> {
  const query = DB.instance.selectFrom('products').where('provider_id', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new ProductModel(modelItem))
}

export const Product = ProductModel

export default Product
