import type { Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import { randomUUIDv7 } from 'bun'
import { cache } from '@stacksjs/cache'
import { db, sql } from '@stacksjs/database'
import { HttpError, ModelNotFoundException } from '@stacksjs/error-handling'

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
    this.selectFromQuery = db.selectFrom('products')
    this.updateFromQuery = db.updateTable('products')
    this.deleteFromQuery = db.deleteFrom('products')
    this.hasSelect = false
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

  // Method to find a Product by ID
  async find(id: number): Promise<ProductModel | undefined> {
    const query = db.selectFrom('products').where('id', '=', id).selectAll()

    const model = await query.executeTakeFirst()

    if (!model)
      return undefined

    const result = await this.mapWith(model)

    const data = new ProductModel(result as ProductType)

    cache.getOrSet(`product:${id}`, JSON.stringify(model))

    return data
  }

  // Method to find a Product by ID
  static async find(id: number): Promise<ProductModel | undefined> {
    const model = await db.selectFrom('products').where('id', '=', id).selectAll().executeTakeFirst()

    if (!model)
      return undefined

    const instance = new ProductModel(null)

    const result = await instance.mapWith(model)

    const data = new ProductModel(result as ProductType)

    cache.getOrSet(`product:${id}`, JSON.stringify(model))

    return data
  }

  async mapWith(model: ProductType): Promise<ProductType> {
    return model
  }

  static async all(): Promise<ProductModel[]> {
    const models = await db.selectFrom('products').selectAll().execute()

    const data = await Promise.all(models.map(async (model: ProductType) => {
      const instance = new ProductModel(model)

      const results = await instance.mapWith(model)

      return new ProductModel(results)
    }))

    return data
  }

  static async findOrFail(id: number): Promise<ProductModel> {
    const model = await db.selectFrom('products').where('id', '=', id).selectAll().executeTakeFirst()

    const instance = new ProductModel(null)

    if (model === undefined)
      throw new ModelNotFoundException(404, `No ProductModel results for ${id}`)

    cache.getOrSet(`product:${id}`, JSON.stringify(model))

    const result = await instance.mapWith(model)

    const data = new ProductModel(result as ProductType)

    return data
  }

  async findOrFail(id: number): Promise<ProductModel> {
    const model = await db.selectFrom('products').where('id', '=', id).selectAll().executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, `No ProductModel results for ${id}`)

    cache.getOrSet(`product:${id}`, JSON.stringify(model))

    const result = await this.mapWith(model)

    const data = new ProductModel(result as ProductType)

    return data
  }

  static async findMany(ids: number[]): Promise<ProductModel[]> {
    let query = db.selectFrom('products').where('id', 'in', ids)

    const instance = new ProductModel(null)

    query = query.selectAll()

    const model = await query.execute()

    return model.map(modelItem => instance.parseResult(new ProductModel(modelItem)))
  }

  static skip(count: number): ProductModel {
    const instance = new ProductModel(null)

    instance.selectFromQuery = instance.selectFromQuery.offset(count)

    return instance
  }

  skip(count: number): ProductModel {
    this.selectFromQuery = this.selectFromQuery.offset(count)

    return this
  }

  static take(count: number): ProductModel {
    const instance = new ProductModel(null)

    instance.selectFromQuery = instance.selectFromQuery.limit(count)

    return instance
  }

  take(count: number): this {
    this.selectFromQuery = this.selectFromQuery.limit(count)

    return this
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
    if (this.hasSelect) {
      const model = await this.selectFromQuery.execute()
      return model.map((modelItem: ProductModel) => modelItem[field])
    }

    const model = await this.selectFromQuery.selectAll().execute()
    return model.map((modelItem: ProductModel) => modelItem[field])
  }

  static async count(): Promise<number> {
    const instance = new ProductModel(null)

    return instance.selectFromQuery
      .select(sql`COUNT(*) as count`)
      .executeTakeFirst()
  }

  async count(): Promise<number> {
    return this.selectFromQuery
      .select(sql`COUNT(*) as count`)
      .executeTakeFirst()
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

  whereHas(
    relation: string,
    callback: (query: ProductModel) => ProductModel,
  ): ProductModel {
    this.selectFromQuery = this.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(
        callback(selectFrom(relation))
          .select('1')
          .whereRef(`${relation}.product_id`, '=', 'products.id'),
      ),
    )

    return this
  }

  static whereHas(
    relation: string,
    callback: (query: ProductModel) => ProductModel,
  ): ProductModel {
    const instance = new ProductModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(
        callback(selectFrom(relation))
          .select('1')
          .whereRef(`${relation}.product_id`, '=', 'products.id'),
      ),
    )

    return instance
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

  // Method to get a Product by criteria
  async get(): Promise<ProductModel[]> {
    if (this.hasSelect) {
      const model = await this.selectFromQuery.execute()

      return model.map((modelItem: ProductModel) => new ProductModel(modelItem))
    }

    const model = await this.selectFromQuery.selectAll().execute()

    return model.map((modelItem: ProductModel) => new ProductModel(modelItem))
  }

  async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<ProductResponse> {
    const totalRecordsResult = await db.selectFrom('products')
      .select(db.fn.count('id').as('total')) // Use 'id' or another actual column name
      .executeTakeFirst()

    const totalRecords = Number(totalRecordsResult?.total) || 0
    const totalPages = Math.ceil(totalRecords / (options.limit ?? 10))

    if (this.hasSelect) {
      const productsWithExtra = await this.selectFromQuery.orderBy('id', 'asc')
        .limit((options.limit ?? 10) + 1)
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

    const productsWithExtra = await this.selectFromQuery.orderBy('id', 'asc')
      .limit((options.limit ?? 10) + 1)
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

  // Method to get all products
  static async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<ProductResponse> {
    const totalRecordsResult = await db.selectFrom('products')
      .select(db.fn.count('id').as('total')) // Use 'id' or another actual column name
      .executeTakeFirst()

    const totalRecords = Number(totalRecordsResult?.total) || 0
    const totalPages = Math.ceil(totalRecords / (options.limit ?? 10))

    const productsWithExtra = await db.selectFrom('products')
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

  // Method to create a new product
  static async create(newProduct: NewProduct): Promise<ProductModel> {
    const instance = new ProductModel(null)

    const filteredValues = Object.fromEntries(
      Object.entries(newProduct).filter(([key]) => instance.fillable.includes(key)),
    ) as NewProduct

    filteredValues.uuid = randomUUIDv7()

    const result = await db.insertInto('products')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await find(Number(result.numInsertedOrUpdatedRows)) as ProductModel

    return model
  }

  static async createMany(newProducts: NewProduct[]): Promise<void> {
    const instance = new ProductModel(null)

    const filteredValues = newProducts.map(newUser =>
      Object.fromEntries(
        Object.entries(newUser).filter(([key]) => instance.fillable.includes(key)),
      ) as NewProduct,
    )

    filteredValues.forEach((model) => {
      model.uuid = randomUUIDv7()
    })

    await db.insertInto('products')
      .values(filteredValues)
      .executeTakeFirst()
  }

  static async forceCreate(newProduct: NewProduct): Promise<ProductModel> {
    const result = await db.insertInto('products')
      .values(newProduct)
      .executeTakeFirst()

    const model = await find(Number(result.numInsertedOrUpdatedRows)) as ProductModel

    return model
  }

  // Method to remove a Product
  static async remove(id: number): Promise<any> {
    return await db.deleteFrom('products')
      .where('id', '=', id)
      .execute()
  }

  where(...args: (string | number | boolean | undefined | null)[]): ProductModel {
    let column: any
    let operator: any
    let value: any

    if (args.length === 2) {
      [column, value] = args
      operator = '='
    }
    else if (args.length === 3) {
      [column, operator, value] = args
    }
    else {
      throw new HttpError(500, 'Invalid number of arguments')
    }

    this.selectFromQuery = this.selectFromQuery.where(column, operator, value)

    this.updateFromQuery = this.updateFromQuery.where(column, operator, value)
    this.deleteFromQuery = this.deleteFromQuery.where(column, operator, value)

    return this
  }

  static where(...args: (string | number | boolean | undefined | null)[]): ProductModel {
    let column: any
    let operator: any
    let value: any

    const instance = new ProductModel(null)

    if (args.length === 2) {
      [column, value] = args
      operator = '='
    }
    else if (args.length === 3) {
      [column, operator, value] = args
    }
    else {
      throw new HttpError(500, 'Invalid number of arguments')
    }

    instance.selectFromQuery = instance.selectFromQuery.where(column, operator, value)

    instance.updateFromQuery = instance.updateFromQuery.where(column, operator, value)

    instance.deleteFromQuery = instance.deleteFromQuery.where(column, operator, value)

    return instance
  }

  whereRef(column: string, operator: string, value: string): ProductModel {
    this.selectFromQuery = this.selectFromQuery.whereRef(column, operator, value)

    return this
  }

  static whereRef(column: string, operator: string, value: string): ProductModel {
    const instance = new ProductModel(null)

    instance.selectFromQuery = instance.selectFromQuery.whereRef(column, operator, value)

    return instance
  }

  orWhere(...args: Array<[string, string, any]>): ProductModel {
    if (args.length === 0) {
      throw new HttpError(500, 'At least one condition must be provided')
    }

    // Use the expression builder to append the OR conditions
    this.selectFromQuery = this.selectFromQuery.where((eb: any) =>
      eb.or(
        args.map(([column, operator, value]) => eb(column, operator, value)),
      ),
    )

    this.updateFromQuery = this.updateFromQuery.where((eb: any) =>
      eb.or(
        args.map(([column, operator, value]) => eb(column, operator, value)),
      ),
    )

    this.deleteFromQuery = this.deleteFromQuery.where((eb: any) =>
      eb.or(
        args.map(([column, operator, value]) => eb(column, operator, value)),
      ),
    )

    return this
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
    if (condition)
      callback(this.selectFromQuery)

    return this
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
    this.selectFromQuery = this.selectFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    this.updateFromQuery = this.updateFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    return this
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
    this.selectFromQuery = this.selectFromQuery.where(column, 'in', values)

    this.updateFromQuery = this.updateFromQuery.where(column, 'in', values)

    this.deleteFromQuery = this.deleteFromQuery.where(column, 'in', values)

    return this
  }

  static whereIn(column: keyof ProductType, values: any[]): ProductModel {
    const instance = new ProductModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(column, 'in', values)

    instance.updateFromQuery = instance.updateFromQuery.where(column, 'in', values)

    instance.deleteFromQuery = instance.deleteFromQuery.where(column, 'in', values)

    return instance
  }

  whereBetween(column: keyof ProductType, range: [any, any]): ProductModel {
    if (range.length !== 2) {
      throw new Error('Range must have exactly two values: [min, max]')
    }

    const query = sql` ${sql.raw(column as string)} between ${range[0]} and ${range[1]} `

    this.selectFromQuery = this.selectFromQuery.where(query)
    this.updateFromQuery = this.updateFromQuery.where(query)
    this.deleteFromQuery = this.deleteFromQuery.where(query)

    return this
  }

  static whereBetween(column: keyof ProductType, range: [any, any]): ProductModel {
    if (range.length !== 2) {
      throw new Error('Range must have exactly two values: [min, max]')
    }

    const instance = new ProductModel(null)

    const query = sql` ${sql.raw(column as string)} between ${range[0]} and ${range[1]} `

    instance.selectFromQuery = instance.selectFromQuery.where(query)
    instance.updateFromQuery = instance.updateFromQuery.where(query)
    instance.deleteFromQuery = instance.deleteFromQuery.where(query)

    return instance
  }

  whereNotIn(column: keyof ProductType, values: any[]): ProductModel {
    this.selectFromQuery = this.selectFromQuery.where(column, 'not in', values)

    this.updateFromQuery = this.updateFromQuery.where(column, 'not in', values)

    this.deleteFromQuery = this.deleteFromQuery.where(column, 'not in', values)

    return this
  }

  static whereNotIn(column: keyof ProductType, values: any[]): ProductModel {
    const instance = new ProductModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(column, 'not in', values)

    instance.updateFromQuery = instance.updateFromQuery.where(column, 'not in', values)

    instance.deleteFromQuery = instance.deleteFromQuery.where(column, 'not in', values)

    return instance
  }

  async first(): Promise<ProductModel | undefined> {
    const model = await this.selectFromQuery.selectAll().executeTakeFirst()

    if (!model)
      return undefined

    const result = await this.mapWith(model)

    const data = new ProductModel(result as ProductType)

    return data
  }

  async firstOrFail(): Promise<ProductModel | undefined> {
    const model = await this.selectFromQuery.executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, 'No ProductModel results found for query')

    const instance = new ProductModel(null)

    const result = await instance.mapWith(model)

    const data = new ProductModel(result as ProductType)

    return data
  }

  async exists(): Promise<boolean> {
    const model = await this.selectFromQuery.executeTakeFirst()

    return model !== null || model !== undefined
  }

  static async first(): Promise<ProductType | undefined> {
    const model = await db.selectFrom('products')
      .selectAll()
      .executeTakeFirst()

    if (!model)
      return undefined

    const instance = new ProductModel(null)

    const result = await instance.mapWith(model)

    const data = new ProductModel(result as ProductType)

    return data
  }

  static async latest(): Promise<ProductType | undefined> {
    const model = await db.selectFrom('products')
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
    const model = await db.selectFrom('products')
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
      throw new Error('Condition must contain at least one key-value pair')
    }

    const value = condition[key]

    // Attempt to find the first record matching the condition
    const existingProduct = await db.selectFrom('products')
      .selectAll()
      .where(key, '=', value)
      .executeTakeFirst()

    if (existingProduct) {
      const instance = new ProductModel(null)
      const result = await instance.mapWith(existingProduct)
      return new ProductModel(result as ProductType)
    }
    else {
      // If not found, create a new user
      return await this.create(newProduct)
    }
  }

  static async updateOrCreate(
    condition: Partial<ProductType>,
    newProduct: NewProduct,
  ): Promise<ProductModel> {
    const key = Object.keys(condition)[0] as keyof ProductType

    if (!key) {
      throw new Error('Condition must contain at least one key-value pair')
    }

    const value = condition[key]

    // Attempt to find the first record matching the condition
    const existingProduct = await db.selectFrom('products')
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
      const updatedProduct = await db.selectFrom('products')
        .selectAll()
        .where(key, '=', value)
        .executeTakeFirst()

      if (!updatedProduct) {
        throw new Error('Failed to fetch updated record')
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
    this.withRelations = relations

    return this
  }

  static with(relations: string[]): ProductModel {
    const instance = new ProductModel(null)

    instance.withRelations = relations

    return instance
  }

  async last(): Promise<ProductType | undefined> {
    return await db.selectFrom('products')
      .selectAll()
      .orderBy('id', 'desc')
      .executeTakeFirst()
  }

  static async last(): Promise<ProductType | undefined> {
    const model = await db.selectFrom('products').selectAll().orderBy('id', 'desc').executeTakeFirst()

    if (!model)
      return undefined

    const instance = new ProductModel(null)

    const result = await instance.mapWith(model)

    const data = new ProductModel(result as ProductType)

    return data
  }

  static orderBy(column: keyof ProductType, order: 'asc' | 'desc'): ProductModel {
    const instance = new ProductModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, order)

    return instance
  }

  static groupBy(column: keyof ProductType): ProductModel {
    const instance = new ProductModel(null)

    instance.selectFromQuery = instance.selectFromQuery.groupBy(column)

    return instance
  }

  static having(column: keyof ProductType, operator: string, value: any): ProductModel {
    const instance = new ProductModel(null)

    instance.selectFromQuery = instance.selectFromQuery.having(column, operator, value)

    return instance
  }

  orderBy(column: keyof ProductType, order: 'asc' | 'desc'): ProductModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, order)

    return this
  }

  static inRandomOrder(): ProductModel {
    const instance = new ProductModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(sql` ${sql.raw('RANDOM()')} `)

    return instance
  }

  inRandomOrder(): ProductModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(sql` ${sql.raw('RANDOM()')} `)

    return this
  }

  having(column: keyof ProductType, operator: string, value: any): ProductModel {
    this.selectFromQuery = this.selectFromQuery.having(column, operator, value)

    return this
  }

  groupBy(column: keyof ProductType): ProductModel {
    this.selectFromQuery = this.selectFromQuery.groupBy(column)

    return this
  }

  static orderByDesc(column: keyof ProductType): ProductModel {
    const instance = new ProductModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'desc')

    return instance
  }

  orderByDesc(column: keyof ProductType): ProductModel {
    this.selectFromQuery = this.orderBy(column, 'desc')

    return this
  }

  static orderByAsc(column: keyof ProductType): ProductModel {
    const instance = new ProductModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'asc')

    return instance
  }

  orderByAsc(column: keyof ProductType): ProductModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, 'desc')

    return this
  }

  async update(product: ProductUpdate): Promise<ProductModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(product).filter(([key]) => this.fillable.includes(key)),
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
      await db.insertInto('products')
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

    return await db.deleteFrom('products')
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
  const query = db.selectFrom('products').where('id', '=', id).selectAll()

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
  const result = await db.insertInto('products')
    .values(newProduct)
    .executeTakeFirstOrThrow()

  return await find(Number(result.numInsertedOrUpdatedRows)) as ProductModel
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(db)
}

export async function remove(id: number): Promise<void> {
  await db.deleteFrom('products')
    .where('id', '=', id)
    .execute()
}

export async function whereName(value: string): Promise<ProductModel[]> {
  const query = db.selectFrom('products').where('name', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new ProductModel(modelItem))
}

export async function whereDescription(value: number): Promise<ProductModel[]> {
  const query = db.selectFrom('products').where('description', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new ProductModel(modelItem))
}

export async function whereKey(value: number): Promise<ProductModel[]> {
  const query = db.selectFrom('products').where('key', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new ProductModel(modelItem))
}

export async function whereUnitPrice(value: number): Promise<ProductModel[]> {
  const query = db.selectFrom('products').where('unit_price', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new ProductModel(modelItem))
}

export async function whereStatus(value: string): Promise<ProductModel[]> {
  const query = db.selectFrom('products').where('status', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new ProductModel(modelItem))
}

export async function whereImage(value: string): Promise<ProductModel[]> {
  const query = db.selectFrom('products').where('image', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new ProductModel(modelItem))
}

export async function whereProviderId(value: string): Promise<ProductModel[]> {
  const query = db.selectFrom('products').where('provider_id', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new ProductModel(modelItem))
}

export const Product = ProductModel

export default Product
